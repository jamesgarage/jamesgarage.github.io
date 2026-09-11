import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COURSE_LENGTH, LOOP_START, LOOP_END, RAMPS } from './core.mjs';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const materialCache = new Map();
const geometries = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 12, 8),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 16),
  tire: new THREE.CylinderGeometry(1, 1, 0.7, 18),
};
function mat(color, metalness = 0) {
  const key = `${color}:${metalness}`;
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: metalness ? 0.38 : 0.72, metalness }));
  return materialCache.get(key);
}
function shape(parent, kind, color, position, scale, rotation = [0, 0, 0], metalness = 0) {
  const mesh = new THREE.Mesh(geometries[kind], mat(color, metalness));
  mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function box(p,c,pos,size,rot,metal) { return shape(p,'box',c,pos,size,rot,metal); }
function ball(p,c,pos,size) { return shape(p,'sphere',c,pos,size); }

function center(distance) {
  const d = clamp(distance, -80, COURSE_LENGTH + 160);
  const loopLength = LOOP_END - LOOP_START;
  // A complete circle with a gentle sideways exit keeps entry/exit separate.
  const radius = loopLength / TAU;
  let z = d, y = 0, xOffset = 0;
  if (d >= LOOP_START && d <= LOOP_END) {
    const t = (d - LOOP_START) / loopLength;
    const theta = t * TAU;
    z = LOOP_START + radius * Math.sin(theta);
    y = radius * (1 - Math.cos(theta));
    xOffset = 13 * (t * t * (3 - 2 * t));
  } else if (d > LOOP_END) { z = d - loopLength; xOffset = 13; }
  let hill = 1.2 * Math.sin(z / 150);
  let ramp = 0;
  for (const r of RAMPS) {
    const diff = d - r;
    if (diff > -24 && diff <= 0) ramp = 2.6 * ((diff + 24) / 24) ** 2;
    else if (diff > 0 && diff < 38) ramp = 2.6 * (1 - diff / 38);
  }
  return new THREE.Vector3(13 * Math.sin(z / 135) + 6 * Math.sin(z / 57) + xOffset, 1.5 + hill + y + ramp, z);
}

export function sampleTrack(distance) {
  const position = center(distance);
  const forward = center(distance + 0.12).sub(center(distance - 0.12)).normalize();
  let right, up;
  if (distance >= LOOP_START && distance <= LOOP_END) {
    const theta = (distance - LOOP_START) / (LOOP_END - LOOP_START) * TAU;
    up = new THREE.Vector3(0, Math.cos(theta), -Math.sin(theta));
    right = new THREE.Vector3().crossVectors(up, forward).normalize();
    up.crossVectors(forward, right).normalize();
  } else {
    right = new THREE.Vector3().crossVectors(UP, forward).normalize();
    up = new THREE.Vector3().crossVectors(forward, right).normalize();
    const bank = Math.sin(position.z / 135) * 0.07;
    right.applyAxisAngle(forward, bank); up.applyAxisAngle(forward, bank);
  }
  const matrix = new THREE.Matrix4().makeBasis(right, up, forward);
  return { position, forward, right, up, quaternion: new THREE.Quaternion().setFromRotationMatrix(matrix) };
}

export function makeTruck(spec) {
  const group = new THREE.Group();
  const body = new THREE.Group(); group.add(body);
  const wheels = [], arms = [], struts=[];
  const s = spec.scale;
  group.scale.setScalar(s);
  box(body,0x17354b,[0,1.45,0],[2.6,.35,4.5]);
  box(body,spec.color,[0,2.05,0],[2.65,.95,4.35]);
  if(spec.id==='chrome-guardian') {
    const outline=new THREE.Shape();outline.moveTo(-1.2,0);outline.lineTo(-.65,1.16);outline.lineTo(.18,1.16);outline.lineTo(1.45,0);outline.closePath();
    const cabGeometry=new THREE.ExtrudeGeometry(outline,{depth:2.28,bevelEnabled:false});
    cabGeometry.rotateY(Math.PI/2);cabGeometry.translate(-1.14,2.34,-.12);
    const cab=new THREE.Mesh(cabGeometry,mat(spec.color,.65));cab.castShadow=true;body.add(cab);
    box(body,0x20475b,[0,2.87,.64],[2.1,.66,.06],[.79,0,0]);
  } else {
    box(body,spec.color,[0,2.85,-.15],[2.25,1.05,2.1]);
    box(body,spec.accent,[0,3.4,-.15],[2.38,.17,2.23]);
  }
  box(body,0x123d56,[0,2.99,.94],[1.95,.67,.07]);
  box(body,0x7ce5eb,[-.42,3.05,.985],[.48,.34,.06]);
  box(body,0x7ce5eb,[.42,3.05,.985],[.48,.34,.06]);
  box(body,0x14344a,[-1.145,2.92,-.1],[.045,.64,1.7]);
  box(body,0x14344a,[1.145,2.92,-.1],[.045,.64,1.7]);
  box(body,spec.accent,[0,2.57,1.53],[.38,.035,1.1]);
  box(body,0x243949,[0,1.88,2.24],[2.75,.34,.25],undefined,.55);
  box(body,0xc7e6e5,[0,2.15,2.23],[1.0,.35,.08],undefined,.55);
  for (let x=-.35;x<.5;x+=.23) box(body,0x163144,[x,2.16,2.28],[.08,.27,.05]);
  for (const side of [-1,1]) {
    box(body,0xffedac,[side*.97,2.24,2.24],[.48,.3,.09]);
    box(body,0xf76458,[side*.95,2.14,-2.22],[.4,.24,.08]);
    box(body,0x243e51,[side*1.5,2.88,.5],[.43,.19,.38]);
    box(body,spec.accent,[side*1.34,2.18,-.25],[.06,.28,1.3]);
    box(body,0x344654,[side*1.05,2.5,-1.78],[.17,1.2,.17],undefined,.6);
    const arm = new THREE.Group(); arm.position.set(side*1.5,2.45,0); body.add(arm);
    box(arm,spec.color,[side*.2,-.43,0],[.55,1.05,.7]);
    box(arm,spec.accent,[side*.2,-1.02,0],[.68,.48,.8]);
    arms.push(arm); arm.visible=false;
  }
  const head = new THREE.Group(); head.position.set(0,3.4,-.3); body.add(head);
  box(head,spec.color,[0,.45,0],[1.04,.92,.85]);
  box(head,0x89f9ee,[0,.57,.45],[.77,.17,.05]);
  box(head,0xd1e9ef,[0,.16,.43],[.52,.26,.06],undefined,.5);
  head.visible=false;
  for (const z of [-1.5,1.5]) {
    box(group,0x64818a,[0,1.1,z],[3.5,.14,.14],undefined,.6);
    for (const side of [-1,1]) {
      const wheel = new THREE.Group(); wheel.position.set(side*1.65,1.05,z); group.add(wheel);
      shape(wheel,'tire',0x172837,[0,0,0],[1.1,1.05,1.1],[0,0,Math.PI/2]);
      shape(wheel,'cylinder',spec.accent,[side*.405,0,0],[.6,.07,.6],[0,0,Math.PI/2],.35);
      shape(wheel,'cylinder',0x3e5362,[side*.45,0,0],[.28,.085,.28],[0,0,Math.PI/2],.65);
      for(let k=0;k<12;k++) {
        const a=k/12*TAU;
        box(wheel,0x2e424f,[0,Math.cos(a)*1.055,Math.sin(a)*1.055],[.77,.16,.27],[a,0,0]);
      }
      wheels.push(wheel);
    }
  }
  for(const x of [-.85,.85]) {const strut=box(group,0x5d7c87,[x,1.9,0],[.34,1.2,.46],undefined,.6);strut.visible=false;struts.push(strut);}
  if(spec.id==='bear-crusher') {
    for(const side of [-1,1]) ball(body,spec.accent,[side*.9,3.57,-.2],[.42,.45,.24]);
  }
  if(spec.id==='night-stomper') {
    for(const side of [-1,1])for(let j=0;j<3;j++)box(body,spec.accent,[side*1.36,2.18+j*.08,-.9+j*.45],[.04,.17,.8],[0,.1,side*.3]);
    box(body,spec.accent,[0,1.65,2.39],[2.5,.1,.09]);
  }
  if(spec.id==='gator-claw') {
    for(let z=-1.8;z<1.9;z+=.55) shape(body,'cone',spec.accent,[0,3.55,z],[.23,.5,.3]);
    for(let x=-1;x<=1;x+=.5) shape(body,'cone',0xfff2ce,[x,1.9,2.32],[.14,.32,.12],[Math.PI,0,0]);
  }
  if(spec.id==='chrome-guardian'||spec.id==='mega-titan') {
    for(const side of [-1,1]) box(body,spec.accent,[side*1.32,2.65,-.7],[.45,.5,1.9]);
  }
  if(spec.id==='mega-titan') {
    for(const x of [-.7,0,.7]) shape(body,'cone',spec.accent,[x,3.74,-.2],[.2,.6,.22]);
    box(body,spec.accent,[0,2.65,-2.1],[3.5,.22,.7]);
  }
  return { group, body, wheels, arms, head, struts, spec };
}

function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets=new Map();
  group.traverse(obj=>{if(obj.isMesh) {const key=obj.material.uuid; if(!buckets.has(key)) buckets.set(key,{material:obj.material,geometries:[]}); buckets.get(key).geometries.push(obj.geometry.clone().applyMatrix4(obj.matrixWorld));}});
  const merged=new THREE.Group();
  for(const {material,geometries:parts} of buckets.values()) {
    const geometry=mergeGeometries(parts); parts.forEach(g=>g.dispose());
    if(!geometry) continue;
    const m=new THREE.Mesh(geometry,material); m.castShadow=true;m.receiveShadow=true;merged.add(m);
  }
  return merged;
}

