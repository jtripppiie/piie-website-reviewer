/**
 * On first load, default each screen-size tab to whichever preset best matches
 * the viewer's current viewport width. A phone visitor starts on the Mobile
 * tab, a ~14.5" laptop starts on the 14.5 tab, a large monitor starts on
 * desktop, and so on. After load the reviewer can switch tabs freely — we only
 * pick the starting tab and never override a manual choice.
 *
 * Preset widths mirror force-preview-layout.js so the default lines up with the
 * preview each tab renders.
 */
(function () {
  const SIZE_WIDTHS = {
    desktop: 1440,
    'desktop-1440': 1440,
    'laptop-15-6': 1366,
    'laptop-14-5': 1280,
    'laptop-13': 1180,
    mobile: 390
  };

  function pickBestButton(tabGroup) {
    const buttons = Array.from(tabGroup.querySelectorAll('button[data-size]'))
      .filter(btn => btn.dataset.size !== 'tablet' && SIZE_WIDTHS[btn.dataset.size] != null);
    if (!buttons.length) return null;

    const viewport = window.innerWidth || document.documentElement.clientWidth || 1440;
    let best = buttons[0];
    let bestDiff = Infinity;

    buttons.forEach(btn => {
      const diff = Math.abs(SIZE_WIDTHS[btn.dataset.size] - viewport);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = btn;
      }
    });

    return best;
  }

  let applied = false;
  function applyDefaults() {
    if (applied) return;
    applied = true;

    document.querySelectorAll('[data-url-tabs]').forEach(tabGroup => {
      const best = pickBestButton(tabGroup);
      // Clicking replays the normal tab switch so the preview, feedback panel,
      // pins and highlights all sync exactly as if the reviewer clicked it.
      if (best && !best.classList.contains('active')) best.click();
    });
  }

  // Run after the other tab scripts have wired up. They listen on both
  // DOMContentLoaded and load; this script tag is included after them, so our
  // listeners fire last and our chosen tab wins. We hedge on both events (and
  // an immediate call if the DOM is already parsed) because a slow cross-origin
  // preview iframe can delay the window load event.
  document.addEventListener('DOMContentLoaded', applyDefaults);
  window.addEventListener('load', applyDefaults);
  if (document.readyState !== 'loading') applyDefaults();
})();
