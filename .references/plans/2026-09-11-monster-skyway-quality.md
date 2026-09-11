# Monster Skyway visual quality implementation plan

> **For agentic workers:** Use Superpowers subagent-driven development or executing-plans to implement these tasks, with independent code and visual review. Steps use checkbox syntax for tracking.

**Goal:** Publish a substantially more polished 3D monster-truck racer while preserving James's easy play and earned trucks.

**Architecture:** Separate truck models and course/scenery construction from the existing rendering coordinator. Keep the simulation and save format stable. Upgrade the actual runtime scene and interface, then verify the published build.

**Tech stack:** Three.js 0.186.0, Vite 8.3.0, vanilla ES modules, Node test runner, Playwright 1.58.2, GitHub Pages.

**Spec:** `docs/DESIGN-QUALITY.md`.

## Global constraints

- Keep Three.js 0.186.0, Vite 8.3.0, and the existing vanilla JavaScript architecture.
- Preserve the version-1 save key, all truck IDs, unlock thresholds, race rewards, and no-input completion.
- Preserve keyboard and touch control accessible names, pause/resume, and unavailable-storage/audio recovery.
- Keep the 1,900-unit course, six ramps, complete vertical loop, automatic acceleration, and guardian transformation.
- Keep all runtime assets local to the published site; no accounts, ads, purchases, analytics, or runtime third-party fetches.
- Use bounded effect pools, reuse or dispose GPU resources, and cap render pixel ratio at 1.5.
- Maintain a clear road, readable truck silhouette, and usable 768×1024 and 1024×768 touch layouts.
- Work on the existing `main` branch; create no branches or worktrees.
- Publish through the existing manually dispatched GitHub Pages workflow after local verification and repeat the browser suite on the public URL.

## Task 1: Sculpted truck collection

**Files:** create `src/models.mjs` and `tests/models.test.mjs`. Integration in `src/scene.mjs` belongs to Task 2.

**Interfaces:**

```js
export function makeTruck(spec) { /* returns { group, body, wheels, arms, head, struts, spec } */ }
export function disposeTruck(truck) { /* dispose only owned GPU resources */ }
```

The body is an animated child of group; four wheel groups spin about local X and sit at x=±1.65, y≈1.05, z=±1.5. Arms and struts remain two-element arrays. The head begins hidden. The body rises 1.8 units during transformation; wheel x positions spread by .7. Body-local exhaust outlets stay at `(±1.05,3.09,-2.16)`. Do not change the specification colors, IDs, thresholds, or scale.

- [x] Add meaningful model contract and resource lifecycle tests. Construct all six specs with `makeTruck`; require finite geometry and matrices, correct animated groups, four wheels, visible distinguishing details, and no disposed geometry still referenced by a newly constructed truck after disposal of another.
- [x] Run the new tests before implementing the module and observe the missing-module failure.
- [x] Build rounded or beveled painted bodywork, a sculpted tire profile with chunky tread, inset glass, chrome hubs and mechanical suspension, fender arches, bumpers, and original character details. Use Three's local geometry helpers where useful and batch static parts by material where they share an animated parent.
- [x] Differentiate the six truck silhouettes according to the spec, retaining their current animation contract and exhaust anchors. Add useful `name` metadata to distinguishing model groups for inspection.
- [x] Run `node --test tests/models.test.mjs` and inspect a turntable render after integration. Verify the larger guardian remains inside the road corridor.
- [x] Independently review model compliance, resource ownership, and visible quality. Commit only this task's files after verification.

## Task 2: Dimensional track, three environments, and lighting

**Files:** create `src/track.mjs`, `src/world.mjs`, and `tests/track.test.mjs`; modify `src/scene.mjs`.

**Interfaces:**

```js
// src/track.mjs: exact course math extracted from the current scene.
export function sampleTrack(distance) { /* {position, forward, right, up, quaternion} */ }
export function trackCenter(distance) { /* THREE.Vector3 */ }
// src/world.mjs
export function createWorld() { /* THREE.Group, all scenery and road */ }
// src/scene.mjs preserves compatibility:
export { makeTruck } from './models.mjs';
export { sampleTrack } from './track.mjs';
```

