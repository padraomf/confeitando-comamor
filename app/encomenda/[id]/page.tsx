import BudgetTracking from '@/components/budget-tracking';
export const dynamic='force-dynamic';
export const metadata={title:'Sua encomenda | Confeitando com Amor',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{access?:string}>}){
 const {id}=await params,{access}=await searchParams;
 return <BudgetTracking id={id} access={access||''}/>;
}
