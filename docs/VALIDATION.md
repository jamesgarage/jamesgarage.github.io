# Validation record

## Automated rules

The core suite covers no-input completion, six automatic ramp jumps, manual jumps, repeated input, bounded steering, loop completion, automatic and manual transformation, pause, invalid frame times, validated saves, every truck threshold, reward limits, and idempotent finish events.

`npm test` passed 20 tests: 10 game-rule tests, 5 audio lifecycle tests, and 5 exhaust-flame tests. The audio tests check user-gesture initialization, the pause-before-first-race flow, immediate mute and voice cleanup, unavailable Web Audio, and graph reuse after pause/resume.

The flame tests cover frozen exhaust and trail matrices while paused, removal of trails with reduced motion, bounded and reused resources over 3,600 driving frames, cleanup on garage/reset/truck changes, and exhaust placement during truck scaling, guardian lift, and loop inversion. Flames share one instanced rendering object with a fixed pool of 64 trail particles.

## Browser evidence

On 2026-09-11, a headless Chrome run with emulated touch input completed the full 1,900-unit course. The observed result was seven landings (six automatic ramps and one touch jump), one completed loop, 30 collected stars, and 42 awarded stars. The test selected the newly earned Bear Crusher, reloaded to verify the selected truck and earned stars persisted, and began a second race. No JavaScript errors or failed resource responses were recorded in that complete run.

Additional browser interactions covered the garage before the first race, keyboard jumping, pause/resume without distance advancing while paused, motion settings, mute, resizing, and phone controls. Screenshots were inspected at desktop 1440×900, phone 390×844, and iPad-sized 1024×768 viewports, including the transformation and the truck inverted at the top of the loop.

The portable `npm run test:browser` suite passed all three tests in approximately 1.5 minutes: input/pause/resume after a garage visit, a complete race with no driving input followed by unlock/save/replay, and touchscreen play when storage and audio are unavailable. An additional rendering pass started a race with each of the six trucks without browser errors.

## Public deployment

The game was published on 2026-09-11 to [GitHub Pages](https://yanivalfasykeelusa.github.io/james-monster-skyway/) from [its standalone repository](https://github.com/yanivalfasykeelusa/james-monster-skyway). The [initial deployment workflow](https://github.com/yanivalfasykeelusa/james-monster-skyway/actions/runs/34564169134) completed both build and deployment successfully.

All three portable browser tests then passed against that exact public URL in approximately 1.4 minutes. This verified the repository subpath and bundled assets, keyboard/touch controls, a complete unattended race with the giant loop, earned truck selection, saved progress after reload, replay, and play without storage/audio. The public loop screenshot was inspected. These were headless Chrome tests with emulated touch, not a physical iPad test.

The exhaust-flame update was visually checked locally in Chrome at desktop 1440×900, iPad-sized landscape 1024×768, and portrait 768×1024 layouts. Rumbler and Mega Titan showed scaled flame trails, Mega Titan's jump showed the longer airborne exhaust, and Night Stomper with reduced motion retained two small, steady flames. No browser errors occurred in this visual pass.

All three browser regressions also passed locally with the new flames. The suite now checks active trails, frozen particle counts during pause, automatic guardian flames, exhaust during the loop, and two steady exhaust flames with reduced motion. The captured guardian and inverted-loop frames were visually inspected.

## Practical limits

- A desktop browser with emulated touch is not a physical iPad or iPhone. Safari behavior, actual device frame pacing, battery use, and orientation changes still need a real-device pass.
- The initial course and unlock pacing need observation with a young player.
- Local saves belong to a browser and site origin; moving between preview and public URLs creates separate garages.
- Storage is not cloud-synced. Private browsing and storage clearing can remove progress.
- GitHub Pages publication has been verified; future deployments should repeat the public URL regression suite.
