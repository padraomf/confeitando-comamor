import {remainingAmount,receivedAmount} from './payment-amounts';
import {addressText,money,type Order} from './commerce';

export function manualPayment(order:Order){
 return !order.checkout_url&&(order.data.paymentProvider==='manual'||(!order.data.paymentProvider&&(order.payment==='cash'||!!order.data.pixCode)));
}
export function payOnDelivery(order:Order){return order.payment==='cash'||order.payment==='card_machine'||(order.payment==='card'&&manualPayment(order))}
export function paymentLabel(order:Order){
 if(order.payment==='cash')return 'Dinheiro';
 if(order.payment==='card_machine')return 'Cartão na maquininha';
 if(order.payment==='card')return manualPayment(order)?'Cartão na maquininha':'Cartão online';
 return manualPayment(order)?'Pix pela chave':'Pix online';
}
export function collectionInfo(order:Order){
 const due=remainingAmount(order);
 if(['Cancelado','Não retirado'].includes(order.status))return {title:'PEDIDO CANCELADO',detail:'Não entregar nem cobrar. Consulte a confeitaria.',due:0};
 if(order.payment_status==='Pago')return {title:'PAGO · NÃO COBRAR',detail:'Pagamento confirmado pela confeitaria ou pelo provedor.',due:0};
 if(['Estornado','Contestado','Estorno parcial'].includes(order.payment_status))return {title:'CONFERIR COM A LOJA',detail:'Pagamento '+order.payment_status.toLowerCase()+'. Não cobrar novamente sem orientação da confeitaria.',due:0};
 const where=order.data.delivery==='pickup'?'na retirada':'na entrega';
 if(order.payment==='cash')return {title:'COBRAR '+money(due),detail:'Receber em dinheiro '+where+'. '+(order.data.change!=null?'Cliente pagará com '+money(order.data.change)+'. Levar '+money(Math.max(0,order.data.change-due))+' de troco.':'Cliente não solicitou troco.'),due};
 if(order.payment==='card_machine'||order.payment==='card'&&manualPayment(order))return {title:'COBRAR '+money(due),detail:(order.data.delivery==='pickup'?'Usar a maquininha da loja.':'LEVAR A MAQUININHA. ')+'Receber no cartão '+where+' e conferir a aprovação na maquininha.',due};
 if(manualPayment(order))return {title:'PIX · AGUARDA CONFERÊNCIA',detail:'Valor: '+money(due)+'. Conferir o crédito no banco com a loja antes de entregar. Não cobrar novamente se o cliente já transferiu.',due};
 return {title:'PAGAMENTO ONLINE PENDENTE',detail:'Aguardar a confirmação da loja. Não cobrar novamente na entrega.',due:0};
}
export function destinationUrl(order:Order){
 if((order.data as any).googleMapsUrl)return (order.data as any).googleMapsUrl;
 if(order.data.delivery!=='delivery'||!order.data.address)return null;
 const point=order.data.address.location;
 const destination=point?.confirmed?`${point.lat},${point.lng}`:addressText({...order.data.address,complement:''})+', Brasil';
 return 'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',destination,travelmode:'driving',dir_action:'navigate'}).toString();
}
export function orderMessage(order:Order){
 const info=collectionInfo(order);
 return [(order.data.storeName||'Confeitando com Amor')+' · Pedido #'+order.code,'Cliente: '+order.data.profile.name,...order.data.items.map(i=>`${i.quantity} × ${i.name} — ${money(i.quantity*i.price)}${i.note?' · '+i.note:''}`),'Frete: '+money(order.data.fee),'Total: '+money(order.total),'Recebido: '+money(receivedAmount(order)),'Saldo: '+money(remainingAmount(order)),order.data.delivery==='pickup'?'Retirada na loja':'Entrega: '+addressText(order.data.address!),...(destinationUrl(order)?['Rota: '+destinationUrl(order)]:[]),'Etapa: '+order.status,'Forma de pagamento: '+paymentLabel(order),'Situação: '+order.payment_status,info.title,info.detail,...(order.data.pixKey&&order.payment_status!=='Pago'?['Chave Pix: '+order.data.pixKey,'Titular: '+order.data.pixName]:[]),...(order.data.note?['Observação: '+order.data.note]:[])].join('\n');
}
export function whatsappLink(phone:string,message:string,web=false){
 const number=phone.replace(/\D/g,'');
 return web?'https://web.whatsapp.com/send?'+new URLSearchParams({phone:number,text:message}).toString():'https://wa.me/'+number+'?text='+encodeURIComponent(message);
}

export function eventMessage(order:Order,event:string){
 const status=order.status,closed=['Cancelado','Não retirado'].includes(status);
 const itemEmoji=order.data.items.some(i=>/bolo/i.test(i.name))?'🎂':order.data.items.some(i=>/brownie/i.test(i.name))?'🍫':order.data.items.some(i=>/cookie/i.test(i.name))?'🍪':'🧁';
 if(closed)return `❌ Pedido #${order.code} foi ${status==='Cancelado'?'*cancelado*':'marcado como *não retirado*'}.\n\nFale com a confeitaria se precisar de ajuda.`;
 if(event==='Cobrança manual')return `🔔 Lembrete do pedido #${order.code}\n\nO pagamento de *${money(remainingAmount(order))}* está pendente.\n\nAcesse o link abaixo para conferir as opções de pagamento.`;
 if(event==='Pago')return `✅ Pagamento do pedido #${order.code} *confirmado*!\n\nEtapa: *${status.toLowerCase()}*`;
 if(status==='Recebido'){
  const payInfo=order.payment_status==='Pago'?'Pagamento *confirmado*.':payOnDelivery(order)?`Pagamento de ${money(remainingAmount(order))} na ${order.data.delivery==='pickup'?'retirada':'entrega'}.`:'Tudo certo! Seu pedido já está registrado.';
  const itemsList = order.data.customOrder ? `*Detalhes da encomenda:*\n${order.data.items[0]?.note || 'Nenhuma observação'}\n\n*Valor:* ${money(order.total)}` : `*Itens:*\n` + order.data.items.map(i => `▪ ${i.quantity}x ${i.name} — ${money(i.quantity * i.price)}${i.note ? `\n  Obs: ${i.note}` : ''}`).join('\n') + `\n\n*Total:* ${money(order.total)}`;
  return `${itemEmoji} Pedido #${order.code} *recebido*!\n\n${itemsList}\n\n${payInfo}`;
 }
 const statusEmoji=status==='Em preparo'?'👩‍🍳':status==='Pronto para entrega'||status==='Pronto para retirada'?'✅':status==='Saiu para entrega'?'🛵':status==='Entregue'||status==='Retirado'?'🎉':'🍰';
 let msg=`${statusEmoji} Pedido #${order.code}: *${status.toLowerCase()}*`;
 if(status==='Pronto para retirada'&&order.data.pickupCode)msg+=`\n\n🔑 Código de retirada: *${order.data.pickupCode}*`;
 return msg;
}
