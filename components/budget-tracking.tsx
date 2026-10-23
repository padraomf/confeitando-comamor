'use client';
import {useEffect,useState} from 'react';
import {api,errorMessage} from '@/lib/client';
import {BudgetOffer} from './budget-offer';
export default function BudgetTracking({id,access}:{id:string;access:string}){
 const [data,setData]=useState<any>(null),[error,setError]=useState('');
 async function load(){try{setData(await api('budget-link/'+id+'?access='+encodeURIComponent(access)));setError('')}catch(e){setError(errorMessage(e))}}
 useEffect(()=>{void load()},[id,access]);
 return <main className="container section"><h1>Sua encomenda</h1>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p>Carregando…</p>}{data&&<article className="settings-card"><h2>#{data.budget.code}</h2><p>Olá, {data.budget.data.name}! 💕</p><p><strong>{data.budget.status}</strong></p><p>{data.budget.data.date.replace('T',' às ')}</p><p className="preserve-lines">{data.budget.data.description}</p>{!data.budget.data.offer&&<p>Recebemos sua solicitação. Aguarde a análise da confeitaria e o valor da proposta.</p>}<BudgetOffer budget={data.budget} config={data.config} accessToken={access} onChanged={()=>void load()}/></article>}</main>;
}
