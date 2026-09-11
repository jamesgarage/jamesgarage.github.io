import { COURSE_LENGTH, LOOP_START, LOOP_END, RAMPS, RACE_SPEED } from './core.mjs';
import { makeBuddyTruck, disposeBuddyTruck } from './buddy-models.mjs';
import { raceCrew } from './crew.mjs';
import { normalizeRaceVariant } from './buddy-brain.mjs';
import { sampleTrack, laneOffset } from './track.mjs';
import { BuddySignals } from './buddy-signals.mjs';

const TAU = Math.PI * 2;
const JUMP_SPEED = 16;
const GRAVITY = 24;

function playerDistance(race) {
  return Number.isFinite(race?.distance) ? Math.min(COURSE_LENGTH, Math.max(0, race.distance)) : 0;
}

/** Rendering samples defensive copies of the simulation's real opponent poses.
 * Distance-only tools still get an analytic preview without creating a race. */
export function sampleRaceBuddies(race) {
  const crew = raceCrew(race?.variant);
  if (Array.isArray(race?.buddies) && race.buddies.length === crew.length && race.buddies.every((pose, index) =>
    pose?.id === crew[index].id && ['distance', 'lane', 'height', 'velocityY'].every(key => Number.isFinite(pose[key])))) {
    return race.buddies.map(pose => ({ id: pose.id, name: pose.name, distance: pose.distance, lane: pose.lane, height: pose.height, velocityY: pose.velocityY,
      intent: typeof pose.intent === 'string' ? pose.intent : 'follow', signal: typeof pose.signal === 'string' ? pose.signal : '',
      signalTime: Number.isFinite(pose.signalTime) ? Math.max(0, pose.signalTime) : 0, speed: Number.isFinite(pose.speed) ? pose.speed : RACE_SPEED }));
  }
  const progress = playerDistance(race);
  return crew.map(buddy => {
    const distance = progress - buddy.gap;
    let height = 0, velocityY = 0;
    if (distance < LOOP_START || distance > LOOP_END) {
      for (const ramp of RAMPS) {
        const time = (distance - ramp) / RACE_SPEED;
        if (time >= 0 && time < 2 * JUMP_SPEED / GRAVITY) {
          height = Math.max(0, JUMP_SPEED * time - GRAVITY * time * time / 2);
          velocityY = JUMP_SPEED - GRAVITY * time;
          break;
        }
      }
    }
    return { id: buddy.id, name: buddy.name, distance, lane: buddy.lane, height, velocityY, intent: 'follow', signal: '', signalTime: 0, speed: RACE_SPEED };
  });
}

export function racePlace(race) {
  const distance = playerDistance(race);
  return 1 + sampleRaceBuddies(race).filter(buddy => buddy.distance > distance).length;
}

export class RaceBuddies {
  constructor(scene) {
    this.scene = scene;
    this.trucks = [];
    this.crew = raceCrew();
    this.disposed = false;
    this.signals = new BuddySignals(scene, this.crew);
    this.reset();
  }

  place(truck, pose) {
    const frame = sampleTrack(pose.distance);
    truck.group.position.copy(frame.position).addScaledVector(frame.right, laneOffset(pose.lane)).addScaledVector(frame.up, pose.height);
    truck.group.quaternion.copy(frame.quaternion);
    if (pose.height > 0) truck.group.rotateX(Math.max(-.28, Math.min(.35, -pose.velocityY * .025)));
    truck.group.updateMatrixWorld(true);
  }

  /** Zero/invalid time freezes every pose and wheel even if race input changes.
   * Visibility can still change so menu transitions work on a paused frame. */
  update(dt, race, visible = true, { camera, reducedMotion = false } = {}) {
    if (this.disposed) return;
    for (const truck of this.trucks) truck.group.visible = Boolean(visible);
    if (!visible) this.signals.update(dt, { visible: false });
    if (!visible || !Number.isFinite(dt) || dt <= 0 || race?.phase === 'paused') return;
    if (normalizeRaceVariant(race?.variant) !== this.variant) {
      this.reset(race?.variant);
      for (const truck of this.trucks) truck.group.visible = true;
    }
    const poses = sampleRaceBuddies(race);
    for (let i = 0; i < this.trucks.length; i++) {
      const truck = this.trucks[i];
      const travel = poses[i].distance - this.poses[i].distance;
      const lateralSpeed = (poses[i].lane - this.poses[i].lane) * 3.4 / dt;
      const targetSteer = Math.max(-.16, Math.min(.16, -lateralSpeed / Math.max(10, poses[i].speed)));
      this.steering[i] += (targetSteer - this.steering[i]) * (1 - Math.exp(-8 * dt));
      truck.body.rotation.z = reducedMotion ? 0 : -this.steering[i] * .35;
      for (const [index, wheel] of truck.wheels.entries()) {
        wheel.rotation.order = 'YXZ'; wheel.rotation.y = index > 1 ? this.steering[i] : 0;
        wheel.rotation.x = (wheel.rotation.x + travel / (1.07 * truck.spec.scale)) % TAU;
      }
      this.place(truck, poses[i]);
    }
    this.poses = poses;
    this.signals.update(dt, { race, poses, trucks: this.trucks, camera, reducedMotion });
  }

  reset(variant = 0) {
    if (this.disposed) return;
    this.variant = normalizeRaceVariant(variant);
    this.crew = raceCrew(this.variant);
    this.crew.forEach((spec, i) => {
      if (this.trucks[i]?.spec.id === spec.id) return;
      if (this.trucks[i]) { this.trucks[i].group.removeFromParent(); disposeBuddyTruck(this.trucks[i]); }
      this.trucks[i] = makeBuddyTruck(spec);
      this.trucks[i].group.name = `buddy-${spec.id}`;
      this.scene.add(this.trucks[i].group);
    });
    this.signals.reset(this.crew); this.steering = this.crew.map(() => 0);
    this.poses = sampleRaceBuddies({ distance: 0, variant: this.variant });
    this.trucks.forEach((truck, i) => {
      truck.group.visible = false;
      truck.body.rotation.z = 0;
      for (const wheel of truck.wheels) { wheel.rotation.order = 'YXZ'; wheel.rotation.set(0, 0, 0); }
      this.place(truck, this.poses[i]);
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.signals.dispose();
    for (const truck of this.trucks) {
      truck.group.removeFromParent();
      disposeBuddyTruck(truck);
    }
  }
}
