import {z} from 'zod';
import {db,HttpError,unpackOrder,runtime} from './server';
import {shopper,rateLimit,passwordHash} from './customer-auth';
import {profileSchema} from './commerce';
import {panelUser} from './admin-auth';
import {checkNativePayment} from './online-payments';
import {readPhoto} from './uploads';
import {manualPayment} from './order-display';
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
export async function extraRoutes(req:Request,path:string){
 if(/^tracking\/[a-f0-9-]{72}$/.test(path)&&req.method==='GET'){const token=path.split('/')[1];const raw=await db().prepare("SELECT * FROM orders WHERE json_extract(data,'$.trackingToken')=? LIMIT 1").bind(token).first<any>();if(!raw)throw new HttpError(404,'Pedido não encontrado');const o=unpackOrder(raw);return json({code:o.code,status:o.status,payment_status:o.payment_status,total:o.total,delivery:o.data.delivery,items:o.data.items,pickupCode:o.data.pickupCode})}
 if(/^orders\/[^/]+\/(check|proof)$/.test(path)){
 const u=await shopper(req),id=path.split('/')[1],raw=await db().prepare('SELECT * FROM orders WHERE id=? AND user_id=?').bind(id,u.userId).first<any>();if(!raw)throw new HttpError(404,'Pedido não encontrado');const o=unpackOrder(raw);
 if(path.endsWith('/check')&&req.method==='POST'){await rateLimit(req,'payment-check:'+u.userId,20);if(o.payment_status!=='Pago')await checkNativePayment(o);return json({order:unpackOrder(await db().prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>())})}
 if(path.endsWith('/proof')&&req.method==='POST'){if(o.payment!=='pix'||!manualPayment(o)||['Pago','Estornado','Contestado'].includes(o.payment_status)||['Cancelado','Não retirado'].includes(o.status))throw new HttpError(422,'Este pedido não precisa de comprovante');await rateLimit(req,'proof:'+u.userId,10);const photo=await readPhoto(req),proofId=crypto.randomUUID(),key='proofs/'+proofId+'.'+photo.ext;await runtime.BUCKET!.put(key,photo.bytes,{httpMetadata:{contentType:photo.type}});await db().batch([db().prepare('INSERT INTO order_proofs(id,order_id,object_key,created_at) VALUES(?,?,?,?)').bind(proofId,id,key,Date.now()),db().prepare("UPDATE orders SET payment_status='Comprovante em análise' WHERE id=? AND payment_status='Aguardando pagamento'").bind(id)]);return json({ok:true})}
 }
 if(path.startsWith('admin/customers')||/^admin\/(proofs|events|originals)\//.test(path)){
 const a=await panelUser(req);if(!a)throw new HttpError(401,'Entre no painel');if(a.role==='production')throw new HttpError(403,'Acesso restrito ao atendimento');
 if(path==='admin/customers/reset-password'&&req.method==='POST'){const b=z.object({id:z.string().max(100)}).parse(await req.json());const tempPassword=Math.random().toString(36).slice(-8);const result=await db().prepare('UPDATE customers SET password_hash=? WHERE id=?').bind(await passwordHash(tempPassword),b.id).run();if(!result.meta.changes)throw new HttpError(404,'Cliente não encontrado no sistema de login');return json({password:tempPassword})}
 if(path==='admin/customers'&&req.method==='PATCH'){const b=z.object({id:z.string().max(100),notes:z.string().trim().max(2000)}).parse(await req.json());const result=await db().prepare('UPDATE profiles SET notes=? WHERE user_id=?').bind(b.notes,b.id).run();if(!result.meta.changes)throw new HttpError(404,'Cliente não encontrado');return json({ok:true})}
 if(path==='admin/customers'&&req.method==='PUT'){const p=profileSchema.extend({id:z.string().max(100),notes:z.string().trim().max(2000).default('')}).parse(await req.json());const {id,notes,...data}=p;const result=await db().prepare('UPDATE profiles SET data=?, notes=?, updated_at=? WHERE user_id=?').bind(JSON.stringify(data),notes,Date.now(),id).run();if(!result.meta.changes)throw new HttpError(404,'Cliente não encontrado');return json({ok:true})}
 if(path==='admin/customers'&&req.method==='POST'){const p=profileSchema.extend({notes:z.string().trim().max(2000).default('')}).parse(await req.json());const {notes,...data}=p;const id=crypto.randomUUID();await db().prepare('INSERT INTO profiles(user_id,data,notes,updated_at) VALUES(?,?,?,?)').bind(id,JSON.stringify(data),notes,Date.now()).run();return json({ok:true,user_id:id})}
 if(path==='admin/customers'&&req.method==='GET'){const search=(new URL(req.url).searchParams.get('q')||'').slice(0,100);const r=await db().prepare("WITH UniqueProfiles AS (SELECT MAX(user_id) as user_id, json_extract(data,'$.phone') as phone, MAX(data) as data, MAX(notes) as notes, MAX(updated_at) as updated_at FROM profiles GROUP BY json_extract(data,'$.phone')) SELECT p.user_id,p.data,p.notes,p.updated_at,COUNT(o.id) orders,COALESCE(SUM(CASE WHEN o.payment_status='Pago' THEN o.total ELSE 0 END),0) spent,MAX(o.created_at) last_order,(SELECT json_extract(data,'$.address') FROM orders WHERE json_extract(data,'$.profile.phone')=p.phone AND json_extract(data,'$.address') IS NOT NULL ORDER BY created_at DESC LIMIT 1) last_address FROM UniqueProfiles p LEFT JOIN orders o ON json_extract(o.data,'$.profile.phone')=p.phone WHERE (json_extract(p.data,'$.name') LIKE ? OR p.phone LIKE ?) GROUP BY p.phone ORDER BY last_order DESC LIMIT 200").bind('%'+search+'%','%'+search+'%').all<any>();return json({customers:r.results.map(r=>{const data=JSON.parse(r.data);if(!data.address&&r.last_address)data.address=JSON.parse(r.last_address);return {...r,data}})})}
 if(path.startsWith('admin/events/')&&req.method==='GET'){const id=path.split('/')[2];const [events,proofs]=await Promise.all([db().prepare('SELECT event,actor,created_at FROM order_events WHERE order_id=? ORDER BY created_at').bind(id).all(),db().prepare('SELECT id,created_at FROM order_proofs WHERE order_id=? ORDER BY created_at DESC').bind(id).all()]);return json({events:events.results,proofs:proofs.results})}
 if(path.startsWith('admin/proofs/')&&req.method==='GET'){const id=path.split('/')[2],p=await db().prepare('SELECT object_key FROM order_proofs WHERE id=?').bind(id).first<any>();const object=p?await runtime.BUCKET!.get(p.object_key):null;if(!object)throw new HttpError(404,'Comprovante não encontrado');return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
 if(path.startsWith('admin/originals/')&&req.method==='GET'){const r=await db().prepare('SELECT * FROM image_originals WHERE id=?').bind(path.split('/')[2]).first<any>();const object=r?await runtime.BUCKET!.get(r.object_key):null;if(!object)throw new HttpError(404,'Original não encontrado');return new Response(object.body,{headers:{'Content-Type':r.content_type,'Content-Disposition':'attachment','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
 }
 if(path==='admin/pos-order'&&req.method==='POST'){
   const a=await panelUser(req);if(!a)throw new HttpError(401,'Entre no painel');if(a.role==='production')throw new HttpError(403,'Acesso restrito ao atendimento');
   const input=z.object({
     profile:profileSchema.omit({address:true}).extend({id:z.string().max(100).optional(),address:z.any().optional()}),
     items:z.array(z.object({id:z.string(),quantity:z.number().int().min(1),note:z.string().max(200).default(''),name:z.string(),price:z.number()})).min(1),
     delivery:z.enum(['delivery','pickup']),
     payment:z.enum(['pix','cash','card_machine']),
     fee:z.number().int().min(0),
     paid:z.boolean(),
     note:z.string().max(500).default('')
   }).parse(await req.json());
   
   let profileId=input.profile.id;
   if(!profileId){
     profileId=crypto.randomUUID();
     await db().prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').bind(profileId,JSON.stringify(input.profile),Date.now()).run();
   }else{
     await db().prepare('UPDATE profiles SET data=?, updated_at=? WHERE user_id=?').bind(JSON.stringify(input.profile),Date.now(),profileId).run();
   }
   
   const available=await (await import('./server')).products();
   const enrichedItems=input.items.map(item=>{
     const p=(available as any[]).find(p=>p.id===item.id);
     if(!p)throw new HttpError(422,'Produto não encontrado');
     return {...item,image:p.image,stockTracked:p.stock!=null};
   });

   const total=enrichedItems.reduce((acc,item)=>acc+(item.price*item.quantity),0)+input.fee;
   const orderId=crypto.randomUUID();
   const code=orderId.slice(0,8).toUpperCase();
   const timestamp=Date.now();
   const status=input.paid?(input.delivery==='pickup'?'Pronto para retirada':'Em preparo'):'Recebido';
   const paymentStatus=input.paid?'Pago':(input.delivery==='pickup'?'Pagar na retirada':'Pagar na entrega');
   
   const orderData={
     items:enrichedItems,
     storeName:'',
     domain:new URL(req.url).origin,
     trackingToken:crypto.randomUUID()+crypto.randomUUID(),
     paymentProvider:'manual',
     profile:input.profile,
     address:input.delivery==='delivery'?input.profile.address:null,
     delivery:input.delivery,
     fee:input.fee,
     distance:0,
     note:input.note,
     change:null,
     ...(input.delivery==='pickup'?{pickupCode:String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000)}:{})
   };

   // Fetch actual store name
   const config=await (await import('./server')).settings();
   orderData.storeName=config.name;

   const {reserveStock}=await import('./stock');
   await db().batch([
     db().prepare('INSERT INTO orders(id,user_id,request_id,code,data,total,status,payment,payment_status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(orderId,profileId,crypto.randomUUID(),code,JSON.stringify(orderData),total,status,input.payment,paymentStatus,timestamp),
     ...reserveStock(orderId,enrichedItems)
   ]);
   
   if(input.paid){
     const {recordEvent}=await import('./order-events');
     await recordEvent({id:orderId,user_id:profileId,code,data:orderData,total,status,payment:input.payment,payment_status:paymentStatus,created_at:timestamp} as any,'Pago',a.userId);
   }

   return json({ok:true,orderId,code});
 }
 return null;
}
