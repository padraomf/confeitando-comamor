import {z} from 'zod';
function withoutUnknowns(value:unknown):unknown{
 if(Array.isArray(value))return value.map(withoutUnknowns);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!=null).map(([k,v])=>[k,withoutUnknowns(v)]));
 return value;
}
export const salePatchSchema=z.preprocess(withoutUnknowns,z.object({
 items:z.array(z.object({id:z.string().max(80),quantity:z.number().int().min(1).max(30)}).strict()).min(1).max(20).optional(),
 delivery:z.enum(['pickup','delivery']).nullable().optional(),payment:z.enum(['pix','card','cash','card_machine']).nullable().optional(),
 name:z.string().max(120).optional(),email:z.string().max(254).optional(),cpf:z.string().max(20).optional(),note:z.string().max(500).optional(),
 address:z.object({cep:z.string().max(9),street:z.string().max(150),number:z.string().max(20),district:z.string().max(100),city:z.string().max(100),state:z.string().max(2),complement:z.string().max(150)}).partial().optional()
}).strict());