function makeBear(parent, position, scale=1) {
  const g=new THREE.Group();g.position.copy(position);g.scale.setScalar(scale);parent.add(g);
  g.rotation.y=-Math.PI/2;
  ball(g,0xa16c43,[0,1.35,0],[.95,1.22,.7]);
  ball(g,0xca925e,[0,1.35,.58],[.64,.83,.21]);
  ball(g,0xa16c43,[0,2.66,0],[.86,.79,.71]);
  for(const side of [-1,1]) {
    ball(g,0xa16c43,[side*.62,3.23,0],[.33,.35,.23]);
    ball(g,0xe7b88a,[side*.62,3.23,.16],[.2,.22,.1]);
    ball(g,0x192f39,[side*.28,2.78,.62],[.095,.12,.07]);
    ball(g,0xa16c43,[side*.91,1.5,.05],[.38,.78,.37]);
    ball(g,0x86512f,[side*.51,.35,.27],[.48,.4,.6]);
  }
  ball(g,0xe7b88a,[0,2.43,.6],[.44,.32,.23]);
  ball(g,0x25343a,[0,2.53,.81],[.19,.13,.1]);
  box(g,0xf1c949,[0,2.07,.3],[1.3,.19,.9]);
}
function makeGator(parent,position,scale=1) {
  const g=new THREE.Group();g.position.copy(position);g.scale.setScalar(scale);parent.add(g);
  ball(g,0x4eaa77,[0,.7,0],[.95,.65,1.9]);
  box(g,0x68c987,[0,.87,1.65],[1.5,.55,1.9]);
  box(g,0xbfe28b,[0,.56,1.71],[1.5,.15,1.83]);
  for(const side of [-1,1]) {
    ball(g,0x69c887,[side*.47,1.26,1.35],[.35,.37,.33]);
    ball(g,0xfaf3d8,[side*.47,1.35,1.6],[.21,.22,.11]);
    ball(g,0x163343,[side*.47,1.36,1.7],[.085,.13,.055]);
    for(const z of [-.9,.7]) ball(g,0x4eaa77,[side*1.0,.3,z],[.43,.27,.58]);
  }
  shape(g,'cone',0x4eaa77,[0,.54,-2.07],[.66,2.0,.45],[-Math.PI/2,0,0]);
  for(let z=-1.3;z<1;z+=.45) shape(g,'cone',0xa7dc77,[0,1.27,z],[.22,.42,.25]);
}

