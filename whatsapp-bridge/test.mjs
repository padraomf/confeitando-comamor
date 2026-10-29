import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {deliver} from './delivery.mjs';
import {journal} from './storage.mjs';
// Connection.stop(true) clears its session directory. Never point lifecycle tests at a real account.
const connectionData=mkdtempSync(path.join(tmpdir(),'cca-connection-test-'));
process.env.CCA_BRIDGE_DATA_DIR=connectionData;
const {Connection}=await import('./connection.mjs');
test.after(()=>rmSync(connectionData,{recursive:true,force:true}));
import {trackAutomaticMessages,createIncomingHandlers,normalizeMessageId,downloadCompatibleMedia} from './incoming.mjs';
const job={id:'fixture-order-cliente',leaseToken:'a'.repeat(64),phone:'5511999999999',text:'Pedido fictício',resumed:false};

test('short consecutive texts are combined into one response instead of repeated questions',async()=>{
 const calls=[],sent=[],client={sendMessage:async(to,text)=>sent.push(text)};
 const handlers=createIncomingHandlers({waitForMessagesMs:20,getConnection:()=>({client,isReady:()=>true}),request:async(route,data)=>{calls.push(data.text);return {reply:'Para qual data?'}}});
 const base={from:'5511999999999@c.us'};
 await Promise.all([handlers.incoming({...base,body:'quero encomendar',id:{_serialized:'batch-1'}}),handlers.incoming({...base,body:'um bolo',id:{_serialized:'batch-2'}})]);
 assert.deepEqual(calls,['quero encomendar\num bolo']);assert.deepEqual(sent,['Para qual data?']);
});

test('compatibility download forwards the audio MIME type when the standard method fails',async()=>{
 const before=globalThis.window,raw={mediaData:{mediaStage:'FETCHING'},mimetype:'audio/ogg; codecs=opus',type:'ptt',directPath:'/fixture',size:3};let parameters;
 globalThis.window={require:name=>name==='WAWebCollections'?{Msg:{get:id=>id==='fixture-id'?raw:null}}:{downloadManager:{downloadAndMaybeDecrypt:async args=>{parameters=args;return new Uint8Array([1,2,3])}}},WWebJS:{arrayBufferToBase64Async:async()=> 'AQID'}};
 try{const result=await downloadCompatibleMedia({id:{$1:'fixture-id'},downloadMedia:async()=>{throw Error('t')}},{pupPage:{evaluate:async(fn,id)=>fn(id)}});assert.equal(result.data,'AQID');assert.equal(parameters.mimetype,'audio/ogg; codecs=opus');assert.equal(parameters.type,'ptt')}finally{if(before===undefined)delete globalThis.window;else globalThis.window=before}
});

test('current WhatsApp message IDs are restored before the library downloads audio',async()=>{
 const calls=[],client={sendMessage:async()=>({})},handlers=createIncomingHandlers({waitForMessagesMs:0,getConnection:()=>({client,isReady:()=>true}),request:async(route,data)=>{calls.push(route);return route==='media'?{text:'Quero bolo'}:{reply:'Claro'}}});
 const message={from:'5511999999999@c.us',hasMedia:true,type:'ptt',body:'',id:{fromMe:false,remote:'5511999999999@c.us',id:'audio-id',$1:'false_5511999999999@c.us_audio-id'},async downloadMedia(){assert.equal(this.id._serialized,this.id.$1);return {mimetype:'audio/ogg',data:'YWJj'}}};
 await handlers.incoming(message);await handlers.incoming(message);assert.deepEqual(calls,['media','incoming']);
 assert.equal(normalizeMessageId({id:{fromMe:false,remote:'123@lid',id:'abc'}}),'false_123@lid_abc');
 assert.equal(normalizeMessageId({id:{}}),null);
});

