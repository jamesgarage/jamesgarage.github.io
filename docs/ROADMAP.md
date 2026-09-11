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

The established race rules, rewards, saved progress, and exhaust behavior remain compatible. The unit suite now passes 34 tests. See [the validation record](VALIDATION.md) for current browser-engine, layout, build, and deployment results.

## Next: physical device and child observations

1. Play on a real iPad in Safari and a representative phone, in portrait and landscape. Check touch controls, orientation changes, frame pacing, and camera comfort.
2. Watch a young player start, finish, choose an earned truck, and replay. Revise anything that requires adult explanation.
3. Tune collectible placement, reward pacing, sound, motion, and rendering cost using those observations.

Physical iPad/Safari testing and a child playtest remain pending. Playwright's Chromium and WebKit engines with emulated touch are useful engineering checks, but do not replace those observations.

## Deferred: free-driving playground

The current game follows a guided course. A true free-driving toy playground needs its own vehicle movement, camera, boundaries, ramps, and recovery behavior. Build and evaluate it as a separate mode, preserving easy recovery from any position.

A later Snake-inspired mode could grow a colorful flame tail as the driver collects stars, with roomy turns and gentle recovery when trails cross.

## Deferred: construction adventure for iPad

A separate touch-first construction playground could offer excavators, dump trucks, loaders, diggable piles, and simple delivery activities. Large gestures could scoop material, fill a truck, drive to a marked area, and tip the load.

Begin with one satisfying excavator-and-dump-truck activity and expand after observing real play. Its different controls and physics should remain separate from the guided monster truck race.

## Deferred: offline installation and more destinations

- An installable offline edition after cache, update, and recovery behavior have been tested. This release has no offline service worker.
- Additional course themes and activities informed by play feedback.
- Further grown-up settings if observation identifies a clear need.

## Public project principles

- Keep the game playable without accounts, advertising, or external runtime services.
- Keep earned progress positive and preserve play when storage or audio is unavailable.
- Use original characters and vehicle designs with clear licensing for contributed assets.
- Share concrete implementation notes and measured validation of the AI-assisted development process.
