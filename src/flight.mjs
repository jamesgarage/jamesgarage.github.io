/** A guided flight is measured along the shared course centerline. Turbo can
 * change how quickly it plays, but never where it lands. startHeight carries
 * a previous ramp jump smoothly into a canyon crossing. */
export function sampleFlight(flight, distance, speed = 26) {
  if (!flight || ![flight.start, flight.end, flight.height, distance, speed].every(Number.isFinite) ||
      flight.end <= flight.start || distance < flight.start || distance >= flight.end) {
    return { height: 0, velocityY: 0 };
  }
  const span = flight.end - flight.start;
  const t = (distance - flight.start) / span;
  const initial = Number.isFinite(flight.startHeight) ? Math.max(0, flight.startHeight) : 0;
  const peak = Math.max(0, flight.height);
  return {
    height: initial * (1 - t) + 4 * peak * t * (1 - t),
    velocityY: (4 * peak * (1 - 2 * t) - initial) / span * Math.max(0, speed),
  };
}
