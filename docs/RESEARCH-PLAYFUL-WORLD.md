# Playful racers and a more believable world

Research checked **11 September 2026**. Sources below are game developers, engine maintainers, or the original author of a technique. This is an implementation recommendation, not a claim that a different engine has been benchmarked on James's iPad.

**Recommendation: keep Three.js for the next increment.** Build recognisable companions with local decision-making, then improve surface detail and environmental motion around the existing easy route. The useful common standard is physically based materials, coherent lighting, deliberate art direction, and measured rendering budgets. An engine change does not supply those assets or behaviours automatically.

## What the reference games establish

| Reference | Verified from primary sources | Useful lesson for Monster Skyway |
| --- | --- | --- |
| Crash Drive 3 | M2H explicitly describes its game code as C# in Unity. The game has a shared stunt playground, vehicle progression, events and secrets. | Give the track recognisable places and companions that appear to share James's adventure. Its open-world controls and online multiplayer are separate scope decisions. |
| Crash Drive 2 | M2H describes ramps, hoops, unusual terrain, vehicle unlocks and six event types. Its developer also places it among the games using the studio's Unity toolkit. No specific Unity version or rendering pipeline is established here. | Small, recognisable discoveries and vehicle rewards can sustain repeated play without adding difficult driving. |
| Hot Wheels Unleashed | Milestone's executive producer confirms Unreal Engine in an Epic interview. He describes detailed toy models, lighting experiments, environment work and repeated play-and-adjust cycles. This source does not establish a precise engine version. | Believable miniature materials and clear lighting can make an inviting toy world convincing. More realistic visuals do not require James to manage the reference game's physics difficulty. |
| Hot Wheels Unlimited | Budge's official page presents building, racing, collecting and puzzles. Its own App Store listing confirms iPad availability. **An engine was not verified from a primary source**, so this note does not label it Unity or Unreal. | A relevant touch-first presentation reference, distinct from Milestone's Unleashed. Keep build/puzzle ideas for the later sandbox game. |

