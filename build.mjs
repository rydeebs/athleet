import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const path of ['index.html','style.css','app.js','audience.mjs']) await copyFile(path,`dist/${path}`);
console.log('Built Athleet static site.');
