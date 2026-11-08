using Microsoft.Extensions.Configuration;

namespace SelfHealingSelenium.Configuration;

public static class ConfigurationManager
{
    public static AutomationOptions Load(string[]? args = null)
    {
        // 1. Try loading .env file if present in current directory or parent directories
        LoadDotEnvFile();

        var builder = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: false)
            .AddEnvironmentVariables();

        var configuration = builder.Build();
        var options = new AutomationOptions();
        configuration.GetSection("AutomationOptions").Bind(options);

        // 2. Direct env var overrides for standard keys
        var envUrl = Environment.GetEnvironmentVariable("TARGET_URL");
        if (!string.IsNullOrWhiteSpace(envUrl)) options.TargetUrl = envUrl.Trim();

        var envFirstName = Environment.GetEnvironmentVariable("FIRST_NAME");
        if (!string.IsNullOrWhiteSpace(envFirstName)) options.FirstName = envFirstName.Trim();

        var envGender = Environment.GetEnvironmentVariable("GENDER");
        if (!string.IsNullOrWhiteSpace(envGender)) options.Gender = envGender.Trim();

        var envState = Environment.GetEnvironmentVariable("STATE");
        if (!string.IsNullOrWhiteSpace(envState)) options.State = envState.Trim();

        var envHeadless = Environment.GetEnvironmentVariable("HEADLESS");
        if (bool.TryParse(envHeadless, out var hl)) options.Headless = hl;

        var envMinConfidence = Environment.GetEnvironmentVariable("MIN_CONFIDENCE");
        if (double.TryParse(envMinConfidence, out var mc)) options.MinConfidenceThreshold = mc;

        var envAmbiguityMargin = Environment.GetEnvironmentVariable("AMBIGUITY_MARGIN");
        if (double.TryParse(envAmbiguityMargin, out var am)) options.AmbiguityMarginThreshold = am;

        // 3. CLI arguments override
        if (args != null)
        {
            for (int i = 0; i < args.Length; i++)
            {
                var arg = args[i];
                if (arg.Equals("--url", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                    options.TargetUrl = args[++i];
                else if (arg.StartsWith("--url=", StringComparison.OrdinalIgnoreCase))
                    options.TargetUrl = arg.Substring("--url=".Length);
                else if (arg.Equals("--headless", StringComparison.OrdinalIgnoreCase))
                    options.Headless = true;
                else if (arg.StartsWith("--headless=", StringComparison.OrdinalIgnoreCase))
                {
                    if (bool.TryParse(arg.Substring("--headless=".Length), out var h))
                    {
                        options.Headless = h;
                    }
                }
                else if (arg.Equals("--first-name", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                    options.FirstName = args[++i];
                else if (arg.Equals("--gender", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                    options.Gender = args[++i];
                else if (arg.Equals("--state", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                    options.State = args[++i];
            }
        }

        return options;
    }

    private static void LoadDotEnvFile()
    {
        var current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current != null)
        {
            var envPath = Path.Combine(current.FullName, ".env");
            if (File.Exists(envPath))
            {
                foreach (var line in File.ReadAllLines(envPath))
                {
                    var trimmed = line.Trim();
                    if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith("#"))
                        continue;
                    var parts = trimmed.Split('=', 2);
                    if (parts.Length == 2)
                    {
                        var key = parts[0].Trim();
                        var value = parts[1].Trim().Trim('"', '\'');
                        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
                        {
                            Environment.SetEnvironmentVariable(key, value);
                        }
                    }
                }
                break;
            }
            current = current.Parent;
        }
    }
}
