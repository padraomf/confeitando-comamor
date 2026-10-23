// Track all programmatic sends so message_create only hands over human replies.
export function trackAutomaticMessages(client){
 const pending=new Map();
 const original=client.sendMessage.bind(client);
 const key=(to,text)=>JSON.stringify([to,text]);
 function prune(){const now=Date.now();for(const [k,v] of pending)if(v.until<now)pending.delete(k)}
 client.sendMessage=async(to,text,...args)=>{
  prune();const k=key(to,text),entry=pending.get(k)||{count:0,until:0};
  entry.count++;entry.until=Date.now()+60000;pending.set(k,entry);
  return original(to,text,...args);
 };
 return msg=>{prune();const k=key(msg.to,msg.body),entry=pending.get(k);if(!entry)return false;if(--entry.count<=0)pending.delete(k);return true};
}

export function createIncomingHandlers({request,getConnection}){
 const seen=new Map(),queues=new Map(),trackers=new WeakMap();
 function automatic(client){if(!trackers.has(client))trackers.set(client,trackAutomaticMessages(client));return trackers.get(client)}
 async function contactPhone(msg,chat){
  if(!/@(?:c\.us|lid)$/.test(chat))return null;
  const contact=typeof msg.getContact==='function'?await msg.getContact().catch(()=>null):null;
  const phone=contact?.number||(/@c\.us$/.test(chat)?chat.split('@')[0]:null);
  return phone&&/^\d{8,16}$/.test(phone)?{phone,name:contact?.pushname||contact?.name||''}:null;
 }
 async function incoming(msg){
  if(msg.fromMe||!msg.body||msg.body.length>2000)return;
  const connection=getConnection();if(!connection.isReady())return;
  automatic(connection.client);
  const person=await contactPhone(msg,msg.from||'');if(!person)return;
  const id=msg.id?._serialized;
  const now=Date.now();for(const [k,until] of seen)if(until<now)seen.delete(k);
  if(id&&seen.has(id))return;if(id)seen.set(id,now+300000);
  if(seen.size>1000)seen.delete(seen.keys().next().value);
  const task=(queues.get(person.phone)||Promise.resolve()).catch(()=>{}).then(async()=>{
   const res=await request('incoming',{phone:person.phone,text:msg.body,senderName:person.name,isFromMe:false});
   if(res?.reply&&connection.isReady())await connection.client.sendMessage(msg.from,res.reply,{sendSeen:false});
  });
  queues.set(person.phone,task);
  try{await task}catch{console.error('Não foi possível processar a mensagem recebida.')}finally{if(queues.get(person.phone)===task)queues.delete(person.phone)}
 }
 async function created(msg){
  if(!msg.fromMe)return;
  const connection=getConnection();if(!connection.client)return;
  if(automatic(connection.client)(msg))return;
  const person=await contactPhone(msg,msg.to||'');if(!person)return;
  try{await request('incoming',{phone:person.phone,text:(msg.body||'').slice(0,2000),senderName:'Loja',isFromMe:true})}catch{console.error('Não foi possível registrar atendimento humano.')}
 }
 return {incoming,created,prepareClient:automatic};
}