- [x] Add course-frame tests across the loop and all ramps: finite vectors, unit orthogonal basis, continuity around loop entry/exit, upright entry and inverted top. Preserve existing course coordinates when extracting functions.
- [x] Build a thick orange track using an extruded cross section sampled from the course frame. Include a top surface, side walls, underside, continuous safety lips, contrasting edge strips, panel seams, and short arrow markings before ramps.
- [x] Construct scenery in spatial chunks and merge compatible static meshes by material and shadow flags. Add rolling terrain, clusters of pines and rocks, clear route gates, a supported loop with pennants, and a lagoon with islands, palms, reeds, and friendly gators. Keep scenery outside the road corridor.
- [x] Add a sky gradient, calibrated sun and hemisphere lights, soft shadowing, reflective material environment, and a contact shadow beneath the truck. Keep the render pixel ratio cap.
- [x] Replace scene-local model/world constructors with the new modules; invoke `disposeTruck` on vehicle replacement. Keep flame and star lifecycle behavior intact.
- [x] Run the unit suite and production build. Capture local desktop/tablet driving, garage, jump, loop, and bay screenshots; inspect the result and tune contrast, camera readability, track depth, and the scene's draw budget.
- [x] Independently review frame math, batching, disposal, and route visibility. Commit the verified implementation.

## Task 3: Game lobby, race feedback, and presentation

**Files:** modify `index.html`, `src/style.css`, `src/main.mjs`, `src/scene.mjs`; optional create `scripts/render-trucks.mjs` and local `public/trucks/` preview assets if useful.

**Interfaces:** preserve all existing element IDs and button accessible names. The model and core contracts above remain stable. The race HUD can derive its stage from `race.distance` without modifying the simulation.

- [x] Strengthen the lobby's game identity, prominent Play control, truck showcase, route chips, and truck collection cards. Prefer real model previews rendered from the original models to unrelated illustration.
- [x] Add clear stage identity during the race and concise stunt/reward feedback while keeping the track center and touch controls clear. Use existing jump, land, loop, transform, and finish events; avoid extra instructions or modal steps.
- [x] Tune the chase camera, wheel/steering and suspension response, and landing impulse. Suppress impulses with reduced motion, freeze animation at dt=0, and keep the loop overview horizon upright. Scale framing for every truck and screen orientation.
- [x] Preserve keyboard focus, accessible dialog behavior, large touch targets, saved progress, and fallback play.
- [x] Run the browser input/pause and fallback cases, then inspect 1440×900, 1024×768, 768×1024, and 390×844 layouts plus each truck selection. Require no overlays colliding with essential controls.
- [x] Independently review the finished interface and game-feel integration, then commit verified changes.

## Task 4: Release verification and publication

**Files:** extend meaningful browser coverage in `tests/browser.spec.mjs` as necessary; update `README.md`, `docs/DESIGN.md`, `docs/ROADMAP.md`, `docs/VALIDATION.md`, and screenshots.

- [x] Run `npm test` and `npm run build`; inspect output and fix any regression before continuing.
- [x] Run the three portable browser tests locally with `PLAYWRIGHT_CHROME_PATH` pointing to installed Chrome. Add a check only where a changed lifecycle or interaction needs a regression assertion.
- [x] Capture and compare before/after game frames. Check all six trucks, complete race/rewards/replay, pause, reduced motion, both tablet orientations, blocked storage/audio, and bounded scene resources after repeated truck changes.
- [x] Obtain one independent full-change review of spec compliance and correctness. Address material findings and recheck the affected behavior.
- [x] Update documentation and screenshots to match the actual release, including concrete test evidence and physical-device limits. Push the verified commits to existing main.
- [x] Dispatch `.github/workflows/pages.yml` using the saved GitHub credential helper, wait for the build and deploy jobs to succeed, and verify the public asset hash.
- [x] Set `PLAYWRIGHT_BASE_URL=https://yanivalfasykeelusa.github.io/james-monster-skyway/` and run the browser suite against the public game. Inspect the public screenshots, record the deployment and evidence, and verify the worktree is clean.
- [x] Mark the active goal complete only after the tested visual upgrade is actually live. Report the playable link and material limitations succinctly.
