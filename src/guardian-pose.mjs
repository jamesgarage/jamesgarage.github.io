const EMPTY = Object.freeze({});
const clamp = (value, low, high) => Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : 0;

/** Absolute, allocation-free articulation. The scene owns smoothing, root
 * placement, wheel spin/steering, and the active camera. Hidden parts return to
 * their neutral pose so menu/replay cannot retain flight articulation. */
export function poseGuardian(truck, pose = EMPTY) {
  pose ??= EMPTY;
  const menu = pose.menu === true;
  const transform = menu ? 0 : clamp(pose.transform, 0, 1);
  const flight = menu ? 0 : pose.flight === true ? 1 : clamp(pose.flight, 0, 1);
  const lean = menu ? 0 : clamp(pose.lean, -.32, .32);
  const squash = menu ? 0 : clamp(pose.squash, 0, 1);
  const time = Number.isFinite(pose.time) ? pose.time : 0;
  const visible = transform > .06;
  const robotFlight = flight * transform;
  truck.body.position.y = transform * 1.8 - squash * .2 + Math.sin(time * (menu ? 2 : 16)) * (menu ? .035 : .025);
  truck.body.rotation.set(0, 0, -lean);
  truck.head.visible = visible;
  truck.head.scale.setScalar(Math.max(.01, transform));
  truck.head.rotation.set(-robotFlight * .08, 0, 0);
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1, arm = truck.arms[i], strut = truck.struts[i];
    arm.visible = visible;
    arm.rotation.set(-robotFlight * .82, 0, side * transform * (.62 - robotFlight * .38));
    strut.visible = visible;
    strut.scale.set(1, 1.2 + transform * 1.9, 1);
    strut.position.y = 1.7 + transform * .8;
    strut.rotation.set(robotFlight * .18, 0, 0);
  }
  for (let i = 0; i < 4; i++) truck.wheels[i].position.x = (i % 2 ? 1 : -1) * (1.65 + transform * .58);
  const rig = truck.guardian;
  if (!rig) return;
  rig.upper.visible = visible || flight > .06;
  rig.lower.visible = visible;
  rig.lower.scale.setScalar(Math.max(.01, transform));
  rig.lower.position.y = robotFlight * .04;
  rig.lower.rotation.z = -lean * transform * .15;
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    rig.legs[i].rotation.set(robotFlight * .2, 0, side * robotFlight * .025);
    rig.wings[i].rotation.set(-flight * .22, 0, -side * (.85 * (1 - flight) + .1 * (1 - transform)));
  }
  rig.jets.visible = flight > .06;
  // The existing exhaust system supplies moving trails. These finite luminous
  // cores stay steady under gentler motion and own no particles or clock.
  const pulse = pose.reducedMotion ? 1 : 1 + Math.sin(time * 11) * .035;
  rig.jets.scale.set(1, 1, 1);
  rig.jets.position.z = flight > .06 ? -.015 * flight * pulse : 0;
}
