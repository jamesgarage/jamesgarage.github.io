# P0A — conservative sand reference core

2026-09-22. Scope for the [first implementation plan](../../.references/plans/2026-09-22-james-sandbox-implementation.md). This is one independently testable foundation in the [game design](DESIGN.md), not the native sand experience.

## Purpose

Prove that the proposed game can account for sand moving from ground to bucket, through a flow, into a bed and back to ground without creation, loss or overfilling. Establish a small terrain representation whose local relaxation preserves mass. This reference will serve as an oracle when the native simulation becomes more complex.

## Global constraints

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

## Interfaces

`Load` owns a bounded mass in grams. Constructor: `Load(long capacityGrams, long grams = 0)`. Public read-only `CapacityGrams` and `Grams`. It represents an accounting store, not a physical shape.

`SandTransfer.Move(Load source, Load destination, long requestedGrams) -> long` transfers the minimum of request, source content and destination room. Null operands reject; a same-object transfer is a no-op after request validation. Overflow validation occurs before mutations.

`SandField(int width, int depth, double cellSideMetres, double densityKgPerM3, long initialGramsPerCell)` owns a rectangular grid and read-only `TotalGrams`. Expose `Width`, `Depth`, `CellSideMetres`, `GramsPerHeightMetre`, `MassAt(x,z)` and `HeightAt(x,z)`. Height is mass divided by cell area and bulk density. Bounds reject.

`SandField.Scoop(x,z,Load destination,long requestedGrams) -> long` debits a cell and credits a bounded load. `Deposit(x,z,Load source,long requestedGrams) -> long` is the reverse. Total counters and per-cell mass remain consistent after rejection as well as success.

`SandField.Relax(double reposeDegrees) -> long` makes one conservative cardinal-neighbour sweep and reports grams moved across pairs. Adjacent heights above the allowed rise exchange mass until the pair approaches the chosen slope; repeated sweeps settle a pile. Angle range is `[0, 89)` degrees. The returned activity count is not net mass change and can count material crossing multiple pairs in one sweep.

## Acceptance cases

1. Capacity clamp, empty/full/zero/self transfer, and negative/null rejection preserve totals.
2. Terrain scoop/deposit cannot make mass negative or overfill a load.
3. Invalid grid/density/bounds/angle and overflow reject without partial mutation.
4. A central pile spreads under repeated relaxation while keeping exact mass and nonnegative cells. Stop after at most 5,000 sweeps. Largest neighbouring height difference is within the selected slope plus a two-gram rounding allowance.
5. A scripted 100-cycle ground → bucket → flow → bed → ground sequence checks exact total after **each** leg, returns bucket/flow/bed to empty, and emits moved mass and final error. Do not normalize against a huge world mass alone.
6. A successful Windows run is labeled an accounting result. It does not certify physical realism, solver stability, native compatibility or tactile enjoyment.

## Representation limits

One gram is an accounting quantum for this reference, not a claim that one rendered grain weighs a gram. The later solver may use fractional particle masses internally and conserve fractional residuals when crossing the ledger boundary. The reference's sequential pair relaxation is direction dependent and has no momentum; compare final mass/shape bounds, not bitwise trajectories of a future parallel solver.

The next milestone replaces direct cell-to-container shortcuts with swept excavation, collisions, active material motion and moving carrier geometry. Do not quietly rename this core into a complete physics engine.
