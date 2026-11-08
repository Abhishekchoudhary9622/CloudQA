import { chromium, Browser, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { AppConfig } from '../config/environment';
import { SmartLocatorResolver, ResolutionResult } from '../locators/smartLocator';
import { PageObserver, PageObservation } from '../observation/pageObserver';
import { TestPlan, TestStep } from '../validation/testPlanSchema';

export type StepStatus = 'PASS' | 'FAIL' | 'BLOCKED';

export interface StepExecutionResult {
  stepIndex: number;
  action: string;
  details: string;
  strategyUsed?: string;
  status: StepStatus;
  durationMs: number;
  error?: string;
  screenshotPath?: string;
  observation?: string;
  locatorDetails?: {
    role?: string;
    accessibleName?: string;
    matchedCount?: number;
    strategyUsed?: string;
    isVisible?: boolean;
    isEnabled?: boolean;
    candidateAttempts?: string[];
    diagnostics?: string;
  };
  assertionEvidence?: {
    assertionType: string;
    expectedValue: string;
    actualValue: string;
    passed: boolean;
    explanation: string;
  };
}

export interface TestExecutionReport {
  testDescription: string;
  baseUrl: string;
  plan: TestPlan;
  steps: StepExecutionResult[];
  overallStatus: 'PASS' | 'FAIL' | 'BLOCKED';
  totalDurationMs: number;
  startTime: string;
  endTime: string;
  errorMessage?: string;
  blockedReason?: string;
  screenshotOnFailure?: string;
  finalScreenshot?: string;
  initialScreenshot?: string;
  runtimeVariables?: Record<string, string>;
  assertionsPassed: number;
  assertionsFailed: number;
  category?: string;
}

export type ExecutionEventListener = (event: {
  type: 'log' | 'step_start' | 'step_end' | 'observation' | 'done';
  message?: string;
  step?: StepExecutionResult;
  report?: TestExecutionReport;
  observation?: PageObservation;
}) => void;

export interface ExecutionOptions {
  timeout?: number;
  headless?: boolean;
  category?: string;
}

export class PlaywrightExecutor {
  private runtimeVariables: Record<string, string> = {};

  constructor(private config: AppConfig) {
    if (!fs.existsSync(this.config.screenshotsDir)) {
      fs.mkdirSync(this.config.screenshotsDir, { recursive: true });
    }
  }

  public async execute(
    plan: TestPlan,
    listener?: ExecutionEventListener,
    options?: ExecutionOptions
  ): Promise<TestExecutionReport> {
    const startTime = new Date();
    this.runtimeVariables = {};
    const emit = (event: Parameters<ExecutionEventListener>[0]) => listener && listener(event);

    const isHeadless = options?.headless !== undefined ? options.headless : this.config.headless;
    const effectiveTimeout = options?.timeout || this.config.browserTimeout;

    emit({ type: 'log', message: `Initializing browser (Headless: ${isHeadless}, Timeout: ${effectiveTimeout}ms)` });

    let browser: Browser | null = null;
    let page: Page | null = null;
    const stepResults: StepExecutionResult[] = [];
    let overallStatus: 'PASS' | 'FAIL' | 'BLOCKED' = 'PASS';
    let fatalError: string | undefined;
    let blockedReason: string | undefined;
    let screenshotOnFailure: string | undefined;
    let initialScreenshot: string | undefined;
    let finalScreenshot: string | undefined;
    let assertionsPassed = 0;
    let assertionsFailed = 0;

    try {
      // Launch Chrome (prefers installed Chrome channel, falls back to standard Chromium)
      try {
        browser = await chromium.launch({
          channel: 'chrome',
          headless: isHeadless,
          args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
        });
      } catch {
        browser = await chromium.launch({
          headless: isHeadless,
          args: ['--no-sandbox']
        });
      }

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      page = await context.newPage();
      page.setDefaultTimeout(effectiveTimeout);
      const resolver = new SmartLocatorResolver(page);

      emit({ type: 'log', message: `Executing ${plan.steps.length} test steps for: "${plan.testDescription}"` });

      for (let i = 0; i < plan.steps.length; i++) {
        const step: TestStep = plan.steps[i];
        const stepStart = Date.now();
        const actionName = String(step.action);

        emit({
          type: 'step_start',
          message: `Step ${i + 1}/${plan.steps.length}: [${actionName.toUpperCase()}]`
        });

        // Pre-action dynamic browser observation
        let observationText = '';
        if (actionName !== 'navigate' && page.url() && page.url() !== 'about:blank') {
          const obs = await PageObserver.observe(page);
          observationText = obs.summary;
          emit({ type: 'observation', observation: obs, message: `[Dynamic Observation] ${obs.summary}` });
        }

        // Check if page is currently BLOCKED by anti-bot, captcha, or cloudflare challenge
        const isBlocked = await this.checkForBlockedGate(page);
        if (isBlocked) {
          overallStatus = 'BLOCKED';
          blockedReason = isBlocked;
          const failureShot = await this.captureScreenshot(page, `blocked_step_${i + 1}`);
          screenshotOnFailure = failureShot;

          const blockedStep: StepExecutionResult = {
            stepIndex: i + 1,
            action: actionName,
            details: `Action halted: Target page encountered access challenge (${isBlocked})`,
            status: 'BLOCKED',
            durationMs: Date.now() - stepStart,
            error: isBlocked,
            screenshotPath: failureShot,
            observation: observationText
          };

          stepResults.push(blockedStep);
          emit({
            type: 'step_end',
            step: blockedStep,
            message: `Step ${i + 1} BLOCKED: ${isBlocked}`
          });
          break;
        }

        try {
          const stepResult = await this.executeStep(page, resolver, step, i + 1, effectiveTimeout);
          stepResult.observation = observationText;

          if (stepResult.action.startsWith('assert')) {
            assertionsPassed++;
          }

          // Capture initial screenshot right after first step (navigation)
          if (i === 0 && !initialScreenshot) {
            initialScreenshot = await this.captureScreenshot(page, 'initial_state');
          }

          stepResults.push(stepResult);
          emit({
            type: 'step_end',
            step: stepResult,
            message: `Step ${i + 1} passed in ${stepResult.durationMs}ms: ${stepResult.details}`
          });

          // Post-action re-observation after state-changing interactions
          if (['click', 'navigate', 'fill', 'select'].includes(actionName)) {
            await page.waitForTimeout(400);
            const postObs = await PageObserver.observe(page);
            emit({ type: 'observation', observation: postObs, message: `[Post-Action Observation] ${postObs.summary}` });
          }

        } catch (stepErr: any) {
          const durationMs = Date.now() - stepStart;
          const failureShot = await this.captureScreenshot(page, `failure_step_${i + 1}`);
          screenshotOnFailure = failureShot;

          if (actionName.startsWith('assert')) {
            assertionsFailed++;
          }

          // Check if failure is due to a security challenge or anti-bot barrier
          const blockedCheck = await this.checkForBlockedGate(page);
          if (blockedCheck) {
            overallStatus = 'BLOCKED';
            blockedReason = blockedCheck;
          } else {
            overallStatus = 'FAIL';
          }

          fatalError = stepErr.message;

          const failedStep: StepExecutionResult = {
            stepIndex: i + 1,
            action: actionName,
            details: JSON.stringify(step),
            status: overallStatus === 'BLOCKED' ? 'BLOCKED' : 'FAIL',
            durationMs,
            error: stepErr.message,
            screenshotPath: failureShot,
            observation: observationText
          };

          stepResults.push(failedStep);
          emit({
            type: 'step_end',
            step: failedStep,
            message: `Step ${i + 1} ${failedStep.status}: ${stepErr.message}`
          });

          // Break on first failure as subsequent dependent steps are invalidated
          break;
        }
      }

      if (page) {
        finalScreenshot = await this.captureScreenshot(
          page,
          overallStatus === 'PASS' ? 'success_final' : overallStatus === 'BLOCKED' ? 'blocked_final' : 'failure_final'
        );
      }

    } catch (browserErr: any) {
      overallStatus = 'FAIL';
      fatalError = browserErr.message;
      emit({ type: 'log', message: `Browser execution error: ${browserErr.message}` });
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    const endTime = new Date();
    const totalDurationMs = endTime.getTime() - startTime.getTime();

    // Verify assertion integrity: A test cannot PASS if no assertions were performed
    const hasAssertionSteps = plan.steps.some(s => s.action.startsWith('assert'));
    if (overallStatus === 'PASS' && hasAssertionSteps && assertionsPassed === 0) {
      overallStatus = 'FAIL';
      fatalError = 'Zero assertions verified successfully.';
    }

    const report: TestExecutionReport = {
      testDescription: plan.testDescription,
      baseUrl: plan.baseUrl,
      plan,
      steps: stepResults,
      overallStatus,
      totalDurationMs,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      errorMessage: fatalError,
      blockedReason,
      screenshotOnFailure,
      finalScreenshot,
      initialScreenshot,
      runtimeVariables: this.runtimeVariables,
      assertionsPassed,
      assertionsFailed,
      category: options?.category || 'Functional'
    };

    emit({ type: 'done', report, message: `Execution completed: ${report.overallStatus}` });
    return report;
  }

  private async executeStep(
    page: Page,
    resolver: SmartLocatorResolver,
    step: TestStep,
    stepNum: number,
    timeoutMs: number
  ): Promise<StepExecutionResult> {
    const start = Date.now();
    let details = '';
    let strategyUsed: string | undefined;
    let locatorDetails: StepExecutionResult['locatorDetails'];
    let assertionEvidence: StepExecutionResult['assertionEvidence'];

    switch (step.action) {
      case 'navigate': {
        const resolvedUrl = this.substituteVariables(step.url);
        details = `Navigate to ${resolvedUrl}`;
        await page.goto(resolvedUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        strategyUsed = `page.goto('${resolvedUrl}')`;
        locatorDetails = {
          strategyUsed,
          diagnostics: `Browser navigated to '${resolvedUrl}' and waited for domcontentloaded.`
        };
        break;
      }

      case 'click': {
        const res = await resolver.resolve(step.target, 'click');
        strategyUsed = res.strategyUsed;
        details = `Click element via ${strategyUsed}`;
        locatorDetails = {
          role: res.role,
          accessibleName: res.accessibleName,
          matchedCount: res.matchedCount,
          strategyUsed: res.strategyUsed,
          isVisible: res.isVisible,
          isEnabled: res.isEnabled,
          candidateAttempts: res.candidateAttempts,
          diagnostics: res.diagnostics
        };
        await res.locator.click({ timeout: step.timeout || timeoutMs });
        break;
      }

      case 'fill': {
        const resolvedValue = this.substituteVariables(step.value);
        const res = await resolver.resolve(step.target, 'fill');
        strategyUsed = res.strategyUsed;
        details = `Fill '${resolvedValue}' into element via ${strategyUsed}`;
        locatorDetails = {
          role: res.role,
          accessibleName: res.accessibleName,
          matchedCount: res.matchedCount,
          strategyUsed: res.strategyUsed,
          isVisible: res.isVisible,
          isEnabled: res.isEnabled,
          candidateAttempts: res.candidateAttempts,
          diagnostics: res.diagnostics
        };
        await res.locator.fill(resolvedValue, { timeout: step.timeout || timeoutMs });
        break;
      }

      case 'select': {
        const resolvedValue = this.substituteVariables(step.value);
        const res = await resolver.resolve(step.target, 'select');
        strategyUsed = res.strategyUsed;
        details = `Select '${resolvedValue}' via ${strategyUsed}`;
        locatorDetails = {
          role: res.role,
          accessibleName: res.accessibleName,
          matchedCount: res.matchedCount,
          strategyUsed: res.strategyUsed,
          isVisible: res.isVisible,
          isEnabled: res.isEnabled,
          candidateAttempts: res.candidateAttempts,
          diagnostics: res.diagnostics
        };
        await res.locator.selectOption(resolvedValue, { timeout: step.timeout || timeoutMs });
        break;
      }

      case 'check': {
        const res = await resolver.resolve(step.target, 'check');
        strategyUsed = res.strategyUsed;
        details = `Check checkbox/radio via ${strategyUsed}`;
        locatorDetails = {
          role: res.role,
          accessibleName: res.accessibleName,
          matchedCount: res.matchedCount,
          strategyUsed: res.strategyUsed,
          isVisible: res.isVisible,
          isEnabled: res.isEnabled,
          candidateAttempts: res.candidateAttempts,
          diagnostics: res.diagnostics
        };
        await res.locator.check({ timeout: step.timeout || timeoutMs });
        break;
      }

      case 'uncheck': {
        const res = await resolver.resolve(step.target, 'uncheck');
        strategyUsed = res.strategyUsed;
        details = `Uncheck checkbox via ${strategyUsed}`;
        locatorDetails = {
          role: res.role,
          accessibleName: res.accessibleName,
          matchedCount: res.matchedCount,
          strategyUsed: res.strategyUsed,
          isVisible: res.isVisible,
          isEnabled: res.isEnabled,
          candidateAttempts: res.candidateAttempts,
          diagnostics: res.diagnostics
        };
        await res.locator.uncheck({ timeout: step.timeout || timeoutMs });
        break;
      }

      case 'press': {
        const res = await resolver.resolve(step.target, 'press');
        strategyUsed = res.strategyUsed;
        details = `Press key '${step.key}' via ${strategyUsed}`;
        locatorDetails = {
          role: res.role,
          accessibleName: res.accessibleName,
          matchedCount: res.matchedCount,
          strategyUsed: res.strategyUsed,
          isVisible: res.isVisible,
          isEnabled: res.isEnabled,
          candidateAttempts: res.candidateAttempts,
          diagnostics: res.diagnostics
        };
        await res.locator.press(step.key, { timeout: step.timeout || timeoutMs });
        break;
      }

      case 'extract': {
        let extracted = '';
        if (step.source === 'url' || (!step.target && !step.source)) {
          extracted = page.url();
          strategyUsed = `page.url() -> '${extracted}'`;
          locatorDetails = {
            strategyUsed,
            diagnostics: 'URL extracted from active browser tab.'
          };
        } else if (step.target) {
          const res = await resolver.resolve(step.target, 'extract');
          strategyUsed = res.strategyUsed;
          locatorDetails = {
            role: res.role,
            accessibleName: res.accessibleName,
            matchedCount: res.matchedCount,
            strategyUsed: res.strategyUsed,
            isVisible: res.isVisible,
            isEnabled: res.isEnabled,
            candidateAttempts: res.candidateAttempts,
            diagnostics: res.diagnostics
          };
          if (step.source === 'attribute' && step.attributeName) {
            extracted = (await res.locator.getAttribute(step.attributeName)) || '';
          } else {
            extracted = (await res.locator.innerText()) || (await res.locator.inputValue().catch(() => ''));
          }
        }

        if (step.pattern) {
          const match = extracted.match(new RegExp(step.pattern));
          if (match && match[1]) {
            extracted = match[1];
          }
        }

        this.runtimeVariables[step.variableName] = extracted.trim();
        details = `Extracted variable '$${step.variableName}' = '${extracted.trim()}'`;
        break;
      }

      case 'wait_for': {
        if (step.target) {
          const res = await resolver.resolve(step.target, 'wait_for');
          strategyUsed = res.strategyUsed;
          details = `Wait for element state: ${step.state || 'visible'}`;
          locatorDetails = {
            role: res.role,
            accessibleName: res.accessibleName,
            matchedCount: res.matchedCount,
            strategyUsed: res.strategyUsed,
            isVisible: res.isVisible,
            isEnabled: res.isEnabled,
            candidateAttempts: res.candidateAttempts,
            diagnostics: res.diagnostics
          };
          await res.locator.waitFor({ state: step.state || 'visible', timeout: step.timeout || 5000 });
        } else {
          const waitTime = step.timeout || 2000;
          details = `Wait for ${waitTime}ms`;
          await page.waitForTimeout(waitTime);
          strategyUsed = `page.waitForTimeout(${waitTime})`;
          locatorDetails = {
            strategyUsed,
            diagnostics: `Explicit delay of ${waitTime}ms for page stabilization.`
          };
        }
        break;
      }

      case 'assert_visible': {
        const res = await resolver.resolve(step.target, 'assert_visible');
        strategyUsed = res.strategyUsed;
        details = `Assert element is visible via ${strategyUsed}`;
        locatorDetails = {
          role: res.role,
          accessibleName: res.accessibleName,
          matchedCount: res.matchedCount,
          strategyUsed: res.strategyUsed,
          isVisible: res.isVisible,
          isEnabled: res.isEnabled,
          candidateAttempts: res.candidateAttempts,
          diagnostics: res.diagnostics
        };
        const isVisible = await res.locator.isVisible();
        assertionEvidence = {
          assertionType: 'assert_visible',
          expectedValue: 'visible: true',
          actualValue: `visible: ${isVisible}`,
          passed: isVisible,
          explanation: isVisible
            ? `Element was resolved and confirmed visible in active viewport (${strategyUsed}).`
            : `Element matched in DOM but is currently invisible or zero-dimensioned.`
        };
        if (!isVisible) {
          throw new Error(`AssertionFailed: Element resolved via ${strategyUsed} is not visible in DOM.`);
        }
        break;
      }

      case 'assert_text': {
        const resolvedExpected = this.substituteVariables(step.expectedText);
        const res = await resolver.resolve(step.target, 'assert_text');
        strategyUsed = res.strategyUsed;
        details = `Assert text contains '${resolvedExpected}'`;
        locatorDetails = {
          role: res.role,
          accessibleName: res.accessibleName,
          matchedCount: res.matchedCount,
          strategyUsed: res.strategyUsed,
          isVisible: res.isVisible,
          isEnabled: res.isEnabled,
          candidateAttempts: res.candidateAttempts,
          diagnostics: res.diagnostics
        };
        const actualText = await res.locator.innerText();
        const matches = step.exact
          ? actualText.trim() === resolvedExpected.trim()
          : actualText.toLowerCase().includes(resolvedExpected.toLowerCase());

        assertionEvidence = {
          assertionType: 'assert_text',
          expectedValue: resolvedExpected,
          actualValue: actualText.trim(),
          passed: matches,
          explanation: matches
            ? `DOM text '${actualText.trim()}' conforms to expected text pattern '${resolvedExpected}'.`
            : `DOM text '${actualText.trim()}' does not contain expected substring '${resolvedExpected}'.`
        };

        if (!matches) {
          throw new Error(`AssertionFailed: Expected text '${resolvedExpected}', but found '${actualText.trim()}'.`);
        }
        break;
      }

      case 'assert_url': {
        const currentUrl = page.url();
        details = `Assert URL condition`;
        strategyUsed = `page.url() -> ${currentUrl}`;
        let passed = true;
        let expectedVal = '';

        if (step.url) {
          const targetUrl = this.substituteVariables(step.url);
          expectedVal = `exact: ${targetUrl}`;
          if (currentUrl !== targetUrl) {
            passed = false;
            assertionEvidence = {
              assertionType: 'assert_url',
              expectedValue: expectedVal,
              actualValue: currentUrl,
              passed: false,
              explanation: `Current URL '${currentUrl}' does not match expected URL '${targetUrl}'.`
            };
            throw new Error(`AssertionFailed: Expected URL '${targetUrl}', but current URL is '${currentUrl}'.`);
          }
        }
        if (step.contains) {
          const substr = this.substituteVariables(step.contains);
          expectedVal = `contains: ${substr}`;
          if (!currentUrl.includes(substr)) {
            passed = false;
            assertionEvidence = {
              assertionType: 'assert_url',
              expectedValue: expectedVal,
              actualValue: currentUrl,
              passed: false,
              explanation: `Current URL '${currentUrl}' does not contain expected substring '${substr}'.`
            };
            throw new Error(`AssertionFailed: Expected URL to contain '${substr}', but current URL is '${currentUrl}'.`);
          }
        }

        assertionEvidence = {
          assertionType: 'assert_url',
          expectedValue: expectedVal,
          actualValue: currentUrl,
          passed: true,
          explanation: `Current browser URL '${currentUrl}' successfully satisfied URL condition.`
        };
        break;
      }

      default:
        throw new Error(`Unsupported action type: ${(step as any).action}`);
    }

    return {
      stepIndex: stepNum,
      action: step.action,
      details,
      strategyUsed,
      status: 'PASS',
      durationMs: Date.now() - start,
      locatorDetails,
      assertionEvidence
    };
  }

  private substituteVariables(text: string): string {
    let result = text;
    for (const [key, val] of Object.entries(this.runtimeVariables)) {
      result = result.replace(new RegExp(`\\$${key}`, 'g'), val);
    }
    return result;
  }

  private async checkForBlockedGate(page: Page): Promise<string | null> {
    try {
      const challengeDetected = await page.evaluate(() => {
        const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
        const title = document.title ? document.title.toLowerCase() : '';

        // Cloudflare / Turnstile challenges
        if (title.includes('just a moment') || title.includes('attention required') || bodyText.includes('verify you are human') || bodyText.includes('checking your browser')) {
          return 'Cloudflare / Anti-bot Human Verification Challenge detected';
        }

        // CAPTCHA iframes
        if (document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"]')) {
          return 'Interactive CAPTCHA / Proof-of-Work challenge present on page';
        }

        // Explicit remote server anti-bot / email rejection
        const errorAlert = document.querySelector('.alert-danger, .dm-hero-done-head, [x-show="error"], .error-message');
        if (errorAlert && errorAlert.textContent) {
          const alertText = errorAlert.textContent.toLowerCase();
          if (alertText.includes('email rejected') || alertText.includes('permanent work email') || alertText.includes('too many demo requests')) {
            return `Remote server access restricted: ${errorAlert.textContent.trim()}`;
          }
        }

        return null;
      });

      return challengeDetected;
    } catch {
      return null;
    }
  }

  private async captureScreenshot(page: Page, prefix: string): Promise<string | undefined> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${prefix}_${timestamp}.png`;
      const fullPath = path.join(this.config.screenshotsDir, filename);
      await page.screenshot({ path: fullPath, fullPage: true });
      return fullPath;
    } catch {
      return undefined;
    }
  }
}
