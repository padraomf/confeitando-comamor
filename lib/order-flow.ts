import type {Order} from './commerce';
export const ended=['Concluído','Entregue','Retirado','Cancelado','Não retirado'];
export function nextSteps(o:Order){if(ended.includes(o.status))return [];const flow=o.data.delivery==='pickup'?['Recebido','Em preparo','Pronto para retirada','Retirado']:['Recebido','Em preparo','Pronto para entrega','Saiu para entrega','Entregue'];const index=flow.indexOf(o.status);return [...(index>=0&&index<flow.length-1?[flow[index+1]]:[]),'Cancelado',...(o.status==='Pronto para retirada'?['Não retirado']:[])];}
