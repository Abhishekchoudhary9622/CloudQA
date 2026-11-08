using Microsoft.Extensions.Logging;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using SelfHealingSelenium.Configuration;

namespace SelfHealingSelenium.Services;

public static class WebDriverFactory
{
    public static IWebDriver CreateChromeDriver(AutomationOptions options, ILogger logger)
    {
        logger.LogInformation("Initializing ChromeDriver (Headless={Headless})", options.Headless);

        var chromeOptions = new ChromeOptions();

        if (options.Headless)
        {
            chromeOptions.AddArgument("--headless=new");
        }

        chromeOptions.AddArgument("--no-sandbox");
        chromeOptions.AddArgument("--disable-dev-shm-usage");
        chromeOptions.AddArgument("--disable-gpu");
        chromeOptions.AddArgument("--window-size=1280,900");
        chromeOptions.AddArgument("--disable-blink-features=AutomationControlled");
        chromeOptions.AddArgument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

        var service = ChromeDriverService.CreateDefaultService();
        service.SuppressInitialDiagnosticInformation = true;
        service.HideCommandPromptWindow = true;

        var driver = new ChromeDriver(service, chromeOptions, TimeSpan.FromSeconds(options.PageTimeoutSeconds));
        driver.Manage().Timeouts().PageLoad = TimeSpan.FromSeconds(options.PageTimeoutSeconds);

        return driver;
    }
}

