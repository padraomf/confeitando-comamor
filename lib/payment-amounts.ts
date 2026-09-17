import type {Order} from './commerce';
export const receivedAmount=(o:Order)=>o.received??(o.payment_status==='Pago'?o.total:0);
export const remainingAmount=(o:Order)=>Math.max(0,o.total-receivedAmount(o));
