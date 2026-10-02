import Stripe from 'stripe';
import {createClient} from '@supabase/supabase-js';
import {timingSafeEqual} from 'node:crypto';
import {paymentConfiguration} from './portal-config.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const idOf=o=>typeof o==='string'?o:o?.id;
const ready=a=>a.country==='US'&&a.details_submitted&&a.payouts_enabled&&a.capabilities?.transfers==='active';
const equal=(a,b)=>!!a&&!!b&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function bodyText(request,limit=65536){
 if(Number(request.headers.get('content-length'))>limit)throw fail('Request too large.',413);
 const reader=request.body?.getReader();if(!reader)return '';const parts=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw fail('Request too large.',413);}parts.push(value);}}finally{reader.releaseLock();}
 return Buffer.concat(parts).toString('utf8');
}
export function settlementAmounts(athlete,total,earned){
 if(![athlete,total,earned].every(Number.isSafeInteger)||athlete<=0||total<athlete||earned<0||earned>athlete)throw fail('Invalid settlement.');
 return {athleteCents:earned,refundCents:total-Math.round(total*earned/athlete)};
}
// Dependencies are injectable so money movements can be tested without making any Stripe charges.
export function createPaymentService(env,{stripe,db,now=()=>Date.now(),fetchImpl=fetch}={}){
 const config=paymentConfiguration(env),livemode=config.mode==='live';
 stripe??=new Stripe(env.STRIPE_SECRET_KEY||'sk_test_unconfigured',{maxNetworkRetries:2,timeout:15000});
 db??=createClient(env.SUPABASE_URL||'https://unconfigured.supabase.co',env.SUPABASE_SERVICE_ROLE_KEY||'unconfigured',{auth:{persistSession:false,autoRefreshToken:false}});
 const admins=(env.PAYMENT_ADMIN_USER_IDS||'').split(',').map(s=>s.trim()).filter(s=>uuid.test(s));
 async function rpc(action,p={}){const {data,error}=await db.rpc('payment_service',{action,p:{...p,livemode}});if(error)throw fail(error.message);return data;}
 async function get(id){if(!uuid.test(id||''))throw fail('Invalid booking.');return rpc('get',{id});}
 async function account(user){
  let row=await rpc('account-get',{user_id:user.id});
  if(!row.stripe_account){
   // Account creation retries beyond Stripe's idempotency retention need manual reconciliation.
   if(now()-Date.parse(row.created_at)>23*3600000)throw fail('Payout setup needs a support check before retrying.');
   const a=await stripe.accounts.create({type:'express',country:'US',email:user.email,capabilities:{transfers:{requested:true}},metadata:{enduur_user_id:user.id}}, {idempotencyKey:`enduur-account-${user.id}-${livemode}`});
   row=await rpc('account-save',{user_id:user.id,account:a.id,ready:ready(a)});
  }
  const a=await stripe.accounts.retrieve(row.stripe_account);
  return rpc('account-save',{user_id:user.id,account:a.id,ready:ready(a)});
 }
 async function reconcile(session){
  if(session.mode!=='payment'||session.livemode!==livemode||session.payment_status!=='paid')return false;
  const v=await get(session.client_reference_id);
  if(session.metadata?.booking_id!==v.booking_id||session.id!==v.checkout_session||session.amount_total!==v.total_cents||session.currency!==v.currency)throw fail('Checkout verification failed.');
  const pi=await stripe.paymentIntents.retrieve(idOf(session.payment_intent));
  if(pi.status!=='succeeded'||pi.livemode!==livemode||pi.amount_received!==v.total_cents||pi.currency!==v.currency||pi.metadata?.booking_id!==v.booking_id||!pi.latest_charge)throw fail('Payment verification failed.');
  await rpc('paid',{id:v.booking_id,amount:pi.amount_received,currency:pi.currency,intent:pi.id,charge:idOf(pi.latest_charge)});return true;
 }
 function checkoutParams(v){return {
  mode:'payment',payment_method_types:['card'],client_reference_id:v.booking_id,
  metadata:{booking_id:v.booking_id},payment_intent_data:{metadata:{booking_id:v.booking_id},transfer_group:`enduur_${v.booking_id}`},
  line_items:[{quantity:1,price_data:{currency:v.currency,unit_amount:v.total_cents,product_data:{name:`Race-day sponsorship · ${v.event_name}`,description:'One placement and the agreed deliverables. Full sponsor price.'}}}],
  expires_at:Math.floor(Date.parse(v.checkout_expires_at)/1000),
  success_url:`${config.origin}/sponsors?checkout=returned#requests`,cancel_url:`${config.origin}/sponsors#requests`
 };}
 async function createSession(v){
  // Never retry an unknown creation after Stripe may have discarded its idempotency key.
  if(now()-Date.parse(v.checkout_created_at)>23*3600000)throw fail('Checkout needs a support reconciliation. No new charge was created.');
  const s=await stripe.checkout.sessions.create(checkoutParams(v),{idempotencyKey:`enduur-checkout-${v.checkout_key}`});
  await rpc('checkout-save',{id:v.booking_id,key:v.checkout_key,session:s.id});return s;
 }
 async function checkout(id,user){
  let v=await get(id);if(v.sponsor_id!==user.id)throw fail('This booking belongs to another sponsor.',403);
  if(v.state!=='unpaid'||v.booking_status!=='accepted')throw fail('This booking is not awaiting payment.');
  if(v.checkout_session){const old=await stripe.checkout.sessions.retrieve(v.checkout_session);if(await reconcile(old))return {paid:true};if(old.status==='open')return {url:old.url};if(old.status!=='expired')throw fail('Stripe is still processing this checkout.');v=await rpc('checkout-reset',{id,session:old.id});}
  v=await rpc('checkout-claim',{id,actor:user.id});
  // Recheck Stripe readiness; a previously enabled account may now have restrictions.
  const a=await stripe.accounts.retrieve(v.stripe_account);await rpc('account-save',{user_id:v.athlete_id,account:a.id,ready:ready(a)});
  if(!ready(a))throw fail('The athlete must finish their payout setup before payment.');
  const s=await createSession(v);if(await reconcile(s))return {paid:true};return {url:s.url};
 }
 async function expire(v){
  if(!v.checkout_session&&v.checkout_created_at){
   // A lost response from Stripe cannot safely be treated as an unpaid reservation.
   await rpc('stripe-issue',{id:v.booking_id,reason:'Unconfirmed checkout creation. Reconcile Stripe before cancelling.'});return;
  }
  if(v.checkout_session){let s=await stripe.checkout.sessions.retrieve(v.checkout_session);if(s.status==='open'){try{s=await stripe.checkout.sessions.expire(s.id);}catch{s=await stripe.checkout.sessions.retrieve(s.id);}}
   if(await reconcile(s))return;if(s.status!=='expired')throw fail('Checkout not yet safe to expire.');
  }
  await rpc('expire',{id:v.booking_id});
 }
 async function settle(id){
  let v=await rpc('settle-claim',{id});
  if(now()-Date.parse(v.operation_at)>23*3600000){await rpc('stripe-issue',{id,reason:'Settlement retry window exceeded. Reconcile Stripe before any further transfer.'});return;}
  const amounts=settlementAmounts(v.athlete_cents,v.total_cents,v.earned_cents);
  const charge=await stripe.charges.retrieve(v.charge_id);
  if(charge.disputed||charge.amount!==v.total_cents||charge.currency!==v.currency||idOf(charge.payment_intent)!==v.payment_intent){await rpc('stripe-issue',{id,reason:'Stripe charge requires manual reconciliation before settlement.'});return;}
  if(amounts.refundCents){
   let refund=v.refund_id?await stripe.refunds.retrieve(v.refund_id):null;
   if(!refund){
    // Recover a response lost after refund creation before deciding an external refund occurred.
    const refunds=await stripe.refunds.list({charge:v.charge_id,limit:100});
    refund=refunds.data.find(r=>r.metadata?.operation_key===v.operation_key);
    if(refunds.data.some(r=>r.id!==refund?.id&&r.status!=='failed'&&r.status!=='canceled')){await rpc('stripe-issue',{id,reason:'Unexpected refund. Reconcile before paying the athlete.'});return;}
    refund??=await stripe.refunds.create({charge:v.charge_id,amount:amounts.refundCents,metadata:{booking_id:id,operation_key:v.operation_key}},{idempotencyKey:`enduur-refund-${v.operation_key}`});
   }
   if(refund.amount!==amounts.refundCents||idOf(refund.charge)!==v.charge_id)throw fail('Refund mismatch.');
   // Persist the ID even while pending, so retries retrieve rather than create again.
   v=await rpc('refund-record',{id,key:v.operation_key,refund:refund.id,amount:refund.status==='succeeded'?refund.amount:0});
   if(['failed','canceled'].includes(refund.status)){await rpc('stripe-issue',{id,reason:'Stripe refund failed. Manual reconciliation required.'});return;}
   if(refund.status!=='succeeded')return;
  }else if(charge.amount_refunded){await rpc('stripe-issue',{id,reason:'Unexpected refund. Reconcile before paying the athlete.'});return;}
  let transfer;
  if(amounts.athleteCents){
   const currentCharge=await stripe.charges.retrieve(v.charge_id);if(currentCharge.disputed||currentCharge.amount_refunded!==amounts.refundCents){await rpc('stripe-issue',{id,reason:'Charge changed during settlement. Reconcile before any transfer.'});return;}
   const a=await stripe.accounts.retrieve(v.stripe_account);if(!ready(a))throw fail('Athlete payout account needs attention; settlement will retry.');
   transfer=await stripe.transfers.create({amount:amounts.athleteCents,currency:v.currency,destination:v.stripe_account,source_transaction:v.charge_id,transfer_group:`enduur_${id}`,metadata:{booking_id:id,operation_key:v.operation_key}},{idempotencyKey:`enduur-transfer-${v.operation_key}`});
  }
  await rpc('settled',{id,key:v.operation_key,transfer:transfer?.id||''});
 }
 async function notifyParticipants(){
  const queue=await rpc('notification-queue'),results=[];
  for(const n of queue){try{
   const v=await get(n.booking_id),{data,error}=await db.auth.admin.getUserById(n.recipient);
   if(error||!data.user?.email)throw fail('Recipient account needs review.');
   const isSponsor=v.sponsor_id===n.recipient,role=isSponsor?'sponsors':'athletes';
   const descriptions={accepted:'The athlete accepted your booking. Pay by the deadline in your portal to keep the reservation. Do not request work before payment is secured.',paid:'Sponsor payment is secured. You can begin the agreed work. Check the booking brief and proof deadline in your portal.',proof:'The athlete submitted complete proof. Unless you have already approved or reported an issue, you have 72 hours from this notice to review it. If you do neither, payout becomes eligible for automatic release. See the portal for current status.',issue:'This booking needs review. Payout is paused until the issue is resolved. Open the portal to see the reason and provide any missing evidence.',resolution:'Enduur recorded a resolution based on the agreed work. Any payout or refund is queued. Read the explanation in your portal.',settled:'The booking settlement is recorded. Your portal shows the athlete transfer and any sponsor refund. Bank arrival follows Stripe and your bank’s schedule.'};
   const title={accepted:'Booking accepted',paid:'Payment secured',proof:'Review your race-day proof',issue:'Booking review requested',resolution:'Payment resolution recorded',settled:'Booking payment update'}[n.kind];
   const recipients=[data.user.email];
   const bcc=[];if(n.kind==='issue')for(const operator of admins){if(operator===n.recipient)continue;const u=await db.auth.admin.getUserById(operator);if(u.data?.user?.email&&!recipients.includes(u.data.user.email))bcc.push(u.data.user.email);}
   const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':`enduur-${n.booking_id}-${n.kind}-${n.recipient}`},body:JSON.stringify({from:env.PAYMENTS_FROM_EMAIL||'enduur <accounts@enduur.co>',to:recipients,...(bcc.length?{bcc}:{}),subject:`${title} · ${v.event_name}`,text:`${descriptions[n.kind]}\n\nEvent: ${v.event_name}\nBooking: ${v.booking_id}\n${config.origin}/${role}#requests\n\n${n.kind==='issue'?'Enduur operators: open the athlete portal > Payouts > Review disputed payments.':''}`}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw fail('Payment email is awaiting delivery.');
   await rpc('notification-sent',{id:n.booking_id,kind:n.kind,recipient:n.recipient});results.push({id:n.booking_id,ok:true});
  }catch{results.push({id:n.booking_id,ok:false,error:'Payment notification pending; check email service.'});}}
  return results;
 }
 async function sweep(){
  const notifications=await notifyParticipants();
  const queue=await rpc('queue'),results=[];
  for(const item of queue){try{let v=await rpc('tick',{id:item.booking_id});if(v.state==='unpaid')await expire(v);else if(['release_ready','processing'].includes(v.state))await settle(v.booking_id);results.push({id:item.booking_id,ok:true});}catch(error){results.push({id:item.booking_id,ok:false,error:error.status?error.message:'Payment provider unavailable; retry pending.'});}}
  return {results,notifications};
 }
 async function authenticated(request){const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)throw fail('Sign in to continue.',401);const {data,error}=await db.auth.getUser(token);if(error||!data.user)throw fail('Your session expired. Sign in again.',401);return data.user;}
 async function handle(request){
  try{
   if(request.method!=='POST')return json({error:'Method not allowed.'},405);
   if(!config.enabled)throw fail('Payments are not open yet. You can still create a profile and send requests.',503);
   if(request.headers.get('origin')!==config.origin)throw fail('Invalid request origin.',403);
   const user=await authenticated(request),p=JSON.parse(await bodyText(request));
   if(p.action==='status')return json({enabled:true,mode:config.mode,admin:admins.includes(user.id)});
   if(p.action==='onboard'||p.action==='account-status'||p.action==='dashboard'){
    const a=await account(user);
    if(p.action==='account-status')return json({ready:a.ready});
    if(p.action==='dashboard')return json({url:(await stripe.accounts.createLoginLink(a.stripe_account)).url});
    const url=`${config.origin}/athletes#payments`;
    return json({url:(await stripe.accountLinks.create({account:a.stripe_account,type:'account_onboarding',refresh_url:url,return_url:url})).url});
   }
   if(p.action==='checkout')return json(await checkout(p.id,user));
   if(p.action==='sync'){
    const v=await get(p.id);if(v.sponsor_id!==user.id&&v.athlete_id!==user.id)throw fail('Booking unavailable.',403);
    if(v.checkout_session&&v.state==='unpaid')await reconcile(await stripe.checkout.sessions.retrieve(v.checkout_session));return json({ok:true});
   }
   if(!admins.includes(user.id))throw fail('Action unavailable.',403);
   if(p.action==='review-list')return json({cases:await rpc('review-list')});
   if(p.action==='resolve'){
    if(!Number.isSafeInteger(p.earned_cents)||typeof p.reason!=='string'||p.reason.trim().length<10||p.reason.length>1500)throw fail('Enter the earned amount and evidence-based explanation.');
    const v=await get(p.id);if(p.earned_cents<0||p.earned_cents>v.athlete_cents)throw fail('Earned amount is outside the contract.');
    await rpc('resolve',{id:p.id,actor:user.id,earned_cents:p.earned_cents,reason:p.reason.trim()});return json({ok:true});
   }
   throw fail('Unknown action.');
  }catch(error){return json({error:error.status?error.message:error instanceof SyntaxError?'Invalid JSON.':'Payment service unavailable. Please retry.'},error.status|| (error instanceof SyntaxError?400:502));}
 }
 async function webhook(request){
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);
  if(!config.wired)return json({error:'Payments not configured.'},503);
  let event;try{const raw=await bodyText(request,262144);for(const secret of [env.STRIPE_WEBHOOK_SECRET,env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean)){try{event=stripe.webhooks.constructEvent(raw,request.headers.get('stripe-signature'),secret);break;}catch{}}if(!event)throw Error('Invalid signature');}catch{return json({error:'Invalid webhook signature or payload.'},400);}
  if(event.livemode!==livemode)return json({error:'Wrong payment mode.'},400);
  try{
   const o=event.data.object;
   if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
    const session=await stripe.checkout.sessions.retrieve(o.id);
    // Stripe can deliver before checkout-save. A 500 causes a safe retry after persistence.
    if(session.metadata?.booking_id)await reconcile(session);
   }else if(event.type==='account.updated'&&o.metadata?.enduur_user_id){
    const row=await rpc('account-get',{user_id:o.metadata.enduur_user_id});
    if(row.stripe_account!==o.id)throw fail('Unknown payout account.');const a=await stripe.accounts.retrieve(o.id);await rpc('account-save',{user_id:o.metadata.enduur_user_id,account:a.id,ready:ready(a)});
   }else if(event.type.startsWith('charge.dispute.')||event.type==='charge.refunded'){
    const charge=event.type==='charge.refunded'?o:await stripe.charges.retrieve(idOf(o.charge));
    const pi=charge.payment_intent?await stripe.paymentIntents.retrieve(idOf(charge.payment_intent)):null;
    if(pi?.metadata?.booking_id){const v=await get(pi.metadata.booking_id);if(v.charge_id!==charge.id)throw fail('Charge mismatch.');
     if(event.type.startsWith('charge.dispute.'))await rpc('stripe-issue',{id:v.booking_id,reason:'A Stripe payment dispute needs operator review. Transfers are paused.'});
     else{const refunds=await stripe.refunds.list({charge:charge.id,limit:100});if(refunds.data.some(r=>r.status!=='failed'&&r.status!=='canceled'&&r.metadata?.operation_key!==v.operation_key))await rpc('stripe-issue',{id:v.booking_id,reason:'Refund made outside the booking flow. Reconcile any athlete transfer.'});}
    }
   }
   return json({received:true});
  }catch{return json({error:'Webhook processing incomplete; retry required.'},500);}
 }
 async function cron(request){
  if(request.method!=='GET')return json({error:'Method not allowed.'},405);
  if(!equal(request.headers.get('authorization'),`Bearer ${env.CRON_SECRET||''}`)||!env.CRON_SECRET)return json({error:'Unauthorized.'},401);
  if(!config.wired)return json({skipped:'Payments not configured.'});
  const result=await sweep();return json(result,[...result.results,...result.notifications].some(r=>!r.ok)?503:200);
 }
 return {handle,webhook,cron,checkout,reconcile,settle,sweep,notifyParticipants};
}
