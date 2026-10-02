// Only publishable/legacy anon keys are ever returned. Secret/service-role keys fail closed.
export function portalConfig(env={}) {
 const url=env.SUPABASE_URL||'',key=env.SUPABASE_PUBLISHABLE_KEY||'';
 let publicKey=key.startsWith('sb_publishable_');
 if(!publicKey&&key.startsWith('eyJ'))try{publicKey=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';}catch{}
 let validUrl=false;try{const u=new URL(url);validUrl=u.protocol==='https:'&&u.hostname.endsWith('.supabase.co')&&u.pathname==='/';}catch{}
 return new Response(JSON.stringify(publicKey&&validUrl?{configured:true,url,key,payments:((p)=>({enabled:p.enabled,mode:p.mode,currency:p.currency,country:p.country}))(paymentConfiguration(env))}:{configured:false}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}

// Fail closed until the full payment environment and an explicit launch flag are present.
export function paymentConfiguration(env={}) {
 const mode=env.STRIPE_SECRET_KEY?.startsWith('sk_live_')?'live':'test';
 let origin='';try{const u=new URL(env.APP_URL);if(u.origin===env.APP_URL&&(u.protocol==='https:'||(mode==='test'&&u.origin==='http://localhost:4174')))origin=u.origin;}catch{}
 const wired=!!(origin&&/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY||'')&&env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')&&env.SUPABASE_SERVICE_ROLE_KEY&&env.SUPABASE_URL&&env.CRON_SECRET?.length>=32&&env.RESEND_API_KEY&&env.PAYMENT_ADMIN_USER_IDS?.split(',').some(s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim())));
 return {wired,enabled:wired&&env.PAYMENTS_ENABLED==='true'&&(mode==='test'||env.PAYMENTS_LIVE_APPROVED==='true'),mode,currency:'USD',country:'US',origin};
}
