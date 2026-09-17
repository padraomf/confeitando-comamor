'use client';
import { useRef,useState } from 'react';
import { LocateFixed, LoaderCircle } from 'lucide-react';
import {ExactLocation} from './exact-location';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { api,errorMessage } from '@/lib/client';
import type { Address } from '@/lib/commerce';
import { toast } from 'sonner';
export function AddressFields({value,onChange}:{value:Address;onChange:(a:Address)=>void}){
 const [busy,setBusy]=useState(false);const latest=useRef(value);latest.current=value;
 const change=(key:keyof Address,v:string)=>onChange({...value,[key]:v,location:value.location&&key!=='complement'?{...value.location,confirmed:false}:value.location});
 async function cep(){if(value.cep.replace(/\D/g,'').length!==8)return;setBusy(true);try{const r=await api('address/cep?cep='+value.cep.replace(/\D/g,''));onChange({...latest.current,...r,location:latest.current.location?{...latest.current.location,confirmed:false}:undefined})}catch(e){toast.error(errorMessage(e))}finally{setBusy(false)}}

 return <div className="form-stack"><div className="form-grid"><div><Label htmlFor="cep">CEP</Label><Input id="cep" autoComplete="postal-code" inputMode="numeric" maxLength={9} value={value.cep} onChange={e=>change('cep',e.target.value)} onBlur={cep} placeholder="00000-000"/></div><div><Label htmlFor="number">Número</Label><Input id="number" value={value.number} onChange={e=>change('number',e.target.value)} placeholder="123"/></div></div><div><Label htmlFor="street">Rua / avenida</Label><Input id="street" autoComplete="address-line1" value={value.street} onChange={e=>change('street',e.target.value)} placeholder="Nome da rua"/></div><div><Label htmlFor="district">Bairro</Label><Input id="district" value={value.district} onChange={e=>change('district',e.target.value)} placeholder="Seu bairro"/></div><div className="form-grid city-row"><div><Label htmlFor="city">Cidade</Label><Input id="city" autoComplete="address-level2" value={value.city} onChange={e=>change('city',e.target.value)}/></div><div><Label htmlFor="state">UF</Label><Input id="state" maxLength={2} autoComplete="address-level1" value={value.state} onChange={e=>change('state',e.target.value.toUpperCase())} placeholder="SP"/></div></div><div><Label htmlFor="complement">Complemento <span className="muted">(opcional)</span></Label><Input id="complement" autoComplete="address-line2" value={value.complement} onChange={e=>change('complement',e.target.value)} placeholder="Apartamento, bloco ou referência"/></div><ExactLocation address={value} onChange={location=>onChange({...latest.current,location})}/></div>
}
