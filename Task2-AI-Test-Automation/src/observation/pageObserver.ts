import { Page } from 'playwright';
import { LocatorTarget } from '../validation/testPlanSchema';

export interface ElementObservation {
  tag: string;
  role?: string;
  accessibleName?: string;
  text?: string;
  id?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  href?: string;
  isVisible: boolean;
  isEnabled: boolean;
}

export interface PageObservation {
  url: string;
  title: string;
  headings: ElementObservation[];
  buttons: ElementObservation[];
  textboxes: ElementObservation[];
  links: ElementObservation[];
  selects: ElementObservation[];
  alerts: ElementObservation[];
  summary: string;
}

export class PageObserver {
  /**
   * Dynamically inspects the live webpage DOM and extracts interactive elements.
   * This observation is performed in real-time without relying on predefined selectors.
   */
  public static async observe(page: Page): Promise<PageObservation> {
    const rawData = await page.evaluate(() => {
      const isVisible = (el: HTMLElement) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0' &&
               (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
      };

      const getAccessibleName = (el: HTMLElement): string => {
        return (
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby') ||
          (el as any).labels?.[0]?.innerText ||
          (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : '') ||
          el.getAttribute('placeholder') ||
          el.getAttribute('title') ||
          el.innerText ||
          (el as HTMLInputElement).value ||
          ''
        ).trim().replace(/\s+/g, ' ');
      };

      const extractElements = (selector: string): any[] => {
        return Array.from(document.querySelectorAll<HTMLElement>(selector))
          .filter(isVisible)
          .map(el => ({
            tag: el.tagName.toLowerCase(),
            role: el.getAttribute('role') || undefined,
            accessibleName: getAccessibleName(el) || undefined,
            text: el.innerText ? el.innerText.trim().substring(0, 100) : undefined,
            id: el.id || undefined,
            name: el.getAttribute('name') || undefined,
            type: (el as HTMLInputElement).type || undefined,
            placeholder: (el as HTMLInputElement).placeholder || undefined,
            href: (el as HTMLAnchorElement).href || undefined,
            isVisible: true,
            isEnabled: !(el as HTMLButtonElement).disabled
          }));
      };

      const headings = extractElements('h1, h2, h3, h4, h5, h6, [role="heading"]');
      const buttons = extractElements('button, input[type="submit"], input[type="button"], [role="button"], a.btn, a[role="button"]');
      const textboxes = extractElements('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, [role="textbox"]');
      const links = extractElements('a[href]:not(.btn):not([role="button"])');
      const selects = extractElements('select, [role="combobox"]');
      const alerts = extractElements('[role="alert"], [role="status"], .alert, .notice, .error, .toast');

      return {
        url: window.location.href,
        title: document.title,
        headings,
        buttons,
        textboxes,
        links,
        selects,
        alerts
      };
    }).catch(() => ({
      url: page.url(),
      title: '',
      headings: [],
      buttons: [],
      textboxes: [],
      links: [],
      selects: [],
      alerts: []
    }));

    const headingNames = rawData.headings.map(h => `"${h.accessibleName || h.text}"`).slice(0, 4).join(', ');
    const buttonNames = rawData.buttons.map(b => `"${b.accessibleName || b.text}"`).slice(0, 4).join(', ');
    const textboxNames = rawData.textboxes.map(t => `"${t.accessibleName || t.name || t.placeholder}"`).slice(0, 4).join(', ');

    const summaryParts: string[] = [];
    if (rawData.headings.length) summaryParts.push(`Headings (${rawData.headings.length}): [${headingNames}]`);
    if (rawData.buttons.length) summaryParts.push(`Buttons (${rawData.buttons.length}): [${buttonNames}]`);
    if (rawData.textboxes.length) summaryParts.push(`Inputs (${rawData.textboxes.length}): [${textboxNames}]`);
    if (rawData.alerts.length) summaryParts.push(`Alerts (${rawData.alerts.length})`);

    const summary = summaryParts.length > 0
      ? summaryParts.join(' | ')
      : `Page Loaded: "${rawData.title}" (${rawData.url})`;

    return {
      url: rawData.url,
      title: rawData.title,
      headings: rawData.headings,
      buttons: rawData.buttons,
      textboxes: rawData.textboxes,
      links: rawData.links,
      selects: rawData.selects,
      alerts: rawData.alerts,
      summary
    };
  }
}

