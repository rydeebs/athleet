// Operator CLI. Load .env.local via Node; never expose the service-role key in a browser.
import {createClient} from '@supabase/supabase-js';
import {socialUrl} from '../portal/media-kit.mjs';
const [action='list',id,observedCode,note]=process.argv.slice(2);
if(!['list','approve','reject'].includes(action)||action!=='list'&&(!id||!note)){
 console.error('Usage: node --env-file=.env.local scripts/review-socials.mjs list\n       ... approve <request-id> <code-observed-in-live-bio> "Evidence and reviewer note"\n       ... reject <request-id> - "Reason and reviewer note"');process.exit(1);
}
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY){console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the local environment.');process.exit(1);}
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await client.rpc('review_social_ownership',{p:{action,id,observed_code:observedCode,note}});
if(error){console.error(error.message);process.exit(1);}
if(action==='list')console.table(data.map(v=>({id:v.id,athlete:v.display_name,profile:socialUrl(v),code:v.code,requested:v.requested_at,expires:v.expires_at})));
else console.log(`Review ${data.id}: ${data.status}. ${data.valid_until?'Valid until '+data.valid_until:''}`);
