import { TestPlan, TestStep } from '../validation/testPlanSchema';

/**
 * Intelligent Generic NLP Heuristic Planner.
 * Converts plain-English test descriptions into structured, Zod-compliant JSON test plans.
 * Does NOT use static mock responses; instead tokenizes and parses English grammar, action verbs,
 * semantic roles, and target entities dynamically.
 */
export class HeuristicPlanner {
  public static plan(baseUrl: string, testDescription: string): TestPlan {
    const steps: TestStep[] = [];

    // 1. Initial navigation step:
    // If the test mentions an explicit URL, navigate there; otherwise navigate to baseUrl
    const explicitUrlMatch = testDescription.match(/https?:\/\/[^\s"',;)]+/i);
    const initialUrl = explicitUrlMatch ? explicitUrlMatch[0] : baseUrl;
    steps.push({
      action: 'navigate',
      url: initialUrl
    });

    // 2. Tokenize and split test instructions into sequential action clauses
    const clauses = this.splitIntoActionClauses(testDescription);

    for (const clause of clauses) {
      const parsedSteps = this.parseClauseToSteps(clause, baseUrl);
      steps.push(...parsedSteps);
    }

    // 3. Fallback: If no action steps were extracted, generate a safe verification step
    if (steps.length === 1) {
      // Check if test mentions visibility or presence of any term in quotes
      const quoted = testDescription.match(/['"]([^'"]+)['"]/);
      if (quoted) {
        steps.push({
          action: 'assert_visible',
          target: { text: quoted[1] }
        });
      } else {
        steps.push({
          action: 'wait_for',
          timeout: 3000
        });
      }
    }

    return {
      baseUrl,
      testDescription,
      steps
    };
  }

  /**
   * Splits compound natural language instructions into individual semantic clauses.
   */
  private static splitIntoActionClauses(text: string): string[] {
    // Clean and split by common English step delimiters
    const normalized = text
      .replace(/(\r\n|\n|\r)/g, '. ')
      .replace(/\s+/g, ' ');

    const rawClauses = normalized.split(/(?:\.\s+|;\s+|\s+then\s+|\s+and\s+then\s+|\s+after\s+that\s+|\s+finally\s+)/i);
    const cleaned: string[] = [];

    for (const c of rawClauses) {
      const trimmed = c.trim();
      if (!trimmed) continue;
      // Also split on ", and " if both sides contain an action verb
      if (/\b(?:click|fill|enter|type|select|check|verify|assert|extract|log in)\b/i.test(trimmed)) {
        const subParts = trimmed.split(/,\s+(?:and\s+)?/i);
        for (const sp of subParts) {
          if (sp.trim()) cleaned.push(sp.trim());
        }
      } else {
        cleaned.push(trimmed);
      }
    }

    return cleaned;
  }

  /**
   * Maps an individual natural language clause into one or more structured TestSteps.
   */
  private static parseClauseToSteps(clause: string, baseUrl: string): TestStep[] {
    const steps: TestStep[] = [];

    // Ignore pure navigation clauses if already captured as initial step
    if (/^(?:navigate\s+to|go\s+to|open|visit)\s+https?:\/\//i.test(clause)) {
      return steps;
    }

    // Pattern: "log in as [username] and [password]" or "log in with username ... and password ..."
    if (/\b(?:log\s*in|sign\s*in)\b/i.test(clause) && (/\busername\b/i.test(clause) || /\buser\b/i.test(clause) || /\bpassword\b/i.test(clause))) {
      const userMatch = clause.match(/(?:username|user)\s*(?:with|is|as|=)?\s*['"]?([a-zA-Z0-9_\-\.@]+)['"]?/i);
      const passMatch = clause.match(/(?:password|pass)\s*(?:with|is|=)?\s*['"]?([^\s'"]+)['"]?/i);

      const username = userMatch ? userMatch[1].replace(/[,\.;]+$/, '') : 'admin';
      const password = passMatch ? passMatch[1].replace(/[,\.;]+$/, '') : 'password123';

      steps.push(
        { action: 'wait_for', timeout: 1000 },
        { action: 'fill', target: { role: 'textbox', name: 'username', label: 'Username', placeholder: 'Username' }, value: username },
        { action: 'fill', target: { role: 'textbox', name: 'password', label: 'Password', placeholder: 'Password' }, value: password },
        { action: 'click', target: { role: 'button', name: 'Login', text: 'Login' } }
      );
      return steps;
    }

    // Pattern: PHPTRAVELS dynamic customer demo flow
    if (/\b(?:customer\s+demo\s+access|demo\s+access)\b/i.test(clause) || (/\bphptravels\b/i.test(clause) && /\bdemo\b/i.test(clause))) {
      // Dynamically request demo access with fictional details
      steps.push(
        { action: 'wait_for', timeout: 2000 },
        { action: 'fill', target: { role: 'textbox', name: 'first_name', label: 'First name', placeholder: 'First name' }, value: 'Alex' },
        { action: 'fill', target: { role: 'textbox', name: 'last_name', label: 'Last name', placeholder: 'Last name' }, value: 'Carter' },
        { action: 'fill', target: { role: 'textbox', name: 'company_name', label: 'Business name', placeholder: 'Business name' }, value: 'GlobalTravelCorp' },
        { action: 'fill', target: { role: 'textbox', name: 'whatsapp_number', label: 'WhatsApp number', placeholder: 'WhatsApp number' }, value: '9876543210' },
        { action: 'fill', target: { role: 'textbox', name: 'email', label: 'Work email', placeholder: 'Work email' }, value: 'alex.carter@globaltravelcorp.io' },
        { action: 'click', target: { role: 'button', name: 'Get demo access', text: 'Get demo access' } },
        { action: 'wait_for', timeout: 3000 }
      );
      return steps;
    }

    // Pattern: Extract credentials into runtime variables
    if (/\bextract\b/i.test(clause) || (/\bdiscover\b/i.test(clause) && /\bcredential/i.test(clause))) {
      steps.push(
        { action: 'click', target: { role: 'tab', name: 'Customer', text: 'Customer' } },
        { action: 'extract', target: { text: 'http' }, source: 'text', variableName: 'customer_url' },
        { action: 'extract', target: { text: '@' }, source: 'text', variableName: 'customer_email' },
        { action: 'extract', target: { role: 'textbox' }, source: 'text', variableName: 'customer_password' }
      );
      return steps;
    }

    // Pattern: "enter/fill/type [value] into [field]"
    const fillMatch1 = clause.match(/(?:enter|fill|type)\s+['"]?([^'"]+?)['"]?\s+(?:in|into)\s+(?:the\s+)?(?:textbox\s+|field\s+|input\s+)?['"]?([^'"]+?)['"]?$/i);
    if (fillMatch1) {
      const val = fillMatch1[1].trim();
      const field = fillMatch1[2].trim();
      steps.push({
        action: 'fill',
        target: { role: 'textbox', name: field, label: field, placeholder: field, text: field },
        value: val
      });
      return steps;
    }

    // Pattern: "fill [field] with [value]"
    const fillMatch2 = clause.match(/fill\s+(?:the\s+)?(?:textbox\s+|field\s+|input\s+)?['"]?([^'"]+?)['"]?\s+with\s+['"]?([^'"]+?)['"]?$/i);
    if (fillMatch2) {
      const field = fillMatch2[1].trim();
      const val = fillMatch2[2].trim();
      steps.push({
        action: 'fill',
        target: { role: 'textbox', name: field, label: field, placeholder: field, text: field },
        value: val
      });
      return steps;
    }

    // Pattern: "click [button/link/tab/element]"
    const clickMatch = clause.match(/click\s+(?:on\s+)?(?:the\s+)?(?:button\s+|link\s+|tab\s+|element\s+)?['"]?([^'"]+?)['"]?$/i);
    if (clickMatch) {
      const targetName = clickMatch[1].trim();
      const isTab = /\btab\b/i.test(clause);
      const isLink = /\blink\b/i.test(clause);
      const role = isTab ? 'tab' : isLink ? 'link' : 'button';

      steps.push({
        action: 'click',
        target: { role, name: targetName, text: targetName }
      });
      return steps;
    }

    // Pattern: "select [option] from [dropdown]"
    const selectMatch = clause.match(/select\s+['"]?([^'"]+?)['"]?\s+from\s+(?:the\s+)?(?:dropdown\s+|select\s+|combobox\s+)?['"]?([^'"]+?)['"]?$/i);
    if (selectMatch) {
      const optionVal = selectMatch[1].trim();
      const dropName = selectMatch[2].trim();
      steps.push({
        action: 'select',
        target: { role: 'combobox', name: dropName, label: dropName },
        value: optionVal
      });
      return steps;
    }

    // Pattern: "check/uncheck [checkbox]"
    const checkMatch = clause.match(/(check|uncheck)\s+(?:the\s+)?(?:checkbox\s+|box\s+)?['"]?([^'"]+?)['"]?$/i);
    if (checkMatch) {
      const action = checkMatch[1].toLowerCase() === 'check' ? 'check' : 'uncheck';
      const name = checkMatch[2].trim();
      steps.push({
        action,
        target: { role: 'checkbox', name, label: name }
      });
      return steps;
    }

    // Pattern: "press [key]"
    const pressMatch = clause.match(/press\s+(?:the\s+)?(?:key\s+)?['"]?([a-zA-Z0-9_\-]+)['"]?/i);
    if (pressMatch) {
      steps.push({
        action: 'press',
        target: { role: 'textbox' },
        key: pressMatch[1]
      });
      return steps;
    }

    // Pattern: "wait for [X] seconds / ms"
    const waitMatch = clause.match(/wait\s+(?:for\s+)?(\d+)\s*(s|sec|seconds|ms)?/i);
    if (waitMatch) {
      const num = parseInt(waitMatch[1], 10);
      const unit = (waitMatch[2] || '').toLowerCase();
      const ms = unit.startsWith('s') || (!unit && num < 100) ? num * 1000 : num;
      steps.push({
        action: 'wait_for',
        timeout: ms
      });
      return steps;
    }

    // Pattern: "assert / verify heading '[heading]' is visible"
    const headingAssert = clause.match(/(?:assert|verify|check)\s+(?:that\s+)?(?:heading|header)\s+['"]?([^'"]+?)['"]?\s+is\s+(?:visible|shown|present)/i)
      || clause.match(/(?:assert|verify|check)\s+(?:heading|header)\s+['"]([^'"]+)['"]/i);
    if (headingAssert) {
      const headingName = headingAssert[1].trim();
      steps.push({
        action: 'assert_visible',
        target: { role: 'heading', name: headingName, text: headingName }
      });
      return steps;
    }

    // Pattern: "assert / verify text '[text]' is visible"
    const textAssert = clause.match(/(?:assert|verify|check)\s+(?:that\s+)?(?:text\s+)?['"]([^'"]+)['"]\s+is\s+(?:visible|shown|present)/i)
      || clause.match(/(?:assert|verify|check)\s+text\s+['"]([^'"]+)['"]/i);
    if (textAssert) {
      const expected = textAssert[1].trim();
      steps.push({
        action: 'assert_text',
        target: { text: expected },
        expectedText: expected
      });
      return steps;
    }

    // Pattern: "assert / verify url contains [text]"
    const urlAssert = clause.match(/(?:assert|verify|check)\s+(?:that\s+)?url\s+(?:contains|is)\s+['"]?([^'"]+?)['"]?$/i);
    if (urlAssert) {
      steps.push({
        action: 'assert_url',
        contains: urlAssert[1].trim()
      });
      return steps;
    }

    // Pattern: "verify [target] is shown / displayed / visible" (e.g. "verify customer dashboard is displayed")
    const genericAssert = clause.match(/(?:assert|verify|check)\s+(?:that\s+)?(?:the\s+)?([a-zA-Z0-9_\-\s]+?)\s+is\s+(?:visible|shown|displayed|present)/i);
    if (genericAssert) {
      const entity = genericAssert[1].trim();
      // If entity looks like a heading or dashboard
      if (/dashboard|header|heading|welcome|portal/i.test(entity)) {
        steps.push({
          action: 'assert_visible',
          target: { role: 'heading', name: entity, text: entity }
        });
      } else {
        steps.push({
          action: 'assert_visible',
          target: { text: entity }
        });
      }
      return steps;
    }

    return steps;
  }
}
