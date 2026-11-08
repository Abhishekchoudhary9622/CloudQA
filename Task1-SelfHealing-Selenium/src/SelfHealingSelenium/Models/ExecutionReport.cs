namespace SelfHealingSelenium.Models;

public class ExecutionReport
{
    public string TestSuiteName { get; init; } = "CloudQA Self-Healing Selenium Suite";
    public string TargetUrl { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public TimeSpan TotalDuration => EndTime - StartTime;
    public bool OverallStatus { get; set; }
    public string SummaryMessage { get; set; } = string.Empty;
    public List<FieldAutomationResult> StepResults { get; } = new();
    public List<string> Screenshots { get; } = new();
    public string? ErrorMessage { get; set; }
    public string? DiagnosticDetails { get; set; }
}

