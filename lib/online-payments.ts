import {reconcileRefund} from './ledger';
import {z} from 'zod';
import {db,fetchJSON,HttpError,runtime,secrets,unpackOrder} from './server';
import {setPaid} from './order-events';
import {cpfValid,type Order} from './commerce';
const infinite='https://api.checkout.infinitepay.io';
const picpay='https://ecommerce-api.svcp.picpay.com';
export async function infiniteCheckout(o:Order,s:Record<string,string>,origin:string){
 const r=await fetchJSON(infinite+'/links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handle:s.infiniteTag.replace(/^\$/,''),order_nsu:o.id,redirect_url:origin+'/pedidos',webhook_url:origin+'/api/webhooks/infinitepay',items:[...o.data.items.map(i=>({quantity:i.quantity,price:i.price,description:i.name})),...(o.data.fee?[{quantity:1,price:o.data.fee,description:'Entrega'}]:[])],customer:{name:o.data.profile.name,phone_number:'+55'+o.data.profile.phone,...(o.data.profile.email?{email:o.data.profile.email}:{}),...(o.data.profile.cpf?{document_number:o.data.profile.cpf.replace(/\D/g,'')}:{})}})});
 const url=r.url;if(typeof url!=='string'||!/^https:\/\/([a-z0-9-]+\.)*infinitepay\.io\//.test(url))throw new HttpError(502,'Não foi possível iniciar o pagamento InfinitePay.');await db().prepare('UPDATE orders SET checkout_url=? WHERE id=?').bind(url,o.id).run();return url;
}
export async function infiniteWebhook(req:Request){
 const b=z.object({order_nsu:z.string().uuid(),invoice_slug:z.string().min(1).max(200),transaction_nsu:z.string().min(1).max(200)}).parse(await req.json());const raw=await db().prepare('SELECT * FROM orders WHERE id=?').bind(b.order_nsu).first<any>();if(!raw)return;const o=unpackOrder(raw);if(o.data.paymentProvider!=='infinitepay')throw new HttpError(409,'Provedor incompatível');const s=await secrets();if(!s.infiniteTag)throw new HttpError(503,'Conta não configurada');
 const r=await fetchJSON(infinite+'/payment_check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handle:s.infiniteTag.replace(/^\$/,''),order_nsu:o.id,transaction_nsu:b.transaction_nsu,slug:b.invoice_slug})});
 if(r.success&&r.paid){if(r.amount!==o.total)throw new HttpError(409,'Valor de pagamento incompatível');await setPaid(o.id,b.transaction_nsu);}
}
async function ppToken(s:Record<string,string>){const t=await fetchJSON(picpay+'/oauth2/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',client_id:s.ppClientId,client_secret:s.ppClientSecret})});if(!t.access_token)throw new HttpError(502,'Conexão PicPay indisponível');return t.access_token;}
function payer(o:Order){const p=o.data.profile;if(!p.email||!cpfValid(p.cpf))throw new HttpError(422,'Informe CPF e e-mail para este pagamento.');return p;}
export async function nativePix(o:Order,s:Record<string,string>,origin?:string){
 if(o.data.pixCode){
  if((o.data.pixExpires||Infinity)>Date.now()&&o.payment_status!=='Expirado')return;
  await checkNativePayment(o);const raw=await db().prepare('SELECT * FROM orders WHERE id=?').bind(o.id).first<any>();
  if(raw.payment_status==='Pago')return;
  if(raw.payment_status!=='Expirado')throw new HttpError(422,'Aguarde a confirmação de vencimento do Pix pelo banco e consulte novamente.');
  const generation=crypto.randomUUID();await db().prepare("UPDATE orders SET data=json_set(json_remove(data,'$.pixCode','$.pixExpires'),'$.pixGeneration',?,'$.ppChargeId',?),payment_id=NULL,payment_status='Aguardando pagamento' WHERE id=? AND payment_id=? AND payment_status='Expirado'").bind(generation,generation,o.id,raw.payment_id).run();
  o=unpackOrder(await db().prepare('SELECT * FROM orders WHERE id=?').bind(o.id).first());if(o.data.pixCode)return;
 }
 const p=payer(o);let code='',id='',expires=Date.now()+30*60000;
 if(o.data.paymentProvider==='mercadopago'){
 const r=await fetchJSON('https://api.mercadopago.com/v1/payments',{method:'POST',headers:{Authorization:'Bearer '+s.mpToken,'Content-Type':'application/json','X-Idempotency-Key':o.data.pixGeneration||o.id+'-pix'},body:JSON.stringify({transaction_amount:o.total/100,description:'Pedido #'+o.code,external_reference:o.id,payment_method_id:'pix',date_of_expiration:new Date(expires).toISOString(),notification_url:(runtime.PUBLIC_URL||origin)+'/api/webhooks/mercadopago',payer:{email:p.email,first_name:p.name,identification:{type:'CPF',number:p.cpf.replace(/\D/g,'')}}})});
 code=r.point_of_interaction?.transaction_data?.qr_code;id=String(r.id);if(r.status==='approved'&&r.currency_id==='BRL'&&Math.round(Number(r.transaction_amount)*100)===o.total)await setPaid(o.id,id);
 }else if(o.data.paymentProvider==='picpay'){
 const token=await ppToken(s);let r;try{r=await fetchJSON(picpay+'/charge/'+(o.data.ppChargeId||o.id),{headers:{Authorization:'Bearer '+token}})}catch{/* If the merchant id exists, creation below is rejected rather than duplicated. */}
 if(!r?.id)r=await fetchJSON(picpay+'/charge/pix',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({paymentSource:'GATEWAY',merchantChargeId:o.data.ppChargeId||o.id,customer:{name:p.name,email:p.email,documentType:'CPF',document:p.cpf.replace(/\D/g,''),phone:{countryCode:'55',areaCode:p.phone.slice(0,2),number:p.phone.slice(2),type:'MOBILE'}},transactions:[{amount:o.total,pix:{expiration:1800}}]})});code=r.transactions?.[0]?.pix?.qrCode;id=String(r.id);
 }else throw new HttpError(422,'Provedor incompatível');
 if(typeof code!=='string'||!code.startsWith('000201')||code.length>2000||!id)throw new HttpError(502,'Não foi possível gerar o Pix. Tente novamente em Meus pedidos.');
 await db().prepare("UPDATE orders SET payment_id=?,data=json_set(data,'$.pixCode',?,'$.pixExpires',?) WHERE id=?").bind(id,code,expires,o.id).run();
}
export async function checkNativePayment(o:Order){const s=await secrets();const raw=await db().prepare('SELECT payment_id FROM orders WHERE id=?').bind(o.id).first<any>();if(!raw?.payment_id)return;
 if(o.data.paymentProvider==='mercadopago'){const r=await fetchJSON('https://api.mercadopago.com/v1/payments/'+encodeURIComponent(raw.payment_id),{headers:{Authorization:'Bearer '+s.mpToken}});if(r.external_reference===o.id&&r.currency_id==='BRL'&&Math.round(Number(r.transaction_amount)*100)===o.total&&r.status==='cancelled')await db().prepare("UPDATE orders SET payment_status='Expirado' WHERE id=? AND received=0 AND payment_status NOT IN ('Estornado','Contestado')").bind(o.id).run();
 if(r.external_reference===o.id&&r.status==='refunded'&&r.currency_id==='BRL'&&Math.round(Number(r.transaction_amount)*100)===o.total)await reconcileRefund(o.id,String(r.id),Math.round(Number(r.transaction_amount_refunded||r.transaction_amount)*100),'Estornado');
 if(o.data.embeddedCard){const {acceptCardResult}=await import('./card-payments');await acceptCardResult(o,r);return;}if(r.external_reference===o.id&&r.currency_id==='BRL'&&Math.round(Number(r.transaction_amount)*100)===o.total&&r.status==='approved')await setPaid(o.id,String(r.id));}
 if(o.data.paymentProvider==='picpay'){const r=await fetchJSON(picpay+'/charge/'+(o.data.ppChargeId||o.id),{headers:{Authorization:'Bearer '+await ppToken(s)}});if(r.merchantChargeId===(o.data.ppChargeId||o.id)&&r.amount===o.total){if(r.chargeStatus==='PAID')await setPaid(o.id,String(r.id));if(r.chargeStatus==='EXPIRED')await db().prepare("UPDATE orders SET payment_status='Expirado' WHERE id=? AND received=0 AND payment_status NOT IN ('Estornado','Contestado')").bind(o.id).run();if(r.chargeStatus==='REFUNDED')await reconcileRefund(o.id,String(r.id),o.total,'Estornado')}}
}
export async function picpayWebhook(req:Request){const s=await secrets();if(!s.ppWebhookToken)throw new HttpError(503,'Notificações PicPay não configuradas');const received=req.headers.get('authorization')||'';let mismatch=received.length^s.ppWebhookToken.length;for(let i=0;i<s.ppWebhookToken.length;i++)mismatch|=(received.charCodeAt(i)||0)^s.ppWebhookToken.charCodeAt(i);if(mismatch)throw new HttpError(401,'Notificação não autorizada');const b=z.object({data:z.object({merchantChargeId:z.string().uuid()})}).parse(await req.json());const raw=await db().prepare("SELECT * FROM orders WHERE id=? OR json_extract(data,'$.ppChargeId')=?").bind(b.data.merchantChargeId,b.data.merchantChargeId).first<any>();if(raw){const o=unpackOrder(raw);if(o.data.paymentProvider!=='picpay')throw new HttpError(409,'Provedor incompatível');await checkNativePayment(o)}}
