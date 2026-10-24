import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),esbuild=createRequire(require.resolve('vite/package.json'))('esbuild');
const dir=await mkdtemp(path.join(tmpdir(),'cca-ai-')),sql=new DatabaseSync(':memory:');
for(const file of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())sql.exec(await readFile('drizzle/'+file,'utf8'));
class Statement{
 constructor(q,v=[]){this.q=q;this.v=v}bind(...v){return new Statement(this.q,v)}
 async first(){return sql.prepare(this.q).get(...this.v)||null}async all(){return {results:sql.prepare(this.q).all(...this.v)}}async run(){const r=sql.prepare(this.q).run(...this.v);return {...r,meta:{changes:Number(r.changes)}}}
}
const mediaObjects=new Map();
globalThis.__aiEnv={BUCKET:{put:async(k,v)=>mediaObjects.set(k,v),delete:async k=>mediaObjects.delete(k)},APP_SECRET:'fixture-only',OPENAI_API_KEY:'fixture-only',DB:{prepare:q=>new Statement(q),async batch(queries){sql.exec('BEGIN');try{const results=[];for(const q of queries)results.push(await q.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}}};
await esbuild.build({stdin:{contents:"export * from './lib/whatsapp-location'; export * from './lib/openai-service'; export * from './lib/whatsapp-dates'; export * from './lib/whatsapp-sales'; export * from './lib/whatsapp-media'; export * from './lib/budget-links'; export {bridgeRoute,queueBudgetWhatsApp} from './lib/whatsapp-bridge'; export * from './lib/whatsapp-budget-flow'; export * from './lib/whatsapp-customers'; export {putSetting,saveSecrets} from './lib/server';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'ai.mjs'),logLevel:'silent',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='env'?'export const env=globalThis.__aiEnv':'export async function getChatGPTUser(){return null}',loader:'js'}))}}]});
const ai=await import(pathToFileURL(path.join(dir,'ai.mjs')).href);
const fetchOriginal=globalThis.fetch;

function mediaRequest(phone,kind,messageId,type,bytes){const form=new FormData();for(const [k,v] of Object.entries({phone,kind,messageId}))form.set(k,v);form.set('file',new Blob([bytes],{type}),'fixture');return new Request('https://local.test/api/bridge/media',{method:'POST',body:form})}

test('bridge rejects an unauthenticated media upload before parsing or calling OpenAI',async()=>{
 await assert.rejects(ai.bridgeRoute(new Request('https://local.test/api/bridge/media',{method:'POST',body:'invalid'}),'bridge/media',async()=>({})),e=>e.status===401);
});

test('audio is transcribed in Portuguese with its original OGG format and retries reuse it',async()=>{
 await ai.putSetting('store',JSON.stringify({whatsappEnabled:true,whatsappMode:'webjs'}));await ai.saveSecrets({openaiEnabled:'1'});
 let calls=0;globalThis.fetch=async(url,opts)=>{calls++;assert.ok(url.endsWith('/audio/transcriptions'));assert.equal(opts.body.get('language'),'pt');assert.equal(opts.body.get('file').name,'audio.ogg');return Response.json({text:'Quero um bolo de chocolate.'})};
 const request=()=>mediaRequest('5511900000011','audio','fixture-audio','audio/ogg; codecs=opus',new TextEncoder().encode('OggS-fixture'));
 const first=await ai.receiveWhatsAppMedia(request());assert.match(first.text,/bolo de chocolate/);assert.equal((await ai.receiveWhatsAppMedia(request())).id,first.id);assert.equal(calls,1);assert.equal(mediaObjects.size,0);
});

test('reference photos are private, described visually and attached to the confirmed request only',async()=>{
 globalThis.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);assert.equal(body.store,false);assert.match(body.messages[1].content[0].image_url.url,/^data:image\/png;base64,/);return Response.json({choices:[{message:{content:'Bolo rosa com flores amarelas.'}}]})};
 const phone='5511900000022',bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);
 await ai.receiveWhatsAppMedia(mediaRequest(phone,'image','fixture-photo','image/png',bytes));
 const refs=await ai.pendingReferences(phone);assert.equal(refs.length,1);assert.equal((await ai.pendingReferences('5511900000033')).length,0);assert.equal(mediaObjects.size,1);
 const draft={...fullDraft,name:'Teste Foto',referenceDeclined:false};assert.match(await ai.saveWhatsAppDraft(phone,draft),/Fotos de referência: 1/);
 const reply=await ai.confirmWhatsAppBudget(phone,'sim');assert.match(reply,/encomenda/);const row=sql.prepare('SELECT * FROM budgets WHERE user_id=?').get('whatsapp:'+phone);
 assert.deepEqual(JSON.parse(row.data).photos,[refs[0].id]);assert.equal(sql.prepare('SELECT budget_id FROM budget_attachments WHERE id=?').get(refs[0].id).budget_id,row.id);assert.equal((await ai.pendingReferences(phone)).length,0);
 const link=new URL(await ai.budgetCustomerLink(row.id));assert.equal((await ai.linkedBudget(row.id,link.searchParams.get('access'))).id,row.id);
 await assert.rejects(ai.linkedBudget(crypto.randomUUID(),link.searchParams.get('access')),e=>e.status===404);await assert.rejects(ai.linkedBudget(row.id,'f'.repeat(64)),e=>e.status===404);
 // This fixture is independent of the original conversation's budget count assertions.
 sql.prepare('DELETE FROM budget_attachments WHERE budget_id=?').run(row.id);sql.prepare('DELETE FROM budgets WHERE id=?').run(row.id);
});

test('a complete request asks for a reference before allowing confirmation, and accepts an explicit refusal',async()=>{
 const phone='5511900000044';assert.match(await ai.saveWhatsAppDraft(phone,{...fullDraft,referenceDeclined:false}),/foto de referência/);assert.equal(await ai.confirmWhatsAppBudget(phone,'sim'),null);assert.match(await ai.saveWhatsAppDraft(phone,{referenceDeclined:true}),/Posso enviar/);
});
test.after(async()=>{globalThis.fetch=fetchOriginal;sql.close();delete globalThis.__aiEnv;await rm(dir,{recursive:true,force:true})});
test('OpenAI uses compatible parameters and does not store conversations',async()=>{
 globalThis.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);assert.equal(body.temperature,undefined);assert.equal(body.reasoning_effort,'minimal');assert.equal(body.store,false);return Response.json({choices:[{message:{content:'Olá!'}}]})};
 assert.equal(await ai.callOpenAI({apiKey:'fixture',messages:[{role:'user',content:'Olá'}]}),'Olá!');
});
test('provider errors do not expose provider payloads',async()=>{
 globalThis.fetch=async()=>Response.json({error:{message:'private-provider-data',code:'quota'}},{status:429});
 await assert.rejects(ai.callOpenAI({apiKey:'fixture',messages:[]}),e=>!e.message.includes('private-provider-data')&&e.message.includes('429'));
});
test('only the WhatsApp owner can retrieve an order context',async()=>{
 sql.prepare('INSERT INTO orders(id,user_id,request_id,code,data,total,status,payment,payment_status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('ai-order','fixture-user','ai-request','AABBCCDD',JSON.stringify({profile:{phone:'11999999999'}}),1500,'Recebido','cash','Pagar na entrega',Date.now());
 assert.equal(await ai.lookupOrderContext('#AABBCCDD','5511888888888'),null);
 assert.match(await ai.lookupOrderContext('#AABBCCDD','5511999999999'),/Recebido/);
});
test('disabled WhatsApp cannot invoke the assistant',async()=>{
 await ai.putSetting('store',JSON.stringify({whatsappEnabled:false}));
 const r=await ai.processIncomingWhatsApp({phone:'5511999999999',text:'Olá',isFromMe:false,domain:'https://local.test'});assert.equal(r.action,'whatsapp_disabled');
});
test('a human reply pauses AI for thirty minutes',async()=>{
 await ai.putSetting('store',JSON.stringify({whatsappEnabled:true,whatsappMode:'webjs'}));
 const input={phone:'5511999999999',text:'Olá',domain:'https://local.test'};
 assert.equal((await ai.processIncomingWhatsApp({...input,isFromMe:true})).action,'human_takeover_started');
 assert.equal((await ai.processIncomingWhatsApp({...input,isFromMe:false})).action,'human_takeover_active');
});
test('knowledge uses current stock and canonical customer order URL',async()=>{
 sql.prepare('INSERT INTO products(id,name,description,price,category,image,active,demo,tag,created_at,sold_out,stock) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('ai-product','Doce teste','Chocolate artesanal',1500,'Bolos','/images/cake.jpg',1,0,'',Date.now(),1,5);
 const knowledge=await ai.buildSiteKnowledge('https://local.test');assert.match(knowledge,/Esgotado/);assert.match(knowledge,/https:\/\/local.test\/pedidos/);assert.doesNotMatch(knowledge,/meus-pedidos/);
});

test('answers contain at most one buying link and never the custom-order form',()=>{
 const reply=ai.conciseWhatsAppReply('Oi! https://loja.test/produto/a https://loja.test/produto/b https://loja.test/encomendas');
 assert.equal((reply.match(/https:\/\//g)||[]).length,1);assert.doesNotMatch(reply,/encomendas/);
});
const draftPhone='5511777777777';
const fullDraft={extrasConfirmed:true,referenceDeclined:true,name:'Cliente Teste',date:'2099-12-20T15:00',cake:true,slices:20,sweets:false,cakeFlavor:'Chocolate',description:'Tema jardim com flores coloridas',delivery:'pickup'};
test('a partial custom order does not create a request or ask for confirmation',async()=>{
 assert.equal(await ai.saveWhatsAppDraft(draftPhone,{cake:true,date:'2099-12-20T15:00'}),null);
 assert.equal((await ai.getWhatsAppDraft(draftPhone)).awaiting_confirmation,0);
 assert.equal(await ai.confirmWhatsAppBudget(draftPhone,'sim'),null);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM budgets').get().n,0);
});
test('complete details produce a deterministic summary before saving',async()=>{
 const summary=await ai.saveWhatsAppDraft(draftPhone,fullDraft);
 assert.match(summary,/20 fatias/);assert.match(summary,/20\/12\/2099 às 15:00/);assert.match(summary,/Posso enviar/);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM budgets').get().n,0);
 assert.equal(await ai.confirmWhatsAppBudget(draftPhone,'sim, mas quero mudar o sabor'),null);
});
test('explicit confirmation registers one request and retry cannot duplicate it',async()=>{
 const reply=await ai.confirmWhatsAppBudget(draftPhone,'Sim!');assert.match(reply,/Sua encomenda #E-/);
 const row=sql.prepare('SELECT * FROM budgets WHERE user_id=?').get('whatsapp:'+draftPhone);assert.equal(row.status,'Recebido');assert.equal(JSON.parse(row.data).phone,'11777777777');assert.equal(JSON.parse(row.data).source,'whatsapp');
 assert.ok(reply.includes('/encomenda/'));assert.equal(JSON.parse(row.data).offer,undefined);
 const retry=await ai.confirmWhatsAppBudget(draftPhone,'confirmo');assert.match(retry,/já foi enviada/);assert.equal(sql.prepare('SELECT COUNT(*) n FROM budgets').get().n,1);
});
test('past dates, missing flavors and missing delivery addresses cannot be finalized',async()=>{
 assert.equal(await ai.saveWhatsAppDraft('5511666666666',{...fullDraft,date:'2020-01-01T12:00'}),null);
 assert.equal(await ai.saveWhatsAppDraft('5511555555555',{...fullDraft,cakeFlavor:null}),null);
 assert.equal(await ai.saveWhatsAppDraft('5511444444444',{...fullDraft,delivery:'delivery',address:{city:'Juazeiro',state:'BA'}}),null);
 assert.equal(await ai.confirmWhatsAppBudget('5511444444444','sim'),null);
});
test('conversation extracts details and returns the summary without leaking JSON',async()=>{
 const phone='5511333333333';
 sql.prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').run('whatsapp:'+phone,JSON.stringify({name:'Cliente Teste',phone:'11333333333'}),Date.now());
 globalThis.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);assert.equal(body.response_format.type,'json_object');assert.match(body.messages[0].content,/no máximo UM link/);return Response.json({choices:[{message:{content:JSON.stringify({reply:'Vamos conferir?',draft:fullDraft})}}]})};
 const result=await ai.processIncomingWhatsApp({phone,text:'Não consegui encomendar pelo site. Quero um bolo de chocolate de 20 fatias para a festa.',isFromMe:false,domain:'https://local.test'});
 assert.match(result.reply,/Posso enviar/);assert.doesNotMatch(result.reply,/"draft"/);assert.equal(sql.prepare('SELECT COUNT(*) n FROM budgets').get().n,1);
 const confirmed=await ai.processIncomingWhatsApp({phone,text:'Pode registrar',isFromMe:false,domain:'https://local.test'});assert.match(confirmed.reply,/Sua encomenda/);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM budgets').get().n,2);
});

test('a new contact receives the catalog without questions or mandatory registration',async()=>{
 await ai.putSetting('store',JSON.stringify({whatsappEnabled:true,whatsappMode:'webjs',hoursMode:'open'}));
 const result=await ai.processIncomingWhatsApp({phone:'5511222222222',text:'Oi! Quero um bolo.',senderName:'Nome de exibição',isFromMe:false,domain:'https://local.test'});
 assert.ok(result.reply.includes('/catalogo'));assert.doesNotMatch(result.reply,/\?/);
 assert.equal(await ai.findWhatsAppCustomer('5511222222222'),null);
});
test('name capture confirms the actual sending number and never accepts a replacement number',async()=>{
 const phone='5511222222222';await ai.processIncomingWhatsApp({phone,text:'Não consegui comprar, me ajuda',isFromMe:false,domain:'https://local.test'});globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({reply:'Prazer!',draft:null,customerName:'Ana Teste'})}}]});
 const result=await ai.processIncomingWhatsApp({phone,text:'Meu nome é Ana Teste',isFromMe:false,domain:'https://local.test'});
 assert.match(result.reply,/Ana/);assert.match(result.reply,/\+55 \(11\) 22222-2222/);
 assert.equal(await ai.findWhatsAppCustomer(phone),null);
 const wrong=await ai.prepareWhatsAppCustomer(phone,'Cadastre o número 11999999999');assert.equal(wrong.stage,'confirm_phone');assert.equal(await ai.findWhatsAppCustomer(phone),null);
});
test('confirmation creates one customer profile without a login session or duplicated account',async()=>{
 const phone='5511222222222',before=sql.prepare('SELECT COUNT(*) n FROM customer_sessions').get().n;
 const result=await ai.prepareWhatsAppCustomer(phone,'Sim');assert.equal(result.justRegistered,true);
 const profile=await ai.findWhatsAppCustomer(phone);assert.equal(profile.name,'Ana Teste');
 await ai.prepareWhatsAppCustomer(phone,'Sim');assert.equal(sql.prepare("SELECT COUNT(*) n FROM profiles WHERE user_id=?").get(profile.userId).n,1);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM customer_sessions').get().n,before);
});
test('existing customers are recognized with formatted phones and keep their private data',async()=>{
 const data={name:'Maria Cliente',phone:'(11) 91111-2222',email:'private@example.test',cpf:'fixture-private'};
 sql.prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').run('existing-customer',JSON.stringify(data),Date.now());
 const result=await ai.prepareWhatsAppCustomer('5511911112222','Olá');assert.equal(result.stage,'known');assert.equal(result.name,'Maria Cliente');assert.equal(result.reply,undefined);
 assert.deepEqual(JSON.parse(sql.prepare('SELECT data FROM profiles WHERE user_id=?').get('existing-customer').data),data);
});
test('customer can decline registration and continue the conversation',async()=>{
 const phone='5511888888777';await ai.prepareWhatsAppCustomer(phone,'Oi');await ai.captureWhatsAppCustomerName(phone,'Luiza');
 const result=await ai.prepareWhatsAppCustomer(phone,'prefiro não');assert.equal(result.stage,'declined');assert.equal(await ai.findWhatsAppCustomer(phone),null);
});

