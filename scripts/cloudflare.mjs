import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli=path.join(root,'node_modules/wrangler/bin/wrangler.js');
const account='f75b22fb9fda340ca60f51698f494b87';
const email='padraomf@gmail.com';
const env={...process.env,XDG_CONFIG_HOME:path.join(root,'.sites-runtime/cloudflare-gmail'),CLOUDFLARE_ACCOUNT_ID:account};
// This project uses its own OAuth login; never inherit another project's credentials.
for(const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL','CF_API_TOKEN','CF_API_KEY','CF_EMAIL'])delete env[key];
const args=process.argv.slice(2);if(!args.length)args.push('whoami');
if(args[0]!=='login'){
 const check=spawnSync(process.execPath,[cli,'whoami'],{cwd:root,env,encoding:'utf8'});
 if(check.status!==0||!check.stdout?.includes(email)||!check.stdout.includes(account)){
  console.error('Este projeto publica somente na conta '+email+'. Execute npm run cf:login e autorize esse Gmail. O login global do Hotmail não será alterado.');
  process.exit(1);
 }
}
const result=spawnSync(process.execPath,[cli,...args],{cwd:root,env,stdio:'inherit'});
if(result.error)console.error(result.error.message);
process.exit(result.status??1);
