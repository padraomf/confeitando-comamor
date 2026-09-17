import {db} from './server';
import type {Order} from './commerce';

// These statements run in the same D1 batch as order insertion. A failed
// CHECK rolls back the order and every inventory change together.
export function reserveStock(id:string,items:Order['data']['items']){
 const data=JSON.stringify(items),guard='stock:'+id;
 return [
  db().prepare(`INSERT INTO commerce_guards(id,valid) SELECT ?,NOT EXISTS(
   SELECT 1 FROM json_each(?) j LEFT JOIN products p ON p.id=json_extract(j.value,'$.id')
   WHERE p.id IS NULL OR p.active!=1 OR p.demo!=0 OR p.sold_out!=0
    OR p.price!=json_extract(j.value,'$.price')
    OR (p.stock IS NOT NULL)!=json_extract(j.value,'$.stockTracked')
    OR (p.stock IS NOT NULL AND p.stock<json_extract(j.value,'$.quantity'))
  )`).bind(guard,data),
  db().prepare(`UPDATE products SET stock=stock-(SELECT SUM(json_extract(j.value,'$.quantity'))
   FROM json_each(?) j WHERE json_extract(j.value,'$.id')=products.id)
   WHERE stock IS NOT NULL AND id IN(SELECT json_extract(value,'$.id') FROM json_each(?))`).bind(data,data),
  db().prepare('DELETE FROM commerce_guards WHERE id=?').bind(guard)
 ];
}

export function restoreStock(id:string){
 return db().prepare(`UPDATE products SET stock=stock+(SELECT SUM(json_extract(j.value,'$.quantity'))
  FROM orders o,json_each(o.data,'$.items') j WHERE o.id=? AND o.status='Recebido'
   AND json_extract(j.value,'$.id')=products.id AND json_extract(j.value,'$.stockTracked')=1)
  WHERE stock IS NOT NULL AND id IN(SELECT json_extract(j.value,'$.id')
   FROM orders o,json_each(o.data,'$.items') j WHERE o.id=? AND o.status='Recebido'
    AND json_extract(j.value,'$.stockTracked')=1)`).bind(id,id);
}
