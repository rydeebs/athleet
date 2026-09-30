import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePortrait,portraitTransform,facePreview} from '../portal/photo-face.mjs';
import {normalizeAvatar,defaultAvatar} from '../portal/model.mjs';

test('legacy avatar preferences migrate to Male or Female while preserving skin, kit and build',()=>{
 assert.equal(normalizeAvatar({presentation:'feminine'}).gender,'female');
 assert.equal(normalizeAvatar({presentation:'masculine'}).gender,'male');
 assert.equal(normalizeAvatar({presentation:'neutral'}).gender,'male');
 assert.equal(normalizeAvatar({gender:'female',presentation:'masculine'}).presentation,'feminine');
 assert.equal(normalizeAvatar({gender:'male',presentation:'feminine'}).presentation,'masculine');
 const previous={...defaultAvatar,gender:'female',outfit:'sports-bra',build:'lean'};
 assert.deepEqual(normalizeAvatar(previous),{...previous,presentation:'feminine'});
 assert.equal(normalizeAvatar({outfit:'javascript:bad'}).outfit,'singlet');
 assert.equal(normalizeAvatar({gender:'female',outfit:'shirtless'}).outfit,'sports-bra');
 assert.equal(normalizeAvatar({gender:'male',outfit:'sports-bra'}).outfit,'shirtless');
});
test('portrait upload rejects unsupported, empty and oversized files',()=>{
 for(const type of ['image/jpeg','image/png','image/webp'])assert.doesNotThrow(()=>validatePortrait({type,size:1024}));
 assert.throws(()=>validatePortrait({type:'image/svg+xml',size:100}),/JPG/);
 assert.throws(()=>validatePortrait({type:'image/heic',size:100}),/HEIC/);
 assert.throws(()=>validatePortrait({type:'image/jpeg',size:9*1024*1024}),/8 MB/);
 assert.throws(()=>validatePortrait({type:'image/jpeg',size:0}),/empty/);
 assert.deepEqual(facePreview(),{url:'',version:0,details:null});
});
test('portrait fit preserves aspect ratio and clamps extreme alignment input',()=>{
 assert.deepEqual(portraitTransform(1024,1280),{scale:.5,x:256,y:320,rotation:0});
 assert.equal(portraitTransform(1280,640).scale,1);
 const t=portraitTransform(1024,1280,{zoom:999,x:999,y:-999,rotation:999});
 assert.equal(t.scale,4);assert.equal(t.x,2304);assert.equal(t.y,-2240);assert.equal(t.rotation,25*Math.PI/180);
});