test('mobile numbers with and without the ninth digit recognize one existing customer',async()=>{
 sql.prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').run('ninth-digit-customer',JSON.stringify({name:'Cliente Existente',phone:'(74) 99920-4407'}),Date.now());
 assert.equal((await ai.findWhatsAppCustomer('557499204407')).userId,'ninth-digit-customer');
 assert.equal((await ai.prepareWhatsAppCustomer('557499204407','Olá')).stage,'known');
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM profiles WHERE user_id=?').get('ninth-digit-customer').n,1);
 sql.prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').run('old-format-customer',JSON.stringify({name:'Outro Cliente',phone:'7498812345'}),Date.now());
 assert.equal((await ai.findWhatsAppCustomer('5574998812345')).userId,'old-format-customer');
});

test('ambiguous old-format numbers are not assigned to the wrong customer',async()=>{
 for(const id of ['ambiguous-one','ambiguous-two'])sql.prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').run(id,JSON.stringify({name:'Teste',phone:'7488812345'}),Date.now());
 assert.equal(await ai.findWhatsAppCustomer('5574988812345'),null);
});

test('a WhatsApp sale uses the real checkout and creates one order only after confirmation',async()=>{
 await ai.putSetting('store',JSON.stringify({whatsappEnabled:false,open:true,hoursMode:'open',pickup:true,storeAddress:'Rua Teste, 20',cash:true,pixKey:'11999999999',pixName:'TESTE',pixCity:'SAO PAULO'}));
 await ai.saveSecrets({openaiEnabled:'1'});
 sql.prepare('INSERT INTO products(id,name,description,price,category,image,active,demo,tag,created_at,stock) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('sale-slice','Fatia Brigadeiro','Bolo de chocolate com brigadeiro',1700,'Bolos','/images/brownies.jpg',1,0,'',Date.now(),8);
 const phone='5511955555555',userId='whatsapp:'+phone;
 sql.prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').run(userId,JSON.stringify({name:'Cliente Venda',phone:phone.slice(2),email:'',cpf:''}),Date.now());
 const first=await ai.saveWhatsAppSale(phone,{items:[{id:'sale-slice',quantity:2}]},'https://local.test');assert.match(first,/retirar.*entrega/);assert.equal(await ai.confirmWhatsAppSale(phone,'sim','https://local.test'),null);
 assert.match(await ai.saveWhatsAppSale(phone,{delivery:'pickup'},'https://local.test'),/Como deseja pagar/);
 const summary=await ai.saveWhatsAppSale(phone,{payment:'pix'},'https://local.test');assert.match(summary,/34,00/);assert.match(summary,/Posso confirmar/);assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders WHERE user_id=?').get(userId).n,0);
 const reply=await ai.confirmWhatsAppSale(phone,'sim','https://local.test');assert.match(reply,/Seu pedido #[A-F0-9]+ foi criado/);assert.match(reply,/Falta concluir o pagamento/);assert.match(reply,/\/acompanhar\//);
 const row=sql.prepare('SELECT * FROM orders WHERE user_id=?').get(userId);assert.equal(row.total,3400);assert.equal(row.payment_status,'Aguardando pagamento');assert.equal(sql.prepare('SELECT stock FROM products WHERE id=?').get('sale-slice').stock,6);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM customer_sessions WHERE actor_id=?').get(userId).n,0);
 assert.match(await ai.confirmWhatsAppSale(phone,'sim','https://local.test'),/Seu pedido/);assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders WHERE user_id=?').get(userId).n,1);assert.equal(sql.prepare('SELECT stock FROM products WHERE id=?').get('sale-slice').stock,6);
});

test('a price change requires a new summary and confirmation instead of charging the old value',async()=>{
 const phone='5511944444444';sql.prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').run('whatsapp:'+phone,JSON.stringify({name:'Cliente Preço',phone:phone.slice(2)}),Date.now());
 await ai.saveWhatsAppSale(phone,{items:[{id:'sale-slice',quantity:1}],delivery:'pickup',payment:'cash'},'https://local.test');
 sql.prepare('UPDATE products SET price=1800 WHERE id=?').run('sale-slice');
 const reply=await ai.confirmWhatsAppSale(phone,'sim','https://local.test');assert.match(reply,/Precisamos revisar/);assert.match(reply,/18,00/);assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders WHERE user_id=?').get('whatsapp:'+phone).n,0);
});

test('delivery waits for a real WhatsApp location and stock shortages cannot produce a summary',async()=>{
 const phone='5511933333333';sql.prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').run('whatsapp:'+phone,JSON.stringify({name:'Cliente Entrega',phone:phone.slice(2)}),Date.now());
 const reply=await ai.saveWhatsAppSale(phone,{items:[{id:'sale-slice',quantity:1}],delivery:'delivery',payment:'cash',address:{cep:'01000000',street:'Rua Teste',number:'20',district:'Centro',city:'São Paulo',state:'SP'}},'https://local.test');assert.match(reply,/[Mm]anda a localização/);assert.equal((await ai.getWhatsAppSale(phone)).awaiting_confirmation,0);
 assert.match(await ai.saveWhatsAppSale(phone,{items:[{id:'sale-slice',quantity:30}]},'https://local.test'),/esgotou|quantidade/);assert.equal((await ai.getWhatsAppSale(phone)).awaiting_confirmation,0);
});

test('delivery uses the same route quote and exact confirmed location as website checkout',async()=>{
 await ai.putSetting('store',JSON.stringify({whatsappEnabled:false,open:true,hoursMode:'open',pickup:true,storeAddress:'Rua Teste, 20',cash:true,lat:-23.55,lng:-46.63,maxKm:15,baseFee:300,perKm:200}));
 globalThis.fetch=async url=>{assert.match(String(url),/router\.project-osrm\.org\/route/);return Response.json({routes:[{distance:1000}]})};
 const phone='5511922222222',userId='whatsapp:'+phone;sql.prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').run(userId,JSON.stringify({name:'Cliente Localização',phone:phone.slice(2)}),Date.now());
 const location={lat:-23.56,lng:-46.64},summary=await ai.saveWhatsAppSale(phone,{items:[{id:'sale-slice',quantity:1}],delivery:'delivery',payment:'cash',address:{cep:'01000000',street:'Rua Teste',number:'20',district:'Centro',city:'São Paulo',state:'SP'}},'https://local.test',location);
 assert.match(summary,/frete R\$\s*5,00/);assert.match(summary,/23,00/);
 assert.match(await ai.confirmWhatsAppSale(phone,'finaliza pra mim','https://local.test'),/Seu pedido/);
 const row=sql.prepare('SELECT data,total FROM orders WHERE user_id=?').get(userId);assert.equal(row.total,2300);assert.equal(JSON.parse(row.data).fee,500);assert.deepEqual(JSON.parse(row.data).address.location,{...location,source:'pin',confirmed:true});
});

test('a closed store announces custom orders in the first greeting, without repeating on every message',async()=>{
 await ai.putSetting('store',JSON.stringify({whatsappEnabled:true,whatsappMode:'webjs',hoursMode:'closed',budgetWhenClosed:true}));await ai.saveSecrets({openaiEnabled:'1'});
 const phone='5511911111122',input={phone,isFromMe:false,domain:'https://local.test'};
 const first=await ai.processIncomingWhatsApp({...input,text:'Olá'});assert.ok(first.reply.startsWith('*Loja fechada no momento.*'));assert.match(first.reply,/apenas encomendas/);assert.ok(first.reply.includes('/encomendas'));assert.ok(!first.reply.includes('/catalogo'));assert.doesNotMatch(first.reply,/\?/);
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({reply:'Como posso chamar você?',draft:null,customerName:'Ana Teste'})}}]});
 await ai.processIncomingWhatsApp({...input,text:'Não consegui encomendar, me ajuda'});
 const second=await ai.processIncomingWhatsApp({...input,text:'Ana Teste'});assert.doesNotMatch(second.reply,/Loja fechada no momento/);assert.match(second.reply,/Posso usar este número/);
 sql.prepare('UPDATE whatsapp_chats SET updated_at=? WHERE phone=?').run(Date.now()-5*3600000,phone);
 const nextVisit=await ai.processIncomingWhatsApp({...input,text:'Olá de novo'});assert.ok(nextVisit.reply.startsWith('*Loja fechada no momento.*'));
 const human=await ai.processIncomingWhatsApp({...input,text:'Resposta da loja',isFromMe:true});assert.equal(human.reply,null);
});

