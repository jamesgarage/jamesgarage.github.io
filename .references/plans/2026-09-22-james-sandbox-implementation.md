# James's Sand Yard P0A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tested, conservative sand-accounting reference kernel that supports a reproducible scoop-to-truck-to-ground cycle on the confirmed Windows development environment.

**Architecture:** Plain C# owns mass and capacities independently of a game engine. A fixed-density grid supplies the first terrain reference; bounded stores represent bucket, airborne and truck-bed mass, and a package-free console runner exercises invariants. The later native lab replaces shortcut transfers with physical contact and flow while retaining these accounting checks.

**Tech Stack:** C# 9 runtime source; .NET 10 check runner using the installed SDK 10.0.401; Git on main. Unity 6.3 LTS/URP/Metal is the provisional downstream engine and is not installed or required for this milestone.

**Spec:** [P0A core specification](../../docs/sand-sandbox/CORE-SPEC.md). Also read the [game design](../../docs/sand-sandbox/DESIGN.md), [research](../../docs/sand-sandbox/SAND-RESEARCH.md) and [full roadmap](../../docs/sand-sandbox/ROADMAP.md).

## Global Constraints

- Runtime core: plain C# 9, no Unity API or external package dependencies.
- Check runner: .NET 10 console executable, matching the installed 10.0.401 SDK; runtime source must remain compatible with Unity's C# subset.
- Units: integer grams for mass, metres for length, kilograms per cubic metre for density, degrees for repose angle.
- Every transfer conserves mass exactly and returns the actual grams moved.
- Empty sources, full destinations, zero requests and self-transfer move zero grams.
- Negative requests, invalid dimensions, invalid densities and invalid angles are rejected before state changes.
- The reference terrain is a single-height grid with fixed density and cardinal-neighbour relaxation; no overhangs, cohesion, compaction or momentum solver.
- P0A has no rendering, touch, sound, vehicle physics or native iPad performance claim.
- New implementation stays under games/sand-sandbox/; existing Monster Skyway files and unrelated changes are not part of this task.
- Work on main; no branches or worktrees; scratch output goes in .tmp/.

---

## Status and execution boundary

This is a ready-to-review plan, not a completed implementation. All implementation steps remain unchecked. The code below is a proposed reference implementation and its tests. The planning session may compile extracted examples in ignored scratch space to check this document; that does not create or deliver the game source.

The user's immediate request includes research and planning for a much larger game. P0A is intentionally one small deliverable. P0B, described in the roadmap, is the decisive native sand-and-touch experiment. Wrecking ball, monster truck, large map and races remain explicit later milestones, not missing features of an alleged finished app.

## File map

All paths are relative to `C:/Users/yaniv.alfasy/kids/Monster-Skyway`.

| Path | Responsibility |
| --- | --- |
| `games/sand-sandbox/unity/Assets/SandYard/Core/Load.cs` | Bounded mass store and conservative transfers. |
| `games/sand-sandbox/unity/Assets/SandYard/Core/SandField.cs` | Cell mass, height, scoop/deposit and reference repose relaxation. |
| `games/sand-sandbox/checks/SandCoreChecks.csproj` | Compile the runtime files and console checks without Unity. |
| `games/sand-sandbox/checks/Program.cs` | Invariant cases and repeatable 100-cycle check; exit nonzero on failure. |
| `games/sand-sandbox/.gitignore` | Ignore only this project's generated build directories. |
| `games/sand-sandbox/README.md` | Run command, result meaning and native-lab handoff. |
| `.tmp/sand-core/` | Ignored logs and temporary validation outputs. |

The `unity/Assets` directory is only a source location at P0A. Do not claim it is an importable Unity project until P0B creates the actual project settings, packages and generated `.meta` files. Do not create guessed Unity GUIDs.

## Task 1: bounded stores and transfer invariants

**Files:** create `Load.cs`, `SandCoreChecks.csproj`, `Program.cs` and the scoped `.gitignore` above.

**Interfaces:** consumes no previous runtime code. Produces `SandYard.Core.Load(long capacityGrams, long grams = 0)`, read-only `Grams`/`CapacityGrams`, and `SandTransfer.Move(Load source, Load destination, long requestedGrams) -> long`.

