# Validation record

## Automated rules

The core suite covers no-input completion, six automatic ramp jumps, manual jumps, repeated input, bounded steering, loop completion, automatic and manual transformation, pause, invalid frame times, validated saves, every truck threshold, reward limits, and idempotent finish events.

`npm test` passed 34 tests: 10 game-rule tests, 5 audio lifecycle tests, 5 exhaust-flame tests, 7 truck model/resource tests, 2 course-frame tests, and 5 world geometry/visibility tests. The audio tests check user-gesture initialization, the pause-before-first-race flow, immediate mute and voice cleanup, unavailable Web Audio, and graph reuse after pause/resume.

The flame tests cover frozen exhaust and trail matrices while paused, removal of trails with reduced motion, bounded and reused resources over 3,600 driving frames, cleanup on garage/reset/truck changes, and exhaust placement during truck scaling, guardian lift, and loop inversion. Flames share one instanced rendering object with a fixed pool of 64 trail particles.

The model tests exercise all six original designs, articulation and exhaust contracts, finite geometry, and independent/idempotent resource disposal. World tests check the complete transformed trucks at both outside lanes, finite batched geometry and render budgets, loop support clearance, gates above maximum jumping guardian height, and unobstructed support sightlines through the loop. The latter samples 91,584 rays across six trucks, three lanes, and both overview orientations.

## Earlier prototype browser evidence

On 2026-09-11, a headless Chrome run with emulated touch input completed the full 1,900-unit course. The observed result was seven landings (six automatic ramps and one touch jump), one completed loop, 30 collected stars, and 42 awarded stars. The test selected the newly earned Bear Crusher, reloaded to verify the selected truck and earned stars persisted, and began a second race. No JavaScript errors or failed resource responses were recorded in that complete run.

Additional browser interactions covered the garage before the first race, keyboard jumping, pause/resume without distance advancing while paused, motion settings, mute, resizing, and phone controls. Screenshots were inspected at desktop 1440×900, phone 390×844, and iPad-sized 1024×768 viewports, including the transformation and the truck inverted at the top of the loop.

The portable `npm run test:browser` suite passed all three tests in approximately 1.5 minutes: input/pause/resume after a garage visit, a complete race with no driving input followed by unlock/save/replay, and touchscreen play when storage and audio are unavailable. An additional rendering pass started a race with each of the six trucks without browser errors.

## Earlier public deployments

