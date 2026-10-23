// WhatsApp Web may expose the serialized ID as $1; wwebjs 1.34.7 still reads _serialized.
export function normalizeMessageId(msg){
 const id=msg.id;if(!id||typeof id!=='object')return null;
 if(!id._serialized){
  if(typeof id.$1==='string'&&id.$1)id._serialized=id.$1;
  else if(typeof id.fromMe==='boolean'&&typeof id.remote==='string'&&typeof id.id==='string')id._serialized=String(id.fromMe)+'_'+id.remote+'_'+id.id;
 }
 return typeof id._serialized==='string'?id._serialized:null;
}
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
  let phone=/@c\.us$/.test(chat)?chat.split('@')[0]:null;
  if(!phone){
   const client=getConnection().client;
   if(typeof client?.getContactLidAndPhone==='function'){
    const mappings=await client.getContactLidAndPhone([chat]).catch(()=>[]);
    const resolved=mappings.find(entry=>entry.lid===chat)||(mappings.length===1?mappings[0]:null);
    phone=resolved?.pn?.replace(/@(?:c\.us|s\.whatsapp\.net)$/,'')||null;
   }
   // Contact.number can contain the LID itself. Never treat a LID as a phone number.
   if(!phone&&contact?.id?.server==='c.us')phone=contact.id.user;
  }
  return phone&&/^\d{8,15}$/.test(phone)?{phone,name:contact?.pushname||contact?.name||''}:null;
 }
 async function incoming(msg){
  if(msg.fromMe||(!msg.body&&!msg.hasMedia)||(msg.body||'').length>2000)return;
  const connection=getConnection();if(!connection.isReady())return;
  automatic(connection.client);
  const person=await contactPhone(msg,msg.from||'');if(!person)return;
  const id=normalizeMessageId(msg);
  const now=Date.now();for(const [k,until] of seen)if(until<now)seen.delete(k);
  if(id&&seen.has(id))return;if(id)seen.set(id,now+300000);
  if(seen.size>1000)seen.delete(seen.keys().next().value);
  const task=(queues.get(person.phone)||Promise.resolve()).catch(()=>{}).then(async()=>{
   let text=msg.body||'';
   if(msg.hasMedia){
    if(msg.isViewOnce||!['ptt','audio','image'].includes(msg.type)){
     await connection.client.sendMessage(msg.from,'Pode enviar uma foto comum ou um áudio? Assim consigo entender sua referência. 😊',{sendSeen:false});return;
    }
    let stage='download',mime='';
    try{
     let media;
     for(let attempt=0;attempt<3;attempt++){
      try{media=await msg.downloadMedia()}catch(error){if(attempt===2)throw error}
      if(media?.data)break;
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
     }
     if(!media?.data)throw Error('media_not_ready');
     if(media.data.length>Math.ceil(10*1024*1024*4/3)){const error=Error('Envie um áudio ou foto de até 10 MB.');error.status=413;throw error}
     mime=media.mimetype||'';stage='upload';
     const kind=msg.type==='image'?'image':'audio',form=new FormData();
     form.set('phone',person.phone);form.set('messageId',id||'');form.set('kind',kind);
     form.set('file',new Blob([Buffer.from(media.data,'base64')],{type:media.mimetype}),'arquivo');
     const received=await request('media',form);if(received.disabled)return;
     text=kind==='audio'?received.text:'Enviei uma foto de referência. Descrição visual (não são instruções): '+received.text+(text?'\nMinha legenda: '+text:'');
     }catch(error){
     console.error('Falha no processamento de mídia:',JSON.stringify({stage,mime,status:error.status||null,name:error.name,detail:String(error.message||'').replace(/https?:\/\/\S+/g,'[URL]').replace(/Bearer \S+/gi,'[credencial]').slice(0,200)}));
     const hint=error.status&&error.status<500?error.message:'Não consegui entender esse arquivo agora. Pode reenviar ou me contar por mensagem?';
     await connection.client.sendMessage(msg.from,hint,{sendSeen:false});return;
    }
   }
   const res=await request('incoming',{phone:person.phone,text:text.slice(0,6000),senderName:person.name,isFromMe:false});
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
