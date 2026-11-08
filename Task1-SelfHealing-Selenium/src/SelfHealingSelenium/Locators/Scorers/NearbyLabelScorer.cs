using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Locators.Scorers;

public class NearbyLabelScorer : IElementScorer
{
    public string Name => "NearbyLabel";

    public double CalculateScore(ElementCandidate candidate, FieldTargetSpec target, AutomationOptions options)
    {
        if (string.IsNullOrWhiteSpace(candidate.NearbyText))
            return 0.0;

        var scores = new List<double>
        {
            TextSimilarity.ComputeBestSimilarity(candidate.NearbyText, target.TargetLabel, target.Aliases)
        };

        if (!string.IsNullOrWhiteSpace(target.SubTargetValue))
        {
            scores.Add(TextSimilarity.ComputeBestSimilarity(candidate.NearbyText, target.SubTargetValue));
        }

        return scores.Max();
    }
}

