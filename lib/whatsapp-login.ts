import {randomInt} from 'node:crypto';
import {z} from 'zod';
import {db,HttpError,settings} from './server';
import {digest,token,rateLimit,newSession,setSessionCookie} from './customer-auth';
import {findWhatsAppCustomer} from './whatsapp-customers';
import {bridgeStatus} from './whatsapp-bridge';

const phoneSchema=z.string().transform(s=>s.replace(/\D/g,'')).transform(s=>s.startsWith('55')&&s.length>11?s.slice(2):s).refine(s=>/^\d{10,11}$/.test(s),'Informe o celular com DDD.');
export async function whatsappLoginRoute(req:Request,path:string,body:()=>Promise<any>){
 const json=(value:unknown)=>Response.json(value,{headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST')return null;
 if(path==='customer/whatsapp-code'){
  const {phone}=z.object({phone:phoneSchema}).parse(await body());
  await rateLimit(req,'wa-login-ip:'+(req.headers.get('cf-connecting-ip')||'shared'),10);await rateLimit(req,'wa-login-phone:'+phone,3);
  const config=await settings();if(!config.whatsappEnabled||config.whatsappMode!=='webjs'||!(await bridgeStatus()).connected)throw new HttpError(503,'O WhatsApp da loja está reconectando. Tente novamente em alguns instantes.');
  const id=crypto.randomUUID(),profile=await findWhatsAppCustomer('55'+phone);
  if(profile){
   const code=String(randomInt(100000,1000000)),now=Date.now();
   await db().prepare('DELETE FROM whatsapp_login_codes WHERE phone=? OR expires<?').bind(phone,now).run();
   await db().prepare('INSERT INTO whatsapp_login_codes(id,phone,user_id,code_hash,expires) VALUES(?,?,?,?,?)').bind(id,phone,profile.userId,await digest(id+':'+code),now+600000).run();
   const text=`💕 ${config.name}\nSeu código para entrar no site é: *${code}*\nVálido por 10 minutos e apenas uma vez. Não compartilhe. Se não pediu, ignore esta mensagem.`;
   await db().prepare('INSERT INTO whatsapp_outbox(id,order_id,recipient,phone,status,created_at,updated_at,event,detail) VALUES(?,?,?,?,?,?,?,?,?)').bind('login-'+id,id,'cliente','55'+phone,'queued',now,now,'Código de acesso',text).run();
  }
  // Keep unknown phone numbers indistinguishable from registered customers.
  return json({ok:true,challenge:id});
 }
 if(path==='customer/whatsapp-login'){
  const {challenge,code}=z.object({challenge:z.string().uuid(),code:z.string().regex(/^\d{6}$/,'Informe o código de seis dígitos.')}).parse(await body());
  await rateLimit(req,'wa-login-verify-ip:'+(req.headers.get('cf-connecting-ip')||'shared'),20);
  const row=await db().prepare('UPDATE whatsapp_login_codes SET attempts=attempts+1 WHERE id=? AND attempts<5 AND expires>? RETURNING *').bind(challenge,Date.now()).first<any>();
  const hash=await digest(challenge+':'+code);
  if(!row||row.code_hash!==hash)throw new HttpError(401,'Código inválido ou expirado. Peça um novo código.');
  const consumed=await db().prepare('DELETE FROM whatsapp_login_codes WHERE id=? AND code_hash=? AND expires>? AND attempts<=5 RETURNING id').bind(challenge,hash,Date.now()).first();
  if(!consumed)throw new HttpError(401,'Código já utilizado. Peça um novo código.');
  const profile=await db().prepare('SELECT data FROM profiles WHERE user_id=?').bind(row.user_id).first<any>();
  if(!profile)throw new HttpError(409,'Cadastro atualizado. Solicite um novo código.');
  const data=JSON.parse(profile.data);
  // Phone-only accounts use their real phone as identifier, as supported by normal login.
  // No usable password is created; existing customer passwords remain unchanged.
  await db().prepare('INSERT OR IGNORE INTO customers(id,email,name,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').bind(row.user_id,row.phone,data.name||'Cliente','!whatsapp-only',await digest(token()),Date.now()).run();
  const saved=await db().prepare('SELECT id FROM customers WHERE id=?').bind(row.user_id).first();
  if(!saved)throw new HttpError(409,'Precisamos conferir seu cadastro. Fale com a confeitaria.');
  const session=await newSession(row.user_id),response=json({ok:true});response.headers.set('Set-Cookie',setSessionCookie(session));return response;
 }
 return null;
}
