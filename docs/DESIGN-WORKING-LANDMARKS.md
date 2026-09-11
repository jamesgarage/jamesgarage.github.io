# Working waterwheel and windmill

The larger friendly cast shares the route with two gently moving landmarks. The existing bridge waterwheel and woodland windmill are recognizable from the driving camera, but their rotors previously stayed still. Animate only those assemblies, keeping the authored buildings and supports fixed.

The adventure factory returns a waterwheel pivot at the existing bridge venue. The festival factory returns a windmill-sail pivot at its existing venue. Each root exposes a frozen `userData.motionTargets` array with explicit pivot, ID, road distance and angular speed. The moving geometry is locally batched by material: three wheel batches and two sail batches. It is removed from the static batches, so triangle count stays unchanged. Factory roots retain sole ownership of geometry, materials and textures.

`LandmarkMotion` borrows those descriptors and updates rotation around each local Z axis: 0.22 radians/second for the waterwheel, 0.16 for the windmill. It owns no graphics resources, intervals or event listeners. A small seeded starting phase changes on completed-race replay; reset does not allocate buffers. Disposing the controller clears borrowed references without disposing the factories' resources.

Allow slow motion in the lobby and running race. Paused, nonrunning, zero/invalid time and gentler-motion frames freeze rotations and clocks before any mutation. This detail has no effect on driving, rewards, route geometry or camera controls. Keep the authored placement: tablet views show more surrounding scenery than a narrow phone naturally can.

Acceptance includes full-turn sweeps of actual assembly vertices against the road and loop, transformed culling bounds, stationary building transforms, unchanged GPU buffer identities, pause/gentler/reset/disposal, and moving-camera views in landscape and portrait. Integrate these into the same complete race and browser checks as the expanded crew.
