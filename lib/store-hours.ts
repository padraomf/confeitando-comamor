import { z } from 'zod';
export const days=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
export const defaultHours=days.map((_,day)=>({day,enabled:day!==0,open:'09:00',close:'18:00'}));
export const hoursSchema=z.array(z.object({day:z.number().int().min(0).max(6),enabled:z.boolean(),open:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),close:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),breakStart:z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/).optional(),breakEnd:z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/).optional()})).length(7).refine(a=>new Set(a.map(x=>x.day)).size===7,'Preencha os sete dias').refine(a=>a.every(x=>!x.enabled||x.open!==x.close),'A abertura e o fechamento devem ter horários diferentes').refine(a=>a.every(h=>(!h.breakStart&&!h.breakEnd)||(!!h.breakStart&&!!h.breakEnd&&h.breakStart<h.breakEnd&&h.open<=h.breakStart&&h.breakEnd<=h.close)),'O intervalo deve estar entre a abertura e o fechamento do mesmo dia.');
export const exceptionsSchema=z.array(z.object({date:z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),closed:z.boolean()})).max(50);
export type Hours=z.infer<typeof hoursSchema>;
export type BusinessStatus={open:boolean;label:string;detail:string};
const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));
export function businessStatus(store:{open:boolean;hoursMode?:string;hours?:Hours;timezone?:string;overrideUntil?:number;exceptions?:{date:string;closed:boolean}[]},now=new Date()):BusinessStatus{
 if(store.overrideUntil&&now.getTime()>=store.overrideUntil)store={...store,hoursMode:'auto',overrideUntil:0};
 if(store.hoursMode!=='auto'){const open=store.hoursMode==='open'||(store.hoursMode!=='closed'&&store.open);return {open,label:open?'Aberta agora':'Fechada agora',detail:open?'Recebendo pedidos':'Pedidos pausados pela confeitaria'};}
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:store.timezone||'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);if(store.exceptions?.find(e=>e.date===date)?.closed)return {open:false,label:'Fechada hoje',detail:'Data sem atendimento'};
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:store.timezone||'America/Sao_Paulo',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);const part=(t:string)=>parts.find(p=>p.type===t)?.value||'';
 const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(part('weekday')),minute=Number(part('hour'))*60+Number(part('minute'));const hours:Hours=store.hours||defaultHours;
 const today=hours.find(h=>h.day===day),yesterday=hours.find(h=>h.day===(day+6)%7);
 const current=today?.enabled&&((minutes(today.close)>minutes(today.open)&&minute>=minutes(today.open)&&minute<minutes(today.close))||(minutes(today.close)<minutes(today.open)&&minute>=minutes(today.open)))?today:yesterday?.enabled&&minutes(yesterday.close)<minutes(yesterday.open)&&minute<minutes(yesterday.close)?yesterday:null;
 if(current?.breakStart&&current.breakEnd&&minute>=minutes(current.breakStart)&&minute<minutes(current.breakEnd))return {open:false,label:'Em intervalo',detail:'Voltamos às '+current.breakEnd};
 if(current)return {open:true,label:'Aberta agora',detail:`Pedidos até ${current.close}`};
 for(let offset=0;offset<8;offset++){const next=hours.find(h=>h.day===(day+offset)%7);if(next?.enabled&&(offset>0||minutes(next.open)>minute))return {open:false,label:'Fechada agora',detail:`Abre ${offset===0?'hoje':offset===1?'amanhã':days[next.day].toLowerCase()} às ${next.open}`};}
 return {open:false,label:'Fechada agora',detail:'Sem atendimento programado'};
}
