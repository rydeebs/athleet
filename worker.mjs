import {assets} from './assets.mjs';
import {createAudienceHandler} from './server/audience-handler.mjs';
import {portalConfig} from './server/portal-config.mjs';
const handleAudience=createAudienceHandler({clientKey:request=>request.headers.get('CF-Connecting-IP')});
export default {async fetch(request,env={}){
 const url=new URL(request.url);
 if(url.pathname==='/api/portal-config'){if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});return portalConfig(env);}
 if(url.pathname==='/api/audience'){
  return handleAudience(request);
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const path=url.pathname==='/'?'/index.html':/^\/(athletes|sponsors)\/?$/.test(url.pathname)?'/portal.html':url.pathname;const asset=assets[path];if(!asset)return new Response('Not found',{status:404,headers:{'Content-Type':'text/plain'}});
 return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
}};
