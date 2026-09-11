# Assets and credits

The six truck designs, sculpted bodies, treaded tires, wheel hubs, suspension, robot parts, bears, alligators, trees, terrain, clouds, and dimensional track are built from original project code. `src/models.mjs` constructs the trucks; `src/world.mjs` builds the destinations and road using the shared course in `src/track.mjs`. Icons, water marks, and the soft contact-shadow texture are also generated locally. Sound effects and engine tones are synthesized by `src/audio.mjs`. The game uses system fonts.

There are no downloaded character models, branded vehicle logos, texture packs, stock photographs, or third-party audio recordings. All runtime assets are served with the game.

`src/flames.mjs` renders original procedural exhaust: a shader generates the soft density and hot-core color of attached jets and a short cooling trail. The effect uses owned geometry, shader material and reused instance buffers rather than downloaded flame images. Rounded tree crowns and terrain use locally generated geometry and vertex shading.

`src/surfaces.mjs` generates small original material tiles for ground, timber, stone and water. They use filtered local pixel data and physical-scale UVs. `src/world-life.mjs` builds and instances the butterflies, cattails and ripples; repeated races reuse its buffers. `src/buddy-signals.mjs` creates the friends' pictorial reaction bubbles from vector shapes. The friends' two-note replies are synthesized locally. No new downloaded assets or services are used by these additions.

## Garage portraits

`public/trucks/` contains transparent 720×480 PNG portraits of all six original trucks. These are rendered from the same `makeTruck()` models used in play. The lobby displays the live selected model; garage cards use the PNGs so each card does not need its own WebGL renderer.

After changing a truck model, install Chromium for Playwright if needed and start Vite at the local origin root:

```sh
npx playwright install chromium
npm run dev -- --port 5173 --strictPort --base /
```

Leave that server running. In another terminal at the project root, regenerate the portraits:

```sh
node scripts/render-trucks.mjs http://127.0.0.1:5173
```

The generator reuses one temporary renderer and disposes each truck after capture. It writes the six PNGs to `public/trucks/`; review them and rebuild the game before publishing. `PLAYWRIGHT_CHROME_PATH` may select an existing Chrome executable. The generator imports development modules from `/src/` and `/node_modules/`, so it needs the origin-root Vite server, not a production build or the GitHub Pages URL.

## Screenshots and licenses

`docs/screenshots/menu.png`, `garage.png`, `loop.png`, `bay.png`, and `flames.png` show the game's actual browser rendering. They are not concept art. Viewport emulation does not establish physical-device testing; see [the validation record](VALIDATION.md).

Rendering uses [Three.js](https://threejs.org/), distributed under the MIT license. Its copyright and permission notice ships in the built game as `THREE-LICENSE.txt`. Vite and Playwright are development tools; their package license files are supplied with their installed packages.

The project's original code and generated assets are covered by its [MIT license](../LICENSE). Contributions should use original or appropriately licensed material.
