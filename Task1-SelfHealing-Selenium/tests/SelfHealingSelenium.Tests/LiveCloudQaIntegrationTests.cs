using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Services;

namespace SelfHealingSelenium.Tests;

[TestFixture]
public class LiveCloudQaIntegrationTests
{
    [Test]
    public void ExecuteCloudQaAutomation_OriginalForm_AllThreeFieldsVerified()
    {
        var options = new AutomationOptions
        {
            TargetUrl = "https://app.cloudqa.io/home/AutomationPracticeForm",
            FirstName = "Abhishek",
            Gender = "Male",
            State = "United States",
            Headless = true
        };

        var service = new FormAutomationService(options, NullLogger.Instance);
        var report = service.Run();

        Assert.That(report.OverallStatus, Is.True, $"Live CloudQA test failed: {report.ErrorMessage}");
        Assert.That(report.StepResults.Count, Is.EqualTo(3));
        Assert.That(report.StepResults[0].FieldKey, Is.EqualTo("FirstName"));
        Assert.That(report.StepResults[0].ActualValueReadBack, Is.EqualTo("Abhishek"));
        Assert.That(report.StepResults[1].FieldKey, Is.EqualTo("Gender"));
        Assert.That(report.StepResults[1].ActualValueReadBack, Does.Contain("Selected=True"));
        Assert.That(report.StepResults[2].FieldKey, Is.EqualTo("State"));
        Assert.That(report.StepResults[2].ActualValueReadBack, Does.Contain("United States"));
    }
}

