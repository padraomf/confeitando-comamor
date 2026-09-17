import {mkdirSync,readFileSync,existsSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
export function writeJSON(file,data){
 mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 const temporary=file+'.'+randomUUID()+'.tmp',fd=openSync(temporary,'wx',0o600);
 try{writeFileSync(fd,JSON.stringify(data));fsyncSync(fd)}finally{closeSync(fd)}
 renameSync(temporary,file);
}
export function readJSON(file){return existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null}
export function journal(directory){
 const file=id=>path.join(directory,createHash('sha256').update(id).digest('hex')+'.json');
 return {get:id=>readJSON(file(id)),put:(id,value)=>writeJSON(file(id),value)};
}
