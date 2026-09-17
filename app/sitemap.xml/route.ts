import {categorySlug} from '@/lib/category-path';
import {runtime,products,categoryList} from '@/lib/server';
import {productPath} from '@/lib/product-sharing';
import type {Product} from '@/lib/commerce';
export async function GET(){const origin=runtime.PUBLIC_URL;if(!origin)return new Response('Unavailable',{status:503});const urls=['/','/catalogo','/encomendas',...(await categoryList()).map(c=>'/categoria/'+categorySlug(c)),...(await products() as Product[]).filter(p=>!p.demo).map(p=>productPath(p.id,p.name))];const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(p=>'<url><loc>'+escape(origin+p)+'</loc></url>').join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public,max-age=1800'}})}
