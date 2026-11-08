using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Locators.Exceptions;

public class ElementNotFoundException : Exception
{
    public string FieldKey { get; }
    public double HighestScore { get; }
    public double RequiredThreshold { get; }
    public IReadOnlyList<ElementCandidate> EvaluatedCandidates { get; }

    public ElementNotFoundException(
        string fieldKey,
        double highestScore,
        double requiredThreshold,
        IReadOnlyList<ElementCandidate> candidates)
        : base(FormatMessage(fieldKey, highestScore, requiredThreshold, candidates))
    {
        FieldKey = fieldKey;
        HighestScore = highestScore;
        RequiredThreshold = requiredThreshold;
        EvaluatedCandidates = candidates;
    }

    private static string FormatMessage(string fieldKey, double highest, double threshold, IReadOnlyList<ElementCandidate> candidates)
    {
        var top = candidates.Take(3).Select(c => $"- {c}").ToList();
        var topStr = top.Count > 0 ? string.Join("\n", top) : "None";
        return $"No candidate element for field '{fieldKey}' met the confidence threshold {threshold:F2}. " +
               $"Highest confidence score was {highest:F2}.\n" +
               $"Top evaluated candidates:\n{topStr}";
    }
}

