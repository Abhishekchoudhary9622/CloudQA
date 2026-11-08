import { loadConfig } from './config/environment';
import { AiPlanner } from './planner/aiPlanner';
import { PlaywrightExecutor } from './executor/playwrightExecutor';
import { ReportGenerator } from './reporting/reportGenerator';

async function main() {
  const config = loadConfig();
  const args = process.argv.slice(2);

  let url = 'https://example.com';
  let testCase = "Navigate to https://example.com and assert heading 'Example Domain' is visible";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && i + 1 < args.length) {
      url = args[++i];
    } else if (arg.startsWith('--url=')) {
      url = arg.substring('--url='.length);
    } else if (arg === '--test' && i + 1 < args.length) {
      testCase = args[++i];
    } else if (arg.startsWith('--test=')) {
      testCase = arg.substring('--test='.length);
    } else if (arg === '--headed') {
      config.headless = false;
    }
  }

  console.log(`\nStarting AI Plain-English-to-Test Automation Runner`);
  console.log(`URL       : ${url}`);
  console.log(`Test Case : ${testCase}`);
  console.log(`Provider  : ${config.llmProvider}\n`);

  const planner = new AiPlanner(config);
  const plan = await planner.plan(url, testCase);

  console.log('--- Generated Plan ---');
  console.log(JSON.stringify(plan, null, 2));
  console.log('----------------------\n');

  const executor = new PlaywrightExecutor(config);
  const report = await executor.execute(plan, event => {
    if (event.type === 'log') {
      console.log(`[Browser] ${event.message}`);
    }
  });

  const reporter = new ReportGenerator(config);
  const reportFile = reporter.saveJsonReport(report);
  reporter.printTerminalSummary(report);

  console.log(`Report JSON saved to: ${reportFile}`);
  process.exit(report.overallStatus === 'PASS' ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
