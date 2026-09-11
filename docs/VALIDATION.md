# Validation record

## Automated rules

The core suite covers no-input completion, six automatic ramp jumps, manual jumps, repeated input, bounded steering, loop completion, automatic and manual transformation, pause, invalid frame times, validated saves, every truck threshold, reward limits, and idempotent finish events.

`npm test` passed 15 tests: 10 game-rule tests and 5 audio lifecycle tests. The audio tests check user-gesture initialization, the pause-before-first-race flow, immediate mute and voice cleanup, unavailable Web Audio, and graph reuse after pause/resume.

## Browser evidence

On 2026-09-11, a headless Chrome run with emulated touch input completed the full 1,900-unit course. The observed result was seven landings (six automatic ramps and one touch jump), one completed loop, 30 collected stars, and 42 awarded stars. The test selected the newly earned Bear Crusher, reloaded to verify the selected truck and earned stars persisted, and began a second race. No JavaScript errors or failed resource responses were recorded in that complete run.

Additional browser interactions covered the garage before the first race, keyboard jumping, pause/resume without distance advancing while paused, motion settings, mute, resizing, and phone controls. Screenshots were inspected at desktop 1440×900, phone 390×844, and iPad-sized 1024×768 viewports, including the transformation and the truck inverted at the top of the loop.

The portable `npm run test:browser` suite passed all three tests in approximately 1.5 minutes: input/pause/resume after a garage visit, a complete race with no driving input followed by unlock/save/replay, and touchscreen play when storage and audio are unavailable. An additional rendering pass started a race with each of the six trucks without browser errors.

## Practical limits

- A desktop browser with emulated touch is not a physical iPad or iPhone. Safari behavior, actual device frame pacing, battery use, and orientation changes still need a real-device pass.
- The initial course and unlock pacing need observation with a young player.
- Local saves belong to a browser and site origin; moving between preview and public URLs creates separate garages.
- Storage is not cloud-synced. Private browsing and storage clearing can remove progress.
- GitHub publication and its final URL must be verified separately after a repository is connected.
