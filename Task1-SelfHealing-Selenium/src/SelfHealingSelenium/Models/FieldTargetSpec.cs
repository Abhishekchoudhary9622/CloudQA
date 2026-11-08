using OpenQA.Selenium;

namespace SelfHealingSelenium.Models;

/// <summary>
/// Specification describing what field we are searching for dynamically.
/// </summary>
public class FieldTargetSpec
{
    public required string FieldKey { get; init; }
    public required ElementType ExpectedType { get; init; }
    public required string TargetLabel { get; init; }
    public List<string> Aliases { get; init; } = new();
    
    /// <summary>
    /// For radio buttons (e.g. "Male") or dropdown option (e.g. "United States").
    /// </summary>
    public string? SubTargetValue { get; init; }

    /// <summary>
    /// Optional explicit fallback selector (e.g. By.Id("fname")) if self-healing heuristics score below threshold.
    /// </summary>
    public By? ExplicitFallbackSelector { get; init; }
}

