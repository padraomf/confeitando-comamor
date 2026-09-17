import whatsapp from 'whatsapp-web.js';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readJSON,journal} from './storage.mjs';
import {Connection} from './connection.mjs';
import {deliver} from './delivery.mjs';

const {Client,LocalAuth}=whatsapp;
const directory=process.env.CCA_BRIDGE_DATA_DIR||path.join(path.dirname(fileURLToPath(import.meta.url)),'data');
const config=readJSON(path.join(directory,'config.json'));
if(!config?.token||!config?.site){console.error('Primeiro execute npm run setup e vincule este computador no painel.');process.exit(1)}
const site=new URL(config.site);
const runner=randomUUID(),ledger=journal(path.join(directory,'journal'));
const connection=new Connection(()=>new Client({
 authStrategy:new LocalAuth({clientId:'confeitando',dataPath:path.join(directory,'session')}),
 puppeteer:{headless:true,...process.env.CCA_CHROME_PATH?{executablePath:process.env.CCA_CHROME_PATH}:{},args:process.env.CCA_CONTAINER==='1'?['--no-sandbox','--disable-setuid-sandbox']:[]},
 webVersionCache:{type:'local',path:path.join(directory,'web-cache')},
 deviceName:'Confeitando com Amor',qrMaxRetries:10,takeoverOnConflict:false
}));
let stopping=false,handling=false,networkFailures=0,lastState='';
async function request(route,body){
 const response=await fetch(site.origin+'/api/bridge/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.token},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(!response.ok){const error=new Error(result.error||'Falha na comunicação com o site');error.status=response.status;throw error}return result;
}
async function tick(){
 try{
  const response=await request('heartbeat',{runner,...connection.snapshot()});networkFailures=0;
  await connection.command(response.desired,response.revision);
  if(connection.state!==lastState){console.log('WhatsApp:',connection.state,'· veja o painel da confeitaria.');lastState=connection.state}
  if(response.job&&!handling&&connection.isReady()){
   handling=true;
   void deliver(response.job,{client:connection.client,journal:ledger,ready:()=>connection.isReady(),report:result=>request('result',result)}).catch(()=>console.error('Resultado pendente; será conferido no próximo contato com o site.')).finally(()=>{handling=false});
  }
 }catch(error){
  if(error.status===401||error.status===409){console.error('Conector interrompido:',error.message);await shutdown();return}
  networkFailures++;if(networkFailures===1)console.error('Site indisponível. Aguardando reconexão; nenhum pedido será reenviado sem conferência.');
 }
}
async function shutdown(){if(stopping)return;stopping=true;await connection.stop(false);process.exit(0)}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
console.log('Conector em execução. Abra Conexões no painel para conectar pelo QR code.');
while(!stopping){await tick();await new Promise(resolve=>setTimeout(resolve,Math.min(30000,5000*Math.max(1,Math.min(networkFailures,6)))))}
