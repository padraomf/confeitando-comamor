import {infiniteCheckout,nativePix} from './online-payments';
import {reconcileRefund} from './ledger';
import {setPaid} from './order-events';
import {paymentLabel,collectionInfo} from './order-display';
import {queueWhatsApp} from './whatsapp-bridge';
import { providerSecrets,paymentReady } from './payment-connect';
import { db, secrets, settings, fetchJSON, HttpError, runtime, unpackOrder } from './server';
import { addressText, money, type Order } from './commerce';
export async function checkoutLink(order:Order){
 if(order.checkout_url)return order.checkout_url;
 const provider=order.data.paymentProvider||'mercadopago';if(provider==='manual')throw new HttpError(422,'Este pedido tem pagamento direto à loja. Confira os dados em Meus pedidos.');const s=await providerSecrets(provider);if(!paymentReady(s,provider))throw new HttpError(422,'O pagamento online ainda não está disponível.');
 const origin=runtime.PUBLIC_URL;if(!origin)throw new HttpError(503,'Pagamento temporariamente indisponível.');
 if(provider==='infinitepay')return infiniteCheckout(order,s,origin);
 if((provider==='mercadopago'||provider==='picpay')&&order.payment==='pix'){await nativePix(order,s);return '';}
 if(provider==='mercadopago'&&order.payment==='card'&&s.mpPublicKey){await db().prepare("UPDATE orders SET data=json_set(data,'$.embeddedCard',json('true')) WHERE id=?").bind(order.id).run();return '';}
 if(provider==='pagbank')return pagbankCheckout(order,s.pbToken,origin);
 const payload={items:[...order.data.items.map(i=>({id:i.id,title:i.name,quantity:i.quantity,unit_price:i.price/100,currency_id:'BRL'})),...(order.data.fee?[{id:'delivery',title:'Taxa de entrega',quantity:1,unit_price:order.data.fee/100,currency_id:'BRL'}]:[])],external_reference:order.id,notification_url:origin+'/api/webhooks/mercadopago',back_urls:{success:origin+'/pedidos',failure:origin+'/pedidos',pending:origin+'/pedidos'},auto_return:'approved',payment_methods:{excluded_payment_types:order.payment==='card'?[{id:'ticket'},{id:'bank_transfer'},{id:'atm'}]:[{id:'credit_card'},{id:'debit_card'},{id:'ticket'},{id:'atm'}]},expires:true,expiration_date_to:new Date(Date.now()+86400000).toISOString()};
 const p=await fetchJSON('https://api.mercadopago.com/checkout/preferences',{method:'POST',headers:{Authorization:`Bearer ${s.mpToken}`,'Content-Type':'application/json','X-Idempotency-Key':order.id},body:JSON.stringify(payload)});
 if(typeof p.init_point!=='string'||!/^https:\/\/([a-z0-9-]+\.)*mercadopago\.(com|com\.br)\//.test(p.init_point))throw new HttpError(502,'Não foi possível abrir o pagamento.');
 await db().prepare('UPDATE orders SET checkout_url=? WHERE id=?').bind(p.init_point,order.id).run();return p.init_point;
}
export async function notifyOrder(order:Order){
 const [s,config]=await Promise.all([secrets(),settings()]);
 if(config.whatsappMode==='webjs'){await queueWhatsApp(order);return}
 const configured=config.whatsappEnabled&&s.waToken&&s.waPhoneId&&s.waCustomerTemplate&&s.waStoreTemplate;
 const recipients=[{kind:'loja',phone:config.whatsapp,template:s.waStoreTemplate},...(order.data.profile.whatsappConsent?[{kind:'cliente',phone:'55'+order.data.profile.phone,template:s.waCustomerTemplate}]:[])];
 for(const rec of recipients){
 const id=order.id+'-'+rec.kind;
 const inserted=await db().prepare('INSERT OR IGNORE INTO notifications(id,order_id,recipient,status,detail) VALUES(?,?,?,?,?)').bind(id,order.id,rec.kind,configured&&rec.phone?'pendente':'não conectado','').run();
 if(!inserted.meta.changes||!configured||!rec.phone)continue;
 const lock=await db().prepare("UPDATE notifications SET status='enviando' WHERE id=? AND status='pendente'").bind(id).run();if(!lock.meta.changes)continue;
 try{
 const summary=order.data.items.map(i=>`${i.quantity}x ${i.name}`).join('; ').slice(0,700);
 const detail=`${order.data.delivery==='delivery'?'Entrega: '+addressText(order.data.address!):'Retirada na loja'}. Pagamento: ${paymentLabel(order)+' · '+order.payment_status+'. '+collectionInfo(order).detail}.`;
 const r=await fetch(`https://graph.facebook.com/v23.0/${s.waPhoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${s.waToken}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),body:JSON.stringify({messaging_product:'whatsapp',to:rec.phone.replace(/\D/g,''),type:'template',template:{name:rec.template,language:{code:'pt_BR'},components:[{type:'body',parameters:[order.data.profile.name,order.code,summary,money(order.total),detail.slice(0,700)].map(text=>({type:'text',text}))}]}})});
 if(!r.ok){await db().prepare("UPDATE notifications SET status='falhou',detail=? WHERE id=?").bind('WhatsApp recusou o envio. Verifique número, modelo aprovado e conexão.',id).run();continue}
 const result:any=await r.json();await db().prepare("UPDATE notifications SET status='enviado',detail=? WHERE id=?").bind(result.messages?.[0]?.id??'',id).run();
 }catch{await db().prepare("UPDATE notifications SET status='incerto',detail=? WHERE id=?").bind('A conexão expirou. Verifique o WhatsApp antes de reenviar.',id).run()}
 }
}
export async function paymentWebhook(req:Request){
 const s=await providerSecrets('mercadopago');if(!s.mpWebhookSecret||!s.mpToken)throw new HttpError(503,'Integração não configurada');
 const url=new URL(req.url),id=url.searchParams.get('data.id')?.toLowerCase(),requestId=req.headers.get('x-request-id');
 const parts=Object.fromEntries((req.headers.get('x-signature')??'').split(',').map(s=>s.trim().split('=')));const {ts,v1}=parts;
 if(!id||!requestId||!ts||!v1||!/^[a-f0-9]{64}$/i.test(v1))throw new HttpError(401,'Assinatura inválida');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(s.mpWebhookSecret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const valid=await crypto.subtle.verify('HMAC',key,new Uint8Array(v1.match(/../g)!.map((h:string)=>parseInt(h,16))),new TextEncoder().encode(`id:${id};request-id:${requestId};ts:${ts};`));if(!valid)throw new HttpError(401,'Assinatura inválida');
 const p=await fetchJSON(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${s.mpToken}`}});
 const raw:any=await db().prepare('SELECT * FROM orders WHERE id=?').bind(String(p.external_reference??'')).first();if(!raw)return;
 const order=unpackOrder(raw);if(order.data.paymentProvider&&order.data.paymentProvider!=='mercadopago')throw new HttpError(409,'Provedor incompatível');if(order.payment==='cash'||p.currency_id!=='BRL'||Math.round(Number(p.transaction_amount)*100)!==order.total)throw new HttpError(409,'Pagamento incompatível');
 if(order.data.embeddedCard)await db().prepare('UPDATE card_attempts SET state=?,provider_id=?,updated_at=? WHERE order_id=?').bind(p.status,String(p.id),Date.now(),order.id).run();
 if(p.status==='approved'&&Number(p.transaction_amount_refunded)>0){await reconcileRefund(order.id,String(p.id),Math.round(Number(p.transaction_amount_refunded)*100),'Estornado');return}
 if(['approved','refunded','charged_back'].includes(p.status)){const status=p.status==='approved'?'Pago':p.status==='refunded'?'Estornado':'Contestado';if(status==='Pago')await setPaid(order.id,String(p.id));else await reconcileRefund(order.id,String(p.id),p.status==='refunded'?Math.round(Number(p.transaction_amount_refunded??p.transaction_amount)*100):order.total,status as 'Estornado'|'Contestado')}
}

async function pagbankCheckout(order:Order,token:string,origin:string){
 const notification=origin+'/api/webhooks/pagbank';
 const result=await fetchJSON('https://api.pagseguro.com/checkouts',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','x-idempotency-key':order.id},body:JSON.stringify({reference_id:order.id,items:order.data.items.map(i=>({reference_id:i.id,name:i.name,quantity:i.quantity,unit_amount:i.price})),additional_amount:order.data.fee,payment_methods:[{type:order.payment==='pix'?'PIX':'CREDIT_CARD'}],payment_notification_urls:[notification],redirect_url:origin+'/pedidos',return_url:origin+'/pedidos'})});
 const url=result.links?.find((l:any)=>l.rel==='PAY')?.href;
 if(typeof url!=='string'||!/^https:\/\/([a-z0-9-]+\.)*(pagseguro\.uol\.com\.br|pagbank\.com\.br)\//.test(url))throw new HttpError(502,'Não foi possível abrir o pagamento PagBank');
 await db().prepare('UPDATE orders SET checkout_url=? WHERE id=?').bind(url,order.id).run();return url;
}
export async function pagbankWebhook(req:Request){
 const s=await providerSecrets('pagbank');if(!s.pbToken)throw new HttpError(503,'Integração não configurada');
 const rawBody=await req.text();if(rawBody.length>50000)throw new HttpError(413,'Notificação inválida');
 const received=req.headers.get('x-authenticity-token')||'';const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s.pbToken+'-'+rawBody)));const expected=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');let mismatch=received.length^expected.length;for(let i=0;i<expected.length;i++)mismatch|=(received.charCodeAt(i)||0)^expected.charCodeAt(i);if(mismatch)throw new HttpError(401,'Assinatura inválida');
 const notice=JSON.parse(rawBody);if(typeof notice.id!=='string'||!/^ORDE_[a-zA-Z0-9-]+$/.test(notice.id))return;
 const payment=await fetchJSON('https://api.pagseguro.com/orders/'+encodeURIComponent(notice.id),{headers:{Authorization:'Bearer '+s.pbToken}});
 const raw:any=await db().prepare('SELECT * FROM orders WHERE id=?').bind(String(payment.reference_id??'')).first();if(!raw)return;const order=unpackOrder(raw);if(order.payment==='cash'||order.data.paymentProvider!=='pagbank')throw new HttpError(409,'Provedor incompatível');
 const charge=payment.charges?.find((c:any)=>c.status==='PAID'&&c.amount?.value===order.total&&c.amount?.currency==='BRL');
 if(charge)await setPaid(order.id,charge.id);
 else if(payment.charges?.some((c:any)=>c.status==='PAID'))throw new HttpError(409,'Pagamento incompatível');
 else if(order.payment_id&&payment.charges?.some((c:any)=>c.id===order.payment_id&&c.status==='CANCELED'))await reconcileRefund(order.id,order.payment_id,order.total,'Estornado');
}
