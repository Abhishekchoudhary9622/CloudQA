using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Locators.Exceptions;

public class AmbiguousElementMatchException : Exception
{
    public string FieldKey { get; }
    public ElementCandidate CandidateA { get; }
    public ElementCandidate CandidateB { get; }
    public double ScoreDifference { get; }
    public double MarginThreshold { get; }

    public AmbiguousElementMatchException(
        string fieldKey,
        ElementCandidate a,
        ElementCandidate b,
        double scoreDiff,
        double marginThreshold)
        : base(FormatMessage(fieldKey, a, b, scoreDiff, marginThreshold))
    {
        FieldKey = fieldKey;
        CandidateA = a;
        CandidateB = b;
        ScoreDifference = scoreDiff;
        MarginThreshold = marginThreshold;
    }

    private static string FormatMessage(string fieldKey, ElementCandidate a, ElementCandidate b, double diff, double threshold)
    {
        return $"Ambiguous element match for '{fieldKey}'.\n" +
               $"Candidate 1: {a} (Score: {a.TotalConfidenceScore:F3})\n" +
               $"Candidate 2: {b} (Score: {b.TotalConfidenceScore:F3})\n" +
               $"Difference ({diff:F3}) is within ambiguity margin ({threshold:F3}). " +
               $"Refusing random selection to prevent test instability.";
    }
}