- [ ] **Step 1: confirm the target and create the check project.** Run these read-only commands from the target repository; stop if the current branch is not main. Preserve the existing game's dirty paths.

```powershell
git branch --show-current
git status --short
dotnet --list-sdks
```

Create `games/sand-sandbox/.gitignore` with:

```gitignore
checks/bin/
checks/obj/
unity/Library/
unity/Temp/
unity/Obj/
unity/Logs/
unity/UserSettings/
unity/Builds/
```

Create `SandCoreChecks.csproj` with:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>9.0</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>disable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="../unity/Assets/SandYard/Core/*.cs" Link="Core/%(Filename)%(Extension)" />
  </ItemGroup>
</Project>
```

- [ ] **Step 2: write the failing transfer checks.** Create `Program.cs` below. Task 2 and Task 3 will add methods and calls explicitly; do not add empty methods in advance.

```csharp
using System;
using SandYard.Core;

internal static class Program
{
    private static void Equal(long expected, long actual, string label)
    {
        if (expected != actual)
            throw new Exception(label + ": expected " + expected + ", got " + actual);
    }

    private static void Require(bool condition, string label)
    {
        if (!condition) throw new Exception(label);
    }

    private static void Reject<T>(Action action) where T : Exception
    {
        try { action(); }
        catch (T) { return; }
        throw new Exception("Expected " + typeof(T).Name);
    }

    private static void CheckTransfers()
    {
        var source = new Load(100, 100);
        var destination = new Load(50, 20);
        Equal(30, SandTransfer.Move(source, destination, 90), "capacity clamp");
        Equal(70, source.Grams, "source debit");
        Equal(50, destination.Grams, "destination credit");
        Equal(120, source.Grams + destination.Grams, "combined total");
        Equal(0, SandTransfer.Move(source, destination, 1), "full destination");
        Equal(0, SandTransfer.Move(source, source, 20), "self transfer");
        Equal(0, SandTransfer.Move(source, new Load(20), 0), "zero request");
        Equal(0, SandTransfer.Move(new Load(10), new Load(20), 10), "empty source");
        Reject<ArgumentOutOfRangeException>(() => SandTransfer.Move(source, destination, -1));
        Reject<ArgumentNullException>(() => SandTransfer.Move(null!, destination, 1));
        Reject<ArgumentOutOfRangeException>(() => new Load(-1));
        Reject<ArgumentOutOfRangeException>(() => new Load(10, 11));
        Equal(120, source.Grams + destination.Grams, "rejections did not mutate");
    }

    private static int Main()
    {
        try
        {
            CheckTransfers();
            Console.WriteLine("PASS: transfer checks");
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.ToString());
            return 1;
        }
    }
}
```

- [ ] **Step 3: run the checks and observe the missing-core failure.**

```powershell
dotnet run --project games/sand-sandbox/checks/SandCoreChecks.csproj -c Release
```

Expected: nonzero exit and a compiler error for missing `SandYard.Core`/`Load`; not a missing SDK or restore/network error. Fix tooling failures separately.

- [ ] **Step 4: implement the bounded stores.** Create `Load.cs` with:

```csharp
using System;

namespace SandYard.Core
{
    public sealed class Load
    {
        public long CapacityGrams { get; }
        public long Grams { get; private set; }

        public Load(long capacityGrams, long grams = 0)
        {
            if (capacityGrams < 0 || grams < 0 || grams > capacityGrams)
                throw new ArgumentOutOfRangeException(nameof(capacityGrams));
            CapacityGrams = capacityGrams;
            Grams = grams;
        }

        internal void Credit(long grams)
        {
            if (grams < 0 || grams > CapacityGrams - Grams)
                throw new ArgumentOutOfRangeException(nameof(grams));
            Grams += grams;
        }

        internal void Debit(long grams)
        {
            if (grams < 0 || grams > Grams)
                throw new ArgumentOutOfRangeException(nameof(grams));
            Grams -= grams;
        }
    }

