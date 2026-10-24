import {salePatchSchema} from './whatsapp-sale-schema';
import {z} from 'zod';
import {db,settings,secrets,products,HttpError} from './server';
import {money,addressSchema,profileSchema,type Product} from './commerce';
import {paymentAllowed} from './payment-options';
import {paymentReady} from './payment-connect';
import {businessStatus} from './store-hours';
import {findWhatsAppCustomer} from './whatsapp-customers';
import {newSession,setSessionCookie,digest} from './customer-auth';
import {explicitConfirmation} from './whatsapp-budget-flow';

type Sale=z.infer<typeof salePatchSchema>&{location?:{lat:number;lng:number}};
export async function getWhatsAppSale(phone:string){return db().prepare('SELECT * FROM whatsapp_sale_drafts WHERE phone=?').bind(phone).first<any>()}
async function actor(phone:string){return (await findWhatsAppCustomer(phone))?.userId||'whatsapp:'+phone}
// Reuse the site's checkout, pricing, stock transactions and payment integration.
// This short-lived session stays inside the server and never grants access to another profile.
async function checkoutRequest(phone:string,domain:string,path:string,payload:unknown){
 const session=await newSession(await actor(phone),true);
 try{
  const {POST}=await import('../app/api/[...path]/route');
  const response=await POST(new Request(domain+'/api/'+path,{method:'POST',headers:{Origin:domain,'Content-Type':'application/json',Cookie:setSessionCookie(session,true).split(';')[0]},body:JSON.stringify(payload)}));
  const result=await response.json() as any;if(!response.ok)throw new HttpError(response.status,result.error||'Não foi possível concluir o pedido.');return result;
 }finally{await db().prepare('DELETE FROM customer_sessions WHERE token_hash=?').bind(await digest(session)).run()}
}
async function prepare(phone:string,sale:Sale,domain:string){
 const store=await settings(),s=await secrets();
 if(!businessStatus(store).open)return {question:'Qual é a data e o que você imagina para sua encomenda? 💕'};
 if(!sale.items?.length)return {question:'Qual doce você quer e quantas unidades? 😊'};
 const catalog=await products() as Product[],items=[];
 for(const item of sale.items){const p=catalog.find(p=>p.id===item.id&&p.active&&!p.demo&&!p.sold_out&&p.stock!==0);if(!p||p.stock!=null&&p.stock<item.quantity)return {question:'Uma das opções esgotou ou não tem essa quantidade. Vamos escolher outra?'};items.push({...item,name:p.name,price:p.price})}
 if(!sale.delivery)return {question:'Você prefere retirar na loja ou receber por entrega?'};
 if(sale.delivery==='pickup'&&!store.pickup)return {question:'A retirada está indisponível. Você prefere entrega?'};
 const online=paymentReady(s,store.paymentProvider);
 const labels={pix:'Pix',card:'Cartão online',cash:'Dinheiro',card_machine:'Cartão na retirada'};
 const available=(Object.keys(labels) as (keyof typeof labels)[]).filter(p=>paymentAllowed(store,sale.delivery!,p,online));
 if(!sale.payment||!available.includes(sale.payment))return {question:'Como deseja pagar? '+available.map(p=>labels[p]).join(', ')+'.'};
 const row=await db().prepare('SELECT data FROM profiles WHERE user_id=?').bind(await actor(phone)).first<any>(),profile=row?JSON.parse(row.data):{};
 const customer=await findWhatsAppCustomer(phone);
 const name=sale.name||customer?.name||profile.name||'';
 if(name.trim().length<3)return {question:'Qual seu nome completo para o pedido?'};
 const paymentOnline=!['cash','card_machine'].includes(sale.payment)&&online;
 const email=sale.email??profile.email??'',cpf=(sale.cpf??profile.cpf??'').replace(/\D/g,'');
 if(paymentOnline&&!z.string().email().safeParse(email).success)return {question:'Para gerar o pagamento online, qual é seu e-mail?'};
 if(paymentOnline&&!profileSchema.shape.cpf.safeParse(cpf).success||paymentOnline&&!cpf)return {question:'Qual é seu CPF para gerar o pagamento?'};
 let fee=0,quoteId:string|undefined,address;
 if(sale.delivery==='delivery'){
  const parsed=addressSchema.safeParse({...sale.address,location:sale.location?{...sale.location,source:'pin',confirmed:true}:undefined});
  if(!parsed.success)return {question:'Para a entrega, me informe CEP, rua, número, bairro, cidade e estado. Depois compartilhe a localização pelo WhatsApp para calcular o frete certinho.'};
  if(!sale.location)return {question:'Agora compartilhe a localização de entrega pelo WhatsApp, usando o clipe → Localização. Vou calcular o frete antes de confirmar.'};
  const quote=await checkoutRequest(phone,domain,'quote',parsed.data);fee=quote.fee;quoteId=quote.id;address=quote.address;
 }
 const inputProfile=profileSchema.safeParse({name,email:paymentOnline?email:profile.email||'',cpf:paymentOnline?cpf:profile.cpf||'',phone:phone.startsWith('55')?phone.slice(2):phone,whatsappConsent:true,...address?{address}:{}});
 if(!inputProfile.success)return {question:'Precisamos conferir seu nome, CPF ou e-mail antes de concluir. Pode me confirmar esses dados?'};
 const total=items.reduce((n,p)=>n+p.quantity*p.price,0)+fee;
 return {items,total,payload:{guest:true,items:sale.items,profile:inputProfile.data,delivery:sale.delivery,payment:sale.payment,quoteId,note:sale.note||''},summary:['*Resumo do seu pedido* 💕','',...items.map(p=>p.quantity+' × '+p.name+' — '+money(p.quantity*p.price)),'',sale.delivery==='pickup'?'*Recebimento:* Retirada na loja':'*Recebimento:* Entrega · frete '+money(fee),'*Pagamento:* '+labels[sale.payment],'*Total:* '+money(total),'','Posso confirmar e gerar seu pedido?'].join('\n')};
}
export async function saveWhatsAppSale(phone:string,patch:z.infer<typeof salePatchSchema>,domain:string,location?:{lat:number;lng:number}){
 const old=await getWhatsAppSale(phone),previous:Sale=old&&!old.order_id?JSON.parse(old.data):{};
 const sale:Sale={...previous,...patch,...patch.address?{address:{...previous.address,...patch.address}}:{},...location?{location}:{}};
 const requestId=old&&!old.order_id?old.request_id:crypto.randomUUID();
 const prepared=await prepare(phone,sale,domain);
 await db().prepare('INSERT INTO whatsapp_sale_drafts(phone,request_id,data,expected_total,awaiting_confirmation,order_id,updated_at) VALUES(?,?,?,?,?,NULL,?) ON CONFLICT(phone) DO UPDATE SET request_id=excluded.request_id,data=excluded.data,expected_total=excluded.expected_total,awaiting_confirmation=excluded.awaiting_confirmation,order_id=NULL,updated_at=excluded.updated_at').bind(phone,requestId,JSON.stringify(sale),prepared.total??null,prepared.summary?1:0,Date.now()).run();
 return prepared.summary||prepared.question!;
}
export async function confirmWhatsAppSale(phone:string,text:string,domain:string){
 if(!explicitConfirmation(text)&&!/^finaliza(?:r)?(?: pra mim| para mim)?[.!\s]*$/i.test(text.trim()))return null;
 const state=await getWhatsAppSale(phone);if(!state)return null;
 const userId=await actor(phone);
 const saved=await db().prepare('SELECT * FROM orders WHERE request_id=? AND user_id=?').bind(state.request_id,userId).first<any>();
 if(saved)return orderReply(saved,domain);
 if(!state.awaiting_confirmation)return null;
 const sale=JSON.parse(state.data),prepared=await prepare(phone,sale,domain);
 if(!prepared.payload||prepared.total!==state.expected_total){await db().prepare('UPDATE whatsapp_sale_drafts SET awaiting_confirmation=0 WHERE phone=?').bind(phone).run();return 'Precisamos revisar antes de concluir. '+await saveWhatsAppSale(phone,{},domain)};
 const result=await checkoutRequest(phone,domain,'orders',{...prepared.payload,requestId:state.request_id,expectedTotal:prepared.total});
 await db().prepare('UPDATE whatsapp_sale_drafts SET order_id=?,awaiting_confirmation=0,updated_at=? WHERE phone=? AND request_id=?').bind(result.order.id,Date.now(),phone,state.request_id).run();
 return orderReply(result.order,domain);
}
function orderReply(row:any,domain:string){
 const data=typeof row.data==='string'?JSON.parse(row.data):row.data;
 const paid=row.payment_status==='Pago',online=['pix','card'].includes(row.payment);
 const tracking=domain+'/acompanhar/'+data.trackingToken;
 if(['Cancelado','Não retirado'].includes(row.status))return 'Esse pedido #'+row.code+' está '+row.status.toLowerCase()+'. Confira: '+tracking;
 const link=online&&!paid&&row.checkout_url?row.checkout_url:tracking;
 return `*Seu pedido #${row.code} foi criado!* 💕\n\n*Total:* ${money(row.total)}\n${paid?'Pagamento confirmado.':online?'Falta concluir o pagamento.':'O pagamento será feito na retirada ou entrega, conforme combinado.'}\n\n${online&&!paid?'*Pagar e acompanhar:*':'*Acompanhar pedido:*'}\n${link}`;
}
