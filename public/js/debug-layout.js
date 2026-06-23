(() => {
  const params = new URLSearchParams(window.location.search);
  const debugValue = params.get('debug');

  if (debugValue !== 'layout' && debugValue !== '1') return;

  document.body.classList.add('debug-layout-on');

  const labels = [
    ['.review-topbar', 'Review top bar'],
    ['.review-page', 'Review page'],
    ['.page-heading', 'Page heading'],
    ['.review-canvas', 'Review canvas'],
    ['[data-compare]', 'Comparison viewer'],
    ['.feedback-panel', 'Review notes panel'],
    ['form.feedback', 'Review notes form'],
    ['.screen-tabs', 'Screen-size tabs'],
    ['.url-note', 'URL reference box'],
    ['.empty-preview', 'Empty screenshot area']
  ];

  labels.forEach(([selector, label]) => {
    document.querySelectorAll(selector).forEach(element => {
      if (!element.dataset.debugLabel) {
        element.dataset.debugLabel = label;
      }
    });
  });

  const panel = document.createElement('aside');
  panel.className = 'layout-debug-panel';
  panel.setAttribute('aria-live', 'polite');
  document.body.appendChild(panel);

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function sizeText(element) {
    if (!element) return 'missing';
    const rect = element.getBoundingClientRect();
    return `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  }

  function imageText(img) {
    if (!img) return 'missing';

    const rect = img.getBoundingClientRect();

    return [
      `natural ${img.naturalWidth || 0} × ${img.naturalHeight || 0}`,
      `display ${Math.round(rect.width)} × ${Math.round(rect.height)}`,
      img.complete ? 'loaded' : 'loading'
    ].join('<br>');
  }

  function getActivePage() {
    const pages = Array.from(document.querySelectorAll('.review-page'));
    if (!pages.length) return null;

    return pages
      .map(page => {
        const rect = page.getBoundingClientRect();
        return {
          page,
          distance: Math.abs(rect.top - 90)
        };
      })
      .sort((a, b) => a.distance - b.distance)[0]?.page || pages[0];
  }

  function getPageType(page) {
    if (!page) return 'none';
    if (page.classList.contains('cover-slide')) return 'cover page';
    if (page.querySelector('.url-note')) return 'Dev / Live reference page';
    if (page.querySelector('[data-compare]')) return 'before / after screenshot review';
    return 'unknown';
  }

  function getWarnings(page, compare, beforeImg, afterImg) {
    const warnings = [];

    if (!page) {
      warnings.push('No active review page found.');
      return warnings;
    }

    if (!page.querySelector('.feedback-panel') && !page.classList.contains('cover-slide')) {
      warnings.push('No review notes panel found on this page.');
    }

    if (compare) {
      const compareRect = compare.getBoundingClientRect();

      if (compareRect.width < 1200) {
        warnings.push('Comparison viewer is under 1200px wide.');
      }

      if (!beforeImg || !afterImg) {
        warnings.push('Missing before or after image.');
      }

      if (beforeImg && afterImg && beforeImg.complete && afterImg.complete) {
        const mismatch =
          beforeImg.naturalWidth !== afterImg.naturalWidth ||
          beforeImg.naturalHeight !== afterImg.naturalHeight;

        if (mismatch) {
          warnings.push('Before and after images have different natural dimensions.');
        }
      }
    }

    if (document.documentElement.scrollWidth > window.innerWidth + 4) {
      warnings.push('Page has horizontal overflow.');
    }

    return warnings;
  }

  function updatePanel() {
    const page = getActivePage();
    const pages = Array.from(document.querySelectorAll('.review-page'));
    const pageIndex = page ? pages.indexOf(page) + 1 : 0;
    const compare = page?.querySelector('[data-compare]');
    const canvas = page?.querySelector('.review-canvas');
    const feedbackPanel = page?.querySelector('.feedback-panel');
    const beforeImg = compare?.querySelector('img.before');
    const afterImg = compare?.querySelector('img.after');
    const warnings = getWarnings(page, compare, beforeImg, afterImg);

    panel.innerHTML = `
      <div class="layout-debug-panel__header">
        <strong>Visual Debug</strong>
        <button type="button" data-layout-debug-close>×</button>
      </div>

      <dl>
        <dt>Mode</dt>
        <dd>?debug=layout</dd>

        <dt>Viewport</dt>
        <dd>${window.innerWidth} × ${window.innerHeight}</dd>

        <dt>Active page</dt>
        <dd>${pageIndex || 'none'} of ${pages.length}</dd>

        <dt>Page title</dt>
        <dd>${escapeHtml(page?.dataset.pageTitle || page?.querySelector('h1,h2')?.textContent || 'none')}</dd>

        <dt>Page type</dt>
        <dd>${escapeHtml(getPageType(page))}</dd>

        <dt>Review page</dt>
        <dd>${sizeText(page)}</dd>

        <dt>Review canvas</dt>
        <dd>${sizeText(canvas)}</dd>

        <dt>Comparison viewer</dt>
        <dd>${sizeText(compare)}</dd>

        <dt>Review notes panel</dt>
        <dd>${sizeText(feedbackPanel)}</dd>

        <dt>Before image</dt>
        <dd>${imageText(beforeImg)}</dd>

        <dt>After image</dt>
        <dd>${imageText(afterImg)}</dd>

        <dt>Comment dots</dt>
        <dd>${page ? page.querySelectorAll('.comment-dot').length : 0}</dd>

        <dt>Review note forms</dt>
        <dd>${page ? page.querySelectorAll('form.feedback').length : 0}</dd>

        <dt>Warnings</dt>
        <dd class="${warnings.length ? 'debug-warning' : 'debug-ok'}">
          ${warnings.length ? warnings.map(escapeHtml).join('<br>') : 'none'}
        </dd>
      </dl>
    `;
  }

  document.addEventListener('click', event => {
    if (event.target.matches('[data-layout-debug-close]')) {
      panel.remove();
      document.body.classList.remove('debug-layout-on');
    }
  });

  window.addEventListener('resize', updatePanel);
  window.addEventListener('scroll', updatePanel, { passive: true });
  document.addEventListener('click', () => setTimeout(updatePanel, 75));
  document.addEventListener('change', () => setTimeout(updatePanel, 75));

  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('load', updatePanel);
    img.addEventListener('error', updatePanel);
  });

  setInterval(updatePanel, 1500);
  updatePanel();

  window.layoutDebug = {
    update: updatePanel,
    panel,
    getActivePage
  };
})();
