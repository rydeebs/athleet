import {normalizeAvatar,escapeHtml as e,placementInfo,outfits,zones} from './model.mjs';
export const avatarAssetRoot='/assets/athletes/v1/';
export function avatarPoster(avatar={},outfit='singlet'){
 const a=normalizeAvatar(avatar);return `${avatarAssetRoot}${a.presentation}-${Object.hasOwn(outfits,outfit)?outfit:'singlet'}.webp`;
}
// Discovery uses pre-rendered models: no WebGL contexts or Three.js on the results grid.
export function avatarSvg(avatar={},outfit='singlet'){
 return `<img class="athlete-poster" src="${avatarPoster(avatar,outfit)}" alt="Generic race outfit preview" loading="lazy" decoding="async" width="600" height="800"><span class="poster-label">Generic avatar</span>`;
}
export function avatarStudio({avatar,outfit='singlet',view='front',viewKey=0,selected=[],reserved=[],interactive=true,available=null,brand='',logo='',active=''}){
 const config={avatar:normalizeAvatar(avatar),outfit:Object.hasOwn(outfits,outfit)?outfit:'singlet',view,viewKey,selected,reserved,interactive,available,brand,logo,active};
 return `<div class="body-stage model-stage" data-avatar="${e(JSON.stringify(config))}"><div class="stage-grid"></div><div class="stage-orbit"></div><span class="stage-coordinate">3D / PLACEMENT STUDIO</span><div class="model-viewport" role="group" aria-label="Interactive generic athlete model. Use the rotation controls or drag to turn.">${avatarSvg(config.avatar,config.outfit)}</div><div class="model-markers">${zones.filter(z=>interactive&&(!available||available.includes(z))).map(z=>`<button type="button" class="body-hotspot ${selected.includes(z)?'selected':''} ${reserved.includes(z)?'reserved':''}" data-zone="${z}" aria-label="${e(placementInfo(z,outfit).label)}${reserved.includes(z)?' — reserved':''}" aria-pressed="${selected.includes(z)}" ${reserved.includes(z)?'disabled':''} hidden>${reserved.includes(z)?'×':selected.includes(z)?'✓':'+'}</button>`).join('')}</div><div class="model-status" role="status">Loading 3D preview…</div><div class="model-controls" aria-label="3D model controls"><button type="button" data-model-control="left" aria-label="Rotate athlete left">↶</button><button type="button" data-model-control="right" aria-label="Rotate athlete right">↷</button><span></span><button type="button" data-model-control="in" aria-label="Zoom in">＋</button><button type="button" data-model-control="out" aria-label="Zoom out">−</button><button type="button" data-model-control="reset" aria-label="Reset athlete view">⟲</button></div><span class="stage-caption">GENERIC AVATAR · DRAG TO ROTATE · PLACEMENT PREVIEW</span></div>`;
}
// The existing forms replace preview markup as they change. Reuse one renderer across
// those replacements, and dispose it when leaving the studio. Dynamic import keeps
// Three.js off the sponsor directory's initial download.
export function observeAvatars(root){
 let viewer=null,pending=null,scheduled=false;
 async function reconcile(){
  scheduled=false;const stage=root.querySelector('.model-stage');
  if(!stage){viewer?.dispose();viewer=null;return;}
  if(!pending)pending=import('./avatar-viewer.mjs');
  try{const {AvatarViewer}=await pending;if(!stage.isConnected)return;if(!viewer)viewer=new AvatarViewer();await viewer.mount(stage,JSON.parse(stage.dataset.avatar));}
  catch(error){const status=stage.querySelector('.model-status');if(status)status.textContent='3D unavailable. Outfit preview shown; use the placement list below.';stage.classList.add('model-fallback');console.warn('Athlete preview unavailable',error);}
 }
 const observer=new MutationObserver(records=>{if(records.some(r=>r.target===root||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches?.('.model-stage')||n.querySelector?.('.model-stage'))))&&!scheduled){scheduled=true;queueMicrotask(reconcile);}});
 observer.observe(root,{childList:true,subtree:true});reconcile();
}
