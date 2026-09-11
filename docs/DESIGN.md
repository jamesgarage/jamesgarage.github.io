# A little driver's big adventure

Monster Skyway began with a parent's wish: make a real-feeling game around the things a three-year-old already loves. Monster trucks of every size, orange looping toy tracks, angular silver pickups, bears, alligators, and transforming robots shaped the design. Construction vehicles belong on the roadmap as a separate future playground.

## The playable loop

Pick a truck, press **Let's play**, and take a roughly 73-second trip through Bear Woods, the Sky Loop, and Gator Bay. Driving and six ramp jumps happen automatically. The player can steer toward stars, tap to hop, and activate a charged guardian transformation. Every finish grants 12 stars plus collected bonuses. Earned trucks stay unlocked; the first race always earns the second truck. Stars are cumulative milestones, not currency to spend or lose.

## A world made of toys

The quality pass gives the course a toy diorama style: rounded painted bodywork, thick rubber tires, bright orange molded track, warm sunlight, cool sky light, and shadows that ground the truck. Road thickness, raised edge rails, seams, supports, ramp arrows, and gates make the course feel substantial. The complete loop has its own turquoise support structure and colorful pennants.

Each destination has a recognizable setting. Bear Woods layers rolling grass, pines, flowers, rocks, and friendly bear spectators. Sky Loop is a stunt festival with a clear view of the giant loop. Gator Bay crosses blue-green water beside sandy islands, palms, reeds, and alligators. Scenery stays outside the driving corridor.

All six trucks have sculpted cabs, inset windows, molded wheel arches, tread blocks, detailed wheel hubs, exposed suspension, and articulated guardian parts. Their individual shapes carry their personalities:

- **Rumbler:** orange rally pickup with roof lamps, a roll cage, and a hood scoop.
- **Bear Crusher:** rounded purple ears, a honey-colored muzzle, and paw-print doors.
- **Night Stomper:** low dark roof, original neon green flame motifs, and a rear wing.
- **Gator Claw:** long snout, nostrils, raised scales, and a toothy bumper.
- **Chrome Guardian:** faceted silver armor, swept fins, and a turquoise shield.
- **Mega Titan:** broad armored cab, reinforced shoulders, crowned roof, and a rear aerofoil.

The lobby features the selected truck in the live scene. Garage cards show transparent PNG portraits rendered from those same original models, alongside unlock progress. The race display names the current destination, and short callouts celebrate jumps, landings, and the loop.

## Feel and forgiveness

- Progress comes from playing. There are no lives, crashes that end a run, or failure penalties. A complete race works with no input after Play.
- Steering turns the front wheels and gently leans the body. A small suspension bob, airborne pitch, landing compression, dust, and a fading ring communicate movement and weight.
- The chase camera stays close while showing the road ahead. Guardian mode slightly widens its view; the loop uses an upright overview.
- Big touch controls and keyboard controls use the same game rules. Menus use accessible buttons with keyboard focus.
- Sound is optional. Pause freezes the race and visual effects; switching away pauses an active race. Gentler motion removes camera impulses, guardian view changes, landing rings, and moving flame trails while keeping small, steady exhaust flames.
- Browser storage is optional. If it is blocked or damaged, the game still starts and the session can still progress.

The quality pass preserves the 1,900-unit course, six ramps, automatic acceleration and transformation, truck IDs and unlock thresholds, race rewards, version-1 saves, and the bounded exhaust-flame system.

## How it is built

| Module | Responsibility |
| --- | --- |
| `src/core.mjs` | Frame-independent race rules and validated progression |
| `src/track.mjs` | Shared course position and orientation used by the road, truck, and camera |
| `src/models.mjs` | Original truck geometry, articulation, and per-truck resource disposal |
| `src/world.mjs` | Dimensional track, terrain, destinations, landmarks, and batched scenery |
| `src/scene.mjs` | Three.js rendering, lighting, camera, vehicle animation, collectibles, and effects |
| `src/flames.mjs` | Reused exhaust geometry and a bounded trail pool |
| `src/audio.mjs` | Original synthesized sounds and shared gain control |
| `src/main.mjs` | Responsive interface, input, race coordination, and browser saves |

The renderer batches static geometry, reuses effect pools, disposes truck resources on replacement, and caps pixel density at 1.5. Garage portraits are generated ahead of time by `scripts/render-trucks.mjs`, so cards load local PNGs without creating additional WebGL renderers. All runtime code and assets come from the game host.

## Evidence and next observations

The game must start easily, complete a satisfying race, visibly earn a bigger truck, remember that reward, and replay reliably. The quality pass has 34 passing unit tests; [the validation record](VALIDATION.md) tracks browser checks, screenshots, builds, and deployment results. Playwright's Chromium and WebKit engines can exercise touch layouts, but physical iPad/Safari testing and observation with a child remain pending. Those observations should guide performance, camera comfort, controls, and reward pacing.

The public package contains the game, original assets, tests, documentation, and a manual GitHub Pages workflow. It describes the AI-assisted development process and measured validation without claiming a child or device test that has not happened. Future contributions should preserve simple controls and positive progression.
