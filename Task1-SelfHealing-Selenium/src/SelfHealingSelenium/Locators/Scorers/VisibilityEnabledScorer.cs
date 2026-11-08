using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Locators.Scorers;

public class VisibilityEnabledScorer : IElementScorer
{
    public string Name => "VisibilityAndEnabled";

    public double CalculateScore(ElementCandidate candidate, FieldTargetSpec target, AutomationOptions options)
    {
        if (!candidate.IsDisplayed)
            return 0.0;

        if (!candidate.IsEnabled)
            return 0.2;

        return 1.0;
    }
}

