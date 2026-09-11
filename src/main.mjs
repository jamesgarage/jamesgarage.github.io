import { GameScene, sampleTrack } from './scene.mjs';
import { GameAudio } from './audio.mjs';
import { racePlace } from './buddies.mjs';
import { TRUCKS, COURSE_LENGTH, RACE_SPEED, createProgress, createRace, stepRace, selectTruck, unlockedTrucks, awardRace } from './core.mjs';
import { getCourse, courseProgress } from './courses.mjs';
import { renderCourses } from './course-picker.mjs';
import { installTouchGuard } from './touch-guard.mjs';
import { GamepadControls } from './gamepad-controls.mjs';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'monster-skyway.progress.v1';
const overlays = ['garage','tracks','pause-overlay','results','settings'];
let progress, storageWorks=true;
try { progress=createProgress(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { progress=createProgress(); storageWorks=false; }
if(!localStorageAvailable())storageWorks=false;
function localStorageAvailable(){try{const k='monster-skyway.probe';localStorage.setItem(k,'1');localStorage.removeItem(k);return true;}catch{return false;}}
let race=createRace(progress.races,progress.courseId), world, previous=0, accumulator=0, calloutRemaining=0, calloutPriority=0, lastFocus, pausedBySettings=false, shownPlace=0;
const held=new Set();
const touchSteering=new Map();
let gamepad;
const input={jump:false,steer:0,transform:false,turbo:false};
const audio=new GameAudio();
audio.setMuted(progress.muted);

function save() {try{localStorage.setItem(SAVE_KEY,JSON.stringify(progress));storageWorks=true;}catch{storageWorks=false;}updateStorageNote();}
function updateStorageNote(){document.querySelector('.settings-note').textContent=storageWorks?'Progress saves on this device. No accounts, no purchases — just play.':'Your browser cannot save progress right now. You can still play; this visit’s trucks stay until you close the page.';}
function selected(){return TRUCKS.find(t=>t.id===progress.selected)||TRUCKS[0];}
function say(message,seconds=2.3,priority=1){if(calloutRemaining>0&&priority<calloutPriority)return;calloutRemaining=seconds;calloutPriority=priority;$('callout').textContent=message;$('callout').classList.remove('show');requestAnimationFrame(()=>$('callout').classList.add('show'));}
function clearCallout(){calloutRemaining=0;calloutPriority=0;$('callout').textContent='';}
function clearInput(){held.clear();touchSteering.clear();gamepad?.clear();input.jump=false;input.steer=0;input.transform=false;input.turbo=false;document.querySelectorAll('.pressed').forEach(el=>el.classList.remove('pressed'));}
function showModal(id){lastFocus=document.activeElement;overlays.forEach(other=>$(other).hidden=other!==id);$(id).hidden=false;syncInert();if(gamepad?.connected)gamepad.focus(gamepad.defaultFocus($(id)),$(id));else $(id).querySelector('button:not(:disabled),input')?.focus();}
function hideModals(){overlays.forEach(id=>$(id).hidden=true);syncInert();if(lastFocus?.isConnected&&!lastFocus.closest('[hidden]'))lastFocus.focus();}
function syncInert(){const active=overlays.find(id=>!$(id).hidden);$('menu').inert=!!active;$('hud').inert=!!active;$('controls').inert=!!active;document.querySelector('.global-tools').inert=!!active;}
function syncPreferences(){
  $('sound-btn').setAttribute('aria-pressed',String(!progress.muted));$('sound-btn').setAttribute('aria-label',progress.muted?'Turn sound on':'Turn sound off');
  $('sound-btn').style.filter=progress.muted?'grayscale(1)':'none';
  $('motion-toggle').checked=progress.reducedMotion;document.body.classList.toggle('reduced-motion',progress.reducedMotion);
  if(world)world.reducedMotion=progress.reducedMotion;audio.setMuted(progress.muted);updateStorageNote();
}
function nextReward(){const next=TRUCKS.find(t=>t.threshold>progress.stars);return next?`${next.name} is next · ${next.threshold-progress.stars} stars to go`:'Mega Titan unlocked. Your whole crew is ready!';}
function refreshMenu(){
  const spec=selected();
  $('collection-total').textContent=TRUCKS.length;
  $('menu-next').textContent=nextReward();
  $('showcase-name').textContent=spec.name;
  $('showcase-tagline').textContent=spec.tagline;
  $('showcase-number').textContent=String(TRUCKS.indexOf(spec)+1).padStart(2,'0');
  $('chosen-course').textContent=getCourse(progress.courseId).name;
}
function truckPicture(spec) {
  return `<img src="${import.meta.env.BASE_URL}trucks/${spec.id}.png" alt="" width="720" height="480" draggable="false" />`;
}
function updateStage(){
  const stage=race.courseId==='canyon'?['canyon','CANYON RUN']:race.distance>=1160?['bay','03 · GATOR BAY']:race.distance>=565?['loop','02 · SKY LOOP']:['woods','01 · BEAR WOODS'];
  $('race-stage').textContent=stage[1];$('race-stage').closest('.race-route').dataset.stage=stage[0];
}
function updatePosition(){
  const place=racePlace(race);
  if(place===shownPlace)return;
  shownPlace=place;$('race-place').textContent=['','1st','2nd','3rd','4th','5th'][place];
  const count=race.buddies.length+1;
  $('race-count').textContent=`OF ${count}`;
  $('race-position').setAttribute('aria-label',`${['','First','Second','Third','Fourth','Fifth'][place]} place out of ${count} trucks`);
}
function renderGarage(){
  $('crew-count').textContent=`${unlockedTrucks(progress).length} / ${TRUCKS.length} COLLECTED`;$('garage-stars').textContent=progress.stars;$('garage-progress').textContent=nextReward();
  $('truck-list').replaceChildren(...TRUCKS.map((spec,i)=>{
    const unlocked=spec.threshold<=progress.stars, chosen=spec.id===progress.selected;
    const card=document.createElement('button');card.type='button';card.className=`truck-card ${unlocked?'':'locked'} ${chosen?'selected':''}`;card.dataset.truck=spec.id;
    card.style.setProperty('--truck-color',`#${spec.color.toString(16).padStart(6,'0')}`);card.style.setProperty('--truck-accent',`#${spec.accent.toString(16).padStart(6,'0')}`);
    card.setAttribute('aria-pressed',String(chosen));card.setAttribute('aria-label',`${spec.name}, ${chosen?'selected':unlocked?'ready to drive':`${spec.threshold-progress.stars} stars to unlock`}`);
    card.innerHTML=`<div class="truck-meta"><span class="truck-badge">0${i+1}</span><span class="truck-status">${chosen?'YOUR RIDE':unlocked?'READY':'LOCKED'}</span></div><div class="truck-preview">${truckPicture(spec)}</div><strong class="truck-name">${spec.name}</strong><span class="truck-description">${spec.tagline}</span><span class="truck-price">${unlocked?(chosen?'✓ Your ride':'Choose truck'):`★ ${spec.threshold-progress.stars} more stars`}</span>${!unlocked?`<span class="truck-unlock-track" aria-hidden="true"><span style="width:${Math.min(100,progress.stars/spec.threshold*100)}%"></span></span>`:''}`;
    card.addEventListener('click',()=>{
      if(!unlocked){$('garage-progress').textContent=`${spec.name} is getting closer. ${spec.threshold-progress.stars} more stars!`;return;}
      progress=selectTruck(progress,spec.id);save();world.setTruck(spec);audio.play('select');renderGarage();refreshMenu();
      $('truck-list').querySelector(`[data-truck="${spec.id}"]`)?.focus();
    });return card;
  }));
}
function showGarage(){menu();renderGarage();showModal('garage');}
function chooseCourse(id){progress={...progress,courseId:getCourse(id).id};save();refreshMenu();start();}
function showTracks(){menu();renderCourses($('course-list'),progress.courseId,chooseCourse);showModal('tracks');}
function menu(){clearInput();race.phase='ready';audio.setDriving(false);audio.pause();world.menu();hideModals();$('menu').hidden=false;$('hud').hidden=true;$('controls').hidden=true;document.body.classList.remove('playing');clearCallout();refreshMenu();}
function start(){
  clearInput();hideModals();shownPlace=0;race=createRace(progress.races,progress.courseId);race.truckScale=selected().scale;race.phase='running';world.setCourse(race.courseId);world.reset(race.variant);world.setTruck(selected());
  $('menu').hidden=true;$('hud').hidden=false;$('controls').hidden=false;document.body.classList.add('playing');
  previous=performance.now();accumulator=0;void audio.resume();void audio.start();audio.setMuted(progress.muted);audio.setDriving(true);audio.play('start');updateStage();updatePosition();say('Let’s race!',1.6,2);$('jump-btn').focus();
}
function pause(){if(race.phase!=='running')return;race.phase='paused';clearInput();audio.pause();showModal('pause-overlay');clearCallout();}
function resume(){if(race.phase!=='paused')return;hideModals();race.phase='running';previous=performance.now();accumulator=0;void audio.resume();audio.setDriving(true);}
function finish(){
  if(race.rewardGranted)return;race.rewardGranted=true;clearInput();audio.setDriving(false);audio.play('finish');world.burst(true,70);
  const before=unlockedTrucks(progress).length;progress=awardRace(progress,race.stars);save();
  const unlocked=unlockedTrucks(progress).slice(before);
  const place=racePlace(race);
  $('result-title').textContent=place===1?'You win!':'Great race!';
  document.querySelector('.victory-medal').innerHTML=`${place}<small>${['','st','nd','rd','th','th'][place]}</small>`;
  document.querySelector('.victory-medal').setAttribute('aria-label',`${['','First','Second','Third','Fourth','Fifth'][place]} place`);
  document.querySelector('.victory-podium').textContent=place===1?'★ CHAMPION ★':'★ FINISHER ★';
  $('result-truck').src=`${import.meta.env.BASE_URL}trucks/${selected().id}.png`;
  $('result-truck').alt=`${selected().name}, your winning truck`;
  $('result-stars').textContent=`+${12+Math.min(50,race.stars)}`;
  $('result-unlock').textContent=unlocked.length?`${unlocked.map(t=>t.name).join(' & ')} joined your crew! Choose your new ride in the garage.`:`12 finish stars + ${Math.min(50,race.stars)} bonus stars. ${nextReward()}`;
  clearCallout();$('controls').hidden=true;showModal('results');refreshMenu();
}

$('play-btn').addEventListener('click',start);$('race-again-btn').addEventListener('click',start);
$('garage-btn').addEventListener('click',showGarage);$('result-garage-btn').addEventListener('click',showGarage);
$('tracks-btn').addEventListener('click',showTracks);
$('tracks-close').addEventListener('click',()=>{hideModals();$('tracks-btn').focus();});
document.querySelectorAll('[data-race]').forEach(button=>button.addEventListener('click',()=>chooseCourse(button.dataset.race)));
$('result-garage-btn').insertAdjacentHTML('afterend','<button id="result-tracks-btn" class="button button-quiet" type="button">Choose another track</button>');
$('result-tracks-btn').addEventListener('click',showTracks);
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
function turbo(){if(race.phase==='running')input.turbo=true;}
$('jump-btn').addEventListener('pointerdown',e=>{e.preventDefault();jump();});
$('jump-btn').addEventListener('click',e=>{if(e.detail===0)jump();});
$('transform-btn').addEventListener('pointerdown',e=>{e.preventDefault();transform();});
$('transform-btn').addEventListener('click',e=>{if(e.detail===0)transform();});
$('turbo-btn').addEventListener('pointerdown',e=>{e.preventDefault();turbo();});
$('turbo-btn').addEventListener('click',e=>{if(e.detail===0)turbo();});
$('game-canvas').addEventListener('pointerdown',jump);
for(const [id,key] of [['left-btn','left'],['right-btn','right']]) {
  const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();if(race.phase!=='running')return;b.setPointerCapture(e.pointerId);touchSteering.set(e.pointerId,key);b.classList.add('pressed');});
  b.addEventListener('click',e=>{if(e.detail===0&&race.phase==='running')race.targetLane=Math.max(-1,Math.min(1,race.targetLane+(key==='left'?-1:1)));});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,e=>{touchSteering.delete(e.pointerId);b.classList.toggle('pressed',[...touchSteering.values()].includes(key));});
}
installTouchGuard($('app'));
gamepad=new GamepadControls({getPhase:()=>race.phase,getMenuRoot:()=>{const modal=overlays.find(id=>!$(id).hidden);return modal?$(modal):!$('menu').hidden?$('app'):null;},jump,turbo,transform,pause,resume,
  back:()=>{const modal=overlays.find(id=>!$(id).hidden);if(modal==='pause-overlay')resume();else if(modal==='garage')$('garage-close').click();else if(modal==='tracks')$('tracks-close').click();else if(modal==='settings')$('settings-close').click();else if(modal==='results')menu();},
  status:(message,connected)=>{$('controller-status').textContent=message;$('controller-hint').textContent=message;$('controller-hint').hidden=!connected;document.querySelector('.race-keyboard-hint').textContent=connected?'A / ✕ JUMP / FLY · X / □ ROBOT · B / ○ TURBO · MENU PAUSE':'← → STEER · SPACE JUMP · B TURBO · T ROBOT';}
});
document.addEventListener('keydown',e=>{
  const modal=overlays.find(id=>!$(id).hidden);
  if(modal){
    if(e.key==='Tab'){const list=[...$(modal).querySelectorAll('button:not(:disabled),input')].filter(el=>!el.closest('[hidden]'));const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){last?.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first?.focus();e.preventDefault();}}
    if(e.key==='Escape'){e.preventDefault();if(modal==='pause-overlay')resume();else if(modal==='garage')$('garage-close').click();else if(modal==='tracks')$('tracks-close').click();else if(modal==='settings')$('settings-close').click();}
    return;
  }
  if(e.key==='Escape'||e.key.toLowerCase()==='p'){if(race.phase==='running'){e.preventDefault();pause();}return;}
  if(race.phase!=='running')return;
  if(e.key===' '&&e.target instanceof Element&&e.target.closest('button,input'))return;
  if(e.key.toLowerCase()==='b'||e.key==='Shift'){e.preventDefault();if(!e.repeat)turbo();return;}
  if(['ArrowLeft','ArrowRight',' ','ArrowUp','a','d','t'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft'||e.key==='a')held.add('left');if(e.key==='ArrowRight'||e.key==='d')held.add('right');if((e.key===' '||e.key==='ArrowUp')&&!e.repeat)jump();if(e.key==='t'&&!e.repeat)transform();}
});
document.addEventListener('keyup',e=>{if(e.key==='ArrowLeft'||e.key==='a')held.delete('left');if(e.key==='ArrowRight'||e.key==='d')held.delete('right');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}});
window.addEventListener('blur',()=>{clearInput();pause();});
window.addEventListener('resize',()=>world?.resize());
$('game-canvas').addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('error').hidden=false;$('error').textContent='The graphics took a little pit stop. Reload to keep playing — your saved trucks are safe.';});

