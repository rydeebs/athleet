import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createAudienceHandler } from '../server/audience-handler.mjs';
import vercelAudience from '../api/audience.js';

const payload = { accounts: [{ platform: 'x', handle: '@runner' }] };
function request(body = JSON.stringify(payload), headers = {}) {
  return new Request('https://athleet.vercel.app/api/audience', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body,
  });
}

test('shared endpoint normalizes handles and returns sourced lookup results', async () => {
  const handle = createAudienceHandler({ lookup: async account => ({ ...account, status: 'ok', followers: 123 }) });
  const result = await handle(request());
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await result.json(), { accounts: [{ platform: 'x', handle: 'runner', status: 'ok', followers: 123 }] });
});

test('Vercel fetch export responds without a Cloudflare runtime', async () => {
  const response = await vercelAudience.fetch(new Request('https://athleet.vercel.app/api/audience'));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST');
});

test('same-origin custom domains work; cross-origin requests are rejected', async () => {
  const handle = createAudienceHandler({ lookup: async account => account });
  assert.equal((await handle(request(undefined, { Origin: 'https://another.example' }))).status, 403);
  const sameOrigin = new Request('https://athleet.example/api/audience', {
    method: 'POST', headers: { Origin: 'https://athleet.example', 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal((await handle(sameOrigin)).status, 200);
});

test('invalid input never reaches the external lookup', async () => {
  let calls = 0;
  const handle = createAudienceHandler({ lookup: async () => { calls++; } });
  for (const body of ['{', 'null', '{}', '{"accounts":[]}', '{"accounts":[{"platform":"x","handle":"https://example.com"}]}']) {
    assert.equal((await handle(request(body))).status, 400);
  }
  assert.equal((await handle(request('{}', { 'Content-Type': 'text/plain' }))).status, 415);
  assert.equal(calls, 0);
});

test('request limits are applied in bytes, including unannounced streamed bodies', async () => {
  const handle = createAudienceHandler();
  assert.equal((await handle(request('{}', { 'Content-Length': '5001' }))).status, 413);
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('😀'.repeat(1300)));
    controller.close();
  } });
  const streamed = new Request('https://athleet.vercel.app/api/audience', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half',
  });
  assert.equal((await handle(streamed)).status, 413);
});

test('rate limits isolate visitors and expire after one minute', async () => {
  let time = 0;
  const handle = createAudienceHandler({
    lookup: async account => account,
    clientKey: req => req.headers.get('x-vercel-forwarded-for'),
    now: () => time,
  });
  const visitor = ip => request(undefined, { 'x-vercel-forwarded-for': ip });
  for (let i = 0; i < 6; i++) assert.equal((await handle(visitor('192.0.2.1'))).status, 200);
  const limited = await handle(visitor('192.0.2.1'));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  assert.equal((await handle(visitor('192.0.2.2'))).status, 200);
  time = 60000;
  assert.equal((await handle(visitor('192.0.2.1'))).status, 200);
});

test('unavailable profiles stay unavailable rather than becoming zero', async () => {
  const handle = createAudienceHandler({ lookup: async account => ({ ...account, status: 'unavailable' }) });
  const body = await (await handle(request())).json();
  assert.equal(body.accounts[0].status, 'unavailable');
  assert.equal(body.accounts[0].followers, undefined);
});

test('unexpected upstream errors return a safe retryable response', async () => {
  const handle = createAudienceHandler({ lookup: async () => { throw new Error('internal details'); } });
  const response = await handle(request());
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('internal details'));
});

test('Vercel serves only public assets and includes the audience function', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, 'dist/public');
  assert.equal(config.functions['api/audience.js'].maxDuration, 30);
  assert.deepEqual((await readdir(config.outputDirectory)).sort(), ['app.js', 'assets', 'audience.mjs', 'chunks', 'index.html', 'invite-athletes.html', 'invite-brands.html', 'invite.css', 'invite.js', 'invite.mjs', 'payment-terms.html', 'portal.css', 'portal.html', 'portal.js', 'races.mjs', 'sponsor.css', 'sponsor.html', 'sponsor.js', 'style.css']);
  for (const file of (await readdir(config.outputDirectory)).filter(file => !['portal.js','assets','chunks'].includes(file))) {
    assert.equal(await readFile(`${config.outputDirectory}/${file}`, 'utf8'), await readFile(file, 'utf8'));
  }
  assert.ok((await readFile('dist/public/index.html', 'utf8')).includes('Monetize your audience'));
});

test('retained Sites Worker still serves assets and uses the shared API', async () => {
  const { default: worker } = await import('../dist/server/index.js');
  assert.equal((await worker.fetch(new Request('https://site.example/'))).status, 200);
  assert.equal((await worker.fetch(new Request('https://site.example/api/audience'))).status, 405);
  assert.equal((await worker.fetch(new Request('https://site.example/social.mjs'))).status, 404);
});

test('portrait analysis is deployed locally and its model remains pinned',async()=>{
 const {createHash}=await import('node:crypto');
 const bytes=await readFile('dist/public/assets/vision/v1/selfie-multiclass.tflite');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0');
 for(const name of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'])assert.ok((await readFile('dist/public/assets/vision/v1/wasm/'+name)).length>100_000);
});

test('three-view alignment model is deployed locally at its pinned version',async()=>{const {createHash}=await import('node:crypto');const b=await readFile('dist/public/assets/vision/v1/face-landmarker.task');assert.equal(createHash('sha256').update(b).digest('hex'),'64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff');});
