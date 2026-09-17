import AdminPanel from '@/components/admin-panel';
export const dynamic='force-dynamic';
export const metadata={title:'Painel da confeitaria | Confeitando com Amor',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <><AdminPanel/>{children}</>}
