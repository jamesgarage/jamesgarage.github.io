# Monster Skyway: a brighter toy-world racer

The next release upgrades the existing guided race into a cohesive, polished toy-world adventure. James's interests and the established game remain the design brief: huge monster trucks, flames, jumps, a giant loop, robot transformations, friendly bears and alligators, and growing into the biggest truck. Both touchscreens and computers matter. The parent has delegated this quality pass and publication while heading to bed.

## Visual direction

Use a premium toy diorama style. Vehicles have rounded painted panels, exaggerated rubber tires, metallic mechanical details, clear character faces, and strong silhouettes. The track is vivid orange molded plastic with visible thickness, edge rails, seams, supports, arrows, and stunt gates. The world has clean color separation, warm sunlight, cool sky light, soft contact shadows, and layered landscapes.

Three directions were considered: more detail on the current primitive scene; a cohesive stylized 3D rebuild of its presentation; or a new physics engine and imported asset pipeline. The second delivers the clearest improvement while preserving reliable play and a small self-contained browser game. The first leaves the flat prototype appearance; the third diverts work into physics and asset integration without making the experience better for a three-year-old yet.

Bear Woods uses rolling grass, pines, boulders, wooden signs, and friendly spectators. Sky Loop becomes a stunt festival with turquoise support arches, pennants, and a visible complete loop. Gator Bay adds blue water, sand islands, palms, reeds, and alligators. Scenery frames a clear driving corridor; it never blocks the road or hides a landing.

The six trucks retain their names, colors, unlock thresholds, and scale progression. Rumbler is an orange rally monster; Bear Crusher has rounded purple bear detailing; Night Stomper is dark with vivid green original flame motifs; Gator Claw has scales and a toothy bumper; Chrome Guardian has an angular silver body; Mega Titan has a broad armored silhouette and giant tires. Original geometry avoids requiring branded assets.

## Feel and presentation

The driving camera sits closer to the truck with enough road ahead to read a jump. A gentle suspension response, lean while steering, brief landing compression, and a modest guardian zoom communicate weight and speed. The loop still uses an upright overview. Gentler motion suppresses camera impulses and trail effects. Pause freezes both the simulation and visual effects.

The interface feels like a game lobby, with a prominent play button, a clearly featured truck, route identity, and collectible garage cards. The race HUD identifies the current destination and keeps progress and stars easy to see. Jumps, loops, and rewards receive concise celebrations. Touch controls remain large and retain their established accessible names and keyboard behavior.

## Architecture

`core.mjs` remains the authority for race rules and progression. `track.mjs` owns the shared course frame math; both road meshes and the truck sample it. `models.mjs` owns truck construction and resource disposal. `world.mjs` builds batched scenery and the substantial track. `scene.mjs` orchestrates those parts, lighting, the camera, collectibles, and effects. `flames.mjs` retains the bounded flame pool. `main.mjs` remains the UI/input/save coordinator.

Model contract: `makeTruck(spec)` returns `{ group, body, wheels, arms, head, struts, spec }`; `disposeTruck(truck)` releases only resources owned by that truck. The exhaust anchors remain at body-local `(±1.05, 3.09, -2.16)` so the existing flame system remains correct. `scene.mjs` re-exports `makeTruck` and `sampleTrack` for compatibility. `createWorld()` returns a Three.js Group and uses the same track sampler as the camera and player.

## Global constraints

- Keep Three.js 0.186.0, Vite 8.3.0, and the existing vanilla JavaScript architecture.
- Preserve the version-1 save key, all truck IDs, unlock thresholds, race rewards, and no-input completion.
- Preserve keyboard and touch control accessible names, pause/resume, and unavailable-storage/audio recovery.
- Keep the 1,900-unit course, six ramps, complete vertical loop, automatic acceleration, and guardian transformation.
- Keep all runtime assets local to the published site; no accounts, ads, purchases, analytics, or runtime third-party fetches.
- Use bounded effect pools, reuse or dispose GPU resources, and cap render pixel ratio at 1.5.
- Maintain a clear road, readable truck silhouette, and usable 768×1024 and 1024×768 touch layouts.
- Work on the existing `main` branch; create no branches or worktrees.
- Publish through the existing manually dispatched GitHub Pages workflow after local verification and repeat the browser suite on the public URL.

## Acceptance

Compare saved screenshots of the old and new garage, driving view, airborne truck, loop, bay, and Mega Titan. The upgrade must visibly improve shape, depth, lighting, and environmental variety rather than merely add UI decoration. Inspect desktop, tablet landscape and portrait, and phone controls. Run the unit suite, build, a full no-input browser race with unlock/save/replay, and input/pause/reduced-motion/fallback checks. Check all six trucks, finite geometry, stable repeated garage changes, a bounded rendering budget, and no browser errors. A physical iPad and child playtest remain follow-up observations the user can make; browser emulation must not be described as either.
