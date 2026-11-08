import { TestPlan } from '../validation/testPlanSchema';

export interface AiInterpretation {
  mainGoal: string;
  identifiedEntities: { role?: string; name: string; type: string }[];
  expectedOutcome: string;
  proposedStepsCount: number;
  requiredData: Record<string, string>;
  potentialObstacles: string[];
}

export function generateInterpretation(plan: TestPlan): AiInterpretation {
  const desc = plan.testDescription.trim();
  const lower = desc.toLowerCase();

  // 1. Synthesize Main Goal
  let mainGoal = desc;
  if (lower.includes('login') || lower.includes('sign in')) {
    mainGoal = 'Authenticate user credentials and verify access to secure dashboard area';
  } else if (lower.includes('phptravels') || lower.includes('customer demo')) {
    mainGoal = 'Request customer demo access, dynamically extract temporary credentials, and verify customer dashboard';
  } else if (lower.includes('heading') && lower.includes('assert')) {
    mainGoal = 'Verify presence and visibility of designated semantic heading element';
  } else if (lower.includes('verify') || lower.includes('assert')) {
    mainGoal = `Validate expected web page content and assertions on ${plan.baseUrl}`;
  }

  // 2. Identify Entities from plan steps
  const identifiedEntities: { role?: string; name: string; type: string }[] = [];
  const seen = new Set<string>();

  for (const s of plan.steps) {
    if ('target' in s && s.target) {
      const name = s.target.name || s.target.label || s.target.text || s.target.placeholder || s.target.fallbackSelector || '';
      const key = `${s.target.role || ''}:${name}`;
      if (name && !seen.has(key)) {
        seen.add(key);
        identifiedEntities.push({
          role: s.target.role,
          name,
          type: s.action
        });
      }
    }
  }

  // 3. Expected Outcome from Assertions
  const assertionSteps = plan.steps.filter(s => s.action.startsWith('assert'));
  let expectedOutcome = 'Browser automation steps complete successfully with valid DOM state.';
  if (assertionSteps.length > 0) {
    const details = assertionSteps.map(a => {
      if (a.action === 'assert_visible') {
        const name = a.target?.name || a.target?.text || a.target?.role || 'target element';
        return `Element "${name}" is visible`;
      }
      if (a.action === 'assert_text') {
        return `Text "${a.expectedText}" is found in target element`;
      }
      if (a.action === 'assert_url') {
        return a.contains ? `URL contains "${a.contains}"` : `URL matches "${a.url}"`;
      }
      return a.action;
    });
    expectedOutcome = details.join('; and ');
  }

  // 4. Required Data
  const requiredData: Record<string, string> = {};
  for (const s of plan.steps) {
    if ('value' in s && typeof s.value === 'string') {
      const fieldName = ('target' in s && s.target && (s.target.name || s.target.label || s.target.placeholder)) || 'input';
      requiredData[fieldName] = s.value.length > 20 ? s.value.substring(0, 18) + '...' : s.value;
    }
    if (s.action === 'extract') {
      requiredData[`$${s.variableName}`] = 'Dynamic runtime extraction';
    }
  }

  // 5. Potential Obstacles
  const potentialObstacles: string[] = [];
  if (lower.includes('phptravels')) {
    potentialObstacles.push('Anti-bot security or disposable email filtering may require human review');
  }
  if (plan.baseUrl.includes('http://') || plan.baseUrl.includes('https://')) {
    if (!plan.baseUrl.includes('localhost') && !plan.baseUrl.includes('127.0.0.1')) {
      potentialObstacles.push('Remote third-party network latency or transient server downtime');
    }
  }
  if (plan.steps.some(s => s.action === 'click')) {
    potentialObstacles.push('Asynchronous DOM re-rendering after user interaction');
  }
  if (lower.includes('nonexistent') || lower.includes('fail') || lower.includes('missing')) {
    potentialObstacles.push('Element intentionally absent; expect intentional test failure diagnosis');
  }
  if (potentialObstacles.length === 0) {
    potentialObstacles.push('Standard DOM loading timeouts; handled by auto-waiting Playwright locators');
  }

  return {
    mainGoal,
    identifiedEntities,
    expectedOutcome,
    proposedStepsCount: plan.steps.length,
    requiredData,
    potentialObstacles
  };
}

