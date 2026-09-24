import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeJSON} from './storage.mjs';
const input=createInterface({input:stdin,output:stdout});
try{
 const defaultSite='https://confeitando-com-amor.ch4tgptpr0kotas.chatgpt.site';
 const site=new URL((await input.question('Endereço do site (Enter para usar a Confeitando com Amor): ')).trim()||defaultSite);
 if(site.protocol!=='https:'||site.username||site.password)throw Error('Use o endereço HTTPS público do seu site.');
 const code=(await input.question('Código de instalação gerado no painel: ')).trim();
 const response=await fetch(site.origin+'/api/bridge/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),redirect:'error',signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(!response.ok||!/^[a-f0-9]{64}$/.test(result.token||''))throw Error(result.error||'Não foi possível vincular o conector.');
 const directory=process.env.CCA_BRIDGE_DATA_DIR||'C:\\CCA_Bridge_Data';
 writeJSON(path.join(directory,'config.json'),{site:site.origin,token:result.token});
 console.log('Conector vinculado. Execute npm start, volte ao painel e clique em Conectar WhatsApp.');
}catch(error){console.error(error.message);process.exitCode=1}finally{input.close()}
