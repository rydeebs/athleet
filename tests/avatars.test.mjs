import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Raycaster,Vector3} from 'three';
import {garments,anchors} from '../portal/avatar-layout.mjs';
import {placementInfo} from '../portal/model.mjs';
import {avatarPoster,avatarStudio,avatarSvg} from '../portal/avatar.mjs';

test('all 63 template/build/outfit combinations put every placement on the correct surface',async()=>{
 for(const presentation of ['masculine','feminine','neutral']){
  const path=`assets/athletes/v1/${presentation}.glb`,bytes=await readFile(path);
  assert.equal(bytes.toString('utf8',0,4),'glTF');assert.ok(bytes.length<2_000_000,'geometry download exceeds budget');
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.updateMatrixWorld(true);
  for(const build of ['lean','athletic','strong'])for(const [outfit,clothes] of Object.entries(garments)){
   const surfaces=[];scene.traverse(mesh=>{if(!mesh.isMesh)return;if(mesh.morphTargetInfluences)for(const [name,i] of Object.entries(mesh.morphTargetDictionary))mesh.morphTargetInfluences[i]=name===build?1:0;if(['Body',...clothes].includes(mesh.name))surfaces.push(mesh);});
   for(const [zone,[x,y,side]] of Object.entries(anchors)){
    const hit=new Raycaster(new Vector3(x,y,side*2),new Vector3(0,0,-side)).intersectObjects(surfaces,false)[0];
    const label=`${presentation}/${build}/${outfit}/${zone}`;assert.ok(hit,`No surface: ${label}`);
    assert.equal(hit.object.name==='Body'?'skin':'kit',placementInfo(zone,outfit).material,`Wrong material: ${label}`);
   }
  }
 }
});
test('discovery cards use bounded local poster assets rather than canvases',async()=>{
 for(const presentation of ['neutral','feminine','masculine'])for(const outfit of Object.keys(garments)){
  const path=avatarPoster({presentation},outfit);assert.ok((await stat('.'+path)).size<100_000);
  assert.ok(!avatarSvg({presentation},outfit).includes('canvas'));
 }
 assert.equal(avatarPoster({presentation:'../../private'},'../../private'),'/assets/athletes/v1/masculine-singlet.webp');
});
test('viewer configuration cannot inject markup and does not expose unoffered controls',()=>{
 const html=avatarStudio({available:['back'],brand:'\" onmouseover=\"alert(1)',logo:'\"><script>alert(1)</script>'});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('data-zone="chest"'));assert.ok(html.includes('&quot;available&quot;:[&quot;back&quot;]'));assert.ok(!html.includes('model-controls'));assert.ok(!html.includes('body-hotspot'));
});
