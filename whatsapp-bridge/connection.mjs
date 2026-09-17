// Client constructor is injected so lifecycle tests never connect real accounts.
import {rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=process.env.CCA_BRIDGE_DATA_DIR||path.join(path.dirname(fileURLToPath(import.meta.url)),'data');
export class Connection{
 constructor(createClient){this.createClient=createClient;this.client=null;this.state='disconnected';this.qr='';this.phone='';this.starting=null;this.stopping=null;this.lastAttempt=0;this.desired=false;this.revision=-1}
 snapshot(){return {state:this.state,qr:this.state==='qr'?this.qr:'',phone:this.phone}}
 async command(desired,revision){
  const changed=this.revision!==revision;this.revision=revision;this.desired=desired==='connected';
  if(!this.desired){if(this.client&&!this.stopping)this.stopping=this.stop(true).finally(()=>{this.stopping=null});return}
  if(this.stopping)return;
  if(changed&&['error','auth_failure','disconnected'].includes(this.state)&&this.client){await this.stop(false)}
  if(!this.client&&!this.starting&&(changed||Date.now()-this.lastAttempt>30000))this.start();
 }
 start(){
  this.lastAttempt=Date.now();this.state='starting';this.qr='';const client=this.createClient();this.client=client;
  const current=()=>this.client===client;
  client.on('qr',qr=>{if(current()){this.state='qr';this.qr=qr}});
  client.on('authenticated',()=>{if(current()){this.state='authenticated';this.qr=''}});
  client.on('ready',()=>{if(current()){this.state='ready';this.qr='';this.phone=client.info?.wid?.user||''}});
  client.on('auth_failure',()=>{if(current()){this.state='auth_failure';this.qr=''}});
  client.on('disconnected',()=>{if(current()){this.state='disconnected';this.qr='';void this.stop(false)}});
  this.starting=client.initialize().catch(()=>{if(current()){this.state='error';this.qr='';void this.stop(false,'error')}}).finally(()=>{this.starting=null;if(!current())void client.destroy().catch(()=>{})});
 }
 async stop(logout,state='disconnected'){
  const client=this.client;this.client=null;this.qr='';this.state=state;this.phone='';
  if(!client)return;
  if(logout){try{await client.logout()}catch{}}
  try{await client.destroy()}catch{}
  if(logout){try{await rm(path.join(directory,'session'),{recursive:true,force:true})}catch{}}
 }
 isReady(){return this.desired&&this.state==='ready'&&!!this.client}
}

