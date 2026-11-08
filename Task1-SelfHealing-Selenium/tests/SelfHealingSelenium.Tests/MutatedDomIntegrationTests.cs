using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Services;

namespace SelfHealingSelenium.Tests;

[TestFixture]
public class MutatedDomIntegrationTests
{
    [Test]
    public void WhenFieldOrderIsReordered_AllThreeFieldsAreLocatedAndVerifiedSuccessfully()
    {
        var fixturePath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "Fixtures", "mutated_reordered_form.html"));
        var options = new AutomationOptions
        {
            TargetUrl = new Uri(fixturePath).AbsoluteUri,
            FirstName = "Abhishek",
            Gender = "Male",
            State = "United States",
            Headless = true
        };

        var service = new FormAutomationService(options, NullLogger.Instance);
        var report = service.Run();

        Assert.That(report.OverallStatus, Is.True, $"Reordered fields automation failed: {report.ErrorMessage}");
        Assert.That(report.StepResults.Count, Is.EqualTo(3));
        Assert.That(report.StepResults.All(s => s.VerificationPassed), Is.True);
        Assert.That(report.StepResults[0].ActualValueReadBack, Is.EqualTo("Abhishek"));
        Assert.That(report.StepResults[1].ActualValueReadBack, Does.Contain("Selected=True"));
        Assert.That(report.StepResults[2].ActualValueReadBack, Does.Contain("United States"));
    }

    [Test]
    public void WhenIdsAndCssClassesAreChanged_SelfHealingLocatesAllThreeFields()
    {
        var fixturePath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "Fixtures", "mutated_changed_ids_form.html"));
        var options = new AutomationOptions
        {
            TargetUrl = new Uri(fixturePath).AbsoluteUri,
            FirstName = "Abhishek",
            Gender = "Male",
            State = "United States",
            Headless = true,
            // Explicitly clear fallback locators to guarantee pure self-healing heuristics
            ExplicitLocatorsFallback = new Dictionary<string, string>()
        };

        var service = new FormAutomationService(options, NullLogger.Instance);
        var report = service.Run();

        Assert.That(report.OverallStatus, Is.True, $"Mutated IDs/CSS automation failed: {report.ErrorMessage}");
        Assert.That(report.StepResults.Count, Is.EqualTo(3));
        Assert.That(report.StepResults.All(s => s.VerificationPassed), Is.True);
        Assert.That(report.StepResults.All(s => s.SelfHealed), Is.True);
    }
}

