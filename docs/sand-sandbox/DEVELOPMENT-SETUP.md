# Native development setup

Status checked 2026-09-22. The game design and P0A plan are approved. This document records the next native build prerequisites; it is not evidence of an iPad build or performance result.

**Current route:** the parent confirmed an **M2 MacBook Air** and **iPad Pro 12.9-inch, third generation, running iPadOS 26.6.2**, and agreed to move development to the Mac. Follow [MAC-HANDOFF.md](MAC-HANDOFF.md). Installed macOS and Mac tools remain unverified; iPadOS is parent-reported. The Windows findings below are historical setup evidence; completing the Windows editor installation is no longer a prerequisite.

## Confirmed tools

- Windows 11 x64 workstation, 32 GB class memory, discrete NVIDIA GPU and sufficient disk space for the editor.
- .NET SDK 10.0.401 runs the package-free reference checks.
- Unity Hub 3.21.3.65535 and Unity CLI 1.0.0-beta.10 installed for the current user.
- Trial editor pin: **6000.3.24f1 LTS**, changeset `4e7b9b5b6244`, with iOS Build Support. The non-elevated silent install failed; neither the editor nor iOS module is installed.

The editor pin is an experiment choice, not a production engine commitment. The [Unity release service](https://docs.unity.com/en-us/oas-release/1.0.0) supplies the exact release/module metadata. [Unity 6.3 LTS](https://unity.com/blog/unity-6-3-lts-is-now-available) is the selected support stream.

## Account step

Open Unity Hub and sign in to the account that will develop this family project. Confirm the intended license is active under Settings > Licenses. For an eligible Unity Personal account, sign-in normally activates the license; the Hub provides a manual free-license option if needed. No account credentials or license files belong in the repository. [Unity license activation](https://docs.unity.com/en-us/hub/manage-license)

No paid asset, Apple membership or cloud build service has been purchased. License eligibility and account terms must be handled by the account owner.

## Reproduce the editor installation

From a PowerShell session where the installed `unity` CLI is available:

```powershell
unity --version
unity install --help
unity install-path --set "$env:LOCALAPPDATA\Unity\Editors"
unity install 6000.3.24f1 -m ios --dry-run
unity install 6000.3.24f1 -m ios --no-elevate --accept-eula
```

The verified dry run includes only the x86_64 editor and `ios` module, approximately 4.47 GB of downloads. The beta CLI can change; inspect its help before repeating commands with another version. [Unity CLI reference](https://docs.unity.com/en-us/unity-cli/unity-cli-reference)

**Observed install result:** the editor installer downloaded, matched the Unity release feed's checksum, and launched at the intended user-writable location. It returned a generic failure; the CLI reported `INSTALL_FAILED: 2 item(s) failed to install`. The iOS module could not install because its parent editor failed. `unity editors --installed` remained empty. The exact installer cause is unknown; this is not evidence of a license or Windows policy rejection. The CLI's `--no-elevate` flag skips its helper's elevation but does not guarantee the editor installer will never request elevation.

**Windows fallback only:** if Windows authoring is wanted later, use Unity Hub interactively to expose any installer prompt or error before retrying automation. Native work now proceeds on the confirmed Mac. No security controls were changed and no elevated retry was made.

Do not select the optional Visual Studio installation for the initial editor/C# checks. A later Windows IL2CPP build would need its own C++/Windows SDK toolchain.

## First native build gate

Record these facts before advancing from setup to the sand simulation experiment:

1. Unity editor launches with a valid license, and the exact version is captured.
2. The parent-reported iPadOS 26.6.2 on the iPad Pro 12.9-inch third generation is confirmed when Xcode connects to the device.
3. The confirmed M2 MacBook Air's macOS and compatible full Xcode installation are verified.
4. An empty URP project at `games/sand-sandbox/unity/` imports successfully. Commit the editor-generated project settings, package lock and `.meta` files. The existing `Assets/SandYard/Core/` source folder alone is not a Unity project.
5. The empty project builds, signs, installs and launches on the physical iPad. Record editor/package/Xcode/SDK/device versions and source commit.

Unity's Windows editor can author the project and generate an Xcode project with iOS Build Support. The final native compile and signing require the macOS/Xcode build stage. [Unity iOS build process](https://docs.unity3d.com/6000.3/Documentation/Manual/iphone-BuildProcess.html)

After that empty-device proof, implement the instrumented tray, bucket and tilting-bed experiment in the [roadmap](ROADMAP.md#p0b-the-experiment-that-decides-the-project). Its physical behavior and touch/performance gates remain untested. P0A's exact accounting result cannot substitute for them.
