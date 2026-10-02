// Campaign labels describe acquisition only; they never grant access or privileges.
export function pilotAttribution(search, role) {
 const params=new URLSearchParams(search);
 if(params.get('invite')!=='pilot'||!['athlete','sponsor'].includes(role))return null;
 const value=params.get('campaign')||'founding-pilot';
 const campaign=/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)?value:'founding-pilot';
 return {source:'pilot-invitation',campaign,role};
}
export function pilotDestination(role, search='') {
 const path=role==='sponsor'?'/sponsors':'/athletes';
 const query=new URLSearchParams(search);
 query.set('invite','pilot');
 const attribution=pilotAttribution(query,role==='sponsor'?'sponsor':'athlete');
 const safe=new URLSearchParams({invite:'pilot',campaign:attribution.campaign});
 return `${path}?${safe}#profile`;
}
