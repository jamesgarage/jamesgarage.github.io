# Robot flights, selectable races and canyon jumps

James wants to be the big robot, fly, hit more objects, choose the other tracks and jump across canyons. This increment adds those activities while preserving automatic driving, easy wins, touch/keyboard/controller controls and the existing earned garage.

## Play

All five races are available immediately: the complete Skyway adventure, a short Bear Woods race, a Sky Loop race, a Gator Bay race and the new Canyon Run. Choosing a race changes its actual starting position, finish and progress display. The familiar three destinations become buttons. A track picker also appears after a finish. Track choice saves alongside the existing version-1 garage data.

The robot control works from the start. A tap chooses a persistent robot form; another returns to the truck. Automatic temporary transformation remains for a driver who never presses it. A stronger helmet, chest, armored legs, boots and fists make the form recognizable while retaining each truck's identity. The existing Jump control becomes Fly in robot mode: one press launches a guided jet-powered flight and returns safely to the road. No new steering precision is required. The robot has a measured wider envelope. Friend spacing reserves it before transformation; smash contacts include the visible wheels during transformation and return. Overhead gates have been raised to clear both rocket flight and a jump carried into a ramp.

Canyon Run uses a separate sandstone landscape around the shared route sampler. Four actual deck gaps span deep chasms. Launch pads begin a distance-based flight before each gap and land beyond the opposite lip. Automatic assistance handles every crossing for the player and friends, including with turbo or an earlier jump. The loop stays guided. A larger gap must never become a hidden failure condition.

Crates, barrels and colorful block stacks break apart or squash when driven into. Each target awards three stars, turbo charge and a speed burst once. These are original toy objects; the friendly racers remain companions. Existing crushable cars keep their behavior. Targets on the new gap flight paths are omitted so rewards do not appear unreachable.

## Structure

- `courses.mjs`: immutable course ranges and gap descriptions; normalized lookup and progress fraction.
- `core.mjs`: selected-course race start/finish, immediate robot toggle, serializable guided flight, canyon crossings and positive smash rewards.
- `encounters.mjs`: shared object definitions and filtering by course and gap paths.
- `models.mjs` / `guardian-pose.mjs`: robot geometry and an absolute pose function with no resource allocation during updates.
- `canyon-world.mjs` / reusable road factory: a cached alternate world with exactly missing road spans and clear launch/landing edges.
- `smash-scene.mjs`: bounded toy-object visuals driven by actual simulation hits.
- `scene.mjs`: course scenery visibility, selected finish line, guardian flight pose, camera composition and lifecycle integration.
- `main.mjs`, `index.html`, `style.css`: usable track selection, saved choice, course progress and clear Robot/Fly controls.

The shared centerline keeps all actors, effects and road geometry aligned. Short races reuse authored portions of the existing world; Canyon Run supplies a distinct landscape and gaps. This avoids duplicating physics and preserves the loop/passing behavior already tested. The alternate world is created once and reused; normal scenery controllers are hidden in the canyon.

## Acceptance

Each course must start and finish at its own bounds, finish first with no driving input, award progress once and replay cleanly. Canyon crossings must keep the player and four friends above every absent road span at normal and turbo speeds. Robot mode must work immediately, persist until changed and support flight without extra controls. Pause, gentler motion, menu, changing truck/course and reload must not leave a stale flight, robot pose or broken target.

Test the pure rules across all eight truck sizes and course choices; inspect actual robot and canyon frames; play through the public build in Chrome and WebKit, including short-course selection, the complete canyon race, manual flight, smashing, reload and replay. Physical iPad frame pacing remains a separate device observation.

## Controller and iPad input

`gamepad-input.mjs` consumes standard controller snapshots and emits deadzone-adjusted steering, one-shot actions and menu navigation repeats. `gamepad-controls.mjs` connects these to the same actions and buttons as touch/keyboard. The active controller stays selected; disconnect pauses. Connection, replacement and input clearing prime held buttons so no action repeats on reconnect. Audio activation is optional and never blocks starting the race.

Game surfaces use touch-action and selection/callout suppression, plus cancelable Safari gesture listeners. Pointer IDs independently track held steering contacts and clear on release, cancel, lost capture, pause and page backgrounding. Single-finger overlay scrolling remains available. No global viewport zoom lock is added.

The [W3C Gamepad specification](https://www.w3.org/TR/gamepad/) defines the standard mapping and secure-context requirement. [Pointer Events](https://www.w3.org/TR/pointerevents/) defines touch-action for browser panning/zooming; canceling a pointer event alone does not control it. [WebKit's tapping guidance](https://webkit.org/blog/5610/more-responsive-tapping-on-ios/) distinguishes manipulation from disabling continuous zoom. Browser-injected controller snapshots and Chromium multi-contact input test our integration; desktop WebKit cannot establish physical iPad behavior.
