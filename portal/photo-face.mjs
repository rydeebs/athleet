import {sampleCheeks,colorHex} from './photo-color.mjs';
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
let source=null,sourceUrl='',faceUrl='',hairUrl='',details=null,revision=0,pending=0;
export const facePreview=()=>({url:faceUrl,version:revision,details});
export function portraitAvailable(){return !!source;}
export async function readPortrait(file){
 validatePortrait(file);const request=++pending,url=URL.createObjectURL(file),img=new Image();
 try{img.src=url;await img.decode();if(img.naturalWidth<160||img.naturalHeight<160)throw new Error('Choose a sharper portrait at least 160 × 160 pixels.');if(img.naturalWidth*img.naturalHeight>portraitLimits.pixels)throw new Error('This photo is too large. Resize it below 32 megapixels.');if(request!==pending){URL.revokeObjectURL(url);return false;}
  if(sourceUrl)URL.revokeObjectURL(sourceUrl);source=img;sourceUrl=url;return true;
 }catch(error){URL.revokeObjectURL(url);throw new Error(error.message?.startsWith('Choose')||error.message?.startsWith('This')?error.message:'Could not open that photo. Try a JPG, PNG or WebP image.');}
}
function imageCanvas(settings,extended=false){
 if(!source)throw new Error('Choose a portrait first.');const canvas=document.createElement('canvas');canvas.width=extended?1024:512;canvas.height=extended?(settings.hairLength==='long'?1792:1024):640;const ctx=canvas.getContext('2d');const t=portraitTransform(source.naturalWidth,source.naturalHeight,settings);
 ctx.translate(t.x+(extended?256:0),t.y+(extended?256:0));ctx.rotate(t.rotation);ctx.scale(t.scale,t.scale);ctx.drawImage(source,-source.naturalWidth/2,-source.naturalHeight/2);ctx.setTransform(1,0,0,1,0,0);return canvas;
}
export function drawPortraitGuide(canvas,settings){
 if(!canvas||!source)return;if(settings.guide==='hair'){const extended=imageCanvas(settings,true);canvas.width=extended.width;canvas.height=extended.height;const c=canvas.getContext('2d');c.fillStyle='#23352b';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(extended,0,0);c.strokeStyle='#d9f582';c.lineWidth=4;c.strokeRect(256,256,512,640);c.font='28px Arial';c.fillStyle='#d9f582';c.fillText('FACE AREA · KEEP ALL HAIR IN FRAME',24,45);return;}canvas.width=512;canvas.height=640;const ctx=canvas.getContext('2d');ctx.fillStyle='#23352b';ctx.fillRect(0,0,512,640);ctx.drawImage(imageCanvas(settings),0,0);
 ctx.fillStyle='#15231b80';ctx.beginPath();ctx.rect(0,0,512,640);ctx.ellipse(256,320,215,300,0,0,Math.PI*2);ctx.fill('evenodd');ctx.strokeStyle='#d9f582';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(256,320,215,300,0,0,Math.PI*2);ctx.stroke();
 ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(65,282);ctx.lineTo(447,282);ctx.moveTo(256,20);ctx.lineTo(256,620);ctx.stroke();ctx.setLineDash([]);
 for(const x of [163,349]){ctx.beginPath();ctx.arc(x,282,14,0,Math.PI*2);ctx.stroke();}
 ctx.font='20px Arial';ctx.fillStyle='#e9ffb0';ctx.fillText('EYES',30,268);ctx.fillText('CHIN',232,612);
 if(settings.skinPoint){ctx.strokeStyle='#fff';ctx.beginPath();ctx.arc(settings.skinPoint[0]*512,settings.skinPoint[1]*640,10,0,Math.PI*2);ctx.stroke();}
 if(settings.includeHair){ctx.strokeStyle='#fff';ctx.setLineDash([5,5]);ctx.strokeRect(8,8,496,settings.hairLength==='long'?624:105);ctx.setLineDash([]);ctx.fillText('HAIR INCLUDED',20,40);}
}
export async function applyPortrait(settings){
 const request=++pending,canvas=imageCanvas(settings),ctx=canvas.getContext('2d'),extended=imageCanvas(settings,true);
 let segmentation;
 try{const {segmentPortrait}=await import('./photo-segmentation.mjs');segmentation=await segmentPortrait(extended);}catch{throw new Error('Could not load local hair/skin analysis. Check your connection, then try again. Your photo has not been uploaded.');}
 if(request!==pending)return false;
 const extContext=extended.getContext('2d'),pixels=extContext.getImageData(0,0,extended.width,extended.height);
 const rgb=sampleCheeks(pixels.data,extended.width,extended.height,segmentation.skin,segmentation.width,segmentation.height,{offsetX:256,offsetY:256,point:settings.skinPoint,exposure:Number(settings.skinExposure)||0});
 if(!rgb)throw new Error('Could not sample clear skin. Align your face, then click a clear cheek area in the photo and apply again.');
 const mask=document.createElement('canvas');mask.width=512;mask.height=640;const m=mask.getContext('2d');
 m.translate(256,320);m.scale(230,307);const gradient=m.createRadialGradient(0,0,.62,0,0,1);gradient.addColorStop(0,'#fff');gradient.addColorStop(.65,'#fffffff0');gradient.addColorStop(1,'#ffffff00');m.fillStyle=gradient;m.fillRect(-1,-1,2,2);
 ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';
 let nextHair=null;
 if(settings.includeHair&&settings.hairLength!=='none'){
  // Class 1 is hair; remove background, clothes and skin rather than cutting an oval.
  let count=0;
  for(let y=0;y<extended.height;y++)for(let x=0;x<extended.width;x++){const i=(y*extended.width+x)*4,j=Math.floor(y/extended.height*segmentation.height)*segmentation.width+Math.floor(x/extended.width*segmentation.width);const alpha=Math.max(0,Math.min(1,(segmentation.hair[j]-.18)/.62));pixels.data[i+3]=Math.round(pixels.data[i+3]*alpha);if(alpha>.5)count++;}
  if(count<80)throw new Error('No clear hair found. Include the top and sides of your hair in the photo, or choose No hair.');
  extContext.putImageData(pixels,0,0);nextHair=await new Promise(resolve=>extended.toBlob(resolve,'image/png'));
 }
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Could not prepare the photo. Try again.');if(request!==pending)return false;
 if(faceUrl)URL.revokeObjectURL(faceUrl);if(hairUrl)URL.revokeObjectURL(hairUrl);
 faceUrl=URL.createObjectURL(blob);hairUrl=nextHair?URL.createObjectURL(nextHair):'';
 details={skin:colorHex(rgb),hair:hairUrl,hairLength:settings.hairLength||'short',hairHeight:extended.height,includeHair:!!settings.includeHair};revision++;return true;
}
export function clearPortrait(){pending++;if(sourceUrl)URL.revokeObjectURL(sourceUrl);if(faceUrl)URL.revokeObjectURL(faceUrl);if(hairUrl)URL.revokeObjectURL(hairUrl);source=null;sourceUrl='';faceUrl='';hairUrl='';details=null;revision++;}

export function cancelPortraitProcessing(){pending++;}
