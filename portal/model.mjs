import {raceTypes} from '../races.mjs';
export {raceTypes};
export const outfits = {
 singlet: {label:'Running singlet', chest:'kit', back:'kit', arms:'skin', thighs:'kit'},
 shirtless: {label:'Shirtless + shorts', chest:'skin', back:'skin', arms:'skin', thighs:'kit'},
 'sports-bra': {label:'Sports bra + shorts', chest:'kit', back:'kit', arms:'skin', thighs:'kit'},
 tee: {label:'T-shirt + shorts', chest:'kit', back:'kit', arms:'kit', thighs:'kit'},
 'long-sleeve': {label:'Long sleeves + tights', chest:'kit', back:'kit', arms:'kit', thighs:'kit'},
 'tri-suit': {label:'Tri suit', chest:'kit', back:'kit', arms:'skin', thighs:'kit'},
 wetsuit: {label:'Wetsuit', chest:'kit', back:'kit', arms:'kit', thighs:'kit'},
};
export const zones = ['chest','back','left-arm','right-arm','left-thigh','right-thigh'];
export const skins = ['#f0cbb2','#d6a17c','#b77d55','#905b3b','#69432f','#422c24'];
export const kitColors = ['#283e34','#24282c','#54697c','#854b40','#c8cdbe'];
export const defaultAvatar = {skin:skins[2],build:'athletic',presentation:'neutral',kit:kitColors[0]};
export const defaultProfile = {display_name:'',location:'',bio:'',avatar:defaultAvatar,socials:[],audience:null};
export const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n || 0);
export const count = n => new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n || 0);
export const dateLabel = value => value ? new Date(value+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'Date to confirm';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const today = () => new Date().toLocaleDateString('en-CA');
export function placementInfo(zone,outfit='singlet') {
 const o=outfits[outfit]||outfits.singlet;
 const material=o[zone.includes('arm')?'arms':zone.includes('thigh')?'thighs':zone];
 const name=zone==='chest'?'Front torso':zone==='back'?'Upper back':zone.replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
 return {id:zone,name,material,label:`${name} · ${material==='skin'?'temporary tattoo':'kit logo'}`};
}
export function normalizeAvatar(value={}) {return {
 skin:skins.includes(value.skin)?value.skin:defaultAvatar.skin,
 kit:kitColors.includes(value.kit)?value.kit:defaultAvatar.kit,
 build:['lean','athletic','strong'].includes(value.build)?value.build:'athletic',
 presentation:['neutral','feminine','masculine'].includes(value.presentation)?value.presentation:'neutral'
};}
export function newRace() {return {event_name:'',race_date:'',location:'',discipline:'Road running',distance:'5K',expected_field:null,finish_band:'',outfit:'singlet',phase:'Full race',placements:['chest','left-arm'],asking_price:250,deliverables:'1 race-day placement, 1 social post, and event photo proof.',notes:'',status:'draft',rules_confirmed:false};}
export function validateRace(race) {
 if(!race.event_name?.trim()||race.event_name.length>120)throw new Error('Add an event name (up to 120 characters).');
 if(!race.location?.trim()||race.location.length>120)throw new Error('Add the race location.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(race.race_date)||Number.isNaN(Date.parse(race.race_date))||race.race_date<today())throw new Error('Choose an upcoming race date.');
 if(!raceTypes[race.discipline]||!race.distance?.trim()||race.distance.length>100)throw new Error('Choose a discipline and distance.');
 if(!outfits[race.outfit])throw new Error('Choose your race outfit.');
 if(!['Full race','Bike + run','Bike only','Run only','Swim only'].includes(race.phase))throw new Error('Choose a race phase.');
 if(!Array.isArray(race.placements)||!race.placements.length||new Set(race.placements).size!==race.placements.length||race.placements.some(z=>!zones.includes(z)))throw new Error('Choose at least one available placement.');
 if(!Number.isInteger(Number(race.asking_price))||race.asking_price<25||race.asking_price>1000000)throw new Error('Enter a whole-dollar package price between $25 and $1,000,000.');
 if(race.expected_field!==null&&race.expected_field!==''&&(!Number.isInteger(Number(race.expected_field))||race.expected_field<1||race.expected_field>1000000))throw new Error('Enter a valid expected field size.');
 if(!race.deliverables?.trim()||race.deliverables.length>1000)throw new Error('Describe the deliverables (up to 1,000 characters).');
 if((race.finish_band||'').length>100||(race.notes||'').length>1000)throw new Error('Shorten the finish band or visibility notes.');
 if(!['draft','published'].includes(race.status))throw new Error('Invalid listing status.');
 if(race.status==='published'&&!race.rules_confirmed)throw new Error('Confirm the event permits your selected placements before publishing.');
 return race;
}
export function filterListings(listings,filters={}) {
 return listings.filter(r=>{
 const text=`${r.event_name} ${r.profile?.display_name||''}`.toLowerCase();
 return r.status==='published'&&r.race_date>=today()&&(!filters.search||text.includes(filters.search.toLowerCase()))&&
 (!filters.location||r.location.toLowerCase().includes(filters.location.toLowerCase()))&&
 (!filters.discipline||r.discipline===filters.discipline)&&(!filters.distance||r.distance===filters.distance)&&
 (!filters.from||r.race_date>=filters.from)&&(!filters.to||r.race_date<=filters.to)&&
 (!filters.budget||r.asking_price<=Number(filters.budget))&&
 (!filters.audience||(r.profile?.audience?.total||0)>=Number(filters.audience))&&
 (!filters.placement||r.placements.some(z=>placementInfo(z,r.outfit).material===filters.placement&&!r.reserved?.includes(z)))&&
 r.placements.some(z=>!r.reserved?.includes(z));
 }).sort((a,b)=>filters.sort==='price'?a.asking_price-b.asking_price:filters.sort==='audience'?(b.profile?.audience?.total||0)-(a.profile?.audience?.total||0):a.race_date.localeCompare(b.race_date));
}
export function safeProofUrl(value) {try {const u=new URL(value);return u.protocol==='https:'&&value.length<=2000?u.href:null;}catch{return null;}}