The game was published on 2026-09-11 to [GitHub Pages](https://yanivalfasykeelusa.github.io/james-monster-skyway/) from [its standalone repository](https://github.com/yanivalfasykeelusa/james-monster-skyway). The [initial deployment workflow](https://github.com/yanivalfasykeelusa/james-monster-skyway/actions/runs/34564169134) completed both build and deployment successfully.

All three portable browser tests then passed against that exact public URL in approximately 1.4 minutes. This verified the repository subpath and bundled assets, keyboard/touch controls, a complete unattended race with the giant loop, earned truck selection, saved progress after reload, replay, and play without storage/audio. The public loop screenshot was inspected. These were headless Chrome tests with emulated touch, not a physical iPad test.

The exhaust-flame update was visually checked locally in Chrome at desktop 1440×900, iPad-sized landscape 1024×768, and portrait 768×1024 layouts. Rumbler and Mega Titan showed scaled flame trails, Mega Titan's jump showed the longer airborne exhaust, and Night Stomper with reduced motion retained two small, steady flames. No browser errors occurred in this visual pass.

All three browser regressions also passed locally with the new flames. The suite now checks active trails, frozen particle counts during pause, automatic guardian flames, exhaust during the loop, and two steady exhaust flames with reduced motion. The captured guardian and inverted-loop frames were visually inspected.

The [flame deployment](https://github.com/yanivalfasykeelusa/james-monster-skyway/actions/runs/34564806748) successfully published runtime commit `fd489a6` on 2026-09-11. The public site served the expected `index-D09DpkM3.js` bundle, and all three browser regressions passed against its public URL in approximately 1.4 minutes. This included the new flame checks, a complete unattended race, an earned truck, saved-progress reload, and replay. The public inverted-loop screenshot was inspected with the flame trail following the truck.

## Visual quality release: 2026-09-11

The quality pass replaces the primitive truck bodies with six detailed original models, adds a dimensional track and three richer environments, upgrades sunlight/shadows and camera/landing response, and introduces the live lobby, garage portraits, and destination HUD. The race simulation, saved progress format, unlock thresholds, and flame lifecycle remain compatible.

The local production build passed all three browser tests in Chrome (about 1.4 minutes) and Playwright WebKit (about 1.5 minutes). Each engine exercised keyboard/touch jumping, pause/resume, six locally loaded truck portraits, a complete unattended race through every ramp and the inverted loop, automatic transformation and flames, earned-truck selection, saved-progress reload, replay, and play with blocked storage and unavailable audio. The reduced-motion test retained two steady flames. Neither run recorded JavaScript, console, failed-request, or HTTP resource errors.

Independent visual review caught a support that physically cleared the course but briefly hid the ascending truck. A rear gantry and a more direct overview corrected it. Regression coverage checks the actual support geometry, and the finished overview was inspected at ascent, crown, descent and exit in landscape and portrait. A separate review tested 43,200 sightlines through the actual eased camera transitions without a support obstruction. The corrected production build passed the complete Chrome race again in about 1.4 minutes.

An isolated render-lifetime probe switched trucks 42 times across all six designs. GPU geometry counts stayed identical per truck across all seven cycles, with eight textures and ten shader programs in the fixed view. Scene, camera, particles and flame instance matrices remained unchanged through 30 paused updates; an independent review also checked 100 paused updates. These are bounded-resource checks, not physical-device frame-rate measurements.

Desktop 1440×900, tablet landscape 1024×768, tablet portrait 768×1024, and phone 390×844 layouts were captured and inspected. All six portraits loaded, the garage had no horizontal overflow, and essential race controls stayed inside the viewport without overlapping one another. All six selected-truck views and the largest transformed truck in portrait were inspected. The loop browser assertion limits rendering to fewer than 600 draw calls and 400,000 triangles.

The [quality deployment](https://github.com/yanivalfasykeelusa/james-monster-skyway/actions/runs/34569485051) successfully built and published commit `6b41b88` on 2026-09-11. The public site served the matching `index-pFJ28z9S.js` and `index-B5owj6Dq.css` assets. All three browser tests passed against the public URL in Chrome in about 1.4 minutes, including a complete race, saved unlock and replay. The public loop, guardian and bay screenshots were inspected.

All three tests also passed against that same public URL in Playwright WebKit in about 1.5 minutes. The public runs in both engines recorded no JavaScript, console, failed-request or HTTP resource errors. The WebKit inverted-loop screenshot was inspected. This verifies the deployed repository subpath and browser-engine behavior; physical iPad/Safari testing remains pending.

A separate public-site capture checked the four desktop/tablet/phone layouts, all six garage portraits, and jumping Mega Titan. It found no JavaScript/console errors, horizontal garage overflow, or overlapping/offscreen essential controls. The five README screenshots were refreshed from that public build; the collection capture uses a prepared local browser save to show all six trucks.

## Practical limits

- Chrome and Playwright WebKit on a desktop with emulated touch are not a physical iPad or iPhone. Shipping Safari behavior, actual device frame pacing, battery use, and orientation changes still need a real-device pass.
- The initial course and unlock pacing need observation with a young player.
- Local saves belong to a browser and site origin; moving between preview and public URLs creates separate garages.
- Storage is not cloud-synced. Private browsing and storage clearing can remove progress.
- GitHub Pages publication has been verified; future deployments should repeat the public URL regression suite.
