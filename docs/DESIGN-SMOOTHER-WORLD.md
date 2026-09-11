# Smoother world, flowing fire and rewarding crushing

James's parent requests less pointy graphics, more realism and detail, more realistic flames, and car crushing that is always a good thing. The parent authorizes implementation choices, ongoing improvements and browser playthroughs. This supersedes the turbo adventure's crush slowdown. Retain an inviting toy-world character, original designs and the existing easy touchscreen/keyboard race.

## Engine and visual direction

Use the installed Three.js renderer and existing modules. This is a coordinated visual/effect upgrade with a bounded rules change; a new engine or language would not itself fix geometry, materials or fire. No new dependency or external runtime asset is required. Prefer rounded silhouettes, smooth normals and visible material separation over indiscriminately increasing every polygon count. Keep orange stunt-track readability, six distinctive trucks, actual shadows and clear landmarks.

Truck work refines `src/models.mjs`: smoother sculpted surfaces and wheel edges, body-panel/rubber/chrome/glass material variation, restrained mechanical details and properly seated glazing. Preserve dimensions, animation/exhaust attachment contracts and independently owned resources. Regenerate all six portraits through the existing renderer after models settle.

World work refines `src/world.mjs` and `src/adventure.mjs`: replace prominent cone trees with rounded, organic crowns, soften rocks and vegetation, improve waterfall/bridge/rocket material and detail where useful. Keep landmark readability, batched geometry, loop sightlines, road/gate clearance and the same track path. Detailed near-road silhouettes matter more than distant triangles. Aim to stay inside the existing full-scene 700-call/550,000-triangle budget in real views.

## Exhaust fire

Replace the rigid repeated flame beads in `src/flames.mjs` with a softly edged, animated plume. Layer hot pale cores, amber flame bodies and fading red/orange tips; use procedural variation for a flowing shape. The effect must read as exhaust issuing from both pipes, follow world-space travel through turns/jumps/loop inversion and grow under turbo/guardian power. Avoid solid geometric spear tips, detached spheres, square billboard edges and excessive white bloom. Preserve a fixed reused particle pool and a small draw-call cost. New shader/texture resources must be owned and disposed; no network textures.

Keep the existing `ExhaustFlames(scene)` public contract: `update(dt,{truck,time,mode,race,transform,reducedMotion})`, `clear()`, `dispose()`, `mesh` and bounded `particles`. Main diagnostics may continue to count visible instances. Any necessary signature change must be coordinated before implementation. Menu shows small idle exhaust. Pause freezes all uniforms, transforms and particle state; gentler motion shows two modest steady flames and no moving trail. Unit tests cover lifecycle/resource/attachment behavior; inspect the actual WebGL output in Chrome and WebKit.

## Crushing is a reward

Remove the .65-second crush slowdown entirely. Every newly crushed parked toy car immediately grants two stars, 35 turbo charge and a short roughly one-second speed burst at 1.18x cruise. Manual/pad turbo remains stronger at 1.55x and never loses duration from a crush; boosts do not multiply or stack into runaway speed. Replay resets all crush state. Jumping over or steering clear of a car remains valid but has no penalty either. Keep no lives, damage, lost progress or forced restart.

Use a positive short callout, a gentle golden burst and satisfying crunch plus reward chime. Avoid the heavy landing/dust feedback that reads as a crash. Existing flattening and wheel-splay animation stays visible. The simulation keeps forward speed at or above cruising speed, including repeated crushing and power transitions.

Friendly opponents may approach during authored stretches before selected car rows, using continuous independent pace and existing safe passing rules. Their place follows actual distances. Crushing and turbo widen the lead; an untouched race still wins. Preserve late-merge safety for every truck, including guardian width/shrink, by testing actual close passes independently of the removed slowdown.

## Verification and release

Observe a failing test for removal of slowdown before changing the rules. Run meaningful contact/reward/power/rank/reset cases, all six trucks with no input and input-heavy full races, close-pass geometry, flame lifecycle, model/world clearance and resource bounds. Update obsolete tests to the new intended behavior without weakening the underlying safety assertions.

Play the real game through browser controls after integration: crush a car, turbo, jump, steer both ways, pause/resume, complete the loop and rainy bay, win, select an earned truck and replay. Inspect near/far fire, all six truck designs, landmarks, portrait/landscape and the largest guardian. Run complete Chrome/WebKit suites locally and on the published build. Record measured results and refreshed screenshots; physical iPad performance still requires an actual device observation.
