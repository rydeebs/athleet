// Coordinates are in metres on the normalized 1.75 m templates. Left/right refer
// to the athlete. Every anchor is raycast onto the currently visible surface.
export const garments={shirtless:['Shorts'],singlet:['Shorts','Singlet'],'sports-bra':['Shorts','Bra'],tee:['Shorts','Tee'],'long-sleeve':['Leggings','LongSleeve'],'tri-suit':['Shorts','Singlet'],wetsuit:['Leggings','LongSleeve']};
import {placementZones} from './placements.mjs';
export const anchors=Object.fromEntries(Object.entries(placementZones).map(([id,z])=>[id,z.anchor]));
export function findPlacementHit(ray,surfaces,zone){
 const [x,y,side]=anchors[zone];
 // Shoulder marks sit on the lateral deltoid, not the front clavicle. Cast
 // inward from the athlete's side so logos wrap onto the outer shoulder cap.
 if(zone.includes('shoulder')){ray.ray.origin.set(Math.sign(x)*2,y,0);ray.ray.direction.set(-Math.sign(x),0,0);return ray.intersectObjects(surfaces,false)[0]||null;}
 const reach=zone.includes('forearm')?.08:zone.includes('calf')?.05:zone.endsWith('-arm')?.04:zone.includes('shoulder')?.02:0;
 const offsets=[0];for(let step=.01;step<=reach+.001;step+=.01)offsets.push(step,-step);
 let best=null,score=-Infinity;for(const offset of offsets){ray.ray.origin.set(x+Math.sign(x)*offset,y,side*2);ray.ray.direction.set(0,0,-side);const hit=ray.intersectObjects(surfaces,false)[0];if(!hit)continue;const facing=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).z*side-Math.abs(offset)*.3;if(facing>score){best=hit;score=facing;}}return best;
}