Sources: M2H's [Crash Drive 3 shipping retrospective](https://www.m2h.nl/writing/shipping-to-nine-platforms-on-one-day/) (1 September 2026, updated 2 September), [Crash Drive 3](https://www.m2h.nl/games/crash-drive-3/), [Crash Drive 2](https://www.m2h.nl/games/crash-drive-2/), and [shared development toolkit](https://www.m2h.nl/writing/the-toolkit-behind-ten-years-of-games/) (5 September 2026); Epic's [interview with Milestone](https://www.unrealengine.com/developer-interviews/meticulously-detailed-virtual-toy-cars-fuel-racer-hot-wheels-unleashed?lang=en-US) (30 September 2021); Budge's [Hot Wheels Unlimited page](https://budgestudios.com/en/apps/detail/hot-wheels-unlimited/) and [developer-supplied iPad listing](https://apps.apple.com/us/app/hot-wheels-unlimited/id1523486249?platform=ipad).

These are documented design and production references, not evidence that the researcher played these commercial games. The lessons in the final column are our interpretation for James's current game.

## Engine decision

| Option | Relevant capability and constraint | Decision for this project |
| --- | --- | --- |
| Existing Three.js 0.186.0 | `MeshStandardMaterial` provides metallic/roughness PBR; `MeshPhysicalMaterial` adds clearcoat and other effects at greater pixel cost. Instancing shares geometry/materials across placements. | Continue. Local inspection already found PMREM environment lighting, ACES tone mapping, physical truck paint and a capped pixel ratio. Improve what the camera sees before adding another rendering system. |
| Unity with URP | Unity documents mobile deployment and URP tuning: limit shadow distance, extra passes, lights and material complexity; profile changes. | Strong candidate for a future native production trial if editor-based scene authoring, a much larger content pipeline or a measured native requirement becomes the bottleneck. It is a port, not an immediate visual upgrade. |
| Godot | Its Mobile renderer targets modern mobile graphics APIs. Web exports instead use Compatibility/WebGL 2; the documented web path has mobile/Safari caveats. | Reasonable future open-source editor candidate. Do not assume the native Mobile renderer's features transfer to a browser export. |
| Unreal | Milestone demonstrates what a substantial Unreal art/lighting pipeline can achieve for miniature racing. | A useful quality reference. That shipped console/PC result does not establish performance or migration value for this small iPad browser game. |

Capability sources: Three.js [standard material](https://threejs.org/docs/pages/MeshStandardMaterial.html), [physical material](https://threejs.org/docs/pages/MeshPhysicalMaterial.html), [instancing](https://threejs.org/docs/pages/InstancedMesh.html), and [PMREM](https://threejs.org/docs/pages/PMREMGenerator.html); Unity's [mobile development overview](https://unity.com/solutions/mobile) and [Unity 6 URP performance settings](https://docs.unity3d.com/6000.0/Documentation/Manual/urp/configure-for-better-performance.html); Godot's [renderer overview](https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html) and [web export documentation](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html). The project version is from `package.json`; scene/material observations are from `src/scene.mjs` and `src/models.mjs` inspected on the research date. Online documentation can describe newer capabilities than this installed version, so implementation must check local APIs.

**Migration trigger:** first create one equivalent short scene on the actual target iPad and compare sustained frame pacing, load time, thermal behaviour, asset workflow and maintenance cost. Reconsider the engine only when that experiment identifies a concrete benefit. This is our project recommendation; no comparative device measurements were made in this research.

## Make the other racers feel like playmates

The relevant established technique is a small state machine above steering rules. Craig Reynolds separates high-level goals, steering and locomotion, including path following, leader following and separation. Apple's GameplayKit guide likewise combines movement goals and limits, while its state-machine guide gives each character independent state and permitted transitions. These are reusable architectural patterns; using them in JavaScript does not require an Apple framework. [Reynolds's original steering work](https://www.red3d.com/cwr/steer/) (GDC 1999), [Apple: Agents, Goals, and Behaviors](https://developer.apple.com/library/archive/documentation/General/Conceptual/GameplayKit_Guide/Agent.html), [Apple: State Machines](https://developer.apple.com/library/archive/documentation/General/Conceptual/GameplayKit_Guide/StateMachine.html) (archived conceptual guides, updated 21 March 2016).

Proposed behaviour model for this increment:

1. **Give each friend a stable personality.** One likes inviting James to a short race; another stays nearby and celebrates his stunts. Keep their colour, name and preference recognisable across races.
2. **Give each its own small memory.** Current intention, time in that intention, last celebration, chosen side and a seeded variation value are enough. React to actual distance, James's boost/jump/crush events, neighbours and the upcoming safe stretch.
3. **Choose readable intentions.** Cruise, approach, invite, give room and celebrate form a useful small vocabulary. Minimum durations and cooldowns stop frantic switching. A short glance, suspension bounce or cheerful signal makes the choice visible.
4. **Make safety a constraint on every intention.** Bound acceleration and sideways movement; reserve room for the largest transformed truck; let close-pass separation override a playful lane choice. Rank must follow actual travelled distance. Preserve the untouched race's first-place finish and the benefit of crushing and turbo.
5. **Vary the invitation, not the required skill.** A race seed can change which friend approaches, a safe invitation's timing, or the reaction after a stunt. Keep the familiar route and important rewards stable. Replays should be reproducible for debugging without storing personal information.

These are proposed local game agents with authored goals. They need no network calls, chat interface, account, language model, or training loop. Their apparent personality comes from clear reactions, continuity and room to act independently within the forgiving race rules.

## Details with the greatest visual return

The following priorities are our art-direction inference from the references and renderer capabilities, not measured claims about performance:

| Priority | Visible change | Implementation boundary |
| --- | --- | --- |
| Surface scale | Fine road wear, restrained rubber scuffs, wood grain, sand/grass variation and wet/dry roughness contrast. | Prefer a few shared, original maps or vertex-colour variations. Avoid changing driveable geometry for cosmetic detail. |
| Grounding | Rock/grass clusters at tree bases, shoreline transitions and purposeful vegetation placement. | Preserve road clearance and clear views of jump landings, loops and the finish. Keep distant detail simpler. |
| Environmental life | A few birds, fluttering flags, reeds, water ripples or floating leaves around specific landmarks. | Animate a bounded nearby set; group or instance repeated pieces; freeze with pause and suppress decorative motion in gentler mode. |
| Replay interest | Different bird formations, colour accents or friendly reaction choices on another run. | Use a bounded seed; vary decoration without random hazards or changed reward availability. |
| Lighting coherence | Painted trucks, rough rubber, warm timber and glossy water should respond differently to the same light. | Refine the existing environment/light setup; avoid enabling costly physical features on every surface. |

Three.js supports roughness/bump data and environment lighting without increasing silhouette geometry; its physical-material documentation explicitly notes the extra cost of advanced features. This supports trying small surface improvements first, but their final appearance still needs camera-level review. [Standard material](https://threejs.org/docs/pages/MeshStandardMaterial.html), [physical material](https://threejs.org/docs/pages/MeshPhysicalMaterial.html).

## Acceptance evidence to gather

Use fixed-seed simulations to check repeated races, all six trucks, guardian width, close passes, reaction cooldowns, pause and replay resets. Play through the actual touch/keyboard controls and observe whether companions visibly respond when James does something. Inspect scenery while driving toward it, including portrait views, rather than judging only staged close-ups.

Record draw calls, triangles, resource lifetime and a comparable scene capture, but do not equate these counts or a desktop WebKit pass with actual iPad frame rate. M2H's own performance article stresses selecting a target device, capturing repeatable conditions and fixing measured bottlenecks; its 2021 opinions about specific Unity pipelines are historical and should not be treated as current engine advice. [M2H: Optimizing performance of Unity games](https://www.m2h.nl/writing/optimizing-performance-of-unity-games/) (5 July 2021).

The remaining product test is James's response: does he notice a friend's invitation, enjoy seeing it react, and still finish easily? Use that observation to decide the next amount of autonomy and scenery detail.
