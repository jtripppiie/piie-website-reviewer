document.querySelectorAll('[data-compare]').forEach(compare => {
  let dragging = false;

  function setReveal(clientX) {
    const rect = compare.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    compare.style.setProperty('--reveal', percent);
  }

  compare.style.setProperty('--reveal', 50);

  compare.addEventListener('pointerdown', event => {
    if (event.target.closest('.comment-dot')) return;
    if (compare.dataset.pinTarget === 'true') return;

    event.preventDefault();
    dragging = true;
    setReveal(event.clientX);
    compare.setPointerCapture(event.pointerId);
  });

  compare.addEventListener('pointermove', event => {
    if (dragging) setReveal(event.clientX);
  });

  compare.addEventListener('pointerup', () => {
    dragging = false;
  });

  compare.addEventListener('pointercancel', () => {
    dragging = false;
  });

  // Keyboard support: focus the comparison and nudge the reveal line.
  if (!compare.hasAttribute('tabindex')) compare.setAttribute('tabindex', '0');

  compare.addEventListener('keydown', event => {
    const current = parseFloat(compare.style.getPropertyValue('--reveal')) || 50;
    let next = current;

    if (event.key === 'ArrowLeft') next = current - (event.shiftKey ? 10 : 2);
    else if (event.key === 'ArrowRight') next = current + (event.shiftKey ? 10 : 2);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 100;
    else return;

    event.preventDefault();
    compare.style.setProperty('--reveal', Math.max(0, Math.min(100, next)));
  });
});

document.querySelectorAll('[data-url-tabs]').forEach(tabGroup => {
  const slide = tabGroup.closest('.review-page');
  const feedbackPanels = slide.querySelectorAll("[data-feedback-size]");
  const shotSizes = slide.querySelectorAll('[data-shots-size]');

  function showSize(size) {
    slide.dataset.previewSize = size;

    feedbackPanels.forEach(panel => {
      panel.classList.toggle('active', panel.dataset.feedbackSize === size);
    });

    shotSizes.forEach(block => {
      block.classList.toggle('active', block.dataset.shotsSize === size);
    });
  }

  tabGroup.addEventListener('click', event => {
    const button = event.target.closest('button[data-size]');
    if (!button) return;

    const size = button.dataset.size;

    tabGroup.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn === button);
    });

    showSize(size);
  });

  const initial = tabGroup.querySelector('button.active[data-size]') || tabGroup.querySelector('button[data-size]');
  if (initial) showSize(initial.dataset.size);
});

const pages = Array.from(document.querySelectorAll('.review-page'));
const pageCounter = document.getElementById('pageCounter');
const prevButton = document.getElementById('prevPage');
const nextButton = document.getElementById('nextPage');
let activePageIndex = 0;

function updatePageCounter(index) {
  activePageIndex = Math.max(0, Math.min(pages.length - 1, index));
  if (pageCounter) {
    pageCounter.textContent = `Page ${activePageIndex + 1} of ${pages.length}`;
  }
}

function scrollToPage(index) {
  const nextIndex = Math.max(0, Math.min(pages.length - 1, index));
  pages[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  updatePageCounter(nextIndex);
}

if (prevButton) {
  prevButton.addEventListener('click', () => scrollToPage(activePageIndex - 1));
}

if (nextButton) {
  nextButton.addEventListener('click', () => scrollToPage(activePageIndex + 1));
}

if ('IntersectionObserver' in window && pages.length) {
  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;

    const index = pages.indexOf(visible.target);
    if (index >= 0) updatePageCounter(index);
  }, {
    threshold: [0.35, 0.5, 0.75]
  });

  pages.forEach(page => observer.observe(page));
}

updatePageCounter(0);

/**
 * Debug mode
 * Usage: add ?debug=1 to any review link.
 */
(() => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('debug')) return;

  const panel = document.createElement('aside');
  panel.className = 'debug-panel';
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

  function getImageInfo(img) {
    if (!img) return 'missing';

    const rect = img.getBoundingClientRect();

    return [
      `src: ${img.getAttribute('src') || 'none'}`,
      `natural: ${img.naturalWidth || 0} × ${img.naturalHeight || 0}`,
      `display: ${Math.round(rect.width)} × ${Math.round(rect.height)}`,
      `complete: ${img.complete ? 'yes' : 'no'}`
    ].join('<br>');
  }

  function getWarnings(page, compare) {
    const warnings = [];

    if (!page) {
      warnings.push('No active review page found.');
      return warnings;
    }

    if (!compare && !page.classList.contains('cover-slide')) {
      warnings.push('No comparison viewer found on this page.');
    }

    if (compare) {
      const beforeImg = compare.querySelector('img.before');
      const afterImg = compare.querySelector('img.after');

      if (!beforeImg?.complete || !afterImg?.complete) {
        warnings.push('One or more images may still be loading.');
      }

      if (
        beforeImg?.naturalWidth &&
        afterImg?.naturalWidth &&
        (
          beforeImg.naturalWidth !== afterImg.naturalWidth ||
          beforeImg.naturalHeight !== afterImg.naturalHeight
        )
      ) {
        warnings.push('Before and after images have different dimensions. Slider alignment may look off.');
      }

      const rect = compare.getBoundingClientRect();
      if (rect.width < 1000) {
        warnings.push('Review area is under 1000px wide. This may be too narrow for design review.');
      }
    }

    return warnings;
  }

  function updateDebugPanel() {
    const page = getActivePage();
    const compare = page?.querySelector('[data-compare]');
    const beforeImg = compare?.querySelector('img.before');
    const afterImg = compare?.querySelector('img.after');
    const pageIndex = page ? Array.from(document.querySelectorAll('.review-page')).indexOf(page) + 1 : 0;
    const compareRect = compare?.getBoundingClientRect();
    const warnings = getWarnings(page, compare);

    panel.innerHTML = `
      <div class="debug-panel__header">
        <strong>Debug mode</strong>
        <button type="button" data-debug-close>×</button>
      </div>

      <dl>
        <dt>Viewport</dt>
        <dd>${window.innerWidth} × ${window.innerHeight}</dd>

        <dt>Active page</dt>
        <dd>${pageIndex || 'none'}</dd>

        <dt>Page id</dt>
        <dd>${escapeHtml(page?.id || 'none')}</dd>

        <dt>Page title</dt>
        <dd>${escapeHtml(page?.dataset.pageTitle || 'none')}</dd>

        <dt>Compare box</dt>
        <dd>${compareRect ? `${Math.round(compareRect.width)} × ${Math.round(compareRect.height)}` : 'none'}</dd>

        <dt>Before image</dt>
        <dd>${getImageInfo(beforeImg)}</dd>

        <dt>After image</dt>
        <dd>${getImageInfo(afterImg)}</dd>

        <dt>Comment dots</dt>
        <dd>${page ? page.querySelectorAll('.comment-dot').length : 0}</dd>

        <dt>Feedback forms</dt>
        <dd>${page ? page.querySelectorAll('form.feedback').length : 0}</dd>

        <dt>Warnings</dt>
        <dd>${warnings.length ? warnings.map(escapeHtml).join('<br>') : 'none'}</dd>
      </dl>
    `;
  }

  document.addEventListener('click', event => {
    if (event.target.matches('[data-debug-close]')) {
      panel.remove();
    }
  });

  window.addEventListener('resize', updateDebugPanel);
  window.addEventListener('scroll', updateDebugPanel, { passive: true });
  document.addEventListener('click', () => setTimeout(updateDebugPanel, 50));
  document.addEventListener('change', () => setTimeout(updateDebugPanel, 50));

  setInterval(updateDebugPanel, 1500);
  updateDebugPanel();

  window.reviewDebug = {
    update: updateDebugPanel,
    panel,
    getActivePage
  };
})();

// Collapsible notes panel: lets reviewers fold the sticky panel away so it does
// not cover the review work while scrolling.
(function () {
  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-feedback-toggle]');
    if (!toggle) return;

    const panel = toggle.closest('[data-feedback-panel]');
    if (!panel) return;

    const collapsed = panel.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.textContent = collapsed ? 'Expand' : 'Collapse';
  });
})();
