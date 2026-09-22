# James's sand sandbox: engine research

Research date: **2026-09-22**. Status: **planning evidence and proposed experiments**. No native prototype, device benchmark, or sand solver was built or measured for this document. Product recommendations are engineering judgments; the linked vendor documentation supports the specific platform facts.

The provisional recommendation is **native Unity with URP**, using **Unity 6.3 LTS as a controlled evaluation baseline**. Commit to an engine only after James can scoop, carry, and pour convincing sand on his actual iPad with sustained smooth performance. The main uncertainty is the combined sand simulation, vehicle interaction, and touch response, rather than whether an engine can display attractive vehicles.

## Engine comparison

| Candidate | Verified capabilities and constraints | Assessment for this project |
| --- | --- | --- |
| Unity native iPadOS | URP supports iOS; HDRP does not. Compute shaders are supported on iOS through Metal. Unity exports an Xcode project for native compilation. | Preferred first experiment: established scene, vehicle, UI, and profiling workflows with room for a custom solver. This is a workflow judgment, not a measured performance advantage. |
| Unreal native iPadOS | Supports native iPadOS development. Its mobile rendering path has different capabilities from desktop; Epic explicitly states that Lumen does not work on iPadOS. | Credible alternative if the team already has substantial Unreal/C++ experience. Desktop showcase graphics should not set the iPad expectation. |
| Godot native iOS | Exports through macOS/Xcode. Compute requires the Forward+ or Mobile renderer. Stable documentation warns about mobile compute driver issues. | Worth considering for open-source control. Validate the intended renderer and shader workload on the target iPad before accepting the integration risk. |
| Custom Apple Metal | Provides low-overhead graphics and compute access to Apple GPUs. | Useful fallback for a focused simulation plugin. Building an entire engine also creates editor, content pipeline, vehicle, UI, and debugging work. |

