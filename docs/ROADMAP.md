# Monster Skyway roadmap

## First substantial playable release

The immediate goal is a complete, cheerful guided race that a three-year-old can finish with little or no help.

- A 3D chase camera, orange toy track, broad curves, six ramps, and a guided vertical loop.
- Automatic acceleration, forgiving jumps and landings, large touch controls, and optional steering.
- An original robot guardian transformation that also activates automatically for younger drivers.
- Six original trucks: Rumbler, Bear Crusher, Night Stomper, Gator Claw, Chrome Guardian, and Mega Titan.
- Visible star rewards, increasingly large vehicles, local unlocks, and a finish celebration after every run.
- Original synthesized sound effects, immediate mute, pause, and reduced-motion preferences.
- A standalone static build with a manually triggered GitHub Pages workflow.

The dark neon monster truck, angular silver truck, orange stunt track, and transforming vehicles reflect favorite play interests through original designs.

## Before calling the release ready

The first local release is implemented. Fifteen unit tests and three portable browser tests pass, including a complete unattended race, saved unlocks, replay, and missing-storage/audio recovery. Desktop and emulated phone/tablet layouts have been inspected. See [the validation record](VALIDATION.md). Real iPad/Safari testing and observation with a child remain the next gates.

1. Run the automated rules tests and production build.
2. Complete a no-input race and a race with repeated jump and steering input.
3. Verify that all ramps land safely, the guided loop exits correctly, and transformations return to truck form.
4. Unlock and select every truck; reload to verify browser saves. Check blocked-storage behavior too.
5. Check pause/resume, mute during a fanfare, repeated races, resizing, and switching away from the browser.
6. Try real touchscreen controls and portrait/landscape layouts on a representative iPad and phone.
7. Check performance and camera comfort; reduce visual effects where needed.
8. Watch a young player try the game and revise anything that needs adult explanation.

## Improve the race after feedback

- More distinct original truck silhouettes, suspension movement, wheel detail, and transformation animations.
- Richer scenery and additional course themes that preserve clear track readability.
- Better tactile landing effects and collectible placement informed by actual play.
- Optional grown-up controls for challenge, sound, and motion without adding complexity to the child's play flow.
- An installable offline edition once caching and update behavior have been tested.

## Future free-driving playground

The current game follows a guided course. A true free-driving toy playground is a future mode with its own vehicle movement, camera, boundaries, ramps, and recovery behavior. It should offer open exploration while preserving the ability to recover easily from any position.

Build and evaluate that mode separately from the dependable guided race.

## Separate construction adventure for iPad

A later tangent is a touch-first construction playground with excavators, dump trucks, loaders, diggable piles, and simple delivery activities. Large gestures could scoop material, fill a truck, drive to a marked area, and tip the load.

Treat this as a separate play experience with different interaction and physics needs. It should not delay the monster truck race or crowd its controls. Begin with one satisfying excavator-and-dump-truck loop, then expand after observing real play.

## Public project principles

- Keep the game playable without accounts, advertising, or external runtime services.
- Keep earned progress positive and preserve a useful experience when storage or audio is unavailable.
- Use original characters and vehicle designs with clear licensing for any future contributed assets.
- Share concrete implementation notes and measured validation results about the AI-assisted development process.
