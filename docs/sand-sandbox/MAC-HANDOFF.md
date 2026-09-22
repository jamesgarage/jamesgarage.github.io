# James's Sand Yard — continue on the Mac

Updated 2026-09-22. The parent approved development and has now confirmed a **MacBook Air with M2** and an **iPad Pro 12.9-inch, third generation**. Continue the approved native Unity experiment on that Mac. The installed macOS and iPadOS versions still need checking; this Windows session has not accessed the Mac.

## Resume in Codex

Open the repository on the Mac and give Codex this instruction:

> Read docs/sand-sandbox/MAC-HANDOFF.md and continue James's approved iPad sand game. First inspect this Mac's tools, then prepare the pinned Unity project and prove an empty build on the physical iPad. P0A is complete. The target is an iPad Pro 12.9-inch third generation; this Mac is an M2 MacBook Air. Continue on main and preserve unrelated changes.

Use an existing checkout if available. Otherwise, from the folder where you keep projects:

```sh
git clone https://github.com/jamesgarage/jamesgarage.github.io.git james-sand-yard
cd james-sand-yard
```

For an existing checkout, inspect its branch and changes before pulling:

```sh
git branch --show-current
git status --short
git remote -v
git pull --ff-only origin main
```

Run the pull only from `main`; stop and resolve an unexpected branch or conflicting work without resetting, stashing or overwriting it. The local folder name can differ; the repository identity is `jamesgarage/jamesgarage.github.io`.

## What is already delivered

- Approved [design](DESIGN.md), [roadmap](ROADMAP.md), engine/sand research and [middleware comparison](SOLVER-OPTIONS.md).
- P0A source at `games/sand-sandbox/`: bounded loads, conservative transfers, heightfield accounting and reference slope settling.
- Source milestone `2f1483d`; documentation checkpoint `baf7118`. Both were pushed and verified. Later documentation commits advance `main`.
- Independent reviews passed. The Release runner reported 100 cycles, 50,000 g moved, 64,000 g initial/final mass and zero accounting error. The parent also reported a passing run after pulling.
- No playable native game, Unity project import, physical sand behavior or iPad performance has been demonstrated.

The Windows checkout contains unrelated Monster Skyway gameplay edits. Only committed work transfers through Git. Keep new development under `games/sand-sandbox/`, use `main` without branches/worktrees, and put scratch files under root `.tmp/`. The existing Pages deployment is separate and must not be dispatched for native work.

## Inspect the Mac before installing tools

Run these read-only commands from the repository root:

```sh
sw_vers
uname -m
sysctl -n hw.model
df -h .
if xcode-select -p >/dev/null 2>&1; then
    xcode-select -p
    xcodebuild -version
fi
if command -v dotnet >/dev/null 2>&1; then
    dotnet --list-sdks
fi
```

Record the macOS version, host architecture, installed full Xcode version and available disk space. An M2 running a native terminal normally reports `arm64`; inspect a reported `x86_64` before choosing editor architecture. Command Line Tools alone do not supply the full Xcode iPad build workflow.

Ask for the iPadOS version from Settings > General > About, or read it through Xcode after the parent connects and trusts the iPad. Do not infer the installed OS from the model's compatibility list.

## Install and verify the native toolchain

1. Select a stable **full Xcode** version whose supported macOS range includes the observed Mac version and whose device support covers the installed iPadOS. Check [Apple's Xcode matrix](https://developer.apple.com/xcode/system-requirements/), then verify compatibility with Unity's pinned editor. Open Xcode to complete its required setup. Do not assume the newest Xcode is the right version for an unknown installed OS.
2. Install Unity Hub on the Mac, sign in and confirm the intended license is active. The parent handles account and license steps; no paid membership or asset purchase has been authorized. [Unity Hub](https://unity.com/download) · [Unity license activation](https://docs.unity.com/en-us/hub/manage-license)
3. Install **Unity 6000.3.24f1 LTS, Apple silicon**, with **iOS Build Support**. Unity 6.3 lists macOS Ventura 13+ and M1+ for the Apple silicon editor; Xcode can impose a newer macOS requirement. Unity also lists Rosetta 2 as a prerequisite on Apple silicon: verify its availability for the installed macOS before installing the editor. Record the actual editor version and successful launch. [Unity requirements](https://docs.unity3d.com/6000.3/Documentation/Manual/system-requirements.html)
4. If the .NET check runner is needed on this Mac, install the .NET 10 SDK for the host architecture and run the command below. This is a development check, not the iPad runtime.

```sh
dotnet run --project games/sand-sandbox/checks/SandCoreChecks.csproj -c Release
```

Expected final lines:

```text
cycles,transferred_g,initial_g,final_g,error_g
100,50000,64000,64000,0
PASS: all sand-core checks
```

The Windows silent editor install failed with a generic installer error. That attempt does not establish a Mac problem. There is no need to finish Windows editor installation before continuing here.

## First native deliverable

Create and import a minimal **URP** project using the installed editor's actual template and packages. The existing `games/sand-sandbox/unity/` contains core source only; preserve it when adding the generated project. If Hub requires an empty destination, generate the template under root `.tmp/` and merge only its source/project scaffolding into the target, preserving existing core files. Keep generated caches and local builds ignored. Commit editor-generated `.meta` files, `ProjectSettings`, package manifest and package lock after a successful import; do not invent GUIDs or package versions.

Use a plain camera/light/test object scene to verify rendering. Configure an iPad build, export its Xcode project into the ignored local `unity/Builds/` directory, and open it in Xcode. The parent selects their signing team, connects/trusts the iPad and completes any required Developer Mode prompt. Build and launch on the physical iPad. Unity exports the project and Xcode performs the native build/signing stage. [Unity iOS build process](https://docs.unity3d.com/6000.3/Documentation/Manual/iphone-BuildProcess.html)

Record the source commit, editor/packages, Xcode/SDK, device/iPadOS, successful install/launch and any concrete failure. This empty scene proves the build route only. After it succeeds, write the detailed native-tray plan against the installed APIs, then implement bucket contact, active sand, tilting-bed flow, touch, audio and diagnostics from [P0B](ROADMAP.md#p0b-the-experiment-that-decides-the-project). No second approval of the already accepted game design is needed.

## Device baseline and acceptance

Apple identifies this iPad's A12X Bionic chip, 2732 × 2048 display, ProMotion and USB-C. Apple also explicitly lists it as compatible with iPadOS 26; that does not establish its installed version or support for every newer OS. [Device specifications](https://support.apple.com/en-us/111979) · [iPadOS 26 compatibility](https://support.apple.com/en-us/123706)

Use this physical iPad as the first performance/feel target. Its display specification does not establish achievable game frame rate, and its memory capacity has not been confirmed. The approved 60 fps target, 20-minute run, touch-latency measurements, conservation checks and James's play observations remain [proposed acceptance gates](DESIGN.md#proposed-performance-and-quality-gates). Profile bounded active sand and render resolution on this device before expanding the world or making realism claims.
