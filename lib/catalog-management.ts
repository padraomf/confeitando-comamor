import {categorySlug} from './category-path';
import {z} from 'zod';
import {db,admin,HttpError,categoryList,putSetting,products,unpackOrder} from './server';
import {shopper} from './customer-auth';
import type {Product,Order} from './commerce';
export function reorderItems(order:Order,catalog:Product[]){
 const items: {id:string;quantity:number}[]=[],changes:string[]=[];
 for(const old of order.data.items){const p=catalog.find(p=>p.id===old.id);if(!p||!p.active||p.demo||p.sold_out||p.stock===0){changes.push(old.name+': indisponível');continue}
 const quantity=Math.min(old.quantity,p.stock??30,30);items.push({id:p.id,quantity});
 if(p.price!==old.price)changes.push(p.name+': preço atualizado');if(quantity!==old.quantity)changes.push(p.name+': quantidade ajustada ao estoque');}
 return {items,changes};
}
export async function catalogAdminRoutes(req:Request,path:string,body:()=>Promise<any>){
 const json=(v:any)=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
 if(/^orders\/[^/]+\/repeat$/.test(path)&&req.method==='GET'){const u=await shopper(req),raw=await db().prepare('SELECT * FROM orders WHERE id=? AND user_id=?').bind(path.split('/')[1],u.userId).first<any>();if(!raw)throw new HttpError(404,'Pedido não encontrado.');return json(reorderItems(unpackOrder(raw),await products() as Product[]))}
 if(!((path==='admin/categories'&&req.method==='PATCH')||path==='admin/product-order'))return null;
 const u=await admin(req);if(u.role!=='admin')throw new HttpError(403,'Acesso restrito à administradora.');
 if(path==='admin/product-order'&&req.method==='PUT'){const {ids}=z.object({ids:z.array(z.string().max(80)).max(1000)}).parse(await body()),list=await products(true);if(new Set(ids).size!==ids.length||ids.length!==list.length||list.some((p:any)=>!ids.includes(p.id)))throw new HttpError(409,'O catálogo mudou. Atualize antes de ordenar.');await db().batch(ids.map((id,i)=>db().prepare('UPDATE products SET sort_order=? WHERE id=?').bind(i,id)));return json({ok:true})}
 if(path==='admin/categories'){
 const b=z.object({name:z.string().max(40).optional(),newName:z.string().trim().min(2).max(40).optional(),order:z.array(z.string().max(40)).max(100).optional()}).parse(await body()),list=await categoryList();
 if(b.order){if(new Set(b.order).size!==list.length||b.order.length!==list.length||list.some(c=>!b.order!.includes(c)))throw new HttpError(409,'As categorias mudaram. Atualize a página.');await putSetting('categories',JSON.stringify(b.order));return json({ok:true})}
 if(!b.name||!b.newName||!list.includes(b.name))throw new HttpError(422,'Escolha a categoria e o novo nome.');
 if(b.newName==='Todos os doces'||list.some(c=>c!==b.name&&categorySlug(c)===categorySlug(b.newName!)))throw new HttpError(422,'Esta categoria já existe.');
 await db().batch([db().prepare('UPDATE products SET category=? WHERE category=?').bind(b.newName,b.name),db().prepare("INSERT INTO settings(key,value) VALUES('categories',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(list.map(c=>c===b.name?b.newName:c)))]);return json({ok:true});
 }
 return null;
}
