import Storefront from '@/components/storefront';
import {publicCatalog} from '@/lib/public-catalog';
import {categorySlug} from '@/lib/category-path';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const c=await publicCatalog(),slug=(await params).slug,name=c?.categories.find(n=>categorySlug(n)===slug);return {title:(name||'Categoria')+' | '+(c?.settings.name||'Confeitaria'),alternates:{canonical:'/categoria/'+slug}}}
export default async function Page({params}:{params:Promise<{slug:string}>}){const c=await publicCatalog(),slug=(await params).slug,name=c?.categories.find(n=>categorySlug(n)===slug);if(!c||!name)notFound();return <Storefront initialCatalog={c} initialCategory={name}/>}