test('Brazilian dates use the current store year and weekdays are resolved without guessing',()=>{
 const now=Date.parse('2026-10-23T15:00:00Z'),tz='America/Sao_Paulo';
 assert.equal(ai.resolveWhatsAppDate('próximo domingo',tz,undefined,now).date,'2026-10-25');
 assert.equal(ai.resolveWhatsAppDate('25/10 12h',tz,undefined,now).date,'2026-10-25T12:00');
 assert.equal(ai.resolveWhatsAppDate('25/10 12h',tz,undefined,now).past,false);
 assert.equal(ai.resolveWhatsAppDate('12h',tz,'2026-10-25',now).date,'2026-10-25T12:00');
 assert.equal(ai.resolveWhatsAppDate('amanhã às 14:30',tz,undefined,now).date,'2026-10-24T14:30');
 assert.equal(ai.resolveWhatsAppDate('31/02',tz,undefined,now).invalid,true);
 assert.equal(ai.resolveWhatsAppDate('22/10',tz,undefined,now).past,true);
});

test('unknown fields cannot erase date, cake choice or size already supplied by the customer',async()=>{
 const phone='5511900000088';await ai.saveWhatsAppDraft(phone,{cake:true,slices:20,date:'2099-12-20T12:00'});
 await ai.saveWhatsAppDraft(phone,{cake:null,slices:null,date:null,sweets:false});
 const data=JSON.parse((await ai.getWhatsAppDraft(phone)).draft);assert.equal(data.date,'2099-12-20T12:00');assert.equal(data.cake,true);assert.equal(data.slices,20);assert.equal(data.sweets,false);
});

