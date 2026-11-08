using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using OpenQA.Selenium;
using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Locators;
using SelfHealingSelenium.Locators.Exceptions;
using SelfHealingSelenium.Models;
using SelfHealingSelenium.Services;

namespace SelfHealingSelenium.Tests;

[TestFixture]
public class AmbiguityDetectionTests
{
    private IWebDriver _driver = null!;
    private AutomationOptions _options = null!;

    [SetUp]
    public void SetUp()
    {
        _options = new AutomationOptions
        {
            Headless = true,
            MinConfidenceThreshold = 0.65,
            AmbiguityMarginThreshold = 0.08
        };
        _driver = WebDriverFactory.CreateChromeDriver(_options, NullLogger.Instance);
    }

    [TearDown]
    public void TearDown()
    {
        _driver.Quit();
        _driver.Dispose();
    }

    [Test]
    public void WhenMultipleElementsHaveEqualConfidence_AmbiguousElementMatchExceptionIsThrown()
    {
        var fixturePath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "Fixtures", "ambiguous_fields_form.html"));
        _driver.Navigate().GoToUrl(new Uri(fixturePath).AbsoluteUri);

        var engine = new HeuristicLocatorEngine(_driver, _options, NullLogger.Instance);

        var spec = new FieldTargetSpec
        {
            FieldKey = "FirstName",
            ExpectedType = ElementType.TextInput,
            TargetLabel = "First Name",
            Aliases = new List<string> { "First Name", "fname" }
        };

        var ex = Assert.Throws<AmbiguousElementMatchException>(() =>
        {
            engine.Locate(spec);
        });

        Assert.That(ex, Is.Not.Null);
        Assert.That(ex!.FieldKey, Is.EqualTo("FirstName"));
        Assert.That(ex.CandidateA, Is.Not.Null);
        Assert.That(ex.CandidateB, Is.Not.Null);
        Assert.That(ex.ScoreDifference, Is.LessThan(_options.AmbiguityMarginThreshold));
        Assert.That(ex.Message, Does.Contain("Ambiguous element match for 'FirstName'"));
    }
}

