import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db,getSetting,HttpError,runtime} from './server';
import {digest,token,passwordHash,passwordMatches,dummyHash,rateLimit} from './customer-auth';
const cookieName='__Host-cca_admin',lifetime=12*60*60*1000;
const loginSchema=z.string().trim().toLowerCase().min(3).max(80).regex(/^[a-z0-9._@-]+$/,'Use letras sem acento, números, ponto, @ ou traço no login.');
const passwordSchema=z.string().min(12,'Use uma senha com pelo menos 12 caracteres.').max(128);
export type PanelUser={userId:string;displayName:string;owner:boolean;role:'admin'|'attendance'|'production';accountId?:string};
function rawToken(req:Request){const v=(req.headers.get('cookie')||'').split(';').map(c=>c.trim()).find(c=>c.startsWith(cookieName+'='))?.slice(cookieName.length+1);return v&&/^[a-f0-9]{64}$/.test(v)?v:null}
const sessionCookie=(v:string,clear=false)=>`${cookieName}=${v}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${clear?0:lifetime/1000}`;
export async function panelUser(req:Request):Promise<PanelUser|null>{
 const u=await getChatGPTUser();if(u&&await getSetting('admin')===u.userId)return {userId:u.userId,displayName:u.displayName||'Responsável',owner:true,role:'admin'};
 const value=rawToken(req);if(value){const a=await db().prepare('SELECT a.id,a.name,a.role FROM admin_sessions s JOIN admin_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires>? AND a.active=1').bind(await digest(value),Date.now()).first<any>();if(a)return {userId:'admin:'+a.id,accountId:a.id,displayName:a.name,owner:false,role:a.role||'admin'}}
 return null;
}
export async function panelAuthRoute(req:Request,path:string,body:()=>Promise<any>){
 const json=(v:unknown,status=200,cookie?:string)=>Response.json(v,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
 if(path==='admin/activate'&&req.method==='POST'){
  await rateLimit(req,'panel-activate:'+(req.headers.get('cf-connecting-ip')||'shared'),10);
  const b=z.object({code:z.string().trim().min(12).max(100),name:z.string().trim().min(2).max(80),login:loginSchema,password:passwordSchema}).strict().parse(await body());
  const expected=runtime.ADMIN_ACTIVATION_HASH||'',expires=Number(runtime.ADMIN_ACTIVATION_EXPIRES);
  const supplied=await digest(b.code.replace(/[\s-]/g,'').toUpperCase());
  let difference=supplied.length^expected.length;for(let i=0;i<supplied.length;i++)difference|=supplied.charCodeAt(i)^(expected.charCodeAt(i)||0);
  if(!/^[a-f0-9]{64}$/.test(expected)||!Number.isFinite(expires)||Date.now()>=expires||difference)throw new HttpError(403,'Código inválido ou vencido. Confira o código recebido.');
  const usedKey='admin_activation_used:'+expected;
  if(await getSetting(usedKey)||await db().prepare('SELECT id FROM admin_accounts LIMIT 1').first())throw new HttpError(409,'O primeiro acesso já foi criado. Entre com seu login e senha.');
  const id=crypto.randomUUID(),guard='activation:'+id,value=token(),now=Date.now(),hash=await passwordHash(b.password),sessionHash=await digest(value);
  try{await db().batch([
   db().prepare('INSERT INTO commerce_guards(id,valid) SELECT ?,NOT EXISTS(SELECT 1 FROM admin_accounts)').bind(guard),
   db().prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind(usedKey,id),
   db().prepare("INSERT INTO admin_accounts(id,name,login,password_hash,created_at,role,active) VALUES(?,?,?,?,?,'admin',1)").bind(id,b.name,b.login,hash,now),
   db().prepare('INSERT INTO admin_sessions(token_hash,account_id,expires) VALUES(?,?,?)').bind(sessionHash,id,now+lifetime),
   db().prepare('DELETE FROM commerce_guards WHERE id=?').bind(guard)
  ])}catch{throw new HttpError(409,'O primeiro acesso não pôde ser criado. Atualize a página e tente entrar com seu login.');}
  return json({ok:true},201,sessionCookie(value));
 }
 if(path==='admin/login'&&req.method==='POST'){
  const b=z.object({login:loginSchema,password:z.string().max(128)}).parse(await body());
  await rateLimit(req,'panel-ip:'+(req.headers.get('cf-connecting-ip')||'shared'),40);await rateLimit(req,'panel-login:'+b.login,10);
  const a=await db().prepare('SELECT * FROM admin_accounts WHERE login=?').bind(b.login).first<any>();
  if(!await passwordMatches(b.password,a?.password_hash||dummyHash)||!a||!a.active)throw new HttpError(401,'Login ou senha incorretos.');
  const value=token();await db().prepare('INSERT INTO admin_sessions(token_hash,account_id,expires) VALUES(?,?,?)').bind(await digest(value),a.id,Date.now()+lifetime).run();return json({ok:true},200,sessionCookie(value));
 }
 if(path==='admin/logout'&&req.method==='POST'){const v=rawToken(req);if(v)await db().prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await digest(v)).run();return json({ok:true},200,sessionCookie('',true))}
 if(!['admin/accounts','admin/password'].includes(path))return null;
 const u=await panelUser(req);if(!u)throw new HttpError(401,'Entre no painel para continuar.');
 if(path==='admin/accounts'){
  if(u.role!=='admin')throw new HttpError(403,'Use a conta responsável da loja para gerenciar os acessos.');
  if(req.method==='GET'){const r=await db().prepare('SELECT id,name,login,role,active,created_at FROM admin_accounts ORDER BY created_at').all();return json({accounts:r.results})}
  if(req.method==='POST'){
   const b=z.object({name:z.string().trim().min(2).max(80),login:loginSchema,password:passwordSchema,role:z.enum(['admin','attendance','production']).default('attendance')}).parse(await body());
   const count=await db().prepare('SELECT COUNT(*) n FROM admin_accounts').first<any>();if(count.n>=10)throw new HttpError(422,'Limite de 10 acessos ao painel.');
   const result=await db().prepare('INSERT OR IGNORE INTO admin_accounts(id,name,login,password_hash,created_at,role) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),b.name,b.login,await passwordHash(b.password),Date.now(),b.role).run();if(!result.meta.changes)throw new HttpError(409,'Este login já está em uso.');return json({ok:true},201);
  }
  if(req.method==='PATCH'){
   const b=z.object({id:z.string().uuid(),name:z.string().trim().min(2).max(80),login:loginSchema,role:z.enum(['admin','attendance','production']),active:z.boolean()}).parse(await body());
   if(b.id===u.accountId&&(!b.active||b.role!==u.role))throw new HttpError(422,'Use outro acesso de administradora para alterar sua própria permissão.');
   const existing=await db().prepare('SELECT id FROM admin_accounts WHERE login=? AND id<>?').bind(b.login,b.id).first();if(existing)throw new HttpError(409,'Este login já está em uso.');
   const old=await db().prepare('SELECT role,active FROM admin_accounts WHERE id=?').bind(b.id).first<any>();if(!old)throw new HttpError(404,'Acesso não encontrado.');
   await db().batch([db().prepare('UPDATE admin_accounts SET name=?,login=?,role=?,active=? WHERE id=?').bind(b.name,b.login,b.role,b.active?1:0,b.id),...(old.role!==b.role||!b.active?[db().prepare('DELETE FROM admin_sessions WHERE account_id=?').bind(b.id)]:[])]);return json({ok:true});
  }
  if(req.method==='DELETE'){const {id}=z.object({id:z.string().uuid()}).parse(await body());if(id===u.accountId)throw new HttpError(422,'Você não pode remover seu próprio acesso.');await db().batch([db().prepare('DELETE FROM admin_sessions WHERE account_id=?').bind(id),db().prepare('DELETE FROM admin_accounts WHERE id=?').bind(id)]);return json({ok:true})}
 }
 if(path==='admin/password'&&req.method==='PUT'){
  const b=z.object({id:z.string().uuid().optional(),currentPassword:z.string().max(128).optional(),password:passwordSchema}).parse(await body());const id=u.role==='admin'?(b.id||u.accountId):u.accountId;if(!id)throw new HttpError(422,'Escolha o acesso para alterar a senha.');
  const a=await db().prepare('SELECT password_hash FROM admin_accounts WHERE id=?').bind(id).first<any>();if(!a)throw new HttpError(404,'Acesso não encontrado.');
  if(u.role!=='admin'){await rateLimit(req,'panel-password:'+id,10);if(!await passwordMatches(b.currentPassword||'',a.password_hash))throw new HttpError(403,'Senha atual incorreta.');}
  await db().batch([db().prepare('UPDATE admin_accounts SET password_hash=? WHERE id=?').bind(await passwordHash(b.password),id),db().prepare('DELETE FROM admin_sessions WHERE account_id=?').bind(id)]);return json({ok:true,signInAgain:id===u.accountId});
 }
 return null;
}
