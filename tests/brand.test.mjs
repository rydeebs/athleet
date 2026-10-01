import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBrandProfile,websiteUrl} from '../portal/brand.mjs';
import {PortalData} from '../portal/data.mjs';
test('brand links normalize domains and accept handles or social pages',()=>{
 const p=normalizeBrandProfile({website:'example.com',socials:[{platform:'instagram',handle:'@example'},{platform:'linkedin',handle:'https://www.linkedin.com/company/example/'},{platform:'x',handle:''}]});
 assert.equal(p.website,'https://example.com/');assert.equal(p.socials.length,2);assert.equal(p.socials[0].handle,'example');assert.equal(p.socials[1].handle,'https://www.linkedin.com/company/example/');assert.equal(websiteUrl(''),'');
 for(const value of ['javascript:alert(1)','https://user:pass@example.com','data:text/html,bad','https://bad host.com'])assert.throws(()=>websiteUrl(value));
 assert.throws(()=>normalizeBrandProfile({socials:[{platform:'unknown',handle:'test'}]}));assert.throws(()=>normalizeBrandProfile({socials:[{platform:'x',handle:'javascript:alert(1)'}]}));
});
test('brand save sends normalized links to the live persistence endpoint',async()=>{let sent;const service=Object.assign(Object.create(PortalData.prototype),{role:'sponsor',demo:false,rpc:async(name,p)=>{assert.equal(name,'save_brand_profile');sent=p;}});await service.saveProfile({display_name:'PACE',website:'example.com',socials:[{platform:'facebook',handle:'@pace'}]});assert.equal(sent.website,'https://example.com/');assert.deepEqual(sent.socials,[{platform:'facebook',handle:'pace'}]);});
