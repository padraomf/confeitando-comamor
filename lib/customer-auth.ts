import { scrypt,timingSafeEqual } from 'node:crypto';
import { db,HttpError } from './server';
export type Shopper={userId:string;displayName:string;email:string;guest:boolean};
const sessionCookie='__Host-cca_customer',guestCookie='__Host-cca_guest';
const lifetime=30*24*60*60*1000;
export const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('')}
function cookie(req:Request,name:string){const found=(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='));const value=found?.slice(name.length+1);return value&&/^[a-f0-9]{64}$/.test(value)?value:null}
export function setSessionCookie(value:string,guest=false,clear=false){return `${guest?guestCookie:sessionCookie}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${clear?0:lifetime/1000}`}
async function lookup(req:Request,guest:boolean):Promise<Shopper|null>{const value=cookie(req,guest?guestCookie:sessionCookie);if(!value)return null;const row=await db().prepare('SELECT actor_id,kind FROM customer_sessions WHERE token_hash=? AND expires>? AND kind=?').bind(await digest(value),Date.now(),guest?'guest':'customer').first<any>();if(!row)return null;if(guest)return {userId:row.actor_id,displayName:'Convidado',email:'',guest:true};const c=await db().prepare('SELECT id,name,email FROM customers WHERE id=?').bind(row.actor_id).first<any>();return c?{userId:c.id,displayName:c.name,email:c.email,guest:false}:null}
export const customer=(req:Request)=>lookup(req,false);
export const guest=(req:Request)=>lookup(req,true);
export async function shopper(req:Request){const user=await customer(req)||await guest(req);if(!user)throw new HttpError(401,'Entre na sua conta ou escolha comprar como convidado.');return user}
export async function customerIdentity(req:Request){const user=await customer(req);if(!user)throw new HttpError(401,'Entre na sua conta para curtir e comentar.');return user}
export async function newSession(actorId:string,isGuest=false){const value=token();await db().prepare('INSERT INTO customer_sessions(token_hash,actor_id,kind,expires) VALUES(?,?,?,?)').bind(await digest(value),actorId,isGuest?'guest':'customer',Date.now()+lifetime).run();return value}
export async function revoke(req:Request){for(const name of [sessionCookie,guestCookie]){const value=cookie(req,name);if(value)await db().prepare('DELETE FROM customer_sessions WHERE token_hash=?').bind(await digest(value)).run()}}
export async function rateLimit(req:Request,scope:string,limit=15){const now=Date.now(),window=15*60*1000;const key=await digest(scope+':'+Math.floor(now/window));const row=await db().prepare('INSERT INTO auth_limits(key,hits,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,now+window).first<any>();if(row.hits>limit)throw new HttpError(429,'Muitas tentativas. Aguarde 15 minutos e tente novamente.');}
export async function authLimit(req:Request,email:string){await rateLimit(req,'ip:'+(req.headers.get('cf-connecting-ip')||'shared'),60);await rateLimit(req,'email:'+email,15);}
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,32,{N:16384,r:8,p:5,maxmem:32*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export async function passwordHash(password:string){const salt=token();return `scrypt:16384:8:5:${salt}:${(await derive(password,salt)).toString('hex')}`}
export async function passwordMatches(password:string,encoded:string){const parts=encoded.split(':');if(parts.length!==6||parts.slice(0,4).join(':')!=='scrypt:16384:8:5')return false;const expected=Buffer.from(parts[5],'hex'),actual=await derive(password,parts[4]);return expected.length===actual.length&&timingSafeEqual(expected,actual)}
// Unknown accounts use the same work factor to avoid a fast existence oracle.
export const dummyHash='scrypt:16384:8:5:'+('0'.repeat(64))+':'+('0'.repeat(64));
