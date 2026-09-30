import * as THREE from 'three';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';
import {avatarAssetRoot} from './avatar.mjs';
import {fittedHeadGeometry,projectedEyeGeometry} from './likeness-render.mjs';
import {imagePixels,bakePortrait,portraitEyeGeometry} from './portrait-texture.mjs';
import {medianColor} from './photo-color.mjs';
import {skins} from './model.mjs';
const modelCache=new Map(),textureCache=new Map();
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),textures=new THREE.TextureLoader();
function model(name){if(!modelCache.has(name))modelCache.set(name,loader.loadAsync(avatarAssetRoot+name+'.glb').catch(e=>{modelCache.delete(name);throw e;}));return modelCache.get(name);}
function texture(name){if(!textureCache.has(name))textureCache.set(name,textures.loadAsync(avatarAssetRoot+name).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;t.anisotropy=4;return t;}).catch(e=>{textureCache.delete(name);throw e;}));return textureCache.get(name);}
import {garments,anchors} from './avatar-layout.mjs';
export class AvatarViewer{
 constructor(){
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(32,1,.05,30);this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
  this.canvas=this.renderer.domElement;this.canvas.tabIndex=0;this.canvas.setAttribute('aria-label','Rotate athlete with arrow keys. Plus and minus zoom.');
  this.controls=new OrbitControls(this.camera,this.canvas);this.controls.target.set(0,.9,0);this.controls.enablePan=false;this.controls.enableZoom=true;this.controls.minDistance=.35;this.controls.maxDistance=4.8;this.controls.minPolarAngle=.65;this.controls.maxPolarAngle=2.05;this.controls.enableDamping=false;this.controls.addEventListener('change',()=>this.draw());
  this.scene.add(new THREE.HemisphereLight(0xfff6e8,0x63756a,2.4));
  for(const [pos,color,intensity] of [[[-3,4,4],0xfff4e5,3],[[3,2,2],0xd9eaff,1.6],[[1,3,-3],0xffffff,3]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);this.scene.add(light);}
  const floor=new THREE.Mesh(new THREE.CircleGeometry(.5,64),new THREE.MeshBasicMaterial({color:0x63785e,transparent:true,opacity:.1,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;this.scene.add(floor);this.floor=floor;
  this.ray=new THREE.Raycaster();this.resizeObserver=new ResizeObserver(()=>this.resize());this.version=0;
  this.onKey=e=>{const c={ArrowLeft:'left',ArrowRight:'right','+':'in','=':'in','-':'out',Home:'reset'}[e.key];if(c){e.preventDefault();this.control(c);}};this.canvas.addEventListener('keydown',this.onKey);
  this.onClick=e=>{const b=e.target.closest('[data-model-control]');if(b)this.control(b.dataset.modelControl);};
  this.onContextLost=e=>{e.preventDefault();this.fail('3D paused by your browser. Reload to restore it; the placement list still works.');};this.canvas.addEventListener('webglcontextlost',this.onContextLost);
 }
 async mount(stage,config){
  const version=++this.version,old=this.config;this.config=config;
  if(this.stage!==stage){this.stage?.removeEventListener('click',this.onClick);this.resizeObserver.disconnect();this.stage=stage;stage.querySelector('.model-viewport').append(this.canvas);stage.addEventListener('click',this.onClick);this.resizeObserver.observe(stage);}
  if(!old||old.view!==config.view||old.viewKey!==config.viewKey||old.closeup!==config.closeup)this.reset();this.resize();
  try{
   const a=config.avatar,sex=a.presentation==='feminine'?'female':'male',tone=skins.indexOf(a.skin),hair=a.presentation==='feminine'?'ponytail01':'short02';
   const [asset,skin,hairMap,eyeMap,shoeMap]=await Promise.all([model(a.presentation),texture(`skin-${sex}-${!config.face&&tone>=3?'dark':'light'}.jpg`),texture('hair-'+hair+'.webp'),texture('eyes.jpg'),texture('shoes.jpg')]);
   if(version!==this.version||this.disposed)return;
   if(this.presentation!==a.presentation){this.clearModel();this.body=asset.scene.clone(true);this.body.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.frustumCulled=false;}});this.scene.add(this.body);this.presentation=a.presentation;}
   const visible=new Set(['Body','Hair','Eyes','Shoes',...garments[config.outfit]]);
   if(config.face)visible.delete('Hair');
   this.surfaces=[];this.body.traverse(o=>{if(!o.isMesh)return;const name=o.name.split('_')[0].split('.')[0];o.visible=visible.has(name);const m=o.material;
    if(o.morphTargetInfluences){for(const [key,index] of Object.entries(o.morphTargetDictionary))o.morphTargetInfluences[index]=key===a.build?1:0;}
    m.roughness=.58;m.metalness=0;
    if(name==='Body'){m.map=skin;m.color.set(['#fff5ed','#e5c6a9','#cda581','#fff0dd','#d1b59a','#9a7c64'][tone]||'#ffffff');}
    else if(name==='Hair'){m.map=hairMap;m.color.set('#47372a');m.alphaTest=.35;m.transparent=false;m.side=THREE.DoubleSide;m.depthWrite=true;}
    else if(name==='Eyes'){m.map=config.face?null:eyeMap;m.color.set('#ffffff');m.roughness=config.face?.58:.22;}
    else if(name==='Shoes'){m.map=shoeMap;m.color.set('#d9ddd3');}
    else{m.map=null;m.color.set(a.kit);if(['Shorts','Leggings'].includes(name))m.color.multiplyScalar(.82);m.side=THREE.DoubleSide;m.roughness=.9;}
    m.needsUpdate=true;if(o.visible&&!['Hair','Eyes','Shoes'].includes(name))this.surfaces.push(o);
   });
   this.body.updateMatrixWorld(true);if(config.faceDetails?.skin)this.matchSkin(skin,config.faceDetails.skin);this.findAnchors();await this.updateFace(version);if(version!==this.version)return;await this.updateLogo(version);if(version!==this.version)return;
   stage.classList.remove('model-fallback');stage.classList.add('model-ready');stage.querySelector('.model-status').textContent='';this.draw();
  }catch(error){if(version===this.version)this.fail('3D unavailable. Outfit preview shown; use the placement list below.');throw error;}
 }
 matchSkin(base,color){
  const key=base.uuid+color,body=this.body.getObjectByName('Body');if(!body)return;
  if(this.skinKey!==key){
   this.matchedSkin?.dispose();const canvas=document.createElement('canvas');canvas.width=base.image.width;canvas.height=base.image.height;const ctx=canvas.getContext('2d');ctx.drawImage(base.image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),samples=[];
   for(const x of [-.045,.045]){this.ray.set(new THREE.Vector3(x,1.605,1),new THREE.Vector3(0,0,-1));const hit=this.ray.intersectObject(body,false)[0];if(!hit?.uv)continue;const cx=Math.round(hit.uv.x*(canvas.width-1)),cy=Math.round(hit.uv.y*(canvas.height-1));for(let y=-3;y<=3;y++)for(let dx=-3;dx<=3;dx++){const i=((cy+y)*canvas.width+cx+dx)*4;if(i>=0&&i+2<pixels.data.length)samples.push(Array.from(pixels.data.slice(i,i+3)));}}
   const reference=medianColor(samples)||[220,173,145],target=color.slice(1).match(/../g).map(x=>parseInt(x,16));
   for(let i=0;i<pixels.data.length;i+=4)for(let c=0;c<3;c++)pixels.data[i+c]=Math.min(255,pixels.data[i+c]*target[c]/Math.max(1,reference[c]));
   ctx.putImageData(pixels,0,0);this.matchedSkin=new THREE.CanvasTexture(canvas);this.matchedSkin.flipY=false;this.matchedSkin.colorSpace=THREE.SRGBColorSpace;this.matchedSkin.anisotropy=4;this.skinKey=key;
  }
  this.skinBase=this.matchedSkin;body.material.map=this.matchedSkin;body.material.color.set('#ffffff');body.material.needsUpdate=true;
 }
 findAnchors(){
  this.points={};for(const [zone,[x,y,side]] of Object.entries(anchors)){
   this.ray.set(new THREE.Vector3(x,y,side*2),new THREE.Vector3(0,0,-side));const hit=this.ray.intersectObjects(this.surfaces,false)[0];
   if(hit){const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);this.points[zone]={...hit,normal};}
  }
 }
 async updateLogo(version){
  this.clearLogo();const c=this.config,hit=this.points[c.active];if(!hit||(!c.logo&&!c.brand))return;
  let map,aspect;
  if(c.logo){map=await new THREE.TextureLoader().loadAsync(c.logo);map.colorSpace=THREE.SRGBColorSpace;aspect=map.image.width/map.image.height;}
  else{const canvas=document.createElement('canvas');let ctx=canvas.getContext('2d');ctx.font='700 96px Arial';canvas.width=Math.ceil(ctx.measureText(c.brand).width)+24;canvas.height=128;ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.font='700 96px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(c.brand,canvas.width/2,68);map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;aspect=canvas.width/canvas.height;}
  if(version!==this.version||this.disposed){map.dispose();return;}
  const maxWidth=c.active.includes('arm')?.085:c.active.includes('thigh')?.1:.22;const height=Math.min(maxWidth/aspect,.16),width=height*aspect;
  // Bake the active morph before projecting; DecalGeometry otherwise uses the base pose.
  const mesh=hit.object,geometry=mesh.geometry.clone(),position=geometry.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<position.count;i++){mesh.getVertexPosition(i,v);position.setXYZ(i,v.x,v.y,v.z);}geometry.morphAttributes={};geometry.computeVertexNormals();
  const surface=new THREE.Mesh(geometry);surface.matrixWorld.copy(mesh.matrixWorld);
  const orientation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),hit.normal));
  const decalGeometry=new DecalGeometry(surface,hit.point,orientation,new THREE.Vector3(width,height,.10));geometry.dispose();
  const material=new THREE.MeshStandardMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,roughness:.85});
  this.decal=new THREE.Mesh(decalGeometry,material);this.decal.renderOrder=5;this.scene.add(this.decal);
 }
 async updateFace(version){
  const c=this.config,signature=[c.face,c.faceVersion,c.avatar.presentation,c.avatar.build].join('|');
  if(this.faceSignature===signature){if(this.portraitMap)this.body.getObjectByName('Body').material.map=this.portraitMap;if(this.faceMap)this.body.getObjectByName('Eyes').material.map=this.faceMap;return;}
  this.clearFace();if(!c.face){this.faceSignature=signature;return;}
  const maps=await Promise.all([textures.loadAsync(c.face),c.faceDetails?.hair?textures.loadAsync(c.faceDetails.hair):null,...(c.faceDetails?.multiViews||[]).map(v=>textures.loadAsync(v.url))]);const [map,hairMap]=maps;map.colorSpace=THREE.SRGBColorSpace;map.flipY=false;
  if(version!==this.version||this.disposed){maps.forEach(m=>m?.dispose());return;}
  const body=this.body.getObjectByName('Body');if(c.faceDetails?.fit){this.originalBodyGeometry=body.geometry;body.geometry=fittedHeadGeometry(body,c.faceDetails.fit);}
  const views=(c.faceDetails?.multiViews||[]).map((v,i)=>({...v,image:imagePixels(maps[i+2].image)}));
  const canvas=bakePortrait(imagePixels(this.skinBase.image),body,imagePixels(map.image),hairMap?imagePixels(hairMap.image):null,c.faceDetails||{},views);maps.slice(2).forEach(m=>m.dispose());
  this.portraitMap=new THREE.CanvasTexture(canvas);this.portraitMap.colorSpace=THREE.SRGBColorSpace;this.portraitMap.flipY=false;this.portraitMap.anisotropy=4;body.material.map=this.portraitMap;body.material.needsUpdate=true;
  const eyeCanvas=document.createElement('canvas');eyeCanvas.width=map.image.width;eyeCanvas.height=map.image.height;const eyeCtx=eyeCanvas.getContext('2d');eyeCtx.filter=`brightness(${Math.pow(2,(c.faceDetails?.exposure||0)/100)})`;eyeCtx.drawImage(map.image,0,0);map.image=eyeCanvas;map.needsUpdate=true;
  const eyes=this.body.getObjectByName('Eyes');if(eyes){this.originalEyeGeometry=eyes.geometry;if(c.faceDetails?.fit){const fitted=fittedHeadGeometry(eyes,c.faceDetails.fit);eyes.geometry=fitted;eyes.geometry=projectedEyeGeometry(eyes,views[0].camera,map.image.width,map.image.height);fitted.dispose();}else eyes.geometry=portraitEyeGeometry(eyes);eyes.material.map=map;eyes.material.color.set('#ffffff');eyes.material.needsUpdate=true;}
  hairMap?.dispose();this.faceMap=map;this.faceSignature=signature;
 }
 clearFace(){const body=this.body?.getObjectByName('Body');if(body&&this.originalBodyGeometry){body.geometry.dispose();body.geometry=this.originalBodyGeometry;}this.originalBodyGeometry=null;const eyes=this.body?.getObjectByName('Eyes');if(eyes&&this.originalEyeGeometry){eyes.geometry.dispose();eyes.geometry=this.originalEyeGeometry;}this.originalEyeGeometry=null;this.portraitMap?.dispose();this.portraitMap=null;this.faceMap?.dispose();this.faceMap=null;this.faceSignature='';}
 clearLogo(){if(this.decal){this.scene.remove(this.decal);this.decal.geometry.dispose();this.decal.material.map?.dispose();this.decal.material.dispose();this.decal=null;}}
 clearModel(){this.matchedSkin?.dispose();this.matchedSkin=null;this.skinKey='';this.clearLogo();this.clearFace();if(this.body){this.scene.remove(this.body);this.body.traverse(o=>{if(o.isMesh)o.material.dispose();});this.body=null;}}
 reset(){if(this.config?.closeup){this.camera.position.set(0,1.63,.65);this.controls.target.set(0,1.622,.03);this.controls.update();return;}this.camera.position.set(this.config?.view==='back'?-.16:.16,1.05,this.config?.view==='back'?-3.5:3.5);this.controls.target.set(0,.9,0);this.controls.update();}
 control(action){if(action==='reset')this.reset();else{const offset=this.camera.position.clone().sub(this.controls.target);if(action==='left'||action==='right')offset.applyAxisAngle(new THREE.Vector3(0,1,0),action==='left'?-.35:.35);else offset.multiplyScalar(action==='in'?.86:1.16).clampLength(2.1,4.8);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();}this.draw();}
 resize(){if(!this.stage||this.disposed)return;const {width,height}=this.stage.querySelector('.model-viewport').getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.draw();}
 draw(){if(this.disposed||!this.stage)return;this.renderer.render(this.scene,this.camera);const viewport=this.stage.querySelector('.model-viewport'),w=viewport.clientWidth,h=viewport.clientHeight;
  for(const button of this.stage.querySelectorAll('.body-hotspot')){const p=this.points?.[button.dataset.zone];if(!p){button.hidden=true;continue;}const facing=p.normal.dot(this.camera.position.clone().sub(p.point).normalize())>.15;const projected=p.point.clone().project(this.camera);
   // Raycast from the camera to avoid markers showing through an arm or the body.
   this.ray.set(this.camera.position,p.point.clone().sub(this.camera.position).normalize());const blocker=this.ray.intersectObjects(this.surfaces,false)[0];const visible=facing&&projected.z<1&&(!blocker||blocker.distance>=this.camera.position.distanceTo(p.point)-.025);
   button.hidden=!visible;button.style.left=(projected.x*.5+.5)*w+'px';button.style.top=(-projected.y*.5+.5)*h+(button.dataset.zone===this.config.active?34:0)+'px';
  }
 }
 fail(message){if(!this.stage)return;this.stage.classList.remove('model-ready');this.stage.classList.add('model-fallback');this.stage.querySelector('.model-status').textContent=message;}
 dispose(){this.disposed=true;this.version++;this.resizeObserver.disconnect();this.stage?.removeEventListener('click',this.onClick);this.canvas.removeEventListener('keydown',this.onKey);this.canvas.removeEventListener('webglcontextlost',this.onContextLost);this.controls.dispose();this.clearModel();this.floor.geometry.dispose();this.floor.material.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.canvas.remove();}
}
