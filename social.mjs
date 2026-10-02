import {platforms,normalizeHandle} from './audience.mjs';
export function validateLookup(accounts){
 if(!Array.isArray(accounts)||accounts.length<1||accounts.length>5)throw new Error('Add between one and five social accounts.');
 const seen=new Set();return accounts.map(a=>{if(!a||typeof a.handle!=='string'||!platforms[a.platform])throw new Error('Choose a supported platform and username.');const handle=normalizeHandle(a.handle);if(!platforms[a.platform].pattern.test(handle))throw new Error('Use a valid username, not a profile URL.');const key=a.platform+':'+handle.toLowerCase();if(seen.has(key))throw new Error('Remove duplicate accounts before calculating.');seen.add(key);return {platform:a.platform,handle};});
}
export function parseCount(raw){const text=String(raw).trim().replace(/,/g,'');const m=text.match(/^(\d+(?:\.\d+)?)\s*([kmb])?$/i);if(!m)return null;const value=Math.round(Number(m[1])*({k:1e3,m:1e6,b:1e9}[m[2]?.toLowerCase()]||1));return Number.isSafeInteger(value)&&value>=0&&value<=2e9?{followers:value,approximate:!!m[2]}:null;}
export function profileUrl(platform,handle){const name=encodeURIComponent(handle);return {instagram:`https://www.instagram.com/${name}/`,tiktok:`https://www.tiktok.com/@${name}`,x:`https://x.com/${name}`,youtube:`https://www.youtube.com/@${name}`,threads:`https://www.threads.com/@${name}`}[platform];}
function decode(text){return text.replace(/&quot;|&#34;/g,'"').replace(/&amp;/g,'&').replace(/&#x27;|&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):'').replace(/&#x([0-9a-f]+);/gi,(_,n)=>parseInt(n,16)<=0x10ffff?String.fromCodePoint(parseInt(n,16)):'');}
export function extractCount(text,platform,handle,{reader=false}={}){
 // Only profile-owned metadata or profile header text is eligible. Never scan recommendation cards.
 if(reader){
  const title=text.match(/^Title:\s*(.+)$/m)?.[1]||'';
  if(/log\s?in|sign\s?in|not found|404|captcha|access denied/i.test(title))return null;
  const source=profileUrl(platform,handle);if(!text.toLowerCase().includes(`url source: ${source}`.toLowerCase()))return null;
  if(!title.toLowerCase().includes('@'+handle.toLowerCase())&&platform!=='youtube')return null;
  let header=text.split(/Suggested accounts|Recommended|Related accounts|Popular videos|Latest posts/i)[0];
  // TikTok's own profile metrics precede Likes and all posts.
  if(platform==='tiktok')header=header.split(/Likes/i)[0];
  header=header.replace(/\*\*/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1');
  const m=header.match(/(?:^|\s)(\d[\d,.]*\s*[KMB]?)\s*(?:followers|subscribers)\b/i);return m?parseCount(m[1]):null;
 }
 if(platform==='tiktok'){
  const script=text.match(/<script[^>]+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i);
  if(script){try{const info=JSON.parse(script[1]).__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;if(info?.user?.uniqueId?.toLowerCase()===handle.toLowerCase()&&info.stats?.followerCount!==undefined)return parseCount(info.stats.followerCount);}catch{}}
 }
 const metas=[...text.matchAll(/<meta\s[^>]*>/gi)].map(m=>m[0]);
 const meta=name=>{const tag=metas.find(t=>new RegExp(`(?:name|property)=["']${name}["']`,'i').test(t));return decode(tag?.match(/content=["']([\s\S]*?)["']/i)?.[1]||'');};
 const title=meta('og:title')||decode(text.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'');
 const desc=meta('description')||meta('og:description');
 const identity=(title+' '+desc).toLowerCase().includes('@'+handle.toLowerCase());
 if(identity){const m=desc.match(/(?:^|\s)(\d[\d,.]*\s*[KMB]?)\s*(?:followers|subscribers)\b/i);if(m)return parseCount(m[1]);}
 if(platform==='youtube'){
  const script=text.match(/var ytInitialData = (.*?);<\/script>/s);
  if(script){try{const data=JSON.parse(script[1]);const header=data.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;const parts=header?.metadata?.contentMetadataViewModel?.metadataRows?.flatMap(row=>row.metadataParts).map(part=>part.text?.content)||[];if(parts.some(part=>part?.toLowerCase()==='@'+handle.toLowerCase())){const subscribers=parts.find(part=>/^[\d,.]+\s*[KMB]? subscribers$/i.test(part));if(subscribers)return parseCount(subscribers.replace(/ subscribers/i,''));}}catch{}}
 }

 return null;
}
async function fetchText(url,options={},fetcher=fetch){const response=await fetcher(url,{...options,signal:AbortSignal.timeout(12000),redirect:'follow'});if(!response.ok)throw new Error(response.status===429?'Rate limited':'Unavailable');const reader=response.body.getReader();const parts=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2500000){await reader.cancel();throw new Error('Profile page too large');}parts.push(value);}const data=new Uint8Array(size);let offset=0;for(const chunk of parts){data.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(data);}
export async function lookupAccount(account,fetcher=fetch){
 const {platform,handle}=account;const sourceUrl=profileUrl(platform,handle);let count=null;let via='Public profile';
 try{
  if(platform==='x'){
   const raw=JSON.parse(await fetchText(`https://api.fxtwitter.com/${encodeURIComponent(handle)}`,{},fetcher));
   if(raw.code===200&&raw.user?.screen_name?.toLowerCase()===handle.toLowerCase()&&!raw.user.protected&&raw.user.followers!==undefined){count=parseCount(raw.user.followers);via='FxTwitter public profile';}
  }else{
   try{const html=await fetchText(sourceUrl,{headers:{'User-Agent':'Mozilla/5.0 (compatible; enduur/1.0)','Accept-Language':'en-US,en;q=0.9'}},fetcher);count=extractCount(html,platform,handle);}catch{}
   if(!count){const markdown=await fetchText(`https://r.jina.ai/${sourceUrl}`,{headers:{'X-No-Cache':'true','X-Timeout':'10','Accept':'text/plain'}},fetcher);count=extractCount(markdown,platform,handle,{reader:true});via='Public profile via Jina Reader';}
  }
 }catch{}
 if(!count)return {...account,status:'unavailable',sourceUrl,message:'We couldn’t read this public profile. Check the handle or try again later; the platform may require login or limit requests.'};
 return {...account,status:'ok',...count,sourceUrl,via,checkedAt:new Date().toISOString()};
}