test('voice notes without text and reference photos with captions use the media endpoint',async()=>{
 const calls=[],sent=[],client={sendMessage:async(to,text)=>sent.push(text)};
 const handlers=createIncomingHandlers({waitForMessagesMs:0,getConnection:()=>({client,isReady:()=>true}),request:async(route,data)=>{calls.push({route,data});return route==='media'?{text:data.get('kind')==='audio'?'Quero um bolo':'Bolo com flores'}:{reply:'Entendi!'}}});
 const base={from:'5511999999999@c.us',hasMedia:true,body:'',type:'ptt',id:{_serialized:'voice'},downloadMedia:async()=>({mimetype:'audio/ogg; codecs=opus',data:Buffer.from('OggS-fixture').toString('base64')})};
 await handlers.incoming(base);assert.equal(calls[0].route,'media');assert.equal(calls[1].data.text,'Quero um bolo');
 await handlers.incoming({...base,type:'image',body:'Quero em azul',id:{_serialized:'photo'}});assert.equal(calls[2].data.get('kind'),'image');assert.match(calls[3].data.text,/Quero em azul/);assert.equal(sent.length,2);
 await handlers.incoming({...base,isViewOnce:true,id:{_serialized:'private'}});assert.equal(calls.length,4);assert.match(sent.at(-1),/foto comum/);
});

test('media failures ask for a resend and never invent a transcription',async()=>{
 const sent=[],calls=[],client={sendMessage:async(to,text)=>sent.push(text)};
 const handlers=createIncomingHandlers({waitForMessagesMs:0,getConnection:()=>({client,isReady:()=>true}),request:async(route)=>{calls.push(route);throw Error('fixture failure')}});
 await handlers.incoming({from:'5511999999999@c.us',hasMedia:true,type:'ptt',body:'',id:{_serialized:'failure'},downloadMedia:async()=>({mimetype:'audio/ogg',data:'YWJj'})});
 assert.deepEqual(calls,['media']);assert.match(sent[0],/reenviar/);
});

test('a voice note still downloading is retried before sending it for transcription',async()=>{
 let downloads=0;const calls=[],sent=[],client={sendMessage:async(to,text)=>sent.push(text)};
 const handlers=createIncomingHandlers({waitForMessagesMs:0,getConnection:()=>({client,isReady:()=>true}),request:async(route,data)=>{calls.push(route);return route==='media'?{text:'Quero um bolo'}:{reply:'Claro!'}}});
 await handlers.incoming({from:'5511999999999@c.us',hasMedia:true,type:'ptt',body:'',id:{_serialized:'downloading'},downloadMedia:async()=>++downloads===1?undefined:{mimetype:'audio/ogg',data:'YWJj'}});
 assert.equal(downloads,2);assert.deepEqual(calls,['media','incoming']);assert.deepEqual(sent,['Claro!']);
});
test('automatic responses are not treated as human handovers',async()=>{const client={sendMessage:async()=>({})};const consume=trackAutomaticMessages(client);await client.sendMessage('5511999999999@c.us','Resposta automática');assert.equal(consume({to:'5511999999999@c.us',body:'Resposta automática'}),true);assert.equal(consume({to:'5511999999999@c.us',body:'Resposta humana'}),false)});
test('incoming messages resolve LID numbers, deduplicate events, and ignore groups',async()=>{const requests=[];const connection={isReady:()=>true,client:{sendMessage:async()=>({}),getContactLidAndPhone:async()=>[{lid:'123@lid',pn:'5511999999999@c.us'}]}};const handlers=createIncomingHandlers({waitForMessagesMs:0,request:async(route,data)=>{requests.push(data);return {reply:'Resposta'}},getConnection:()=>connection});handlers.prepareClient(connection.client);const msg={from:'123@lid',body:'Olá',id:{_serialized:'m1'},getContact:async()=>({number:'123',id:{server:'lid',user:'123'}})};await handlers.incoming(msg);await handlers.incoming(msg);await handlers.incoming({...msg,from:'123@g.us'});assert.equal(requests.length,1);assert.equal(requests[0].phone,'5511999999999');await handlers.created({fromMe:true,to:'123@lid',body:'Resposta',getContact:msg.getContact});assert.equal(requests.length,1);await handlers.created({fromMe:true,to:'123@lid',body:'Sou a atendente',getContact:msg.getContact});assert.equal(requests.at(-1).isFromMe,true)});
function fixture(){const directory=mkdtempSync(path.join(tmpdir(),'cca-bridge-'));let sends=0;const reports=[];return {directory,ledger:journal(directory),reports,get sends(){return sends},client:{getNumberId:async()=>({_serialized:'fixture@c.us'}),sendMessage:async()=>{sends++;return {id:{_serialized:'fixture-message'}}}},report:async r=>reports.push(r),close:()=>rmSync(directory,{recursive:true,force:true})}}