    public static class SandTransfer
    {
        public static long Move(Load source, Load destination, long requestedGrams)
        {
            if (source == null) throw new ArgumentNullException(nameof(source));
            if (destination == null) throw new ArgumentNullException(nameof(destination));
            if (requestedGrams < 0)
                throw new ArgumentOutOfRangeException(nameof(requestedGrams));
            if (ReferenceEquals(source, destination)) return 0;
            long grams = Math.Min(requestedGrams,
                Math.Min(source.Grams, destination.CapacityGrams - destination.Grams));
            source.Debit(grams);
            destination.Credit(grams);
            return grams;
        }
    }
}
```

- [ ] **Step 5: rerun the command from Step 3.** Expected: exit 0 and `PASS: transfer checks`. Inspect the tests; deliberately removing the capacity clamp must cause failure, then restore it. This checks a meaningful conservation/capacity requirement.
- [ ] **Step 6: inspect and commit only these files.**

```powershell
git add -- games/sand-sandbox/.gitignore games/sand-sandbox/checks/SandCoreChecks.csproj games/sand-sandbox/checks/Program.cs games/sand-sandbox/unity/Assets/SandYard/Core/Load.cs
git diff --cached --stat
git diff --cached --check
git commit -m "feat(sand): add conservative material stores"
```

Do not commit if the staged diff includes unrelated paths.

## Task 2: fixed-density terrain and conservative settling

**Files:** create `SandField.cs`; modify `Program.cs`.

**Interfaces:** consumes `Load` and its internal debit/credit operations from Task 1. Produces the constructor, accessors, `Scoop`, `Deposit`, and `Relax` defined in the core spec. The core classes remain in one assembly.

- [ ] **Step 1: add terrain checks before implementing terrain.** Add this method inside `Program` and call `CheckTerrain();` immediately after `CheckTransfers();` in `Main`.

```csharp
private static void CheckTerrain()
{
    var field = new SandField(9, 9, 0.125, 1600, 0);
    var pile = new Load(64000, 64000);
    Equal(64000, field.Deposit(4, 4, pile, 64000), "seed pile");
    Equal(0, pile.Grams, "seed source emptied");
    Require(Math.Abs(field.HeightAt(4, 4) - 2.56) < 1e-10, "mass to height units");
    var bucket = new Load(500);
    Equal(500, field.Scoop(4, 4, bucket, 1000), "bounded scoop");
    Equal(63500, field.TotalGrams, "terrain debited");
    Equal(0, field.Scoop(4, 4, bucket, 1), "full bucket");
    Equal(500, field.Deposit(4, 4, bucket, 1000), "bounded deposit");
    Equal(0, field.Deposit(4, 4, bucket, 1000), "empty deposit");
    Reject<ArgumentOutOfRangeException>(() => field.Scoop(4, 4, bucket, -1));
    Reject<ArgumentOutOfRangeException>(() => field.Deposit(4, 4, bucket, -1));
    Reject<ArgumentOutOfRangeException>(() => field.Scoop(-1, 0, bucket, 1));
    Reject<ArgumentOutOfRangeException>(() => field.Relax(double.NaN));
    Reject<ArgumentOutOfRangeException>(() => field.Relax(89));
    Reject<ArgumentOutOfRangeException>(() => new SandField(0, 1, 1, 1600, 0));
    Reject<ArgumentOutOfRangeException>(() => new SandField(1, 1, 0, 1600, 0));
    Reject<ArgumentOutOfRangeException>(() => new SandField(1, 1, 1, double.PositiveInfinity, 0));
    Reject<OverflowException>(() => new SandField(2, 1, 1, 1600, long.MaxValue));
    Equal(64000, field.TotalGrams, "rejections did not change terrain");

    var full = new SandField(1, 1, 1, 1600, long.MaxValue);
    var extra = new Load(1, 1);
    Reject<OverflowException>(() => full.Deposit(0, 0, extra, 1));
    Equal(1, extra.Grams, "overflow preserves source");
    Equal(long.MaxValue, full.MassAt(0, 0), "overflow preserves cell");

    for (int sweep = 0; sweep < 5000; sweep++)
        if (field.Relax(31) == 0) break;
    long sum = 0;
    double maxDifference = 0;
    for (int z = 0; z < field.Depth; z++)
    for (int x = 0; x < field.Width; x++)
    {
        Require(field.MassAt(x, z) >= 0, "nonnegative cell");
        sum += field.MassAt(x, z);
        if (x + 1 < field.Width)
            maxDifference = Math.Max(maxDifference,
                Math.Abs(field.HeightAt(x, z) - field.HeightAt(x + 1, z)));
        if (z + 1 < field.Depth)
            maxDifference = Math.Max(maxDifference,
                Math.Abs(field.HeightAt(x, z) - field.HeightAt(x, z + 1)));
    }
    Equal(64000, sum, "settling preserves mass");
    Equal(sum, field.TotalGrams, "counter matches cells");
    double allowed = Math.Tan(31 * Math.PI / 180) * field.CellSideMetres
        + 2.0 / field.GramsPerHeightMetre;
    Require(maxDifference <= allowed + 1e-10, "pile reaches repose bound");
    Require(field.MassAt(4, 4) < 64000, "pile actually spreads");
}
```

- [ ] **Step 2: run `dotnet run --project games/sand-sandbox/checks/SandCoreChecks.csproj -c Release`.** Expected: nonzero compilation failure for missing `SandField`.
- [ ] **Step 3: create the reference terrain implementation.**

```csharp
using System;

