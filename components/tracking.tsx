'use client';
import {useEffect,useState} from 'react';
import {Brand,Footer} from './brand';
import {api,errorMessage} from '@/lib/client';
import {money} from '@/lib/commerce';
import {Button} from './ui/button';
import {LoaderCircle, QrCode, CreditCard, Copy} from 'lucide-react';
import {toast} from 'sonner';

export default function Tracking({token}:{token:string}) {
 const [o,setOrder]=useState<any>(null),[error,setError]=useState('');
 const [busy, setBusy] = useState(false);

 async function load(){
  try{
   const r=await api('tracking/'+token);
   setOrder(r);setError('');
  }catch(e){
   setError(errorMessage(e));
  }
 }

 useEffect(()=>{
  let active=true;
  void load();
  const id=setInterval(()=>{
   if(document.visibilityState==='visible')void load();
  },15000);
  return ()=>{active=false;clearInterval(id)};
 },[token]);

 async function payOnline(method: 'pix' | 'card') {
  setBusy(true);
  try {
   const res = await api('tracking/' + token + '/checkout', {
    method: 'POST',
    body: JSON.stringify({ paymentMethod: method })
   });
   if (res.checkout_url) {
    window.location.assign(res.checkout_url);
   } else {
    await load();
   }
  } catch (e) {
   toast.error(errorMessage(e));
  } finally {
   setBusy(false);
  }
 }

 const canPay = o && 
  !['Pago', 'Estornado', 'Contestado', 'Expirado'].includes(o.payment_status) && 
  !['Cancelado', 'Não retirado'].includes(o.status);

 return <>
  <header className="store-header">
   <Brand/>
   <a href="/catalogo">Ver cardápio</a>
  </header>
  <main className="customer-auth-wrap">
   <div className="customer-auth-card" style={{ maxWidth: '400px', width: '100%' }}>
    <div className="eyebrow">SEU PEDIDO, COM CARINHO</div>
    {error ? <p role="alert">{error}</p> : o ? <>
     <h1>Pedido #{o.code}</h1>
     <p className="status-pill">{o.status}</p>
     <p>{o.payment_status} · {o.delivery==='pickup'?'Retirada na confeitaria':'Entrega'}</p>
     <div style={{ padding: '15px 0', borderBottom: '1px solid var(--border)', marginBottom: '15px' }}>
      {o.items.map((i:any)=><p key={i.id}>{i.quantity} × {i.name}</p>)}
      {o.discountAmount ? <p style={{color: 'var(--success-fg)'}}>Desconto: -{money(o.discountAmount)}</p> : null}
      <strong style={{ display: 'block', marginTop: '10px', fontSize: '1.2em' }}>Total: {money(o.total)}</strong>
     </div>

     {canPay && (
      <div className="payment-options" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
       {o.pixCode ? (
        <div style={{ textAlign: 'center', background: 'var(--bg-muted)', padding: '15px', borderRadius: '8px' }}>
         <h3 style={{ marginBottom: '10px', fontSize: '16px' }}>Pague via Pix</h3>
         <p style={{ fontSize: '14px', marginBottom: '10px' }}>Copie o código abaixo e pague no seu banco:</p>
         <Button variant="outline" style={{ width: '100%' }} onClick={()=>{
          navigator.clipboard.writeText(o.pixCode).then(()=>toast.success('Código copiado!')).catch(()=>toast.error('Erro ao copiar'));
         }}>
          <Copy size={16} style={{ marginRight: '8px' }}/> Copiar código Pix
         </Button>
         {o.checkout_url && (
          <a href={o.checkout_url} className="button" style={{ display: 'flex', justifyContent: 'center', marginTop: '10px', width: '100%' }}>
           Pagar com Cartão
          </a>
         )}
        </div>
       ) : o.checkout_url ? (
        <a href={o.checkout_url} className="button" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
         Continuar Pagamento
        </a>
       ) : (
        <>
         <h3 style={{ fontSize: '16px', marginBottom: '5px' }}>Pagar online agora</h3>
         <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Agilize seu pedido realizando o pagamento online.
         </p>
         <div style={{ display: 'flex', gap: '10px' }}>
          <Button disabled={busy} onClick={() => payOnline('pix')} style={{ flex: 1 }}>
           {busy ? <LoaderCircle className="spin" size={16}/> : <QrCode size={16} style={{ marginRight: '8px' }}/>}
           Pix
          </Button>
          <Button disabled={busy} onClick={() => payOnline('card')} variant="outline" style={{ flex: 1 }}>
           {busy ? <LoaderCircle className="spin" size={16}/> : <CreditCard size={16} style={{ marginRight: '8px' }}/>}
           Cartão
          </Button>
         </div>
        </>
       )}
      </div>
     )}
    </> : <p>Consultando seu pedido…</p>}
   </div>
   <Footer/>
  </main>
 </>
}