test('unresolved internal identifiers never become customer phone numbers',async()=>{
 const requests=[],client={sendMessage:async()=>({}),getContactLidAndPhone:async()=>[]};
 const handlers=createIncomingHandlers({waitForMessagesMs:0,getConnection:()=>({client,isReady:()=>true}),request:async(route,data)=>{requests.push(data);return {}}});
 await handlers.incoming({from:'12345678901234@lid',body:'Oi',getContact:async()=>({number:'12345678901234',id:{server:'lid',user:'12345678901234'}})});
 assert.equal(requests.length,0);
 await handlers.incoming({from:'5511999999999@c.us',body:'Oi',getContact:async()=>({number:'12345678901234'})});
 assert.equal(requests[0].phone,'5511999999999');
});
test('send once and acknowledge a repeated response without sending again',async()=>{const f=fixture();try{const deps={client:f.client,journal:f.ledger,report:f.report,ready:()=>true};await deliver(job,deps);await deliver({...job,resumed:true},deps);assert.equal(f.sends,1);assert.equal(f.reports[0].status,'sent');assert.equal(f.reports[1].messageId,'fixture-message')}finally{f.close()}});
test('restart restores journal and never duplicates a completed send',async()=>{const f=fixture();try{await deliver(job,{client:f.client,journal:f.ledger,report:f.report,ready:()=>true});await deliver({...job,resumed:true},{client:f.client,journal:journal(f.directory),report:f.report,ready:()=>true});assert.equal(f.sends,1)}finally{f.close()}});
test('crash after start is reported as uncertain',async()=>{const f=fixture();try{f.ledger.put(job.id,{...job,status:'started'});await deliver({...job,resumed:true},{client:f.client,journal:f.ledger,report:f.report,ready:()=>true});assert.equal(f.sends,0);assert.equal(f.reports[0].status,'uncertain')}finally{f.close()}});
test('lost initial claim response cannot cause a blind resend',async()=>{const f=fixture();try{await deliver({...job,resumed:true},{client:f.client,journal:f.ledger,report:f.report,ready:()=>true});assert.equal(f.sends,0);assert.equal(f.reports[0].status,'uncertain')}finally{f.close()}});
test('send error is uncertain and retry only reports its result',async()=>{const f=fixture();let calls=0;try{f.client.sendMessage=async()=>{calls++;throw Error('Disconnected after send')};const deps={client:f.client,journal:f.ledger,report:f.report,ready:()=>true};await deliver(job,deps);await deliver({...job,resumed:true},deps);assert.equal(calls,1);assert.equal(f.reports[0].status,'uncertain')}finally{f.close()}});
test('unknown recipient is a failed send, without sending',async()=>{const f=fixture();try{f.client.getNumberId=async()=>null;await deliver(job,{client:f.client,journal:f.ledger,report:f.report,ready:()=>true});assert.equal(f.sends,0);assert.equal(f.reports[0].status,'failed')}finally{f.close()}});
test('network loss while acknowledging keeps the successful local record',async()=>{const f=fixture();try{await assert.rejects(deliver(job,{client:f.client,journal:f.ledger,report:async()=>{throw Error('offline')},ready:()=>true}));await deliver({...job,resumed:true},{client:f.client,journal:f.ledger,report:f.report,ready:()=>true});assert.equal(f.sends,1);assert.equal(f.reports[0].status,'sent')}finally{f.close()}});
test('disconnected client never sends',async()=>{const f=fixture();try{await deliver(job,{client:f.client,journal:f.ledger,report:f.report,ready:()=>false});assert.equal(f.sends,0)}finally{f.close()}});
test('QR, authenticated, ready and logout follow actual Client events',async()=>{let logouts=0,destroys=0;const client=new EventEmitter();client.initialize=async()=>{};client.logout=async()=>{logouts++};client.destroy=async()=>{destroys++};client.info={wid:{user:'5511999999999'}};const manager=new Connection(()=>client);await manager.command('connected',1);client.emit('qr','fixture-qr');assert.equal(manager.snapshot().qr,'fixture-qr');assert.equal(manager.isReady(),false);client.emit('authenticated');assert.equal(manager.snapshot().qr,'');client.emit('ready');assert.equal(manager.isReady(),true);assert.equal(manager.snapshot().phone,'5511999999999');await manager.command('disconnected',2);await manager.stopping;assert.equal(manager.isReady(),false);assert.equal(logouts,1);assert.ok(destroys>=1)});

