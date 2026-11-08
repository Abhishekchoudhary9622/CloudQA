using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Locators;

public interface IElementScorer
{
    string Name { get; }
    double CalculateScore(ElementCandidate candidate, FieldTargetSpec target, AutomationOptions options);
}

