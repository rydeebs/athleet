import {Vector3,Float32BufferAttribute} from 'three';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const g=(x,y,cx,cy,sx,sy)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
// A continuous deformation shared by skin and fitted garments. Coordinates are
// world metres in the source A-pose. No muscle primitives or detached overlays.
export function sculptPoint(v,avatar={}){
 const side=Math.sign(v.x)||1,x=Math.abs(v.x),y=v.y,z=v.z;
 const strength={lean:.8,athletic:1,strong:1.35}[avatar.build]||1;
 const female=avatar.gender==='female'||avatar.presentation==='feminine';
 const front=smooth((z+.005)/.075),back=smooth((-z+.015)/.07);
 // Ribcage, lats and neck have their own broad volume; the waist remains tapered.
 const torso=smooth((.23-x)/.065);
 v.x+=side*strength*(.008*g(x,y,.135,1.31,.075,.13)+.005*g(x,y,.05,1.47,.06,.07))*torso;
 v.z+=strength*torso*(front*.009*g(x,y,.075,1.29,.12,.16)-back*.01*g(x,y,.095,1.31,.10,.13));
 // Pectoral bellies, lower fold, sternum and restrained rectus/oblique relief.
 let relief=(female?.003:.019)*g(x,y,.076,1.337,.059,.043);
 relief-=(female?.0005:.003)*g(x,y,.076,1.284,.061,.009);
 for(const h of [1.091,1.147,1.202])relief+=.0038*g(x,y,.034,h,.026,.021);
 relief-=.0018*g(x,y,0,1.17,.008,.12);
 relief+=.0035*g(x,y,.104,1.13,.027,.10);
 v.z+=relief*front*torso*strength;
 // Distinct deltoid, biceps, triceps and forearm volumes along the source arm.
 const shoulder=g(x,y,.203,1.396,.055,.056),biceps=g(x,y,.285,1.283,.056,.065),forearm=g(x,y,.419,1.145,.067,.053);
 v.x+=side*strength*(.013*shoulder+.008*biceps+.005*forearm);
 v.z+=strength*((.016*shoulder+.015*biceps+.009*forearm)*front-(.014*shoulder+.013*biceps+.007*forearm)*back);
 // Quads and adductors taper into the knee; calves keep a narrower Achilles.
 const quad=g(x,y,.098,.745,.080,.14),calf=g(x,y,.168,.385,.059,.10),glute=g(x,y,.09,.938,.075,.075);
 v.x+=side*strength*(.009*quad+.006*calf);
 v.z+=strength*(.017*quad*front-.012*quad*back-.017*calf*back+.007*calf*front-.014*glute*back);
 return v;
}
export function relaxedPosePoint(v){
 const side=Math.sign(v.x)||1,x=Math.abs(v.x),y=v.y;
 // Smooth shoulder transition preserves armpits and garment seams. Rotation
 // becomes rigid below the deltoid, so elbows and wrists keep their proportions.
 const weight=smooth((x-.145)/.105)*smooth((y-.80)/.15)*(1-smooth((y-1.46)/.055));
 if(!weight)return v;
 const sx=.18,sy=1.415,dx=x-sx,dy=y-sy;
 // Curl distal fingers toward the palm, softly compressing the splayed hand.
 const u=(dx-dy)*Math.SQRT1_2,across=(dx+dy)*Math.SQRT1_2;
 if(u>.49){const t=Math.max(0,u-.54),angle=Math.min(t/.08,1.3),curled=.54+Math.sin(angle)*.08,newU=u>.54?curled:u;
  const spread=1-.25*smooth((u-.49)/.11),newAcross=across*spread;
  v.x=side*(sx+(newU+newAcross)*Math.SQRT1_2);v.y=sy+(newAcross-newU)*Math.SQRT1_2;
  v.z+=(1-Math.cos(angle))*.08;
 }
 const px=Math.abs(v.x)-sx,py=v.y-sy,pz=v.z-.02,pitch=.50*weight,a=-.40*weight;
 const loweredY=py*Math.cos(pitch)-pz*Math.sin(pitch);
 v.z=.02+py*Math.sin(pitch)+pz*Math.cos(pitch);
 v.x=side*(sx+px*Math.cos(a)-loweredY*Math.sin(a));v.y=sy+px*Math.sin(a)+loweredY*Math.cos(a);
 return v;
}
export function athleticGeometry(mesh,avatar){
 const geometry=mesh.geometry.clone(),inverse=mesh.matrixWorld.clone().invert(),v=new Vector3(),positions=new Float32Array(geometry.attributes.position.count*3);
 for(let i=0;i<geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);sculptPoint(v,avatar);relaxedPosePoint(v);v.applyMatrix4(inverse);v.toArray(positions,i*3);}
 geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.morphAttributes={};geometry.deleteAttribute('normal');geometry.computeVertexNormals();
 const groups=new Map(),n=geometry.attributes.normal;for(let i=0;i<positions.length/3;i++){const key=[0,1,2].map(j=>Math.round(positions[i*3+j]*1e6)).join(',');const list=groups.get(key)||[];list.push(i);groups.set(key,list);}for(const ids of groups.values()){v.set(0,0,0);for(const i of ids)v.add(new Vector3().fromBufferAttribute(n,i));v.normalize();for(const i of ids)n.setXYZ(i,v.x,v.y,v.z);}
 // Keep cloth just outside skin after the new pose instead of allowing the
 // underarm or chest to poke through a nearly coincident fabric surface.
 if(mesh.name!=='Body'){const localOffset=.0045/mesh.matrixWorld.getMaxScaleOnAxis();for(let i=0;i<n.count;i++){positions[i*3]+=n.getX(i)*localOffset;positions[i*3+1]+=n.getY(i)*localOffset;positions[i*3+2]+=n.getZ(i)*localOffset;}geometry.attributes.position.needsUpdate=true;}
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
