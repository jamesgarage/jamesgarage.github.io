# Turbo Adventure Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development. Continue on main with .tmp scratch files under the user's repository conventions.

**Goal:** Add crush-and-turbo racing and three distinctive scenic road moments while preserving easy completion.

**Architecture:** Shared immutable encounter data feeds pure fixed-step race rules and reusable scene objects. Stateful friendly racers produce honest position changes. The existing Three.js renderer integrates scenery, effects and a touch-first turbo control without changing saved progress.

**Tech Stack:** Existing JavaScript modules, Three.js, Vite, Node tests and Playwright.

**Spec:** docs/DESIGN-TURBO-ADVENTURE.md

## Global constraints

No branches/worktrees or new dependencies. Preserve save version 1 and existing unlocks. Keyboard and touchscreen both work. Every race recovers automatically and can finish first with no driving input. Keep the loop corridor unchanged and tested full-field views under 700 draw calls / 550,000 triangles. Existing authorization covers review, main commits and the established GitHub Pages publication.

## 1. Rules, encounter data and friendly pacing

Files: src/encounters.mjs, src/core.mjs, src/buddies.mjs; tests/core.test.mjs, tests/buddies.test.mjs.

- [x] Define frozen encounter rows from the spec and write failing behavior tests: crossing a centered toy car emits one crush, standing in another lane/jumping avoids it, powered crushing does not slow, manual turbo uses charge and ends, pads work without input.
- [x] Implement transient fields and swept encounter checks in stepRace, with automatic recovery and fixed-step buddy progression. Compare actual distances for racePlace, including a temporary overtake after a slowdown.
- [x] Exercise full races under no input, held turbo/jump, repeated steering and every truck scale; verify first-place finish, six automatic ramps, loop, bounded timers and unchanged rewards/save behavior. Update existing tests only where the new brief changes intended behavior.
- [x] Independently review the rules before release; root commits the integrated verified result.

## 2. Crushable toy cars and road boost pads

Files: src/encounter-scene.mjs; tests/encounter-scene.test.mjs.

- [x] Build one set of six original toy cars from shared CRUSH_CARS and sampled full-width pads from TURBO_PADS. Write tests that squash exactly the flagged car, preserve untouched cars, freeze on dt=0, restore on reset and dispose owned resources once.
- [x] Implement RoadEncounters.update(dt,{race,mode,reducedMotion}), reset and dispose with bounded storage; no per-frame object creation or network assets. Inspect geometry/surface clearance and animation endpoints.
- [x] Review tests and visual evidence; root integrates the controller and verifies real collision-to-animation behavior.

## 3. Three scenic destinations

Files: src/adventure.mjs, src/world.mjs, optional smooth bridge rise in src/track.mjs; tests/adventure.test.mjs and relevant track/world tests.

- [x] Build coordinated bridge, rocket runway and waterfall set pieces in grouped batches. Sample every road treatment from the shared track frame and clear conflicting nearby tree placements.
- [x] If raising the bridge, use a smooth bounded function with zero endpoint slope, e.g. 2.4 * sin(pi * t)^2 over stations310–375, without modifying ramps/loop.
- [x] Test finite geometry, actual roadside clearance, bridge continuity, resource ownership and scene budgets. Inspect landmarks from the real moving chase camera in landscape and portrait.

## 4. Controls, feedback and full integration

Files: src/main.mjs, src/scene.mjs, src/flames.mjs, src/audio.mjs, index.html, src/style.css; tests/browser.spec.mjs and relevant lifecycle tests.

- [x] Add a flame-icon Turbo button and B/Shift binding with charge indication; adapt compact layouts to retain accessible Jump/steering/transform controls. Clear one-shot turbo input on pause/menu and consume it once per fixed step.
- [x] Integrate RoadEncounters and scenery in the single renderer; pass selected truck scale to race state, speed to engine/wheels, turbo to flames, and crush/turbo events to brief celebratory feedback. Preserve gentler motion.
- [x] Add browser coverage for keyboard and touch turbo, visible crush/rank recovery, new controls, full no-input win/save/replay and existing steering regression. Inspect all player scales and five viewport sizes.
- [x] Independently review integration and run final units/build, resource/pause probes and complete Chrome/WebKit browser suites.

## 5. Publish and document

- [ ] Update README/roadmap and validation with actual outcomes and the new user feedback. Commit and push the tested runtime on main.
- [ ] Dispatch the existing Pages workflow, verify published hashes, run both public browser suites and inspect refreshed screenshots.
- [ ] Record release evidence, complete this checklist, push documentation and report the playable result and remaining real-device observations.
