import test from 'node:test';
import assert from 'node:assert/strict';
import {pilotAttribution,pilotDestination} from '../invite.mjs';
import {PortalData} from '../portal/data.mjs';

test('invitation destinations stay on the real role-specific signup even with hostile query params',()=>{
 for(const [role,path] of [['athlete','/athletes'],['sponsor','/sponsors']]){
  const url=new URL(pilotDestination(role,'?campaign=hyrox-ig-01&demo=1&redirect=https://evil.example'), 'https://enduur.co');
  assert.equal(url.pathname,path);assert.equal(url.hash,'#profile');
  assert.equal(url.searchParams.get('invite'),'pilot');assert.equal(url.searchParams.get('campaign'),'hyrox-ig-01');
  assert.equal(url.searchParams.has('demo'),false);assert.equal(url.searchParams.has('redirect'),false);
 }
 assert.equal(pilotAttribution('?invite=pilot&campaign=%3Cscript%3E','athlete').campaign,'founding-pilot');
 assert.equal(pilotAttribution('?campaign=test','athlete'),null);
 assert.equal(pilotAttribution('?invite=pilot','admin'),null);
});

test('new account signup saves limited campaign attribution without changing redirect or sending an email in the test',async()=>{
 const before=globalThis.location;
 try{
  globalThis.location={pathname:'/sponsors',search:'?invite=pilot&campaign=brands-email-01',origin:'https://enduur.co'};
  const data=new PortalData();let sent;
  data.client={auth:{signUp:async payload=>{sent=payload;return {data:{session:null},error:null};}}};
  assert.equal(await data.signUp('test@example.com','unused-test-password'),false);
  assert.equal(sent.options.emailRedirectTo,'https://enduur.co/sponsors');
  assert.deepEqual(sent.options.data.pilot_invitation,{source:'pilot-invitation',campaign:'brands-email-01',role:'sponsor'});
  globalThis.location.search='';await data.signUp('test@example.com','unused-test-password');
  assert.equal(sent.options.data,undefined);
 }finally{if(before===undefined)delete globalThis.location;else globalThis.location=before;}
});
