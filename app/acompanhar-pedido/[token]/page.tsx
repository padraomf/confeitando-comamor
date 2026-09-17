import {redirect} from 'next/navigation';
export default async function Page({params}:{params:Promise<{token:string}>}){redirect('/acompanhar/'+encodeURIComponent((await params).token))}
