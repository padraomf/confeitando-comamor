import Tracking from '@/components/tracking';
export const metadata={title:'Acompanhar pedido | Confeitando com Amor',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{token:string}>}){return <Tracking token={(await params).token}/>}
