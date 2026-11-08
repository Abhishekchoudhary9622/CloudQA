using Microsoft.Extensions.Logging;
using SelfHealingSelenium.Configuration;
using SelfHealingSelenium.Services;

namespace SelfHealingSelenium;

public static class Program
{
    public static int Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;

        using var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder
                .SetMinimumLevel(LogLevel.Information)
                .AddSimpleConsole(opts =>
                {
                    opts.IncludeScopes = false;
                    opts.SingleLine = true;
                    opts.TimestampFormat = "[HH:mm:ss] ";
                });
        });

        var logger = loggerFactory.CreateLogger("CloudQA.SelfHealing");
        logger.LogInformation("=========================================================");
        logger.LogInformation(" Starting CloudQA Self-Healing Web Automation Suite (.NET 8)");
        logger.LogInformation("=========================================================");

        try
        {
            var options = ConfigurationManager.Load(args);
            logger.LogInformation("Configuration loaded successfully:");
            logger.LogInformation("  Target URL : {Url}", options.TargetUrl);
            logger.LogInformation("  First Name : {FirstName}", options.FirstName);
            logger.LogInformation("  Gender     : {Gender}", options.Gender);
            logger.LogInformation("  State      : {State}", options.State);
            logger.LogInformation("  Headless   : {Headless}", options.Headless);
            logger.LogInformation("  Min Score  : {MinScore:F2}", options.MinConfidenceThreshold);
            logger.LogInformation("  Ambiguity  : {AmbMargin:F2}", options.AmbiguityMarginThreshold);

            var service = new FormAutomationService(options, logger);
            var report = service.Run();

            if (report.OverallStatus)
            {
                logger.LogInformation("Automation completed successfully with PASS result.");
                return 0;
            }
            else
            {
                logger.LogError("Automation finished with FAIL result: {Error}", report.ErrorMessage);
                return 1;
            }
        }
        catch (Exception ex)
        {
            logger.LogCritical(ex, "Fatal error executing self-healing automation: {Message}", ex.Message);
            return 1;
        }
    }
}
