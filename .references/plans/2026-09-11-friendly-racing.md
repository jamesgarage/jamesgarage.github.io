# Friendly racing implementation plan

Spec: `docs/DESIGN-FRIENDLY-RACING.md`. Baseline `f2c8cc2`. Existing main branch, `.tmp` scratch, same published URL and save schema. User explicitly prefers easy guided winning and richer visuals; no free-driving mode or engine migration in this increment.

## 1. Friendly field

- [x] Add `src/buddies.mjs` with deterministic trailing poses, ramp/loop animation, position calculation and two reusable/disposable truck models.
- [x] Add meaningful tests for full-course ordering, finite poses, pause/reset and ownership; review and fix material findings.

## 2. Race venues

- [x] Add `src/festival.mjs`: starting paddock, stands, original trackside landmarks and finish venue in compatible batched geometry.
- [x] Verify geometry budget, clearance and visual visibility in the actual shared course; independently review.
- [x] Add shared-road mud patches, a gentle bay rain section and bounded tire spray in `src/weather.mjs`, with pause/reset/reduced-motion/lifetime checks.

## 3. Integration and victory

- [x] Integrate the field and venues with the existing renderer and tune framing without adding controls.
- [x] Add position HUD and first-place result with the chosen truck portrait; preserve unlock/save/replay, focus, pause and fallback behavior.
- [x] Inspect all six trucks and desktop/tablet/phone layouts; obtain independent full-change review.

## 4. Release

- [x] Run units/build and complete Chrome/WebKit browser suites, including new position/victory assertions.
- [x] Update README, roadmap, engine decision, parent-feedback notes and validation with observed results.
- [ ] Commit/push, deploy the existing manual workflow, verify assets and repeat public browser tests/screenshots.
- [ ] Record the result and next observations for James.
