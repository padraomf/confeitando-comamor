import {z} from 'zod';
import {db,HttpError,settings,putSetting,unpackOrder,runtime} from './server';
import {digest,token,rateLimit} from './customer-auth';
import {orderMessage,eventMessage} from './order-display';
import {qrSvg} from './qr';
import type {Order} from './commerce';

const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const activeWindow=30000;
export async function bridgeStatus(){
 const bridge=await db().prepare("SELECT desired,state,qr,phone,last_seen FROM whatsapp_bridge WHERE id='store'").first<any>();
 if(!bridge)return {installed:false,online:false,connected:false,state:'not_installed',desired:'disconnected'};
 const online=bridge.last_seen>Date.now()-activeWindow;
 return {installed:true,online,connected:online&&bridge.state==='ready'&&bridge.desired==='connected',state:online?bridge.state:'offline',desired:bridge.desired,phone:bridge.phone,lastSeen:bridge.last_seen,qr:online&&bridge.desired==='connected'&&bridge.state==='qr'&&bridge.qr?'data:image/svg+xml;base64,'+btoa(Array.from(new TextEncoder().encode(qrSvg(bridge.qr)),byte=>String.fromCharCode(byte)).join('')):null};
}
export async function createBridgePairing(){
 const code=token().slice(0,24).toUpperCase(),expires=Date.now()+10*60*1000;
 await db().batch([db().prepare('DELETE FROM whatsapp_pairing'),db().prepare('INSERT INTO whatsapp_pairing(code_hash,expires) VALUES(?,?)').bind(await digest(code),expires)]);
 return {code,expires};
}
export async function bridgeCommand(command:'connect'|'disconnect'){
 const row=await db().prepare("SELECT token_hash FROM whatsapp_bridge WHERE id='store'").first();
 if(!row)throw new HttpError(422,'Instale e vincule o conector da loja antes de conectar o WhatsApp.');
 await db().prepare("UPDATE whatsapp_bridge SET desired=?,revision=revision+1,qr='' WHERE id='store'").bind(command==='connect'?'connected':'disconnected').run();
 if(command==='connect')await putSetting('store',JSON.stringify({...await settings(),whatsappMode:'webjs',whatsappEnabled:true}));
 return bridgeStatus();
}
export async function queueWhatsApp(order:Order,event='Recebido'){
 const config=await settings();if(!config.whatsappEnabled||config.whatsappMode!=='webjs')return;
 const bridge=await db().prepare("SELECT phone FROM whatsapp_bridge WHERE id='store'").first<any>();
 const storePhone=config.whatsapp||bridge?.phone||'';
 const recipients=[...(order.data.profile.whatsappConsent?[{kind:'cliente',phone:'55'+order.data.profile.phone}]:[])];
 for(const rec of recipients){
  const id=order.id+'-'+rec.kind+'-'+event;if(!/^55\d{10,11}$/.test(rec.phone)){await db().prepare('INSERT OR IGNORE INTO notifications(id,order_id,recipient,status,detail) VALUES(?,?,?,?,?)').bind(id,order.id,rec.kind,'não configurado','Informe o WhatsApp da confeitaria.').run();continue}
  const result=await db().prepare('INSERT OR IGNORE INTO whatsapp_outbox(id,order_id,recipient,phone,status,created_at,updated_at,event) VALUES(?,?,?,?,?,?,?,?)').bind(id,order.id,rec.kind,rec.phone,'queued',Date.now(),Date.now(),event).run();
  if(result.meta.changes)await db().prepare('INSERT INTO notifications(id,order_id,recipient,status,detail) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,detail=excluded.detail').bind(id,order.id,rec.kind,'na fila','Aguardando o conector do WhatsApp.').run();
 }
}
async function bridgeIdentity(req:Request){
 const credential=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(!/^[a-f0-9]{64}$/.test(credential))throw new HttpError(401,'Conector não autorizado');
 const hash=await digest(credential),bridge=await db().prepare("SELECT * FROM whatsapp_bridge WHERE id='store' AND token_hash=?").bind(hash).first<any>();
 if(!bridge)throw new HttpError(401,'Vínculo do conector revogado. Vincule novamente.');return bridge;
}
async function setResult(id:string,status:string,detail:string){
 const label=({skipped:'não enviado',processing:'enviando',sent:'enviado',uncertain:'incerto',failed:'falhou'} as Record<string,string>)[status];
 await db().prepare('UPDATE notifications SET status=?,detail=? WHERE id=?').bind(label,detail,id).run();
}
export async function bridgeRoute(req:Request,path:string,body:()=>Promise<any>){
 if(req.method!=='POST')throw new HttpError(404,'Não encontrado');
 if(path==='bridge/pair'){
  await rateLimit(req,'bridge-pair:'+(req.headers.get('cf-connecting-ip')||'shared'),15);
  const input=z.object({code:z.string().trim().transform(v=>v.replace(/[-\s]/g,'').toUpperCase()).refine(v=>/^[A-F0-9]{24}$/.test(v))}).parse(await body());
  const used=await db().prepare('DELETE FROM whatsapp_pairing WHERE code_hash=? AND expires>? RETURNING code_hash').bind(await digest(input.code),Date.now()).first();
  if(!used)throw new HttpError(401,'Código inválido ou expirado. Gere outro no painel.');
  const credential=token();
  await db().prepare("INSERT INTO whatsapp_bridge(id,token_hash) VALUES('store',?) ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash,desired='disconnected',revision=revision+1,state='offline',qr='',phone='',last_seen=0,runner='',lease_until=0").bind(await digest(credential)).run();
  return json({token:credential},201);
 }
 const bridge=await bridgeIdentity(req);
 if(path==='bridge/result'){
  const input=z.object({id:z.string().max(100),leaseToken:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['sent','uncertain','failed']),messageId:z.string().max(250).default('')}).parse(await body());
  if(input.status==='sent'&&!input.messageId)throw new HttpError(422,'O envio precisa do identificador retornado pelo WhatsApp.');
  const row=await db().prepare('SELECT status,detail FROM whatsapp_outbox WHERE id=? AND lease_token=? AND worker_id=?').bind(input.id,input.leaseToken,bridge.token_hash).first<any>();
  if(!row)throw new HttpError(404,'Envio não encontrado');if(row.status===input.status){await setResult(input.id,input.status,row.detail);return json({ok:true})}if(row.status!=='processing')throw new HttpError(409,'Envio já encerrado');
  const detail=input.status==='sent'?input.messageId:input.status==='uncertain'?'Confira a conversa antes de reenviar. O envio pode ter ocorrido.':'Não foi possível enviar. Confira o número e a conexão.';
  await db().prepare('UPDATE whatsapp_outbox SET status=?,updated_at=?,message_id=?,detail=? WHERE id=? AND status=?').bind(input.status,Date.now(),input.messageId,detail,input.id,'processing').run();await setResult(input.id,input.status,detail);return json({ok:true});
 }
 if(path==='bridge/heartbeat'){
  const input=z.object({runner:z.string().uuid(),state:z.enum(['disconnected','starting','qr','authenticated','ready','auth_failure','error']),qr:z.string().max(4096).default(''),phone:z.string().regex(/^$|^\d{8,15}$/).default('')}).parse(await body());
  const now=Date.now();
  const acquired=await db().prepare("UPDATE whatsapp_bridge SET runner=?,lease_until=?,last_seen=?,state=?,qr=?,phone=? WHERE id='store' AND token_hash=? AND (runner=? OR lease_until<?)").bind(input.runner,now+activeWindow,now,input.state,input.state==='qr'?input.qr:'',input.phone,bridge.token_hash,input.runner,now).run();
  if(!acquired.meta.changes)throw new HttpError(409,'Outro conector está ativo. Use somente uma instância.');
  const current=await db().prepare("SELECT desired,revision FROM whatsapp_bridge WHERE id='store'").first<any>();
  const config=await settings();
  if(!config.whatsappEnabled||config.whatsappMode!=='webjs'||current.desired!=='connected'||input.state!=='ready')return json({...current,job:null});
  // Resume only to resolve the local journal. A resumed job is never blindly resent.
  let job=await db().prepare("SELECT * FROM whatsapp_outbox WHERE status='processing' ORDER BY created_at LIMIT 1").first<any>();
  if(job&&job.worker_id!==bridge.token_hash){await db().prepare("UPDATE whatsapp_outbox SET status='uncertain',updated_at=? WHERE id=?").bind(now,job.id).run();await setResult(job.id,'uncertain','Conector substituído durante o envio. Confira a conversa antes de reenviar.');job=null}
  let resumed=!!job;
  if(!job){const lease=token();job=await db().prepare("UPDATE whatsapp_outbox SET status='processing',lease_token=?,worker_id=?,updated_at=? WHERE id=(SELECT id FROM whatsapp_outbox WHERE status='queued' ORDER BY created_at LIMIT 1) AND status='queued' RETURNING *").bind(lease,bridge.token_hash,now).first<any>()}
  if(!job)return json({...current,job:null});
  const raw=await db().prepare('SELECT * FROM orders WHERE id=?').bind(job.order_id).first<any>();
  if(!resumed&&(!raw||(job.event==='Pago'&&raw.payment_status!=='Pago')||(job.event!=='Pago'&&job.event!==raw.status)||job.created_at<now-86400000)){
   const detail=raw?.status==='Cancelado'?'Pedido cancelado.':'Aviso expirado ou etapa já atualizada. O próximo aviso contém a situação atual.';await db().prepare("UPDATE whatsapp_outbox SET status='skipped',updated_at=?,detail=? WHERE id=?").bind(now,detail,job.id).run();await setResult(job.id,'skipped',detail);return json({...current,job:null});
  }
  await setResult(job.id,'processing','Envio pelo WhatsApp conectado.');
  return json({...current,job:{id:job.id,leaseToken:job.lease_token,phone:job.phone,text:raw?(job.recipient==='loja'?orderMessage(unpackOrder(raw)):eventMessage(unpackOrder(raw),job.event)+(runtime.PUBLIC_URL&&unpackOrder(raw).data.trackingToken?'\n\n📋 Acompanhe: '+runtime.PUBLIC_URL+'/acompanhar/'+unpackOrder(raw).data.trackingToken:'')):'',resumed}});
 }
 throw new HttpError(404,'Não encontrado');
}
