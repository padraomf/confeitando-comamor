import {MapPin} from 'lucide-react';
import {destinationUrl} from '@/lib/order-display';
import type {Order} from '@/lib/commerce';
export function OrderLocation({order}:{order:Order}){const url=destinationUrl(order);return url?<a className="btn-link secondary" href={url} target="_blank" rel="noreferrer"><MapPin size={17}/>{order.data.address?.location?.confirmed?'Abrir ponto exato da entrega':'Abrir endereço do pedido'}</a>:null}
