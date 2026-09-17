import Storefront from '@/components/storefront';
import {publicCatalog} from '@/lib/public-catalog';
export const dynamic='force-dynamic';
export const metadata={title:'Catálogo | Confeitando com Amor',alternates:{canonical:'/catalogo'}};
export default async function Home(){return <Storefront initialCatalog={await publicCatalog()}/>}