try {
  world=new GameScene($('game-canvas'),selected());world.setCourse(progress.courseId);syncPreferences();refreshMenu();$('loading').hidden=true;
  let hudTick=0;
  world.renderer.setAnimationLoop(now=>{
    const dt=Math.min(Math.max((now-previous)/1000,0),.08);previous=now;
    const padSteer=document.hidden?0:gamepad.poll(now);
    if(race.phase==='running'){
      accumulator+=dt;
      while(accumulator>=1/60){
        const touch=[...touchSteering.values()];
        const digital=(held.has('right')||touch.includes('right')?1:0)-(held.has('left')||touch.includes('left')?1:0);
        input.steer=digital||padSteer;
        const events=stepRace(race,1/60,input);input.jump=false;input.transform=false;input.turbo=false;accumulator-=1/60;
        for(const event of events){if(event.type==='crush'){world.crush();say('MONSTER POWER! +2 ★',1.25,2);}if(event.type==='smash'){world.crush();audio.play('crush');say('SMASH! +3 ★',1.25,2);}if(event.type==='flight')say('LET’S FLY!',1.6,4);if(event.type==='canyon')say('CANYON HERO!',1.6,3);if(event.type==='turbo')say('TURBO!',1.1,2);}
        for(const event of events){
          if(event.type==='buddy') {if(event.action==='hello'||event.action==='jump')audio.play(`buddy-${event.id}`);continue;}
          audio.play(event.type);if(event.type==='jump'&&event.auto)say('BIG AIR!',1.25);if(event.type==='land'){world.land(event.strength);if(event.strength>.7)say('Nailed it!',1.15);}if(event.type==='transform'){say('BIG ROBOT!',1.6,3);world.burst(true,25);}if(event.type==='loop')say('LOOP LEGEND!',2.3,3);if(event.type==='finish')finish();
        }
      }
    }
    const visualDt=race.phase==='paused'?0:dt;
    if(calloutRemaining>0&&race.phase==='running'){calloutRemaining-=visualDt;if(calloutRemaining<=0)clearCallout();}
    const stars=world.update(visualDt,race);if(stars){race.stars+=stars;audio.play('star');}
    audio.update((race.speed??RACE_SPEED)/RACE_SPEED,race.height>0,race.transformTime>0);
    hudTick+=dt;
    if(hudTick>.08){hudTick=0;updateStage();updatePosition();$('race-stars').textContent=race.stars;const percent=courseProgress(race)*100;$('race-progress').value=percent;$('race-distance').textContent=`${Math.floor(percent)}%`;
      const robot=race.transformTime>0;
      $('energy-fill').style.width='100%';$('transform-btn').disabled=false;$('transform-btn').classList.toggle('active',robot);
      $('transform-label').textContent=robot?'TRUCK!':'ROBOT!';$('transform-btn').setAttribute('aria-label',robot?'Become a truck':'Become a robot');
      $('jump-label').textContent=robot?'FLY!':'JUMP!';$('jump-btn').setAttribute('aria-label',robot?'Fly':'Jump');
      const turboActive=race.turboTime>0;
      $('turbo-fill').style.width=`${turboActive?race.turboTime/2.4*100:race.turboEnergy??100}%`;
      $('turbo-btn').disabled=turboActive||race.turboEnergy<100;
      $('turbo-btn').classList.toggle('boosting',turboActive);
      $('turbo-btn').setAttribute('aria-label',turboActive?'Turbo active':race.turboEnergy<100?'Turbo charging':'Turbo boost');
    }
  });
  // Read-only diagnostics for local browser smoke tests and frame-budget checks.
  Object.defineProperty(window,'__skyway',{get:()=>{
    const frame=sampleTrack(race.distance);
    const center=frame.position.addScaledVector(frame.up,race.height).project(world.camera);
    const screenLane=world.truck.group.position.clone().project(world.camera).x-center.x;
    return Object.freeze({controller:{connected:gamepad.connected,steer:gamepad.steer,index:gamepad.input.activeIndex},lane:race.lane,targetLane:race.targetLane,touchCount:touchSteering.size,courseId:race.courseId,courseStart:race.courseStart,courseEnd:race.courseEnd,courseProgress:courseProgress(race),robotMode:race.robotMode,flying:race.flying,flight:race.flight?{...race.flight}:null,canyonCrossings:race.canyonCrossings,smashes:race.smashes,smashedTargets:race.smashedTargets?.slice(),smashModels:world.smashTargets.diagnostics,phase:race.phase,distance:race.distance,height:race.height,landings:race.landings,loops:race.loops,stars:race.stars,energy:race.energy,transformed:race.transformTime>0,selected:progress.selected,totalStars:progress.stars,races:progress.races,variant:race.variant,place:racePlace(race),buddies:world.buddies.poses.map(p=>({...p})),buddySignals:world.buddies.signals.badges.filter(b=>b.visible).map(b=>b.userData.signal),worldLife:world.life.diagnostics,landmarks:world.landmarks.diagnostics,crew:world.buddies.trucks.map(t=>t.spec.id),screenLane,speed:race.speed,turboTime:race.turboTime,turboEnergy:race.turboEnergy,crushBoostTime:race.crushBoostTime,crushes:race.crushes,crushReward:world.encounters.rewardDiagnostics,crushedCars:race.crushedCars?.slice(),crushedModels:world.encounters.cars.filter(car=>car.crush>.95).map(car=>car.id),rain:world.weather.rain.visible&&world.weather.group.visible,mudSpray:world.weather.spray.count,drawCalls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles,flames:world.flames.mesh.count});
  }});
} catch(error) {
  $('loading').hidden=true;$('error').hidden=false;$('error').textContent='This adventure needs a browser with 3D graphics (WebGL 2). Try an updated Safari, Chrome, or Edge with graphics acceleration enabled.';
  $('play-btn').disabled=true;$('garage-btn').disabled=true;console.error('Unable to start Monster Skyway:',error);
}
