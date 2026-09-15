# James's Garage publication plan

> For agentic workers: use superpowers:subagent-driven-development and verification-before-completion. Work on main in the existing checkout.

**Goal:** Publish the game and family story at https://jamesgarage.github.io/ with a safe way to bring the old browser's garage.

**Architecture:** The parent created the free jamesgarage organization and has active admin membership (verified 2026-09-15). Create a public repository jamesgarage/jamesgarage.github.io, retain source history, and deploy with the existing Pages workflow. Preserve the former repository and playable address during migration. The organization repository becomes the canonical source and feedback destination.

**Tech stack:** Existing Three.js / Vite browser game, GitHub Pages, localStorage. No new runtime dependencies.

**Spec:** User selected jamesgarage.github.io, created the organization, and requested repository/site setup. Existing progress and iPad play must survive the change of origin. The family story and MIT license remain intact.

## Task 1: Explicit garage transfer

Files: new src/garage-transfer.mjs, focused unit/browser tests, integration in src/main.mjs, index.html, src/style.css.

- [x] Add a parent-settings button on the former site opening exactly https://jamesgarage.github.io/ with a bounded encoded versioned save in the URL fragment. Never use a user-provided destination or delete the source save.
- [x] At the destination offer explicit confirmation, validate through the existing progress schema, and merge stars/races/challenge wins with maximum values (never add or reduce them). Preserve unlocked trucks and source truck/preferences when valid.
- [x] Clear the fragment after successful storage or cancellation. Invalid/oversized data leaves progress intact; storage failure reports unsaved progress and allows retry.
- [x] Verify source-to-destination navigation, import, reimport without duplicate rewards, stronger existing garage, malformed data, blocked storage, keyboard/touch reachability, and game start in Chromium and WebKit.

## Task 2: Organization source and Pages

Files: README.md, CONTRIBUTING.md, public/about.html, src/feedback.mjs; existing Pages workflow and Vite relative base.

- [x] Update current play/source/feedback links to the new organization. Keep historical validation evidence. Add brief parent transfer instructions.
- [x] Run unit tests, production build, focused browser/controller checks, and independent review.
- [x] Create public organization repository, push reviewed history, configure Pages build_type workflow, create feedback label, and dispatch workflow.
- [x] Verify new HTTPS root, story, assets, links and live gameplay before publishing the transfer entry point on the former site.
- [x] Publish the tested transfer build on the former site without removing its save/page. Switch local origin to organization, retaining old remote as legacy.
- [x] Record commit/run IDs and verification, and give parent the play address and one-time iPad transfer instructions.

## Execution record

- 2026-09-15: Organization active; parent is admin; target repository absent. Existing Pages uses workflow builds. No paid services needed.

- Link/publication commit: 6dab83d. Independent publication preflight found no material issues; MIT/Three licenses and complete source history preserved. Both repositories have no issues to migrate. Initial organization Pages workflow 35014950730 succeeded. The auto-created legacy Pages build was cancelled and its configuration replaced with workflow publishing.
- Transfer review found a recoverable-storage edge case: startup could not read an existing destination save, then import could overwrite it after access returned. The implementation now rereads the destination immediately before import and max-merges stored, in-memory, and transferred counters. A focused regression covers read failure at boot and successful retry. Scoped independent re-review is clean.

- Complete: new runtime run 35015771628 and legacy run 35015982861 succeeded. Real two-origin transfer plus full race passed in Chrome and WebKit, as did targeted controller cases. Source save and higher destination counters survived; imported progress persisted after reload. Details and physical-device limits are recorded in docs/VALIDATION.md. Canonical local remote is now origin=jamesgarage/jamesgarage.github.io, with legacy retained.
