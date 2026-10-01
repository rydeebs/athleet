// Opt-in hosted integration check. Creates disposable users/data, then removes only those records.
// Requires .env.local and SUPABASE_ACCESS_TOKEN. Never prints credentials or sends email.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
if(!process.argv.includes('--allow-live-test'))throw Error('Explicit --allow-live-test is required.');
const env=Object.fromEntries(readFileSync('.env.local','utf8').trim().split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const url=env.SUPABASE_URL,ref=new URL(url).hostname.split('.')[0];
assert.equal(ref,readFileSync('supabase/.temp/project-ref','utf8').trim(),'Local config must match the linked project.');
if(!process.env.SUPABASE_ACCESS_TOKEN)throw Error('SUPABASE_ACCESS_TOKEN is required for scoped test cleanup.');
const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref',ref,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const adminKey=keys.find(k=>k.name==='service_role')?.api_key;
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,adminKey,options),anon=createClient(url,env.SUPABASE_PUBLISHABLE_KEY,options);
const users=[],objects=[];let raceId;let passed=0;
const ok=(name)=>{passed++;console.log('✓ '+name);};
async function value(promise){const {data,error}=await promise;if(error)throw Error(error.message);return data;}
async function rpc(client,name,p){return value(client.rpc(name,p?{p}:undefined));}
async function query(sql){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});if(!r.ok)throw Error(`Test cleanup SQL failed (${r.status})`);return r.json();}
try{
 for(const role of ['athlete','brand']){const email=`athleet-check-${role}-${randomUUID()}@example.com`,password=randomUUID()+'aA!9';const u=await value(admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{athleet_test:true}}));users.push(u.user.id);const client=createClient(url,env.SUPABASE_PUBLISHABLE_KEY,options);await value(client.auth.signInWithPassword({email,password}));users[role]=client;}
 const athlete=users.athlete,brand=users.brand;
 ok('two isolated accounts sign in against hosted Auth (no email sent)');
 await rpc(athlete,'save_portal_profile',{display_name:'Athleet integration test',location:'Test city',bio:'Disposable test profile',avatar:{},socials:[],audience:null});
 await rpc(brand,'save_brand_profile',{display_name:'Athleet test brand',location:'Test city',bio:'Disposable test profile',website:'https://example.com',socials:[{platform:'instagram',handle:'athleet_test'}]});
 assert.equal((await rpc(brand,'portal_snapshot')).brand_profile.website,'https://example.com');ok('athlete and brand profiles persist with brand links');
 const ep=`${users[0]}/${randomUUID()}.jpg`;const jpeg=await sharp({create:{width:32,height:32,channels:3,background:'#dddddd'}}).jpeg().toBuffer();
 await value(athlete.storage.from('performance-evidence').upload(ep,jpeg,{contentType:'image/jpeg'}));objects.push(['performance-evidence',ep]);
 await rpc(athlete,'save_portal_profile',{display_name:'Athleet integration test',location:'Test city',bio:'Disposable test profile',avatar:{},socials:[],height_cm:180,weight_kg:75,performances:[{id:randomUUID(),event_name:'Test result',location:'Test city',discipline:'HYROX',distance:'Singles Open',year:2025,place:5,ranking:'Overall',division:'',field_size:100,finish_time:'1:12:35',evidence_path:ep}]});
 const date=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 raceId=await rpc(athlete,'save_race_listing',{event_name:'TEST — temporary integration check',race_date:date,location:'Test city',discipline:'HYROX',distance:'Singles Open',expected_field:100,finish_band:'Top half',outfit:'shirtless',phase:'Full race',placements:['left-pec'],asking_price:250,deliverables:'Test post and proof',notes:'Temporary automated check; not bookable inventory',status:'published',rules_confirmed:true});
 assert.ok((await rpc(brand,'portal_snapshot')).listings.some(r=>r.id===raceId));ok('race listing and evidence-backed results are discoverable');
 const signed=await value(brand.storage.from('performance-evidence').createSignedUrl(ep,60));assert.equal((await fetch(signed.signedUrl)).status,200);
 assert.ok((await anon.storage.from('performance-evidence').createSignedUrl(ep,60)).error);ok('hosted evidence upload and sponsor signed URL work; anonymous access denied');
 assert.ok((await brand.from('sponsorship_requests').select('*')).error);ok('direct table access stays blocked');
 const ap=`${users[1]}/${randomUUID()}.png`,png=await sharp({create:{width:32,height:32,channels:4,background:'#20342a'}}).png().toBuffer();
 await value(brand.storage.from('brand-artwork').upload(ap,png,{contentType:'image/png'}));objects.push(['brand-artwork',ap]);
 const booking=await rpc(brand,'request_placement',{listing_id:raceId,placement:'left-pec',brand_name:'Athleet test brand',brand_mark:'TEST',message:'Disposable test',brand_artwork:ap});
 await rpc(brand,'set_shortlist',{listing_id:raceId,on:true});
 assert.ok((await rpc(brand,'portal_snapshot')).shortlist.includes(raceId));
 const logo=await value(athlete.storage.from('brand-artwork').createSignedUrl(ap,60));assert.equal((await fetch(logo.signedUrl)).status,200);ok('shortlist, sponsor request and private artwork work');
 const b=(await rpc(athlete,'portal_snapshot')).bookings.find(b=>b.listing_id===raceId);assert.ok(b);
 await rpc(athlete,'transition_booking',{id:b.id,status:'accepted'});
 assert.ok((await rpc(brand,'portal_snapshot')).listings.find(r=>r.id===raceId).reserved.includes('left-pec'));ok('athlete approval reserves the placement');
 assert.ok((await brand.rpc('request_placement',{p:{listing_id:raceId,placement:'left-pec',brand_name:'Athleet test brand'}})).error);ok('reserved placement cannot be requested again');
 await rpc(athlete,'transition_booking',{id:b.id,status:'submitted',proof_url:'https://example.com/test-proof',proof_note:'Integration test'});
 await rpc(brand,'transition_booking',{id:b.id,status:'completed'});assert.equal((await rpc(brand,'portal_snapshot')).bookings.find(x=>x.id===b.id).status,'completed');ok('proof submission and sponsor approval complete the partnership');
 console.log(`${passed} hosted integration checks passed.`);
}finally{
 // Generated UUIDs only; never touches pre-existing users or listings.
 if(raceId){assert.match(raceId,/^[a-f0-9-]{36}$/);await query(`begin; delete from public.sponsorship_requests where listing_id='${raceId}'; delete from public.race_listings where id='${raceId}'; commit;`);}
 for(const [bucket,path] of objects)await value(admin.storage.from(bucket).remove([path]));
 for(const id of users)await value(admin.auth.admin.deleteUser(id));
 console.log('Removed the disposable accounts, listings, requests and uploaded files.');
}
