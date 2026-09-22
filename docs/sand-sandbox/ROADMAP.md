# James's Sand Yard — development roadmap

2026-09-22. Approved development sequence; estimates below are planning ranges, not delivery promises. Read the [design](DESIGN.md), [engine research](ENGINE-RESEARCH.md), [sand research](SAND-RESEARCH.md), and [first executable plan](../../.references/plans/2026-09-22-james-sandbox-implementation.md) together.

## Milestones

| Stage | Playable or reviewable result | Exit gate | Rough focused effort |
| --- | --- | --- | --- |
| P0A — reference kernel (complete) | Exact material transfers, bounded containers, a small terrain grid, conservative pile relaxation, and a repeatable 100-cycle check. | Passed on Windows with .NET 10.0.401; independent final review clean; source pushed to main. | Completed 2026-09-22 |
| P0B — native sand lab | Finger tool, one bucket, one tilting bed, real material flow, sound, and instrumentation on James's iPad. | Device/feel/conservation gates in the design pass. Engine and solver decision recorded. | 2–4 engineer-weeks, with further R&D possible |
| P1A — construction loop | Drive excavator and dump truck, scoop, carry, spill and unload in a small site. | Entire loop works without desktop input; load weight, capacity, digging contact and save/reload behave correctly. | 3–6 engineer-weeks |
| P1B — giant wheels and ball | Monster truck deforms sand; wrecking ball swings through reusable block structures. | Ruts affect driving; crane and impacts are stable; recovery works with touch. | 2–4 engineer-weeks |
| P1C — the big sandbox | Proposed 64 m × 64 m site, streaming/sleeping tiles, persistent terrain, approachable camera and polished sand/audio. | Long-session performance on the agreed floor device; complete phase 1 family playtest. | 3–6 engineer-weeks |
| P1D — iPad beta | Reproducible builds, TestFlight if chosen, hardware matrix, interruption/save/reset checks, final asset credits. | Install and play on family devices without developer assistance; release checklist passes. | 1–3 engineer-weeks |
| P2A — races | Offline opponents, checkpoints, editable sand courses and balanced recovery. | Opponents use the same physical rules; races work on deformed terrain. | 3–6 engineer-weeks |
| P2B — destruction arena | Playful vehicle battles, reversible damage, bounded debris, and clear start/end/reset. | Stable worst-case collisions; sand mode remains independent. | 4–8 engineer-weeks |

These are effort ranges for experienced developers with relevant tools, plus family/device test availability; they exclude recruiting, custom art/audio production, purchases, and any extended sand research. AI assistance does not replace actual device measurements. Do not add them into a guaranteed launch date. Re-estimate after P0B.

## P0B: the experiment that decides the project

**Owner roles:** developer builds/instruments; parent handles physical installation and observes; James directs play preferences. No public personal playtest data is needed.

1. Record the actual iPad, OS, and Mac/Xcode route. Install the chosen Unity 6.3 patch with iOS support, create a URP iPad project at `games/sand-sandbox/unity/`, and check in generated `.meta`, project settings and package lockfiles. Prove a signed empty scene on the physical device before writing a GPU sand kernel.
2. Put a 4 m × 4 m tray, bounded bucket, tilting bed and simple camera in `Assets/SandYard/Lab/`. Link the P0A core into a reference CPU implementation. Keep prototype geometry plain; the contact surfaces must be correct.
3. Compare **A:** conservative terrain with local coarse particles, and **B:** an isolated finer PBD/XPBD patch with the same bucket. [Middleware research](SOLVER-OPTIONS.md) identifies Obi's granular mode as a candidate for B if a suitable license is available; first verify the actual package and iPad build. It is not a selected paid dependency. If cohesive sand is the priority, replace B with a small MPM/cohesive experiment and test hold/cut/fracture. Do not implement two complete engines.
4. Implement swept bucket activation, interior contacts, lip overflow, moving-bed release, and conservative settle-back. Instrument every representation transition. The P0A direct-transfer calls alone do not provide these effects.
5. Add the two touch mappings described in the design, immediate selection/contact feedback, and a granular sound loop driven by actual contact/flow. Test muted too, so sound cannot hide poor material behavior.
6. Add a single rolling tire probe. Measure support, rutting and lateral displacement before building a complete vehicle suspension rig.
7. Run the 100-cycle mass test, the particle-count sweep, and the 20-minute physical-device trace. Record CPU/GPU times, frame interval distributions, memory, resolution, thermal state, tool contacts and a short screen-only capture.
8. Conduct three short voluntary play sessions. Offer the two mappings in alternating order. Record which actions James repeats, requests for help, accidental gestures and his own descriptions. Avoid coaching the answer or calling time spent a success score.
9. Choose: proceed with the hybrid; refine the active solver; or revise device/fidelity/scope with the parent. Archive the failed candidate and evidence. Only then pin the production engine patch and write the P1A implementation plan.

**Stop conditions:** unresolved leaks/duplication, unstable bucket contact, persistent water-like behavior, frame stalls during the touch loop, or a promising desktop demo that has never run on iPad. A failed feel gate means more work on the interaction, not more vehicles or scenery.

## Phase 1 subsystem contracts