namespace SandYard.Core
{
    public sealed class SandField
    {
        private readonly long[] mass;
        public int Width { get; }
        public int Depth { get; }
        public double CellSideMetres { get; }
        public double GramsPerHeightMetre { get; }
        public long TotalGrams { get; private set; }

        public SandField(int width, int depth, double cellSideMetres,
            double densityKgPerM3, long initialGramsPerCell)
        {
            if (width <= 0 || depth <= 0 || initialGramsPerCell < 0)
                throw new ArgumentOutOfRangeException(nameof(width));
            if (!PositiveFinite(cellSideMetres) || !PositiveFinite(densityKgPerM3))
                throw new ArgumentOutOfRangeException(nameof(cellSideMetres));
            int count = checked(width * depth);
            long total = checked(initialGramsPerCell * count);
            double scale = cellSideMetres * cellSideMetres * densityKgPerM3 * 1000;
            if (!PositiveFinite(scale))
                throw new ArgumentOutOfRangeException(nameof(densityKgPerM3));
            Width = width;
            Depth = depth;
            CellSideMetres = cellSideMetres;
            GramsPerHeightMetre = scale;
            TotalGrams = total;
            mass = new long[count];
            for (int i = 0; i < count; i++) mass[i] = initialGramsPerCell;
        }

        private static bool PositiveFinite(double value)
            => value > 0 && !double.IsNaN(value) && !double.IsInfinity(value);

        private int Index(int x, int z)
        {
            if (x < 0 || x >= Width || z < 0 || z >= Depth)
                throw new ArgumentOutOfRangeException(nameof(x));
            return z * Width + x;
        }

        private static void Validate(Load load, long request)
        {
            if (load == null) throw new ArgumentNullException(nameof(load));
            if (request < 0) throw new ArgumentOutOfRangeException(nameof(request));
        }

        public long MassAt(int x, int z) => mass[Index(x, z)];
        public double HeightAt(int x, int z) => MassAt(x, z) / GramsPerHeightMetre;

        public long Scoop(int x, int z, Load destination, long requestedGrams)
        {
            Validate(destination, requestedGrams);
            int i = Index(x, z);
            long moved = Math.Min(requestedGrams,
                Math.Min(mass[i], destination.CapacityGrams - destination.Grams));
            destination.Credit(moved);
            mass[i] -= moved;
            TotalGrams -= moved;
            return moved;
        }

        public long Deposit(int x, int z, Load source, long requestedGrams)
        {
            Validate(source, requestedGrams);
            int i = Index(x, z);
            long moved = Math.Min(requestedGrams, source.Grams);
            long nextTotal = checked(TotalGrams + moved);
            long nextCell = checked(mass[i] + moved);
            source.Debit(moved);
            mass[i] = nextCell;
            TotalGrams = nextTotal;
            return moved;
        }

