import type {Metadata} from 'next';
import {cache} from 'react';
import {notFound} from 'next/navigation';
import {headers} from 'next/headers';
import Storefront from '@/components/storefront';
import {db,runtime,settings} from '@/lib/server';
import type {Product} from '@/lib/commerce';
import {productMetadata,productIdFromPath} from '@/lib/product-sharing';

export const dynamic='force-dynamic';
const loadProduct=cache(async(id:string)=>db().prepare('SELECT * FROM products WHERE id=? AND active=1 AND demo=0').bind(id).first<Product>());
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const product=await loadProduct(productIdFromPath((await params).id));
 if(!product)return {title:'Produto indisponível | Confeitando com Amor',robots:{index:false,follow:true}};
 const h = await headers();
 const host = h.get('host') || 'confeitandocomamor.com.br';
 const origin = runtime.PUBLIC_URL || `https://${host}`;
 return productMetadata(product,origin,(await settings()).name);
}
export default async function ProductPage({params}:Props){
 const product=await loadProduct(productIdFromPath((await params).id));
 if(!product)notFound();
 const h = await headers();
 const host = h.get('host') || 'confeitandocomamor.com.br';
 const origin=runtime.PUBLIC_URL||`https://${host}`,store=await settings(),json={'@context':'https://schema.org','@type':'Product',name:product.name,description:product.description,image:origin+product.image,offers:{'@type':'Offer',price:(product.price/100).toFixed(2),priceCurrency:'BRL',availability:product.sold_out||product.stock===0?'https://schema.org/OutOfStock':'https://schema.org/InStock',seller:{'@type':'Organization',name:store.name}}};
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(json).replaceAll('<','\\u003c')}}/><Storefront initialProduct={product}/></>;
}
