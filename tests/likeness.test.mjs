import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Vector3} from 'three';
import {likenessViews,headAnchors,keysFor,buildHeadFit,fitCamera,projectCamera,deformHeadPoint,validatePoints} from '../portal/likeness-fit.mjs';
import {fittedHeadGeometry,prepareViews,sampleViews} from '../portal/likeness-render.mjs';
function rows(){return likenessViews.map(v=>({id:v.id,width:800,height:1000,confirmed:true,points:Object.fromEntries(keysFor(v).map(k=>{const [x,y]=projectCamera(headAnchors[k],{angle:v.angle,a:2400,b:0,tx:400,ty:480});return [k,[x/800,y/1000]];}))}));}
test('five-view fit rejects incomplete sets, missing points and reversed profiles',()=>{
 assert.throws(()=>buildHeadFit(rows().slice(0,4)),/five/);const r=rows();delete r[1].points.nose;assert.throws(()=>buildHeadFit(r),/every/);const left=rows()[3];left.points.nose[0]=.95;assert.throws(()=>validatePoints(likenessViews[3],left.points),/wrong way/);
});
test('known multi-view cameras recover alignment and asymmetric profile depth changes the nose',()=>{
 const r=rows(),baseline=buildHeadFit(r);for(let i=0;i<5;i++){const cam=fitCamera(r[i],likenessViews[i],baseline);assert.ok(cam.error<1,`${r[i].id} residual ${cam.error}`);}
 r[3].points.nose[0]-=.04;r[4].points.nose[0]+=.04;const fitted=buildHeadFit(r);assert.ok(fitted.find(c=>c.key==='nose').delta[2]>.008);assert.ok(deformHeadPoint(headAnchors.nose,fitted)[2]>headAnchors.nose[2]);assert.deepEqual(deformHeadPoint([.1,1.2,.1],fitted),[.1,1.2,.1]);
});
test('head fitting changes geometry without mutating shared assets or race kit/body vertices',async()=>{
 const b=await readFile('assets/athletes/v2/masculine.glb'),{scene}=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');scene.updateMatrixWorld(true);const body=scene.getObjectByName('Body'),original=body.geometry.attributes.position.array.slice(),fit=[{center:headAnchors.nose,delta:[0,0,.016],radius:.04}],geometry=fittedHeadGeometry(body,fit);assert.deepEqual(body.geometry.attributes.position.array,original);assert.deepEqual(geometry.morphAttributes,{});
 let changed=0;const a=new Vector3(),c=new Vector3();for(let i=0;i<geometry.attributes.position.count;i++){body.getVertexPosition(i,a);a.applyMatrix4(body.matrixWorld);c.fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(body.matrixWorld);if(a.y<1.49)assert.ok(a.distanceTo(c)<1e-6);if(a.distanceTo(c)>.002)changed++;}assert.ok(changed>100);geometry.dispose();
});
test('view blending uses the visible side and rejects a photo hidden by nearer geometry',()=>{
 const image={width:64,height:64,data:new Uint8ClampedArray(64*64*4)};for(let i=0;i<image.data.length;i+=4)image.data.set([200,60,40,255],i);
 const base={image,camera:{angle:Math.PI/2,a:100,b:0,tx:32,ty:32},size:64,ca:0,sa:1,depth:new Float32Array(64*64).fill(-Infinity)};
 assert.ok(sampleViews([.07,1.64,.06],[base]));assert.equal(sampleViews([-.07,1.64,.06],[base]),null);
 assert.equal(sampleViews([.07,1.64,.06],[{...base,depth:new Float32Array(64*64).fill(.09)}]),null);
});
