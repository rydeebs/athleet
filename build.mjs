import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const path of ['index.html','style.css','app.js']) await copyFile(path,`dist/${path}`);
console.log('Built Athleet static site.');
