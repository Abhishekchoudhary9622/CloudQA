using System.Text.Json;
using Microsoft.Extensions.Logging;
using SelfHealingSelenium.Models;

namespace SelfHealingSelenium.Services;

public class ReportingService
{
    private readonly string _reportDir;
    private readonly ILogger _logger;

    public ReportingService(string reportDir, ILogger logger)
    {
        _reportDir = reportDir;
        _logger = logger;

        if (!Directory.Exists(_reportDir))
        {
            Directory.CreateDirectory(_reportDir);
        }
    }

    public string SaveJsonReport(ExecutionReport report)
    {
        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        var filename = $"execution_report_{timestamp}.json";
        var fullPath = Path.Combine(_reportDir, filename);

        var options = new JsonSerializerOptions
        {
            WriteIndented = true
        };

        var json = JsonSerializer.Serialize(report, options);
        File.WriteAllText(fullPath, json);

        _logger.LogInformation("Saved execution report to '{Path}'", fullPath);
        return fullPath;
    }

    public void PrintTerminalSummary(ExecutionReport report)
    {
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("================================================================================");
        Console.WriteLine("                    CLOUDQA TEST EXECUTION REPORT SUMMARY                       ");
        Console.WriteLine("================================================================================");
        Console.ResetColor();

        Console.WriteLine($" Target URL : {report.TargetUrl}");
        Console.WriteLine($" Start Time : {report.StartTime:yyyy-MM-dd HH:mm:ss} UTC");
        Console.WriteLine($" Duration   : {report.TotalDuration.TotalSeconds:F2} seconds");

        Console.Write(" Status     : ");
        if (report.OverallStatus)
        {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("PASS [ALL FIELDS VERIFIED SUCCESSFULLY]");
        }
        else
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"FAIL [{report.ErrorMessage ?? "Test failed"}]");
        }
        Console.ResetColor();

        Console.WriteLine("--------------------------------------------------------------------------------");
        Console.WriteLine(string.Format("{0,-12} | {1,-14} | {2,-16} | {3,-8} | {4,-6}", "Field", "Target Value", "Verified Value", "Score", "Status"));
        Console.WriteLine("--------------------------------------------------------------------------------");

        foreach (var step in report.StepResults)
        {
            var statusStr = step.VerificationPassed ? "PASS" : "FAIL";
            var color = step.VerificationPassed ? ConsoleColor.Green : ConsoleColor.Red;

            Console.Write(string.Format("{0,-12} | {1,-14} | {2,-16} | {3,-8:F2} | ",
                step.FieldKey,
                step.TargetValue,
                step.ActualValueReadBack ?? "null",
                step.ConfidenceScore));

            Console.ForegroundColor = color;
            Console.WriteLine(statusStr);
            Console.ResetColor();

            if (step.Diagnostic != null)
            {
                Console.ForegroundColor = ConsoleColor.DarkGray;
                Console.WriteLine($"   Matched: {step.Diagnostic.WinningElementDescription} | {step.Diagnostic.StrategySummary}");
                Console.ResetColor();
            }
        }

        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("================================================================================");
        Console.ResetColor();
        Console.WriteLine();
    }
}

