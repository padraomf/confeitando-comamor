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
 async first(){return sql.prepare(this.q).get(...this.v)||null}async all(){return {results:sql.prepare(this.q).all(...this.v)}}async run(){return sql.prepare(this.q).run(...this.v)}
}
globalThis.__aiEnv={APP_SECRET:'fixture-only',OPENAI_API_KEY:'fixture-only',DB:{prepare:q=>new Statement(q)}};
await esbuild.build({stdin:{contents:"export * from './lib/openai-service'; export * from './lib/whatsapp-budget-flow'; export * from './lib/whatsapp-customers'; export {putSetting,saveSecrets} from './lib/server';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'ai.mjs'),logLevel:'silent',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='env'?'export const env=globalThis.__aiEnv':'export async function getChatGPTUser(){return null}',loader:'js'}))}}]});
const ai=await import(pathToFileURL(path.join(dir,'ai.mjs')).href);
const fetchOriginal=globalThis.fetch;
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
const fullDraft={name:'Cliente Teste',date:'2099-12-20T15:00',cake:true,slices:20,sweets:false,cakeFlavor:'Chocolate',description:'Tema jardim com flores coloridas',delivery:'pickup'};
test('a partial custom order does not create a request or ask for confirmation',async()=>{
 assert.equal(await ai.saveWhatsAppDraft(draftPhone,{cake:true,date:'2099-12-20T15:00'}),null);
 assert.equal((await ai.getWhatsAppDraft(draftPhone)).awaiting_confirmation,0);
 assert.equal(await ai.confirmWhatsAppBudget(draftPhone,'sim'),null);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM budgets').get().n,0);
});
test('complete details produce a deterministic summary before saving',async()=>{
 const summary=await ai.saveWhatsAppDraft(draftPhone,fullDraft);
 assert.match(summary,/20 fatias/);assert.match(summary,/20\/12\/2099 às 15:00/);assert.match(summary,/Posso registrar/);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM budgets').get().n,0);
 assert.equal(await ai.confirmWhatsAppBudget(draftPhone,'sim, mas quero mudar o sabor'),null);
});
test('explicit confirmation registers one request and retry cannot duplicate it',async()=>{
 const reply=await ai.confirmWhatsAppBudget(draftPhone,'Sim!');assert.match(reply,/Registrei sua solicitação #E-/);
 const row=sql.prepare('SELECT * FROM budgets WHERE user_id=?').get('whatsapp:'+draftPhone);assert.equal(row.status,'Recebido');assert.equal(JSON.parse(row.data).phone,'11777777777');assert.equal(JSON.parse(row.data).source,'whatsapp');
 assert.doesNotMatch(reply,/https?:/);assert.equal(JSON.parse(row.data).offer,undefined);
 const retry=await ai.confirmWhatsAppBudget(draftPhone,'confirmo');assert.match(retry,/já está registrada/);assert.equal(sql.prepare('SELECT COUNT(*) n FROM budgets').get().n,1);
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
 const result=await ai.processIncomingWhatsApp({phone,text:'Quero encomendar um bolo de chocolate de 20 fatias para a festa.',isFromMe:false,domain:'https://local.test'});
 assert.match(result.reply,/Posso registrar/);assert.doesNotMatch(result.reply,/"draft"/);assert.equal(sql.prepare('SELECT COUNT(*) n FROM budgets').get().n,1);
 const confirmed=await ai.processIncomingWhatsApp({phone,text:'Pode registrar',isFromMe:false,domain:'https://local.test'});assert.match(confirmed.reply,/Registrei sua solicitação/);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM budgets').get().n,2);
});

test('new contact is asked for a name before any link or registration',async()=>{
 const result=await ai.processIncomingWhatsApp({phone:'5511222222222',text:'Oi! Quero um bolo.',senderName:'Nome de exibição',isFromMe:false,domain:'https://local.test'});
 assert.match(result.reply,/Como você se chama/);assert.doesNotMatch(result.reply,/https?:/);
 assert.equal(await ai.findWhatsAppCustomer('5511222222222'),null);
});
test('name capture confirms the actual sending number and never accepts a replacement number',async()=>{
 const phone='5511222222222';globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({reply:'Prazer!',draft:null,customerName:'Ana Teste'})}}]});
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
