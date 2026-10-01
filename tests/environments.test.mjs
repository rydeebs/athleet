import test from 'node:test';
import assert from 'node:assert/strict';
import {environmentScene} from '../portal/environments.mjs';
import {avatarStudio} from '../portal/avatar.mjs';
test('legacy backgrounds use sci-fi and animated scene resources remain bounded',()=>{
 assert.ok(avatarStudio({environment:'beach'}).includes('scene-scifi'));
 const scene=environmentScene(),before=[];scene.update(0);scene.group.traverse(o=>before.push(o.position.toArray().concat(o.rotation.toArray())));
 scene.update(4);const after=[];let geometries=new Set(),materials=new Set();scene.group.traverse(o=>{after.push(o.position.toArray().concat(o.rotation.toArray()));for(const v of o.position.toArray())assert.ok(Number.isFinite(v));if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [o.material].flat())materials.add(m);});assert.notDeepEqual(after,before);assert.ok(geometries.size<100);
 let disposed=0;for(const resource of [...geometries,...materials])resource.addEventListener('dispose',()=>disposed++);scene.dispose();assert.equal(disposed,geometries.size+materials.size);
});