| Subsystem and future file area | Owns | Accepts / emits | Essential regression |
| --- | --- | --- | --- |
| `Core/` | Material ownership, capacities, terrain mass and conversion residuals. | Conservative transfer transactions; no engine input. | Empty/full/self transfer, 100 repeated cycles, no duplicate owner. |
| `Simulation/Terrain/` | Chunk state, repose/compaction, dirty bounds and surface query. | Tool/wheel swept region; updated heights/normals. | Cross-tile pile, seam-free dig, compaction preserves mass. |
| `Simulation/ActiveSand/` | Dynamic particles, neighbor search, collision/friction and settling. | Activated material + collider motion; deposited material and impulses. | Fast bucket, overflow, no tunneling, cap exhaustion. |
| `Vehicles/Excavator/` | Joints, actuator limits and digging forces. | Touch target; constrained tool pose and contact work. | Full reach, terrain resistance, release/cancel. |
| `Vehicles/DumpTruck/` | Bed pose, tailgate, load distribution and chassis. | Sand receipt; carrier velocity and discharge. | Loaded turn, steep tip, paused discharge, overflow. |
| `Vehicles/MonsterTruck/` | Tires, suspension, traction and recovery. | Authoritative terrain sample; rut/compaction/contact impulse. | Climb, bottom-out, deep rut, landing and recovery. |
| `Vehicles/WreckingCrane/` | Boom, constrained rope/ball and stability. | Drag/raise controls; contact impulse. | Pendulum energy, block strike, ground strike, reset. |
| `Interaction/` | Finger ownership, contexts and gesture cancellation. | Platform input; semantic tool/camera commands. | Two fingers, out-of-bounds release, pause and rotation. |
| `Presentation/` | Sand surface/grain rendering, vehicle art, lighting and audio. | Simulation state/events; no authoritative mass changes. | Muted mode, reduced motion, stable distant grains. |
| `Persistence/` | Versioned save and recovery. | Snapshot of unique owners; validated restore. | Interrupted save, corrupt latest file, version upgrade. |
| `Diagnostics/` | Bounded traces and deterministic replay. | Frame/solver/input counters; local report. | Benchmark reproducibility and no unbounded logs. |

These are ownership boundaries for later plans, not claims that named code exists today. Begin with a monolithic process and focused components; introduce jobs/compute only where profiling supports the complexity.

## Art and sound work

Use original construction vehicles with readable silhouettes, functional interiors, visible weight, and touch-friendly scale. Make the first shovel/bucket lip and truck-bed seams believable before filling the map with detail. Capture or license separate dry-sand scrape, trickle, dense pour, tire crunch, hydraulic movement and metal impacts. Mix by actual material flow/contact energy. Maintain an asset manifest with source, license, creator and modification record.

A warm daylight palette and restrained dust help James see the sand. “Realistic” means coherent material, machinery and light; photogrammetry, heavy post-processing and desktop-only rendering are optional techniques, not requirements. Assess close-up recordings and moving interaction, not promotional stills.

## GitHub and build workflow

Planning files live in the existing James's Garage repository. Put new implementation under `games/sand-sandbox/`; do not replace `src/`, `public/`, or the current Vite build. Add only path-scoped Unity ignores for Library, Temp, Obj, Logs, UserSettings and local Builds. Commit `.meta` files. Consider Git LFS for large native source assets only after verifying its effects on the existing Pages workflow; `.meta`, source and text scenes remain normal Git files.

Work on `main` as requested for this session. Stage only the task's explicit files. The existing local Monster Skyway gameplay edits belong to other work. Before a push, re-check remote history; reconcile only the new game's changes if needed. Do not dispatch the existing Pages workflow as part of native work.

P0A uses a small package-free .NET check runner. P0B adds Unity edit/play tests and device builds. CI can check the pure kernel separately; Unity and signing tasks need configured editor licensing and protected signing credentials. Add them only after a manual build succeeds. Keep Apple signing material out of Git, game resources, logs and screenshots.

GitHub Pages can host a project page and an intentionally limited browser experiment. A native app goes through Xcode installation, TestFlight or the App Store, not through Pages. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) · [Apple distribution membership](https://developer.apple.com/support/compare-memberships/)

## Resources and decisions

- Start with existing tools and original primitive geometry. No asset, engine plugin, cloud service or Apple membership purchase is required for the planning/accounting stage.
- A suitable Mac or explicitly arranged macOS build service is needed for the proposed Unity iOS route. An actual target iPad remains necessary even with cloud compilation.
- A free Apple Account supports limited personal device testing; Apple Developer Program membership supports distribution and is currently US$99/year. Plan family beta distribution after the native experiment succeeds. [Apple membership](https://developer.apple.com/support/compare-memberships/)
- Check engine/license eligibility before commercial release and before buying packages. Do not assume enterprise physics middleware runs on iPad.
- The first major decision is **can this sand feel right at sustained device speed?** The world size and later arena are downstream of that evidence.

## Requirement coverage

| James's request | Delivery |
| --- | --- |
| Big realistic sandbox | P0B physical proof, P1C world scale and polish |
| Pick up sand and fill dump truck realistically | P0A conservation, P0B contact/flow, P1A full vehicle loop |
| Smooth, satisfying iPad touch | P0B comparative touch tests and all phase 1 device gates |
| Wrecking ball | P1B crane/pendulum and reusable structures |
| Monster truck in the sand | P1B tire/terrain coupling and suspension |
| Construction vehicle racing/fighting | P2A/P2B offline opponents and reversible destruction |
| Kinetic/magnetic-sand feeling | Separate P0B material candidate if prioritized; no claim that dry sand covers molding |
| Apple Developer if needed | Native installation first, membership/distribution at P1D |
| James's GitHub | Existing verified repo; source implemented under `games/sand-sandbox/` |

## Planning handoff

The approved P0A reference source is implemented under [games/sand-sandbox](../../games/sand-sandbox/README.md). The Windows checks report 100 cycles, 50,000 g moved and zero accounting error; physical sand behavior and native device gates remain untested. The [development setup](DEVELOPMENT-SETUP.md) records the Unity toolchain and remaining account/device/build prerequisites. Next, prove an empty signed iPad build, then write and execute the native-lab implementation plan against that measured toolchain.
