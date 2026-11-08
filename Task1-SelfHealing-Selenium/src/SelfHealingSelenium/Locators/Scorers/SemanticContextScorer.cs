using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Locators.Scorers;

public class SemanticContextScorer : IElementScorer
{
    public string Name => "SemanticContext";

    public double CalculateScore(ElementCandidate candidate, FieldTargetSpec target, AutomationOptions options)
    {
        if (string.IsNullOrWhiteSpace(candidate.ParentContainerText))
            return 0.0;

        var scores = new List<double>
        {
            TextSimilarity.ComputeBestSimilarity(candidate.ParentContainerText, target.TargetLabel, target.Aliases)
        };

        if (!string.IsNullOrWhiteSpace(target.SubTargetValue))
        {
            scores.Add(TextSimilarity.ComputeBestSimilarity(candidate.ParentContainerText, target.SubTargetValue));
        }

        return scores.Max();
    }
}

