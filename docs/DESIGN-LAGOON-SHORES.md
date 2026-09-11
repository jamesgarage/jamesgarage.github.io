# More natural lagoon shores

Prepared 11 September 2026 for the next bounded scenery increment, after the four-friend and working-landmark release. This document authorizes no change to driving, collisions, controls, rewards or persistence. The intended result is a lagoon with low irregular sandy banks and visibly rooted palms instead of repeated smooth oval disks.

## Current evidence and target

The current `src/world.mjs` places a spherical sand island under every bay palm and selected gator. The shared `SphereGeometry(1,12,8)` has exactly 117 indexed vertices and 168 triangles, verified against the installed Three.js version. Palm banks are centered at Y=-2.1, scaled `[6+size,1.5,5+size]`; palms are rooted at Y=-1.2. Gator banks are centered at Y=-2.2 with scale `[7.4,1.6,6]`; the gators begin at Y=-0.75. The lagoon water is an opaque plane at Y=-1.7.

Existing `.tmp/living-reeds-1024.png` and `.tmp/living-falls-{1024,768}.png` show pale, similarly shaped oval islands repeated along the road. Their smooth sides and regular footprints dominate the foreground despite the improved palm fronds and reeds. Replace the island shapes and shore coloring first. Do not add more vegetation, stones, animals or particle effects in this increment.

## Geometry and appearance

Add one cached original radial bank primitive in `src/world.mjs`: one central vertex and three rings of 20 vertices each. The center fan contributes 20 triangles; the two ring connections contribute 40 each, for **61 indexed vertices and 100 triangles per bank**. This saves 68 triangles per replaced island, about 40 percent. No underside is needed because the opaque water covers the outer submerged boundary.

The center and inner ring form a broad, gently shaded rooting area. Normalized ring radii are approximately 0.74, 0.84 and 1.0, with normalized heights 1.0, 0.4 and 0.0. The flat inner ring grounds all four feet despite the gator's existing rotation. Use a small periodic radial variation, combining two or three low frequencies, to make the perimeter uneven without sharp teeth. Keep every radial multiplier at or below 1.0 so the primitive has a provable maximum footprint. Normals are computed over the shared indexed vertices. Each ring receives compatible UV and color attributes for the existing static geometry batching path.

A single cached rough, vertex-colored sand material provides warm dry sand at the center, a restrained darker wet bank near the water, and a muted submerged edge. The transition must be soft enough to avoid a thick painted outline. Start without a new texture, shader, transparency or material-per-island variation. Existing lighting and shadows provide the surface shading. Neighboring banks vary through deterministic yaw and modest scale changes derived from the existing `noise` function; their route anchors do not move. Keep repeated banks recognizable as one environment without giving each the same orientation.

## Waterline and rooted objects

Place the normalized bank's base at Y=-2.05. Its outer edge is therefore 0.35 units below the water, preventing an exposed skirt or coplanar perimeter. Set the vertical scale from each existing root height: target top `rootY+0.04`, so the palm's trunk bottom is slightly embedded instead of floating. This gives a palm top near -1.16 and a gator top near -0.71. The slope crosses the water at an interpolated radius; do not draw a second coplanar ring on the water.

Keep the existing palm and gator coordinates, scales and orientations. A palm's rooting disk needs to cover its actual trunk base. A gator's plateau needs to cover the four existing foot contact points, which lie roughly 2.21 units either side of its center and within 1.9 units fore/aft. Sample the actual bank triangles beneath these points; metadata alone is insufficient evidence of grounding. A slight foot intersection with the bank is acceptable, but visible gaps are not. The raised body and tail may extend beyond the plateau as they do today.

The gators need a different bank *transform*, using the same cached primitive. Their anchors are only 15 units from the road, while their current islands have a 7.4-unit lateral radius and extend beneath the road's horizontal footprint. Do not simply rotate an island of that size. Use new gator banks near 4.2 units across the track and 5.8 units along it, aligned with the local track frame and with only a small seeded yaw, at most approximately 0.12 radians. This maximum radius also stays within the previous island's 6-unit minor radius. Confirm the plateau still reaches every foot. This makes the bank longer along the shore while keeping its inner edge outside the road.

