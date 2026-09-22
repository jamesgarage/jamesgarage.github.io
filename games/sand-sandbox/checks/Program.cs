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
