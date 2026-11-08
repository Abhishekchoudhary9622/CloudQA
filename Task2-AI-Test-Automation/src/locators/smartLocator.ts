import { Page, Locator } from 'playwright';
import { LocatorTarget } from '../validation/testPlanSchema';

export interface ResolutionResult {
  locator: Locator;
  strategyUsed: string;
  matchedCount: number;
  role?: string;
  accessibleName?: string;
  isVisible?: boolean;
  isEnabled?: boolean;
  candidateAttempts?: string[];
  diagnostics?: string;
}

export class SmartLocatorResolver {
  constructor(private page: Page) {}

  /**
   * Resolves a LocatorTarget into a single, interactable Playwright Locator.
   * Performs existence, visibility, and ambiguity checks.
   */
  async resolve(target: LocatorTarget, actionName: string): Promise<ResolutionResult> {
    const candidates: { locator: Locator; strategy: string }[] = [];

    // Strategy 1: getByRole with accessible name (exact match first to prevent strict-mode ambiguity)
    if (target.role) {
      if (target.name) {
        candidates.push({
          locator: this.page.getByRole(target.role as any, { name: target.name, exact: true }),
          strategy: `getByRole('${target.role}', { name: '${target.name}', exact: true })`
        });
        candidates.push({
          locator: this.page.getByRole(target.role as any, { name: target.name }),
          strategy: `getByRole('${target.role}', { name: '${target.name}' })`
        });
      } else {
        candidates.push({
          locator: this.page.getByRole(target.role as any),
          strategy: `getByRole('${target.role}')`
        });
      }
    }

    // Strategy 2: getByLabel (exact first)
    if (target.label) {
      candidates.push({
        locator: this.page.getByLabel(target.label, { exact: true }),
        strategy: `getByLabel('${target.label}', { exact: true })`
      });
      candidates.push({
        locator: this.page.getByLabel(target.label),
        strategy: `getByLabel('${target.label}')`
      });
    }

    // Strategy 3: getByPlaceholder
    if (target.placeholder) {
      candidates.push({
        locator: this.page.getByPlaceholder(target.placeholder, { exact: true }),
        strategy: `getByPlaceholder('${target.placeholder}', { exact: true })`
      });
      candidates.push({
        locator: this.page.getByPlaceholder(target.placeholder),
        strategy: `getByPlaceholder('${target.placeholder}')`
      });
    }

    // Strategy 4: getByText (exact first)
    if (target.text) {
      candidates.push({
        locator: this.page.getByText(target.text, { exact: true }),
        strategy: `getByText('${target.text}', { exact: true })`
      });
      candidates.push({
        locator: this.page.getByText(target.text),
        strategy: `getByText('${target.text}')`
      });
    }

    // Strategy 5: Explicit fallback selector (CSS / XPath)
    if (target.fallbackSelector) {
      candidates.push({
        locator: this.page.locator(target.fallbackSelector),
        strategy: `locator('${target.fallbackSelector}') [Explicit Fallback]`
      });
    }

    let ambiguityDetected = false;
    let ambiguityMessage = '';
    const candidateAttempts: string[] = candidates.map(c => c.strategy);
    const targetName = target.name || target.label || target.text || target.placeholder || '';

    // Evaluate candidate strategies sequentially
    for (const cand of candidates) {
      const count = await cand.locator.count().catch(() => 0);
      if (count === 0) continue;

      if (count === 1) {
        const first = cand.locator.first();
        const isVisible = await first.isVisible().catch(() => false);
        const isEnabled = await first.isEnabled().catch(() => true);

        return {
          locator: first,
          strategyUsed: `${cand.strategy} (Count=1, Visible=${isVisible}, Enabled=${isEnabled})`,
          matchedCount: 1,
          role: target.role,
          accessibleName: targetName,
          isVisible,
          isEnabled,
          candidateAttempts,
          diagnostics: `Target successfully resolved via primary strategy '${cand.strategy}'. Exactly 1 element matched, visible and enabled.`
        };
      }

      if (count > 1) {
        // Multiple matches found: Filter by visible elements only
        const visibleLocators: Locator[] = [];
        for (let i = 0; i < count; i++) {
          const item = cand.locator.nth(i);
          if (await item.isVisible().catch(() => false)) {
            visibleLocators.push(item);
          }
        }

        if (visibleLocators.length === 1) {
          return {
            locator: visibleLocators[0],
            strategyUsed: `${cand.strategy} [Disambiguated to single visible element of ${count}]`,
            matchedCount: 1,
            role: target.role,
            accessibleName: targetName,
            isVisible: true,
            isEnabled: true,
            candidateAttempts,
            diagnostics: `Ambiguity recovery: ${count} total DOM elements matched '${cand.strategy}'. Successfully filtered ${count - 1} hidden/inert elements to identify 1 interactable element.`
          };
        }

        if (visibleLocators.length > 1) {
          ambiguityDetected = true;
          ambiguityMessage = `Multiple visible elements (${visibleLocators.length}) matched '${cand.strategy}'.`;
        }
      }
    }

    // If ambiguous matches existed across strategies
    if (ambiguityDetected) {
      throw new Error(
        `AmbiguityError: ${ambiguityMessage} Refusing arbitrary interaction to guarantee test reliability. Please provide a more specific accessible name, role, or label.`
      );
    }

    const attempted = candidates.map(c => c.strategy).join(' -> ');
    throw new Error(
      `ElementNotFound: Could not find interactable element for action '${actionName}'. Target: ${JSON.stringify(target)}. Attempted strategies: [${attempted || 'None specified'}]`
    );
  }
}
