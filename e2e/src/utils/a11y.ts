import AxeBuilder from '@axe-core/playwright';
import { type Page } from '@playwright/test';
import type { Result } from 'axe-core';

/**
 * The rule sets we hold the app to: WCAG 2.0 and 2.1, levels A and AA. That is
 * the bar most organisations commit to publicly, and it is what an auditor will
 * check against.
 */
const RULE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export function scan(page: Page): Promise<{ violations: Result[] }> {
  return new AxeBuilder({ page }).withTags(RULE_TAGS).analyze();
}

/**
 * Turns axe's output into something readable in a failure message.
 *
 * The raw result object is enormous and mostly noise. What someone reading a
 * red build needs is which rule broke, how bad it is, which element, and what
 * to change - which is exactly what this keeps.
 */
export function describeViolations(violations: Result[]): string {
  if (violations.length === 0) return 'no violations';

  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `      ${node.target.join(' ')}\n        ${node.failureSummary?.replace(/\n/g, '\n        ')}`)
        .join('\n');
      return `  [${violation.impact}] ${violation.id} - ${violation.help}\n${nodes}`;
    })
    .join('\n');
}
