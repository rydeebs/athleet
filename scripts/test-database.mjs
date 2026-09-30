import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'athleet-db-test-')),db=join(dir,'data');
function run(bin,args,input){const r=spawnSync(bin,args,{input,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||r.stdout||`Could not run ${bin}. Install PostgreSQL to run database tests.`);return r.stdout;}
function sql(input){return run('psql',['-h',dir,'-U','postgres','-d','postgres','-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],input).trim();}
const ids={athlete:'00000000-0000-0000-0000-000000000001',sponsor:'00000000-0000-0000-0000-000000000002',other:'00000000-0000-0000-0000-000000000003'};
const auth=(id,query,role='authenticated')=>`set role ${role};select set_config('request.jwt.claim.sub','${id||''}',false);${query}`;
const payload=o=>`'${JSON.stringify(o).replaceAll("'","''")}'::jsonb`;
let started=false,passed=0;
function check(name,fn){fn();passed++;console.log('✓ '+name);}
try{
 run('initdb',['-D',db,'-A','trust','-U','postgres','--no-locale','--encoding=UTF8']);
 run('pg_ctl',['-D',db,'-l',join(dir,'postgres.log'),'-o',`-F -k ${dir} -h ''`,'-w','start']);started=true;
 sql(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;insert into auth.users values ${Object.values(ids).map(id=>`('${id}')`).join(',')};`);
 sql(readFileSync('supabase/migrations/202609300001_portals.sql','utf8'));
 const profile={display_name:'Test Athlete',location:'Test city',bio:'',avatar:{},socials:[],audience:null};
 for(const id of Object.values(ids))sql(auth(id,`select public.save_portal_profile(${payload(profile)});select public.save_brand_profile(${payload({...profile,display_name:'Test Brand'})});`));
 check('athlete and sponsor profiles are separate for the same account',()=>{const s=JSON.parse(sql(auth(ids.athlete,'select public.portal_snapshot();')).split('\n').at(-1));assert.equal(s.profile.display_name,'Test Athlete');assert.equal(s.brand_profile.display_name,'Test Brand');});
 const race={event_name:'Test 50K',race_date:'2099-01-01',location:'Race city',discipline:'Trail / ultramarathon',distance:'50K',expected_field:1000,finish_band:'6–7h',outfit:'long-sleeve',phase:'Full race',placements:['chest','left-arm'],asking_price:350,deliverables:'One post and event photos',notes:'',status:'published',rules_confirmed:true};
 const rid=sql(auth(ids.athlete,`select public.save_race_listing(${payload(race)});`)).split('\n').at(-1);
 check('published races are discoverable without exposing private requests',()=>{const snap=JSON.parse(sql(auth(null,'select public.portal_snapshot();','anon')).split('\n').at(-1));assert.equal(snap.listings.length,1);assert.equal(snap.bookings.length,0);assert.equal(snap.profile,null);});
 check('anonymous users cannot create listings or requests',()=>assert.throws(()=>sql(auth(null,`select public.request_placement(${payload({listing_id:rid,placement:'chest',brand_name:'Example Brand'})});`,'anon')),/permission denied/));
 check('direct table access is denied even to signed-in accounts',()=>assert.throws(()=>sql(auth(ids.sponsor,'select * from public.sponsorship_requests;')),/permission denied/));
 check('athletes cannot edit somebody else’s race',()=>assert.throws(()=>sql(auth(ids.other,`select public.save_race_listing(${payload({...race,id:rid,event_name:'Hijacked'})});`)),/belongs to another/));
 check('unavailable or unknown placement requests are rejected',()=>assert.throws(()=>sql(auth(ids.sponsor,`select public.request_placement(${payload({listing_id:rid,placement:'head',brand_name:'Test Brand'})});`)),/unavailable/));
 const req=sponsor=>sql(auth(sponsor,`select public.request_placement(${payload({listing_id:rid,placement:'chest',brand_name:'Test Brand',message:'Private contact',brand_mark:'TEST'})});`)).split('\n').at(-1);
 const first=req(ids.sponsor),second=req(ids.other);
 check('another user cannot accept or read a private sponsor request',()=>{assert.throws(()=>sql(auth(ids.other,`select public.transition_booking(${payload({id:first,status:'accepted'})});`)),/can no longer/);const snap=JSON.parse(sql(auth(ids.other,'select public.portal_snapshot();')).split('\n').at(-1));assert.equal(snap.bookings.length,1);assert.equal(snap.bookings[0].id,second);});
 check('terms cannot change while a request is pending',()=>assert.throws(()=>sql(auth(ids.athlete,`select public.save_race_listing(${payload({...race,id:rid,asking_price:999})});`)),/Resolve existing/));
 sql(auth(ids.athlete,`select public.transition_booking(${payload({id:first,status:'accepted'})});`));
 check('accepting reserves the placement and declines competing requests',()=>{const snap=JSON.parse(sql(auth(ids.athlete,'select public.portal_snapshot();')).split('\n').at(-1));assert.equal(snap.bookings.find(b=>b.id===first).status,'accepted');assert.equal(snap.bookings.find(b=>b.id===second).status,'declined');assert.deepEqual(snap.listings[0].reserved,['chest']);assert.equal(snap.bookings[0].price,350);});
 check('a reserved spot cannot be booked a second time',()=>assert.throws(()=>req(ids.other),/already reserved/));
 check('sponsors cannot submit proof on behalf of athletes',()=>assert.throws(()=>sql(auth(ids.sponsor,`select public.transition_booking(${payload({id:first,status:'submitted',proof_url:'https://example.com/photos'})});`)),/can no longer/));
 check('unsafe proof links are rejected',()=>assert.throws(()=>sql(auth(ids.athlete,`select public.transition_booking(${payload({id:first,status:'submitted',proof_url:'javascript:alert(1)'})});`)),/HTTPS/));
 sql(auth(ids.athlete,`select public.transition_booking(${payload({id:first,status:'submitted',proof_url:'https://example.com/photos',proof_note:'Delivery'})});`));
 sql(auth(ids.sponsor,`select public.transition_booking(${payload({id:first,status:'completed'})});`));
 check('athlete proof can be approved by the sponsoring account',()=>{const snap=JSON.parse(sql(auth(ids.sponsor,'select public.portal_snapshot();')).split('\n').at(-1));assert.equal(snap.bookings[0].status,'completed');assert.equal(snap.bookings[0].proof_url,'https://example.com/photos');});
 const draftId=sql(auth(ids.athlete,`select public.save_race_listing(${payload({...race,status:'draft'})});`)).split('\n').at(-1);
 check('draft listings are visible only to their owner',()=>{const pub=JSON.parse(sql(auth(null,'select public.portal_snapshot();','anon')).split('\n').at(-1));assert.ok(!pub.listings.some(r=>r.id===draftId));const mine=JSON.parse(sql(auth(ids.athlete,'select public.portal_snapshot();')).split('\n').at(-1));assert.ok(mine.listings.some(r=>r.id===draftId));});
 check('published placements require an event permission confirmation',()=>assert.throws(()=>sql(auth(ids.athlete,`select public.save_race_listing(${payload({...race,rules_confirmed:false})});`)),/check constraint/));
 console.log(`${passed} database integration checks passed on an isolated PostgreSQL database.`);
}finally{if(started)run('pg_ctl',['-D',db,'-m','fast','-w','stop']);rmSync(dir,{recursive:true,force:true});}
