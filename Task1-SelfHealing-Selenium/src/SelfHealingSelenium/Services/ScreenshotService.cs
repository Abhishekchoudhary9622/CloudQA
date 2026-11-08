using Microsoft.Extensions.Logging;
using OpenQA.Selenium;

namespace SelfHealingSelenium.Services;

public class ScreenshotService
{
    private readonly IWebDriver _driver;
    private readonly string _screenshotDir;
    private readonly ILogger _logger;

    public ScreenshotService(IWebDriver driver, string screenshotDir, ILogger logger)
    {
        _driver = driver;
        _screenshotDir = screenshotDir;
        _logger = logger;

        if (!Directory.Exists(_screenshotDir))
        {
            Directory.CreateDirectory(_screenshotDir);
        }
    }

    public string? Capture(string prefix)
    {
        try
        {
            if (_driver is ITakesScreenshot takesScreenshot)
            {
                var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss_fff");
                var filename = $"{prefix}_{timestamp}.png";
                var fullPath = Path.Combine(_screenshotDir, filename);

                var screenshot = takesScreenshot.GetScreenshot();
                screenshot.SaveAsFile(fullPath);

                _logger.LogInformation("Saved screenshot to '{Path}'", fullPath);
                return fullPath;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Failed to capture screenshot: {Message}", ex.Message);
        }

        return null;
    }
}

