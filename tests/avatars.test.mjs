import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Raycaster,Vector3} from 'three';
import {garments,anchors,findPlacementHit} from '../portal/avatar-layout.mjs';
import {placementInfo} from '../portal/model.mjs';
import {avatarPoster,avatarStudio,avatarSvg} from '../portal/avatar.mjs';

test('all 63 template/build/outfit combinations put every placement on the correct surface',async()=>{
 for(const presentation of ['masculine','feminine','neutral']){
  const path=`assets/athletes/v2/${presentation}.glb`,bytes=await readFile(path);
  assert.equal(bytes.toString('utf8',0,4),'glTF');assert.ok(bytes.length<2_000_000,'geometry download exceeds budget');
  const {scene}=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.updateMatrixWorld(true);
  for(const build of ['lean','athletic','strong'])for(const [outfit,clothes] of Object.entries(garments)){
   const surfaces=[];scene.traverse(mesh=>{if(!mesh.isMesh)return;if(mesh.morphTargetInfluences)for(const [name,i] of Object.entries(mesh.morphTargetDictionary))mesh.morphTargetInfluences[i]=name===build?1:0;if(['Body',...clothes].includes(mesh.name))surfaces.push(mesh);});
   for(const [zone,[x,y,side]] of Object.entries(anchors)){
    const hit=findPlacementHit(new Raycaster(),surfaces,zone);
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
 assert.equal(avatarPoster({presentation:'../../private'},'../../private'),'/assets/athletes/v2/masculine-singlet.webp');
});
test('viewer configuration cannot inject markup and does not expose unoffered controls',()=>{
 const html=avatarStudio({available:['back'],brand:'\" onmouseover=\"alert(1)',logo:'\"><script>alert(1)</script>'});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('data-zone="chest"'));assert.ok(html.includes('&quot;available&quot;:[&quot;back&quot;]'));assert.ok(!html.includes('model-controls'));assert.ok(!html.includes('body-hotspot'));
});

test('lean, athletic and strong builds have distinct torso silhouettes for both genders',async()=>{
 for(const name of ['masculine','feminine']){
  const bytes=await readFile(`assets/athletes/v2/${name}.glb`),{scene}=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');scene.updateMatrixWorld(true);const body=scene.getObjectByName('Body'),widths=[];
  for(const build of ['lean','athletic','strong']){
   for(const [key,i] of Object.entries(body.morphTargetDictionary))body.morphTargetInfluences[i]=key===build?1:0;
   let min=Infinity,max=-Infinity;const point=new Vector3();
   for(let i=0;i<body.geometry.attributes.position.count;i++){body.getVertexPosition(i,point);point.applyMatrix4(body.matrixWorld);if(point.y>1.1&&point.y<1.15&&Math.abs(point.x)<.22){min=Math.min(min,point.x);max=Math.max(max,point.x);}}
   widths.push(max-min);
  }
  assert.ok(widths[1]>widths[0]*1.03,`${name}: athletic must be broader than lean`);assert.ok(widths[2]>widths[1]*1.03,`${name}: strong must be broader than athletic`);
 }
});

test('athletic relief preserves source assets, outward unit normals and placement coverage',async()=>{
 const {athleticGeometry}=await import('../portal/anatomy.mjs');
 for(const presentation of ['masculine','feminine']){
  const bytes=await readFile(`assets/athletes/v2/${presentation}.glb`),{scene}=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');scene.updateMatrixWorld(true);
  const body=scene.getObjectByName('Body'),source=body.geometry,before=source.attributes.position.array.slice(),sculpt=athleticGeometry(body,{gender:presentation==='feminine'?'female':'male',build:'athletic'});
  assert.deepEqual(source.attributes.position.array,before);assert.notEqual(sculpt,source);
  const n=new Vector3();let changed=0;for(let i=0;i<sculpt.attributes.normal.count;i++){n.fromBufferAttribute(sculpt.attributes.normal,i);assert.ok(n.length()>.99&&n.length()<1.01,'lighting normals must remain normalized after decoding');if(Math.abs(sculpt.attributes.position.getZ(i)-source.attributes.position.getZ(i))>.00001)changed++;}
  assert.ok(changed>100);body.geometry=sculpt;
  for(const zone of ['left-pec','right-pec','cleavage','left-shoulder','right-forearm','left-calf'])assert.ok(findPlacementHit(new Raycaster(),[body],zone),zone);
  sculpt.dispose();
 }
});