test('a fresh greeting does not revive an old slice purchase, and a date advances the cake conversation',async()=>{
 await ai.putSetting('store',JSON.stringify({whatsappEnabled:true,whatsappMode:'webjs',hoursMode:'closed',budgetWhenClosed:true}));
 const phone='5511900000077',userId='whatsapp:'+phone,input={phone,isFromMe:false,domain:'https://local.test'};
 sql.prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').run(userId,JSON.stringify({name:'Maciel Teste',phone:phone.slice(2)}),Date.now());
 sql.prepare('INSERT INTO whatsapp_chats(phone,history,handover_until,updated_at) VALUES(?,?,0,?)').run(phone,JSON.stringify([{role:'user',content:'quero fatia brigadeiro'},{role:'assistant',content:'Até mais!'}]),Date.now()-3600000);
 const greeting=await ai.processIncomingWhatsApp({...input,text:'oi'});assert.doesNotMatch(greeting.reply,/sua fatia|seu pedido.*brigadeiro/i);
 await ai.saveWhatsAppDraft(phone,{cake:true});
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({reply:'Essa data já passou.',draft:{date:null,cake:null,slices:null}})}}]});
 const year=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date()).slice(0,4);
 const response=await ai.processIncomingWhatsApp({...input,text:'Não consegui encomendar pelo site. 31/12 12h'});assert.match(response.reply,/12, 20 ou 30 fatias/);assert.doesNotMatch(response.reply,/passou|qual data/i);assert.equal(JSON.parse((await ai.getWhatsAppDraft(phone)).draft).date,year+'-12-31T12:00');
});

