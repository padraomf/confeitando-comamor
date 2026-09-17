import {notFound} from 'next/navigation';
import {panelPages} from '@/lib/panel-pages';
export async function generateMetadata({params}:{params:Promise<{secao:string}>}){const {secao}=await params;return {title:(panelPages.find(p=>p.slug===secao)?.label||'Painel')+' | Confeitando com Amor'}}
export default async function Page({params}:{params:Promise<{secao:string}>}){const {secao}=await params;if(!panelPages.some(p=>p.slug===secao))notFound();return null}
