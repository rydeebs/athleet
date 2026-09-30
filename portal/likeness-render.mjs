import {Vector3,Float32BufferAttribute} from 'three';
import {deformHeadPoint,projectCamera} from './likeness-fit.mjs';
export function fittedHeadGeometry(mesh,fit){
 const geometry=mesh.geometry.clone(),inverse=mesh.matrixWorld.clone().invert(),p=new Vector3(),positions=new Float32Array(geometry.attributes.position.count*3);
 for(let i=0;i<geometry.attributes.position.count;i++){mesh.getVertexPosition(i,p);p.applyMatrix4(mesh.matrixWorld);p.fromArray(deformHeadPoint(p.toArray(),fit));p.applyMatrix4(inverse);p.toArray(positions,i*3);}
 geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.morphAttributes={};geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function projectedEyeGeometry(mesh,camera,width,height){const geometry=mesh.geometry.clone(),uv=new Float32Array(geometry.attributes.position.count*2),v=new Vector3();for(let i=0;i<geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);const [x,y]=projectCamera(v.toArray(),camera);uv[i*2]=x/width;uv[i*2+1]=y/height;}geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));return geometry;}
// Each photo gets a small visibility buffer so a nose/ear cannot be projected
// through to a cheek behind it. This is built once per bake, not per frame.
export function prepareViews(positions,index,views){return views.map(view=>{
 const size=192,depth=new Float32Array(size*size).fill(-Infinity),cam=view.camera,ca=Math.cos(cam.angle),sa=Math.sin(cam.angle),projected=positions.map(v=>{const [x,y]=projectCamera([v.x,v.y,v.z],cam);return [x/view.image.width*size,y/view.image.height*size,v.x*sa+v.z*ca];});
 for(let i=0;i<(index?.count||positions.length);i+=3){const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);if(Math.max(...ids.map(j=>positions[j].y))<1.49)continue;const [a,b,c]=ids.map(j=>projected[j]),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-8)continue;for(let y=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1])));y<=Math.min(size-1,Math.ceil(Math.max(a[1],b[1],c[1])));y++)for(let x=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])));x<=Math.min(size-1,Math.ceil(Math.max(a[0],b[0],c[0])));x++){const wa=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,wb=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den,wc=1-wa-wb;if(Math.min(wa,wb,wc)<-.015)continue;depth[y*size+x]=Math.max(depth[y*size+x],wa*a[2]+wb*b[2]+wc*c[2]);}}
 return {...view,depth,size,ca,sa};});}
export function sampleViews(point,views){const [x,y,z]=point,nx=x/.08,nz=(z-.035)/.10,length=Math.hypot(nx,nz)||1;let sum=0,color=[0,0,0];
 for(const v of views){const facing=(nx*v.sa+nz*v.ca)/length;if(facing<=.1)continue;const [px,py]=projectCamera(point,v.camera),ix=Math.round(px),iy=Math.round(py);if(ix<0||iy<0||ix>=v.image.width||iy>=v.image.height)continue;const dx=Math.min(v.size-1,Math.floor(px/v.image.width*v.size)),dy=Math.min(v.size-1,Math.floor(py/v.image.height*v.size));if(x*v.sa+z*v.ca<v.depth[dy*v.size+dx]-.009)continue;const k=(iy*v.image.width+ix)*4,w=Math.pow(facing,6)*v.image.data[k+3]/255;sum+=w;for(let c=0;c<3;c++)color[c]+=v.image.data[k+c]*w;}
 return sum>.005?{color:color.map(c=>c/sum),alpha:Math.min(1,sum*2)*Math.max(0,Math.min(1,(y-1.49)/.04))}:null;
}
