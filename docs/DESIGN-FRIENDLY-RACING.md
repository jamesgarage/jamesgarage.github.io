# Friendly racing: an easy win in a richer world

## The brief

The parent wants the visual appeal of M2H's racing games with a guided, forgiving experience for a three-year-old. James likes winning, seeing other racers behind him, big trucks and upward progression. He should be able to reach the end by driving straight. Crash Drive is a visual reference; James has not played that game and its open driving would be too difficult. Hot Wheels-style racing and Sneaky Sasquatch suggest colorful settings and character, not a request for all their mechanics. The exact Hot Wheels title and current play device remain unconfirmed.

This iteration keeps the current guided course and adds two friendly computer-controlled racers, a readable leading position, richer trackside scenes and a celebratory first-place finish. Automatic acceleration, ramps, loop guidance, stars, robot transformation, flames, controls and existing saves remain intact. Difficulty does not increase after a win. Puzzle/construction play belongs to the later excavator game; an optional toy popper can be evaluated in a later racing iteration.

## Design and engine decision

Three options were considered: continue the guided racer, add free driving, or rewrite in a native engine. The user's clarification strongly favors the guided racer. Retain Three.js for this increment: it already renders the desired trucks, track and both touch/keyboard interfaces. Changing languages alone would not supply better art or game feel. Unity or Godot remain candidates if measured device limits, scene-authoring needs or richer physical interactions justify a migration; Swift/RealityKit would be an Apple-focused direction. Before any rewrite, compare one truck, one ramp and one landing in the candidate engine.

Primary design references: [M2H Crash Drive 3](https://www.m2h.nl/games/crash-drive-3/) for visual world/vehicle presence, [Hot Wheels Unlimited](https://budgestudios.com/en/apps/detail/hot-wheels-unlimited/) for toy-track presentation, [Monster Truck Go](https://yateland.com/apps/monster-truck-go/) for simple young-child racing controls, and [Sneaky Sasquatch](https://rac7.com/SneakySasquatch/index.html) for recognizable playful scenery. These inform original work, not branded replicas or claims about James's abilities.

## Friendly racers

Two smaller, brightly colored original trucks follow the same track, clearly behind the player. They do not collide, steal stars, block controls or cause a failure. Their deterministic progress follows the player's distance with positive gaps; the first-place display is derived from those positions. They jump at ramps and follow the complete loop. The player remains the visual hero at every truck scale. A modest camera adjustment shows the small field without requiring camera input; gentler motion remains honored.

`src/buddies.mjs` exports `sampleRaceBuddies(race)` returning two `{id,name,distance,lane,height,velocityY}` poses, `racePlace(race)` derived from progress, and `RaceBuddies`. The class creates two `makeTruck` models once, owns their disposal, exposes `trucks` and `poses`, and provides `update(dt,race,visible=true)`, `reset()` and `dispose()`. Constructor accepts the parent Three.js scene. Bodies use distinct warm-yellow and aqua palettes at about .45-.55 scale (the trailing camera perspective magnifies them, so they stay smaller than the player on screen). Use existing high-quality models initially and verify the frame budget before introducing model complexity. Pause and reset must freeze/clear buddy animation predictably. No changes to core simulation or race rewards.

## Track and presentation

`src/festival.mjs` exports `createRaceFestival()` returning one statically batched Three.js Group. Add a cheerful starting paddock, trackside stands/crowds, original flags/signage, landmark details in the three zones, and a substantial finish venue. Preserve the visible center of the road, landings and the loop overview. Uprights, scenery and grandstands remain at least 12 units from road center; any overhead geometry must clear a jumping transformed Titan by using at least 17 units of local height. Keep the loop corridor untouched. Use original procedural materials/geometry and local canvas signage, no external runtime assets.

The HUD shows a clear first-place badge with a trophy/flag icon and a small indication of the three-truck race. Avoid extra input requirements. The finish dialog features the selected actual truck portrait, a first-place trophy, earned stars and the existing unlock/replay actions. Preserve accessible control names and every existing tested DOM ID. Keep the familiar menu hierarchy and usable desktop, tablet and phone layouts. Optional roster graphics can use existing local portraits, with no additional renderer.

## Mud and a gentle shower

The parent also requests mud and rain. `src/weather.mjs` exports `RaceWeather` with constructor `(scene)`, `update(dt,{race,truck,mode,reducedMotion})`, `reset()` and `dispose()`. It owns a few shallow, irregular mud patches sampled to the existing road frame, a short gentle rain zone in Gator Bay (approximately distance1190–1470), and bounded tire-spray particles while crossing mud. Patches must not protrude into the road or intersect ramps/loop; these effects do not alter grip, speed, controls or win conditions. Rain fades at zone edges, stays visually light, and uses fixed reusable buffers/pools rather than per-frame allocation. Paused updates preserve every effect matrix/buffer; menu hides effects; reset clears old spray before teleporting. Gentler motion retains the scenery/mud but suppresses moving rain and spray. The controller exposes `rain` and `spray` render objects for inspection and must fit the overall rendering budget.

## Acceptance

- Full unattended races finish first with six ramps, one loop, automatic transformation, stars and the existing rewards/save/replay behavior.
- The two racers are visibly behind in representative driving and loop frames. Their positions and pose matrices are finite; they never determine the player's physics or rewards.
- Unit tests cover buddy ordering through the full course, ramp/loop behavior, pause/reset/disposal and finite world geometry with a bounded static scene budget. Reuse existing core tests.
- Browser tests verify the leading badge, first-place finish, selected-truck portrait, existing controls/fallbacks and complete races in Chrome/WebKit.
- Inspect all six player scales, scene visibility, no control overlaps at 1440×900, 1024×768, 768×1024 and 390×844, and stable GPU resources over repeated races/selections.
- Preserve one renderer and bounded effects. Aim for fewer than 700 calls and 550k triangles in tested full-field views; actual iPad frame pacing is a separate measured follow-up, not established by emulation.
- Use independent code/visual review before publishing through the existing GitHub Pages workflow; repeat browser checks against the public URL and record evidence.
- Next observations with James: does he recognize he is ahead, notice the other trucks and scenery, reach the finish comfortably, and choose to replay? Save construction/puzzle observations for a separate sand-play prototype.
