# Robot and canyon adventure implementation plan

**Goal:** Give James selectable races, an immediately usable giant robot with guided flight, real canyon jumps and more rewarding smash targets.
**Architecture:** Share the existing track sampler and separate immutable course data from mutable race rules. A cached canyon scene and bounded object/robot controllers consume those rules. Course windows make the familiar destinations playable races.
**Stack:** Existing Three.js, JavaScript, Vite, Node tests and Playwright; no new runtime dependencies.
**Spec:** `docs/DESIGN-ROBOT-CANYONS.md`.

## Constraints

Preserve all eight trucks, unlock thresholds and version-1 saves. Automatic driving and guided first-place completion remain. Touch, keyboard and browser-standard gamepads use the same actions. Preserve overlay scrolling while preventing game-surface zoom and selection. Freeze motion during pause and respect gentler motion. Main branch only. The parent has explicitly delegated implementation decisions and publication in this ongoing session.

## Tasks

- [x] Rules: implement `getCourse(id)`, `courseProgress(race)`, `createRace(seed, courseId)`, positive one-time smash rewards and serializable flight. Test all five starts/finishes, old-save normalization, immediate/persistent robot toggle, repeated/held input, guaranteed canyon clearance, turbo, loop entry, pause and replay.
- [x] Robot: retain model handles and introduce `poseGuardian` with unmistakable armored legs/boots, chest, helmet and fists. Inspect all eight trucks and check actual articulated bounds, exhaust attachment and resource ownership.
- [x] Canyon: split road geometry at exact gap bounds; build sandstone cliffs, launch/landing pads and distinct scenery. Check actual triangle absence over gaps, finite geometry and shoulders clear of the driving envelope.
- [x] Integration: add track buttons/picker and saved selection; use selected course bounds for progress and finish; integrate robot/Fly labels, bounded smash visuals, alternate scenery and finish marker. Check modal focus, orientation, reset, pause and changing courses repeatedly.
- [x] Inputs: verify controller menu navigation, action edges, disconnect/reconnect and touch multi-contact, zoom, selection and scrolling.
- [x] Review: run units/build and independent rules/geometry review, then controlled browser play and the appropriate Chrome/WebKit regression suites. Inspect the actual player view at canyon launches, flight, landings, loop and finish.
- [ ] Release: commit and publish only the verified result; check the public URL, saves and replay; record validation and screenshots and return the playable link.

## Ownership

Rules agent owns courses/core/encounter data and rule tests. Model agent owns robot model/pose and model tests. Scenery agent owns canyon world, road splitting and geometry tests. Root owns UI, scene integration, smash visuals, final review, documentation and publication. Agents do not commit shared work independently.
