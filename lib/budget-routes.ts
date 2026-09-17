import {businessStatus} from './store-hours';
import {paymentAllowed} from './payment-options';
import {paymentReady} from './payment-connect';
import {checkoutLink} from './integrations';
import {recordEvent} from './order-events';
import {addressSchema,pixPayload,type Order} from './commerce';
import {z} from 'zod';
import {db,HttpError,runtime,settings,secrets,unpackOrder} from './server';
import {shopper,rateLimit} from './customer-auth';
import {panelUser} from './admin-auth';
import {readPhoto} from './uploads';
import {dateOnly,localDay} from './admin-orders';
export const budgetStatuses=['Recebido','Em análise','Orçamento enviado','Recusado','Convertido em pedido','Encerrado'] as const;
export const budgetSchema=z.object({requestId:z.string().uuid(),delivery:z.enum(['pickup','delivery']).default('pickup'),address:addressSchema.optional(),cakeFlavor:z.string().max(80).default(''),sweetFlavor:z.string().max(80).default(''),name:z.string().trim().min(2).max(100),phone:z.string().transform(v=>v.replace(/\D/g,'')).refine(v=>/^\d{10,11}$/.test(v),'Informe um telefone com DDD.'),date:dateOnly,cake:z.boolean(),slices:z.union([z.literal(12),z.literal(20),z.literal(30)]).optional(),sweets:z.boolean(),quantity:z.number().int().min(100,'Docinhos: mínimo de 100 unidades.').max(100000).optional(),description:z.string().trim().min(10,'Conte os sabores, o tema e os detalhes da encomenda.').max(2000),photos:z.array(z.string().uuid()).max(3).default([])}).superRefine((v,c)=>{if(v.delivery==='delivery'&&!v.address)c.addIssue({code:'custom',message:'Informe o endereço da encomenda.'});if(!v.cake&&!v.sweets)c.addIssue({code:'custom',message:'Escolha bolo, docinhos ou os dois.'});if(v.cake&&!v.slices)c.addIssue({code:'custom',message:'Escolha a quantidade de fatias.'});if(v.sweets&&!v.quantity)c.addIssue({code:'custom',message:'Informe a quantidade de docinhos.'})});
function unpack(row:any){return {...row,data:JSON.parse(row.data)}}
export async function budgetRoute(req:Request,path:string,body:()=>Promise<any>){
 const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}),method=req.method;
 if(path.startsWith('budget-images/')&&method==='GET'){
  const id=path.slice(14);if(!z.string().uuid().safeParse(id).success)throw new HttpError(404,'Foto não encontrada.');
  const a=await db().prepare('SELECT * FROM budget_attachments WHERE id=?').bind(id).first<any>();if(!a)throw new HttpError(404,'Foto não encontrada.');
  if(!await panelUser(req)){const u=await shopper(req);if(a.user_id!==u.userId)throw new HttpError(404,'Foto não encontrada.')}
  const original=new URL(req.url).searchParams.get('original')==='1';const o=await runtime.BUCKET?.get(original&&a.original_key?a.original_key:a.object_key);if(!o)throw new HttpError(404,'Foto não encontrada.');return new Response(o.body,{headers:{'Content-Type':original&&a.original_type?a.original_type:a.content_type,'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }
 if(path==='budget-photos'){
  const u=await shopper(req);
  if(method==='GET'){const r=await db().prepare('SELECT id FROM budget_attachments WHERE user_id=? AND budget_id IS NULL ORDER BY created_at LIMIT 6').bind(u.userId).all<any>();return json({photos:r.results.map(p=>({id:p.id,url:'/api/budget-images/'+p.id}))})}
  if(method==='POST'){
   await rateLimit(req,'budget-photo-ip:'+(req.headers.get('cf-connecting-ip')||'shared'),12);
   const n=await db().prepare('SELECT COUNT(*) n FROM budget_attachments WHERE user_id=? AND budget_id IS NULL').bind(u.userId).first<any>();if(n.n>=6)throw new HttpError(422,'Remova as fotos anteriores antes de enviar outras.');
   const {bytes,type,ext,original}=await readPhoto(req,true),id=crypto.randomUUID(),key='references/'+id+'.'+ext;
   await runtime.BUCKET!.put(key,bytes,{httpMetadata:{contentType:type}});
   const originalKey=original?'references-original/'+id+'.'+original.ext:null;if(original&&originalKey)await runtime.BUCKET!.put(originalKey,original.bytes,{httpMetadata:{contentType:original.type}});try{await db().prepare('INSERT INTO budget_attachments(id,user_id,object_key,content_type,created_at,original_key,original_type) VALUES(?,?,?,?,?,?,?)').bind(id,u.userId,key,type,Date.now(),originalKey,original?.type??null).run()}catch(e){await runtime.BUCKET!.delete(key);throw e}
   return json({id,url:'/api/budget-images/'+id},201);
  }
  if(method==='DELETE'){const {id}=z.object({id:z.string().uuid()}).parse(await body());const row=await db().prepare('SELECT object_key,original_key FROM budget_attachments WHERE id=? AND user_id=? AND budget_id IS NULL').bind(id,u.userId).first<any>();if(!row)throw new HttpError(404,'Foto não encontrada.');await runtime.BUCKET?.delete(row.object_key);if(row.original_key)await runtime.BUCKET?.delete(row.original_key);await db().prepare('DELETE FROM budget_attachments WHERE id=? AND user_id=? AND budget_id IS NULL').bind(id,u.userId).run();return json({ok:true})}
 }
 if(path==='budgets'){
  const u=await shopper(req);
  if(method==='GET'){const r=await db().prepare('SELECT * FROM budgets WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(u.userId).all<any>();return json({budgets:r.results.map(unpack)})}
  if(method==='POST'){
   const input=budgetSchema.parse(await body()),existing=await db().prepare('SELECT * FROM budgets WHERE request_id=?').bind(input.requestId).first<any>();if(existing){if(existing.user_id!==u.userId)throw new HttpError(409,'Solicitação inválida. Atualize a página.');return json({budget:unpack(existing)})}
   await rateLimit(req,'budget-ip:'+(req.headers.get('cf-connecting-ip')||'shared'),8);
   const store=await settings();if(!store.budgetWhenClosed&&!businessStatus(store).open)throw new HttpError(422,'A loja não está recebendo orçamentos agora.');for(const [selected,options] of [[input.cakeFlavor,store.cakeFlavors],[input.sweetFlavor,store.sweetFlavors]] as const)if(selected&&options.length&&!options.includes(selected))throw new HttpError(422,'Um sabor mudou. Atualize a página.');
   if(input.date<localDay(Date.now(),(await settings()).timezone))throw new HttpError(422,'Escolha uma data a partir de hoje.');
   if(new Set(input.photos).size!==input.photos.length)throw new HttpError(422,'Não repita a mesma foto.');
   for(const id of input.photos){const photo=await db().prepare('SELECT id FROM budget_attachments WHERE id=? AND user_id=? AND budget_id IS NULL').bind(id,u.userId).first();if(!photo)throw new HttpError(422,'Uma foto não está mais disponível. Remova e envie novamente.')}
   const id=crypto.randomUUID(),timestamp=Date.now(),code='E-'+id.slice(0,8).toUpperCase(),{requestId,...data}=input;
   const row={id,user_id:u.userId,request_id:requestId,code,data:JSON.stringify(data),status:'Recebido',created_at:timestamp,updated_at:timestamp};
   await db().batch([db().prepare('INSERT INTO budgets(id,user_id,request_id,code,data,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,u.userId,requestId,code,row.data,row.status,timestamp,timestamp),...input.photos.map(photo=>db().prepare('UPDATE budget_attachments SET budget_id=? WHERE id=? AND user_id=? AND budget_id IS NULL').bind(id,photo,u.userId))]);return json({budget:unpack(row)},201);
  }
 }
 if(/^budgets\/[^/]+\/answer$/.test(path)&&method==='POST'){
  const u=await shopper(req),input=z.object({version:z.string().uuid(),accept:z.boolean(),payment:z.enum(['cash','pix','card','card_machine']).optional(),email:z.union([z.string().email(),z.literal('')]).default(''),cpf:z.string().max(20).default('')}).parse(await body()),id=path.split('/')[1];
  const raw=await db().prepare('SELECT * FROM budgets WHERE id=? AND user_id=?').bind(id,u.userId).first<any>();if(!raw)throw new HttpError(404,'Orçamento não encontrado.');const budget=unpack(raw),offer=budget.data.offer;
  if(budget.status==='Convertido em pedido'){const order=await db().prepare('SELECT * FROM orders WHERE id=? AND user_id=?').bind(budget.data.orderId,u.userId).first<any>();return json({order:order?unpackOrder(order):null,budget})}
  if(budget.status!=='Orçamento enviado'||!offer||offer.version!==input.version)throw new HttpError(409,'O orçamento mudou. Atualize para conferir os novos valores.');
  if(!input.accept){await db().prepare("UPDATE budgets SET status='Recusado',updated_at=? WHERE id=? AND data=? AND status='Orçamento enviado'").bind(Date.now(),id,raw.data).run();return json({ok:true})}
  const store=await settings(),s=await secrets();if(offer.expires<localDay(Date.now(),store.timezone)||budget.data.date<localDay(Date.now(),store.timezone))throw new HttpError(422,'O prazo do orçamento venceu. Solicite uma atualização à confeitaria.');
  if(!input.payment||!paymentAllowed(store,budget.data.delivery,input.payment,paymentReady(s,store.paymentProvider)))throw new HttpError(422,'Escolha uma forma de pagamento disponível.');
  const existing=await db().prepare('SELECT * FROM orders WHERE request_id=?').bind(id).first<any>();if(existing)throw new HttpError(409,'Esta solicitação já foi utilizada. Atualize a página.');
  const manual=['cash','card_machine'].includes(input.payment)||!paymentReady(s,store.paymentProvider),provider=manual?'manual':store.paymentProvider,now=Date.now(),orderId=crypto.randomUUID(),code=orderId.slice(0,8).toUpperCase();
  if(!manual&&['mercadopago','picpay'].includes(provider)&&input.payment==='pix'&&(!input.email||!input.cpf))throw new HttpError(422,'Informe CPF e e-mail para gerar o Pix.');
  const profile={name:budget.data.name,phone:budget.data.phone,email:input.email,cpf:input.cpf,whatsappConsent:false,...budget.data.address?{address:budget.data.address}:{}};
  const data={storeName:store.name,budgetId:id,dueDate:budget.data.date,terms:offer.terms,depositRequired:manual?offer.deposit:offer.total,items:[{id:'budget-'+id,name:'Encomenda #'+budget.code,quantity:1,price:offer.total-offer.fee,image:store.favicon,note:budget.data.description}],profile,address:budget.data.delivery==='delivery'?budget.data.address:undefined,delivery:budget.data.delivery,fee:offer.fee,paymentProvider:provider,trackingToken:crypto.randomUUID()+crypto.randomUUID(),...(budget.data.delivery==='pickup'?{pickupCode:String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000)}:{}),note:budget.data.description,change:null,...(input.payment==='pix'&&manual?{pixKey:store.pixKey,pixName:store.pixName,pixCity:store.pixCity,pixCode:pixPayload(store.pixKey,store.pixName,store.pixCity,offer.deposit||offer.total,code)}:{})};
  const paymentStatus=manual&&input.payment!=='pix'?(budget.data.delivery==='pickup'?'Pagar na retirada':'Pagar na entrega'):'Aguardando pagamento';
  await db().batch([
   db().prepare("INSERT INTO orders(id,user_id,request_id,code,data,total,status,payment,payment_status,created_at) SELECT ?,?,?,?,?,?,'Recebido',?,?,? WHERE EXISTS(SELECT 1 FROM budgets WHERE id=? AND data=? AND status='Orçamento enviado')").bind(orderId,u.userId,id,code,JSON.stringify(data),offer.total,input.payment,paymentStatus,now,id,raw.data),
   db().prepare("UPDATE budgets SET status='Convertido em pedido',data=?,updated_at=? WHERE id=? AND data=? AND EXISTS(SELECT 1 FROM orders WHERE id=?)").bind(JSON.stringify({...budget.data,orderId,acceptedAt:now}),now,id,raw.data,orderId),
   db().prepare('INSERT INTO profiles(user_id,data,updated_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(u.userId,JSON.stringify(profile),now,orderId)
  ]);
  const created=await db().prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first<any>();if(!created)throw new HttpError(409,'O orçamento mudou. Confira os valores novamente.');
  let order:Order=unpackOrder(created);if(!manual)try{await checkoutLink(order, new URL(req.url).origin);order=unpackOrder(await db().prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first())}catch{/* The accepted order remains available for a payment retry. */}
  await recordEvent(order,'Recebido','cliente');return json({order},201);
 }
 if(path==='admin/budgets'){
  const member=await panelUser(req);if(!member)throw new HttpError(401,'Entre no painel.');if(member.role==='production')throw new HttpError(403,'Acesso restrito ao atendimento.');
  if(method==='GET'){const p=new URL(req.url).searchParams,page=z.coerce.number().int().min(1).max(100000).parse(p.get('page')||1);const [r,c]=await Promise.all([db().prepare('SELECT * FROM budgets ORDER BY created_at DESC,id DESC LIMIT 30 OFFSET ?').bind((page-1)*30).all<any>(),db().prepare('SELECT COUNT(*) n FROM budgets').first<any>()]);return json({budgets:r.results.map(unpack),page,pages:Math.ceil(c.n/30),total:c.n})}
  if(method==='PATCH'){
   const input=z.object({id:z.string().uuid(),status:z.enum(['Recebido','Em análise','Encerrado']).optional(),offer:z.object({total:z.number().int().positive().max(10000000),fee:z.number().int().min(0).max(1000000),deposit:z.number().int().min(0).max(10000000),expires:dateOnly,terms:z.string().trim().min(5).max(2000)}).optional()}).parse(await body());
   const raw=await db().prepare('SELECT * FROM budgets WHERE id=?').bind(input.id).first<any>();if(!raw)throw new HttpError(404,'Orçamento não encontrado.');if(raw.status==='Convertido em pedido')throw new HttpError(422,'A encomenda já virou pedido. Acompanhe em Pedidos.');
   const data=JSON.parse(raw.data);let status=input.status||raw.status;
   if(input.offer){const o=input.offer,today=localDay(Date.now(),(await settings()).timezone);if(o.deposit>o.total||o.fee>=o.total)throw new HttpError(422,'Confira o sinal, o frete e o total.');if(data.delivery==='pickup'&&o.fee!==0)throw new HttpError(422,'Retirada não tem frete.');if(o.expires<today||o.expires>data.date||data.date<today)throw new HttpError(422,'A validade deve ir de hoje até a data da encomenda.');data.offer={...o,version:crypto.randomUUID()};status='Orçamento enviado';}
   if(!input.offer&&!input.status)throw new HttpError(422,'Escolha uma ação.');
   const result=await db().prepare('UPDATE budgets SET status=?,data=?,updated_at=? WHERE id=? AND data=? AND status=?').bind(status,JSON.stringify(data),Date.now(),input.id,raw.data,raw.status).run();if(!result.meta.changes)throw new HttpError(409,'O orçamento mudou. Atualize antes de editar.');return json({ok:true});
  }
 }
 return null;
}