function makeStarGeometry() {
  const s=new THREE.Shape();
  for(let i=0;i<10;i++) {const a=i*Math.PI/5+Math.PI/2,r=i%2?.43:1; const x=Math.cos(a)*r,y=Math.sin(a)*r;i?s.lineTo(x,y):s.moveTo(x,y);}
  s.closePath();return new THREE.ExtrudeGeometry(s,{depth:.28,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:1,steps:1});
}

export class GameScene {
  constructor(canvas,spec) {
    this.canvas=canvas;this.reducedMotion=false;this.mode='menu';this.time=0;this.transform=0;this.squash=0;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x96d5de);this.scene.fog=new THREE.Fog(0x96d5de,140,350);
    this.camera=new THREE.PerspectiveCamera(52,1,.1,500);
    this.scene.add(new THREE.HemisphereLight(0xd5f3ff,0x88aa70,2.6));
    this.sun=new THREE.DirectionalLight(0xfff1d5,3.6);this.sun.position.set(-50,85,35);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:230});this.sun.shadow.normalBias=.06;
    this.scene.add(this.sun,this.sun.target);
    this.world=new THREE.Group();this.scene.add(this.world);this.buildWorld();
    this.truck=makeTruck(spec);this.scene.add(this.truck.group);
    this.starGeometry=makeStarGeometry();this.stars=[];this.buildStars();
    this.particles=[];this.particleGeometry=new THREE.BoxGeometry(.16,.16,.16);
    for(let i=0;i<80;i++){const m=new THREE.Mesh(this.particleGeometry,mat([0xffd75e,0xff805a,0x79e5d9,0xf9f0ca][i%4]));m.visible=false;this.scene.add(m);this.particles.push({mesh:m,life:0,v:new THREE.Vector3()});}
    this.targetCamera=new THREE.Vector3();this.targetLook=new THREE.Vector3();this.look=new THREE.Vector3();
    this.resize();this.update(0,{distance:0,height:0,lane:0,transformTime:0,phase:'ready'});this.snapCamera=true;
  }
  buildWorld() {
    const trackPositions=[],trackNormals=[],trackColors=[],indices=[];
    const stripe=new THREE.Color(),road=new THREE.Color(0xf47a46), edge=new THREE.Color(0xffd369);
    const width=6.8,step=2,segments=Math.ceil((COURSE_LENGTH+90)/step);
    for(let i=0;i<=segments;i++) {
      const d=-30+i*step; const frame=sampleTrack(d);
      for(let j=0;j<4;j++) {
        const offset=[-width,-width+.48,width-.48,width][j];
        const p=frame.position.clone().addScaledVector(frame.right,offset);
        trackPositions.push(p.x,p.y,p.z);trackNormals.push(frame.up.x,frame.up.y,frame.up.z);
        stripe.copy(j===0||j===3?edge:road);if(Math.floor(d/12)%2===0&&(j===0||j===3)) stripe.set(0xfff0b1);
        trackColors.push(stripe.r,stripe.g,stripe.b);
      }
      if(i<segments)for(let j=0;j<3;j++){const a=i*4+j;indices.push(a,a+4,a+1,a+1,a+4,a+5);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(trackPositions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(trackNormals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(trackColors,3));geometry.setIndex(indices);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,side:THREE.DoubleSide}));mesh.receiveShadow=true;this.world.add(mesh);
    const scenery=new THREE.Group();
    // Geometry is batched by material in short stretches to keep draw calls bounded.
    for(let start=-64;start<COURSE_LENGTH+100;start+=160) {
      const chunk=new THREE.Group();
      const c=center(start+80);
      box(chunk,start>1050?0x68bfa0:0x89bd78,[c.x,-5,c.z],[450,7,175]);
      for(let d=start;d<start+160;d+=16) {
        if(d>=LOOP_START-5&&d<=LOOP_END+5)continue;
        const f=sampleTrack(d);
        for(const side of [-1,1]) {
          const pos=f.position.clone().addScaledVector(f.right,side*7.02);
          box(chunk,0xf3bb63,[pos.x,pos.y+.38,pos.z],[.18,.76,1.4]);
          if(d%32===0) {
            const offset=18+Math.abs(Math.sin(d*14.7))*30;
            const p=f.position.clone().addScaledVector(f.right,side*offset);p.y=-1.3;
            const size=2+Math.abs(Math.sin(d*8.2))*2;
            shape(chunk,'cylinder',0xa57e4f,[p.x,p.y+size,p.z],[.45,size*2,.45]);
            if(d<1000)for(let k=0;k<3;k++) shape(chunk,'cone',[0x359779,0x48a681,0x6ab987][k],[p.x,p.y+size*2+k*1.35,p.z],[size-k*.3,size*1.7,size-k*.3]);
            else {ball(chunk,0x42a887,[p.x,p.y+size*3,p.z],[size*1.45,size*.7,size*1.35]);}
          }
        }
        if(d%48===0) {
          const p=f.position.clone().addScaledVector(f.right,22);p.y=-1.4;
          if(d<1000)makeBear(chunk,p,1.8);else makeGator(chunk,p,2.1);
        }
      }
      scenery.add(mergeStatic(chunk));
    }
    this.world.add(scenery);
    const details=new THREE.Group();
    for(let d=25;d<COURSE_LENGTH;d+=20) {
      const f=sampleTrack(d);
      const dash=box(details,0xffd59b,[f.position.x,f.position.y+.026,f.position.z],[.13,.025,3]);dash.quaternion.copy(f.quaternion);
    }
    for(const d of [0,COURSE_LENGTH]) {
      const f=sampleTrack(d); const gate=new THREE.Group();gate.position.copy(f.position);gate.quaternion.copy(f.quaternion);details.add(gate);
      for(const side of [-1,1])box(gate,0x224c59,[side*8,5,0],[.8,10,.8]);
      box(gate,0x234453,[0,10.0,0],[17,2.1,1]);
      for(let i=0;i<16;i++)for(let j=0;j<2;j++)box(gate,(i+j)%2?0xfff2cd:0x214554,[-7.5+i,9.55+j,0.55],[1,1,.06]);
    }
    for(const d of RAMPS) {
      const f=sampleTrack(d-7);
      for(const side of [-1,1]) {
        const p=f.position.clone().addScaledVector(f.right,8.2);p.addScaledVector(f.right,side<0?-16.4:0);
        box(details,0x185268,[p.x,p.y+1.4,p.z],[.18,2.8,.18]);
        const arrow=shape(details,'cone',0xffe585,[p.x,p.y+3,p.z],[.75,1.3,.2],[0,0,-Math.PI/2]);
        arrow.rotation.z=0;
      }
    }
    // The loop has two large supports and a celebratory gateway.
    const loopBase=center(LOOP_START);
    for(const side of [-1,1]) box(details,0x3c9a9d,[loopBase.x+side*10+6,15,loopBase.z],[.75,32,.75]);
    const lake=shape(details,'cylinder',0x4fbac6,[8,-1.36,1150],[100,.15,165]);lake.receiveShadow=true;
    for(let i=0;i<25;i++) {
      const z=i*77-40;
      for(const side of [-1,1])shape(details,'cone',[0x69aaa0,0x75b7a7,0x88c3b2][i%3],[side*(110+i%4*25),8,z],[24+i%3*12,26+i%4*15,26],undefined);
    }
    this.world.add(mergeStatic(details));
    // Friendly spectators at the starting line are visible in the garage scene.
    const friends=new THREE.Group();makeBear(friends,new THREE.Vector3(-12,-1.2,22),2.6);makeGator(friends,new THREE.Vector3(15,-1.2,25),2.4);this.world.add(mergeStatic(friends));
    const clouds=new THREE.Group();
    for(let i=0;i<24;i++) {const x=Math.sin(i*8.3)*90,z=i*80;for(let j=0;j<3;j++)ball(clouds,0xd9f1e9,[x+j*6,60+Math.sin(i)*10,z],[8,3.5,4.5]);}
    this.world.add(mergeStatic(clouds));
  }
  buildStars() {
    for(let d=40,i=0;d<COURSE_LENGTH-25;d+=32,i++) {
      const f=sampleTrack(d);const lane=i%3===0?0:i%3===1?-1:1;
      const m=new THREE.Mesh(this.starGeometry,mat(0xffd750,.25));
      m.position.copy(f.position).addScaledVector(f.right,lane*3.4).addScaledVector(f.up,2.9);m.rotation.y=.3;
      this.scene.add(m);this.stars.push({mesh:m,distance:d,lane,collected:false,base:m.position.clone()});
    }
  }
  setTruck(spec) {
    const shared=new Set(Object.values(geometries));
    this.truck.group.traverse(obj=>{if(obj.isMesh&&!shared.has(obj.geometry))obj.geometry.dispose();});
    this.scene.remove(this.truck.group);this.truck=makeTruck(spec);this.scene.add(this.truck.group);this.transform=0;
  }
  reset() {this.stars.forEach(s=>{s.collected=false;s.mesh.visible=true;});this.mode='race';this.snapCamera=true;this.transform=0;this.squash=0;this.particles.forEach(p=>{p.life=0;p.mesh.visible=false;});}
  menu() {this.mode='menu';this.snapCamera=true;}
  resize() {this.width=innerWidth;this.height=innerHeight;this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height,false);this.snapCamera=true;}
  burst(colorful=true,count=20) {
    let n=0;for(const p of this.particles) {if(p.life>0)continue;p.life=.5+Math.random()*.7;p.mesh.visible=true;p.mesh.position.copy(this.truck.group.position).add(new THREE.Vector3(0,1,0));p.v.set((Math.random()-.5)*11,Math.random()*8+2,(Math.random()-.5)*11);p.mesh.scale.setScalar(colorful?1.5:2.4);if(++n>=count)break;}
  }
  land() {this.squash=1;this.burst(false,12);}
  update(dt,race) {
    this.time+=dt;
    const isMenu=this.mode==='menu';
    const d=isMenu?14:race.distance;
    const f=sampleTrack(d);const g=this.truck.group;
    g.scale.setScalar(this.truck.spec.scale*(isMenu?(this.width<this.height?1.72:2.1):1));
    g.position.copy(f.position).addScaledVector(f.right,(isMenu?0:race.lane)*3.4).addScaledVector(f.up,isMenu?0:race.height);
    g.quaternion.copy(f.quaternion);
    if(isMenu)g.rotateY(-.15+Math.sin(this.time*.32)*.1);
    else if(race.height>0)g.rotateX(clamp(-race.velocityY*.025,-.28,.35));
    this.transform=lerp(this.transform,!isMenu&&race.transformTime>0?1:0,1-Math.exp(-dt*5));
    this.squash=Math.max(0,this.squash-dt*3.5);
    this.truck.body.position.y=this.transform*1.8-this.squash*.2+(isMenu?.035*Math.sin(this.time*2):Math.sin(this.time*16)*.025);
    this.truck.head.visible=this.transform>.06;this.truck.head.scale.setScalar(Math.max(.01,this.transform));
    this.truck.arms.forEach((arm,i)=>{arm.visible=this.transform>.06;arm.rotation.z=(i===0?-1:1)*this.transform*.85;});
    this.truck.struts.forEach(leg=>{leg.visible=this.transform>.06;leg.scale.y=1.2+this.transform*1.9;leg.position.y=1.7+this.transform*.8;});
    this.truck.wheels.forEach((wheel,i)=>{wheel.position.x=(i%2===0?-1:1)*(1.65+this.transform*.7);if(!isMenu&&race.phase==='running')wheel.rotation.x+=dt*19;});
    const inLoop=d>LOOP_START-18&&d<LOOP_END+15&&!isMenu;
    if(isMenu) {
      const portrait=this.width<this.height;
      const showcaseZoom=(1+(this.truck.spec.scale-1)*.75)*(portrait?1.13:1);
      this.targetCamera.copy(f.position).add(new THREE.Vector3(portrait?12:13,9,18).multiplyScalar(showcaseZoom));
      this.targetLook.copy(f.position).add(new THREE.Vector3(portrait?0:-7,portrait?4:1.6,0));
      this.camera.fov=portrait?58:45;
    } else if(inLoop) {
      const base=center(LOOP_START);
      this.targetCamera.copy(base).add(new THREE.Vector3(78,33,-55).multiplyScalar(this.width<this.height?1.8:1));
      this.targetLook.copy(base).add(new THREE.Vector3(6,26,0));this.camera.fov=54;
    } else {
      const horizontal=f.forward.clone();horizontal.y=0;horizontal.normalize();
      const distance=this.width<this.height?19:16;
      this.targetCamera.copy(g.position).addScaledVector(horizontal,-distance).add(new THREE.Vector3(0,9+race.height*.18,0));
      this.targetLook.copy(f.position).addScaledVector(horizontal,15).add(new THREE.Vector3(0,2+race.height*.4,0));
      this.camera.fov=58+(this.reducedMotion?0:this.transform*5);
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
      if(!isMenu&&race.phase==='running'&&Math.abs(s.distance-d)<2.2&&(this.transform>.3||Math.abs(race.lane-s.lane)<.65)) {s.collected=true;s.mesh.visible=false;collected++;}
    }
    for(const p of this.particles) {
      if(p.life<=0)continue;p.life-=dt;p.mesh.visible=p.life>0;p.v.y-=dt*12;p.mesh.position.addScaledVector(p.v,dt);p.mesh.rotation.x+=dt*4;p.mesh.rotation.z+=dt*3;
    }
    if(this.transform>.5&&Math.random()<dt*20&&!this.reducedMotion)this.burst(true,1);
    this.renderer.render(this.scene,this.camera);
    return collected;
  }
}