        public long Relax(double reposeDegrees)
        {
            if (double.IsNaN(reposeDegrees) || reposeDegrees < 0 || reposeDegrees >= 89)
                throw new ArgumentOutOfRangeException(nameof(reposeDegrees));
            double maxRise = Math.Tan(reposeDegrees * Math.PI / 180) * CellSideMetres;
            long activity = 0;
            for (int z = 0; z < Depth; z++)
            for (int x = 0; x < Width; x++)
            {
                int i = z * Width + x;
                if (x + 1 < Width) activity = SaturatingAdd(activity, RelaxPair(i, i + 1, maxRise));
                if (z + 1 < Depth) activity = SaturatingAdd(activity, RelaxPair(i, i + Width, maxRise));
            }
            return activity;
        }

        private static long SaturatingAdd(long a, long b)
            => b > long.MaxValue - a ? long.MaxValue : a + b;

        private long RelaxPair(int a, int b, double maxRise)
        {
            int high = mass[a] >= mass[b] ? a : b;
            int low = high == a ? b : a;
            double excessGrams = (double)mass[high] - mass[low] - maxRise * GramsPerHeightMetre;
            if (excessGrams <= 0) return 0;
            long moved = (long)Math.Min(mass[high] / 2.0, Math.Floor(excessGrams / 2.0));
            mass[high] -= moved;
            mass[low] += moved;
            return moved;
        }
    }
}
```

`activity` saturates because the same mass can cross many pairs in a sweep. The mass itself never saturates. This is a deliberately slow sequential reference, not the production solver.

- [ ] **Step 4: run the checks again and inspect the result.** Expected: exit 0. Change the success message to `PASS: transfer and terrain checks`. Check both exact mass and the slope bound; a solver that never moves anything must fail the spread/slope assertions.
- [ ] **Step 5: stage only the two task files and commit.**

```powershell
git add -- games/sand-sandbox/unity/Assets/SandYard/Core/SandField.cs games/sand-sandbox/checks/Program.cs
git diff --cached --check
git diff --cached --stat
git commit -m "feat(sand): add conservative reference terrain"
```

## Task 3: reproducible transfer cycle and truthful handoff

**Files:** modify `Program.cs`; create `games/sand-sandbox/README.md`.

**Interfaces:** consumes all Task 1/2 types. Produces an executable 100-cycle accounting acceptance check and a documented native-lab boundary. No new runtime interfaces.

- [ ] **Step 1: add the cycle check below to `Program`, and call `CheckCycles();` after `CheckTerrain();`.** The cycle is a test of the already implemented API, so it may pass immediately; do not manufacture a failing production change. Verify its failure sensitivity separately.

```csharp
private static void CheckCycles()
{
    var ground = new SandField(8, 8, 0.125, 1600, 1000);
    var bucket = new Load(500);
    var flow = new Load(500);
    var bed = new Load(2000);
    long initial = ground.TotalGrams;
    long movedTotal = 0;
    Action checkTotal = () => Equal(initial,
        ground.TotalGrams + bucket.Grams + flow.Grams + bed.Grams, "cycle conservation");
    for (int cycle = 0; cycle < 100; cycle++)
    {
        int x = cycle % 8;
        int z = (cycle / 8) % 8;
        Equal(500, ground.Scoop(x, z, bucket, 500), "scoop");
        checkTotal();
        Equal(500, SandTransfer.Move(bucket, flow, 500), "bucket to flow");
        checkTotal();
        Equal(500, SandTransfer.Move(flow, bed, 500), "flow to bed");
        checkTotal();
        Equal(500, SandTransfer.Move(bed, flow, 500), "bed to flow");
        checkTotal();
        Equal(500, ground.Deposit((x + 1) % 8, z, flow, 500), "flow to ground");
        checkTotal();
        movedTotal += 500;
    }
    Equal(0, bucket.Grams + flow.Grams + bed.Grams, "containers empty");
    Equal(initial, ground.TotalGrams, "final ground total");
    Console.WriteLine("cycles,transferred_g,initial_g,final_g,error_g");
    Console.WriteLine("100," + movedTotal + "," + initial + "," + ground.TotalGrams + ",0");
}
```

- [ ] **Step 2: update the success message to `PASS: all sand-core checks` and run the runner.**

```powershell
dotnet run --project games/sand-sandbox/checks/SandCoreChecks.csproj -c Release
```

Expected output after build messages:

```text
cycles,transferred_g,initial_g,final_g,error_g
100,50000,64000,64000,0
PASS: all sand-core checks
```

- [ ] **Step 3: demonstrate that duplication is detected.** Temporarily remove `source.Debit(grams);` in `SandTransfer.Move`, rerun, and expect a nonzero exit from an exact-total/source check. Restore the line and rerun to a clean pass. Do not commit the mutation. This is a check of the oracle, not a physical simulation result.
- [ ] **Step 4: create the README with this content.**

```markdown
# James's Sand Yard — reference core

