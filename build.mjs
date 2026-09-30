import {mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});
const assets={};
for(const path of ['index.html','style.css','app.js','audience.mjs','races.mjs']){const body=await readFile(path,'utf8');assets['/'+path]={body,type:path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'};}
await writeFile('dist/server/assets.mjs','export const assets='+JSON.stringify(assets)+';\n');
const audience=await readFile('audience.mjs','utf8');
const social=(await readFile('social.mjs','utf8')).replace(/^import .*?;\n/,'');
const worker=(await readFile('worker.mjs','utf8')).replace(/^import .*?;\n/gm,'');
await writeFile('dist/server/index.js','const assets='+JSON.stringify(assets)+';\n'+audience+'\n'+social+'\n'+worker);
for(const path of ['assets.mjs','social.mjs','audience.mjs'])await rm('dist/server/'+path,{force:true});
for(const path of ['index.html','style.css','app.js','audience.mjs','races.mjs'])await rm('dist/'+path,{force:true});
console.log('Built Athleet Worker with live audience lookup.');
