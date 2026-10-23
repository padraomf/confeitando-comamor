'use client';
import {useState} from 'react';
import {api,errorMessage} from '@/lib/client';
import {Button} from './ui/button';
import {Input} from './ui/input';
export function WhatsAppLogin({onBack,onSuccess}:{onBack:()=>void;onSuccess:()=>void}){
 const [phone,setPhone]=useState(''),[code,setCode]=useState(''),[challenge,setChallenge]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(){setBusy(true);setError('');try{if(challenge){await api('customer/whatsapp-login',{method:'POST',body:JSON.stringify({challenge,code})});onSuccess()}else{const r=await api('customer/whatsapp-code',{method:'POST',body:JSON.stringify({phone})});setChallenge(r.challenge)}}catch(e){setError(errorMessage(e))}finally{setBusy(false)}}
 return <><p>{challenge?'Se este número estiver cadastrado, o código chegará pelo WhatsApp. Ele vale por 10 minutos.':'Entre com o celular cadastrado na confeitaria. Você recebe um código pelo WhatsApp, sem precisar de senha.'}</p><form className="form-stack" onSubmit={e=>{e.preventDefault();void submit()}}>{challenge?<label className="field"><span>Código de seis dígitos</span><Input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>:<label className="field"><span>Celular com DDD</span><Input required type="tel" autoComplete="tel" maxLength={20} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(74) 99999-9999"/></label>}{error&&<p role="alert" className="error-text">{error}</p>}<Button disabled={busy}>{busy?'Aguarde…':challenge?'Entrar na minha conta':'Receber código no WhatsApp'}</Button>{challenge&&<Button type="button" variant="ghost" disabled={busy} onClick={()=>{setChallenge('');setCode('');setError('')}}>Trocar número ou pedir outro código</Button>}<Button type="button" variant="ghost" disabled={busy} onClick={onBack}>Voltar</Button></form></>;
}
