const photos={gym:'https://images.unsplash.com/photo-1743993414654-0be2b73a9620?auto=format&fit=crop&w=1200&q=85',run:'https://images.unsplash.com/photo-1771166446975-2e9e9a9cd3d0?auto=format&fit=crop&w=800&q=85',track:'https://images.unsplash.com/photo-1605822218374-7222c044e434?auto=format&fit=crop&w=800&q=85'};
for(const image of document.querySelectorAll('[data-photo]')){if(photos[image.dataset.photo])image.src=photos[image.dataset.photo];}
const menu=document.querySelector('.menu-toggle');const nav=document.querySelector('nav');menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);});nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}));
import {platforms, normalizeHandle, validateAccounts, estimateAudience} from './audience.mjs';
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
let currentEstimate=null;
let selectedPlacement='Temporary tattoo';
let selectedRaces=1;
const dialog=document.querySelector('#brief-dialog');let role='athlete';document.querySelectorAll('[data-start]').forEach(button=>button.addEventListener('click',()=>{role=button.dataset.start;document.querySelector('#brief-title').textContent=role==='brand'?'Plan your sponsorship.':'Build your race brief.';document.querySelector('#brief-eyebrow').textContent=role==='brand'?'YOUR BRAND. THEIR RACE.':'YOUR NEXT START LINE';document.querySelector('#form-status').textContent='';if(button.id==='use-package'){document.querySelector('[name=placement]').value=selectedPlacement;document.querySelector('[name=package]').value=selectedRaces===3?'Season package':'Single race';}if(button.id==='use-estimate'&&currentEstimate){document.querySelector('[name=audience]').value=currentEstimate.total;document.querySelector('[name=price]').value=Math.round((currentEstimate.low+currentEstimate.high)/2);document.querySelector('[name=package]').value='Single race';}dialog.showModal();}));document.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
document.querySelector('#brief-form').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.target);const text=['ATHLEET — SPONSORSHIP BRIEF','Planning draft — not a published listing or booking','',`Role: ${role}`,`Name / brand: ${data.get('name')}`,`Race: ${data.get('event')}`,`Package: ${data.get('package')}`,`Budget / asking price: ${money.format(data.get('price'))}`,`Expected event attendance: ${data.get('attendance')||'To confirm'}`,`Social audience: ${data.get('audience')||'To confirm'}`,`Likely finish band: ${data.get('finish')||'To confirm'}`,`Placement: ${data.get('placement')}`,'','Deliverables to agree: placement details, social posts, race-day photo proof.','Confirm event advertising rules and existing sponsorship restrictions.'].join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='athleet-sponsorship-brief.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.querySelector('#form-status').textContent='Your brief is ready. Keep it for your first partnership conversation.';});
const placementDescriptions={
 'Temporary tattoo':'A temporary brand mark on an agreed, visible body placement. Subject to event rules.',
 'Kit logo':'Your logo on the athlete’s race kit, with placement and event permissions agreed in advance.',
 'QR code':'A scannable placement that points to your campaign. Scans depend on size, visibility, and conditions.'
};
document.querySelectorAll('[data-placement]').forEach(button=>button.addEventListener('click',()=>{
 selectedPlacement=button.dataset.placement;
 document.querySelectorAll('[data-placement]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));
 document.querySelector('#placement-description').textContent=placementDescriptions[selectedPlacement];
 document.querySelector('#pass-placement').textContent=selectedPlacement+'.';
}));
document.querySelectorAll('[data-races]').forEach(button=>button.addEventListener('click',()=>{
 selectedRaces=Number(button.dataset.races);
 document.querySelectorAll('[data-races]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));
 document.querySelector('#pass-duration').textContent=selectedRaces===1?'SINGLE RACE':'3-RACE SEASON';
 document.querySelector('#pass-races').textContent=String(selectedRaces).padStart(2,'0');
 document.querySelector('#pass-races').nextElementSibling.textContent=selectedRaces===1?'race-day placement':'race-day placements';
}));
let nextAccountId=0;
const accountsContainer=document.querySelector('#social-accounts');
function addAccount(platform){
 const id=++nextAccountId;const config=platforms[platform];
 const row=document.createElement('div');row.className='social-row';row.dataset.platform=platform;
 row.innerHTML=`<div class="account-inputs"><span class="social-platform" aria-hidden="true"></span><label><span class="sr-only"></span><input class="handle-input" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="50"></label><button type="button" class="remove-account">×</button></div><div class="followers-input" hidden><label><span></span><input class="count-input" type="number" min="0" max="2000000000" step="1" inputmode="numeric" placeholder="e.g. 12000"></label></div>`;
 row.querySelector('.social-platform').textContent=config.symbol;
 row.querySelector('.sr-only').textContent=`${config.name} username ${id}`;
 const handle=row.querySelector('.handle-input');handle.placeholder=`@${config.name==='X'?'your_x_handle':config.name.toLowerCase()+'_username'}`;
 row.querySelector('.followers-input span').textContent=`${config.name} followers`;
 row.querySelector('.count-input').setAttribute('aria-label',`${config.name} followers ${id}`);
 const remove=row.querySelector('.remove-account');remove.setAttribute('aria-label',`Remove ${config.name} account ${id}`);
 remove.addEventListener('click',()=>{row.remove();updateAddOptions();document.querySelector('#add-social').focus();});
 handle.addEventListener('input',()=>{document.querySelector('#audience-status').textContent='';row.querySelector('.count-input').value='';if(!handle.value.trim())row.querySelector('.followers-input').hidden=true;});
 accountsContainer.append(row);updateAddOptions();return row;
}
const platformPicker=document.createElement('label');platformPicker.className='platform-select-label';platformPicker.hidden=true;platformPicker.textContent='Choose a platform';
const platformSelect=document.createElement('select');platformSelect.setAttribute('aria-label','Platform to add');platformPicker.append(platformSelect);document.querySelector('#add-social').after(platformPicker);
function updateAddOptions(){
 const used=[...accountsContainer.children].map(row=>row.dataset.platform);
 const available=Object.keys(platforms).filter(platform=>!used.includes(platform));
 platformSelect.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Select a platform';platformSelect.append(placeholder);
 available.forEach(platform=>{const option=document.createElement('option');option.value=platform;option.textContent=platforms[platform].name;platformSelect.append(option);});
 document.querySelector('#add-social').hidden=available.length===0;
 if(!available.length)platformPicker.hidden=true;
}
platformSelect.addEventListener('change',()=>{if(platformSelect.value){const row=addAccount(platformSelect.value);platformPicker.hidden=true;row.querySelector('.handle-input').focus();}});
document.querySelector('#add-social').addEventListener('click',()=>{platformPicker.hidden=!platformPicker.hidden;if(!platformPicker.hidden)platformSelect.focus();});
['instagram','tiktok','x'].forEach(addAccount);
const audienceForm=document.querySelector('#audience-form');
audienceForm.addEventListener('submit',event=>{
 event.preventDefault();const rows=[...accountsContainer.children];const input=rows.map(row=>({platform:row.dataset.platform,handle:row.querySelector('.handle-input').value,followers:row.querySelector('.count-input').value}));
 const result=validateAccounts(input);const status=document.querySelector('#audience-status');
 if(result.error){status.textContent=result.error;return;}
 if(result.needsCounts){rows.filter(row=>row.querySelector('.handle-input').value.trim()).forEach(row=>row.querySelector('.followers-input').hidden=false);status.textContent='Add the current follower count for each handle. Live lookup isn’t connected in this preview.';document.querySelector('#calculate-audience').textContent='Calculate with my counts';rows.find(row=>row.querySelector('.handle-input').value.trim()&&row.querySelector('.count-input').value==='')?.querySelector('.count-input').focus();return;}
 const estimate=estimateAudience(result.accounts);currentEstimate=estimate;
 document.querySelector('#follower-total').textContent=estimate.total.toLocaleString('en-US');
 document.querySelector('#follower-label').textContent=`followers across ${result.accounts.length} ${result.accounts.length===1?'account':'accounts'}`;
 document.querySelector('#audience-price').textContent=`${money.format(estimate.low)}–${money.format(estimate.high)}`;
 const breakdown=document.querySelector('#audience-breakdown');breakdown.replaceChildren();
 result.accounts.forEach(account=>{const row=document.createElement('div');row.className='breakdown-row';const info=document.createElement('div');info.className='breakdown-info';const handle=document.createElement('span');handle.textContent=`${platforms[account.platform].name} · @${account.handle}`;const count=document.createElement('strong');count.textContent=account.followers.toLocaleString('en-US');info.append(handle,count);const bar=document.createElement('div');bar.className='audience-bar';bar.setAttribute('aria-hidden','true');const fill=document.createElement('span');fill.style.width=(estimate.total?account.followers/estimate.total*100:0)+'%';bar.append(fill);row.append(info,bar);breakdown.append(row);});
 audienceForm.hidden=true;document.querySelector('#audience-result').hidden=false;document.querySelector('#edit-audience').focus();
});
document.querySelector('#edit-audience').addEventListener('click',()=>{audienceForm.hidden=false;document.querySelector('#audience-result').hidden=true;document.querySelector('#audience-status').textContent='';accountsContainer.querySelector('.handle-input')?.focus();});
