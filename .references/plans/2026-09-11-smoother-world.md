# Smoother World Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development. Continue on main, with scratch files in .tmp. The parent has authorized execution and the established publication workflow.

**Goal:** Deliver smoother, more detailed graphics and flowing fire while making every car crush beneficial.

**Architecture:** Refine existing Three.js model/world factories and the owned exhaust controller. Add a bounded positive crush burst to the pure race rules; integrate feedback and retain actual-distance racing, safe passing and save compatibility.

**Tech Stack:** JavaScript modules, Three.js 0.186, Vite, Node tests and Playwright Chrome/WebKit.

**Spec:** docs/DESIGN-SMOOTHER-WORLD.md

## Global constraints

No branches/worktrees, new dependencies or external runtime assets. Preserve save version 1, all six unlocks, touchscreen/keyboard play, guided jumps/loop and first-place no-input completion. Keep pauses fully frozen and gentler motion steady. Target real tested full-scene views below 700 calls/550,000 triangles. Root integrates, reviews, commits and publishes; independent implementation tasks own disjoint files.

## 1. Flowing exhaust

Files: src/flames.mjs; tests/flames.test.mjs. Keep ExhaustFlames constructor/update/clear/dispose, mesh and bounded particles contracts. Renderer integration changes require coordination with root.

- [ ] Implement soft-edged layered hot-core/amber/cooling-tip exhaust with continuous-looking motion, fixed buffers and few draw calls; turbo length/strength responds to race.turboTime and speed.
- [ ] Extend tests for paused shader state, gentler motion, attachment through scaling/guardian/loop, resource reuse and disposal; preserve meaningful current tests.
- [ ] Inspect actual near/regular/boost fire in landscape/portrait and WebKit; report visuals and resource costs for independent review.

## 2. Rounded, detailed trucks

Files: src/models.mjs; tests/models.test.mjs. Preserve makeTruck/disposeTruck, spec, body/wheels/steer/arm/wing/exhaust anchors and physical envelope.

- [ ] Refine near-camera body/wheel silhouettes, smooth normals, materials and restrained detail across six models; keep original identity and guardian articulation.
- [ ] Verify finite geometry, articulation, owned-resource disposal and clearance with existing model/world/buddy tests; add targeted assertions only for material or geometric risks introduced.
- [ ] Inspect all six designs and the largest guardian, measure rendering cost, and report. Root regenerates portraits after model acceptance.

## 3. Organic scenery

Files: src/world.mjs, src/adventure.mjs; tests/world.test.mjs, tests/adventure.test.mjs. No track path or shared model edits.

- [ ] Replace dominant cone-tree silhouettes with rounded crowns and soften rocks/vegetation, preserving batching and the clearing map.
- [ ] Improve landmark surface/detail where it contributes to realism; preserve road/loop/gate sightlines and original scenery resource ownership.
- [ ] Run actual vertex clearance and scene budget tests; inspect moving-camera views in both tablet orientations and report measured costs.

## 4. Rewarding crushing and integration

Root owns src/core.mjs, src/main.mjs, src/audio.mjs, src/scene.mjs if needed; tests/core.test.mjs, tests/buddies.test.mjs, tests/browser.spec.mjs.

- [ ] Write a regression asserting a centered crush rewards once and never lowers speed below RACE_SPEED; observe failure on existing code.
- [ ] Replace slowdown with crushBoostTime up to 1 second, 1.18x speed, preserving stronger 2.4-second turbo and 35 charge/two-star reward. Reset/pause all transient state.
- [ ] Use bounded authored opponent approach windows before car rows; retain real rank, continuous pace and late-merge protection. Cover a crush improving the lead and all six full-course input patterns.
- [ ] Add positive gold burst/chime/callout; update diagnostics and browser checks for beneficial crushing, visible flattening, manual/touch turbo, pause and first-place save/replay.
- [ ] Integrate art, regenerate six portraits, play through actual browser controls and review screenshots. Run complete units/build, Chrome/WebKit, layout and resource checks. Independent code/visual review must close material findings before release.

## 5. Publish and document

- [ ] Update README/design/roadmap/validation to describe the new positive-crush behavior and smoother art with actual evidence; commit/push on main.
- [ ] Dispatch Pages, verify runtime head and asset hashes, run all public Chrome/WebKit tests and inspect public screenshots.
- [ ] Refresh screenshots, record final review/deployment evidence, finish this checklist and push clean documentation. Report the playable result and real-device limit.
