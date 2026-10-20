import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';
import {publicRoutes,guidePaths,siteUrl} from '../public-pages.mjs';
import {sportGuides} from '../sport-guides.mjs';
const get = async path => (await worker.fetch(new Request(siteUrl+path))).text();

test('payment metadata is canonical, descriptive and has no duplicate brand or em dash',async()=>{
 const html=await get('/payment-terms.html');
 assert.match(html,/<link rel="canonical" href="https:\/\/enduur.co\/payment-terms.html">/);
 assert.match(html,/<meta name="description" content="[^"]+">/);
 assert.equal(html.match(/<title>(.*?)<\/title>/)[1],'Booking and payment rules | enduur race-day sponsorships');
});

test('public HTML links and local section links resolve across the expanded content',async()=>{
 for(const path of ['/','/for-sponsors','/payment-terms.html',...Object.keys(publicRoutes)]){
  const html=await get(path);
  assert.doesNotMatch(html,/Marketplace concept|Sponsor package concept|business-guidance\/resources\/disclosures-101-social-media-influencers/);
  for(const [,href] of html.matchAll(/href="([^"<>]+)"/g)){
   if(!href.startsWith('/')&&!href.startsWith('#'))continue;
   const url=new URL(href,siteUrl+path);
   if(url.pathname==='/sponsors'&&url.hash||url.pathname==='/athletes'&&url.hash)continue;
   const res=await worker.fetch(new Request(url));
   assert.equal(res.status,200,`${path}: ${href}`);
   if(url.hash){
    const target=url.pathname===path?html:await res.text();
    assert.ok(target.includes(`id="${url.hash.slice(1)}"`),`${path}: ${href}`);
   }
  }
 }
});

test('sport guides carry distinct official sources and crawlable discovery entries',async()=>{
 const llms=await readFile('llms.txt','utf8');
 const expected=['hyrox.com/rulebook/','cms.triathlon.org/download-file/world-triathlon-competition-rules-2026','montblanc.utmb.world/en/races-runners/other-information/regulation'];
 for(const [i,guide] of sportGuides.entries()){
  const html=await get(guide.path);
  assert.ok(html.includes(expected[i]));
  assert.ok(llms.includes(siteUrl+guide.path));
  assert.doesNotMatch(html,/\$\s*\d/);
  assert.match(html,/quote/i);
 }
 assert.match(await get(guidePaths.sponsorship),/https:\/\/www.ftc.gov\/system\/files\/documents\/plain-language\/1001a-influencer-guide-508_1.pdf/);
});

test('canonical www redirect is permanent and preserves route paths',async()=>{
 const config=JSON.parse(await readFile('vercel.json','utf8'));
 const redirect=config.redirects.find(r=>r.has?.some(h=>h.type==='host'&&h.value==='www.enduur.co'));
 assert.ok(redirect);
 assert.equal(redirect.permanent,true);
 assert.equal(redirect.source,'/:path*');
 assert.equal(redirect.destination,'https://enduur.co/:path*');
});
