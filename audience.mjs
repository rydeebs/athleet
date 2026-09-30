export const platforms={instagram:{name:'Instagram',symbol:'◎',pattern:/^[A-Za-z0-9._]{1,30}$/},tiktok:{name:'TikTok',symbol:'♪',pattern:/^[A-Za-z0-9._]{1,24}$/},x:{name:'X',symbol:'𝕏',pattern:/^[A-Za-z0-9_]{1,15}$/},youtube:{name:'YouTube',symbol:'▷',pattern:/^[\p{L}\p{N}_.\-·]{3,30}$/u},threads:{name:'Threads',symbol:'@',pattern:/^[A-Za-z0-9._]{1,30}$/}};
export function normalizeHandle(value){return value.trim().replace(/^@/,'');}
export function validateAccounts(accounts){
 const active=accounts.filter(a=>a.handle.trim());
 if(!active.length)return {error:'Add at least one social username to get started.'};
 const seen=new Set();
 for(const account of active){const config=platforms[account.platform];const handle=normalizeHandle(account.handle);if(!config||!config.pattern.test(handle))return {error:`Enter a valid ${config?.name||'social'} username, without a profile URL.`};const key=account.platform+':'+handle.toLowerCase();if(seen.has(key))return {error:'This account is listed twice. Remove the duplicate to avoid counting it twice.'};seen.add(key);if(account.followers===''||account.followers===null||account.followers===undefined)return {needsCounts:true};const followers=Number(account.followers);if(!Number.isSafeInteger(followers)||followers<0||followers>2_000_000_000)return {error:'Follower counts must be whole numbers from 0 to 2 billion.'};}
 return {accounts:active.map(a=>({...a,handle:normalizeHandle(a.handle),followers:Number(a.followers)}))};
}
export function estimateAudience(accounts){const total=accounts.reduce((sum,a)=>sum+a.followers,0);const round=n=>Math.round(n/5)*5;return {total,low:round(100+total*.01),high:round(200+total*.03)};}
// Public CORS-enabled fallback for X when a shared hosting IP is throttled.
export async function lookupXInBrowser(account,fetcher=fetch){
 try{const response=await fetcher('https://api.fxtwitter.com/'+encodeURIComponent(account.handle),{signal:AbortSignal.timeout(8000),credentials:'omit'});if(!response.ok)return account;const data=await response.json();const user=data.user;if(data.code!==200||user?.screen_name?.toLowerCase()!==account.handle.toLowerCase()||user.protected||!Number.isSafeInteger(user.followers)||user.followers<0)return account;return {...account,status:'ok',followers:user.followers,approximate:false,sourceUrl:'https://x.com/'+encodeURIComponent(account.handle),via:'FxTwitter public profile',checkedAt:new Date().toISOString(),message:undefined};}catch{return account;}
}