test('product links come first and assisted checkout starts only after a customer asks for help',async()=>{
 await ai.putSetting('store',JSON.stringify({whatsappEnabled:true,whatsappMode:'webjs',hoursMode:'open',open:true,pickup:true,storeAddress:'Rua Teste, 20',cash:true}));
 const phone='5511900000066',input={phone,isFromMe:false,domain:'https://local.test'};
 sql.prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').run('whatsapp:'+phone,JSON.stringify({name:'Cliente Link',phone:phone.slice(2)}),Date.now());
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({reply:'Vamos concluir seu pedido.',draft:null,sale:{items:[{id:'sale-slice',quantity:1}],delivery:'pickup',payment:null}})}}]});
 const first=await ai.processIncomingWhatsApp({...input,text:'quero uma fatia brigadeiro'});assert.equal(first.action,'catalog_link');assert.match(first.reply,/\/produto\//);assert.equal(await ai.getWhatsAppSale(phone),null);
 const helped=await ai.processIncomingWhatsApp({...input,text:'não consegui comprar pelo link, faz o pedido pra mim'});assert.equal(helped.action,'sale_draft');assert.match(helped.reply,/Como deseja pagar/);assert.equal(JSON.parse((await ai.getWhatsAppSale(phone)).data).assisted,true);
});

