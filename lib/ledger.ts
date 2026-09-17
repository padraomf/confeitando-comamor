import {db,HttpError,unpackOrder} from './server';
import type {Order} from './commerce';
import {recordEvent} from './order-events';
import {remainingAmount} from './payment-amounts';
export {receivedAmount,remainingAmount} from './payment-amounts';

// Receipt, balance and guard commit together, without host-specific SQL triggers.
async function appendReceipt(o:Order,amount:number,receiptId:string,actor:string,kind:'payment'|'refund'|'chargeback',method:string,provider:string,expectedRefunded?:number,paymentId?:string){
 const guard='receipt:'+crypto.randomUUID(),time=Date.now(),status=kind==='chargeback'?'Contestado':'Estornado';
 await db().batch([
  db().prepare(`INSERT INTO commerce_guards(id,valid) SELECT ?,
   EXISTS(SELECT 1 FROM payment_receipts WHERE id=? AND order_id=?) OR (
    EXISTS(SELECT 1 FROM orders WHERE id=? AND received+? BETWEEN 0 AND total
     AND (?<0 OR payment_status NOT IN('Estornado','Contestado','Estorno parcial')))
    AND (? IS NULL OR ?=(SELECT -COALESCE(SUM(amount),0) FROM payment_receipts WHERE order_id=? AND amount<0))
   )`).bind(guard,receiptId,o.id,o.id,amount,amount,expectedRefunded??null,expectedRefunded??null,o.id),
  db().prepare(`UPDATE orders SET received=received+?,
   paid_at=CASE WHEN ?>0 THEN ? ELSE paid_at END,
   payment_status=CASE WHEN ?<0 THEN CASE WHEN received+?=0 THEN ? ELSE 'Estorno parcial' END
    WHEN received+?=total THEN 'Pago' ELSE 'Parcialmente pago' END,
   payment_id=COALESCE(?,payment_id)
   WHERE id=? AND NOT EXISTS(SELECT 1 FROM payment_receipts WHERE id=?)`).bind(amount,amount,time,amount,amount,status,amount,paymentId??null,o.id,receiptId),
  db().prepare('INSERT OR IGNORE INTO payment_receipts(id,order_id,amount,kind,method,provider,actor,occurred_at) VALUES(?,?,?,?,?,?,?,?)').bind(receiptId,o.id,amount,kind,method,provider,actor,time),
  db().prepare('DELETE FROM commerce_guards WHERE id=?').bind(guard)
 ]);
}

export async function receivePayment(id:string,amount:number,receiptId:string,actor:string,method?:string){
 const raw=await db().prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>();if(!raw)throw new HttpError(404,'Pedido não encontrado.');
 const o:Order=unpackOrder(raw),existing=await db().prepare('SELECT id FROM payment_receipts WHERE id=? AND order_id=?').bind(receiptId,id).first();if(existing)return;
 if(!Number.isSafeInteger(amount)||amount<=0||amount>remainingAmount(o))throw new HttpError(422,'Informe um valor até o saldo pendente.');
 if(['Estornado','Contestado','Estorno parcial'].includes(o.payment_status))throw new HttpError(422,'Pagamento encerrado.');
 try{await appendReceipt(o,amount,receiptId,actor,'payment',method||o.payment,o.data.paymentProvider||'manual')}catch{throw new HttpError(409,'O saldo mudou. Atualize o pedido antes de receber.')}
 const latest:Order=unpackOrder(await db().prepare('SELECT * FROM orders WHERE id=?').bind(id).first());
 await recordEvent(latest,latest.payment_status==='Pago'?'Pago':'Recebimento parcial: '+receiptId,actor);
}

export async function reconcileRefund(id:string,paymentId:string,amount:number,status:'Estornado'|'Contestado',actor='provedor'){
 const raw=await db().prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>();if(!raw)return;
 const o:Order=unpackOrder(raw);if(!Number.isSafeInteger(amount)||amount<=0||amount>o.total)throw new HttpError(409,'Estorno incompatível.');
 // Provider refunds may reach us before approval. Record both entries once.
 const gross=await db().prepare('SELECT COALESCE(SUM(amount),0) n FROM payment_receipts WHERE order_id=? AND amount>0').bind(id).first<any>();
 if(!gross.n&&o.received===0&&o.payment_status!=='Estornado'&&o.payment_status!=='Contestado')await receivePayment(id,o.total,id+':online-paid','provedor');
 const prior=await db().prepare('SELECT -COALESCE(SUM(amount),0) n FROM payment_receipts WHERE order_id=? AND amount<0').bind(id).first<any>();
 const delta=amount-prior.n;
 if(delta<=0)return;
 try{await appendReceipt(o,-delta,id+':refund:'+paymentId+':'+amount,actor,status==='Contestado'?'chargeback':'refund',o.payment,o.data.paymentProvider||'manual',prior.n,paymentId)}catch{throw new HttpError(409,'O saldo mudou. Confira novamente a devolução.')}
 await recordEvent(unpackOrder(await db().prepare('SELECT * FROM orders WHERE id=?').bind(id).first()),status+' '+amount,actor);
}

export async function manualRefund(id:string,amount:number,requestId:string,actor:string){
 const receiptId=id+':manual-refund:'+requestId;
 if(await db().prepare('SELECT id FROM payment_receipts WHERE id=? AND order_id=?').bind(receiptId,id).first())return;
 const raw=await db().prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>();if(!raw||!Number.isSafeInteger(amount)||amount<=0||amount>raw.received)throw new HttpError(422,'Informe até o valor efetivamente recebido.');
 try{await appendReceipt(unpackOrder(raw),-amount,receiptId,actor,'refund',raw.payment,'manual')}catch{throw new HttpError(409,'O saldo mudou. Atualize o pedido.')}
 await recordEvent(unpackOrder(await db().prepare('SELECT * FROM orders WHERE id=?').bind(id).first()),'Devolução manual: '+requestId,actor);
}
