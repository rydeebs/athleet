import {assets} from './assets.mjs';
import {validateLookup,lookupAccount} from './social.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// A bounded per-isolate limiter avoids unbounded memory; Sites remains owner-private.
const limits=new Map();
export default {async fetch(request){
 const url=new URL(request.url);
 if(url.pathname==='/api/audience'){
  if(request.method!=='POST')return json({error:'Use POST.'},405);
  const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'Expected JSON.'},415);
  const ip=request.headers.get('CF-Connecting-IP')||'local';const now=Date.now();const current=limits.get(ip);if(current&&now-current.start<60000&&current.count>=6)return json({error:'Please wait a minute before trying again.'},429);
  if(limits.size>1000)limits.clear();limits.set(ip,current&&now-current.start<60000?{...current,count:current.count+1}:{start:now,count:1});
  let accounts;try{const body=await request.text();if(body.length>5000)return json({error:'Request too large.'},413);accounts=validateLookup(JSON.parse(body).accounts);}catch(error){return json({error:error.message||'Invalid accounts.'},400);}
  const results=await Promise.all(accounts.map(account=>lookupAccount(account)));return json({accounts:results});
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const path=url.pathname==='/'?'/index.html':url.pathname;const asset=assets[path];if(!asset)return new Response('Not found',{status:404,headers:{'Content-Type':'text/plain'}});
 return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
}};
