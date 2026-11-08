using NUnit.Framework;
using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Locators;
using SelfHealingSelenium.Locators.Scorers;
using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Tests;

[TestFixture]
public class ScoringTests
{
    private AutomationOptions _options = null!;

    [SetUp]
    public void SetUp()
    {
        _options = new AutomationOptions();
    }

    [Test]
    public void TextSimilarity_ExactMatch_ReturnsOne()
    {
        var sim = TextSimilarity.ComputeBestSimilarity("First Name", "First Name");
        Assert.That(sim, Is.EqualTo(1.0));
    }

    [Test]
    public void TextSimilarity_AliasMatch_ReturnsHighScore()
    {
        var aliases = new List<string> { "First Name", "fname", "given name" };
        var sim = TextSimilarity.ComputeBestSimilarity("fname", "First Name", aliases);
        Assert.That(sim, Is.GreaterThanOrEqualTo(0.90));
    }

    [Test]
    public void TextSimilarity_FuzzyTypo_ReturnsGoodSimilarity()
    {
        // Typo: "Frist Name" instead of "First Name"
        var sim = TextSimilarity.ComputeBestSimilarity("Frist Name", "First Name");
        Assert.That(sim, Is.GreaterThan(0.75));
    }

    [Test]
    public void ElementTypeCompatibility_TextInput_RejectsRadioAndSelect()
    {
        var scorer = new ElementTypeCompatibilityScorer();
        var target = new FieldTargetSpec
        {
            FieldKey = "FirstName",
            ExpectedType = ElementType.TextInput,
            TargetLabel = "First Name"
        };

        var textCandidate = new ElementCandidate
        {
            WebElement = null!,
            TagName = "input",
            Type = "text"
        };
        var radioCandidate = new ElementCandidate
        {
            WebElement = null!,
            TagName = "input",
            Type = "radio"
        };
        var selectCandidate = new ElementCandidate
        {
            WebElement = null!,
            TagName = "select"
        };

        Assert.That(scorer.CalculateScore(textCandidate, target, _options), Is.EqualTo(1.0));
        Assert.That(scorer.CalculateScore(radioCandidate, target, _options), Is.EqualTo(0.0));
        Assert.That(scorer.CalculateScore(selectCandidate, target, _options), Is.EqualTo(0.0));
    }

    [Test]
    public void ElementTypeCompatibility_RadioButton_AcceptsRadioOnly()
    {
        var scorer = new ElementTypeCompatibilityScorer();
        var target = new FieldTargetSpec
        {
            FieldKey = "Gender",
            ExpectedType = ElementType.RadioButton,
            TargetLabel = "Gender",
            SubTargetValue = "Male"
        };

        var radioCandidate = new ElementCandidate
        {
            WebElement = null!,
            TagName = "input",
            Type = "radio"
        };
        var textCandidate = new ElementCandidate
        {
            WebElement = null!,
            TagName = "input",
            Type = "text"
        };

        Assert.That(scorer.CalculateScore(radioCandidate, target, _options), Is.EqualTo(1.0));
        Assert.That(scorer.CalculateScore(textCandidate, target, _options), Is.EqualTo(0.0));
    }

    [Test]
    public void ElementTypeCompatibility_SelectDropdown_AcceptsSelectOnly()
    {
        var scorer = new ElementTypeCompatibilityScorer();
        var target = new FieldTargetSpec
        {
            FieldKey = "State",
            ExpectedType = ElementType.SelectDropdown,
            TargetLabel = "State"
        };

        var selectCandidate = new ElementCandidate
        {
            WebElement = null!,
            TagName = "select"
        };
        var buttonCandidate = new ElementCandidate
        {
            WebElement = null!,
            TagName = "button"
        };

        Assert.That(scorer.CalculateScore(selectCandidate, target, _options), Is.EqualTo(1.0));
        Assert.That(scorer.CalculateScore(buttonCandidate, target, _options), Is.EqualTo(0.0));
    }

    [Test]
    public void VisibilityScorer_HiddenElement_ReturnsZero()
    {
        var scorer = new VisibilityEnabledScorer();
        var target = new FieldTargetSpec
        {
            FieldKey = "FirstName",
            ExpectedType = ElementType.TextInput,
            TargetLabel = "First Name"
        };

        var hidden = new ElementCandidate
        {
            WebElement = null!,
            IsDisplayed = false,
            IsEnabled = true
        };

        Assert.That(scorer.CalculateScore(hidden, target, _options), Is.EqualTo(0.0));
    }
}