test('long replies preserve complete payment links and send typing before each part',async()=>{
 const {messageParts,sendConversationalReply}=await import('./response-presentation.mjs');
 const link='https://local.test/encomenda/fixture?access='+'a'.repeat(64),text='Oi, Ana! 💕\n\n'+('Uma explicação sobre sua encomenda. '.repeat(15))+'\n\nTotal: R$ 150,00\n'+link;
 const parts=messageParts(text);assert.ok(parts.length>1);assert.ok(parts.some(part=>part.includes(link)));assert.equal(parts.join(' ').replace(/\s+/g,' ').trim(),text.replace(/\s+/g,' ').trim());
 const events=[],chat={sendStateTyping:async()=>events.push('typing'),clearState:async()=>events.push('clear')};
 await sendConversationalReply({getChatById:async()=>chat,sendMessage:async(to,value)=>events.push(value)},'fixture',text,{sleep:async()=>events.push('delay')});
 assert.deepEqual(events,parts.flatMap(part=>['typing','delay',part,'clear']));
});
test('typing failures do not block delivery and disconnect cancels remaining parts',async()=>{
 const {sendConversationalReply}=await import('./response-presentation.mjs');let ready=true;const sent=[];
 await sendConversationalReply({getChatById:async()=>({sendStateTyping:async()=>{throw Error('unavailable')},clearState:async()=>{}}),sendMessage:async(to,value)=>{sent.push(value);ready=false}},'fixture','a '.repeat(300),{sleep:async()=>{},allowed:()=>ready});assert.equal(sent.length,1);
});

test('separates short ideas like Padrao MF but keeps order summaries together',async()=>{
 const {messageParts}=await import('./response-presentation.mjs');
 assert.deepEqual(messageParts('Oi, Ana! 💕\n\nFaça sua encomenda por aqui 💕\nhttps://local.test/encomendas\n\nSe não conseguir, eu te ajudo por aqui.'),['Oi, Ana! 💕','Faça sua encomenda por aqui 💕','https://local.test/encomendas','Se não conseguir, eu te ajudo por aqui.']);
 assert.deepEqual(messageParts('Fazemos sim. Qual recheio você prefere?'),['Fazemos sim.','Qual recheio você prefere?']);
 const summary='*Confere sua encomenda* 🍰\n'+('Detalhes do pedido. '.repeat(50));assert.deepEqual(messageParts(summary),[summary.trim()]);
});

test('native location with media thumbnail bypasses image download and reaches server',async()=>{
 const calls=[],sent=[],client={sendMessage:async(to,text)=>sent.push(text)};
 const h=createIncomingHandlers({waitForMessagesMs:0,getConnection:()=>({client,isReady:()=>true}),request:async(route,data)=>{calls.push({route,data});return {reply:'Recebi a localização'}}});
 await h.incoming({from:'5511999999999@c.us',type:'location',hasMedia:true,body:'',id:{_serialized:'loc-media'},location:{latitude:-9.4,longitude:-40.5},downloadMedia:async()=>{throw Error('Must not download location')}});
 assert.equal(calls.length,1);assert.equal(calls[0].route,'incoming');assert.deepEqual(calls[0].data.location,{lat:-9.4,lng:-40.5});assert.deepEqual(sent,['Recebi a localização']);
});
test('failed incoming request produces a recoverable message instead of silence',async()=>{
 const sent=[],client={sendMessage:async(to,text)=>sent.push(text)};const h=createIncomingHandlers({waitForMessagesMs:0,getConnection:()=>({client,isReady:()=>true}),request:async()=>{const e=Error('bad input');e.status=422;throw e}});
 await h.incoming({from:'5511999999999@c.us',type:'chat',body:'oi',id:{_serialized:'fail-reply'}});assert.ok(sent.length>=1);assert.match(sent.join(' '),/Não consegui concluir/);
});
