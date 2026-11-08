import fs from 'fs';
import path from 'path';
import { AppConfig } from '../config/environment';
import { TestExecutionReport } from '../executor/playwrightExecutor';

export class ReportGenerator {
  constructor(private config: AppConfig) {
    if (!fs.existsSync(this.config.reportsDir)) {
      fs.mkdirSync(this.config.reportsDir, { recursive: true });
    }
  }

  public saveJsonReport(report: TestExecutionReport): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test_report_${timestamp}.json`;
    const fullPath = path.join(this.config.reportsDir, filename);

    fs.writeFileSync(fullPath, JSON.stringify(report, null, 2), 'utf-8');
    return fullPath;
  }

  public printTerminalSummary(report: TestExecutionReport): void {
    console.log('\n\x1b[36m================================================================================\x1b[0m');
    console.log('\x1b[36m              AI-POWERED PLAYWRIGHT TEST AUTOMATION REPORT                     \x1b[0m');
    console.log('\x1b[36m================================================================================\x1b[0m');
    console.log(` Test Case   : ${report.testDescription}`);
    console.log(` Target URL  : ${report.baseUrl}`);
    console.log(` Start Time  : ${report.startTime}`);
    console.log(` Duration   : ${(report.totalDurationMs / 1000).toFixed(2)}s`);
    
    if (report.overallStatus === 'PASS') {
      console.log(` Status      : \x1b[32mPASS [ALL STEPS EXECUTED SUCCESSFULLY]\x1b[0m`);
    } else if (report.overallStatus === 'BLOCKED') {
      console.log(` Status      : \x1b[33mBLOCKED [${report.blockedReason || 'Human verification or security challenge'}]\x1b[0m`);
    } else {
      console.log(` Status      : \x1b[31mFAIL [${report.errorMessage || 'One or more steps failed'}]\x1b[0m`);
    }

    console.log('--------------------------------------------------------------------------------');
    console.log(`${'Step'.padEnd(6)} | ${'Action'.padEnd(14)} | ${'Duration'.padEnd(10)} | ${'Status'.padEnd(8)} | Details`);
    console.log('--------------------------------------------------------------------------------');

    for (const step of report.steps) {
      const statusColor = step.status === 'PASS' ? '\x1b[32m' : step.status === 'BLOCKED' ? '\x1b[33m' : '\x1b[31m';
      const dur = `${step.durationMs}ms`;
      console.log(
        `${step.stepIndex.toString().padEnd(6)} | ` +
        `${step.action.padEnd(14)} | ` +
        `${dur.padEnd(10)} | ` +
        `${statusColor}${step.status.padEnd(8)}\x1b[0m | ` +
        `${step.strategyUsed || step.details}`
      );
      if (step.error) {
        console.log(`       \x1b[31m└── Error: ${step.error}\x1b[0m`);
      }
    }

    if (report.screenshotOnFailure) {
      console.log(`\n Failure Screenshot : ${report.screenshotOnFailure}`);
    } else if (report.finalScreenshot) {
      console.log(`\n Final Screenshot   : ${report.finalScreenshot}`);
    }

    console.log('\x1b[36m================================================================================\x1b[0m\n');
  }
}

