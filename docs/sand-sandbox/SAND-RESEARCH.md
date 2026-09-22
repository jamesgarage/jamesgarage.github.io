# Sand simulation research

Date: 2026-09-22

Status: Research recommendation; no iPad implementation or performance results yet.

## Decision to test

Build a small sand laboratory before committing to the full sandbox architecture. The leading hypothesis is persistent terrain plus a bounded, detailed simulation around fingers, buckets, wheels and pouring streams. Sand must move between representations without appearing, disappearing or losing its relationship to the vehicles.

An engine supplies useful rendering, input, rigid bodies and deployment tools. Its particle effects alone do not establish realistic, transferable sand. This document proposes the simulation experiment; the project design and roadmap determine the game scope.

## What the evidence establishes

Published earthmoving work supports combining bulk terrain with active soil regions and coupling those regions to equipment. A multiscale study represents active soil using particles and aggregates that interact with the machine. This supports the architectural direction, not an iPad performance claim. [Servin et al., multiscale terrain dynamics](https://arxiv.org/abs/2011.00459)

A front-loader study combines mesh terrain and particles: digging converts the static sand field to particles, and dumping converts material back. Its application closely resembles the scoop–carry–dump loop. [VTT research record, 2019](https://cris.vtt.fi/en/publications/deformable-terrain-model-for-the-real-time-multibody-simulation-o/)

Visual grain size can be finer than simulation resolution. A 2022 paper demonstrates an excavator scene with about 6,800 simulated guide particles and 147,000 visualization particles. The benchmarks use an eight-core Intel Core i9-9980HK CPU. They establish a useful technique, not a mobile particle budget. [Sommer et al., primary paper](https://naos-be.zcu.cz/server/api/core/bitstreams/7930e31c-daad-4aff-aa10-282585bb0ae9/content)

## Solver choices

| Approach | Useful properties | Principal concern | Proposed role |
| --- | --- | --- | --- |
| Discrete Element Method (DEM) | Models contacts between discrete grains, with force laws and potentially rotation and rolling resistance. | Small grains create many contacts and demanding timestep requirements. | Reference behavior or a narrowly bounded experiment; avoid assuming whole-world grain simulation. |
| Position-Based Dynamics (PBD) | Contact and friction constraints can produce stable, interactive granular behavior. | Results depend on solver settings; visual plausibility does not imply engineering force accuracy. | First candidate for local coarse particles. |
| Extended PBD (XPBD) | Compliance formulation improves control of stiffness across timestep and iteration settings. | Requires a complete granular/contact design; changing solver labels does not supply sand behavior. | Evaluate where compliant contacts, cohesion or constraints benefit. |
| Material Point Method (MPM) | Particle/grid continuum formulation supports plastic deformation, material flow and changing topology. | Constitutive models, grid transfers, rigid-body coupling and mobile optimization add substantial work. | Bounded alternative if the simpler experiment cannot deliver the required material feel. |

The DEM/contact-resolution tradeoff is described in the [2022 granular paper](https://naos-be.zcu.cz/server/api/core/bitstreams/7930e31c-daad-4aff-aa10-282585bb0ae9/content). NVIDIA's [unified particle paper](https://mmacklin.com/uppfrta_preprint.pdf) supplies a primary PBD contact/friction reference; [XPBD](https://mmacklin.com/xpbd.pdf) addresses timestep- and iteration-dependent constraint stiffness. The [Drucker–Prager sand paper](https://www.math.ucdavis.edu/~jteran/papers/KGPSJT16.pdf) demonstrates MPM sand while acknowledging faster alternatives.

Do not use impressive desktop MPM videos as the hardware budget. One optimization study's headline real-time examples run on four NVIDIA Tesla V100 GPUs. Its methods may inform investigation, but its results do not establish iPad feasibility. [GPU MPM study](https://arxiv.org/abs/2111.00699)

## Proposed authoritative material architecture

These are engineering proposals to validate, not a reproduction of any one paper.

1. **Ground:** tiled heightfield surface with material mass, bulk density/compaction and local slope relaxation. Sleep unchanged regions; update only affected rendering and collision regions.
2. **Active sand:** bounded coarse particles near meaningful interactions. Each carries authoritative mass. Convert excavated ground mass into particles and merge settled material back using measured transfer rules.
3. **Containers:** bucket and truck-bed contents have explicit ownership. Contents can be active particles or a settled representation, but never both for the same mass.
4. **Fine appearance:** surface detail, finer visualization grains and dust follow the authoritative state. Their creation and removal cannot change loads, fill levels or terrain mass.

Maintain an auditable ledger:

```text
initial mass + explicitly added mass
  = ground mass + active-particle mass + settled-container mass
    + explicitly removed/escaped mass
```

Count each portion once. Particles inside a bucket remain in the active-particle category until a recorded conversion transfers them to settled contents. Track active particles by container association for load calculation without adding them again to the global ledger. Compaction changes volume and density, not mass. Record transfers so conservation defects can be isolated from rendering artifacts.

### Bucket and moving truck bed

The bucket needs swept collision handling, containing walls, a lip, friction and overflow. Digging should visibly resist motion or slow the actuator according to load. A bucket that clips through terrain and later fills from a counter will not validate the intended experience.

Treat the truck bed as a moving container with its own settled surface or other bounded representation. Sand must travel with the truck, respond to acceleration and spill when tilted. Released material inherits the vehicle's motion, including rotation. Validate shifting center of mass and payload effects separately from cosmetic suspension animation.

AGX Terrain is a useful industrial reference: it documents excavation, compaction, repose, conversion between solid and dynamic soil, and dynamic terrain beds. Its particle and aggregate mechanisms also show why visible particles and equipment force feedback may need different representations. [AGX Terrain manual](https://www.algoryx.se/documentation/complete/agx/html/doc/UserManual/source/agxTerrain.html)

### Wheels and monster truck

Rut depth and compaction should affect support, drag and traction. Begin with a simple wheel probe, then compare driving over fresh sand, compacted tracks and a loose pile. Cosmetic tracks alone cannot demonstrate vehicle–sand coupling. Chrono's Soil Contact Model illustrates a relatively lightweight deformable heightfield approach; its more detailed terrain models provide alternatives. [Chrono terrain documentation](https://api.projectchrono.org/vehicle_terrain.html)

### Heightfield and cohesive-sand limits

A single surface height per horizontal location cannot represent tunnels, overhangs or vertically disconnected sand. AGX explicitly documents this limitation despite retaining additional soil data below its surface. [AGX Terrain manual](https://www.algoryx.se/documentation/complete/agx/html/doc/UserManual/source/agxTerrain.html)

Clarify the desired physical reference through play: loose dry sand, damp sand and moldable kinetic-style material require different behavior. For shape-holding material, use a separate small research tray to test cohesion, cutting, clump breakup and kneading. Do not promise that increasing particle stickiness will reproduce it. The cited MPM sand study focuses on dry cohesionless behavior and identifies cohesive soil/wet sand as further work. [Drucker–Prager sand paper](https://www.math.ucdavis.edu/~jteran/papers/KGPSJT16.pdf)

## iPad and tactile constraints

No candidate here has measured performance on James's iPad. Establish its model and an intended minimum supported device before approving budgets. Profile sustained behavior, not only a cold-start demo. Apple's guidance recommends measuring frame timing, memory and device-specific settings with its graphics tools. [Apple game performance guidance](https://developer.apple.com/documentation/metal/improving-your-games-graphics-performance-and-settings)

AGX is an architecture reference, not a proposed shipping dependency: current AGX Unity requirements list Windows/Linux and state that IL2CPP is unsupported. Do not assume the plugin can ship on iPad. [AGX Unity requirements](https://us.download.algoryx.se/AGXUnity/documentation/current/getting_started.html)

The core tactile experience must come from responsive control, coherent material motion and synchronized sound. Do not promise physical sand texture or resistance from the tablet screen. Apple's haptics guidance describes supported devices and accessories, including controllers and Pencil Pro; optional haptics must not be required to enjoy the game. [Apple haptics guidance](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)

Capture the actual finger path rather than only sparsely sampled endpoints. Native coalesced touches can provide additional recorded input samples where available. Initially restrict predicted input to presentation, avoiding irreversible material transfers based on predictions. [Apple coalesced-touch documentation](https://developer.apple.com/documentation/uikit/getting-high-fidelity-input-with-coalesced-touches)

## First experiment and gates

Use a tray, bucket, tilting bed, finger tool, fixed camera and one material. Add a simple tire probe after transfer works. Vehicle art, a large world and competitive destruction are unnecessary to answer this experiment's questions.

1. Exercise pouring, piling, cutting, scooping, carrying, overflow and settling.
2. Repeat a scripted scoop–carry–dump cycle 100 times, logging each mass conversion.
3. Compare coarse rendering with finer visualization driven by the same simulation.
4. Compare direct bucket manipulation with simple assisted controls.
5. Run a 20-minute session on the target iPad, capturing frame times, memory, thermal behavior and responsiveness.
6. Let James play freely, then compare short clips and discuss which actions felt best.

The [design's gate table](DESIGN.md#proposed-performance-and-quality-gates) is the normative proposed protocol. The research implications below explain those gates; none are measured results:

- Conservation error below 0.5% of material moved during the 100-cycle test; investigate every unexplained loss or duplication.
- No visible container leakage during gentle carrying; overflow and dumping behave consistently.
- Pile shape, settling and discharge resemble a selected physical reference in repeatable tests.
- Sustained 60 fps target on the agreed minimum iPad, with separate CPU/GPU timing and hitch reporting. The design supplies provisional particle sweep levels, memory limits and subsystem budgets; measurements determine the eventual production settings.
- Begin visible feedback promptly after processing confirmed input. The design's median ≤50 ms and P95 ≤80 ms targets refer to end-to-end touch-to-display latency measured on hardware, not just the simulation update interval.
- After an initial demonstration, James completes three transfers, explores another behavior and voluntarily repeats an action because it feels good. Across short sessions, let him choose a favorite action or describe it in his own words; numerical ratings are optional and need not suit a young child.

The play observations guide iteration; they do not prove addictiveness. If material quality fails, compare another bounded solver approach. If performance fails, change active-region size, resolution or rendering detail and repeat the same benchmark. Expand to the larger sandbox only when both material behavior and touch enjoyment survive sustained device testing.