test('the photo refusal flows to one optional question and then the confirmation summary',async()=>{
 const phone='5511900000055',userId='whatsapp:'+phone;
 sql.prepare('INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?)').run(userId,JSON.stringify({name:'Cliente Foto',phone:phone.slice(2)}),Date.now());
 const {slices,sweets,...base}=fullDraft;
 const initial={...base,quantity:1,referenceDeclined:false,extrasConfirmed:false};
 sql.prepare('INSERT INTO whatsapp_budget_drafts(phone,request_id,draft,awaiting_confirmation,budget_id,updated_at) VALUES(?,?,?,0,NULL,?)').run(phone,crypto.randomUUID(),JSON.stringify(initial),Date.now());
 sql.prepare('INSERT INTO whatsapp_chats(phone,history,handover_until,updated_at) VALUES(?,?,0,?)').run(phone,JSON.stringify([{role:'user',content:'30 fatias'},{role:'assistant',content:'Manda uma foto de referência, se tiver.'}]),Date.now());
 globalThis.fetch=async()=>{throw Error('These final steps should not need the model')};
 const input={phone,isFromMe:false,domain:'https://local.test'};
 const first=await ai.processIncomingWhatsApp({...input,text:'Não tem foto'});assert.equal(first.reply,'Quer acrescentar mais alguma coisa?');assert.equal((await ai.getWhatsAppDraft(phone)).awaiting_confirmation,0);
 const second=await ai.processIncomingWhatsApp({...input,text:'Não'});assert.match(second.reply,/30 fatias/);assert.match(second.reply,/Posso enviar/);assert.doesNotMatch(second.reply,/\/encomendas|complemento|frase no bolo/);assert.equal((await ai.getWhatsAppDraft(phone)).awaiting_confirmation,1);
 const third=await ai.processIncomingWhatsApp({...input,text:'Pode enviar'});assert.match(third.reply,/Sua encomenda.*foi enviada/);assert.match(third.reply,/analisar e te passar o valor/);
 const row=sql.prepare('SELECT data FROM budgets WHERE user_id=?').get(userId);assert.equal(JSON.parse(row.data).slices,30);assert.equal(JSON.parse(row.data).sweets,false);
});