Palm banks also vary within bounded envelopes. Choose their new scale/rotation so the final horizontal footprint fits inside the previous island's horizontal ellipse, with a small margin. An easy conservative approach is to cap the largest transformed radial extent below the previous minor radius before rotating. This produces modestly smaller, varied banks and prevents expanding into an existing venue or its deliberate clearing. Use actual transformed-vertex checks to verify the rule rather than assuming the scale constants enforce it.

## Integration and ownership

Runtime edits stay in `src/world.mjs`. Add the cached bank primitive to the existing `geo` table and route its vertex colors through `piece`. Replace only the palm/gator sand-sphere calls. Keep 144-unit scenery chunks and per-material/shadow batching. Preserve an explicit `userData.shore` tag through batching so tests can inspect the actual resulting shore meshes. Optional immutable placement metadata can identify root/contact sample locations, but must not replace geometric acceptance.

The existing world caches continue to own shared source primitives and materials. Each built chunk owns its merged geometry as before. Banks create no new animation controller, event listener, per-frame work or per-replay GPU resources. They must not dispose borrowed world materials or existing water/wood/stone textures. The old sand batch is replaced by the new sand batch, so the expected net material batches and texture count are unchanged. Measure the final result rather than assuming that outcome.

`src/adventure.mjs`, `src/festival.mjs`, `src/world-life.mjs`, the water plane and all track geometry remain outside the runtime edit scope. Existing adventure clearings remain authoritative. No new objects are placed inside them; bank shapes remain inside the old envelopes where those banks already exist. No camera change is part of this design.

## Acceptance

Add meaningful geometry checks to `tests/world.test.mjs` or a focused `tests/shore-banks.test.mjs`:

1. The built banks have finite positions/normals/colors/UVs, intact smooth vertex colors after batching, and the intended 100-triangle primitive budget. Compare the final world triangle count with the pre-change baseline. Each bank's transformed footprint satisfies its specified envelope; separate builds remain deterministic.
2. Inspect actual batched bank vertices and triangle edges against independently sampled curved road centers at 0.5-unit intervals. Require at least 10.0 units of horizontal centerline clearance for these **low ground banks**, leaving at least 1.5 units beyond the 8.5-unit road edge. Sample edges as well as vertices so curved-road proximity cannot hide inside a long triangle. Retain all existing stricter crown, frond, landmark, guardian and loop checks; the low-bank rule does not replace them. Pay special attention to every gator bank at lateral offset 15.
3. The bank tops ground the existing palm bases and all four gator foot contact points when checked against real triangles. Outer perimeters lie below Y=-1.7, with no coplanar water triangles or floating exposed skirts. Test both palm and gator height transforms.
4. No bank is added in the loop or a named clearing. Verify bounds do not grow beyond previous horizontal island envelopes near the falls, lighthouse and surf shack; preserve their usable decks, poles and viewing space. Foundation/ground intersections that already visually root a building are not mistaken for route collisions.
5. Repeated world creation preserves the current cached-material ownership contract, independently owned merged geometries and stable texture count. Replay uses the existing world and allocates no new shore resources.

Use the actual integrated five-truck GameScene for final moving-camera captures near distances 1200, 1330 and 1390 at 1024x768, 768x1024 and 390x844. Include the largest transformed player, a dry lagoon view and a rainy waterfall view. Inspect the approach and departure, not only a staged close-up. Banks should have an uneven sandy waterline and grounded palms while collectible stars, toy cars, road rails and landmarks stay clear. Avoid regular concentric color bands, obvious polygon teeth, flicker at the waterline and a new repeated bank orientation. Verify scene call/triangle/resource counts against the just-published crew/landmark baseline; maintain the existing 700-call / 550,000-triangle ceiling. Desktop viewport measurements are not physical iPad performance claims.

Budget approximately 25-35 minutes for implementation and 15-20 minutes for focused tests and visual review. Keep the final portion of the afternoon for integrated play, publication and public verification. If the first bank shape is not clearly better in the moving camera, refine or omit it rather than adding clutter to compensate.
