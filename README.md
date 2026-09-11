# Monster Skyway

**[Play Monster Skyway](https://yanivalfasykeelusa.github.io/james-monster-skyway/)** on an iPad, phone, or computer. Open the link in your browser; no game account or download is required.

A cheerful 3D monster truck game for little drivers. Race with two friendly trucks, squash toy cars, fire up the turbo, soar over ramps, ride a giant guided loop, and grow a garage of increasingly enormous wheels.

Rounded bodywork, sculpted tires, visible suspension, reflective paint and glass, warm sunlight and shadows give the trucks their toy-box feel. The raised orange track visits rounded woodland canopies, the Sky Loop festival, and Gator Bay, with cheering stands, playful landmarks, muddy splashes, and a gentle shower along the way.

![The live Monster Skyway lobby with its featured 3D truck](docs/screenshots/menu.png)

This project began with a three-year-old's love of monster trucks, orange stunt tracks, angular silver vehicles, and transforming robots. It explores what a family can create with AI as a development collaborator. The vehicles, characters, sounds, and scenery are original creations.

## Play

On iPad, open the game in Safari. Landscape gives the track more room, and portrait works too. To keep a shortcut beside James's other games, use Safari's Share menu, More if shown, then **Add to Home Screen** and **Add**. See [Apple's instructions](https://support.apple.com/guide/ipad/bookmark-a-website-ipadc602b75b/ipados).

Choose **Let's play** to start a race of roughly a minute, depending on turbo and jumps. The truck accelerates automatically, six ramps launch automatically, and the loop guides the truck through safely. A driver can enjoy and complete a race without pressing any driving controls.

Sunny and Splash are your little racing friends. They greet you with a smile, copy safe jumps after you, and cheer when you crush a car or use turbo. Sunny likes a playful race and can briefly pull ahead; Splash enjoys the puddles. Little pictures above their trucks show what they are doing. Their timing and the butterflies' colors change between completed races, while the familiar route stays easy to follow.

Crushing a toy car gives you a little speed burst; turbo helps you pull ahead even faster. Gentle steering assistance keeps close passes clear. The position badge follows the actual race, and your chosen truck takes the spotlight at the finish. Winning does not make the next race harder.

- **Touch:** use the large on-screen controls to jump, steer, fire the turbo, or transform when energy is ready.
- **Keyboard:** use the arrow keys to steer, Space to jump, B or Shift for turbo, T to transform, and P or Escape to pause. Menus also support Tab and Enter.
- **Turbo:** start with a full charge. A tap gives a short flame-powered burst; charge refills as you drive. Colored boost strips also trigger turbo automatically.
- **Crushing:** drive over the small parked toy cars to flatten them, earn two stars, recharge turbo and get a short speed burst. Crushing always helps and never brakes the truck. Jumping clears a car.
- **Transformation:** energy charges as you drive. Use the transformation control when charged; automatic activation helps little drivers enjoy the spectacle too.
- **Pause and sound:** use the visible controls to pause or mute. Sound starts after a user interaction and remains optional.

Every completed race awards stars. There are no lost lives or progress penalties. Unlocks and preferences save in this browser when local storage is available; if storage is blocked, the game keeps working with progress for the current session.

The lobby shows your selected truck in the live 3D world. Garage cards use portraits rendered from the same models you drive.

![A first-place celebration with the winning truck and earned stars](docs/screenshots/victory.png)

| Truck | Stars to unlock | Design |
| --- | ---: | --- |
| Rumbler | 0 | Orange rally pickup with roof lamps, roll cage, and hood scoop |
| Bear Crusher | 12 | Purple bear ears, a honey-colored muzzle, and paw-print doors |
| Night Stomper | 24 | Low dark cab, neon green flame motifs, and a rear wing |
| Gator Claw | 32 | Long green snout, raised scales, and a friendly tooth bumper |
| Chrome Guardian | 60 | Faceted silver armor, swept fins, and a turquoise shield |
| Mega Titan | 100 | Broad armored cab, crowned roof, and the biggest tires |

These are original models inspired by broad toy and vehicle interests. The game does not include licensed vehicle replicas or branded characters.

![Six original truck designs in the collectible garage](docs/screenshots/garage.png)

## Around the skyway

![Rumbler celebrating a flattened toy car with stars and a speed burst](docs/screenshots/race.png)

Bear Woods climbs a timber bridge beside a giant waterwheel. Rocket Runway adds a launch pad, a tall toy rocket, and a boost toward the next ramp. Gator Falls brings a broad waterfall, reeds, and a waterfront boardwalk to the rainy lagoon. Picnic stops, balloons, friendly bears and alligators, stands, and the finish trophy garden fill out the route.

Wood grain, mottled grass, worn stone and water highlights give those places more texture. Small butterflies flutter beside the woods; cattails sway and gentle ripples move through the lagoon. Gentler motion keeps these extra details still.

![A close race across the raised timber bridge beside its waterwheel](docs/screenshots/bridge.png)

![Automatic turbo fires along the toy rocket's runway](docs/screenshots/rocket.png)

![The complete raised-edge toy loop and its stunt festival surroundings](docs/screenshots/loop.png)

Steering turns the front wheels and leans the body. Left and right follow the chase camera's view for both touch and keyboard controls. Landings compress the suspension and kick up a brief dust burst and ring. The chase camera frames your truck and its two followers, then pulls aside for an upright view of the loop.

![The rainy skyway passing Gator Falls and its waterfront boardwalk](docs/screenshots/bay.png)

Shallow mud patches send little flecks from the tires, and a short, gentle shower passes through Gator Bay. Mud and rain are visual effects: they never slow the truck, change steering, or make winning harder.

Twin exhausts have pale hot cores, flowing amber flames and a soft cooling trail through jumps and loops. Bigger trucks bring bigger flames; guardian mode and turbo turn them up further. **Gentler motion** reduces camera movement, removes the landing ring, moving flame trail, rain, and tire spray, and keeps two small, steady exhaust flames and the mud scenery. Crushed cars show their flattened state immediately with this setting.

![Mega Titan airborne with twin exhaust flames and a fiery trail](docs/screenshots/flames.png)

## Run locally

Install Node.js 22.12 or newer (Node 24 recommended), then run:

```sh
npm ci
npm run dev
```

Open the local address printed by the development server. For an iPad on the same Wi-Fi network, run `npm run dev -- --host 0.0.0.0` and open the printed network address on the iPad. The computer's firewall must permit that local connection.

```sh
npm test
npm run build
```

The production build is written to `dist/`. Serve that directory with a static web server. Relative asset paths allow it to live under a repository subpath.

On Windows, double-click `Play.cmd` after building. It starts a small local server in the background and opens the game. On any supported Node.js platform, `npm run play` serves the built game at `http://127.0.0.1:4174`. To serve that build on your own Wi-Fi network instead, run `npm run play -- --lan` and use the computer's local network address.

For the browser regression suite, install a Chromium browser for Playwright once, then run:

```sh
npx playwright install chromium
npm run test:browser
```

The suite includes a complete real-time race, so allow about two minutes. `PLAYWRIGHT_CHROME_PATH` can point to an existing Chrome executable instead of downloading Chromium.

To exercise Playwright's WebKit engine, install it once and select `PLAYWRIGHT_BROWSER=webkit`:

```sh
npx playwright install webkit
PLAYWRIGHT_BROWSER=webkit npm run test:browser
```

In PowerShell, set `$env:PLAYWRIGHT_BROWSER = 'webkit'` before `npm run test:browser`; remove it with `Remove-Item Env:PLAYWRIGHT_BROWSER` to return to Chromium. WebKit and emulated touch viewports provide browser-engine coverage; they do not reproduce a physical iPad's Safari, graphics hardware, or touch behavior.

Set `PLAYWRIGHT_BASE_URL` to a deployed site's full URL (including its trailing slash) to run the same regression suite against that deployment. Without it, the test runner starts a local development server.

See [asset generation](docs/ASSETS.md) to regenerate garage portraits after changing a truck model.

## Browser and audio requirements

The game needs a browser and device with WebGL 2 enabled. Rendering uses bundled code and procedural 3D models. Music-like effects and the quiet engine are synthesized with the Web Audio API; the game remains playable when audio is unavailable.

The running game does not fetch third-party assets, call external services, or require an account. Loading the site downloads its own application files from the host. Installing development dependencies requires an internet connection. There is no offline service worker in this release.

## Validation

The friends use small local decision systems with individual timers and preferences. They react to successful actions and obey the same safe passing rules every time. They do not use a network AI service. See the [playful world design](docs/DESIGN-PLAYFUL-WORLD.md) and [research into comparable games and engines](docs/RESEARCH-PLAYFUL-WORLD.md).

Run `npm test` for race rules, progression and save recovery, truck and effect lifecycles, friendly racer behavior, and world geometry. The browser suite also checks steering against the visible road and completes a full race.

See [the validation record](docs/VALIDATION.md) for recorded test results, screenshot inspection, and public deployment evidence. James's parent reports that he is delighted with the existing game; his play device is unconfirmed. Physical iPad/Safari checks and observations of this update remain follow-up work.

## Publish with GitHub Pages

The included workflow runs only when started manually with **Run workflow**. After choosing a repository, enable GitHub Pages with **GitHub Actions** as its source, then run **Deploy Monster Skyway** from the Actions tab. It installs dependencies, runs tests, builds the game, and publishes the `dist/` artifact to Pages.

The project is published from [yanivalfasykeelusa/james-monster-skyway](https://github.com/yanivalfasykeelusa/james-monster-skyway), with the playable site at [Monster Skyway](https://yanivalfasykeelusa.github.io/james-monster-skyway/). Its Pages source is GitHub Actions. Source changes remain separate from the live site until the deployment workflow is run.

## Next adventures

See [the roadmap](docs/ROADMAP.md) for turbo racing, device testing, future play ideas, and a separate construction vehicle adventure.

Read the [design notes](docs/DESIGN.md), [smoother world brief](docs/DESIGN-SMOOTHER-WORLD.md), and [asset credits](docs/ASSETS.md) for the decisions behind the game.

## License

[MIT](LICENSE). Contributions should use original or appropriately licensed material.
