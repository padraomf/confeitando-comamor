'use client';
import {MessageCircle,Monitor} from 'lucide-react';
import {orderMessage,whatsappLink} from '@/lib/order-display';
import type {Order} from '@/lib/commerce';

export function OrderWhatsApp({order,phone,label='Enviar resumo para a confeitaria',web=false}:{order:Order;phone:string;label?:string;web?:boolean}){
 if(!/^55\d{10,11}$/.test(phone.replace(/\D/g,'')))return null;
 return <div className="order-whatsapp"><a className="btn-link secondary" href={whatsappLink(phone,orderMessage(order),web)} target="_blank" rel="noreferrer">{web?<Monitor size={17}/>:<MessageCircle size={17}/>} {label}</a><p className="small-muted">O resumo abre pronto. Confira e toque em enviar no WhatsApp.</p></div>;
}
