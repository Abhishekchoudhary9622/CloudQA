namespace SelfHealingSelenium.Configuration;

public class ScoringWeightsConfig
{
    public double LabelSimilarity { get; set; } = 0.30;
    public double AccessibleName { get; set; } = 0.25;
    public double ElementTypeCompatibility { get; set; } = 0.20;
    public double SemanticContext { get; set; } = 0.10;
    public double NearbyLabel { get; set; } = 0.10;
    public double VisibilityAndEnabled { get; set; } = 0.05;
}

public class AutomationOptions
{
    public string TargetUrl { get; set; } = "https://app.cloudqa.io/home/AutomationPracticeForm";
    public string FirstName { get; set; } = "Abhishek";
    public string Gender { get; set; } = "Male";
    public string State { get; set; } = "United States";
    public bool Headless { get; set; } = false;
    public int PageTimeoutSeconds { get; set; } = 15;
    public double MinConfidenceThreshold { get; set; } = 0.65;
    public double AmbiguityMarginThreshold { get; set; } = 0.08;
    public string ReportDirectory { get; set; } = "Reports";
    public string ScreenshotDirectory { get; set; } = "Screenshots";
    public ScoringWeightsConfig ScoringWeights { get; set; } = new();
    public Dictionary<string, string> ExplicitLocatorsFallback { get; set; } = new()
    {
        ["FirstName"] = "id:fname",
        ["Gender"] = "id:male",
        ["State"] = "id:state"
    };
}

