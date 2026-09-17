import {settings} from '@/lib/server';
import {BrandProvider} from '@/components/brand';
import type { Metadata } from 'next';
import './globals.css';
import {BagProvider} from '@/components/bag-provider';
import {SiteUpdateGuard} from '@/components/site-update-guard';
import { Toaster } from '@/components/ui/sonner';
export async function generateMetadata():Promise<Metadata>{const s=await settings();return {title:s.name+' | Confeitaria artesanal',description:'Doces artesanais preparados com carinho. Escolha seus favoritos e faça seu pedido.',icons:{icon:s.favicon,shortcut:s.favicon,apple:s.favicon},...(s.searchVerification?{verification:{google:s.searchVerification}}:{})}}
export default async function RootLayout({children}:{children:React.ReactNode}){const s=await settings();return <html lang="pt-BR"><head><SiteUpdateGuard/></head><body><BrandProvider value={{name:s.name,logo:s.logo}}><BagProvider>{children}</BagProvider></BrandProvider><Toaster richColors position="top-center"/></body></html>}
