export const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export function medianColor(samples){if(samples.length<12)return null;return [0,1,2].map(c=>{const sorted=samples.map(p=>p[c]).sort((a,b)=>a-b);return Math.round(sorted[Math.floor(sorted.length/2)]);});}
export function colorHex(rgb){return '#'+rgb.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');}
export function sampleCheeks(data,width,height,skinMask,maskWidth,maskHeight,{offsetX=0,offsetY=0,point=null,exposure=0}={}){
 const samples=[];const points=point?[point]:[[.28,.56],[.72,.56]];
 for(const [cx,cy] of points)for(let dy=-12;dy<=12;dy+=2)for(let dx=-12;dx<=12;dx+=2){const x=Math.round(cx*512+offsetX+dx),y=Math.round(cy*640+offsetY+dy);if(x<0||y<0||x>=width||y>=height)continue;const k=(y*width+x)*4,m=Math.floor(y/height*maskHeight)*maskWidth+Math.floor(x/width*maskWidth);if(data[k+3]<240||(!point&&skinMask[m]<.7))continue;const rgb=Array.from(data.slice(k,k+3));const lum=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];if(lum<18||lum>245)continue;samples.push(rgb);}
 const rgb=medianColor(samples);return rgb?rgb.map(v=>clamp(v*Math.pow(2,exposure/100),0,255)):null;
}
