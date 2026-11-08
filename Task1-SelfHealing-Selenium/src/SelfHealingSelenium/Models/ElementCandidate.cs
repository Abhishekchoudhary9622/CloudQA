using OpenQA.Selenium;

namespace SelfHealingSelenium.Models;

/// <summary>
/// Represents a DOM element candidate with extracted accessibility, semantic, and textual attributes.
/// </summary>
public class ElementCandidate
{
    public required IWebElement WebElement { get; init; }
    public string TagName { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Placeholder { get; init; } = string.Empty;
    public string AriaLabel { get; init; } = string.Empty;
    public string AriaLabelledBy { get; init; } = string.Empty;
    public string AriaRole { get; init; } = string.Empty;
    public string Value { get; init; } = string.Empty;
    public string VisibleText { get; init; } = string.Empty;
    public string AssociatedLabelText { get; init; } = string.Empty;
    public string ParentContainerText { get; init; } = string.Empty;
    public string NearbyText { get; init; } = string.Empty;
    public bool IsDisplayed { get; init; }
    public bool IsEnabled { get; init; }
    public bool IsSlotted { get; init; }

    public double TotalConfidenceScore { get; set; }
    public Dictionary<string, double> ComponentScores { get; } = new();

    public override string ToString()
    {
        return $"[{TagName}:{Type}] Id='{Id}' Name='{Name}' Label='{AssociatedLabelText}' Score={TotalConfidenceScore:F3}";
    }
}
