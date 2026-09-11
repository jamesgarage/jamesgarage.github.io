# Playful World Implementation Plan

> Use superpowers:subagent-driven-development with independent file ownership and root integration/review. Work on main, scratch files in .tmp. The parent has authorized execution and the established publication workflow.

**Goal:** Make the two friendly opponents responsive and varied, and enrich scenery materials and ambient life without making driving harder.

**Architecture:** Seeded local buddy brains request intent; the existing movement/clearance rules enforce it. Scene rendering shows bounded signals. Original procedural materials and owned ambient resources enrich the same Three.js course.

**Tech Stack:** JavaScript, Three.js 0.186, Vite, Node tests, Playwright Chrome/WebKit.

**Spec:** docs/DESIGN-PLAYFUL-WORLD.md

## Global constraints

Preserve save version 1, all six thresholds, assisted driving/jumps/loop, positive crushing/turbo and first-place unattended finishes. Keep every effect bounded, paused state frozen, gentler motion steady and roads clear. No new dependencies, external runtime assets, branches or worktrees. Research claims require primary sources. Root commits/publishes after checks and review.

## Tasks

- [x] Research comparable games, confirmed engines and primary rendering/steering guidance; write docs/RESEARCH-PLAYFUL-WORLD.md with actionable recommendations and sources.
- [x] Implement buddy decisions in src/core.mjs and optional src/buddy-brain.mjs; tests/core.test.mjs and new tests/buddy-brain.test.mjs. createRace(seed=0), state fields/signals and events follow the spec. Preserve current movement safety. Test reactions, deterministic race variety, cooldowns, pause and six-truck full races across variants.
- [x] Enrich world/adventure materials and implement src/world-life.mjs plus focused geometry/resource tests. update(dt,{race,reducedMotion,mode}), reset(variant=0), dispose() keep ownership explicit. Inspect scenery in moving-camera views and report resource cost.
- [x] Root integrates seeded starts, renderer signals/steering in src/buddies.mjs, optional quiet buddy audio in src/audio.mjs, scene world-life hooks and diagnostics. Add meaningful renderer and browser regressions for actual visible reactions, pause and varied replay; use large existing controls.
- [x] Run all units/build, controlled browser play, both full browser engines, viewport and resource checks. Obtain independent code/visual review; resolve findings.
- [ ] Update README/roadmap/assets/validation, publish main through Pages, verify head/assets, run public browser suites, refresh screenshots and document remaining physical-device checks.

## Review ledger

Ruling: Keep Three.js and use local deterministic brains. The requested behaviors need responsive movement and richer content; an engine migration or network-agent service adds risk without solving the current gaps.

Buddy review: fixed blank pictograms caused by opaque material ordering using explicit layer order; reduced badge size and verified real greeting/jump screenshots. Fixed reply sounds omitted from audio allowlist with an observed failing audible-event regression, then six passing audio tests. Independent follow-up closed both findings. Texture review identified stretched vertical waterfall UVs and per-vertex projection seams; stable per-piece water and per-triangle solid mapping resolved them. Independent re-probe of 83,752 textured triangles closed the finding. Final 113 unit tests/build passed; controlled play, lifecycle and 24 scenery views are recorded in docs/VALIDATION.md.

Final production acceptance: seven browser tests passed in Chrome (1.9 minutes) and WebKit (2.3 minutes) after all source corrections, with no runtime/resource errors. Four layout captures passed. Final integration review has no open material findings. Production assets: index-DTXNLMLw.js / index-L73CJAqG.css.
