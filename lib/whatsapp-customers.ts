import {db} from './server';
import {z} from 'zod';

const nameSchema=z.string().trim().min(2).max(100).refine(name=>!/[\n\r<>]|https?:/i.test(name));
type Contact={phone:string;name:string|null;stage:string;user_id:string|null};
const cleanPhoneSQL="REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(json_extract(data,'$.phone'),' ',''),'-',''),'(',''),')',''),'+',''),'.','')";
export async function findWhatsAppCustomer(phone:string){
 const national=phone.startsWith('55')?phone.slice(2):phone;
 const row=await db().prepare(`SELECT p.user_id,p.data FROM profiles p LEFT JOIN customers c ON c.id=p.user_id WHERE ${cleanPhoneSQL} IN (?,?) ORDER BY CASE WHEN c.id IS NOT NULL THEN 0 ELSE 1 END,p.updated_at DESC LIMIT 1`).bind(national,phone).first<{user_id:string;data:string}>();
 if(row){const data=JSON.parse(row.data);return {userId:row.user_id,name:String(data.name||'').trim()}}
 const alternate=/^\d{2}9[6-9]\d{7}$/.test(national)?national.slice(0,2)+national.slice(3):/^\d{2}[6-9]\d{7}$/.test(national)?national.slice(0,2)+'9'+national.slice(2):null;
 if(!alternate)return null;
 const candidates=await db().prepare(`SELECT p.user_id,p.data FROM profiles p WHERE ${cleanPhoneSQL} IN (?,?) LIMIT 2`).bind(alternate,'55'+alternate).all<{user_id:string;data:string}>();
 // An ambiguous old-format number must not identify the wrong customer.
 if(candidates.results.length!==1)return null;
 const candidate=candidates.results[0],data=JSON.parse(candidate.data);
 return {userId:candidate.user_id,name:String(data.name||'').trim()};
}
async function writeContact(phone:string,name:string|null,stage:string,userId:string|null=null){
 await db().prepare('INSERT INTO whatsapp_contacts(phone,name,stage,user_id,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name,stage=excluded.stage,user_id=excluded.user_id,updated_at=excluded.updated_at').bind(phone,name,stage,userId,Date.now()).run();
}
export async function prepareWhatsAppCustomer(phone:string,text:string):Promise<{reply?:string;stage:string;name?:string;userId?:string;justRegistered?:boolean}>{
 const known=await findWhatsAppCustomer(phone);
 if(known)return {stage:'known',name:known.name,userId:known.userId};
 const contact=await db().prepare('SELECT * FROM whatsapp_contacts WHERE phone=?').bind(phone).first<Contact>();
 if(contact?.stage==='declined')return {stage:'declined',name:contact.name||undefined};
 if(contact?.stage==='confirm_phone'){
  if(/^(sim(?:,? (?:esse|este|[eé] esse|pode|correto|pode cadastrar))?|pode sim|pode ser|isso mesmo|pode (?:cadastrar|registrar|usar)|confirmo|correto|esse mesmo|[eé] esse(?: mesmo)?|[eé] este(?: mesmo)?)[.!\s]*$/i.test(text.trim())){
   // This is a store customer profile, just like a customer added by the team. No login session is issued.
   const userId='whatsapp:'+phone,name=contact.name!;
   const national=phone.startsWith('55')?phone.slice(2):phone;
   await db().prepare(`INSERT OR IGNORE INTO profiles(user_id,data,updated_at) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM profiles WHERE ${cleanPhoneSQL} IN (?,?))`).bind(userId,JSON.stringify({name,phone:national,email:'',cpf:'',whatsappConsent:true,source:'whatsapp'}),Date.now(),national,phone).run();
   const saved=await findWhatsAppCustomer(phone);
   await writeContact(phone,saved?.name||name,'known',saved?.userId||userId);
   return {stage:'known',name:saved?.name||name,userId:saved?.userId||userId,justRegistered:true};
  }
  if(/^(?:n[aã]o(?: quero)?|prefiro n[aã]o|sem cadastro)[.!\s]*$/i.test(text.trim())){
   await writeContact(phone,contact.name,'declined');return {stage:'declined',name:contact.name||undefined,reply:'Tudo bem, podemos conversar sem cadastrar. O que você gostaria de pedir? 😊'};
  }
  return {stage:'confirm_phone',name:contact.name||undefined,reply:confirmationQuestion(contact.name!,phone)};
 }
 if(!contact||contact.stage==='known'){
  await writeContact(phone,null,'ask_name');
  return {stage:'ask_name',reply:'Oi! Que bom ter você por aqui. 😊 Como você se chama?'};
 }
 return {stage:'ask_name'};
}
function confirmationQuestion(name:string,phone:string){
 const national=phone.startsWith('55')?phone.slice(2):phone;
 const display='+55 ('+national.slice(0,2)+') '+national.slice(2,-4)+'-'+national.slice(-4);
 return `Prazer, ${name.split(' ')[0]}! 😊 Posso usar este número (${display}), que está falando comigo, para fazer seu cadastro na loja?`;
}
export async function captureWhatsAppCustomerName(phone:string,value:string){
 const name=nameSchema.parse(value);await writeContact(phone,name,'confirm_phone');return confirmationQuestion(name,phone);
}
