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
            long difference = mass[high] - mass[low];
            double allowedGrams = maxRise * GramsPerHeightMetre;
            if (allowedGrams >= long.MaxValue) return 0;
            // Round only the geometric allowance; keep the mass difference exact.
            // Ceiling plus the final odd gram stays within the two-gram tolerance.
            long allowedDifference = (long)Math.Ceiling(allowedGrams);
            if (difference <= allowedDifference) return 0;
            long moved = (difference - allowedDifference) / 2;
            mass[high] -= moved;
            mass[low] += moved;
            return moved;
        }
    }
}
