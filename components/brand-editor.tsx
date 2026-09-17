'use client';
import {useState} from 'react';
import {Input} from './ui/input';
import {Button} from './ui/button';
import {api,errorMessage} from '@/lib/client';
import {standardPhoto} from '@/lib/image-upload';
import {toast} from 'sonner';
import type {StoreSettings} from '@/lib/commerce';
export function BrandEditor({settings,onChange}:{settings:StoreSettings;onChange:(s:StoreSettings)=>void}){
 const [busy,setBusy]=useState('');
 async function upload(kind:'logo'|'favicon',file?:File){if(!file)return;setBusy(kind);try{const body=new FormData();body.append('file',await standardPhoto(file));body.append('original',file);const r=await api('admin/upload',{method:'POST',body});onChange({...settings,[kind]:r.url});toast.success('Imagem adicionada. Salve as alterações da loja para aplicar.')}catch(e){toast.error(errorMessage(e))}finally{setBusy('')}}
 return <section className="settings-card brand-editor"><h3>Marca da confeitaria</h3><label className="field"><span>Nome da loja</span><Input maxLength={100} value={settings.name} onChange={e=>onChange({...settings,name:e.target.value})}/></label>{(['logo','favicon'] as const).map(kind=><label className="field" key={kind}><span>{kind==='logo'?'Logo do site':'Ícone da aba do navegador'}</span><img src={settings[kind]} alt={kind==='logo'?'Logo atual':'Ícone atual'}/><input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={e=>upload(kind,e.target.files?.[0])}/>{busy===kind&&<small>Enviando imagem…</small>}</label>)}<Button variant="outline" onClick={()=>onChange({...settings,logo:'/brand-transparent.png',favicon:'/avatar.jpg'})}>Usar as imagens originais da marca</Button><label className="field"><span>Verificação do Google Search Console (opcional)</span><Input autoComplete="off" value={settings.searchVerification} onChange={e=>onChange({...settings,searchVerification:e.target.value.trim()})}/><small>Cole apenas o código de verificação da propriedade. O sitemap fica em /sitemap.xml.</small></label></section>;
}
