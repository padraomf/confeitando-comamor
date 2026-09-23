import {restoreStock} from './stock';
import {receivePayment,remainingAmount,receivedAmount} from './ledger';
import {db,unpackOrder,HttpError} from './server';
import {queueWhatsApp} from './whatsapp-bridge';
import {payOnDelivery} from './order-display';
import type {Order} from './commerce';
import {statuses} from './commerce';
import {nextSteps} from './order-flow';
export async function recordEvent(order:Order,event:string,actor:string){await db().prepare('INSERT OR IGNORE INTO order_events(id,order_id,event,actor,created_at) VALUES(?,?,?,?,?)').bind(order.id+':'+event,order.id,event,actor,Date.now()).run();if(event==='Pago'||statuses.includes(event))await queueWhatsApp(order,event);}
export async function setPaid(id:string,paymentId:string,actor='provedor'){
 const raw=await db().prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>();if(!raw)return;
 const o:Order=unpackOrder(raw);if(['Estornado','Contestado','Estorno parcial'].includes(o.payment_status))return;
 if(remainingAmount(o)>0)await receivePayment(id,remainingAmount(o),id+':online-paid',actor);
 await db().prepare('UPDATE orders SET payment_id=? WHERE id=?').bind(paymentId,id).run();
 const latest=unpackOrder(await db().prepare('SELECT * FROM orders WHERE id=?').bind(id).first());
 if(latest.payment_status==='Pago')await recordEvent(latest,'Pago',actor);
}
export async function advanceOrder(id:string,status:string,actor:string,pickupCode?:string){
 const raw=await db().prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>();if(!raw)throw new HttpError(404,'Pedido não encontrado');const o=unpackOrder(raw);
 if(o.status===status){await recordEvent(o,status,actor);return;}if(!nextSteps(o).includes(status))throw new HttpError(422,'Escolha a próxima etapa do pedido.');
 if(!['Cancelado','Não retirado'].includes(status)){
 if(['Estornado','Contestado','Estorno parcial'].includes(o.payment_status))throw new HttpError(422,'Confira a devolução ou contestação antes de continuar.');
 if(o.data.depositRequired&&receivedAmount(o)<o.data.depositRequired)throw new HttpError(422,'Confirme o sinal combinado antes de iniciar o preparo.');
 if(!payOnDelivery(o)&&o.data.delivery!=='pickup'&&o.payment_status!=='Pago'&&!(o.data.depositRequired&&receivedAmount(o)>=o.data.depositRequired))throw new HttpError(422,'Aguarde a confirmação do pagamento antes de continuar.');
 if(['Entregue','Retirado'].includes(status)&&o.payment_status!=='Pago')throw new HttpError(422,'Confirme o recebimento antes de concluir.');
 if(status==='Retirado'&&o.data.pickupCode&&pickupCode!==o.data.pickupCode)throw new HttpError(422,'Confira o código de retirada informado pelo cliente.');
 }
 const guard='stage:'+crypto.randomUUID();
 try{await db().batch([
  db().prepare('INSERT INTO commerce_guards(id,valid) SELECT ?,EXISTS(SELECT 1 FROM orders WHERE id=? AND status=? AND payment_status=? AND received=?)').bind(guard,id,o.status,o.payment_status,o.received??0),
  ...(status==='Cancelado'&&o.status==='Recebido'?[restoreStock(id)]:[]),
  db().prepare('UPDATE orders SET status=? WHERE id=?').bind(status,id),
  db().prepare('DELETE FROM commerce_guards WHERE id=?').bind(guard)
 ])}catch{throw new HttpError(409,'O pedido mudou. Atualize a tela.');}
 await recordEvent({...o,status},status,actor);
}
