import {z} from 'zod';
import {db,HttpError} from './server';
import {customer,guest,shopper,token,digest,newSession,setSessionCookie,revoke,authLimit,rateLimit,passwordHash,passwordMatches,dummyHash} from './customer-auth';
const emailSchema=z.string().trim().toLowerCase().email('Informe um e-mail válido').max(254);
const emailOrPhoneSchema=z.string().trim().toLowerCase().max(254);
const passwordSchema=z.string().min(12,'Use uma senha com pelo menos 12 caracteres').max(128,'Use até 128 caracteres');
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function customerRoute(req:Request,path:string,body:()=>Promise<any>):Promise<Response|null>{
 if(path==='customer/session'&&req.method==='GET'){const user=await customer(req),visitor=user?null:await guest(req);return json({signedIn:!!user,guest:!!visitor,user:user?{name:user.displayName,email:user.email}:null})}
 if(path==='customer/guest'&&req.method==='POST'){const existing=await guest(req);if(existing)return json({guest:true});await rateLimit(req,'guest:'+(req.headers.get('cf-connecting-ip')||'shared'),60);const value=await newSession('guest_'+crypto.randomUUID(),true);const response=json({guest:true});response.headers.set('Set-Cookie',setSessionCookie(value,true));return response;}
 if(path==='customer/lookup-phone'&&req.method==='POST'){
 const u=await shopper(req).catch(()=>null);
 const input=z.object({phone:z.string().transform(s=>s.replace(/\D/g,'')).refine(s=>/^\d{10,11}$/.test(s),'Telefone inválido')}).parse(await body());
 await rateLimit(req,'lookup:'+(req.headers.get('cf-connecting-ip')||'shared'),20);
  const cleanPhoneSQL = `REPLACE(REPLACE(REPLACE(REPLACE(json_extract(data,'$.phone'), ' ', ''), '-', ''), '(', ''), ')', '')`;
  const profile=await db().prepare(`SELECT data FROM profiles WHERE ${cleanPhoneSQL}=?`).bind(input.phone).first<any>();
  if(!profile)return json({exists:false});
 const data=JSON.parse(profile.data);
 let maskedAddress=null;
 let quote=null;
 if(data.address){
   const parts=[];
   if(data.address.street)parts.push(data.address.street.slice(0,3)+'***');
   if(data.address.district)parts.push(data.address.district);
   maskedAddress=parts.join(', ')||null;
   
   if (u && data.address.location?.confirmed) {
     const {routeQuote} = await import('./route-service');
     try {
        const {fee,distance} = await routeQuote(data.address);
        const id=crypto.randomUUID(),expires=Date.now()+15*60000;
        await db().prepare('INSERT INTO quotes(id,user_id,address,distance,fee,expires) VALUES(?,?,?,?,?,?)').bind(id,u.userId,JSON.stringify(data.address),distance,fee,expires).run();
        quote = {id,distance,fee,expires,address:data.address};
     } catch {}
   }
 }
  const maskedEmail = data.email ? data.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') : '';
  let maskedCpf = '';
  if (data.cpf) {
    const cleanCpf = data.cpf.replace(/\D/g, '');
    if (cleanCpf.length === 11) {
      maskedCpf = `${cleanCpf.slice(0, 3)}.***.***-${cleanCpf.slice(9, 11)}`;
    } else {
      maskedCpf = data.cpf.replace(/^(.{3}).*(.{2})$/, '$1***$2');
    }
  }
  return json({exists:true,name:data.name,maskedAddress,quote,email:maskedEmail,cpf:maskedCpf});}
 if(path==='customer/register'&&req.method==='POST'){
 const input=z.object({name:z.string().trim().min(3,'Informe seu nome').max(120),email:emailOrPhoneSchema,password:passwordSchema}).parse(await body());await authLimit(req,input.email);const encoded=await passwordHash(input.password);const recoveryCode=token();const id='customer_'+crypto.randomUUID();
 const result=await db().prepare('INSERT OR IGNORE INTO customers(id,email,name,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').bind(id,input.email,input.name,encoded,await digest(recoveryCode),Date.now()).run();if(!result.meta.changes)throw new HttpError(409,'Não foi possível criar a conta. Tente entrar ou recuperar o acesso.');
 const value=await newSession(id);const response=json({user:{name:input.name,email:input.email},recoveryCode},201);response.headers.set('Set-Cookie',setSessionCookie(value));return response;}
 if(path==='customer/login'&&req.method==='POST'){
 const rawInput=await body();
 const loginField=rawInput.email||'';
 const isPhone = /^\d/.test(loginField.replace(/\D/g,''));
 const normalized = isPhone ? loginField.replace(/\D/g,'') : loginField.trim().toLowerCase();
 const input=z.object({email:emailOrPhoneSchema,password:z.string().min(1).max(128)}).parse({...rawInput,email:normalized});await authLimit(req,input.email);
 let row;
 if(isPhone){
    const cleanPhoneSQL = `REPLACE(REPLACE(REPLACE(REPLACE(json_extract(data,'$.phone'), ' ', ''), '-', ''), '(', ''), ')', '')`;
    const profile=await db().prepare(`SELECT user_id FROM profiles WHERE ${cleanPhoneSQL}=?`).bind(normalized).first<any>();
   if(profile) row = await db().prepare('SELECT id,name,email,password_hash FROM customers WHERE id=?').bind(profile.user_id).first<any>();
   if(!row) row = await db().prepare('SELECT id,name,email,password_hash FROM customers WHERE email=?').bind(normalized).first<any>();
 } else {
   row = await db().prepare('SELECT id,name,email,password_hash FROM customers WHERE email=?').bind(input.email).first<any>();
 }
 const valid=await passwordMatches(input.password,row?.password_hash||dummyHash);if(!row||!valid)throw new HttpError(401,'Credenciais incorretas.');const value=await newSession(row.id);const response=json({user:{name:row.name,email:row.email}});response.headers.set('Set-Cookie',setSessionCookie(value));return response;}
 if(path==='customer/logout'&&req.method==='POST'){await revoke(req);const response=json({ok:true});response.headers.append('Set-Cookie',setSessionCookie('',false,true));response.headers.append('Set-Cookie',setSessionCookie('',true,true));return response;}
 if(path==='customer/recover'&&req.method==='POST'){
 const input=z.object({email:emailSchema,recoveryCode:z.string().trim().regex(/^[a-f0-9]{64}$/,'Informe o código de recuperação guardado ao criar sua conta'),password:passwordSchema}).parse(await body());await authLimit(req,input.email);const row=await db().prepare('SELECT id,recovery_hash FROM customers WHERE email=?').bind(input.email).first<any>();if(!row||row.recovery_hash!==await digest(input.recoveryCode))throw new HttpError(401,'E-mail ou código de recuperação incorretos.');const replacement=token();const updated=await db().prepare('UPDATE customers SET password_hash=?,recovery_hash=? WHERE id=? AND recovery_hash=?').bind(await passwordHash(input.password),await digest(replacement),row.id,row.recovery_hash).run();if(!updated.meta.changes)throw new HttpError(409,'Código já utilizado.');await db().prepare('DELETE FROM customer_sessions WHERE actor_id=?').bind(row.id).run();return json({recoveryCode:replacement});}
 return null;
}
