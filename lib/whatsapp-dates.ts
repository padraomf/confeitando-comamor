import {localDay} from './admin-orders';

export function resolveWhatsAppDate(text:string,timezone:string,previousDate?:string,now=Date.now()){
 const today=localDay(now,timezone),base=new Date(today+'T12:00:00Z');
 const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 let day:string|undefined,invalid=false;
 const numeric=normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
 const move=(days:number)=>{const date=new Date(base);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)};
 if(numeric){
  const year=numeric[3]?(numeric[3].length===2?'20'+numeric[3]:numeric[3]):today.slice(0,4);
  const candidate=`${year}-${numeric[2].padStart(2,'0')}-${numeric[1].padStart(2,'0')}`;
  const parsed=new Date(candidate+'T12:00:00Z');
  if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==candidate)invalid=true;else day=candidate;
 }else if(/\bdepois de amanha\b/.test(normalized))day=move(2);
 else if(/\bamanha\b/.test(normalized))day=move(1);
 else if(/\bhoje\b/.test(normalized))day=today;
 else{
  const weekday=normalized.match(/\b(domingo|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado)\b/);
  if(weekday){const target=['domingo','segunda','terca','quarta','quinta','sexta','sabado'].indexOf(weekday[1].split('-')[0]);let delta=(target-base.getUTCDay()+7)%7;if(delta===0)delta=7;day=move(delta)}
 }
 const clock=normalized.match(/\b([01]?\d|2[0-3])\s*(?:h(?:\s*([0-5]\d))?|:([0-5]\d))\b/);
 const time=clock?clock[1].padStart(2,'0')+':'+(clock[2]||clock[3]||'00'):/\bmeio[ -]dia\b/.test(normalized)?'12:00':undefined;
 if(!day&&time&&previousDate)day=previousDate.slice(0,10);
 if(!day&&!invalid)return null;
 const priorTime=day&&previousDate?.slice(0,10)===day?previousDate.split('T')[1]:undefined;
 return {day,date:day?(day+((time||priorTime)?'T'+(time||priorTime):'')):undefined,time:time||priorTime,invalid,past:!!day&&day<today,today};
}

export const isWhatsAppGreeting=(text:string)=>/^(?:oi+|ol[aá]|ei|bom dia|boa tarde|boa noite)[!.,\s]*$/i.test(text.trim());
