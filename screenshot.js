const path = require('path');
const puppeteer = require('puppeteer');

const UPLOADS_DIR = path.join(__dirname, 'data', 'uploads');

// Honest viewport presets. These match the review page presets.
const CAPTURE_PRESETS = [
  { size: 'desktop', label: 'Desktop', width: 1440, height: 900, mobile: false },
  { size: 'laptop-15-6', label: '15.6 display', width: 1366, height: 768, mobile: false },
  { size: 'laptop-14-5', label: '14.5 display', width: 1280, height: 760, mobile: false },
  { size: 'laptop-13', label: '13 display', width: 1180, height: 720, mobile: false },
  { size: 'mobile', label: 'Mobile', width: 390, height: 844, mobile: true }
];

function makeShotName(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Capture full page screenshots for a single URL at every viewport preset.
 * Returns a map of size to a public uploads path, for example:
 *   { desktop: '/uploads/shot_..._desktop.png', ... }
 */
async function captureUrlAllPresets(url, prefix) {
  const shots = {};
  if (!url) return shots;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const baseName = makeShotName(prefix);

    for (const preset of CAPTURE_PRESETS) {
      const page = await browser.newPage();

      try {
        await page.setViewport({
          width: preset.width,
          height: preset.height,
          isMobile: preset.mobile,
          hasTouch: preset.mobile,
          deviceScaleFactor: 1
        });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

        const fileName = `${baseName}_${preset.size}.png`;
        const filePath = path.join(UPLOADS_DIR, fileName);

        await page.screenshot({ path: filePath, fullPage: true });
        shots[preset.size] = `/uploads/${fileName}`;
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return shots;
}

module.exports = {
  CAPTURE_PRESETS,
  captureUrlAllPresets
};
