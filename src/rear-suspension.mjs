/** Pose the borrowed Titan rear springs using the body's existing landing dip.
 * At full response the lower mount stays fixed while the upper follows the body.
 * Fade back to the authored pose during sharp steering to preserve tire clearance.
 * No clock or resource ownership: passing zero restores the authored pose. */
export function poseRearSuspension(suspension, compression = 0, bodyLean = 0) {
  if (!suspension) return 0;
  const lean = Math.abs(bodyLean);
  const taper = !Number.isFinite(bodyLean) || lean >= .18 ? 0 : lean <= .14 ? 1 : (.18 - lean) / (.18 - .14);
  const amount = (Number.isFinite(compression) ? Math.min(.2, Math.max(0, compression)) : 0) * taper;
  const { group, lowerAnchor, span } = suspension;
  group.scale.y = amount === 0 ? 1 : 1 - amount / span;
  group.position.y = amount === 0 ? 0 : lowerAnchor * (1 - group.scale.y) + amount;
  return amount;
}
