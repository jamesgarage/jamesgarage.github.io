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

        const long largeMass = 4611686018427382904;
        var large = new SandField(2, 1, 1, 1600, largeMass);
        var removed = new Load(377);
        Equal(377, large.Scoop(1, 0, removed, 377), "large-mass scoop");
        Equal(188, large.Relax(0), "large-mass exact half difference");
        Equal(1, large.MassAt(0, 0) - large.MassAt(1, 0), "large-mass rounding bound");
        Equal(0, large.Relax(0), "large-mass settled");
        Equal(largeMass * 2 - 377, large.TotalGrams, "large-mass conservation");

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

    private static int Main()
    {
        try
        {
            CheckTransfers();
            CheckTerrain();
            CheckCycles();
            Console.WriteLine("PASS: all sand-core checks");
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.ToString());
            return 1;
        }
    }
}
