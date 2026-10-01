// Left/right always means the athlete's left/right. Legacy zones remain readable.
export const placementZones={
 chest:{name:'Front torso',anchor:[0,1.32,1],width:.18},
 'left-pec':{name:'Left pectoral',anchor:[.075,1.335,1],width:.105},'right-pec':{name:'Right pectoral',anchor:[-.075,1.335,1],width:.105},
 cleavage:{name:'Upper chest / cleavage',anchor:[0,1.405,1],width:.08},
 back:{name:'Upper back',anchor:[0,1.32,-1],width:.20},
 'left-shoulder':{name:'Left shoulder',anchor:[.19,1.405,1],width:.07},'right-shoulder':{name:'Right shoulder',anchor:[-.19,1.405,1],width:.07},
 'left-arm':{name:'Left upper arm',anchor:[.26,1.29,1],width:.065},'right-arm':{name:'Right upper arm',anchor:[-.26,1.29,1],width:.065},
 'left-forearm':{name:'Left forearm',anchor:[.44,1.13,1],width:.055},'right-forearm':{name:'Right forearm',anchor:[-.44,1.13,1],width:.055},
 'left-thigh':{name:'Left thigh',anchor:[.10,.79,1],width:.10},'right-thigh':{name:'Right thigh',anchor:[-.10,.79,1],width:.10},
 'left-calf':{name:'Left calf',anchor:[.18,.36,-1],width:.065},'right-calf':{name:'Right calf',anchor:[-.18,.36,-1],width:.065},
 butt:{name:'Buttocks',anchor:[0,.94,-1],width:.16}
};
export const scenes={studio:'Studio',scifi:'Sci-fi arena',beach:'Beach',city:'City rooftop',landscape:'Mountain landscape'};
export function availableZones(avatar={}){const female=avatar.gender==='female'||(!avatar.gender&&avatar.presentation==='feminine');return Object.keys(placementZones).filter(z=>z!=='chest'&&(female?!z.endsWith('-pec'):z!=='cleavage'));}
export function placementMaterial(zone,outfit){const covered=['long-sleeve','wetsuit'].includes(outfit);if(zone==='butt'||zone.includes('thigh'))return 'kit';if(zone.includes('calf')||zone.includes('forearm'))return covered?'kit':'skin';if(zone.includes('shoulder')||zone.includes('arm'))return covered||outfit==='tee'?'kit':'skin';if(zone==='cleavage')return ['shirtless','singlet','sports-bra','tri-suit'].includes(outfit)?'skin':'kit';return outfit==='shirtless'?'skin':'kit';}
export const rearZone=z=>placementZones[z]?.anchor[2]===-1;
