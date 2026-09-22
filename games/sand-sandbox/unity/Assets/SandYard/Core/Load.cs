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
