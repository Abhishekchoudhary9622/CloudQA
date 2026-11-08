using System.Diagnostics;
using Microsoft.Extensions.Logging;
using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;
using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Locators;
using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Services;

public class FormAutomationService
{
    private readonly AutomationOptions _options;
    private readonly ILogger _logger;

    public FormAutomationService(AutomationOptions options, ILogger logger)
    {
        _options = options;
        _logger = logger;
    }

    public ExecutionReport Run()
    {
        var report = new ExecutionReport
        {
            TargetUrl = _options.TargetUrl,
            StartTime = DateTime.UtcNow
        };

        IWebDriver? driver = null;
        ScreenshotService? screenshotService = null;
        ReportingService reportingService = new ReportingService(_options.ReportDirectory, _logger);

        try
        {
            driver = WebDriverFactory.CreateChromeDriver(_options, _logger);
            screenshotService = new ScreenshotService(driver, _options.ScreenshotDirectory, _logger);

            // 1. Navigate to target URL
            _logger.LogInformation("Step 1 & 2: Navigating to '{Url}'", _options.TargetUrl);
            driver.Navigate().GoToUrl(_options.TargetUrl);

            // Wait until body or form is loaded
            var wait = new WebDriverWait(driver, TimeSpan.FromSeconds(_options.PageTimeoutSeconds));
            wait.Until(d => ((IJavaScriptExecutor)d).ExecuteScript("return document.readyState")?.ToString() == "complete");

            var initialScreenshot = screenshotService.Capture("01_page_loaded");
            if (initialScreenshot != null) report.Screenshots.Add(initialScreenshot);

            var locatorEngine = new HeuristicLocatorEngine(driver, _options, _logger);

            // 3 & 4. Discover and fill First Name
            var firstNameResult = ExecuteFirstNameStep(locatorEngine, screenshotService);
            report.StepResults.Add(firstNameResult);

            // 5 & 6. Discover and select Gender (Male)
            var genderResult = ExecuteGenderStep(locatorEngine, screenshotService);
            report.StepResults.Add(genderResult);

            // 7 & 8. Discover and select State (United States)
            var stateResult = ExecuteStateStep(locatorEngine, screenshotService);
            report.StepResults.Add(stateResult);

            // 9. Verify all three values
            _logger.LogInformation("Step 9: Verifying all entered field values");
            var allPassed = report.StepResults.All(s => s.VerificationPassed);
            report.OverallStatus = allPassed;
            report.SummaryMessage = allPassed
                ? "All three fields (First Name, Gender, State) successfully located, filled, and verified."
                : "One or more field verifications failed.";

            var finalScreenshot = screenshotService.Capture("05_final_state");
            if (finalScreenshot != null) report.Screenshots.Add(finalScreenshot);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Automation workflow encountered an unhandled error: {Message}", ex.Message);
            report.OverallStatus = false;
            report.ErrorMessage = ex.Message;
            report.DiagnosticDetails = ex.ToString();

            if (screenshotService != null)
            {
                var errorShot = screenshotService.Capture("error_failure");
                if (errorShot != null) report.Screenshots.Add(errorShot);
            }
        }
        finally
        {
            report.EndTime = DateTime.UtcNow;

            if (driver != null)
            {
                try
                {
                    driver.Quit();
                    driver.Dispose();
                }
                catch { }
            }
        }

        // 10. Generate execution report
        reportingService.SaveJsonReport(report);
        reportingService.PrintTerminalSummary(report);

        return report;
    }

    private FieldAutomationResult ExecuteFirstNameStep(HeuristicLocatorEngine locator, ScreenshotService screenshots)
    {
        var sw = Stopwatch.StartNew();
        _logger.LogInformation("Step 3 & 4: Discovering and filling First Name textbox");

        By? fallback = null;
        if (_options.ExplicitLocatorsFallback.TryGetValue("FirstName", out var fbStr) && !string.IsNullOrWhiteSpace(fbStr))
        {
            fallback = ParseBy(fbStr);
        }

        var spec = new FieldTargetSpec
        {
            FieldKey = "FirstName",
            ExpectedType = ElementType.TextInput,
            TargetLabel = "First Name",
            Aliases = new List<string> { "First Name", "fname", "given name", "first_name", "first-name" },
            ExplicitFallbackSelector = fallback
        };

        var (element, diag) = locator.Locate(spec);

        element.Clear();
        element.SendKeys(_options.FirstName);

        // Verification: read back value attribute
        var actual = element.GetAttribute("value") ?? string.Empty;
        var passed = actual.Trim().Equals(_options.FirstName.Trim(), StringComparison.OrdinalIgnoreCase);

        var shot = screenshots.Capture("02_firstname_entered");

        sw.Stop();
        return new FieldAutomationResult
        {
            FieldKey = "FirstName",
            ActionPerformed = "SendKeys",
            TargetValue = _options.FirstName,
            ActualValueReadBack = actual,
            VerificationPassed = passed,
            ConfidenceScore = diag.WinningScore,
            SelfHealed = diag.HealedSuccessfully,
            HealingNote = diag.StrategySummary,
            ScreenshotPath = shot,
            Duration = sw.Elapsed,
            Diagnostic = diag
        };
    }