test('WhatsApp messages turn escaped newlines into real paragraph breaks',()=>{
 assert.equal(ai.conciseWhatsAppReply(String.raw`Oi!\n\nTudo bem?`),'Oi!\n\nTudo bem?');
});

 test('custom delivery keeps the customer pin and quotes delivery separately from cake pricing',async()=>{
 await ai.putSetting('store',JSON.stringify({hoursMode:'closed',budgetWhenClosed:true,pickup:true,lat:-23.55,lng:-46.63,maxKm:15,baseFee:300,perKm:200}));
 globalThis.fetch=async url=>{assert.match(String(url),/router.project-osrm.org/);assert.ok(String(url).includes('-46.64,-23.56'));return Response.json({routes:[{distance:1000}]})};
 const phone='5511900000099',location={lat:-23.56,lng:-46.64};
 assert.equal(await ai.saveWhatsAppDraft(phone,{...fullDraft,delivery:'delivery'}),null);
 assert.match(await ai.nextWhatsAppBudgetQuestion(phone),/localização/);
 await ai.saveWhatsAppDraft(phone,{},location);assert.match(await ai.nextWhatsAppBudgetQuestion(phone),/endereço/);
 const summary=await ai.saveWhatsAppDraft(phone,{address:{cep:'01000000',street:'Rua Teste',number:'20',district:'Centro',city:'São Paulo',state:'SP'}});
 assert.match(summary,/Taxa de entrega: R\$\s*5,00/);assert.match(summary,/analisar/);
 await ai.confirmWhatsAppBudget(phone,'sim');const row=sql.prepare('SELECT data FROM budgets WHERE user_id=?').get('whatsapp:'+phone),data=JSON.parse(row.data);
 assert.deepEqual(data.address.location,{...location,source:'pin',confirmed:true});assert.equal(data.deliveryQuote.fee,500);
 });

