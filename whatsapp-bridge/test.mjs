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
import {trackAutomaticMessages,createIncomingHandlers} from './incoming.mjs';
const job={id:'fixture-order-cliente',leaseToken:'a'.repeat(64),phone:'5511999999999',text:'Pedido fictício',resumed:false};

test('voice notes without text and reference photos with captions use the media endpoint',async()=>{
 const calls=[],sent=[],client={sendMessage:async(to,text)=>sent.push(text)};
 const handlers=createIncomingHandlers({getConnection:()=>({client,isReady:()=>true}),request:async(route,data)=>{calls.push({route,data});return route==='media'?{text:data.get('kind')==='audio'?'Quero um bolo':'Bolo com flores'}:{reply:'Entendi!'}}});
 const base={from:'5511999999999@c.us',hasMedia:true,body:'',type:'ptt',id:{_serialized:'voice'},downloadMedia:async()=>({mimetype:'audio/ogg; codecs=opus',data:Buffer.from('OggS-fixture').toString('base64')})};
 await handlers.incoming(base);assert.equal(calls[0].route,'media');assert.equal(calls[1].data.text,'Quero um bolo');
 await handlers.incoming({...base,type:'image',body:'Quero em azul',id:{_serialized:'photo'}});assert.equal(calls[2].data.get('kind'),'image');assert.match(calls[3].data.text,/Quero em azul/);assert.equal(sent.length,2);
 await handlers.incoming({...base,isViewOnce:true,id:{_serialized:'private'}});assert.equal(calls.length,4);assert.match(sent.at(-1),/foto comum/);
});

test('media failures ask for a resend and never invent a transcription',async()=>{
 const sent=[],calls=[],client={sendMessage:async(to,text)=>sent.push(text)};
 const handlers=createIncomingHandlers({getConnection:()=>({client,isReady:()=>true}),request:async(route)=>{calls.push(route);throw Error('fixture failure')}});
 await handlers.incoming({from:'5511999999999@c.us',hasMedia:true,type:'ptt',body:'',id:{_serialized:'failure'},downloadMedia:async()=>({mimetype:'audio/ogg',data:'YWJj'})});
 assert.deepEqual(calls,['media']);assert.match(sent[0],/reenviar/);
});
test('automatic responses are not treated as human handovers',async()=>{const client={sendMessage:async()=>({})};const consume=trackAutomaticMessages(client);await client.sendMessage('5511999999999@c.us','Resposta automática');assert.equal(consume({to:'5511999999999@c.us',body:'Resposta automática'}),true);assert.equal(consume({to:'5511999999999@c.us',body:'Resposta humana'}),false)});
test('incoming messages resolve LID numbers, deduplicate events, and ignore groups',async()=>{const requests=[];const connection={isReady:()=>true,client:{sendMessage:async()=>({}),getContactLidAndPhone:async()=>[{lid:'123@lid',pn:'5511999999999@c.us'}]}};const handlers=createIncomingHandlers({request:async(route,data)=>{requests.push(data);return {reply:'Resposta'}},getConnection:()=>connection});handlers.prepareClient(connection.client);const msg={from:'123@lid',body:'Olá',id:{_serialized:'m1'},getContact:async()=>({number:'123',id:{server:'lid',user:'123'}})};await handlers.incoming(msg);await handlers.incoming(msg);await handlers.incoming({...msg,from:'123@g.us'});assert.equal(requests.length,1);assert.equal(requests[0].phone,'5511999999999');await handlers.created({fromMe:true,to:'123@lid',body:'Resposta',getContact:msg.getContact});assert.equal(requests.length,1);await handlers.created({fromMe:true,to:'123@lid',body:'Sou a atendente',getContact:msg.getContact});assert.equal(requests.at(-1).isFromMe,true)});
function fixture(){const directory=mkdtempSync(path.join(tmpdir(),'cca-bridge-'));let sends=0;const reports=[];return {directory,ledger:journal(directory),reports,get sends(){return sends},client:{getNumberId:async()=>({_serialized:'fixture@c.us'}),sendMessage:async()=>{sends++;return {id:{_serialized:'fixture-message'}}}},report:async r=>reports.push(r),close:()=>rmSync(directory,{recursive:true,force:true})}}

test('unresolved internal identifiers never become customer phone numbers',async()=>{
 const requests=[],client={sendMessage:async()=>({}),getContactLidAndPhone:async()=>[]};
 const handlers=createIncomingHandlers({getConnection:()=>({client,isReady:()=>true}),request:async(route,data)=>{requests.push(data);return {}}});
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
