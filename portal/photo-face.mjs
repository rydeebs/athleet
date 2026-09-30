// Local-only portrait fitting. No uploads, biometric inference, or photo persistence.
export const portraitLimits={bytes:8*1024*1024,pixels:32_000_000,types:['image/jpeg','image/png','image/webp']};
export function validatePortrait(file){
 if(!portraitLimits.types.includes(file.type))throw new Error('Choose a JPG, PNG or WebP portrait. Convert HEIC photos to JPG first.');
 if(file.size>portraitLimits.bytes)throw new Error('Choose a photo smaller than 8 MB.');
 if(!file.size)throw new Error('This photo is empty. Choose another file.');
}
export function portraitTransform(width,height,{zoom=1,x=0,y=0,rotation=0}={}){
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
 const scale=Math.max(512/width,640/height)*clamp(zoom,1,8);return {scale,x:256+clamp(x,-100,100)/100*width*scale/2,y:320+clamp(y,-100,100)/100*height*scale/2,rotation:clamp(rotation,-25,25)*Math.PI/180};
}
let source=null,sourceUrl='',faceUrl='',revision=0,pending=0;
export const facePreview=()=>({url:faceUrl,version:revision});
export function portraitAvailable(){return !!source;}
export async function readPortrait(file){
 validatePortrait(file);const request=++pending,url=URL.createObjectURL(file),img=new Image();
 try{img.src=url;await img.decode();if(img.naturalWidth<160||img.naturalHeight<160)throw new Error('Choose a sharper portrait at least 160 × 160 pixels.');if(img.naturalWidth*img.naturalHeight>portraitLimits.pixels)throw new Error('This photo is too large. Resize it below 32 megapixels.');if(request!==pending){URL.revokeObjectURL(url);return false;}
  if(sourceUrl)URL.revokeObjectURL(sourceUrl);source=img;sourceUrl=url;return true;
 }catch(error){URL.revokeObjectURL(url);throw new Error(error.message?.startsWith('Choose')||error.message?.startsWith('This')?error.message:'Could not open that photo. Try a JPG, PNG or WebP image.');}
}
function imageCanvas(settings){
 if(!source)throw new Error('Choose a portrait first.');const canvas=document.createElement('canvas');canvas.width=512;canvas.height=640;const ctx=canvas.getContext('2d');const t=portraitTransform(source.naturalWidth,source.naturalHeight,settings);
 ctx.translate(t.x,t.y);ctx.rotate(t.rotation);ctx.scale(t.scale,t.scale);ctx.drawImage(source,-source.naturalWidth/2,-source.naturalHeight/2);ctx.setTransform(1,0,0,1,0,0);return canvas;
}
export function drawPortraitGuide(canvas,settings){
 if(!canvas||!source)return;canvas.width=512;canvas.height=640;const ctx=canvas.getContext('2d');ctx.fillStyle='#23352b';ctx.fillRect(0,0,512,640);ctx.drawImage(imageCanvas(settings),0,0);
 ctx.fillStyle='#15231b80';ctx.beginPath();ctx.rect(0,0,512,640);ctx.ellipse(256,320,215,300,0,0,Math.PI*2);ctx.fill('evenodd');ctx.strokeStyle='#d9f582';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(256,320,215,300,0,0,Math.PI*2);ctx.stroke();
 ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(65,256);ctx.lineTo(447,256);ctx.moveTo(256,20);ctx.lineTo(256,620);ctx.stroke();ctx.setLineDash([]);
 for(const x of [163,349]){ctx.beginPath();ctx.arc(x,256,14,0,Math.PI*2);ctx.stroke();}
 ctx.font='20px Arial';ctx.fillStyle='#e9ffb0';ctx.fillText('EYES',30,242);ctx.fillText('CHIN',232,612);
}
export async function applyPortrait(settings){
 const request=++pending,canvas=imageCanvas(settings),ctx=canvas.getContext('2d'),mask=document.createElement('canvas');mask.width=512;mask.height=640;const m=mask.getContext('2d');
 m.translate(256,320);m.scale(215,300);const gradient=m.createRadialGradient(0,0,.72,0,0,1);gradient.addColorStop(0,'#fff');gradient.addColorStop(.82,'#fffffff0');gradient.addColorStop(1,'#ffffff00');m.fillStyle=gradient;m.fillRect(-1,-1,2,2);
 ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Could not prepare the photo. Try again.');if(request!==pending)return false;
 if(faceUrl)URL.revokeObjectURL(faceUrl);faceUrl=URL.createObjectURL(blob);revision++;return true;
}
export function clearPortrait(){pending++;if(sourceUrl)URL.revokeObjectURL(sourceUrl);if(faceUrl)URL.revokeObjectURL(faceUrl);source=null;sourceUrl='';faceUrl='';revision++;}
