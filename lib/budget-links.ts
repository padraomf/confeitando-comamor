import {createHmac,timingSafeEqual} from 'node:crypto';
import {db,runtime,HttpError} from './server';

function signature(id:string){
 if(!runtime.APP_SECRET)throw new HttpError(503,'Acompanhamento indisponível.');
 return createHmac('sha256',runtime.APP_SECRET).update('budget-access-v1:'+id).digest('hex');
}
export async function budgetCustomerLink(id:string,domain=runtime.PUBLIC_URL||'https://confeitandocomamor.com.br'){
 return domain+'/encomenda/'+id+'?access='+signature(id);
}
export async function linkedBudget(id:string,access:string|null){
 if(!/^[a-f0-9-]{36}$/.test(id)||!access||!/^[a-f0-9]{64}$/.test(access)||!timingSafeEqual(Buffer.from(signature(id)),Buffer.from(access)))throw new HttpError(404,'Encomenda não encontrada. Abra o link recebido pelo WhatsApp.');
 const row=await db().prepare('SELECT * FROM budgets WHERE id=?').bind(id).first<any>();
 if(!row)throw new HttpError(404,'Encomenda não encontrada.');
 return {...row,data:JSON.parse(row.data)};
}

export async function budgetConversationContext(userId:string){
 const rows=await db().prepare("SELECT id,code,status,data FROM budgets WHERE user_id=? ORDER BY updated_at DESC LIMIT 3").bind(userId).all<any>();
 return Promise.all(rows.results.map(async row=>{
  const data=JSON.parse(row.data);
  return {code:row.code,status:row.status,description:data.description,date:data.date,offer:data.offer||null,link:await budgetCustomerLink(row.id)};
 }));
}
