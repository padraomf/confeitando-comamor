'use client';
import {useState} from 'react';
import {KeyRound,LoaderCircle} from 'lucide-react';
import {Brand} from './brand';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {api,errorMessage} from '@/lib/client';

export default function AdminActivation(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [form,setForm]=useState({code:'',name:'',login:'',password:'',confirmation:''});
 const field=(key:keyof typeof form,value:string)=>setForm(current=>({...current,[key]:value}));
 async function activate(event:React.FormEvent){
  event.preventDefault();setError('');
  if(form.password!==form.confirmation){setError('As senhas precisam ser iguais.');return;}
  setBusy(true);
  try{const {confirmation,...data}=form;await api('admin/activate',{method:'POST',body:JSON.stringify(data)});setForm({code:'',name:'',login:'',password:'',confirmation:''});window.location.assign('/painel');}
  catch(e){setError(errorMessage(e));setBusy(false);}
 }
 return <main className="setup-page"><Brand/><section className="setup-card activation-card"><KeyRound size={32}/><div className="eyebrow">ÁREA DA CONFEITARIA</div><h1>Crie seu primeiro acesso</h1><p>Use o código recebido e escolha seu login e senha. Você entrará no painel em seguida.</p>
  <form className="form-stack" onSubmit={activate}>
   <label className="field"><span>Código de primeiro acesso</span><Input required type="password" autoComplete="off" spellCheck={false} maxLength={100} value={form.code} onChange={e=>field('code',e.target.value)}/></label>
   <label className="field"><span>Seu nome</span><Input required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={e=>field('name',e.target.value)}/></label>
   <label className="field"><span>Escolha seu login</span><Input required minLength={3} maxLength={80} autoComplete="username" autoCapitalize="none" spellCheck={false} value={form.login} onChange={e=>field('login',e.target.value)}/><small>Letras sem acento, números, ponto, @ ou traço.</small></label>
   <label className="field"><span>Crie sua senha</span><Input required type="password" minLength={6} maxLength={128} autoComplete="new-password" value={form.password} onChange={e=>field('password',e.target.value)}/><small>Pelo menos 6 caracteres.</small></label>
   <label className="field"><span>Repita sua senha</span><Input required type="password" minLength={6} maxLength={128} autoComplete="new-password" value={form.confirmation} onChange={e=>field('confirmation',e.target.value)}/></label>
   {error&&<p className="error-text" role="alert">{error}</p>}
   <Button disabled={busy}>{busy&&<LoaderCircle className="spin" size={18}/>}Criar meu acesso e entrar</Button>
  </form><p className="small-muted">O código só pode ser usado uma vez. Depois, entre com seu login e senha.</p><a className="text-link" href="/painel">Já tenho login e senha</a>
 </section></main>;
}
