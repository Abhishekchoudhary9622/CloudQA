using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Locators.Scorers;

public class AccessibleNameScorer : IElementScorer
{
    public string Name => "AccessibleName";

    public double CalculateScore(ElementCandidate candidate, FieldTargetSpec target, AutomationOptions options)
    {
        var scores = new List<double>();

        // 1. aria-label
        if (!string.IsNullOrWhiteSpace(candidate.AriaLabel))
        {
            scores.Add(TextSimilarity.ComputeBestSimilarity(candidate.AriaLabel, target.TargetLabel, target.Aliases));
            if (!string.IsNullOrWhiteSpace(target.SubTargetValue))
            {
                scores.Add(TextSimilarity.ComputeBestSimilarity(candidate.AriaLabel, target.SubTargetValue));
            }
        }

        // 2. aria-labelledby
        if (!string.IsNullOrWhiteSpace(candidate.AriaLabelledBy))
        {
            scores.Add(TextSimilarity.ComputeBestSimilarity(candidate.AriaLabelledBy, target.TargetLabel, target.Aliases));
        }

        // 3. Associated label (W3C AccName: native label provides accessible name when ARIA is absent)
        if (!string.IsNullOrWhiteSpace(candidate.AssociatedLabelText))
        {
            scores.Add(TextSimilarity.ComputeBestSimilarity(candidate.AssociatedLabelText, target.TargetLabel, target.Aliases));
        }

        // 4. Placeholder
        if (!string.IsNullOrWhiteSpace(candidate.Placeholder))
        {
            scores.Add(TextSimilarity.ComputeBestSimilarity(candidate.Placeholder, target.TargetLabel, target.Aliases) * 0.85);
        }

        // 5. Visible text (buttons, options, text elements)
        if (!string.IsNullOrWhiteSpace(candidate.VisibleText))
        {
            scores.Add(TextSimilarity.ComputeBestSimilarity(candidate.VisibleText, target.TargetLabel, target.Aliases) * 0.80);
            if (!string.IsNullOrWhiteSpace(target.SubTargetValue))
            {
                scores.Add(TextSimilarity.ComputeBestSimilarity(candidate.VisibleText, target.SubTargetValue));
            }
        }

        return scores.Count > 0 ? scores.Max() : 0.0;
    }
}
