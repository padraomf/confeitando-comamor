'use client';
import {requestId as newRequestId} from '@/lib/request-id';
import {useState,useEffect} from 'react';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from './ui/alert-dialog';
import {money,type Order} from '@/lib/commerce';
import {receivedAmount,remainingAmount} from '@/lib/payment-amounts';
import {manualPayment} from '@/lib/order-display';
import {api,errorMessage} from '@/lib/client';
import {toast} from 'sonner';
export function ManualReceipt({order,owner,onChanged}:{order:Order;owner:boolean;onChanged:()=>Promise<void>}){
 const [amount,setAmount]=useState(''),[confirm,setConfirm]=useState<'receive'|'refund'|null>(null),[busy,setBusy]=useState(false),[requestId,setRequestId]=useState('');
  useEffect(()=>{const due=order.data.depositRequired&&receivedAmount(order)<order.data.depositRequired?order.data.depositRequired-receivedAmount(order):remainingAmount(order);setAmount((due/100).toFixed(2));setRequestId(newRequestId())},[order.id,order.received]);
  if(!manualPayment(order)&&!owner)return null;
 const cents=Math.round(Number(amount.replace(',','.'))*100),canReceive=remainingAmount(order)>0&&!['Cancelado','Não retirado'].includes(order.status)&&!['Estornado','Contestado','Estorno parcial'].includes(order.payment_status);
 async function save(){setBusy(true);try{await api('admin/order',{method:'PATCH',body:JSON.stringify({id:order.id,amount:cents,requestId,...confirm==='refund'?{refund:true}:{paid:true}})});await onChanged();setConfirm(null);setRequestId(newRequestId());toast.success('Recebimento atualizado.')}catch(e){toast.error(errorMessage(e))}finally{setBusy(false)}}
 return <section className="payment-ledger"><strong>Recebido: {money(receivedAmount(order))} · Saldo: {money(remainingAmount(order))}</strong>{canReceive&&<><label className="field"><span>Valor que acabou de receber (R$)</span><Input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label><Button variant="outline" disabled={busy||!Number.isFinite(cents)||cents<=0||cents>remainingAmount(order)} onClick={()=>setConfirm('receive')}>Confirmar recebimento</Button></>}{owner&&receivedAmount(order)>0&&<Button variant="ghost" onClick={()=>{setAmount((receivedAmount(order)/100).toFixed(2));setConfirm('refund')}}>Registrar devolução manual</Button>}<AlertDialog open={!!confirm} onOpenChange={v=>{if(!v)setConfirm(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm==='refund'?'Você já devolveu o dinheiro?':'Você conferiu o recebimento?'}</AlertDialogTitle><AlertDialogDescription>{confirm==='refund'?'Este registro não movimenta dinheiro no banco. Confirme somente o valor já devolvido ao cliente.':'Confira o crédito no banco, o dinheiro ou a aprovação da maquininha antes de marcar o valor recebido.'}</AlertDialogDescription></AlertDialogHeader>{confirm==='refund'&&<label className="field"><span>Valor devolvido (R$)</span><Input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}<p>Valor: <strong>{money(Number.isFinite(cents)?cents:0)}</strong></p><AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction disabled={busy||!Number.isFinite(cents)||cents<=0||cents>(confirm==='refund'?receivedAmount(order):remainingAmount(order))} onClick={e=>{e.preventDefault();void save()}}>Confirmar valor</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></section>;
}
