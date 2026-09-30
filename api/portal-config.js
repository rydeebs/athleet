import {portalConfig} from '../server/portal-config.mjs';
export default {fetch(request){if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});return portalConfig(process.env);}};
