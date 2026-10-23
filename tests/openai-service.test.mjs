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
await esbuild.build({stdin:{contents:"export * from './lib/openai-service'; export {putSetting,saveSecrets} from './lib/server';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'ai.mjs'),logLevel:'silent',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='env'?'export const env=globalThis.__aiEnv':'export async function getChatGPTUser(){return null}',loader:'js'}))}}]});
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