Platform evidence: [Unity pipeline comparison](https://docs.unity3d.com/6000.3/Documentation/Manual/render-pipelines-feature-comparison.html), [Unity compute platforms](https://docs.unity3d.com/6000.3/Documentation/Manual/class-ComputeShader-introduction.html), [Unity native build process](https://docs.unity3d.com/6000.3/Documentation/Manual/iphone-BuildProcess.html), [Unreal iPadOS support](https://dev.epicgames.com/documentation/unreal-engine/ios-ipados-and-tvos-in-unreal-engine), [Unreal Lumen mobile limitations](https://dev.epicgames.com/documentation/unreal-engine/using-lumen-global-illumination-on-mobile-in-unreal-engine), [Godot iOS export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_ios.html), [Godot compute guidance](https://docs.godotengine.org/en/stable/tutorials/shaders/compute_shaders.html), and [Apple Metal overview](https://developer.apple.com/metal/).

Godot's warning covers mobile generally; it does not establish that a particular iPad has a defect. Likewise, choosing Unity does not establish that the desired sand already exists as a production-ready feature. Any third-party sand asset must pass the same native device tests as our own implementation.

## Why evaluate Unity 6.3 LTS deliberately

Unity currently recommends **Supported Update releases for new and mid-cycle productions**, and LTS for teams nearing a production lock or operating live games. Update releases are production-ready and receive the same QA standard; describing them as unstable would be incorrect. Unity lists 6.3 LTS support through December 2027. [Unity release policy](https://unity.com/releases/unity-6/support)

The proposed LTS baseline is a project choice: keep the initial experiment reproducible while testing custom shaders, input, rendering, and the Apple build chain. Before installing or locking a version, compare the current Supported Update release against 6.3 LTS release notes for relevant Metal, iOS, shader, and performance fixes. Prefer the Update release if it materially solves a verified requirement. Pin the exact editor patch, URP/package versions, and Xcode version only after a successful device build. An LTS label alone is insufficient evidence of compatibility.

## Native app, website, and Apple build access

GitHub Pages hosts static HTML, CSS, and JavaScript from a repository. It is appropriate for the project website, development notes, and a separately scoped browser experiment. Keeping source on GitHub does not make a native app a Pages deployment. A browser prototype can validate gestures and the play loop, but cannot certify a native Metal solver or its thermal performance. [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

Unity generates an Xcode project; Xcode then builds the native application. Local builds require macOS. Unity also documents Build Automation as a cloud alternative when a local Mac is unavailable. Cloud access still needs signing setup and a practical way to install and profile on James's device. [Unity iOS build process](https://docs.unity3d.com/6000.3/Documentation/Manual/iphone-BuildProcess.html)

Unreal supports remote compilation from Windows through a Mac. Its documentation distinguishes C++ projects, which require a Mac for signed builds, from Blueprint-only projects that can ship from Windows. Xcode is required for Apple-device debugging. Because a custom sand implementation may need native code, the plan should include Mac access even if a simple Blueprint experiment avoids it. [Unreal Apple platforms](https://dev.epicgames.com/documentation/unreal-engine/ios-ipados-and-tvos-in-unreal-engine), [Unreal remote builds](https://dev.epicgames.com/documentation/unreal-engine/creating-remote-builds-of-unreal-engine-projects-for-ios)

Godot requires macOS with Xcode for iOS export. A custom Metal application likewise needs an Apple development/build workflow; Metal is a graphics and compute API, not a replacement for the app toolchain. [Godot export requirements](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_ios.html), [Apple development access](https://developer.apple.com/support/compare-memberships/)

## Device support, touch, and native portability

Unity 6.3 lists iPadOS 15+, A8 or newer, Metal, and Xcode 16+ as engine requirements. These are compatibility minima, not a promise that our game can run acceptably on those devices. The final minimum device must come from the representative sandbox benchmark. [Unity 6.3 system requirements](https://docs.unity3d.com/6000.3/Documentation/Manual/system-requirements.html)

App Store submission has a separate gate. Since April 28, 2026, Apple requires App Store Connect uploads to use **Xcode 26 or later and the relevant iOS/iPadOS 26 SDK or later**. Building with a newer SDK is different from requiring that OS on every player device. Recheck submission requirements when configuring builds and before distribution. [Apple current SDK requirement](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)

Apple explicitly lists iPad among devices without built-in haptic feedback. The primary sensation must therefore come from immediate response, believable resistance and release in the animation, convincing sand motion, and synchronized audio. Supported accessories such as Apple Pencil Pro or certain trackpads may offer haptics; they should remain optional. Do not promise that a finger will physically feel grains through the glass. [Apple haptic compatibility](https://developer.apple.com/documentation/corehaptics/preparing-your-app-to-play-haptics?changes=_3&language=objc), [Apple haptic design guidance](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)

Unity's compute guidance documents Metal-specific differences, including unsupported texture atomic operations and buffer `GetDimensions` queries in this path. Buffer bounds, initialization, resource binding, and shader translation need early native validation. A successful Windows shader demo establishes neither iPad correctness nor speed. These constraints concern the documented Unity shader path; they should not be generalized into claims about every capability of every Metal version. [Unity compute portability](https://docs.unity3d.com/6000.3/Documentation/Manual/class-ComputeShader-crossplatform.html)

The proposed simulation should preserve visible volume and convincing material behavior while limiting active expensive work. Compare a volume/heightfield hybrid with a bounded particle or continuum experiment. Neither approach implies simulating every physical grain. The engine decision remains provisional until scoop containment, spilling, pile collapse, tire interaction, and rendering work together within the device budget.

## Costs and licenses to record

An Apple Account permits personal on-device testing without paid enrollment, subject to Personal Team limitations and periodic reprovisioning. Distribution capabilities require the Apple Developer Program, listed at **US$99 per membership year** or local equivalent. Start the experiment with existing access; enrollment is not necessary merely to research or write the game. [Apple membership comparison](https://developer.apple.com/support/compare-memberships/)

Unity Personal currently lists eligibility for individuals and small organizations below **US$200,000 in revenue and funds raised over the preceding 12 months**. Unity states that the Runtime Fee has been canceled. Eligibility depends on the actual developer arrangement; do not infer it from the game's current revenue alone. [Unity Personal](https://unity.com/products/unity-personal), [Unity Runtime Fee announcement](https://unity.com/blog/unity-is-canceling-the-runtime-fee)

Unreal's standard game licensing page lists a **5% royalty on attributable lifetime gross product revenue above US$1 million**, with exceptions described in its terms. Godot uses the MIT license, requires its license notice, and includes third-party components with their own attribution requirements. Recheck applicable terms before commercial distribution or purchasing assets. [Unreal licensing](https://www.unrealengine.com/license), [Godot license obligations](https://docs.godotengine.org/en/stable/about/complying_with_licenses.html)

## Proposed engine commitment gate

Every number below is an initial proposed acceptance target, not an observed result. Record the final protocol before comparing implementations.

1. Identify James's exact iPad model, iPadOS version, and available Mac or hosted Mac access. Select a proposed lower-end supported device separately; no minimum model is decided yet.
2. Build a native scene with one sandbox patch, one working scoop, and a dump-truck bed. Repeat scoop, lift, carry, pour, and pile settling. Add a repeatable wheel-track pass to expose terrain-contact costs.
3. Run a signed device build for **20 minutes** with the same scene, input sequence, graphics settings, and recorded ambient/test conditions. Target **60 fps**; provisionally require frame-interval **P95 at or below 20 ms** and **P99 at or below 33.3 ms**. Record CPU/GPU timings, memory peak, thermal state, and late-session performance. A desktop editor result does not pass this gate.
4. Measure touch-to-visible response with high-speed video where available. Start with proposed median **50 ms or less** and P95 **80 ms or less**. Distinguish measured display latency from internal event timestamps.
5. Compare the two sand approaches using identical controls. Record escaping sand, disappearing volume, unstable piles, bucket leakage, and input lag. Have James compare the feel without rewards or forced objectives; ask which interaction he wants to repeat and why.
6. Accept an engine only when fidelity, touch feel, and sustained performance pass together. If a measured bottleneck justifies a Metal plugin, isolate that experiment before considering a complete engine change.

Remaining unknowns are James's hardware, Mac availability, preferred sand cohesion, intended sandbox scale, available development time, and the cost of achieving the desired material behavior. No available source settles those project-specific questions. The next useful evidence is a small native interaction on the actual iPad.
