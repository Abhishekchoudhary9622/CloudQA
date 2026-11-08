using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Locators.Scorers;

public class LabelSimilarityScorer : IElementScorer
{
    public string Name => "LabelSimilarity";

    public double CalculateScore(ElementCandidate candidate, FieldTargetSpec target, AutomationOptions options)
    {
        // Case 1: When a specific sub-target value is requested (e.g., Radio Button "Male" under "Gender")
        if (!string.IsNullOrWhiteSpace(target.SubTargetValue))
        {
            double bestOptionScore = 0.0;

            if (!string.IsNullOrWhiteSpace(candidate.Value))
            {
                bestOptionScore = TextSimilarity.ComputeBestSimilarity(candidate.Value, target.SubTargetValue);
            }
            else if (!string.IsNullOrWhiteSpace(candidate.AssociatedLabelText))
            {
                bestOptionScore = TextSimilarity.ComputeBestSimilarity(candidate.AssociatedLabelText, target.SubTargetValue);
            }
            else if (!string.IsNullOrWhiteSpace(candidate.Id))
            {
                bestOptionScore = TextSimilarity.ComputeBestSimilarity(candidate.Id, target.SubTargetValue) * 0.95;
            }
            else if (!string.IsNullOrWhiteSpace(candidate.NearbyText))
            {
                bestOptionScore = TextSimilarity.ComputeBestSimilarity(candidate.NearbyText, target.SubTargetValue);
            }

            // If this element's option label/value doesn't match the requested option, disqualify
            if (bestOptionScore < 0.5)
            {
                return 0.0;
            }

            // Check if it also belongs to the overall group/field
            var groupScores = new List<double>();
            if (!string.IsNullOrWhiteSpace(candidate.Name))
            {
                groupScores.Add(TextSimilarity.ComputeBestSimilarity(candidate.Name, target.TargetLabel, target.Aliases));
            }
            if (!string.IsNullOrWhiteSpace(candidate.ParentContainerText))
            {
                groupScores.Add(TextSimilarity.ComputeBestSimilarity(candidate.ParentContainerText, target.TargetLabel, target.Aliases));
            }

            var bestGroupScore = groupScores.Count > 0 ? groupScores.Max() : 0.0;

            return bestGroupScore > 0 ? (bestOptionScore * 0.70 + bestGroupScore * 0.30) : bestOptionScore;
        }

        // Case 2: Standard field (e.g. First Name, State)
        var scores = new List<double>();

        if (!string.IsNullOrWhiteSpace(candidate.AssociatedLabelText))
        {
            scores.Add(TextSimilarity.ComputeBestSimilarity(candidate.AssociatedLabelText, target.TargetLabel, target.Aliases));
        }

        if (!string.IsNullOrWhiteSpace(candidate.Name))
        {
            scores.Add(TextSimilarity.ComputeBestSimilarity(candidate.Name, target.TargetLabel, target.Aliases) * 0.90);
        }

        if (!string.IsNullOrWhiteSpace(candidate.Id))
        {
            scores.Add(TextSimilarity.ComputeBestSimilarity(candidate.Id, target.TargetLabel, target.Aliases) * 0.85);
        }

        return scores.Count > 0 ? scores.Max() : 0.0;
    }
}
