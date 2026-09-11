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
    this.canvas=canvas;this.reducedMotion=false;this.mode='menu';this.time=0;this.transform=0;this.boost=0;this.squash=0;this.steerLean=0;
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
    this.world=createWorld();this.world.add(createRaceFestival(),createAdventureScenery());this.scene.add(this.world);
    this.truck=makeTruck(spec);this.scene.add(this.truck.group);
    this.buddies=new RaceBuddies(this.scene);
    this.weather=new RaceWeather(this.scene);
    this.encounters=new RoadEncounters(this.scene);
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
    this.particles=[];this.particleGeometry=new THREE.IcosahedronGeometry(.16,0);
    for(let i=0;i<80;i++){const paint=mat([0xffd75e,0xff805a,0x79e5d9,0xf9f0ca][i%4]);const m=new THREE.Mesh(this.particleGeometry,paint);m.visible=false;this.scene.add(m);this.particles.push({mesh:m,paint,life:0,duration:1,size:1,v:new THREE.Vector3()});}
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
    this.flames.clear();this.weather.reset();
    disposeTruck(this.truck);
    this.scene.remove(this.truck.group);this.truck=makeTruck(spec);this.scene.add(this.truck.group);this.transform=0;this.boost=0;
  }
  reset() {this.flames.clear();this.buddies.reset();this.weather.reset();this.encounters.reset();this.stars.forEach(s=>{s.collected=false;s.mesh.visible=true;});this.mode='race';this.snapCamera=true;this.transform=0;this.boost=0;this.squash=0;this.steerLean=0;this.particles.forEach(p=>{p.life=0;p.mesh.visible=false;});}
  menu() {this.flames.clear();this.weather.reset();this.mode='menu';this.snapCamera=true;}
  resize() {this.width=innerWidth;this.height=innerHeight;this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height,false);this.snapCamera=true;}
  burst(colorful=true,count=20,origin=this.truck.group.position,reward=false) {
    if(this.reducedMotion)return;
    let n=0;for(const p of this.particles) {
      if(p.life>0)continue;
      p.life=p.duration=(colorful?.55:.3)+Math.random()*.5;p.size=colorful?1.5:2.8;
      p.mesh.visible=true;p.mesh.material=reward?mat(0xffd75e,.25):colorful?p.paint:mat(0xdfbb83);
      p.mesh.position.copy(origin).add(new THREE.Vector3((Math.random()-.5)*(colorful?1:5),colorful?1:.25,(Math.random()-.5)*(colorful?1:4)));
      const spread=colorful?11:5;
      p.v.set((Math.random()-.5)*spread,Math.random()*(colorful?8:2)+2,(Math.random()-.5)*spread);
      p.mesh.scale.setScalar(p.size);if(++n>=count)break;
    }
  }
  land(strength=1) {this.squash=.55+clamp(strength,0,1)*.45;this.burst(false,12);}
  crush() {this.burst(true,14,this.truck.group.position,true);}
  update(dt,race) {
    this.time+=dt;
    const isMenu=this.mode==='menu';
    const d=isMenu?14:race.distance;
    const f=sampleTrack(d);const g=this.truck.group;
    g.scale.setScalar(this.truck.spec.scale*(isMenu?(this.width<this.height?1.72:2.1):1));
    g.position.copy(f.position).addScaledVector(f.right,laneOffset(isMenu?0:race.lane)).addScaledVector(f.up,isMenu?0:race.height);
    g.quaternion.copy(f.quaternion);
    if(isMenu)g.rotateY(-.15+Math.sin(this.time*.32)*.1);
    else if(race.height>0)g.rotateX(clamp(-race.velocityY*.025,-.28,.35));
    this.transform=lerp(this.transform,!isMenu&&race.transformTime>0?1:0,1-Math.exp(-dt*5));
    this.boost=lerp(this.boost,!isMenu&&race.turboTime>0?1:0,1-Math.exp(-dt*4));
    this.squash=Math.max(0,this.squash-dt*3.5);
    this.steerLean=lerp(this.steerLean,isMenu?0:-(race.targetLane-race.lane)*.16,1-Math.exp(-dt*7));
    this.truck.body.position.y=this.transform*1.8-this.squash*.2+(isMenu?.035*Math.sin(this.time*2):Math.sin(this.time*16)*.025);
    this.truck.body.rotation.z=-this.steerLean;
    this.truck.head.visible=this.transform>.06;this.truck.head.scale.setScalar(Math.max(.01,this.transform));
    this.truck.arms.forEach((arm,i)=>{arm.visible=this.transform>.06;arm.rotation.z=(i===0?-1:1)*this.transform*.85;});
    this.truck.struts.forEach(leg=>{leg.visible=this.transform>.06;leg.scale.y=1.2+this.transform*1.9;leg.position.y=1.7+this.transform*.8;});
    this.truck.wheels.forEach((wheel,i)=>{wheel.position.x=(i%2===0?-1:1)*(1.65+this.transform*.7);wheel.rotation.order='YXZ';wheel.rotation.y=i>1?this.steerLean*1.4:0;if(!isMenu&&race.phase==='running')wheel.rotation.x+=dt*19*(race.speed??RACE_SPEED)/RACE_SPEED;});
    this.flames.update(dt,{truck:this.truck,time:this.time,mode:this.mode,race,transform:this.transform,reducedMotion:this.reducedMotion});
    this.contactShadow.position.copy(f.position).addScaledVector(f.right,laneOffset(isMenu?0:race.lane)).addScaledVector(f.up,.042);
    this.contactShadow.quaternion.copy(f.quaternion);this.contactShadow.rotateX(-Math.PI/2);
    const shadowScale=g.scale.x*(1+(isMenu?0:race.height)*.06);
    this.contactShadow.scale.set(7.6*shadowScale,6.8*shadowScale,1);this.contactShadow.material.opacity=.65/(1+(isMenu?0:race.height)*.17);
    this.landingRing.visible=!isMenu&&!this.reducedMotion&&this.squash>0;
    this.landingRing.position.copy(f.position).addScaledVector(f.right,laneOffset(isMenu?0:race.lane)).addScaledVector(f.up,.065);
    this.landingRing.quaternion.copy(f.quaternion);this.landingRing.rotateX(-Math.PI/2);
    this.landingRing.scale.setScalar((2+(1-this.squash)*5)*this.truck.spec.scale);this.landingRing.material.opacity=this.squash*.55;
    this.sky.position.copy(g.position);
    const inLoop=d>LOOP_START-18&&d<LOOP_END+15&&!isMenu;
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
      const distance=(this.width<this.height?34:26)+(this.truck.spec.scale-1)*4;
      this.targetCamera.copy(g.position).addScaledVector(horizontal,-distance).add(new THREE.Vector3(0,13.5+race.height*.1+(this.truck.spec.scale-1)*2.5,0));
      this.targetLook.copy(f.position).addScaledVector(horizontal,3).add(new THREE.Vector3(0,2.4+race.height*.4,0));
      this.camera.fov=55+(this.reducedMotion?0:this.transform*3+this.boost*3);
      if(!this.reducedMotion)this.targetCamera.y-=this.squash*.32;
    }
    this.camera.updateProjectionMatrix();
    const blend=this.snapCamera?1:1-Math.exp(-dt*(this.reducedMotion?4:6));
    this.camera.position.lerp(this.targetCamera,blend);this.look.lerp(this.targetLook,blend);this.camera.up.copy(UP);this.camera.lookAt(this.look);this.snapCamera=false;
    this.sun.position.copy(g.position).add(new THREE.Vector3(-40,75,30));this.sun.target.position.copy(g.position);
    let collected=0;
    for(const s of this.stars) {
      if(s.collected)continue;
      s.mesh.visible=isMenu?s.distance<170:Math.abs(s.distance-d)<170;
      if(!s.mesh.visible)continue;
      s.mesh.rotation.y=this.time*1.7;s.mesh.position.y=s.base.y+Math.sin(this.time*2+s.distance)*.2;
      if(!isMenu&&race.phase==='running'&&Math.abs(s.distance-d)<2.2&&(this.transform>.3||Math.abs(race.lane-s.lane)<.65)) {s.collected=true;s.mesh.visible=false;if(!this.reducedMotion)this.burst(true,4,s.mesh.position);collected++;}
    }
    for(const p of this.particles) {
      if(p.life<=0)continue;p.life-=dt;p.mesh.visible=p.life>0;p.v.y-=dt*12;p.mesh.position.addScaledVector(p.v,dt);p.mesh.rotation.x+=dt*4;p.mesh.rotation.z+=dt*3;p.mesh.scale.setScalar(p.size*Math.max(0,p.life/p.duration));
    }
    if(this.transform>.5&&Math.random()<dt*20&&!this.reducedMotion)this.burst(true,1);
    this.buddies.update(dt,race,!isMenu);
    this.weather.update(dt,{race,truck:this.truck,mode:this.mode,reducedMotion:this.reducedMotion});
    this.encounters.update(dt,{race,mode:this.mode,reducedMotion:this.reducedMotion});
    this.renderer.render(this.scene,this.camera);
    return collected;
  }
}
