namespace SelfHealingSelenium.Models;

public class FieldAutomationResult
{
    public required string FieldKey { get; init; }
    public required string ActionPerformed { get; init; }
    public required string TargetValue { get; init; }
    public string? ActualValueReadBack { get; set; }
    public bool VerificationPassed { get; set; }
    public double ConfidenceScore { get; set; }
    public bool SelfHealed { get; set; }
    public string? HealingNote { get; set; }
    public string? ScreenshotPath { get; set; }
    public TimeSpan Duration { get; set; }
    public HealingDiagnostic? Diagnostic { get; set; }
}

