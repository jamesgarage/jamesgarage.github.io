# Turbo adventure and toy-car crushing

James's parent asks for richer scenery, a more varied road, racers who catch up when the player slows, turbo, and crushable cars that help him pass. This supersedes the first release's permanently trailing field. Keep the guided, forgiving race: no lives, damage, lost stars, restart requirement or permanent stop. Existing saved trucks remain compatible.

## Play rhythm

Place six small, brightly colored, visibly unoccupied toy cars on ordinary road sections. Driving into one squashes its body and splays the wheels, awards two bonus stars and recharges turbo. A normal crush briefly slows the truck (about .65 seconds, then automatic recovery); jumping clears it, while active turbo crushes through without slowing. A car reacts once per race and resets for replay. A short friendly callout celebrates the squash.

Add a large flame-icon TURBO button, with B or Shift on keyboard. Start with a full charge. One tap uses a roughly 2.4-second burst at about 1.55 times cruising speed; charge replenishes in eight seconds and crushes add charge. Repeated input cannot stack bursts or make them endless. Full-width, clearly marked boost strips trigger automatic turbo in selected stretches, so a child who never presses a button still experiences it. Boost extends the existing exhaust and raises engine pitch without aggressive camera shake. Gentler motion suppresses extra camera effects and moving trails as before.

Sunny and Splash now advance in the fixed-step simulation. Their actual distances determine place. They can catch up and briefly pass during a crush, then the player's normal pace and turbo allow a comfortable comeback. Bound the friendly pace so no-input play and even repeated button presses/steering finish first; do not simply hardcode the finish rank. Close passes use outside lanes and the smaller models to keep the player readable. No opponent collision penalties. The last crush is well before the finish and the final boost strip helps secure a clear lead.

## Shared contracts

`src/encounters.mjs` contains immutable CRUSH_CARS entries `{id,distance,lane,color}` at stations 110 (center), 300 (left), 500 (center), 1185 (center), 1385 (right), 1640 (center). Left/right lanes are -.75/+.75. TURBO_PADS entries `{id,distance,length}` are centered at stations 355, 635, 1148, 1460 and 1800, with length 12. No crush or pad inside the guided loop. These definitions are shared by simulation and graphics.

The core retains existing exports and adds transient race fields `speed`, `truckScale` (default 1), `turboEnergy`, `turboTime`, `bumpTime`, `crushes`, `crushedCars` (IDs), and `buddies` (two stateful poses with id/name/distance/lane/height/velocityY). `stepRace` accepts `inputs.turbo` and emits `{type:'turbo',source:'manual'|'pad'}` and `{type:'crush',id,powered}` alongside existing events. Paused/finished races ignore every input and freeze timers/AI. Fast frames must not skip encounters or ramps. `sampleRaceBuddies(race)` returns defensive pose copies and `racePlace(race)` compares actual distances; preserve sensible distance-only fallback for isolated scene probes.

`src/encounter-scene.mjs` exports `RoadEncounters(scene)` with `update(dt,{race,mode,reducedMotion})`, `reset()` and `dispose()`. It constructs the cars and pads once, exposes `cars` and `pads`, animates flattened models from `race.crushedCars`, and owns its resources. Cars are around 2.1 units wide, 3.3 long and 1.1 high, with four visible wheels, friendly paint, and no people. Pads conform to sampleTrack and laneOffset; keep the existing rail corridor clear. Effects and reset must work with any player truck scale, pause, menu and gentler motion.

## Authored scenery and road

Three substantial original set pieces replace repetition in selected stretches: Bear Creek Bridge (310–375), Rocket Runway (620–725), and Gator Falls (1330–1440). Coordinate road appearance and trackside landmarks: timber bridge panels and a waterwheel, a cream/coral rocket and runway markings, and a broad rock waterfall with reeds and a boardwalk. Clear conflicting procedural trees around their footprints. Keep the loop corridor 800–1040 unchanged. A smooth low bridge rise may update the shared track center so the road and every actor remain aligned.

`src/adventure.mjs` exports `createAdventureScenery()` returning one grouped, statically batched Object3D. Own all generated resources; no runtime downloads. New scenery aims for at most 60 batches and 30,000 triangles. Solid roadside structures remain at least 12 units from center; anything over the road must clear the maximum jumping transformed Titan (at least 17 local units). Inspect actual camera views and geometry, including portrait, rather than relying only on center-point placement.

## Interface and acceptance

Keep Jump and Turbo easy to reach together on touchscreens. Retain transformation as a smaller secondary control where necessary; it remains automatic too. Preserve accessible button names and existing tested IDs. The existing first-place display must update truthfully during passing and finish still celebrates earned progress. Saved progress schema, garage selection and thresholds remain unchanged.

Tests cover crush contact versus jump/other lane, powered crushing, bounded turbo/recharge/pads, realistic rank changes and comeback, all six trucks, complete no-input and input-heavy races, pause/reset and replay. Browser runs exercise actual keyboard/pointer controls, visible crush and boost effects, finish/rank/save, storage/audio fallbacks and desktop/tablet/phone layouts. Recheck the reversed-steering regression. Require independent code/visual review, bounded resources, build and complete Chrome/WebKit runs locally and on the existing public deployment. Keep tested full-field views below 700 calls and 550,000 triangles; physical iPad performance remains a separate observation.
