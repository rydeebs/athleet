import {Vector3,Float32BufferAttribute} from 'three';
import {prepareViews,sampleViews} from './likeness-render.mjs';
import {clamp} from './photo-color.mjs';
export const facePixel=(x,y)=>[(x/.18+.5)*512,(1.7345-y)/.225*640];
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function imagePixels(image){const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height);}
function sample(image,x,y){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=image.width||y>=image.height)return null;const k=(y*image.width+x)*4;return image.data.subarray(k,k+4);}
export function bakePortraitPixels(base,mesh,face,hair,details,views=[]){
 const pixels=new Uint8ClampedArray(base.data),geometry=mesh.geometry,uv=geometry.attributes.uv,index=geometry.index;
 const positions=[],p=new Vector3();for(let i=0;i<geometry.attributes.position.count;i++){mesh.getVertexPosition(i,p);p.applyMatrix4(mesh.matrixWorld);positions.push(p.clone());}
 const prepared=views.length?prepareViews(positions,index,views):[];
 const coverage=new Uint8Array(base.width*base.height),bounds=details.hairBounds,hairColor=details.hairColor,brightness=Math.pow(2,(details.exposure||0)/100);
 function blend(k,color,alpha){if(!color||alpha<=0)return;for(let c=0;c<3;c++)pixels[k+c]=pixels[k+c]*(1-alpha)+color[c]*alpha;}
 for(let i=0;i<(index?.count||positions.length);i+=3){
  const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),v=ids.map(j=>positions[j]);if(Math.max(...v.map(p=>p.y))<1.49)continue;
  const q=ids.map(j=>[uv.getX(j)*(base.width-1),uv.getY(j)*(base.height-1)]),[a,b,c]=q,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-8)continue;
  const minX=Math.max(0,Math.floor(Math.min(...q.map(p=>p[0])))),maxX=Math.min(base.width-1,Math.ceil(Math.max(...q.map(p=>p[0])))),minY=Math.max(0,Math.floor(Math.min(...q.map(p=>p[1])))),maxY=Math.min(base.height-1,Math.ceil(Math.max(...q.map(p=>p[1]))));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
   const w0=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,w1=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den,w2=1-w0-w1;if(Math.min(w0,w1,w2)<-.002)continue;
   const k=(y*base.width+x)*4;if(coverage[k/4])continue;coverage[k/4]=1;
   const wx=v[0].x*w0+v[1].x*w1+v[2].x*w2,wy=v[0].y*w0+v[1].y*w1+v[2].y*w2,wz=v[0].z*w0+v[1].z*w1+v[2].z*w2;
   if(prepared.length){
    if(details.hairColor&&wy>(details.scalpLine||1.69)&&wz<.07)blend(k,details.hairColor,Math.min(1,(wy-(details.scalpLine||1.69))/.035));
    const result=sampleViews([wx,wy,wz],prepared);if(result)blend(k,result.color,result.alpha);continue;
   }
   const [fx,fy]=facePixel(wx,wy),front=smooth(.065,.115,wz)*(1-smooth(.065,.09,Math.abs(wx))),photo=sample(face,fx,fy);
   if(photo)blend(k,photo,front*photo[3]/255);
   if(hair&&bounds&&hairColor){
    // A fitted scalp texture, never a camera-facing card. The unseen rear is a
    // conservative color continuation, not a reconstruction of the hairstyle.
    const hairline=1.7345-(bounds.line-256)/640*.225;
    const rearWeight=1-smooth(-.035,.10,wz);
    blend(k,hairColor,Math.max(rearWeight*smooth(hairline-.05,hairline-.01,wy),smooth(hairline,hairline+.035,wy)));
    const hy=bounds.line-(wy-hairline)/Math.max(.03,1.75-hairline)*(bounds.line-bounds.top);
    const hx=512+wx/.082*(bounds.right-bounds.left)/2;
    const h=sample(hair,hx,hy);
    if(h&&wy>1.57)blend(k,h,smooth(-.015,.09,wz)*h[3]/255);
   }
  }
 }
 // One exposure adjustment for both the body base and the embedded photograph.
 for(let i=0;i<pixels.length;i+=4)for(let c=0;c<3;c++)pixels[i+c]=Math.min(255,pixels[i+c]*brightness);
 return {data:pixels,width:base.width,height:base.height};
}
export function portraitEyeGeometry(mesh){
 const geometry=mesh.geometry.clone(),uv=new Float32Array(geometry.attributes.position.count*2),v=new Vector3();
 for(let i=0;i<geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);const [x,y]=facePixel(v.x,v.y);uv[i*2]=x/512;uv[i*2+1]=y/640;}
 geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));return geometry;
}

export function bakePortrait(...args){const result=bakePortraitPixels(...args),canvas=document.createElement('canvas');canvas.width=result.width;canvas.height=result.height;canvas.getContext('2d').putImageData(new ImageData(result.data,result.width,result.height),0,0);return canvas;}
