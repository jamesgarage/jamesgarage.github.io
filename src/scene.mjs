import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COURSE_LENGTH, LOOP_START, LOOP_END, RACE_SPEED } from './core.mjs';
import { ExhaustFlames } from './flames.mjs';
import { makeTruck, disposeTruck } from './models.mjs';
import { sampleTrack, trackCenter, laneOffset } from './track.mjs';
import { createWorld } from './world.mjs';
import { RaceBuddies } from './buddies.mjs';
import { createRaceFestival } from './festival.mjs';
import { RaceWeather } from './weather.mjs';
import { RoadEncounters } from './encounter-scene.mjs';
import { createAdventureScenery } from './adventure.mjs';
import { WorldLife } from './world-life.mjs';
import { LandmarkMotion } from './landmark-motion.mjs';
import { BurstParticles } from './burst-particles.mjs';
import { poseRearSuspension } from './rear-suspension.mjs';
import { getCourse } from './courses.mjs';
import { getCrushCars } from './encounters.mjs';
import { createCanyonWorld } from './canyon-world.mjs';
import { poseGuardian } from './guardian-pose.mjs';
import { SmashTargets } from './smash-scene.mjs';
import { createCourseFinish } from './course-finish.mjs';
import { sampleFlight } from './flight.mjs';
import { VictoryCeremony } from './victory-ceremony.mjs';
import { TowTruck } from './tow-truck.mjs';
export { makeTruck } from './models.mjs';
export { sampleTrack } from './track.mjs';

const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const materialCache = new Map();
function mat(color, metalness = 0) {
  const key = color + ':' + metalness;
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .4, metalness }));
  return materialCache.get(key);
}

function makeStarGeometry() {
  const s=new THREE.Shape();
  for(let i=0;i<10;i++) {const a=i*Math.PI/5+Math.PI/2,r=i%2?.43:1; const x=Math.cos(a)*r,y=Math.sin(a)*r;i?s.lineTo(x,y):s.moveTo(x,y);}
  s.closePath();return new THREE.ExtrudeGeometry(s,{depth:.28,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:1,steps:1});
}

