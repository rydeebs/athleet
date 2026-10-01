import test from 'node:test';
import assert from 'node:assert/strict';
import {PortalData} from '../portal/data.mjs';
import {prepareArtwork,sponsoredMarks} from '../portal/artwork.mjs';
test('artwork is uploaded separately, attached by path and cleaned up on failed requests',async()=>{
 const uploads=[],removed=[],sent=[];const service=Object.assign(Object.create(PortalData.prototype),{demo:false,user:{id:'owner'},client:{storage:{from:bucket=>{assert.equal(bucket,'brand-artwork');return {upload:async(path,blob)=>{uploads.push({path,blob});return {error:null};},remove:async paths=>{removed.push(...paths);return {error:null};}};}}},rpc:async(name,p)=>{assert.equal(name,'request_placement');sent.push(p);}});
 const p={listing_id:'race',placement:'left-pec',brand_name:'PACE'},blob=new Blob(['logo'],{type:'image/png'});
 await service.request(p,blob);assert.equal(uploads.length,1);assert.equal(sent[0].brand_artwork,uploads[0].path);assert.ok(sent[0].brand_artwork.startsWith('owner/'));assert.equal(sent[0].brand_name,'PACE');assert.equal(removed.length,0);
 service.rpc=async()=>{throw new Error('placement reserved');};await assert.rejects(()=>service.request(p,blob),/reserved/);assert.deepEqual(removed,[uploads[1].path]);
 await assert.rejects(()=>service.request(p,new Blob(['bad'],{type:'image/svg+xml'})),/PNG/);
});
test('invalid image inputs fail before decode and sponsor previews resolve only artwork URLs',async()=>{
 for(const file of [{type:'image/svg+xml',size:5},{type:'image/png',size:0},{type:'image/png',size:3*1024*1024}])await assert.rejects(()=>prepareArtwork(file),/PNG/);
 const marks=sponsoredMarks({sponsors:[{placement:'left-pec',brand_name:'PACE',brand_artwork:'path',status:'accepted',message:'Private'}]},{path:'blob:logo'});assert.deepEqual(marks,[{zone:'left-pec',brand:'PACE',logo:'blob:logo',status:'accepted'}]);
});
