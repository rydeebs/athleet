import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';
test('sponsor product page and assets load directly on the preview and Vercel route',async()=>{
 for(const path of ['/for-sponsors','/for-sponsors/','/sponsor.css','/sponsor.js']){const response=await worker.fetch(new Request('https://example.com'+path));assert.equal(response.status,200);}
 const page=await (await worker.fetch(new Request('https://example.com/for-sponsors'))).text();assert.ok(page.includes('Put your offer on an athlete.'));assert.ok(page.includes('− $300 bundle adjustment'));assert.ok(page.includes('No bundle checkout is live.'));assert.equal((page.match(/geofence/gi)||[]).length,1);
 const vercel=JSON.parse(await readFile('vercel.json','utf8'));assert.ok(vercel.rewrites.some(r=>r.source==='/for-sponsors'&&r.destination==='/sponsor.html'));assert.equal(await readFile('dist/public/sponsor.html','utf8'),await readFile('sponsor.html','utf8'));
 const home=await readFile('index.html','utf8');assert.ok(home.includes('href="/for-sponsors">For sponsors'));
});
