// Offline asset authoring, not part of npm build or a Vercel deployment.
// node scripts/prepare-athletes.mjs /tmp/athleet-source /path/to/Blender
import {mkdir,readFile,readdir,writeFile,unlink,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const [sourceArg,blender]=process.argv.slice(2);if(!sourceArg||!blender)throw new Error('Provide a temporary source directory and Blender executable path.');
const source=resolve(sourceArg),output=resolve('assets/athletes/v2');await mkdir(source,{recursive:true});await mkdir(output,{recursive:true});
const revision='afb9f530a7c2741dedb8df0ebae2e0b183caec21',raw=`https://raw.githubusercontent.com/makehumancommunity/mpfb2/${revision}/src/mpfb/data/`;
const sources=[];
async function download(url,file){const path=source+'/'+file;try{await access(path);}catch{const r=await fetch(url);if(!r.ok)throw new Error(`${r.status}: ${url}`);await writeFile(path,Buffer.from(await r.arrayBuffer()));}sources.push({url,file,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});}
await download(raw+'3dobjs/base.obj','base.obj');
for(const sex of ['male','female'])for(const target of ['african-'+sex+'-young','asian-'+sex+'-young','caucasian-'+sex+'-young',...['averagemuscle-averageweight','maxmuscle-averageweight','maxmuscle-minweight'].map(s=>'universal-'+sex+'-young-'+s)])await download(raw+'targets/macrodetails/'+target+'.target.gz',target+'.target.gz');
await download('https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip','system.zip');
execFileSync('unzip',['-oq',source+'/system.zip','hair/short02/*','hair/ponytail01/*','eyes/*','clothes/shoes04/*','skins/young_caucasian_male/*','skins/young_caucasian_female/*','skins/young_african_male/*','skins/young_african_female/*','-d',source+'/system']);
for(const sex of ['male','female'])for(const [tone,ancestry] of [['light','caucasian'],['dark','african']])await sharp(`${source}/system/skins/young_${ancestry}_${sex}/young_${tone}skinned_${sex}_diffuse.png`).resize(2048,2048).jpeg({quality:88}).toFile(`${output}/skin-${sex}-${tone}.jpg`);
for(const hair of ['short02','ponytail01'])await sharp(`${source}/system/hair/${hair}/${hair}_diffuse.png`).resize(1024,1024).png().toFile(`${output}/hair-${hair}.png`);
await sharp(source+'/system/eyes/materials/brown_eye.png').resize(512,512).jpeg({quality:90}).toFile(output+'/eyes.jpg');
await sharp(source+'/system/clothes/shoes04/shoes04_diffuse.png').resize(1024,1024).jpeg({quality:85}).toFile(output+'/shoes.jpg');
execFileSync(blender,['-b','--python','scripts/build-athletes.py','--',source,output],{stdio:'inherit'});
for(const file of await readdir(output))if(file.endsWith('.png')){await sharp(output+'/'+file).webp({quality:85}).toFile(output+'/'+file.replace('.png','.webp'));await unlink(output+'/'+file);}
execFileSync(process.execPath,['scripts/compress-athletes.mjs'],{stdio:'inherit'});
await writeFile('assets/athletes/sources.json',JSON.stringify({revision,sources},null,2)+'\n');
