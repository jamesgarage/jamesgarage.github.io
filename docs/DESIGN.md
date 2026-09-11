# A little driver's big adventure

Monster Skyway began with a parent's wish: make a real-feeling game around the things a three-year-old already loves. Monster trucks of every size, orange looping toy tracks, angular silver pickups, bears, alligators, and transforming robots shaped the design. Construction vehicles belong on the roadmap as a separate future playground.

## The playable loop

Pick a truck, press Play, and take a roughly 73-second trip through Bear Woods, the Sky Loop, and Gator Bay. Driving and ramp jumps happen automatically. The player can steer toward stars, tap to hop, and activate a charged guardian transformation. Every finish grants 12 stars plus collected bonuses. Earned trucks stay unlocked; the first race always earns the second truck.

The collection is Rumbler, Bear Crusher, Night Stomper, Gator Claw, Chrome Guardian, and Mega Titan. Each has a distinct color, silhouette detail, and size. Stars are cumulative milestones, not currency to spend or lose.

## Decisions made for a very young player

- Progress comes from playing. There are no lives, crashes that end a run, or failure penalties.
- A complete race works with no input after Play. Steering and jumping add agency without becoming prerequisites.
- Guided track movement handles the loop reliably. The camera pulls aside to show the stunt while keeping the horizon upright.
- Big touch controls and keyboard controls use the same game rules. Menus use standard accessible buttons with keyboard focus.
- Sound is optional. Mute, pause, and gentler motion are available, and switching away pauses an active race.
- Browser storage is optional. If it is blocked or damaged, the game still starts and the session can still progress.

## How it is built

`core.mjs` owns frame-independent race simulation and validated progression. `scene.mjs` owns the procedural Three.js world, truck models, camera, particles, and star visuals. `audio.mjs` synthesizes original sounds through a shared gain control. `main.mjs` connects those systems to the responsive HTML interface, controls, and local saves.

The renderer reuses geometry and materials, merges scenery into batches, limits particles, and caps pixel density. Original meshes and synthesized audio mean there are no asset downloads or third-party services during play.

## Definition of a useful first release

The game must start easily, complete a satisfying race, visibly earn a bigger truck, remember that reward, and replay reliably. Browser checks, regression tests, visual inspection, and a production build provide engineering evidence. Watching a child play and testing a real iPad remain essential next steps for tuning the experience.

## Sharing the project

The public package contains only the game, original assets, tests, documentation, and a manual GitHub Pages workflow. The README explains the AI-assisted origin without claiming that an untested prototype is a finished commercial product. Future contributions should preserve simple controls and positive progression.
