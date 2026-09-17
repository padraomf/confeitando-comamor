import {products,settings,categoryList} from './server';
import type {Product} from './commerce';
export async function publicCatalog(){
 try{const [items,store,categories]=await Promise.all([products(),settings(),categoryList()]);return {products:(items as Product[]).filter(p=>!p.demo),settings:store,categories}}
 catch{return undefined}
}
