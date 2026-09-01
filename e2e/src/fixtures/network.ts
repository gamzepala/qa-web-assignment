import { type BrowserContext, type Page } from '@playwright/test';
import { config } from '../config/env';

/**
 * Stands in for the Font Awesome kit. The real kit swaps each <i class="fas ...">
 * for an inline SVG; all this suite needs from it is that an icon takes up space,
 * because two of the nav controls are sized by their icon alone.
 */
const ICON_STUB = `
  (function () {
    var style = document.createElement('style');
    style.textContent =
      '.fas,.fab,.far,.fa-solid{display:inline-block;width:1em;height:1em;}';
    document.head.appendChild(style);
  })();
`;

/**
 * Keeps a page or a whole context off the public internet.
 *
 * The app pulls a Font Awesome kit and a Google font, the latter over plain
 * http. Neither has anything to do with logging in, and both are somebody
 * else's uptime.
 *
 * The icon kit is stubbed rather than simply blocked. The user menu in the nav
 * bar is a bare <div> whose only child is an <i> icon, so its clickable area
 * comes entirely from the glyph the kit injects. Drop the kit on the floor and
 * that div collapses to 0x0 and the menu becomes unclickable - which would be
 * this suite breaking the app rather than a bug worth reporting. The stub
 * reproduces the one thing the layout depends on, an icon that occupies a box,
 * and nothing else.
 *
 * The trade-off, written down so it reads as a decision rather than an
 * oversight: this suite will not notice if one of those third parties starts
 * failing in production. That belongs in uptime monitoring, not a login test.
 */
export async function blockThirdPartyRequests(target: Page | BrowserContext): Promise<void> {
  const appHost = new URL(config.baseUrl).host;

  await target.route('**/*', (route) => {
    const url = route.request().url();

    if (new URL(url).host === appHost) return route.continue();

    if (url.includes('fontawesome')) {
      return route.fulfill({ contentType: 'application/javascript', body: ICON_STUB });
    }

    // Web fonts only change which typeface renders, never whether something is
    // there, so an empty stylesheet is a faithful enough stand-in.
    return route.fulfill({ contentType: 'text/css', body: '' });
  });
}
