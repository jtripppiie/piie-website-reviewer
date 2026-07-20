const puppeteer = require('puppeteer');
const objectStorage = require('./object-storage');

// Honest viewport presets. These match the review page presets.
const CAPTURE_PRESETS = [
  { size: 'desktop', label: 'Full desktop fallback', width: 1440, height: 900, mobile: false },
  { size: 'laptop-15-6', label: '15.6 display', width: 1366, height: 768, mobile: false },
  { size: 'laptop-14-5', label: '14.5 display', width: 1280, height: 760, mobile: false },
  { size: 'laptop-13', label: '13 display', width: 1180, height: 720, mobile: false },
  { size: 'mobile', label: 'Mobile', width: 390, height: 844, mobile: true }
];

function makeShotName(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Basic SSRF guard for admin-entered capture URLs. Loopback is intentionally
// allowed because the app captures its own same-origin demo pages, but private
// networks and the cloud metadata endpoint are blocked so a capture cannot be
// pointed at internal infrastructure.
function assertCaptureUrlAllowed(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid capture URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs can be captured.');
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  // Link-local / cloud metadata (169.254.0.0/16, incl. 169.254.169.254).
  if (/^169\.254\./.test(host)) {
    throw new Error('Refusing to capture a link-local address.');
  }

  // Private IPv4 ranges.
  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error('Refusing to capture a private network address.');
  }

  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10).
  if (/^f[cd]/.test(host) || /^fe[89ab]/.test(host)) {
    throw new Error('Refusing to capture a private network address.');
  }
}

async function gotoWithFallback(page, url) {
  const attempts = [
    { waitUntil: 'networkidle2', timeout: 45000 },
    { waitUntil: 'load', timeout: 30000 },
    { waitUntil: 'domcontentloaded', timeout: 20000 }
  ];
  let lastError;

  for (const options of attempts) {
    try {
      await page.goto(url, options);
      await new Promise(resolve => setTimeout(resolve, 750));
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function dismissCookieDialog(page) {
  try {
    const dismissed = await page.evaluate(() => {
      const selectors = [
        '#onetrust-accept-btn-handler',
        '[data-testid="cookie-accept"]',
        '[data-cookie-accept]',
        '.cookie-accept'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.getClientRects().length) {
          element.click();
          return true;
        }
      }

      const acceptedLabels = new Set([
        'accept',
        'accept all',
        'allow all',
        'agree',
        'i agree'
      ]);
      const candidates = document.querySelectorAll('button, [role="button"], a');
      for (const element of candidates) {
        const label = (element.textContent || '').trim().toLowerCase();
        if (acceptedLabels.has(label) && element.getClientRects().length) {
          element.click();
          return true;
        }
      }

      return false;
    });

    if (dismissed) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  } catch {
    // Cookie controls vary by site. Failure to dismiss one should not prevent
    // an otherwise valid screenshot.
  }
}

/**
 * Capture full page screenshots for a single URL. Passing presetSizes limits
 * capture to those size keys; omitting it preserves the all-sizes behavior.
 * Returns a map of size to a public uploads path, for example:
 *   { desktop: '/uploads/shot_..._desktop.png', ... }
 */
async function captureUrlAllPresets(url, prefix, presetSizes) {
  const shots = {};
  if (!url) return shots;

  assertCaptureUrlAllowed(url);
  const requestedSizes = Array.isArray(presetSizes) && presetSizes.length
    ? new Set(presetSizes)
    : null;
  const presets = requestedSizes
    ? CAPTURE_PRESETS.filter(preset => requestedSizes.has(preset.size))
    : CAPTURE_PRESETS;

  if (!presets.length) {
    throw new Error('No valid screenshot sizes were selected.');
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const baseName = makeShotName(prefix);

    for (const preset of presets) {
      const page = await browser.newPage();

      try {
        await page.setViewport({
          width: preset.width,
          height: preset.height,
          isMobile: preset.mobile,
          hasTouch: preset.mobile,
          deviceScaleFactor: 1
        });

        await gotoWithFallback(page, url);
        await dismissCookieDialog(page);

        const fileName = `${baseName}_${preset.size}.png`;
        const buffer = await page.screenshot({ fullPage: true });
        shots[preset.size] = await objectStorage.saveUploadBuffer(fileName, buffer, 'image/png');
      } finally {
        await page.close();
      }
    }
  } catch (error) {
    await Promise.all(
      Object.values(shots).map(webPath =>
        objectStorage.deleteUpload(webPath).catch(() => {})
      )
    );
    throw error;
  } finally {
    await browser.close();
  }

  return shots;
}

module.exports = {
  CAPTURE_PRESETS,
  captureUrlAllPresets
};
