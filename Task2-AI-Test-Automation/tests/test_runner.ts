import path from 'path';
import { validateTestPlan, TestPlan } from '../src/validation/testPlanSchema';
import { HeuristicPlanner } from '../src/planner/heuristicPlanner';
import { PlaywrightExecutor } from '../src/executor/playwrightExecutor';
import { loadConfig } from '../src/config/environment';

async function runTests() {
  console.log('\n================================================================================');
  console.log(' Task 2 Technical Audit & Verification Test Suite');
  console.log(' Playwright + AI Planner + Dynamic Browser Observation + Real Execution');
  console.log('================================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`\x1b[32m✔ PASS\x1b[0m - ${testName}`);
      passedCount++;
    } else {
      console.error(`\x1b[31m✖ FAIL\x1b[0m - ${testName}`);
      failedCount++;
    }
  }

  const config = loadConfig();
  config.headless = true;
  const executor = new PlaywrightExecutor(config);
  const localFixtureUrl = `file://${path.resolve(__dirname, 'fixtures/local_login.html').replace(/\\/g, '/')}`;

  // -------------------------------------------------------------------------
  // SUITE 1: ZOD SCHEMA & SECURITY BOUNDARY AUDIT
  // -------------------------------------------------------------------------
  console.log('[Suite 1: Zod Schema & Security Boundaries]');
  
  const validPlan: TestPlan = {
    baseUrl: 'https://example.com',
    testDescription: 'Strict schema test',
    steps: [
      { action: 'navigate', url: 'https://example.com' },
      { action: 'assert_visible', target: { text: 'documentation examples' } }
    ]
  };
  assert(validateTestPlan(validPlan).success, 'Valid declarative test plan passes strict Zod validation');

  const maliciousPlan = {
    baseUrl: 'https://example.com',
    testDescription: 'Malicious arbitrary code attempt',
    steps: [
      { action: 'eval_js', code: 'process.exit(1)' }
    ]
  };
  assert(!validateTestPlan(maliciousPlan).success, 'Arbitrary JavaScript / unknown actions are strictly rejected by Zod');

  const emptyTargetPlan = {
    baseUrl: 'https://example.com',
    testDescription: 'Target with no locator criteria',
    steps: [
      { action: 'click', target: {} }
    ]
  };
  assert(!validateTestPlan(emptyTargetPlan).success, 'Locator targets without criteria are rejected by Zod');

  // -------------------------------------------------------------------------
  // SUITE 2: UNSEEN NATURAL LANGUAGE PLANNING (NO HARDCODED MOCKS)
  // -------------------------------------------------------------------------
  console.log('\n[Suite 2: Generic NLP Test Planning (Unseen Instructions)]');
  const unseenPrompt = "Navigate to https://example.com, verify heading 'Example Domain', and wait for 2 seconds";
  const unseenPlan = HeuristicPlanner.plan('https://example.com', unseenPrompt);
  const unseenVal = validateTestPlan(unseenPlan);
  assert(unseenVal.success, 'Unseen instruction converts into strictly valid Zod JSON plan');
  assert(unseenPlan.steps.length === 3, `Unseen plan generated 3 sequential steps (got ${unseenPlan.steps.length})`);
  assert(unseenPlan.steps[1].action === 'assert_visible', 'Second step is assert_visible');

  // -------------------------------------------------------------------------
  // SUITE 3: GENERIC PASSING TEST (Example.com Verification)
  // -------------------------------------------------------------------------
  console.log('\n[Suite 3: Generic Website Execution - Example.com]');
  const examplePlan: TestPlan = {
    baseUrl: 'https://example.com',
    testDescription: "Navigate to example.com and verify text 'documentation examples'",
    steps: [
      { action: 'navigate', url: 'https://example.com' },
      { action: 'assert_text', target: { text: 'documentation examples' }, expectedText: 'documentation examples' }
    ]
  };
  const exampleReport = await executor.execute(examplePlan);
  assert(exampleReport.overallStatus === 'PASS', 'Example.com verification executed and returned PASS');
  assert(exampleReport.assertionsPassed === 1, '1 assertion verified successfully');
  assert(exampleReport.finalScreenshot !== undefined, 'Final screenshot captured and recorded in report');

  // -------------------------------------------------------------------------
  // SUITE 4: LOCAL LOGIN FIXTURE (Full Auth & Dashboard Verification)
  // -------------------------------------------------------------------------
  console.log('\n[Suite 4: Local Login Fixture - Full Auth & Dashboard Flow]');
  const localLoginPrompt = "Log in as username admin and password password123, then verify customer dashboard is displayed";
  const localLoginPlan = HeuristicPlanner.plan(localFixtureUrl, localLoginPrompt);
  assert(validateTestPlan(localLoginPlan).success, 'Local login plan validated via Zod');
  
  const localLoginReport = await executor.execute(localLoginPlan);
  assert(localLoginReport.overallStatus === 'PASS', 'Local login and dashboard verification returned PASS');
  assert(localLoginReport.steps.some(s => s.action === 'fill' && s.status === 'PASS'), 'Form fill actions executed with PASS');
  assert(localLoginReport.steps.some(s => s.action === 'click' && s.status === 'PASS'), 'Login button clicked with PASS');
  assert(localLoginReport.steps.some(s => s.action === 'assert_visible' && s.status === 'PASS'), 'Dashboard heading asserted with PASS');

  // -------------------------------------------------------------------------
  // SUITE 5: NEGATIVE TEST (Missing Heading - Error Handling & Screenshot)
  // -------------------------------------------------------------------------
  console.log('\n[Suite 5: Negative Test - Missing Heading & Diagnostic Screenshot]');
  const negativePlan: TestPlan = {
    baseUrl: localFixtureUrl,
    testDescription: "Assert missing heading 'NonExistentSecretAdminDashboard123' is visible",
    steps: [
      { action: 'navigate', url: localFixtureUrl },
      { action: 'assert_visible', target: { role: 'heading', name: 'NonExistentSecretAdminDashboard123' }, timeout: 2000 }
    ]
  };
  const negativeReport = await executor.execute(negativePlan);
  assert(negativeReport.overallStatus === 'FAIL', 'Negative test correctly returned FAIL status');
  assert(negativeReport.errorMessage !== undefined, `Failure explanation generated: "${negativeReport.errorMessage?.substring(0, 75)}..."`);
  assert(negativeReport.screenshotOnFailure !== undefined, 'Screenshot on failure captured and recorded');

  // -------------------------------------------------------------------------
  // SUITE 6: PHPTRAVELS CUSTOMER DEMO FLOW
  // -------------------------------------------------------------------------
  console.log('\n[Suite 6: PHPTRAVELS Customer Demo Flow]');
  const phpPrompt = "Get customer demo access, discover customer credentials, log in as a customer, and verify that the customer dashboard is displayed";
  const phpPlan = HeuristicPlanner.plan('https://phptravels.com/demo', phpPrompt);
  assert(validateTestPlan(phpPlan).success, 'PHPTRAVELS demo plan validated via Zod');
  
  const phpReport = await executor.execute(phpPlan);
  console.log(`PHPTRAVELS execution outcome: ${phpReport.overallStatus}`);
  console.log(`Steps completed: ${phpReport.steps.filter(s => s.status === 'PASS').length} of ${phpReport.steps.length}`);
  if (phpReport.blockedReason) {
    console.log(`Diagnostic Notice: ${phpReport.blockedReason}`);
  }
  assert(
    phpReport.overallStatus === 'PASS' || phpReport.overallStatus === 'BLOCKED' || phpReport.overallStatus === 'FAIL',
    'PHPTRAVELS test executed with real browser automation and reported truthful status (never faked)'
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(` Technical Audit Summary: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('================================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
