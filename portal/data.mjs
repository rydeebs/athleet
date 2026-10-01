import {normalizeBrandProfile} from './brand.mjs';
import {createClient} from '@supabase/supabase-js';
import {demoData} from './demo.mjs';
import {validateRace,safeProofUrl,defaultProfile,normalizeAvatar} from './model.mjs';
import {validateMeasurements,validatePerformances} from './performance.mjs';
import {demoEvidence} from './evidence.mjs';
const DEMO_KEY='athleet.portal.demo.v1';
export class PortalData {
 constructor(){this.demo=new URLSearchParams(location.search).get('demo')==='1';this.role=location.pathname.startsWith('/sponsors')?'sponsor':'athlete';}
 async init(){
  if(this.demo){try{this.db=JSON.parse(localStorage.getItem(DEMO_KEY))||demoData();}catch{this.db=demoData();}this.user={id:this.role==='athlete'?'demo-athlete':'demo-sponsor'};return;}
  const response=await fetch('/api/portal-config');if(!response.ok)throw new Error('Could not load account settings. Refresh to try again.');
  const c=await response.json();this.configured=c.configured;
  if(!c.configured)return;
  this.client=createClient(c.url,c.key,{auth:{storage:sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  this.client.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')this.recovery=true;});
  const {data,error}=await this.client.auth.getSession();if(error)throw error;this.user=data.session?.user;
 }
 async snapshot(){
  if(!this.demo){if(!this.client)return {profile:null,listings:[],bookings:[],shortlist:[]};const {data,error}=await this.client.rpc('portal_snapshot');if(error)throw new Error('Could not load the marketplace. Check the database setup or try again.');if(this.role==='sponsor')data.profile=data.brand_profile;
  this.evidencePaths=(data.profile?.performances||[]).map(r=>r.evidence_path);if(data.profile)data.profile={...defaultProfile,...data.profile,avatar:normalizeAvatar(data.profile.avatar)};return data;}
  this.evidencePaths=(this.db.profiles.find(p=>p.id===this.user.id)?.performances||[]).map(r=>r.evidence_path);
  const sponsorMarks=id=>this.db.bookings.filter(b=>b.listing_id===id&&['accepted','submitted','completed'].includes(b.status)).map(b=>({placement:b.placement,brand_name:b.brand_name,brand_mark:b.brand_mark,brand_artwork:b.brand_artwork,status:b.status}));
  const listingWithProfile=r=>r?{...r,profile:this.db.profiles.find(p=>p.id===r.athlete_id),sponsors:sponsorMarks(r.id)}:null;
  const listings=this.db.listings.filter(r=>r.status==='published'||r.athlete_id===this.user.id).map(r=>({...listingWithProfile(r),reserved:this.db.bookings.filter(b=>b.listing_id===r.id&&['accepted','submitted','completed'].includes(b.status)).map(b=>b.placement)}));
  return {profile:this.db.profiles.find(p=>p.id===this.user.id),listings,bookings:this.db.bookings.filter(b=>b.sponsor_id===this.user.id||this.db.listings.find(r=>r.id===b.listing_id)?.athlete_id===this.user.id).map(b=>({...b,listing:listingWithProfile(this.db.listings.find(r=>r.id===b.listing_id))})),shortlist:this.db.shortlist.filter(s=>s.user_id===this.user.id).map(s=>s.listing_id)};
 }
 persist(){localStorage.setItem(DEMO_KEY,JSON.stringify(this.db));}
 async rpc(name,p){const {data,error}=await this.client.rpc(name,{p});if(error)throw new Error(error.message);return data;}
 async saveProfile(p){
  if(this.role!=='athlete'){p=normalizeBrandProfile(p);if(!this.demo)return this.rpc('save_brand_profile',p);const i=this.db.profiles.findIndex(r=>r.id===this.user.id);const before=this.db.profiles[i];if(i<0)this.db.profiles.push({...p,id:this.user.id});else this.db.profiles[i]={...p,id:this.user.id};try{this.persist();}catch(e){if(i<0)this.db.profiles.pop();else this.db.profiles[i]=before;throw e;}return;}
  validateMeasurements(p);validatePerformances(p.performances||[],{pending:true});
  const next={...p,height_cm:p.height_cm==null||p.height_cm===''?null:Number(p.height_cm),weight_kg:p.weight_kg==null||p.weight_kg===''?null:Number(p.weight_kg),performances:[]},uploaded=[];
  try{
   for(const result of p.performances||[]){const {evidence_file,...r}=result;if(evidence_file){if(evidence_file.type!=='image/jpeg'||evidence_file.size>2*1024*1024)throw new Error('Prepare a valid evidence image first.');r.evidence_path=`${this.user.id}/${crypto.randomUUID()}.jpg`;if(this.demo)await demoEvidence('put',r.evidence_path,evidence_file);else{const {error}=await this.client.storage.from('performance-evidence').upload(r.evidence_path,evidence_file,{contentType:'image/jpeg',upsert:false});if(error)throw new Error('Could not upload evidence. Check your connection and storage setup.');}uploaded.push(r.evidence_path);}if(!r.evidence_path?.startsWith(this.user.id+'/'))throw new Error('Evidence must belong to your account.');next.performances.push(r);}
   if(this.demo){for(const r of next.performances)if(!await demoEvidence('get',r.evidence_path))throw new Error('Evidence is missing from this device. Replace the image before saving.');const before=this.db.profiles;this.db.profiles=this.db.profiles.filter(r=>r.id!==this.user.id).concat({...next,id:this.user.id});try{this.persist();}catch(e){this.db.profiles=before;throw e;}}
   else await this.rpc('save_portal_profile',next);
  }catch(e){await Promise.allSettled(uploaded.map(path=>this.demo?demoEvidence('delete',path):this.client.storage.from('performance-evidence').remove([path])));throw e;}
  const retained=next.performances.map(r=>r.evidence_path),obsolete=(this.evidencePaths||[]).filter(path=>!retained.includes(path));this.evidencePaths=retained;await Promise.allSettled(obsolete.map(path=>this.demo?demoEvidence('delete',path):this.client.storage.from('performance-evidence').remove([path])));
  return next;
 }
 async evidenceUrl(result){if(result.evidence_file)return URL.createObjectURL(result.evidence_file);if(this.demo){const blob=await demoEvidence('get',result.evidence_path);if(!blob)throw new Error('This evidence image is no longer on this device. Ask the athlete to replace it.');return URL.createObjectURL(blob);}if(!this.user)throw new Error('Sign in as a sponsor to view evidence.');const {data,error}=await this.client.storage.from('performance-evidence').createSignedUrl(result.evidence_path,300);if(error)throw new Error('Could not open evidence. Sign in as a sponsor or try again.');return data.signedUrl;}
 async saveRace(p){validateRace(p);if(!this.demo)return this.rpc('save_race_listing',p);const old=this.db.listings.find(r=>r.id===p.id);if(old&&old.athlete_id!==this.user.id)throw new Error('This listing belongs to another athlete.');if(old&&this.db.bookings.some(b=>b.listing_id===old.id&&['pending','accepted','submitted','completed'].includes(b.status)))throw new Error('Resolve existing requests before changing this listing. Confirmed listings are locked.');const race={...p,id:p.id||crypto.randomUUID(),athlete_id:this.user.id};this.db.listings=old?this.db.listings.map(r=>r.id===old.id?race:r):[race,...this.db.listings];this.persist();return race.id;}
 async shortlist(id,on){if(!this.demo)return this.rpc('set_shortlist',{listing_id:id,on});this.db.shortlist=this.db.shortlist.filter(s=>!(s.user_id===this.user.id&&s.listing_id===id));if(on)this.db.shortlist.push({user_id:this.user.id,listing_id:id});this.persist();}
 async artworkUrl(path){if(!path)return '';if(this.demo){const blob=await demoEvidence('get','artwork:'+path);if(!blob)throw new Error('Saved logo is unavailable on this device.');return URL.createObjectURL(blob);}if(!this.user)return '';const {data,error}=await this.client.storage.from('brand-artwork').createSignedUrl(path,900);if(error)throw new Error('Saved artwork is unavailable. Brand name shown instead.');return data.signedUrl;}
 async request(p,artwork){let path;try{if(artwork){if(artwork.type!=='image/png'||artwork.size>2*1024*1024)throw new Error('Use a prepared PNG logo under 2 MB.');path=`${this.user.id}/${crypto.randomUUID()}.png`;if(this.demo)await demoEvidence('put','artwork:'+path,artwork);else{const {error}=await this.client.storage.from('brand-artwork').upload(path,artwork,{contentType:'image/png',upsert:false});if(error)throw new Error('Logo upload failed. Check your connection and Storage setup.');}}await this.requestPlacement({...p,brand_artwork:path||null});}catch(error){if(path)await Promise.allSettled([this.demo?demoEvidence('delete','artwork:'+path):this.client.storage.from('brand-artwork').remove([path])]);throw error;}}
 async requestPlacement(p){
  if(!this.demo)return this.rpc('request_placement',p);
  const race=this.db.listings.find(r=>r.id===p.listing_id);
  if(!race||race.athlete_id===this.user.id||race.status!=='published')throw new Error('Choose another athlete’s published listing.');
  if(!race.placements.includes(p.placement))throw new Error('This placement is no longer available.');
  if(this.db.bookings.some(b=>b.listing_id===race.id&&b.placement===p.placement&&(['accepted','submitted','completed'].includes(b.status)||(b.sponsor_id===this.user.id&&b.status==='pending'))))throw new Error('This placement is already requested or reserved.');
  const before=this.db.bookings;this.db.bookings=[{...p,id:crypto.randomUUID(),sponsor_id:this.user.id,status:'pending',created_at:new Date().toISOString(),price:race.asking_price,deliverables:race.deliverables,proof_url:null,proof_note:''},...before];try{this.persist();}catch(error){this.db.bookings=before;throw error;}
 }
 async transition(id,status,proof={}){
  if(!this.demo)return this.rpc('transition_booking',{id,status,...proof});
  const b=this.db.bookings.find(b=>b.id===id),r=this.db.listings.find(r=>r.id===b?.listing_id),athlete=r?.athlete_id===this.user.id,sponsor=b?.sponsor_id===this.user.id;
  if(!b||!((athlete&&b.status==='pending'&&['accepted','declined'].includes(status))||(sponsor&&b.status==='pending'&&status==='cancelled')||(athlete&&b.status==='accepted'&&status==='submitted')||(sponsor&&b.status==='submitted'&&status==='completed')))throw new Error('This request can no longer be changed that way.');
  if(status==='accepted'&&this.db.bookings.some(x=>x.id!==id&&x.listing_id===b.listing_id&&x.placement===b.placement&&['accepted','submitted','completed'].includes(x.status)))throw new Error('This placement is already reserved.');
  if(status==='submitted'&&!safeProofUrl(proof.proof_url))throw new Error('Add an HTTPS link to your event photos and posts.');
  Object.assign(b,{status,...proof});if(status==='accepted')for(const x of this.db.bookings)if(x.id!==id&&x.listing_id===b.listing_id&&x.placement===b.placement&&x.status==='pending')x.status='declined';this.persist();
 }
 async signIn(email,password){const {data,error}=await this.client.auth.signInWithPassword({email,password});if(error)throw error;this.user=data.user;}
 async signUp(email,password){const {data,error}=await this.client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/'+(this.role==='athlete'?'athletes':'sponsors')}});if(error)throw error;this.user=data.session?.user;return !!data.session;}
 async reset(email){const {error}=await this.client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/'+(this.role==='athlete'?'athletes':'sponsors')});if(error)throw error;}
 async updatePassword(password){const {error}=await this.client.auth.updateUser({password});if(error)throw error;this.recovery=false;}
 async signOut(){if(this.client)await this.client.auth.signOut();location.href='/'+(this.role==='athlete'?'athletes':'sponsors');}
}
