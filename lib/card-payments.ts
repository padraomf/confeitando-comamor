import {z} from 'zod';
import {db,HttpError,unpackOrder,fetchJSON,runtime} from './server';
import {shopper,rateLimit,digest} from './customer-auth';
import {providerSecrets,paymentReady} from './payment-connect';
import {setPaid} from './order-events';
import type {Order} from './commerce';
const result=(p:any)=>({paymentId:String(p.id),status:p.status,statusDetail:p.status_detail,...(p.status_detail==='pending_challenge'&&p.three_ds_info?{challenge:{externalResourceURL:p.three_ds_info.external_resource_url,creq:p.three_ds_info.creq}}:{})});
export async function acceptCardResult(o:Order,p:any){
 if(String(p.external_reference)!==o.id||p.currency_id!=='BRL'||Math.round(Number(p.transaction_amount)*100)!==o.total||!['credit_card','debit_card'].includes(p.payment_type_id))throw new HttpError(409,'O pagamento não corresponde ao pedido.');
 await db().prepare('UPDATE card_attempts SET state=?,provider_id=?,updated_at=? WHERE order_id=?').bind(p.status,String(p.id),Date.now(),o.id).run();
 await db().prepare("UPDATE orders SET payment_id=?,payment_status=CASE WHEN received=0 AND payment_status NOT IN ('Estornado','Contestado') THEN ? ELSE payment_status END WHERE id=?").bind(String(p.id),p.status==='rejected'?'Recusado':'Aguardando pagamento',o.id).run();
 if(p.status==='approved')await setPaid(o.id,String(p.id));
 return result(p);
}
export async function cardRoute(req:Request,path:string,body:()=>Promise<any>){
 if(!/^orders\/[^/]+\/(card|card-config)$/.test(path))return null;
 const u=await shopper(req),id=path.split('/')[1],raw=await db().prepare('SELECT * FROM orders WHERE id=? AND user_id=?').bind(id,u.userId).first<any>();if(!raw)throw new HttpError(404,'Pedido não encontrado.');
 const o:Order=unpackOrder(raw),s=await providerSecrets('mercadopago'),json=(v:any)=>Response.json(v,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(o.payment!=='card'||o.data.paymentProvider!=='mercadopago'||!o.data.embeddedCard||o.checkout_url)throw new HttpError(422,'Este pedido usa outro meio de pagamento.');
 if(!s.mpPublicKey||!paymentReady(s,'mercadopago'))throw new HttpError(503,'Pagamento com cartão temporariamente indisponível.');
 if(['Cancelado','Não retirado'].includes(o.status)||['Estornado','Contestado','Estorno parcial'].includes(o.payment_status))throw new HttpError(422,'O pedido não está disponível para pagamento.');
 let attempt=await db().prepare('SELECT * FROM card_attempts WHERE order_id=?').bind(id).first<any>();
 if(path.endsWith('/card-config')&&req.method==='GET'){
  let payment;
  if(attempt&&!attempt.provider_id&&['processing','uncertain'].includes(attempt.state)){
   const search=await fetchJSON('https://api.mercadopago.com/v1/payments/search?external_reference='+encodeURIComponent(id)+'&sort=date_created&criteria=desc',{headers:{Authorization:'Bearer '+s.mpToken}});
   const candidate=search.results?.find((p:any)=>String(p.external_reference)===id&&p.currency_id==='BRL'&&Math.round(Number(p.transaction_amount)*100)===o.total&&['credit_card','debit_card'].includes(p.payment_type_id));
   if(candidate){payment=await acceptCardResult(o,candidate);attempt=await db().prepare('SELECT * FROM card_attempts WHERE order_id=?').bind(id).first<any>()}
  }
  if(attempt?.provider_id&&attempt.state!=='rejected'&&attempt.state!=='cancelled'){const p=await fetchJSON('https://api.mercadopago.com/v1/payments/'+encodeURIComponent(attempt.provider_id),{headers:{Authorization:'Bearer '+s.mpToken}});payment=await acceptCardResult(o,p)}
  return json({publicKey:s.mpPublicKey,amount:o.total/100,payer:{email:o.data.profile.email||''},payment,uncertain:attempt&&!attempt.provider_id&&['processing','uncertain'].includes(attempt.state),paid:o.payment_status==='Pago'});
 }
 if(req.method!=='POST')throw new HttpError(404,'Não encontrado.');
 if(o.payment_status==='Pago')return json({status:'approved',paymentId:o.payment_id});
 await rateLimit(req,'card:'+u.userId,15);
 const b=z.object({token:z.string().regex(/^[a-zA-Z0-9_-]{20,200}$/),installments:z.number().int().min(1).max(1),payment_method_id:z.string().regex(/^[a-zA-Z0-9_-]{2,40}$/).refine(v=>!['pix','bolbradesco','account_money','pec'].includes(v)),issuer_id:z.union([z.string().max(40),z.number()]).nullish(),payer:z.object({email:z.string().email().max(254),identification:z.object({type:z.enum(['CPF','CNPJ']),number:z.string().transform(v=>v.replace(/\D/g,'')).refine(v=>/^\d{11,14}$/.test(v))})})}).strict().parse(await body());
 const hash=await digest(b.token),newId=crypto.randomUUID();
 if(!attempt){await db().prepare("INSERT OR IGNORE INTO card_attempts(order_id,attempt_id,token_hash,state,updated_at) VALUES(?,?,?,'processing',?)").bind(id,newId,hash,Date.now()).run()}
 else if(['rejected','cancelled'].includes(attempt.state)&&attempt.token_hash!==hash){await db().prepare("UPDATE card_attempts SET attempt_id=?,token_hash=?,state='processing',provider_id=NULL,updated_at=? WHERE order_id=? AND attempt_id=? AND state IN ('rejected','cancelled')").bind(newId,hash,Date.now(),id,attempt.attempt_id).run()}
 attempt=await db().prepare('SELECT * FROM card_attempts WHERE order_id=?').bind(id).first<any>();
 if(attempt.token_hash!==hash)throw new HttpError(409,'Uma tentativa anterior ainda está sendo conferida. Atualize a situação do pagamento antes de tentar outro cartão.');
 if(attempt.provider_id){const p=await fetchJSON('https://api.mercadopago.com/v1/payments/'+encodeURIComponent(attempt.provider_id),{headers:{Authorization:'Bearer '+s.mpToken}});return json(await acceptCardResult(o,p))}
 let response:Response;
 try{response=await fetch('https://api.mercadopago.com/v1/payments',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+s.mpToken,'Content-Type':'application/json','X-Idempotency-Key':attempt.attempt_id},body:JSON.stringify({...b,issuer_id:b.issuer_id==null?undefined:String(b.issuer_id),transaction_amount:o.total/100,description:'Pedido #'+o.code,external_reference:o.id,notification_url:runtime.PUBLIC_URL+'/api/webhooks/mercadopago',three_d_secure_mode:'optional'})})}catch{await db().prepare("UPDATE card_attempts SET state='uncertain' WHERE order_id=? AND attempt_id=? AND provider_id IS NULL").bind(id,attempt.attempt_id).run();throw new HttpError(502,'A resposta do banco demorou. Confira o pagamento antes de tentar novamente.');}
 const p:any=await response.json();
 if(!response.ok){const definitive=[400,401,403,422].includes(response.status);await db().prepare('UPDATE card_attempts SET state=? WHERE order_id=? AND attempt_id=? AND provider_id IS NULL').bind(definitive?'rejected':'uncertain',id,attempt.attempt_id).run();throw new HttpError(502,definitive?'O banco não aceitou os dados. Confira o cartão ou tente outra opção.':'A confirmação ainda não chegou. Aguarde e consulte o pagamento.');}
 return json(await acceptCardResult(o,p));
}
