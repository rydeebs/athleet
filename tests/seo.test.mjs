import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';
import {publicRoutes,guidePaths,siteUrl} from '../public-pages.mjs';
import {needsWorkspace} from '../portal-entry.mjs';

const fetchPage = path => worker.fetch(new Request(siteUrl+path));
const strip = text => text.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&');

test('public routes return distinct full pages without executing JavaScript', async () => {
  const titles = new Set();
  const vercel=JSON.parse(await readFile('vercel.json','utf8'));
  for (const [route,file] of Object.entries(publicRoutes)) {
    const response=await fetchPage(route);
    assert.equal(response.status,200,route);
    assert.match(response.headers.get('content-type'),/text\/html/);
    const html=await response.text();
    assert.equal((html.match(/<h1[ >]/g)||[]).length,1,route);
    assert.ok(html.includes('<h2'),route);
    assert.ok(html.includes(`rel="canonical" href="${siteUrl+route}"`),route);
    assert.ok(html.includes('href="/#pricing"'),route);
    assert.equal(html,await readFile('dist/public'+file,'utf8'));
    const title=html.match(/<title>(.*?)<\/title>/)[1];
    assert.ok(!titles.has(title));titles.add(title);
    assert.ok(vercel.rewrites.some(r=>r.source===route&&r.destination===file),route);
    assert.equal((await fetchPage(route+'/')).status,200);
    const head=await worker.fetch(new Request(siteUrl+route,{method:'HEAD'}));
    assert.equal(head.status,200);assert.equal(await head.text(),'');
  }
  assert.equal((await fetchPage('/guides/does-not-exist')).status,404);
});

test('discovery files have correct media types and point to live canonical pages', async () => {
  for(const [path,type] of [['/robots.txt','text/plain'],['/llms.txt','text/plain'],['/sitemap.xml','application/xml']]) {
    const res=await fetchPage(path);
    assert.equal(res.status,200);assert.ok(res.headers.get('content-type').startsWith(type));
  }
  const robots=await (await fetchPage('/robots.txt')).text();
  assert.match(robots,/Sitemap: https:\/\/enduur.co\/sitemap.xml/);
  const sitemap=await (await fetchPage('/sitemap.xml')).text();
  const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]);
  assert.equal(new Set(urls).size,urls.length);
  for(const route of Object.keys(publicRoutes)) assert.ok(urls.includes(siteUrl+route));
  for(const url of urls) {
    assert.ok(!url.includes('?')&&!url.includes('#'));
    assert.equal((await worker.fetch(new Request(url))).status,200,url);
  }
});

test('FAQ structured data matches every visible homepage question and answer',async()=>{
  const home=await (await fetchPage('/')).text();
  const schema=[...home.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>JSON.parse(m[1])).find(s=>s['@type']==='FAQPage');
  const section=home.slice(home.indexOf('<section class="section faq"'),home.indexOf('aria-labelledby="guides-title"'));
  const visible=[...section.matchAll(/<details><summary>(.*?)<\/summary><p>(.*?)<\/p><\/details>/gs)].map(m=>({q:strip(m[1]),a:strip(m[2])}));
  assert.equal(schema.mainEntity.length,visible.length);
  assert.ok(visible.length>0);
  assert.deepEqual(schema.mainEntity.map(q=>({q:q.name,a:q.acceptedAnswer.text})),visible);
});

test('guide metadata, calculator examples and internal discovery links are present',async()=>{
  const home=await (await fetchPage('/')).text();
  const index=await (await fetchPage('/guides')).text();
  for(const path of Object.values(guidePaths)) {
    assert.ok(home.includes(`href="${path}"`));assert.ok(index.includes(`href="${path}"`));
    const html=await (await fetchPage(path)).text();
    const schema=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(schema['@type'],'Article');
    assert.equal(schema.mainEntityOfPage,siteUrl+path);
    assert.equal(schema.headline,strip(html.match(/<h1>(.*?)<\/h1>/)[1]));
    if([guidePaths.sponsorship,guidePaths.tattoos].includes(path))assert.ok(html.includes('$150–$350'));
    assert.ok(html.includes('https://'), 'Source links must be present');
  }
});

test('workspace entry preserves demos, invitations, auth returns and deep links',()=>{
  for(const path of ['/athletes','/sponsors']) {
    assert.equal(needsWorkspace(new URL(siteUrl+path)),false);
    for(const suffix of ['?workspace=1','?demo=1','?invite=pilot','?code=auth-code','?checkout=returned','#profile','#listing=123','#access_token=example&type=recovery']) {
      assert.equal(needsWorkspace(new URL(siteUrl+path+suffix)),true,path+suffix);
    }
  }
});
