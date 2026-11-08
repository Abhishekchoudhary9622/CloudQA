namespace SelfHealingSelenium.Models;

public class CandidateScoreInfo
{
    public string ElementIdentifier { get; init; } = string.Empty;
    public double TotalScore { get; init; }
    public Dictionary<string, double> Breakdown { get; init; } = new();
}

public class HealingDiagnostic
{
    public string FieldKey { get; set; } = string.Empty;
    public string TargetLabel { get; set; } = string.Empty;
    public bool HealedSuccessfully { get; set; }
    public bool UsedExplicitFallback { get; set; }
    public double WinningScore { get; set; }
    public string WinningElementDescription { get; set; } = string.Empty;
    public string StrategySummary { get; set; } = string.Empty;
    public List<CandidateScoreInfo> TopCandidates { get; set; } = new();
}