This first milestone tests material accounting. It is not yet a playable
game, a complete Unity project, or a physical sand solver.

From the repository root, with .NET 10 installed:

    dotnet run --project games/sand-sandbox/checks/SandCoreChecks.csproj -c Release

The check covers bounded loads, rejected invalid operations, terrain
mass/height conversion, conservative repose relaxation, and 100 transfers
from ground through bucket/flow/truck bed and back. A pass exits 0 and
prints `PASS: all sand-core checks`; an invariant failure exits nonzero.

Runtime code uses plain C# 9. The .NET runner is a development tool, not
the iPad runtime. One accounting gram is not one visible grain.

Next: build the native sand lab with swept tool contact, moving-bed
containment, active particles, touch controls and sound. Test it on the
actual iPad before claiming realistic feel or sustained performance.

Planning: ../../docs/sand-sandbox/DESIGN.md
Roadmap: ../../docs/sand-sandbox/ROADMAP.md
```

- [ ] **Step 5: record implementation validation, review, and commit.** Add the actual run date, SDK, commit context and observed command result to the README. Do not copy a planning-time scratch check as if it were a completed source milestone. Review for signed/unsigned overflow, failed-operation mutation, and any public mutation bypass.

```powershell
git add -- games/sand-sandbox/checks/Program.cs games/sand-sandbox/README.md
git diff --cached --check
git diff --cached --stat
git commit -m "test(sand): verify repeated material transfers"
```

- [ ] **Step 6: inspect the new game's complete diff and the remote before a normal push.** `git status --short`, `git log -3 --oneline`, and `git ls-remote origin refs/heads/main` establish what will be shared. Push only if the commit series contains this task's work and the push is fast-forward; otherwise reconcile the task without stashing, reverting or committing the other game's work. Do not dispatch Pages.

## P0B handoff: native feasibility comes next

Before implementation planning for the native lab, record the exact iPad model/OS and build host. Follow the detailed experiment sequence in the roadmap. The output must include a signed real-device build, containment/flow demonstrations, the 20-minute performance trace, and James's observed play preferences. Reuse this core as an oracle; do not present its direct transfers as excavation physics.

The next plan should define exact Unity project settings and packages from the installed editor, the touch mapping selected for comparison, the conservative terrain/particle boundary, and the build/test commands actually available on the Mac. Keep hardware facts and benchmark results as observed values rather than invented defaults.

## Plan self-review

- The core specification's constructor, transfer, invalid-input, overflow, relaxation and repeated-cycle cases are covered by Tasks 1–3.
- Every public runtime type/method used in checks is defined above. Internal helpers are private/internal to the same assembly.
- There are no native performance or rendering claims; the broader requests are mapped to milestone gates in the roadmap.
- Plans remain on main, source changes remain scoped, and existing gameplay work is excluded from the commits.
- Physical realism, touch satisfaction and iPad support remain P0B evidence requirements.

## Planning document validation — 2026-09-22

The five C# blocks and the project XML were extracted into ignored `.tmp/sand-core-plan-validation/`, assembled as the plan instructs, and compiled with the locally installed .NET SDK 10.0.401. The checks passed: 100 cycles, 50,000 g transferred, 64,000 g initial/final ground mass, zero accounting error. Removing the transfer debit caused the expected nonzero failure (`source debit: expected 70, got 100`); restoring it returned the suite to a pass.

Relative links across the six planning documents were checked. An independent review checked requirements, scope boundaries and repository isolation; its competing-budget/latency finding was fixed by making the design's native gate table authoritative.

This validates the code examples in a planning document. No implementation files were added under `games/`, no Unity project was created, and no iPad/native/thermal/touch test was run. The implementation checkboxes correctly remain unchecked.
