import type {Metadata} from 'next';
import {money,type Product} from './commerce';

export const productPath=(id:string,name?:string)=>'/produto/'+(name?(name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'doce')+'--':'')+encodeURIComponent(id);
export const productIdFromPath=(path:string)=>path.includes('--')?path.slice(path.lastIndexOf('--')+2):path;
export function productMetadata(product:Product,origin:string,storeName='Confeitando com Amor'):Metadata{
 const title=product.name+' · '+money(product.price)+' | '+storeName;
 const description=product.description.slice(0,250);
 const url=new URL(productPath(product.id,product.name),origin).toString();
 const image=new URL(product.image,origin).toString();
 return {title,description,alternates:{canonical:url},openGraph:{type:'website',locale:'pt_BR',siteName:storeName,title,description,url,images:[{url:image,alt:product.name}]},twitter:{card:'summary_large_image',title,description,images:[image]}};
}
