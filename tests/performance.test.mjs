import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePerformance,validatePerformances,validateMeasurements,performanceCards} from '../portal/performance.mjs';
import {validateEvidenceFile} from '../portal/evidence.mjs';
const result=()=>({id:'one',event_name:'HYROX Milan',location:'Milan, Italy',discipline:'HYROX',distance:'Singles Open',year:2024,place:5,ranking:'Overall',division:'',field_size:500,finish_time:'1:12:35',evidence_path:'owner/file.jpg'});
test('past results require evidence and distinguish category placings',()=>{
 assert.equal(validatePerformance(result()).place,5);assert.throws(()=>validatePerformance({...result(),evidence_path:''}),/Attach/);assert.throws(()=>validatePerformance({...result(),ranking:'Age group'}),/category/);assert.throws(()=>validatePerformance({...result(),field_size:4}),/Field size/);assert.throws(()=>validatePerformance({...result(),year:new Date().getFullYear()+1}),/completed/);assert.throws(()=>validatePerformance({...result(),finish_time:'1:99:00'}),/H:MM:SS/);
 assert.doesNotThrow(()=>validatePerformance({...result(),ranking:'Age group',division:'Men 30–34'}));assert.throws(()=>validatePerformances([result(),result()]),/distinct/);
});
test('measurements are optional and bounded without rejecting valid decimals',()=>{validateMeasurements({height_cm:null,weight_kg:null});validateMeasurements({height_cm:181.5,weight_kg:78.2});for(const p of [{height_cm:-1},{weight_kg:Infinity},{height_cm:'bad'}])assert.throws(()=>validateMeasurements(p),/valid/);});
test('evidence uploads reject unsupported and oversized files',()=>{validateEvidenceFile({type:'image/png',size:1000});for(const f of [{type:'image/svg+xml',size:100},{type:'image/jpeg',size:9*1024*1024},{type:'image/png',size:0}])assert.throws(()=>validateEvidenceFile(f),/JPG/);});
test('sponsor result cards escape text and label supporting evidence honestly',()=>{const html=performanceCards([{...result(),event_name:'<img src=x onerror=alert(1)>'}],{owner:'owner'});assert.ok(html.includes('&lt;img'));assert.ok(html.includes('Evidence attached · athlete supplied'));assert.ok(!html.includes('Verified'));assert.ok(!html.includes('Edit result'));assert.ok(html.includes('View evidence'));});

test('live saves upload evidence separately, send only paths, and remove failed uploads',async()=>{
 const {PortalData}=await import('../portal/data.mjs');const saved=[],uploads=[],removed=[];
 const service=Object.assign(Object.create(PortalData.prototype),{role:'athlete',demo:false,user:{id:'owner'},evidencePaths:[],client:{storage:{from:()=>({upload:async(path,blob)=>{uploads.push({path,blob});return {error:null};},remove:async(paths)=>{removed.push(...paths);return {error:null};}})}},rpc:async(name,p)=>{saved.push(structuredClone(p));}});
 const p={height_cm:180,weight_kg:78,performances:[{...result(),evidence_path:null,evidence_file:new Blob(['image'],{type:'image/jpeg'})}]};
 await service.saveProfile(p);assert.equal(uploads.length,1);assert.ok(saved[0].performances[0].evidence_path.startsWith('owner/'));assert.equal(saved[0].performances[0].evidence_file,undefined);assert.ok(p.performances[0].evidence_file,'draft remains retryable');assert.equal(removed.length,0);
 service.rpc=async()=>{throw new Error('save failed');};await assert.rejects(()=>service.saveProfile(p),/save failed/);assert.equal(removed.length,1);assert.equal(removed[0],uploads[1].path);
 service.rpc=async()=>{};await service.saveProfile({...p,performances:[]});assert.ok(removed.includes(uploads[0].path),'removed results release old evidence after save');
});
