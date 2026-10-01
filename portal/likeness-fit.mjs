import {clamp} from './photo-color.mjs';
export const likenessViews=[
 {id:'front',label:'Front',angle:0,hint:'Look straight ahead. Keep both ears visible.'},
 {id:'left',label:'Profile · nose points left',angle:Math.PI/2,hint:'A full side view: nose points left and only the near eye is visible.'},
 {id:'right',label:'Profile · nose points right',angle:-Math.PI/2,hint:'A full side view: nose points right and only the near eye is visible.'}
];
export const headAnchors={eyeL:[-.032,1.635,.13],eyeR:[.032,1.635,.13],nose:[0,1.60,.17],mouth:[0,1.563,.154],chin:[0,1.525,.125],cheekL:[-.062,1.60,.108],cheekR:[.062,1.60,.108],mouthL:[-.024,1.563,.154],mouthR:[.024,1.563,.154],earL:[-.075,1.614,.028],earR:[.075,1.614,.028]};
export const pointLabels={eyeL:'Eye center · photo left',eyeR:'Eye center · photo right',nose:'Tip of nose',mouth:'Center of closed lips',chin:'Bottom of chin',cheekL:'Widest cheek · photo left',cheekR:'Widest cheek · photo right',mouthL:'Mouth corner · photo left',mouthR:'Mouth corner · photo right',earL:'Ear opening',earR:'Ear opening'};
export function keysFor(view){return Math.abs(view.angle)>1? [view.angle>0?'eyeR':'eyeL','nose','mouth','chin',view.angle>0?'earR':'earL']:view.id==='front'?['eyeL','eyeR','nose','mouth','chin','cheekL','cheekR','mouthL','mouthR']:['eyeL','eyeR','nose','mouth','chin'];}
export function validatePoints(view,points){const keys=keysFor(view);if(keys.some(k=>!points[k]||points[k].some(v=>!Number.isFinite(v)||v<0||v>1)))throw new Error('Place every alignment point on the photo.');const eye=points[view.angle>1?'eyeR':'eyeL'];if(points.chin[1]-eye[1]<.08)throw new Error('Check the eye and chin points. The chin must be clearly below the eyes.');if(view.angle>1&&points.nose[0]>=eye[0]||view.angle< -1&&points.nose[0]<=eye[0])throw new Error('This profile points the wrong way. Use Flip photo or choose the other profile slot.');}
export function buildHeadFit(rows){
 for(const view of likenessViews){const row=rows.find(r=>r.id===view.id);if(!row?.confirmed)throw new Error('Review and confirm all three views first.');validatePoints(view,row.points);}
 const front=rows.find(r=>r.id==='front'),p=front.points,eye=[(p.eyeL[0]+p.eyeR[0])/2,(p.eyeL[1]+p.eyeR[1])/2],scale=.11/((p.chin[1]-eye[1])*front.height),controls=[];
 for(const key of keysFor(likenessViews[0])){const a=headAnchors[key];controls.push({key,center:a,delta:[clamp((p[key][0]-eye[0])*front.width*scale-a[0],-.018,.018),clamp(1.635-(p[key][1]-eye[1])*front.height*scale-a[1],-.015,.015),0],radius:key.startsWith('cheek')?.055:.035});}
 for(const key of ['nose','mouth','chin']){const depths=[];for(const id of ['left','right']){const row=rows.find(r=>r.id===id),sign=id==='left'?-1:1,e=row.points[id==='left'?'eyeR':'eyeL'],s=.11/((row.points.chin[1]-e[1])*row.height);depths.push(.13+sign*(row.points[key][0]-e[0])*row.width*s);}controls.find(c=>c.key===key).delta[2]=clamp(depths.reduce((a,b)=>a+b)/depths.length-headAnchors[key][2],-.018,.018);}
 return controls;
}
export function deformHeadPoint(point,controls){
 if(point[1]<1.49)return [...point];let sum=0,delta=[0,0,0];
 for(const c of controls){const d=point.reduce((s,v,i)=>s+(v-c.center[i])**2,0),w=Math.exp(-d/(c.radius*c.radius));sum+=w;for(let i=0;i<3;i++)delta[i]+=c.delta[i]*w;}
 const fade=clamp((point[1]-1.49)/.04,0,1);return point.map((v,i)=>v+delta[i]/Math.max(1,sum)*fade);
}
export function projectHead(point,angle){return [point[0]*Math.cos(angle)-(point[2]-.035)*Math.sin(angle),-(point[1]-1.63)];}
export function fitCamera(row,view,controls){
 const keys=keysFor(view);let best=null;
 for(let offset=-12;offset<=12;offset+=2){const angle=view.angle+offset*Math.PI/180,src=keys.map(k=>projectHead(deformHeadPoint(headAnchors[k],controls),angle)),dst=keys.map(k=>[row.points[k][0]*row.width,row.points[k][1]*row.height]);
 const mean=xs=>[0,1].map(i=>xs.reduce((s,p)=>s+p[i],0)/xs.length),s0=mean(src),d0=mean(dst);let aa=0,bb=0,den=0;
 for(let i=0;i<src.length;i++){const x=src[i][0]-s0[0],y=src[i][1]-s0[1],u=dst[i][0]-d0[0],v=dst[i][1]-d0[1];aa+=x*u+y*v;bb+=x*v-y*u;den+=x*x+y*y;}
 const a=aa/den,b=bb/den,tx=d0[0]-a*s0[0]+b*s0[1],ty=d0[1]-b*s0[0]-a*s0[1];let error=0;
 for(let i=0;i<src.length;i++){const [x,y]=src[i];error+=(a*x-b*y+tx-dst[i][0])**2+(b*x+a*y+ty-dst[i][1])**2;}
 const camera={angle,a,b,tx,ty,error:Math.sqrt(error/src.length)};if(!best||camera.error<best.error)best=camera;
 }
 if(!Number.isFinite(best.error)||best.error>Math.max(row.width,row.height)*.08)throw new Error(`${view.label}: alignment points disagree. Check the eye, nose and chin, and use the requested angle.`);return best;
}
export function projectCamera(point,c){const [x,y]=projectHead(point,c.angle);return [c.a*x-c.b*y+c.tx,c.b*x+c.a*y+c.ty];}
