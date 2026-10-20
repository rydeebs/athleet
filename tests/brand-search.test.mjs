import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {brand,organizationId} from '../brand.mjs';
import {publicRoutes,guidePaths} from '../public-pages.mjs';
import {costFaq} from '../sponsorship-costs.mjs';

const get = async path => (await worker.fetch(new Request(brand.url+path))).text();
const schemas = html => [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map(m=>JSON.parse(m[1]));

test('all public pages identify the same organization and expose consistent branding',async()=>{
  for(const path of ['/','/for-sponsors','/payment-terms.html',...Object.keys(publicRoutes)]){
    const html=await get(path);
    const organization=schemas(html).filter(s=>s['@type']==='Organization');
    assert.equal(organization.length,1,path);
    assert.equal(organization[0]['@id'],organizationId);
    assert.equal(organization[0].name,brand.name);
    assert.equal(organization[0].alternateName,brand.displayName);
    assert.equal(organization[0].description,brand.description);
    assert.ok(html.includes(`<p class="brand-identity">${brand.description}</p>`),path);
    assert.ok(html.match(/<title>(.*?)<\/title>/s)[1].includes(brand.displayName),path);
    assert.ok(html.includes(`property="og:site_name" content="${brand.displayName}"`),path);
    assert.deepEqual(organization[0].sameAs||[],brand.socialProfiles.map(p=>p.url));
    for(const profile of brand.socialProfiles){
      assert.ok(profile.url.startsWith('https://'));
      assert.ok(html.includes(`href="${profile.url}" rel="me"`));
    }
  }
});

test('homepage site name and article publisher reference the canonical company',async()=>{
  const website=schemas(await get('/')).find(s=>s['@type']==='WebSite');
  assert.equal(website.name,brand.displayName);
  assert.equal(website.url,brand.url+'/');
  assert.equal(website.publisher['@id'],organizationId);
  for(const path of Object.values(guidePaths)){
    const article=schemas(await get(path)).find(s=>s['@type']==='Article');
    assert.equal(article.publisher['@id'],organizationId);
    assert.equal(article.author['@id'],organizationId);
  }
});

test('brand cost guide uses quote-required examples and its FAQ matches visible text',async()=>{
  const html=await get(guidePaths.costs);
  assert.match(html,/Athlete quote required/);
  assert.match(html,/Three-race season example/);
  assert.match(html,/not offers, actual deals or published rate cards/);
  assert.doesNotMatch(html,/\$\s*\d/);
  const data=schemas(html);
  assert.ok(!data.some(s=>['Offer','Product','AggregateOffer'].includes(s['@type'])));
  const faq=data.find(s=>s['@type']==='FAQPage');
  assert.deepEqual(faq.mainEntity.map(q=>[q.name,q.acceptedAnswer.text]),costFaq);
  for(const [question,answer] of costFaq){
    assert.ok(html.includes(`<h3>${question}</h3><p>${answer}</p>`));
  }
  assert.ok((await get('/sponsors')).includes(`href="${guidePaths.costs}"`));
  assert.ok((await get('/for-sponsors')).includes(`href="${guidePaths.costs}"`));
});
