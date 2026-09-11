# Monster Skyway roadmap

## Shipped: v0.1 guided race

The first playable release is published at [Monster Skyway](https://yanivalfasykeelusa.github.io/james-monster-skyway/).

- A 1,900-unit course with broad curves, six ramps, and a guided vertical loop.
- Automatic acceleration, forgiving jumps and landings, large touch controls, and optional keyboard or touch steering.
- An original robot guardian transformation, including automatic activation for younger drivers.
- Six increasingly large trucks, star rewards, saved unlocks, and a finish celebration after every run.
- Twin exhaust flames and a bounded fiery trail, scaled with truck size and guardian mode.
- Original synthesized sound, mute, pause, gentler motion, and recovery when storage or audio is unavailable.
- A standalone static build, local play launcher, and manually triggered GitHub Pages publication.

## Completed quality pass

- Six detailed, sculpted truck designs with distinct silhouettes, rounded panels, treaded tires, mechanical details, and articulated guardian parts.
- A dimensional orange toy track with raised edges, seams, supports, arrows, gates, and a fully supported loop.
- Richer Bear Woods, a Sky Loop stunt festival, and Gator Bay with water, islands, palms, and friendly spectators.
- Warm sunlight, sky lighting, material reflections, cast shadows, and a soft shadow beneath the truck.
- A live lobby featuring the selected truck, collectible garage cards with portraits rendered from the actual models, and a destination-aware race display.
- Steering lean and front-wheel movement, suspension bob, landing compression and effects, and a closer chase camera with an upright loop overview.
- Separate model, track, and world modules; geometry batching, resource cleanup, and bounded effects.

The established race rules, rewards, saved progress, and exhaust behavior remain compatible. See [the validation record](VALIDATION.md) for recorded test, layout, build, and deployment results.

## Friendly racing update

James's parent reports that he loves the existing game and wants the visual appeal of games such as Crash Drive and Hot Wheels with easy driving and rewarding wins. Crash Drive is a visual reference, not a game James has played or a request for its difficulty.

- Two smaller trucks, Sunny and Splash, follow behind through the ramps and loop. They never collide with the player, take stars, or affect race rewards.
- A readable first-place badge and a finish celebration featuring the selected truck's actual portrait.
- Starting and finish stands, a woodland picnic stop and windmill, an observatory and balloons, and seaside landmarks around Gator Bay.
- Shallow mud with tire spray and a short, gentle rain zone. These are cosmetic: traction, speed, controls, and win conditions stay the same. Gentler motion suppresses moving rain and spray.
- Corrected left/right steering relative to the chase camera, shared by touch and keyboard controls and collectible placement.
- The same guided course, automatic acceleration, no-input completion, positive rewards, saved garage, and replay behavior. Wins do not increase difficulty.

See [the friendly racing brief](DESIGN-FRIENDLY-RACING.md) for scope, primary visual references, and acceptance criteria. Validation and publication evidence belong in the [validation record](VALIDATION.md).

## Turbo adventure and toy-car crushing

James's parent asked for more distinctive scenery, a dynamic road, racers who catch up, turbo, and crushable cars. The earlier permanently trailing field is now a gentle race with actual passing and comeback opportunities.

- Six small parked toy cars squash under the wheels, awarding two stars and turbo charge. Normal crushing briefly slows the player; powered crushing keeps moving.
- A large Turbo control, B/Shift keyboard binding, eight-second recharge, and five automatic boost strips. Exhaust and engine pitch respond to speed.
- Stateful Sunny and Splash can briefly overtake, ease their pace for a comeback, and leave the player able to finish first without input. Position is calculated from actual distances.
- Buddies yield before tight passes; gentle steering assistance maintains room when a driver turns toward a truck already alongside, including the largest guardian.
- Three authored road moments: a smooth raised timber bridge and waterwheel, a rocket launch area with runway markings, and a waterfall/boardwalk in Gator Bay.
- Existing unlock thresholds, saved garage, automatic jumps/loop, pause and gentler motion remain compatible.

See [the turbo adventure brief](DESIGN-TURBO-ADVENTURE.md) and [validation record](VALIDATION.md) for the current behavior and measured release evidence.

## Smoother world and rewarding crushing

James's parent asked for less pointy graphics, more realism and detail, more natural flames, and crushing that feels entirely beneficial. This supersedes the preceding release's crush slowdown.

- Rounded woodland crowns, branching trunks, softer terrain silhouettes and curved palm fronds replace prominent angular foliage.
- Refined truck body and wheel silhouettes, glossier paint/glass, contrasting rubber and metal, and small mechanical details retain the six original identities.
- Procedural soft-edged exhaust with a pale hot core and flowing amber/cooling edges replaces the geometric flame beads. The fixed pool, pause and gentler-motion behavior remain bounded.
- Crushing now awards two stars, turbo charge and a one-second speed burst. It never reduces forward speed; stronger turbo takes priority without stacking multipliers.
- Friends approach through their own continuous pace during selected stretches. Sunny can briefly lead; Splash stays behind during ordinary cruising. Gentle steering assistance and no-input first-place completion remain.

See [the smoother world brief](DESIGN-SMOOTHER-WORLD.md) for scope and [validation](VALIDATION.md) for measured results. Continue checking the actual chase view, not only model close-ups.

## Four friends and working landmarks

Four friendly trucks now race with the player. Sunny and Splash are regulars; two guests rotate through all six pairings of Ember, Pebble, Bolt and Digger. Each keeps its own appearance, preference and reaction timing. A shared limit of two visible reactions and short audio spacing keeps the group readable. Dedicated companion models provide six original designs at under 8,600 triangles each.

The chase view includes the larger group while retaining a visible horizon. Position and accessible labels describe all five trucks. The bridge waterwheel and woodland windmill turn gently; pause and gentler motion freeze them. See the [growing crew](DESIGN-GROWING-CREW.md) and [working landmarks](DESIGN-WORKING-LANDMARKS.md) designs.

## Lagoon shores and visible crush rewards

Irregular sandy banks replace the repeated sphere islands. Softer contours and shaded slopes meet the water while keeping palms and gator feet grounded, with fewer total triangles and the same material/mesh counts. Two gold stars rise from an actually crushed toy, making the existing reward visible without reading. The cue uses one fixed instanced batch and suppresses its extra motion in gentler mode. Tablet orientation changes are included in browser regression checks.

See [lagoon shore design](DESIGN-LAGOON-SHORES.md) and [crush-star design](DESIGN-CRUSH-STARS.md). The following performance increment will batch the existing dust/confetti particles to reduce submitted draws; it introduces no new game rules.

## Next: physical device and child observations

The playful-world increment gives Sunny and Splash independent local decision state: staggered greetings, delayed safe jump imitation, bounded celebrations and different preferences for racing or puddles. Completed races vary reaction timing and incidental world accents. Original material tiles add grass, timber, stone and water detail; small butterflies, moving cattails and ripples add life around the unchanged route. See [the design](DESIGN-PLAYFUL-WORLD.md) and [primary-source engine/game research](RESEARCH-PLAYFUL-WORLD.md).

1. Play on a real iPad in Safari and a representative phone, in portrait and landscape. Check touch controls, orientation changes, frame pacing, and camera comfort.
2. Watch James squash a toy car, recognize the reward and speed burst, use turbo, finish, choose an earned truck, and replay. Notice whether he recognizes the friends' smiles, jump imitation and cheering; tune their timing and visibility from his reaction. Revise anything that requires adult explanation.
3. Check that the richer scenery and weather feel exciting without hiding the route or making the controls harder to understand.
4. Tune collectible placement, reward pacing, sound, motion, and rendering cost using those observations.

The parent has shared enthusiastic feedback from James, but his play device is unconfirmed. Physical iPad/Safari testing and focused observations of this update remain follow-up work. Playwright's Chromium and WebKit engines with emulated touch are useful engineering checks, but do not replace those observations.

## Engine direction

Continue with Three.js for the guided racer. This update's needs are visual presentation, accessible controls, and scenery; a language change alone would not deliver them. Reconsider Unity or Godot if measured device limits, scene-authoring needs, or richer physical interactions justify a migration. Swift/RealityKit remains an Apple-focused option.

Before a rewrite, compare one truck, one ramp, and one landing on a real target device. Keep the current playable game available while evaluating that small prototype. The [game and engine research](RESEARCH-PLAYFUL-WORLD.md) records the current comparison and primary sources, including verified Unity/Unreal references and the distinction between native and browser renderers.

## Distinct forms and rendering polish

The garage now adds Rescue Roarer, a full fire engine, and Shark Surge, a complete shark body, while keeping every previous truck and saved selection. Mega Titan exposes rear coilovers that shorten on landing and more of its existing tires. Nearby crowns and distant hills are smoother, and celebration particles share one draw. The [iOS visual study](RESEARCH-IOS-KIDS-RACING.md) compares relevant 3D and side-view references without treating broad App Store chart positions as a toddler suitability ranking.

A private rear-oblique camera experiment improves vehicle readability and portrait convoy framing using the existing renderer. Its full-course review still finds gate and loop obstruction, plus active-camera billboard and control work. Retain the current guided 3D view and use those findings for a later small playable camera comparison.

## Deferred: playful racing additions

- An optional toy popper for James's interest in “pew pew,” keeping the course easy to complete and rewards positive.
- Further flame polish using the family's Snake Chrome extension as a visual reference when it is available from the other computer. It is not required for this update.

## Deferred: free-driving playground

The current priority is a guided race that looks exciting and is easy to win. A true free-driving toy playground needs its own vehicle movement, camera, boundaries, ramps, and recovery behavior. Evaluate it later as a separate mode only if play feedback supports it.

A later Snake-inspired mode could grow a colorful flame tail as the driver collects stars, with roomy turns and gentle recovery when trails cross.

## Deferred: construction adventure for iPad

A separate touch-first construction playground could offer excavators, dump trucks, loaders, diggable piles, and simple delivery activities. Large gestures could scoop material, fill a truck, drive to a marked area, and tip the load.

Begin with one satisfying excavator-and-dump-truck activity and expand after observing real play. Save possible Lego-like building, matching, memory, and simple delivery puzzles for this adventure. Its different controls and physics should remain separate from the guided monster truck race.

## Deferred: offline installation and more destinations

- An installable offline edition after cache, update, and recovery behavior have been tested. This release has no offline service worker.
- Additional course themes and activities informed by play feedback.
- Further grown-up settings if observation identifies a clear need.

## Public project principles

- Keep the game playable without accounts, advertising, or external runtime services.
- Keep earned progress positive and preserve play when storage or audio is unavailable.
- Use original characters and vehicle designs with clear licensing for contributed assets.
- Share concrete implementation notes and measured validation of the AI-assisted development process.
