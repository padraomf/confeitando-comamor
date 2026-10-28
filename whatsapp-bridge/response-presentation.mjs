export function messageParts(text,limit=180){
 const value=String(text).trim();if(!value)return [];
 if(/^(?:\*Confere sua encomenda\*|\*Resumo do seu pedido\*|Escolhe até 2 recheios:)/.test(value))return [value];
 const parts=[];let part='';
 const flush=()=>{if(part)parts.push(part);part=''};
 for(const paragraph of value.split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚ0-9])/u)){
  if(paragraph.length<=limit){flush();part=paragraph;continue}
  flush();
  for(const line of paragraph.split('\n')){
   if(line.length<=limit){if(part&&part.length+line.length+1>limit)flush();part+=(part?'\n':'')+line;continue}
   flush();
   // Never cut a URL, an amount or a word in half.
   for(const word of line.match(/https?:\/\/\S+|R\$\s*\d[\d.,]*|\S+/g)||[]){if(part&&part.length+word.length+1>limit)flush();part+=(part?' ':'')+word}
   flush();
  }
 }
 flush();return parts;
}
async function bounded(action){let timer;try{return await Promise.race([action(),new Promise(resolve=>{timer=setTimeout(resolve,1500)})])}catch{}finally{clearTimeout(timer)}}
export async function sendConversationalReply(client,to,text,{allowed=()=>true,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const chat=typeof client.getChatById==='function'?await bounded(()=>client.getChatById(to)):undefined;
 for(const part of messageParts(text)){
  if(!allowed())return;
  try{
   if(typeof chat?.sendStateTyping==='function'){
    await bounded(()=>chat.sendStateTyping());
    await sleep(Math.min(5000,Math.max(1800,part.length*25)));
   }
   if(!allowed())return;
   await client.sendMessage(to,part,{sendSeen:false});
  }finally{if(typeof chat?.clearState==='function')await bounded(()=>chat.clearState())}
 }
}