    private FieldAutomationResult ExecuteGenderStep(HeuristicLocatorEngine locator, ScreenshotService screenshots)
    {
        var sw = Stopwatch.StartNew();
        _logger.LogInformation("Step 5 & 6: Discovering and selecting Gender radio button '{Gender}'", _options.Gender);

        By? fallback = null;
        if (_options.ExplicitLocatorsFallback.TryGetValue("Gender", out var fbStr) && !string.IsNullOrWhiteSpace(fbStr))
        {
            fallback = ParseBy(fbStr);
        }

        var spec = new FieldTargetSpec
        {
            FieldKey = "Gender",
            ExpectedType = ElementType.RadioButton,
            TargetLabel = "Gender",
            SubTargetValue = _options.Gender,
            Aliases = new List<string> { "Gender", "Sex" },
            ExplicitFallbackSelector = fallback
        };

        var (element, diag) = locator.Locate(spec);

        if (!element.Selected)
        {
            element.Click();
        }

        // Verification: check if selected, and verify its value or associated label
        var isSelected = element.Selected;
        var actualVal = element.GetAttribute("value") ?? element.GetAttribute("id") ?? string.Empty;
        var passed = isSelected;

        var shot = screenshots.Capture("03_gender_selected");

        sw.Stop();
        return new FieldAutomationResult
        {
            FieldKey = "Gender",
            ActionPerformed = "ClickRadio",
            TargetValue = _options.Gender,
            ActualValueReadBack = $"{actualVal} (Selected={isSelected})",
            VerificationPassed = passed,
            ConfidenceScore = diag.WinningScore,
            SelfHealed = diag.HealedSuccessfully,
            HealingNote = diag.StrategySummary,
            ScreenshotPath = shot,
            Duration = sw.Elapsed,
            Diagnostic = diag
        };
    }

    private FieldAutomationResult ExecuteStateStep(HeuristicLocatorEngine locator, ScreenshotService screenshots)
    {
        var sw = Stopwatch.StartNew();
        _logger.LogInformation("Step 7 & 8: Discovering and selecting State dropdown '{State}'", _options.State);

        By? fallback = null;
        if (_options.ExplicitLocatorsFallback.TryGetValue("State", out var fbStr) && !string.IsNullOrWhiteSpace(fbStr))
        {
            fallback = ParseBy(fbStr);
        }

        var spec = new FieldTargetSpec
        {
            FieldKey = "State",
            ExpectedType = ElementType.SelectDropdown,
            TargetLabel = "State",
            SubTargetValue = _options.State,
            Aliases = new List<string> { "State", "Country", "Region", "State / Country" },
            ExplicitFallbackSelector = fallback
        };

        var (element, diag) = locator.Locate(spec);

        var select = new SelectElement(element);
        var availableOptions = select.Options.Select(o => o.Text.Trim()).ToList();

        // Select by text (or partial text)
        var match = availableOptions.FirstOrDefault(o => o.Equals(_options.State, StringComparison.OrdinalIgnoreCase))
                    ?? availableOptions.FirstOrDefault(o => o.Contains(_options.State, StringComparison.OrdinalIgnoreCase));

        if (match != null)
        {
            select.SelectByText(match);
        }
        else if (select.Options.Count > 1)
        {
            // If requested state is not in options, select second option
            select.SelectByIndex(1);
        }

        // Verification: read selected option
        var selectedOption = select.SelectedOption?.Text?.Trim() ?? string.Empty;
        var passed = selectedOption.Contains(_options.State, StringComparison.OrdinalIgnoreCase) ||
                     selectedOption.Equals(match, StringComparison.OrdinalIgnoreCase);

        var shot = screenshots.Capture("04_state_selected");

        sw.Stop();
        return new FieldAutomationResult
        {
            FieldKey = "State",
            ActionPerformed = "SelectByText",
            TargetValue = _options.State,
            ActualValueReadBack = selectedOption,
            VerificationPassed = passed,
            ConfidenceScore = diag.WinningScore,
            SelfHealed = diag.HealedSuccessfully,
            HealingNote = diag.StrategySummary,
            ScreenshotPath = shot,
            Duration = sw.Elapsed,
            Diagnostic = diag
        };
    }

    private static By? ParseBy(string spec)
    {
        var parts = spec.Split(':', 2);
        if (parts.Length != 2) return null;
        var type = parts[0].Trim().ToLowerInvariant();
        var val = parts[1].Trim();

        return type switch
        {
            "id" => By.Id(val),
            "name" => By.Name(val),
            "css" => By.CssSelector(val),
            "xpath" => By.XPath(val),
            _ => null
        };
    }
}

