# A bigger crew for James

The parent asked for more than two friendly opponents and continued improvements until approximately 5 p.m. America/New_York on 11 September 2026. Continue autonomously in useful, tested increments and publish accepted work through the existing GitHub Pages workflow. Keep the last verified game available while building.

## First increment: four friends from a six-character cast

Sunny and Splash remain recognizable regulars. Two guests rotate from Ember (a red flame fan), Pebble (a purple rock crawler), Bolt (a silver/electric-accent speed fan), and Digger (a construction-yellow truck). Four opponents race with James, giving a five-truck field. Individual appearance and preference remain stable; completed-race count chooses guests deterministically. No new account, save format or controls.

Centralize immutable character definitions and selection in src/crew.mjs. Export CREW, CREW_SIZE=4 and raceCrew(seed=0), which returns four slot specifications with id/name/color/accent/scale/style/preference plus gap/lane. Keep Sunny first and Splash second; rotate two unique guests without duplicate IDs. Initial slots use gaps 10/14/18/22 and alternating lanes -.65/.65 unless measured spacing work improves that safely. Keep actual continuous positions, guardian clearance and the existing safe passing layer. Only Sunny offers the existing early lead challenge; others leave James room and a no-input run finishes first.

Each character owns local state, greeting/reaction timing and one bounded signal. Generalize preferences by character, not array index. Distinct echo/cheer delays, cooldowns and reactions make the guests recognizable while avoiding four simultaneous sound effects. Existing successful jump/crush/turbo triggers remain; all reactions obey pause, safe stunt windows and cooldowns. Audio mixes at most the two most relevant reactions at once or uses a global short cooldown. Gentler motion stays quiet and steady.

## Rendering cost and framing

Four full player-quality models would unnecessarily multiply scene cost. Add original dedicated companion models in src/buddy-models.mjs. Export makeBuddyTruck(spec) and disposeBuddyTruck(truck). Contract: spec, group, body, four wheels; wheels preserve index orientation (front indices 2/3), rotation about local X, group faces +Z as existing models. Bounds before spec.scale: lateral at most 2.25, longitudinal at most 2.8, height at most 5.0. Keep smooth rounded painted shells, shaped tires and distinctive simple character details. Aim below 10,000 triangles and 30 submitted meshes per model; prefer materially less with batching. Own resources per model; independent/idempotent disposal must not release borrowed meshes.

The renderer keeps only four active models, replacing a changed guest at replay without leaking GPU resources. Signal rendering accepts a dynamic roster and owns fixed resources. Frame the additional friends with a measured chase camera adjustment while retaining James as the largest, most prominent truck. Actual loop/guardian/player steering clearance remains unchanged. Show the true field size in the position UI and accessible label; handle all five ranks correctly.

## Acceptance and later afternoon work

Test deterministic unique selection across seeds, four independent minds, sparse reactions, pause/replay and saved garage compatibility. Run complete races across six player sizes and variants with no input, held controls and late merges; check all friend pairs and actual wheel geometry. Rendering probes cover all six friend appearances, rotating replacement lifecycle, four-truck greetings/jumps, biggest guardian, loop and tablet/phone controls. Target complete actual views below 700 calls / 550,000 triangles; do not claim physical iPad frame rate from desktop emulation.

After a verified crew release, continue with bounded scenery and trackside-life improvements informed by the existing research, then reserve the final portion before 5 p.m. for browser play, visual review, publication and public verification. Later increments get concrete designs once the current result exposes the most useful next change; avoid unfinished speculative systems at the deadline.
