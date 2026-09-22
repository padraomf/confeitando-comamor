'use client';
import { useEffect,useState } from 'react';
import { Heart,Share2,Trash2,MessageCircle,LoaderCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { api,errorMessage } from '@/lib/client';
import {productPath} from '@/lib/product-sharing';
import { money,type Product } from '@/lib/commerce';
export {shareProduct} from '@/lib/share-product';
import {shareProduct} from '@/lib/share-product';

export function ProductSocial({product,signedIn,onChange,children}:{product:Product;signedIn:boolean;onChange:(p:Product)=>void;children?:React.ReactNode}){
 const [comments,setComments]=useState<any[]>([]),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){try{const r=await api('products/'+product.id+'/comments');setComments(r.comments);setError('')}catch(e){setError(errorMessage(e))}finally{setLoading(false)}}
 useEffect(()=>{void load()},[product.id]);
 const signIn='/conta?next='+encodeURIComponent('/?produto='+product.id);
 async function like(){if(!signedIn){window.location.href=signIn;return}setBusy(true);try{const r=await api('products/'+product.id+'/like',{method:'PUT',body:JSON.stringify({liked:!product.liked})});onChange({...product,...r})}catch(e){toast.error(errorMessage(e))}finally{setBusy(false)}}
 async function comment(){setBusy(true);try{await api('products/'+product.id+'/comments',{method:'POST',body:JSON.stringify({body})});setBody('');onChange({...product,comments:(product.comments||0)+1});await load()}catch(e){toast.error(errorMessage(e))}finally{setBusy(false)}}
 async function remove(id:string){setBusy(true);try{await api('products/'+product.id+'/comments',{method:'DELETE',body:JSON.stringify({id})});setComments(old=>old.filter(c=>c.id!==id));onChange({...product,comments:Math.max(0,(product.comments||0)-1)})}catch(e){toast.error(errorMessage(e))}finally{setBusy(false)}}
 return <>
  <Button className="share-btn-absolute" variant="outline" onClick={()=>shareProduct(product)}>
    <Share2 size={16}/> Compartilhar
  </Button>
  <div className="product-dialog-combined-actions">
     {children}
     <Button variant="outline" className="btn-like" disabled={busy||!!product.demo} onClick={like} aria-pressed={!!product.liked}>
       <Heart fill={product.liked?'currentColor':'none'} size={16}/>{product.liked?'Curtido':'Curtir'} · {product.likes||0}
     </Button>
  </div>
  <section className="product-community">
    <div className="community-header">
      <h3><MessageCircle size={18}/> Comentários</h3>
      {product.demo?<span className="small-muted">Indisponível no demo</span>:!signedIn?<a className="text-link" href={signIn} target="_top">Entre para curtir e comentar</a>:null}
    </div>
    {loading?<p>Carregando comentários…</p>:error?<p className="error-text">{error} <button onClick={load}>Tentar novamente</button></p>:comments.length?comments.map(c=><article className="product-comment" key={c.id}><div><strong>{c.name}</strong><time>{new Date(c.created_at).toLocaleDateString('pt-BR')}</time>{c.canDelete&&<button disabled={busy} aria-label="Excluir comentário" onClick={()=>remove(c.id)}><Trash2 size={15}/></button>}</div><p>{c.body}</p></article>):<p className="small-muted">Seja a primeira pessoa a comentar.</p>}
    {product.demo?null:signedIn?<form onSubmit={e=>{e.preventDefault();void comment()}}><Textarea aria-label="Seu comentário" placeholder="O que você achou deste doce?" maxLength={600} value={body} onChange={e=>setBody(e.target.value)}/><Button disabled={busy||!body.trim()}>{busy?<LoaderCircle className="spin"/>:null}Comentar</Button></form>:null}
  </section>
 </>;
}
