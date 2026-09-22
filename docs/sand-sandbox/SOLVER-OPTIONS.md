# Sand middleware: build or adapt

Research checked 2026-09-22. This is a documentation assessment, not a package test or purchase. The [design's native acceptance gates](DESIGN.md#proposed-performance-and-quality-gates) remain authoritative.

## Decision

**Evaluate Obi's granular mode before committing to a completely custom active-sand solver.** Its documented rigid-sphere contacts, friction, moving-collider support and accessible particle state make it a relevant candidate. It could supply part of the simulation; it does not supply the complete terrain, excavation, vehicle and touch experience.

Keep the P0A accounting core independent. If an appropriately licensed Obi package is available, compare it against the reference/custom active-sand candidate in one bounded native scene. Otherwise continue with the in-house experiment after design approval. Do not make progress depend on an unapproved asset purchase.

## Candidate comparison

| Candidate | Relevant evidence | Unresolved issue | Proposed decision |
| --- | --- | --- | --- |
| Obi Fluid granular mode | Separate granular particles, contact friction, CPU/Burst and GPU/Compute backends, source and particle access. | Exact current package/editor/iPad combination, fine-sand appearance, leakage, terrain handoff cost and sustained performance. | First middleware experiment if a license is available. |
| Zibra Liquid / Effects | Liquid simulation, mesh collision tools and advertised iOS/Metal support. | No verified dry-sand constitutive model or documented granular-law extension point; current compatibility needs confirmation. | Do not choose for the dry-sand core on existing evidence. |
| NVIDIA FleX 1.2 | Unified constrained particle simulation with moving shapes. | Legacy unsupported Windows/Linux SDK; no supported iOS/Metal target. | Exclude from the native iPad implementation. |
| In-house active particles | Full control of conserved mass, collision integration and custom material behavior. | Most engineering and validation work; iPad performance unmeasured. | Baseline/fallback, with tightly bounded PBD/XPBD research before a larger MPM commitment. |

This table is a project recommendation derived from the sources below. “Qualified for an experiment” does not mean “qualified to ship.”

## Obi: a relevant granular candidate

The accessible **7.1** manual distinguishes granular particles that act as rigid spheres from fluid particles constrained toward constant density. Collision materials separately expose static, dynamic and rolling friction, plus stickiness. These are pertinent controls for pile stability and sliding; they do not establish a calibrated sand model or kinetic-sand behavior. [Emitter blueprints](https://obi.virtualmethodstudio.com/manual/7.1/emittermaterials.html) · [Collision materials](https://obi.virtualmethodstudio.com/manual/7.1/collisionmaterials.html)

Obi documents Burst and Compute backends. The CPU path uses Unity's Burst/Jobs support; the GPU path uses compute shaders. The manual describes source availability for both and warns that GPU execution has overhead that can make smaller workloads less efficient. Begin the integration experiment with the CPU path so transfers are easy to inspect, then measure Compute using identical interactions on iPad. This is an experiment order, not a claim that CPU will win. [Backend manual](https://obi.virtualmethodstudio.com/manual/7.1/backends.html)

Unity documents iOS ARM64 Burst output and static libraries. That establishes an engine route for compatible Burst code, not certification of our Obi configuration. The signed IL2CPP build must still be tested on the selected device. [Unity Burst build support](https://docs.unity3d.com/Packages/com.unity.burst@1.8/manual/building-projects.html)

The collision system supports Unity colliders, signed-distance representations and Rigidbody coupling. The particle API exposes CPU state and GPU buffers with synchronization considerations. Use these capabilities to test a moving bucket, tilting bed and controlled particle-to-terrain conversion. Do not copy the entire particle state synchronously from GPU to CPU every frame merely to update a payload counter; measure the boundary and keep ownership transitions explicit. [Collisions](https://obi.virtualmethodstudio.com/manual/7.1/collisions.html) · [Particle access](https://obi.virtualmethodstudio.com/manual/7.1/scriptingparticles.html) · [Source availability FAQ](https://obi.virtualmethodstudio.com/faq.html)

**Version caveat:** the live Asset Store listing shows **7.2**, released **August 26, 2026**, with original Unity version **6000.0.82**. The detailed manual inspected here was 7.1. Verify the acquired package's APIs, import requirements, render-pipeline support and release notes before writing an adapter. Do not blindly install old preview-package versions from an older manual. [Current Obi listing](https://assetstore.unity.com/packages/tools/physics/obi-fluid-63067)

### What we still have to build

- Persistent, sleeping terrain tiles with mass, density and dirty regions.
- Swept excavation that activates the correct material rather than spawning a visual effect inside a bucket.
- Container association, settled payloads, overflow and conservative representation changes.
- Vehicle actuator resistance, load effects, tire support and traction.
- Fine grain rendering driven by the physical state, touch ownership, sound, save/recovery and profiling.

Rigid spheres can also look like gravel, creep under load or behave poorly at a chosen resolution. A successful API integration is not a successful sand experience.

## Zibra: liquid evidence does not prove sand

The vendor describes a liquid MLS-MPM solver and liquid features such as viscosity, surface tension, mixing and foam. MPM identifies a numerical method, not a particular dry-sand friction/yield model. The examined official material did not establish that the product supports the material law this game needs. [Solver description](https://www.zibra.ai/blog-posts/approaches-to-real-time-fluid-simulation-in-visual-effects) · [Feature description](https://www.zibra.ai/blog-posts/setting-new-standards-how-zibra-effects-advanced-real-time-simulations-bring-liquid-smoke-and-fire-to-life-in-gaming)

The current platform page lists iOS/Metal, but some platform text is inconsistent, and the linked current documentation was not retrievable through the research browser. Older vendor forum claims about iOS support are historical evidence only. Do not turn them into an exact current Unity/iPad compatibility claim. [Platform page](https://www.zibra.ai/plugin) · [Vendor support thread](https://discussions.unity.com/t/zibra-liquids/874776)

Mesh colliders, force fields and volume detectors may be useful for later liquids or effects. Public C# integration does not itself prove source access to the solver or an extension point for adding a granular material law. Obtain those facts before considering it for anything beyond the documented liquid use. [Product description](https://www.zibra.ai/zibra-liquid-smoke-effects)

## FleX: useful research, unsuitable deployment target

NVIDIA marks FleX as a legacy SDK without ongoing support. Its official requirements list Windows and Linux targets, using CUDA or DirectX paths, rather than iOS/Metal. DirectX compatibility includes some AMD and Intel GPUs, so the disqualifier is not simply NVIDIA hardware. It is the lack of the required supported Apple deployment path. [Official requirements](https://developer.nvidia.com/flex-example)

The core solver is closed source; provided extension/demo code does not constitute a portable source implementation of the solver. Its methods remain useful background research, but adopting it would not resolve this game's native iPad requirement. [FleX manual](https://nvidiagameworks.github.io/FleX/1.2/lib_docs/manual.html)

## License and public-repository boundary

The examined Obi Fluid and Zibra Liquid Asset Store listings identify them as **Extension Assets** under the **Standard Unity Asset Store EULA**. Those terms include seat requirements and restrictions on redistributing assets as standalone source. Included source does not make a package open source. Review the applicable license for the acquired version and developer arrangement before using it. [Obi listing](https://assetstore.unity.com/packages/tools/physics/obi-fluid-63067) · [Zibra listing](https://assetstore.unity.com/packages/tools/physics/zibra-liquid-266451) · [Unity Asset Store terms](https://unity.com/legal/as-terms)

For this public James's Garage repository, keep proprietary vendor package contents out of Git. Commit our adapter, configuration instructions and tested version identifier; arrange licensed dependency restoration privately. Keep the independently useful accounting checks runnable without the commercial package. Zibra's separate website subscription is a different acquisition route and must not be assumed to have identical rights. No paid dependency has been selected or acquired.

## Bounded evaluation protocol

After the existing design review, use the same P0B tray, tool motions and native gate table for each candidate:

1. Import the legitimate package into the selected Unity patch, compile a signed iPad build, and verify the actual backend in its logs. Record all versions and graphics settings.
2. Form a pile, stop input, and observe slope, relaxation and sleeping-pile creep. Compare to the chosen physical sand reference.
3. Scoop, accelerate, carry, curl and pour with a closed bucket interior and a thin lip. Inspect leakage at slow motion and maximum permitted tool speed.
4. Tilt and accelerate a loaded bed. Confirm the stream inherits carrier motion and that payload accounting counts every particle once.
5. Convert material between resting terrain and active particles for 100 scripted cycles. Verify exact ledger transitions and the physical conservation tolerance from the design.
6. Run the existing particle-budget sweep for 20 minutes on the physical iPad. Include synchronization and rendering costs, not just solver time. Compare Burst and Compute only with equivalent scene/material quality.
7. Let James compare the same scooping/pouring interaction. Reject a candidate that meets performance but looks or feels like the wrong material.

Only adopt middleware if it passes fidelity, integration and sustained device response together. Record why the selected route improves the project; do not assume an impressive vendor demo answers those questions.
