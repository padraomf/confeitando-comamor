import { Printer } from 'lucide-react';
export function PrintOrder({orderId}:{orderId:string}){return <a className="print-order" href={'/api/orders/'+encodeURIComponent(orderId)+'/print'} target="_blank" rel="noreferrer"><Printer size={17}/>Imprimir pedido · duas vias</a>}
