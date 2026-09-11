import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SmashTargets } from '../src/smash-scene.mjs';
import { getSmashTargets } from '../src/encounters.mjs';

function pose(target) { return target.parts.map(({mesh})=>[...mesh.position,...mesh.scale,...mesh.rotation.toArray()]); }
test('only actual hits break a toy; pause freezes it and replay restores its complete shape',()=>{
  const toys=new SmashTargets(new THREE.Scene());const target=toys.targets[0];const rest=pose(target);
  const race={phase:'running',courseId:'skyway',distance:target.distance,smashedTargets:[]};
  toys.update(.1,{race,mode:'race'});assert.deepEqual(pose(target),rest);
  race.smashedTargets=[target.id];toys.update(.1,{race,mode:'race'});assert.notDeepEqual(pose(target),rest);
  const broken=pose(target);race.phase='paused';toys.update(.1,{race,mode:'race',reducedMotion:true});assert.deepEqual(pose(target),broken);
  race.phase='running';for(const dt of [0,-1,NaN,Infinity]){toys.update(dt,{race,mode:'race'});assert.deepEqual(pose(target),broken);}
  toys.update(.1,{race,mode:'race',reducedMotion:true});assert.equal(target.age,1);assert.ok(target.parts.every(({mesh})=>mesh.position.y<=.14+1e-12));
  toys.reset();assert.deepEqual(pose(target),rest);assert.deepEqual(toys.diagnostics.broken,[]);toys.dispose();
});
test('course changes hide unreachable toys and menu hides every smash visual',()=>{
  const toys=new SmashTargets(new THREE.Scene());
  for(const courseId of ['woods','loop','bay','canyon']){
    const allowed=new Set(getSmashTargets(courseId).map(target=>target.id));
    for(const target of toys.targets){toys.update(.02,{mode:'race',race:{courseId,phase:'running',distance:target.distance,smashedTargets:[]}});assert.equal(target.group.visible,allowed.has(target.id));}
  }
  toys.update(.02,{mode:'menu',race:{phase:'ready'}});assert.equal(toys.group.visible,false);toys.dispose();
});
test('smash visual resources stay fixed through resets and dispose exactly once',()=>{
  const scene=new THREE.Scene(),toys=new SmashTargets(scene),resources=[toys.geometry,toys.barrel,...toys.materials];
  const counts=resources.map(resource=>{const state={count:0};resource.addEventListener('dispose',()=>state.count++);return state;});
  for(let i=0;i<25;i++){toys.reset();assert.ok(counts.every(state=>state.count===0));}
  toys.dispose();toys.dispose();assert.ok(counts.every(state=>state.count===1));assert.equal(scene.children.length,0);
});
