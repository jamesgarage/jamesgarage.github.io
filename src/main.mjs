import { GameScene } from './scene.mjs';
import { GameAudio } from './audio.mjs';
import { TRUCKS, COURSE_LENGTH, createProgress, createRace, stepRace, selectTruck, unlockedTrucks, awardRace } from './core.mjs';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'monster-skyway.progress.v1';
const overlays = ['garage','pause-overlay','results','settings'];
let progress, storageWorks=true;
try { progress=createProgress(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { progress=createProgress(); storageWorks=false; }
if(!localStorageAvailable())storageWorks=false;
function localStorageAvailable(){try{const k='monster-skyway.probe';localStorage.setItem(k,'1');localStorage.removeItem(k);return true;}catch{return false;}}
let race=createRace(), world, previous=0, accumulator=0, calloutTimer, lastFocus, pausedBySettings=false;
const held=new Set();
const input={jump:false,steer:0,transform:false};
const audio=new GameAudio();
audio.setMuted(progress.muted);

function save() {try{localStorage.setItem(SAVE_KEY,JSON.stringify(progress));storageWorks=true;}catch{storageWorks=false;}updateStorageNote();}
function updateStorageNote(){document.querySelector('.settings-note').textContent=storageWorks?'Progress saves on this device. No accounts, no purchases — just play.':'Your browser cannot save progress right now. You can still play; this visit’s trucks stay until you close the page.';}
function selected(){return TRUCKS.find(t=>t.id===progress.selected)||TRUCKS[0];}
function say(message,seconds=2.3){clearTimeout(calloutTimer);$('callout').textContent=message;$('callout').classList.remove('show');requestAnimationFrame(()=>$('callout').classList.add('show'));calloutTimer=setTimeout(()=>$('callout').textContent='',seconds*1000);}
function clearInput(){held.clear();input.jump=false;input.steer=0;input.transform=false;document.querySelectorAll('.pressed').forEach(el=>el.classList.remove('pressed'));}
function showModal(id){lastFocus=document.activeElement;overlays.forEach(other=>$(other).hidden=other!==id);$(id).hidden=false;setTimeout(()=>$(id).querySelector('button:not(:disabled),input')?.focus(),0);syncInert();}
function hideModals(){overlays.forEach(id=>$(id).hidden=true);syncInert();if(lastFocus?.isConnected&&!lastFocus.closest('[hidden]'))lastFocus.focus();}
function syncInert(){const active=overlays.find(id=>!$(id).hidden);$('menu').inert=!!active;$('hud').inert=!!active;$('controls').inert=!!active;document.querySelector('.global-tools').inert=!!active;}
function syncPreferences(){
  $('sound-btn').setAttribute('aria-pressed',String(!progress.muted));$('sound-btn').setAttribute('aria-label',progress.muted?'Turn sound on':'Turn sound off');
  $('sound-btn').style.filter=progress.muted?'grayscale(1)':'none';
  $('motion-toggle').checked=progress.reducedMotion;document.body.classList.toggle('reduced-motion',progress.reducedMotion);
  if(world)world.reducedMotion=progress.reducedMotion;audio.setMuted(progress.muted);updateStorageNote();
}
function nextReward(){const next=TRUCKS.find(t=>t.threshold>progress.stars);return next?`${next.name} is next · ${next.threshold-progress.stars} stars to go`:'Mega Titan unlocked. Your whole crew is ready!';}
function refreshMenu(){ $('menu-next').textContent=`Driving ${selected().name} · ${nextReward()}`; }

function truckPicture(spec,locked=false) {
  const color=`#${spec.color.toString(16).padStart(6,'0')}`, accent=`#${spec.accent.toString(16).padStart(6,'0')}`;
  const cab=spec.id==='chrome-guardian'?'M56 57 84 26 129 28 165 57Z':'M66 55 69 29 124 29 140 55Z';
  const decor=spec.id==='bear-crusher'?`<circle cx="75" cy="27" r="10" fill="${accent}"/><circle cx="121" cy="27" r="10" fill="${accent}"/>`:spec.id==='gator-claw'?`<path d="m63 33 8-14 8 14 9-14 8 14 9-14 8 14 9-14 8 14" fill="${accent}"/>`:spec.id==='mega-titan'?`<path d="m75 30-4-18 18 10 11-19 11 19 18-10-4 18" fill="${accent}"/>`:'';
  return `<svg viewBox="0 0 220 120" aria-hidden="true" style="width:100%;height:120px;${locked?'filter:brightness(.4) saturate(.5);':''}"><ellipse cx="111" cy="105" rx="89" ry="8" fill="#071724" opacity=".5"/>${decor}<path d="${cab}" fill="${color}" stroke="#112a3a" stroke-width="3"/><path d="M39 53h140l15 24-5 14H30V64Z" fill="${color}" stroke="#112a3a" stroke-width="3"/><path d="M80 35h38l14 19H77Z" fill="#90e4e7"/><path d="M134 57h32v7h-32Z" fill="${accent}"/><path d="M46 70h76" stroke="${accent}" stroke-width="7"/><path d="M180 69h12v8h-12Z" fill="#fff0b2"/><g fill="#172837" stroke="#354957" stroke-width="5"><circle cx="60" cy="88" r="25"/><circle cx="161" cy="88" r="25"/></g><g fill="${accent}" stroke="#132c3e" stroke-width="5"><circle cx="60" cy="88" r="13"/><circle cx="161" cy="88" r="13"/></g><g fill="#d5e0df"><circle cx="60" cy="88" r="4"/><circle cx="161" cy="88" r="4"/></g></svg>`;
}
function renderGarage(){
  $('garage-stars').textContent=progress.stars;$('garage-progress').textContent=nextReward();
  $('truck-list').replaceChildren(...TRUCKS.map((spec,i)=>{
    const unlocked=spec.threshold<=progress.stars, chosen=spec.id===progress.selected;
    const card=document.createElement('button');card.type='button';card.className=`truck-card ${unlocked?'':'locked'} ${chosen?'selected':''}`;card.dataset.truck=spec.id;
    card.setAttribute('aria-pressed',String(chosen));card.setAttribute('aria-label',`${spec.name}, ${chosen?'selected':unlocked?'ready to drive':`${spec.threshold-progress.stars} stars to unlock`}`);
    card.innerHTML=`<div class="truck-meta"><span class="truck-badge">0${i+1}</span><span class="truck-status">${chosen?'DRIVING':unlocked?'READY':'COMING SOON'}</span></div><div class="truck-preview">${truckPicture(spec,!unlocked)}</div><strong class="truck-name">${spec.name}</strong><span class="truck-description">${spec.tagline}</span><span class="truck-price">${unlocked?(chosen?'✓ Your ride':'Choose truck'):`★ ${spec.threshold-progress.stars} more stars`}</span>`;
    card.addEventListener('click',()=>{
      if(!unlocked){$('garage-progress').textContent=`${spec.name} is getting closer. ${spec.threshold-progress.stars} more stars!`;return;}
      progress=selectTruck(progress,spec.id);save();world.setTruck(spec);audio.play('select');renderGarage();refreshMenu();
      $('truck-list').querySelector(`[data-truck="${spec.id}"]`)?.focus();
    });return card;
  }));
}
function showGarage(){menu();renderGarage();showModal('garage');}
function menu(){clearInput();race.phase='ready';audio.setDriving(false);audio.pause();world.menu();hideModals();$('menu').hidden=false;$('hud').hidden=true;$('controls').hidden=true;document.body.classList.remove('playing');$('callout').textContent='';refreshMenu();}
async function start(){
  clearInput();hideModals();race=createRace();race.phase='running';world.reset();world.setTruck(selected());
  $('menu').hidden=true;$('hud').hidden=false;$('controls').hidden=false;document.body.classList.add('playing');
  previous=performance.now();accumulator=0;await audio.start();await audio.resume();audio.setMuted(progress.muted);audio.setDriving(true);audio.play('start');say('Let’s roll!',1.6);$('jump-btn').focus();
}
function pause(){if(race.phase!=='running')return;race.phase='paused';clearInput();audio.pause();showModal('pause-overlay');$('callout').textContent='';}
async function resume(){if(race.phase!=='paused')return;hideModals();race.phase='running';previous=performance.now();accumulator=0;await audio.resume();audio.setDriving(true);}
function finish(){
  if(race.rewardGranted)return;race.rewardGranted=true;clearInput();audio.setDriving(false);audio.play('finish');world.burst(true,70);
  const before=unlockedTrucks(progress).length;progress=awardRace(progress,race.stars);save();
  const unlocked=unlockedTrucks(progress).slice(before);
  $('result-title').textContent=unlocked.length?'New truck day!':'Monster moves!';
  $('result-stars').textContent=`+${12+Math.min(50,race.stars)}`;
  $('result-unlock').textContent=unlocked.length?`${unlocked.map(t=>t.name).join(' & ')} joined your crew! Choose your new ride in the garage.`:`12 finish stars + ${Math.min(50,race.stars)} bonus stars. ${nextReward()}`;
  $('controls').hidden=true;showModal('results');refreshMenu();
}

$('play-btn').addEventListener('click',start);$('race-again-btn').addEventListener('click',start);
$('garage-btn').addEventListener('click',showGarage);$('result-garage-btn').addEventListener('click',showGarage);
$('garage-close').addEventListener('click',()=>{hideModals();$('play-btn').focus();});
$('pause-btn').addEventListener('click',pause);$('resume-btn').addEventListener('click',resume);$('quit-btn').addEventListener('click',showGarage);
$('sound-btn').addEventListener('click',async()=>{progress.muted=!progress.muted;syncPreferences();save();if(!progress.muted){await audio.start();audio.play('select');}});
$('settings-btn').addEventListener('click',()=>{pausedBySettings=race.phase==='running';if(pausedBySettings){race.phase='paused';clearInput();audio.pause();}showModal('settings');});
$('settings-close').addEventListener('click',()=>{ $('reset-confirm').hidden=true;hideModals();if(pausedBySettings)resume();pausedBySettings=false;});
$('motion-toggle').addEventListener('change',()=>{progress.reducedMotion=$('motion-toggle').checked;syncPreferences();save();});
$('reset-btn').addEventListener('click',()=>{$('reset-confirm').hidden=false;$('reset-no').focus();});
$('reset-no').addEventListener('click',()=>{$('reset-confirm').hidden=true;$('reset-btn').focus();});
$('reset-yes').addEventListener('click',()=>{progress=createProgress({version:1,muted:progress.muted,reducedMotion:progress.reducedMotion});save();world.setTruck(selected());pausedBySettings=false;$('reset-confirm').hidden=true;menu();showGarage();});
function jump(){if(race.phase==='running')input.jump=true;}
function transform(){if(race.phase==='running')input.transform=true;}
$('jump-btn').addEventListener('pointerdown',e=>{e.preventDefault();jump();});
$('jump-btn').addEventListener('click',e=>{if(e.detail===0)jump();});
$('transform-btn').addEventListener('pointerdown',e=>{e.preventDefault();transform();});
$('transform-btn').addEventListener('click',e=>{if(e.detail===0)transform();});
$('game-canvas').addEventListener('pointerdown',jump);
for(const [id,key] of [['left-btn','left'],['right-btn','right']]) {
  const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();if(race.phase!=='running')return;b.setPointerCapture(e.pointerId);held.add(key);b.classList.add('pressed');});
  b.addEventListener('click',e=>{if(e.detail===0&&race.phase==='running')race.targetLane=Math.max(-1,Math.min(1,race.targetLane+(key==='left'?-1:1)));});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>{held.delete(key);b.classList.remove('pressed');});
}
document.addEventListener('keydown',e=>{
  const modal=overlays.find(id=>!$(id).hidden);
  if(modal){
    if(e.key==='Tab'){const list=[...$(modal).querySelectorAll('button:not(:disabled),input')].filter(el=>!el.closest('[hidden]'));const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){last?.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first?.focus();e.preventDefault();}}
    if(e.key==='Escape'){e.preventDefault();if(modal==='pause-overlay')resume();else if(modal==='garage')$('garage-close').click();else if(modal==='settings')$('settings-close').click();}
    return;
  }
  if(e.key==='Escape'||e.key.toLowerCase()==='p'){if(race.phase==='running'){e.preventDefault();pause();}return;}
  if(race.phase!=='running')return;
  if(e.key===' '&&e.target instanceof Element&&e.target.closest('button,input'))return;
  if(['ArrowLeft','ArrowRight',' ','ArrowUp','a','d','t'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft'||e.key==='a')held.add('left');if(e.key==='ArrowRight'||e.key==='d')held.add('right');if(e.key===' '||e.key==='ArrowUp')jump();if(e.key==='t')transform();}
});
document.addEventListener('keyup',e=>{if(e.key==='ArrowLeft'||e.key==='a')held.delete('left');if(e.key==='ArrowRight'||e.key==='d')held.delete('right');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('blur',()=>{clearInput();pause();});
window.addEventListener('resize',()=>world?.resize());
$('game-canvas').addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('error').hidden=false;$('error').textContent='The graphics took a little pit stop. Reload to keep playing — your saved trucks are safe.';});

try {
  world=new GameScene($('game-canvas'),selected());syncPreferences();refreshMenu();$('loading').hidden=true;
  let hudTick=0;
  world.renderer.setAnimationLoop(now=>{
    const dt=Math.min(Math.max((now-previous)/1000,0),.08);previous=now;
    if(race.phase==='running'){
      accumulator+=dt;
      while(accumulator>=1/60){
        input.steer=(held.has('right')?1:0)-(held.has('left')?1:0);
        const events=stepRace(race,1/60,input);input.jump=false;input.transform=false;accumulator-=1/60;
        for(const event of events){audio.play(event.type);if(event.type==='land')world.land();if(event.type==='transform'){say('Guardian mode!');world.burst(true,25);}if(event.type==='loop')say('Loop legend!');if(event.type==='finish')finish();}
      }
    }
    const visualDt=race.phase==='paused'?0:dt;
    const stars=world.update(visualDt,race);if(stars){race.stars+=stars;audio.play('star');}
    audio.update(1,race.height>0,race.transformTime>0);
    hudTick+=dt;
    if(hudTick>.08){hudTick=0;$('race-stars').textContent=race.stars;const percent=race.distance/COURSE_LENGTH*100;$('race-progress').value=percent;$('race-distance').textContent=`${Math.floor(percent)}%`;$('energy-fill').style.width=`${race.transformTime>0?race.transformTime/9*100:race.energy}%`;$('transform-btn').disabled=race.energy<100;$('transform-btn').setAttribute('aria-label',race.transformTime>0?'Guardian mode active':race.energy<100?'Transformation charging':'Transform truck');}
  });
  // Read-only diagnostics for local browser smoke tests and frame-budget checks.
  Object.defineProperty(window,'__skyway',{get:()=>Object.freeze({phase:race.phase,distance:race.distance,height:race.height,landings:race.landings,loops:race.loops,stars:race.stars,energy:race.energy,transformed:race.transformTime>0,selected:progress.selected,totalStars:progress.stars,races:progress.races,drawCalls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles,flames:world.flames.mesh.count})});
} catch(error) {
  $('loading').hidden=true;$('error').hidden=false;$('error').textContent='This adventure needs a browser with 3D graphics (WebGL 2). Try an updated Safari, Chrome, or Edge with graphics acceleration enabled.';
  $('play-btn').disabled=true;$('garage-btn').disabled=true;console.error('Unable to start Monster Skyway:',error);
}
