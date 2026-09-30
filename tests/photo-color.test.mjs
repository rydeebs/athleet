import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleCheeks,colorHex} from '../portal/photo-color.mjs';

test('skin sampling ignores background, hair, transparent pixels and isolated color outliers',()=>{
 const width=1024,height=1024,data=new Uint8ClampedArray(width*height*4),mask=new Float32Array(width*height);
 for(let i=0;i<width*height;i++)data.set([20,80,180,255],i*4);
 for(const cx of [.28,.72])for(let dy=-15;dy<=15;dy++)for(let dx=-15;dx<=15;dx++){
  const x=Math.round(cx*512+256)+dx,y=Math.round(.56*640+256)+dy,i=y*width+x;data.set(dx===0?[250,10,10,255]:[172,113,85,255],i*4);mask[i]=1;
 }
 assert.equal(colorHex(sampleCheeks(data,width,height,mask,width,height,{offsetX:256,offsetY:256})),'#ac7155');
 assert.equal(sampleCheeks(data,width,height,new Float32Array(width*height),width,height,{offsetX:256,offsetY:256}),null);
 assert.equal(colorHex(sampleCheeks(data,width,height,mask,width,height,{offsetX:256,offsetY:256,point:[.28,.56]})),'#ac7155');
 assert.ok(sampleCheeks(data,width,height,mask,width,height,{offsetX:256,offsetY:256,exposure:40})[0]>172);
});
