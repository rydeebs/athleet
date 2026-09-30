const photos={gym:'https://images.unsplash.com/photo-1743993414654-0be2b73a9620?auto=format&fit=crop&w=1200&q=85',run:'https://images.unsplash.com/photo-1771166446975-2e9e9a9cd3d0?auto=format&fit=crop&w=800&q=85',track:'https://images.unsplash.com/photo-1605822218374-7222c044e434?auto=format&fit=crop&w=800&q=85'};
for(const image of document.querySelectorAll('[data-photo]')){if(photos[image.dataset.photo])image.src=photos[image.dataset.photo];}
const menu=document.querySelector('.menu-toggle');const nav=document.querySelector('nav');menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);});nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}));
import {platforms, normalizeHandle, estimateAudience} from './audience.mjs';
import {raceTypes,raceSummary} from './races.mjs';
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
let currentEstimate=null;
let selectedPlacement='Temporary tattoo';
let packageMode='single';
const raceEntries=[];
let includeCalendar=false;
const dialog=document.querySelector('#brief-dialog');let role='athlete';document.querySelectorAll('[data-start]').forEach(button=>button.addEventListener('click',()=>{role=button.dataset.start;document.querySelector('#brief-title').textContent=role==='brand'?'Plan your sponsorship.':'Build your race brief.';document.querySelector('#brief-eyebrow').textContent=role==='brand'?'YOUR BRAND. THEIR RACE.':'YOUR NEXT START LINE';document.querySelector('#form-status').textContent='';if(button.id==='use-package'){document.querySelector('[name=placement]').value=selectedPlacement;document.querySelector('[name=package]').value=packageMode==='season'?'Season package':packageMode==='multi'?'Multi-race package':'Single race';includeCalendar=true;document.querySelector('[name=event]').value=raceEntries.map(r=>r.name||r.type).join(' + ').slice(0,160);}if(button.id==='use-estimate'&&currentEstimate){document.querySelector('[name=audience]').value=currentEstimate.total;document.querySelector('[name=price]').value=Math.round((currentEstimate.low+currentEstimate.high)/2);document.querySelector('[name=package]').value='Single race';includeCalendar=false;}dialog.showModal();}));document.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
document.querySelector('#brief-form').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.target);const text=['ATHLEET — SPONSORSHIP BRIEF','Planning draft — not a published listing or booking','',`Role: ${role}`,`Name / brand: ${data.get('name')}`,`Race: ${data.get('event')}`,`Package: ${data.get('package')}`,`Budget / asking price: ${money.format(data.get('price'))}`,`Expected event attendance: ${data.get('attendance')||'To confirm'}`,`Social audience: ${data.get('audience')||'To confirm'}`,`Likely finish band: ${data.get('finish')||'To confirm'}`,`Placement: ${data.get('placement')}`,...(includeCalendar?['','RACE CALENDAR',...raceEntries.map((race,index)=>{const r=raceSummary(race);return `${index+1}. ${r.title} | ${race.type} | ${r.distance} | ${r.date} | ${r.location} | ${r.field} | Expected finish: ${r.finish}`})]:[]),'','Deliverables to agree: placement details, social posts, race-day photo proof.','Confirm event advertising rules and existing sponsorship restrictions.'].join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='athleet-sponsorship-brief.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.querySelector('#form-status').textContent='Your brief is ready. Keep it for your first partnership conversation.';});
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
let raceId=0;
function updateRacePass(){
 document.querySelector('#pass-duration').textContent=packageMode==='season'?'FULL SEASON':raceEntries.length>1?'MULTI-RACE PACKAGE':'SINGLE RACE';
 document.querySelector('#pass-races').textContent=String(raceEntries.length).padStart(2,'0');
 document.querySelector('#pass-races').nextElementSibling.textContent=raceEntries.length===1?'race-day placement':'race-day placements';
 document.querySelectorAll('[data-package]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.package===packageMode)));
 const itinerary=document.querySelector('#pass-itinerary');itinerary.replaceChildren();
 raceEntries.forEach((race,index)=>{const item=document.createElement('div');item.className='itinerary-race';const r=raceSummary(race);const heading=document.createElement('strong');heading.textContent=`${String(index+1).padStart(2,'0')} / ${r.title}`;const discipline=document.createElement('span');discipline.textContent=`${race.type} · ${r.distance}`;const schedule=document.createElement('span');schedule.textContent=`${r.date} · ${r.location}`;const audience=document.createElement('span');audience.textContent=`${r.field} · ${r.finish}`;item.append(heading,discipline,schedule,audience);itinerary.append(item);});
 document.querySelector('#add-race').disabled=raceEntries.length>=12;
 document.querySelectorAll('.remove-race').forEach(button=>button.disabled=raceEntries.length===1);
}
function addRace(){
 if(raceEntries.length>=12)return;
 const id=++raceId;const race={id,type:'Road running',distance:'5K',custom:'',name:'',location:'',date:'',field:'',finish:''};raceEntries.push(race);
 const card=document.createElement('div');card.className='race-entry';
 card.innerHTML=`<div class="race-entry-heading"><span class="mono">RACE ${String(id).padStart(2,'0')}</span><button type="button" class="remove-race" aria-label="Remove race ${id}">Remove</button></div><div class="race-fields"><label>Discipline<select data-field="type" aria-label="Race ${id} discipline"></select></label><label>Distance / format<select data-field="distance" aria-label="Race ${id} distance"></select></label><label class="custom-distance" hidden>Custom distance<input data-field="custom" aria-label="Race ${id} custom distance" placeholder="e.g. 75K or swim / bike / run" maxlength="80"></label><label>Event name<input data-field="name" aria-label="Race ${id} event name" placeholder="e.g. Your spring half marathon" maxlength="100"></label><label>City / location<input data-field="location" aria-label="Race ${id} location" placeholder="City, country" maxlength="100"></label><label>Race date<input data-field="date" aria-label="Race ${id} date" type="date"></label><label>Expected field size<input data-field="field" aria-label="Race ${id} field size" type="number" min="1" max="1000000" step="1" placeholder="Participants"></label><label class="finish-field">Likely finish band<input data-field="finish" aria-label="Race ${id} finish band" placeholder="e.g. 1:45–2:00 or top 25%" maxlength="100"></label></div>`;
 const type=card.querySelector('[data-field=type]');Object.keys(raceTypes).forEach(name=>type.add(new Option(name,name)));
 const distances=card.querySelector('[data-field=distance]');function setDistances(){distances.replaceChildren();raceTypes[race.type].forEach(name=>distances.add(new Option(name,name)));race.distance=distances.value;card.querySelector('.custom-distance').hidden=race.distance!=='Custom distance';}setDistances();
 card.querySelectorAll('[data-field]').forEach(input=>input.addEventListener('input',()=>{race[input.dataset.field]=input.value;if(input.dataset.field==='type')setDistances();if(input.dataset.field==='distance')card.querySelector('.custom-distance').hidden=input.value!=='Custom distance';if(input.dataset.field==='field'&&!input.validity.valid)race.field='';updateRacePass();}));
 card.querySelector('.remove-race').addEventListener('click',()=>{if(raceEntries.length===1)return;raceEntries.splice(raceEntries.indexOf(race),1);card.remove();if(raceEntries.length===1&&packageMode==='multi')packageMode='single';updateRacePass();});
 document.querySelector('#race-calendar').append(card);if(raceEntries.length>1&&packageMode==='single')packageMode='multi';updateRacePass();
}
document.querySelector('#add-race').addEventListener('click',()=>addRace());
document.querySelectorAll('[data-package]').forEach(button=>button.addEventListener('click',()=>{
 if(button.dataset.package==='single'&&raceEntries.length>1){document.querySelector('.calendar-note').textContent='Remove extra races to make a single-race package. Your entered details are preserved.';return;}
 packageMode=button.dataset.package;if(packageMode==='multi'&&raceEntries.length===1)addRace();updateRacePass();
}));
addRace();
let nextAccountId=0;
const accountsContainer=document.querySelector('#social-accounts');
function addAccount(platform){
 const id=++nextAccountId;const config=platforms[platform];
 const row=document.createElement('div');row.className='social-row';row.dataset.platform=platform;
 row.innerHTML=`<div class="account-inputs"><span class="social-platform" aria-hidden="true"></span><label><span class="sr-only"></span><input class="handle-input" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="50"></label><button type="button" class="remove-account">×</button></div><p class="account-status" aria-live="polite"></p>`;
 row.querySelector('.social-platform').textContent=config.symbol;
 row.querySelector('.sr-only').textContent=`${config.name} username ${id}`;
 const handle=row.querySelector('.handle-input');handle.placeholder=`@${config.name==='X'?'your_x_handle':config.name.toLowerCase()+'_username'}`;
 const remove=row.querySelector('.remove-account');remove.setAttribute('aria-label',`Remove ${config.name} account ${id}`);
 remove.addEventListener('click',()=>{row.remove();updateAddOptions();document.querySelector('#add-social').focus();});
 handle.addEventListener('input',()=>{document.querySelector('#audience-status').textContent='';row.querySelector('.account-status').textContent='';});
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
audienceForm.addEventListener('submit',async event=>{
 event.preventDefault();const rows=[...accountsContainer.children];const accounts=rows.map(row=>({platform:row.dataset.platform,handle:normalizeHandle(row.querySelector('.handle-input').value)})).filter(a=>a.handle);
 const status=document.querySelector('#audience-status');
 if(!accounts.length){status.textContent='Add at least one username to look up.';return;}
 if(accounts.some(a=>!platforms[a.platform].pattern.test(a.handle))){status.textContent='Use a valid username, not a profile URL.';return;}
 const controls=[...audienceForm.querySelectorAll('button,input,select')];controls.forEach(c=>c.disabled=true);audienceForm.setAttribute('aria-busy','true');document.querySelector('#calculate-audience').textContent='Checking public profiles…';status.textContent='Looking up your follower counts. This may take up to 30 seconds.';rows.forEach(row=>row.querySelector('.account-status').textContent=row.querySelector('.handle-input').value.trim()?'Checking…':'');
 let result;
 try{
  const response=await fetch('/api/audience',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accounts}),signal:AbortSignal.timeout(35000)});result=await response.json();if(!response.ok)throw new Error(result.error||'Lookup unavailable. Please try again.');
  result.accounts.forEach(account=>{const row=rows.find(r=>r.dataset.platform===account.platform&&normalizeHandle(r.querySelector('.handle-input').value)===account.handle);if(row)row.querySelector('.account-status').textContent=account.status==='ok'?`${account.approximate?'≈ ':''}${account.followers.toLocaleString('en-US')} followers found`:account.message;});
  if(result.accounts.some(a=>a.status!=='ok')){status.textContent='Some accounts could not be read. Retry, correct the handle, or remove unavailable accounts. We won’t calculate a combined total until every included account is found.';return;}
 }catch(error){status.textContent=error.name==='TimeoutError'?'Lookup timed out. Please try again.':error.message;rows.forEach(row=>{if(row.querySelector('.account-status').textContent==='Checking…')row.querySelector('.account-status').textContent='Lookup unavailable';});return;}
 finally{controls.forEach(c=>c.disabled=false);audienceForm.removeAttribute('aria-busy');document.querySelector('#calculate-audience').textContent='Calculate my race value';}
 const estimate=estimateAudience(result.accounts);currentEstimate=estimate;
 document.querySelector('#follower-total').textContent=(result.accounts.some(a=>a.approximate)?'≈ ':'')+estimate.total.toLocaleString('en-US');
 document.querySelector('#follower-label').textContent=`followers across ${result.accounts.length} ${result.accounts.length===1?'account':'accounts'}`;
 document.querySelector('#audience-price').textContent=`${money.format(estimate.low)}–${money.format(estimate.high)}`;
 const breakdown=document.querySelector('#audience-breakdown');breakdown.replaceChildren();
 result.accounts.forEach(account=>{const row=document.createElement('div');row.className='breakdown-row';const info=document.createElement('div');info.className='breakdown-info';const handle=document.createElement('span');const sourceLink=document.createElement('a');sourceLink.href=account.sourceUrl;sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';sourceLink.textContent=`${platforms[account.platform].name} · @${account.handle}`;handle.append(sourceLink);const count=document.createElement('strong');count.textContent=(account.approximate?'≈ ':'')+account.followers.toLocaleString('en-US');count.title=`Checked ${new Date(account.checkedAt).toLocaleString()} · ${account.via}`;info.append(handle,count);const bar=document.createElement('div');bar.className='audience-bar';bar.setAttribute('aria-hidden','true');const fill=document.createElement('span');fill.style.width=(estimate.total?account.followers/estimate.total*100:0)+'%';bar.append(fill);row.append(info,bar);breakdown.append(row);});
 audienceForm.hidden=true;document.querySelector('#audience-result').hidden=false;document.querySelector('#edit-audience').focus();
});
document.querySelector('#edit-audience').addEventListener('click',()=>{audienceForm.hidden=false;document.querySelector('#audience-result').hidden=true;document.querySelector('#audience-status').textContent='';accountsContainer.querySelector('.handle-input')?.focus();});
