import test from 'node:test';
import assert from 'node:assert/strict';
import {filterListings,newRace,validateRace,placementInfo,normalizeAvatar,safeProofUrl,defaultAvatar} from '../portal/model.mjs';
import {avatarStudio} from '../portal/avatar.mjs';
import {demoData} from '../portal/demo.mjs';
import {portalConfig} from '../server/portal-config.mjs';
const valid=()=>({...newRace(),event_name:'Mountain 200',race_date:'2099-05-05',location:'Boulder, CO',discipline:'Trail / ultramarathon',distance:'200K',rules_confirmed:true,status:'published'});
test('race validation accepts mixed disciplines and requires publish permissions',()=>{
 assert.equal(validateRace(valid()).distance,'200K');
 for(const [field,value] of [['placements',[]],['placements',['chest','chest']],['placements',['head']],['race_date','2000-01-01'],['asking_price',0],['asking_price',4.5],['rules_confirmed',false],['outfit','unknown'],['phase','unknown']])assert.throws(()=>validateRace({...valid(),[field]:value}));
 assert.equal(validateRace({...valid(),status:'draft',rules_confirmed:false}).status,'draft');
});
test('outfits change exposed-skin placements into kit placements',()=>{
 assert.equal(placementInfo('left-arm','shirtless').material,'skin');
 assert.equal(placementInfo('left-arm','long-sleeve').material,'kit');
 assert.equal(placementInfo('chest','singlet').material,'kit');
 assert.equal(placementInfo('left-arm','tri-suit').material,'skin');
});
test('sponsor discovery filters race location, not athlete home location',()=>{
 const d=demoData();const rows=d.listings.map(r=>({...r,profile:d.profiles.find(p=>p.id===r.athlete_id),reserved:[]}));
 assert.equal(filterListings(rows,{location:'Brooklyn'}).length,0);
 assert.equal(filterListings(rows,{location:'Philadelphia'})[0].athlete_id,'demo-athlete');
 assert.equal(filterListings(rows,{distance:'200K'})[0].event_name,'Mountain Endurance 200');
 assert.equal(filterListings(rows,{discipline:'Road running',budget:200}).length,1);
 assert.equal(filterListings(rows,{audience:40000})[0].athlete_id,'demo-maya');
 assert.equal(filterListings(rows,{from:'2099-01-01'}).length,0);
});
test('reserved or unpublished inventory is excluded from discovery',()=>{
 const row={...valid(),profile:{},reserved:['chest','left-arm']};
 assert.equal(filterListings([row]).length,0);
 assert.equal(filterListings([{...row,reserved:[],status:'draft'}]).length,0);
 assert.equal(filterListings([{...row,reserved:['chest'],outfit:'shirtless'}],{placement:'kit'}).length,0);
});
test('the sponsor canvas exposes only offered placements and escapes brand text',()=>{
 const markup=avatarStudio({avatar:defaultAvatar,outfit:'shirtless',available:['chest'],selected:['chest'],active:'chest',brand:'<img onerror=alert(1)>'});
 assert.ok(markup.includes('&quot;available&quot;:[&quot;chest&quot;]'));assert.ok(!markup.includes('class="body-hotspot'));assert.ok(!markup.includes('class="model-controls'));
 assert.ok(markup.includes('&lt;img'));assert.ok(!markup.includes('<img onerror'));
 assert.deepEqual(normalizeAvatar({skin:'" onload="bad',kit:'javascript:bad',build:'unknown'}),defaultAvatar);
});
test('proof links accept HTTPS only',()=>{assert.equal(safeProofUrl('javascript:alert(1)'),null);assert.equal(safeProofUrl('http://example.com'),null);assert.equal(safeProofUrl('https://example.com/photos'),'https://example.com/photos');});
test('portal configuration never returns privileged or malformed keys',async()=>{
 for(const key of ['sb_secret_example','',btoa('header')+'.'+btoa(JSON.stringify({role:'service_role'}))+'.signature']){
  const result=await portalConfig({SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:key}).json();assert.deepEqual(result,{configured:false});
 }
 assert.deepEqual(await portalConfig({SUPABASE_URL:'https://attacker.example',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}).json(),{configured:false});
 const config=await portalConfig({SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}).json();assert.equal(config.configured,true);
});
test('portal routes load directly and server files remain private',async()=>{
 const {default:worker}=await import('../dist/server/index.js');
 for(const path of ['/athletes','/sponsors','/athletes/','/sponsors/','/portal.js','/portal.css'])assert.equal((await worker.fetch(new Request('https://example.com'+path))).status,200);
 for(const path of ['/server/portal-config.mjs','/supabase/migrations/202609300001_portals.sql','/.env.local','/portal/data.mjs'])assert.equal((await worker.fetch(new Request('https://example.com'+path))).status,404);
 assert.deepEqual(await (await worker.fetch(new Request('https://example.com/api/portal-config'))).json(),{configured:false});
});

test('gender-aware placements, outfit coverage and scene preferences stay consistent',async()=>{
 const {availableZones,scenes}=await import('../portal/placements.mjs');
 const male=availableZones({gender:'male'}),female=availableZones({gender:'female'});
 assert.ok(male.includes('left-pec')&&male.includes('right-pec')&&!male.includes('cleavage'));
 assert.ok(female.includes('cleavage')&&!female.some(z=>z.endsWith('-pec')));
 for(const z of ['left-shoulder','right-forearm','left-calf','right-thigh','butt'])assert.ok(male.includes(z)&&female.includes(z));
 assert.equal(placementInfo('cleavage','sports-bra').material,'skin');assert.equal(placementInfo('left-forearm','tee').material,'skin');assert.equal(placementInfo('left-calf','wetsuit').material,'kit');
 for(const environment of Object.keys(scenes))assert.equal(normalizeAvatar({environment}).environment,environment);
 for(const environment of ['studio','beach','city','landscape','<script>'])assert.equal(normalizeAvatar({environment}).environment,'scifi');
});