export class GameScene {
  constructor(canvas,spec) {
    this.canvas=canvas;this.reducedMotion=false;this.cameraView='close';this.mode='menu';this.time=0;this.transform=0;this.boost=0;this.squash=0;this.steerLean=0;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.96;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xbce6f5);this.scene.fog=new THREE.Fog(0xbce6f5,125,345);
    this.camera=new THREE.PerspectiveCamera(52,1,.1,500);
    this.scene.add(new THREE.HemisphereLight(0xd4edff,0x668442,1.65));
    this.sun=new THREE.DirectionalLight(0xffedd5,2.65);this.sun.position.set(-50,85,35);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-36,right:36,top:36,bottom:-36,near:1,far:190});this.sun.shadow.normalBias=.045;this.sun.shadow.bias=-.00015;
    this.scene.add(this.sun,this.sun.target);
    const environment=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(this.renderer);
    this.environment=pmrem.fromScene(environment,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.6;
    environment.dispose();pmrem.dispose();
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(420,24,16),new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,toneMapped:false,
      uniforms:{top:{value:new THREE.Color(0x3b9edd)},bottom:{value:new THREE.Color(0xd3eff9)}},
      vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'uniform vec3 top; uniform vec3 bottom; varying vec3 direction; void main(){float h=pow(max(normalize(direction).y,0.0),0.55);gl_FragColor=vec4(mix(bottom,top,h),1.0);\n#include <colorspace_fragment>\n}'
    }));this.sky.renderOrder=-100;this.scene.add(this.sky);
    this.world=createWorld();
    const festival=createRaceFestival(),adventure=createAdventureScenery();
    this.world.add(festival,adventure);this.scene.add(this.world);
    this.landmarks=new LandmarkMotion([...festival.userData.motionTargets,...adventure.userData.motionTargets]);
    this.truck=makeTruck(spec);this.scene.add(this.truck.group);
    this.buddies=new RaceBuddies(this.scene);
    this.weather=new RaceWeather(this.scene);
    this.encounters=new RoadEncounters(this.scene);
    this.smashTargets=new SmashTargets(this.scene);
    this.courseFinish=createCourseFinish();this.scene.add(this.courseFinish.group);this.course=getCourse();
    this.life=new WorldLife(this.scene);
    this.towTruck=new TowTruck();this.scene.add(this.towTruck.group);
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
    const shadowContext=shadowCanvas.getContext('2d');const gradient=shadowContext.createRadialGradient(64,64,8,64,64,64);
    gradient.addColorStop(0,'rgba(25,32,35,.75)');gradient.addColorStop(.5,'rgba(25,32,35,.38)');gradient.addColorStop(1,'rgba(25,32,35,0)');
    shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,128,128);
    this.contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,opacity:.65}));
    this.contactShadow.renderOrder=1;this.scene.add(this.contactShadow);
    this.landingRing=new THREE.Mesh(new THREE.RingGeometry(.91,1,48),new THREE.MeshBasicMaterial({color:0xffe3a1,transparent:true,depthWrite:false,opacity:0,side:THREE.DoubleSide}));
    this.landingRing.visible=false;this.scene.add(this.landingRing);
    this.flames=new ExhaustFlames(this.scene);
    this.starGeometry=makeStarGeometry();this.stars=[];this.buildStars();
    this.bursts=new BurstParticles(this.scene);this.particles=this.bursts.particles;
    this.targetCamera=new THREE.Vector3();this.targetLook=new THREE.Vector3();this.look=new THREE.Vector3();
    this.resize();this.update(0,{distance:0,height:0,lane:0,transformTime:0,phase:'ready'});this.snapCamera=true;
  }
  buildStars() {
    for(let d=40,i=0;d<COURSE_LENGTH-25;d+=32,i++) {
      const f=sampleTrack(d);const lane=i%3===0?0:i%3===1?-1:1;
      const m=new THREE.Mesh(this.starGeometry,mat(0xffd750,.25));
      m.position.copy(f.position).addScaledVector(f.right,laneOffset(lane)).addScaledVector(f.up,2.9);m.rotation.y=.3;
      this.scene.add(m);this.stars.push({mesh:m,distance:d,lane,collected:false,base:m.position.clone()});
    }
  }
  setTruck(spec) {
    this.flames.clear();this.weather.reset();this.bursts.clear();
    poseRearSuspension(this.truck.rearSuspension);
    disposeTruck(this.truck);
    this.scene.remove(this.truck.group);this.truck=makeTruck(spec);this.scene.add(this.truck.group);this.transform=0;this.boost=0;
  }
  showCeremony(result) {
    this.flames.clear();this.bursts.clear();this.towTruck.reset();
    this.ceremony??=new VictoryCeremony({environment:this.environment.texture});
    this.ceremony.start(result);this.ceremony.resize(this.width,this.height);this.mode='ceremony';
  }
  setCourse(id) {
    this.course=getCourse(id);
    const canyon=this.course.theme==='canyon';
    if(canyon&&!this.canyonWorld){this.canyonWorld=createCanyonWorld();this.scene.add(this.canyonWorld);}
    this.world.visible=!canyon;if(this.canyonWorld)this.canyonWorld.visible=canyon;
    this.life.group.visible=!canyon;
    this.scene.fog.color.setHex(canyon?0xefc49b:0xbce6f5);
    this.sky.material.uniforms.top.value.setHex(canyon?0x719bc1:0x3b9edd);
    this.sky.material.uniforms.bottom.value.setHex(canyon?0xf8d5ae:0xd3eff9);
    this.courseFinish.setCourse(this.course);this.courseFinish.group.visible=this.mode==='race'&&this.course.end<1900;
    const cars=getCrushCars(this.course.id);
    for(const car of this.encounters.cars)car.group.visible=cars.some(definition=>definition.id===car.id);
    for(const star of this.stars){const gap=this.course.gaps.find(item=>star.distance>=item.launch&&star.distance<=item.land);star.flightLift=gap?sampleFlight({start:gap.launch,end:gap.land,height:gap.height},star.distance).height:0;}
    this.snapCamera=true;this.weather.reset();
  }
  reset(variant=0) {this.ceremony?.reset();this.towTruck.reset();this.flames.clear();this.buddies.reset(variant);this.weather.reset();this.encounters.reset();this.smashTargets?.reset();this.life.reset(variant);this.landmarks.reset(variant);this.bursts.clear();poseRearSuspension(this.truck.rearSuspension);poseGuardian(this.truck,{menu:true});this.stars.forEach(s=>{s.collected=false;s.mesh.visible=true;});this.mode='race';if(this.courseFinish)this.courseFinish.group.visible=this.course.end<1900;this.snapCamera=true;this.transform=0;this.flight=0;this.boost=0;this.squash=0;this.steerLean=0;}
  menu() {this.ceremony?.reset();this.towTruck.reset();this.flames.clear();this.weather.reset();this.bursts.clear();this.smashTargets?.reset();poseRearSuspension(this.truck.rearSuspension);poseGuardian(this.truck,{menu:true});this.mode='menu';if(this.courseFinish)this.courseFinish.group.visible=false;this.snapCamera=true;}
  resize() {this.width=innerWidth;this.height=innerHeight;this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height,false);this.ceremony?.resize(this.width,this.height);this.snapCamera=true;}
  burst(colorful=true,count=20,origin=this.truck.group.position,reward=false) {
    if(this.reducedMotion||this.mode!=='race')return 0;
    return this.bursts.burst({kind:reward?'reward':colorful?'celebrate':'dust',count,origin,enabled:true});
  }
  land(strength=1) {this.squash=.55+clamp(strength,0,1)*.45;this.burst(false,12);}
  crush() {this.burst(true,14,this.truck.group.position,true);}
  update(dt,race) {
    if(this.mode==='ceremony') {
      this.ceremony.update(dt,{paused:race.phase==='paused',reducedMotion:this.reducedMotion});
      this.renderer.render(this.ceremony.scene,this.ceremony.camera);return 0;
    }
    this.time+=dt;
    const isMenu=this.mode==='menu';
    const d=isMenu?(this.course?.start??0)+14:race.distance;
    const inLoop=d>LOOP_START-18&&d<LOOP_END+15&&!isMenu;
    const f=sampleTrack(d);const g=this.truck.group;
    g.scale.setScalar(this.truck.spec.scale*(isMenu?(this.width<this.height?1.72:2.1):1));
    g.position.copy(f.position).addScaledVector(f.right,laneOffset(isMenu?0:race.lane)).addScaledVector(f.up,isMenu?0:race.height);
    g.quaternion.copy(f.quaternion);
    if(isMenu)g.rotateY(-.15+Math.sin(this.time*.32)*.1);
    else if(race.height>0)g.rotateX(clamp(-race.velocityY*.025,-.28,.35));
    this.transform=lerp(this.transform,!isMenu&&race.transformTime>0?1:0,1-Math.exp(-dt*5));
    this.flight=lerp(this.flight||0,!isMenu&&race.flying?1:0,1-Math.exp(-dt*6));
    this.boost=lerp(this.boost,!isMenu&&race.turboTime>0?1:0,1-Math.exp(-dt*4));
    this.squash=Math.max(0,this.squash-dt*3.5);
    this.steerLean=lerp(this.steerLean,isMenu?0:clamp(-(race.targetLane-race.lane)*.16,-.32,.32),1-Math.exp(-dt*7));
    poseGuardian(this.truck,{transform:this.transform,flight:this.flight,lean:this.steerLean,squash:this.squash,time:this.time,reducedMotion:this.reducedMotion,menu:isMenu});
    poseRearSuspension(this.truck.rearSuspension,!isMenu&&!this.reducedMotion&&!inLoop?this.squash*.2:0,this.steerLean);
    this.truck.wheels.forEach((wheel,i)=>{wheel.rotation.order='YXZ';wheel.rotation.y=i>1?this.steerLean*1.4:0;if(!isMenu&&race.phase==='running')wheel.rotation.x+=dt*19*(race.speed??RACE_SPEED)/RACE_SPEED;});
    this.flames.update(dt,{truck:this.truck,time:this.time,mode:this.mode,race,transform:this.transform,reducedMotion:this.reducedMotion});
    this.contactShadow.position.copy(f.position).addScaledVector(f.right,laneOffset(isMenu?0:race.lane)).addScaledVector(f.up,.042);
    this.contactShadow.quaternion.copy(f.quaternion);this.contactShadow.rotateX(-Math.PI/2);
    const shadowScale=g.scale.x*(1+(isMenu?0:race.height)*.06);
    this.contactShadow.scale.set(7.6*shadowScale,6.8*shadowScale,1);this.contactShadow.material.opacity=.65/(1+(isMenu?0:race.height)*.17);
    const overGap=this.course?.gaps.some(gap=>d>gap.start&&d<gap.end);this.contactShadow.visible=!overGap;
    this.landingRing.visible=!isMenu&&!this.reducedMotion&&this.squash>0;
    this.landingRing.position.copy(f.position).addScaledVector(f.right,laneOffset(isMenu?0:race.lane)).addScaledVector(f.up,.065);
    this.landingRing.quaternion.copy(f.quaternion);this.landingRing.rotateX(-Math.PI/2);
    this.landingRing.scale.setScalar((2+(1-this.squash)*5)*this.truck.spec.scale);this.landingRing.material.opacity=this.squash*.55;
    this.sky.position.copy(g.position);
    if(isMenu) {
      const portrait=this.width<this.height;
      const showcaseZoom=(1+(this.truck.spec.scale-1)*.75)*(portrait?1.13:1);
      this.targetCamera.copy(f.position).add(new THREE.Vector3(portrait?12:13,9,18).multiplyScalar(showcaseZoom));
      this.targetLook.copy(f.position).add(new THREE.Vector3(portrait?0:-7,portrait?4:1.6,0));
      this.camera.fov=portrait?58:45;
    } else if(inLoop) {
      const base=trackCenter(LOOP_START);
      this.targetCamera.copy(base).add(new THREE.Vector3(100,36,-5).multiplyScalar(this.width<this.height?1.8:1));
      this.targetLook.copy(base).add(new THREE.Vector3(6,29,0));this.camera.fov=54;
    } else {
      const horizontal=f.forward.clone();horizontal.y=0;horizontal.normalize();
      const portrait=this.width<this.height;
      const close=this.cameraView!=='wide';
      const actionRoom=Math.max(this.flight*5,this.transform*3,race.recovery?8:0);
      const distance=(close?(portrait?35:27):(portrait?53:42))+(this.truck.spec.scale-1)*5+actionRoom;
      this.targetCamera.copy(g.position).addScaledVector(horizontal,-distance).add(new THREE.Vector3(0,(close?(portrait?14:10):(portrait?18:14.5))+race.height*.1+(this.truck.spec.scale-1)*2.5,0));
      this.targetLook.copy(f.position).addScaledVector(horizontal,close?-2:-9).add(new THREE.Vector3(0,2.4+race.height*.7+this.transform*1.1,0));
      this.camera.fov=(close?58:55)+(this.reducedMotion?0:this.transform*3+this.boost*3);
      if(!this.reducedMotion)this.targetCamera.y-=this.squash*.32;
    }
    this.camera.updateProjectionMatrix();
    const blend=this.snapCamera?1:1-Math.exp(-dt*(this.reducedMotion?4:6));
    this.camera.position.lerp(this.targetCamera,blend);this.look.lerp(this.targetLook,blend);this.camera.up.copy(UP);this.camera.lookAt(this.look);this.snapCamera=false;
    this.sun.position.copy(g.position).add(new THREE.Vector3(-40,75,30));this.sun.target.position.copy(g.position);
    let collected=0;
    for(const s of this.stars) {
      if(s.collected)continue;
      s.mesh.visible=s.distance>=(this.course?.start??0)&&s.distance<=(this.course?.end??COURSE_LENGTH)&&Math.abs(s.distance-d)<170;
      if(!s.mesh.visible)continue;
      s.mesh.rotation.y=this.time*1.7;s.mesh.position.y=s.base.y+(s.flightLift||0)+Math.sin(this.time*2+s.distance)*.2;
      if(!isMenu&&!race.recovery&&race.phase==='running'&&Math.abs(s.distance-d)<2.2&&(this.transform>.3||Math.abs(race.lane-s.lane)<.65)) {s.collected=true;s.mesh.visible=false;if(!this.reducedMotion)this.burst(true,4,s.mesh.position);collected++;}
    }
    this.bursts.update(dt,{phase:race.phase,mode:this.mode,reducedMotion:this.reducedMotion});
    if(race.phase==='running'&&Number.isFinite(dt)&&dt>0&&this.transform>.5&&Math.random()<dt*20&&!this.reducedMotion)this.burst(true,1);
    this.buddies.update(dt,race,!isMenu,{camera:this.camera,reducedMotion:this.reducedMotion});
    this.weather.update(dt,{race,truck:this.truck,mode:this.course?.theme==='canyon'?'menu':this.mode,reducedMotion:this.reducedMotion});
    this.encounters.update(dt,{race,mode:this.mode,reducedMotion:this.reducedMotion});
    this.smashTargets.update(dt,{race,mode:this.mode,reducedMotion:this.reducedMotion});
    this.towTruck.update(dt,race);
    if(this.course?.theme!=='canyon'){this.life.update(dt,{race,mode:this.mode,reducedMotion:this.reducedMotion});this.landmarks.update(dt,{race,mode:this.mode,reducedMotion:this.reducedMotion});}
    this.renderer.render(this.scene,this.camera);
    return collected;
  }
}
