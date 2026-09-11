import { COURSE_LENGTH, LOOP_START, LOOP_END, RAMPS, RACE_SPEED, TRUCKS } from './core.mjs';
import { makeTruck, disposeTruck } from './models.mjs';
import { sampleTrack, laneOffset } from './track.mjs';

const TAU = Math.PI * 2;
const JUMP_SPEED = 16;
const GRAVITY = 24;
const BUDDIES = Object.freeze([
  Object.freeze({ id: 'sunny', name: 'Sunny', gap: 10, lane: -.65, model: 0, color: 0xffd458, accent: 0xff8c54, scale: .50 }),
  Object.freeze({ id: 'splash', name: 'Splash', gap: 14, lane: .65, model: 1, color: 0x4edbcc, accent: 0xffeea3, scale: .46 }),
]);

function playerDistance(race) {
  return Number.isFinite(race?.distance) ? Math.min(COURSE_LENGTH, Math.max(0, race.distance)) : 0;
}

/** Rendering samples defensive copies of the simulation's real opponent poses.
 * Distance-only tools still get an analytic preview without creating a race. */
export function sampleRaceBuddies(race) {
  if (Array.isArray(race?.buddies) && race.buddies.length === BUDDIES.length && race.buddies.every((pose, index) =>
    pose?.id === BUDDIES[index].id && ['distance', 'lane', 'height', 'velocityY'].every(key => Number.isFinite(pose[key])))) {
    return race.buddies.map(pose => ({ id: pose.id, name: pose.name, distance: pose.distance, lane: pose.lane, height: pose.height, velocityY: pose.velocityY }));
  }
  const progress = playerDistance(race);
  return BUDDIES.map(buddy => {
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
    return { id: buddy.id, name: buddy.name, distance, lane: buddy.lane, height, velocityY };
  });
}

export function racePlace(race) {
  const distance = playerDistance(race);
  return 1 + sampleRaceBuddies(race).filter(buddy => buddy.distance > distance).length;
}

export class RaceBuddies {
  constructor(scene) {
    this.trucks = BUDDIES.map(buddy => {
      // Retain the rally lamps and bear ears from the original sculpted models.
      const truck = makeTruck({ ...TRUCKS[buddy.model], name: buddy.name, color: buddy.color, accent: buddy.accent, scale: buddy.scale });
      truck.group.name = `buddy-${buddy.id}`;
      scene.add(truck.group);
      return truck;
    });
    this.disposed = false;
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
  update(dt, race, visible = true) {
    if (this.disposed) return;
    for (const truck of this.trucks) truck.group.visible = Boolean(visible);
    if (!visible || !Number.isFinite(dt) || dt <= 0 || race?.phase === 'paused') return;
    const poses = sampleRaceBuddies(race);
    for (let i = 0; i < this.trucks.length; i++) {
      const truck = this.trucks[i];
      const travel = poses[i].distance - this.poses[i].distance;
      for (const wheel of truck.wheels) {
        wheel.rotation.x = (wheel.rotation.x + travel / (1.07 * truck.spec.scale)) % TAU;
      }
      this.place(truck, poses[i]);
    }
    this.poses = poses;
  }

  reset() {
    if (this.disposed) return;
    this.poses = sampleRaceBuddies({ distance: 0 });
    this.trucks.forEach((truck, i) => {
      truck.group.visible = false;
      for (const wheel of truck.wheels) wheel.rotation.set(0, 0, 0);
      this.place(truck, this.poses[i]);
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const truck of this.trucks) {
      truck.group.removeFromParent();
      disposeTruck(truck);
    }
  }
}
