# Monster Skyway

**[Play Monster Skyway](https://yanivalfasykeelusa.github.io/james-monster-skyway/)** on an iPad, phone, or computer. Open the link in your browser; no game account or download is required.

A cheerful 3D monster truck game for little drivers. Pick one of six sculpted toy trucks, soar over ramps, ride a giant guided loop, transform into a robot guardian, and grow a garage of increasingly enormous wheels.

The quality pass adds rounded bodywork, treaded tires, visible suspension, warm sunlight and shadows, and an orange track with real thickness and raised edges. Bear Woods, the Sky Loop stunt festival, and Gator Bay give the short race three distinct destinations.

![The live Monster Skyway lobby with its featured 3D truck](docs/screenshots/menu.png)

This project began with a three-year-old's love of monster trucks, orange stunt tracks, angular silver vehicles, and transforming robots. It explores what a family can create with AI as a development collaborator. The vehicles, characters, sounds, and scenery are original creations.

## Play

On iPad, open the game in Safari. Landscape gives the track more room, and portrait works too. To keep a shortcut beside James's other games, use Safari's Share menu, More if shown, then **Add to Home Screen** and **Add**. See [Apple's instructions](https://support.apple.com/guide/ipad/bookmark-a-website-ipadc602b75b/ipados).

Choose **Let's play** to start a roughly 73-second race. The truck accelerates automatically, six ramps launch automatically, and the loop guides the truck through safely. A driver can enjoy and complete a race without steering or pressing jump.

- **Touch:** use the large on-screen controls to jump, steer, or transform when energy is ready.
- **Keyboard:** use the arrow keys to steer, Space to jump, T to transform, and P or Escape to pause. Menus also support Tab and Enter.
- **Transformation:** energy charges as you drive. Use the transformation control when charged; automatic activation helps little drivers enjoy the spectacle too.
- **Pause and sound:** use the visible controls to pause or mute. Sound starts after a user interaction and remains optional.

Every completed race awards stars. There are no lost lives or progress penalties. Unlocks and preferences save in this browser when local storage is available; if storage is blocked, the game keeps working with progress for the current session.

The lobby shows your selected truck in the live 3D world. Garage cards use portraits rendered from the same models you drive.

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

Drive past pine trees and friendly bears in Bear Woods, through pennants and turquoise supports at the Sky Loop, and over the water beside Gator Bay's sandy islands, palms, and alligators. Track seams, edge rails, ramp arrows, and gates help make the route readable.

![The complete raised-edge toy loop and its stunt festival surroundings](docs/screenshots/loop.png)

Steering turns the front wheels and leans the body. Landings compress the suspension and kick up a brief dust burst and ring. The close chase camera leaves room to see the next jump, then pulls aside for an upright view of the loop.

![The orange skyway crossing the water and islands of Gator Bay](docs/screenshots/bay.png)

Twin exhausts shoot bright flames and leave a fiery trail through jumps and loops. Bigger trucks bring bigger flames, and guardian mode turns them up further. **Gentler motion** reduces camera movement, removes the landing ring and moving flame trail, and keeps two small, steady exhaust flames.

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

The unit suite passed 34 tests during the quality pass. It checks race rules, progression and save recovery, audio and flame lifecycles, truck resources, track geometry, and world construction. Run `npm test` to repeat it.

See [the validation record](docs/VALIDATION.md) for current Chrome/WebKit browser results, screenshot inspection, and public deployment evidence. Real iPad/Safari testing and a child playtest remain pending.

## Publish with GitHub Pages

The included workflow runs only when started manually with **Run workflow**. After choosing a repository, enable GitHub Pages with **GitHub Actions** as its source, then run **Deploy Monster Skyway** from the Actions tab. It installs dependencies, runs tests, builds the game, and publishes the `dist/` artifact to Pages.

The project is published from [yanivalfasykeelusa/james-monster-skyway](https://github.com/yanivalfasykeelusa/james-monster-skyway), with the playable site at [Monster Skyway](https://yanivalfasykeelusa.github.io/james-monster-skyway/). Its Pages source is GitHub Actions. Source changes remain separate from the live site until the deployment workflow is run.

## Next adventures

See [the roadmap](docs/ROADMAP.md) for shipped features, device testing, an eventual free-driving playground, and a separate construction vehicle adventure.

Read the [design notes](docs/DESIGN.md) and [asset credits](docs/ASSETS.md) for the decisions behind the game.

## License

[MIT](LICENSE). Contributions should use original or appropriately licensed material.
