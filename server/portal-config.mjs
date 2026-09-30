// Only publishable/legacy anon keys are ever returned. Secret/service-role keys fail closed.
export function portalConfig(env={}) {
 const url=env.SUPABASE_URL||'',key=env.SUPABASE_PUBLISHABLE_KEY||'';
 let publicKey=key.startsWith('sb_publishable_');
 if(!publicKey&&key.startsWith('eyJ'))try{publicKey=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';}catch{}
 let validUrl=false;try{const u=new URL(url);validUrl=u.protocol==='https:'&&u.hostname.endsWith('.supabase.co')&&u.pathname==='/';}catch{}
 return new Response(JSON.stringify(publicKey&&validUrl?{configured:true,url,key}:{configured:false}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
