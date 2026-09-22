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

Planning: [design](../../docs/sand-sandbox/DESIGN.md)
Roadmap: [roadmap](../../docs/sand-sandbox/ROADMAP.md)

Validation (2026-09-22, .NET SDK 10.0.401): this check was run on `main`
after `cc03dfe` (material stores) and `fa6ec33` (reference terrain). The
Release command above exited 0 and printed:

    cycles,transferred_g,initial_g,final_g,error_g
    100,50000,64000,64000,0
    PASS: all sand-core checks
