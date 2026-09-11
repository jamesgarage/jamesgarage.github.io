# Playful friends and a living world

The next increment gives Sunny and Splash bounded, local decision-making and adds material detail and ambient life to the existing Three.js course. The parent has authorized design decisions, implementation, regression play and continued publication. This remains an easy game for a three-year-old on touchscreens and computers.

## Decisions

Use small deterministic state machines over the current continuous steering/speed rules. A large behavior-tree framework would add machinery for only two friends; networked language-model agents would add latency and unpredictability without improving these driving decisions. Preserve the proven clearance layer and truthful distance-based rank. Research and engine comparisons belong in `RESEARCH-PLAYFUL-WORLD.md`; retain Three.js for this release and improve its art and animation directly.

Sunny is an eager stunt friend; Splash is a relaxed puddle explorer. They greet at the start, react to James's manual jumps, successful crushing and turbo, and return to following. Sunny offers occasional brief lead challenges. Splash enjoys the wet stretch. Decisions have cooldowns and bounded per-race variation, with a deterministic seed from the existing completed-race counter. The same seed/input is reproducible; different races alter timing and incidental detail, never the route, controls, difficulty or rewards. No-input play must still finish first.

## Interfaces and safety

`createRace(seed = 0)` adds a normalized `variant` and initializes each buddy's serializable brain state. The simulation owns intent, signal and timers; rendering only samples defensive copies. Buddy poses retain id/name/distance/lane/height/velocityY and add `intent`, `signal`, `signalTime` and `speed`. Signals are `hello`, `jump`, `star`, `turbo`, `splash` or empty. `stepRace` may return bounded `{type:'buddy', id, action}` one-shot events for sound; they never affect rewards. Manual-jump imitation is delayed, grounded and suppressed near ramps/loop transitions. Reactions never cause cutting across James or another truck. Existing passing widths, smooth motion, guardian clearance and minimum cruise speed remain authoritative. No touching third-party services or runtime network AI.

The renderer adds readable small pictorial signals over friends, subtle steering and suspension, and bounded puddle/spark effects if affordable. Each signal follows its own truck; hide decoration in the loop if it harms readability. Gentler motion keeps steady signals with no bouncing/particle trails. Pause freezes all simulation and visual state; replay clears transient signals and effects.

## Scenery

Improve the sense of physical materials: subtle ground variation, woodland floor patches, wood grain, stone variation and water highlights. Add a small set of ambient details such as drifting butterflies/fireflies, reeds moving in a breeze and gentle water ripples. Keep landmarks and the orange road readable. Per-race variation changes accent details, not track geometry. Procedural assets stay original and locally bundled. No large downloads or new dependencies.

World-life module contract: `new WorldLife(scene)` owns its GPU resources; `update(dt, {race, reducedMotion, mode})`, `reset(variant = 0)`, `dispose()` are idempotent/lifecycle safe. Expose bounded diagnostic counts. Existing world/adventure factories keep their contracts. Reduced-motion and paused updates must be static. Geometry must preserve the existing road/loop clearance map and maintain actual moving-camera views below 700 calls / 550,000 triangles where feasible; any material exception requires measurement and explicit documentation.

## Acceptance

Meaningful unit tests cover deterministic variation, reactions/cooldowns, finite serializable state, no-input wins across all six trucks and variants, safe passing, positive crushing/turbo, pause/replay and independent resource disposal. Retain full browser races in Chrome and WebKit, touch/keyboard checks, saved unlock/replay and fallback tests. Play through the new reactions with actual controls and inspect desktop/tablet/phone, giant guardian and loop views. Record draw/geometry counts and resource reuse; do not equate desktop emulation with iPad performance. Publish only after material review findings close.
