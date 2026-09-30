import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Raycaster,Vector3} from 'three';
import {bakePortraitPixels,portraitEyeGeometry} from '../portal/portrait-texture.mjs';
const solid=(width,height,color)=>{const data=new Uint8ClampedArray(width*height*4);for(let i=0;i<data.length;i+=4)data.set([...color,255],i);return {data,width,height};};
async function scene(){const b=await readFile('assets/athletes/v2/masculine.glb'),g=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');g.scene.updateMatrixWorld(true);return g.scene;}
function pixelAt(image,body,x,y,side=1){const hit=new Raycaster(new Vector3(x,y,side),new Vector3(0,0,-side)).intersectObject(body)[0];assert.ok(hit);const k=(Math.round(hit.uv.y*(image.height-1))*image.width+Math.round(hit.uv.x*(image.width-1)))*4;return Array.from(image.data.slice(k,k+3));}

test('portrait and scalp are baked onto existing body UVs and share body exposure',async()=>{
 const model=await scene(),body=model.getObjectByName('Body'),base=solid(1024,1024,[150,100,80]),face=solid(512,640,[180,120,90]),hair=solid(1024,1024,[30,25,20]);
 for(let y=381;y<1024;y++)for(let x=0;x<1024;x++)hair.data[(y*1024+x)*4+3]=0;
 const positions=body.geometry.attributes.position.array.slice(),normals=body.geometry.attributes.normal.array.slice();
 const details={hairColor:[30,25,20],hairBounds:{top:100,line:380,left:270,right:754},exposure:0};
 const baked=bakePortraitPixels(base,body,face,hair,details);
 assert.deepEqual(pixelAt(baked,body,0,1.60),[180,120,90]);
 assert.deepEqual(pixelAt(baked,body,0,1.12),[150,100,80]);
 assert.deepEqual(pixelAt(baked,body,0,1.73),[30,25,20]);
 assert.deepEqual(pixelAt(baked,body,0,1.73,-1),[30,25,20]);
 const brighter=bakePortraitPixels(base,body,face,hair,{...details,exposure:30});
 for(const [y,original] of [[1.60,[180,120,90]],[1.12,[150,100,80]]])assert.deepEqual(pixelAt(brighter,body,0,y),original.map(v=>Math.round(v*2**.3)));
 assert.deepEqual(body.geometry.attributes.position.array,positions,'Photo must not add geometry or move scalp vertices');
 assert.deepEqual(body.geometry.attributes.normal.array,normals,'Preserve authored shading normals');
});

test('eye projection changes UVs without a second eye surface or recomputed normals',async()=>{
 const model=await scene(),eyes=model.getObjectByName('Eyes'),original=eyes.geometry,geometry=portraitEyeGeometry(eyes);
 assert.equal(eyes.geometry,original);assert.equal(geometry.attributes.position.count,original.attributes.position.count);
 assert.deepEqual(geometry.attributes.normal.array,original.attributes.normal.array);
 assert.deepEqual(geometry.attributes.position.array,original.attributes.position.array);
 for(const v of geometry.attributes.uv.array)assert.ok(Number.isFinite(v)&&v>=0&&v<=1);
 assert.notDeepEqual(geometry.attributes.uv.array,original.attributes.uv.array);geometry.dispose();
});