test('closed catalog never schedules slices and open catalog does not accept future dates',async()=>{
 const input={phone:'5511900000100',isFromMe:false,domain:'https://local.test'};
 await ai.putSetting('store',JSON.stringify({whatsappEnabled:true,whatsappMode:'webjs',hoursMode:'closed',budgetWhenClosed:true}));
 const closed=await ai.processIncomingWhatsApp({...input,text:'quero uma fatia amanhã'});assert.equal(closed.action,'catalog_closed');assert.match(closed.reply,/encomendas/);assert.equal(await ai.getWhatsAppDraft(input.phone),null);
 await ai.putSetting('store',JSON.stringify({whatsappEnabled:true,whatsappMode:'webjs',hoursMode:'open'}));
 const future=await ai.processIncomingWhatsApp({...input,text:'quero uma sobremesa amanhã'});assert.equal(future.action,'catalog_not_scheduled');assert.equal(await ai.getWhatsAppDraft(input.phone),null);
});
test('map links only use explicit coordinates from supported map domains',()=>{
 assert.deepEqual(ai.whatsAppLocationLink('https://maps.google.com/?q=-23.56,-46.64'),{lat:-23.56,lng:-46.64});
 assert.equal(ai.whatsAppLocationLink('https://example.com/?q=-23.56,-46.64'),undefined);
 assert.equal(ai.whatsAppLocationLink('https://maps.google.com/?q=99,999'),undefined);
 assert.equal(ai.whatsAppLocationLink('https://maps.app.goo.gl/short'),undefined);
});
