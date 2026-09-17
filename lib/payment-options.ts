import type {StoreSettings} from './commerce';
export type PaymentMethod='cash'|'card_machine'|'pix'|'card';
export function paymentAllowed(s:StoreSettings,delivery:string,payment:PaymentMethod,online:boolean){
 const rule=s.paymentRules?.[delivery==='pickup'?'pickup':'delivery'];
 if(rule&&rule[payment]===false)return false;
 if(delivery==='pickup'&&s.pickupPrepaid&&(payment==='cash'||payment==='card_machine'||!online))return false;
 if(payment==='cash')return s.cash;
 if(payment==='card_machine')return s.cardOnDelivery;
 if(payment==='card')return online&&s.paymentProvider!=='picpay';
 return online||!!s.pixKey;
}
