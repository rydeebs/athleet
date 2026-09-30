import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';
import {avatarAssetRoot} from './avatar.mjs';
import {skins} from './model.mjs';
const modelCache=new Map(),textureCache=new Map();
const loader=new GLTFLoader(),textures=new THREE.TextureLoader();
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
   const [asset,skin,hairMap,eyeMap,shoeMap]=await Promise.all([model(a.presentation),texture(`skin-${sex}-${tone>=3?'dark':'light'}.jpg`),texture('hair-'+hair+'.webp'),texture('eyes.jpg'),texture('shoes.jpg')]);
   if(version!==this.version||this.disposed)return;
   if(this.presentation!==a.presentation){this.clearModel();this.body=asset.scene.clone(true);this.body.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.frustumCulled=false;}});this.scene.add(this.body);this.presentation=a.presentation;}
   const visible=new Set(['Body','Hair','Eyes','Shoes',...garments[config.outfit]]);
   this.surfaces=[];this.body.traverse(o=>{if(!o.isMesh)return;const name=o.name.split('_')[0].split('.')[0];o.visible=visible.has(name);const m=o.material;
    if(o.morphTargetInfluences){for(const [key,index] of Object.entries(o.morphTargetDictionary))o.morphTargetInfluences[index]=key===a.build?1:0;}
    m.roughness=.74;m.metalness=0;
    if(name==='Body'){m.map=skin;m.color.set(['#fff5ed','#e5c6a9','#cda581','#fff0dd','#d1b59a','#9a7c64'][tone]||'#ffffff');}
    else if(name==='Hair'){m.map=hairMap;m.color.set('#47372a');m.alphaTest=.35;m.transparent=false;m.side=THREE.DoubleSide;m.depthWrite=true;}
    else if(name==='Eyes'){m.map=eyeMap;m.color.set('#ffffff');m.roughness=.22;}
    else if(name==='Shoes'){m.map=shoeMap;m.color.set('#d9ddd3');}
    else{m.map=null;m.color.set(a.kit);m.side=THREE.DoubleSide;m.roughness=.9;}
    m.needsUpdate=true;if(o.visible&&!['Hair','Eyes','Shoes'].includes(name))this.surfaces.push(o);
   });
   this.body.updateMatrixWorld(true);this.findAnchors();await this.updateFace(version);if(version!==this.version)return;await this.updateLogo(version);if(version!==this.version)return;
   stage.classList.remove('model-fallback');stage.classList.add('model-ready');stage.querySelector('.model-status').textContent='';this.draw();
  }catch(error){if(version===this.version)this.fail('3D unavailable. Outfit preview shown; use the placement list below.');throw error;}
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
  if(this.faceSignature===signature)return;this.clearFace();if(!c.face){this.faceSignature=signature;return;}
  const map=await new THREE.TextureLoader().loadAsync(c.face);map.colorSpace=THREE.SRGBColorSpace;
  if(version!==this.version||this.disposed){map.dispose();return;}
  this.faceSignature=signature;this.faceMap=map;this.faceMeshes=[];
  // Project the aligned portrait onto the existing face and eye surfaces. This
  // personalizes texture only: head geometry, profile and hair remain generic.
  for(const name of ['Body','Eyes']){
   const mesh=this.body.getObjectByName(name);if(!mesh)continue;
   const geometry=mesh.geometry.clone(),p=geometry.attributes.position,v=new THREE.Vector3();
   for(let i=0;i<p.count;i++){mesh.getVertexPosition(i,v);p.setXYZ(i,v.x,v.y,v.z);}geometry.morphAttributes={};geometry.computeVertexNormals();
   const surface=new THREE.Mesh(geometry);surface.matrixWorld.copy(mesh.matrixWorld);
   const decal=new DecalGeometry(surface,new THREE.Vector3(0,1.622,.14),new THREE.Euler(),new THREE.Vector3(.18,.225,.19));geometry.dispose();
   const material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6,toneMapped:false});
   const face=new THREE.Mesh(decal,material);face.renderOrder=4;this.faceMeshes.push(face);this.scene.add(face);
  }
 }
 clearFace(){for(const face of this.faceMeshes||[]){this.scene.remove(face);face.geometry.dispose();face.material.dispose();}this.faceMap?.dispose();this.faceMap=null;this.faceMeshes=[];this.faceSignature='';}
 clearLogo(){if(this.decal){this.scene.remove(this.decal);this.decal.geometry.dispose();this.decal.material.map?.dispose();this.decal.material.dispose();this.decal=null;}}
 clearModel(){this.clearLogo();this.clearFace();if(this.body){this.scene.remove(this.body);this.body.traverse(o=>{if(o.isMesh)o.material.dispose();});this.body=null;}}
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
