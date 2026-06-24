document.querySelectorAll('[data-compare]').forEach(compare => {
  let dragging = false;
  let zoom = 1;
  const MIN = 1;
  const MAX = 4;
  const STEP = 0.25;

  function setReveal(clientX) {
    const rect = compare.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    compare.style.setProperty('--reveal', percent);
  }

  compare.style.setProperty('--reveal', 50);

  // Wrap the comparison viewer so it can be zoomed and scrolled (panned).
  const wrap = document.createElement('div');
  wrap.className = 'compare-zoom';

  const bar = document.createElement('div');
  bar.className = 'compare-zoom__bar';
  bar.innerHTML = `
    <button type="button" data-zoom-out aria-label="Zoom out">-</button>
    <span data-zoom-label>100%</span>
    <button type="button" data-zoom-in aria-label="Zoom in">+</button>
    <button type="button" data-zoom-reset>Reset</button>
  `;

  const parent = compare.parentNode;
  parent.insertBefore(bar, compare);
  parent.insertBefore(wrap, compare);
  wrap.appendChild(compare);

  const label = bar.querySelector('[data-zoom-label]');

  // Lock the wrapper to the slider's natural height so zooming overflows
  // into a scrollable (pannable) area instead of pushing the page around.
  requestAnimationFrame(() => {
    const baseHeight = compare.getBoundingClientRect().height;
    if (baseHeight) wrap.style.height = `${Math.round(baseHeight)}px`;
  });

  function applyZoom() {
    zoom = Math.max(MIN, Math.min(MAX, Math.round(zoom * 100) / 100));
    compare.style.zoom = zoom;
    wrap.classList.toggle('is-zoomed', zoom > 1);
    label.textContent = `${Math.round(zoom * 100)}%`;
  }

  bar.querySelector('[data-zoom-in]').addEventListener('click', () => { zoom += STEP; applyZoom(); });
  bar.querySelector('[data-zoom-out]').addEventListener('click', () => { zoom -= STEP; applyZoom(); });
  bar.querySelector('[data-zoom-reset]').addEventListener('click', () => {
    zoom = 1;
    applyZoom();
    wrap.scrollTo({ left: 0, top: 0 });
  });

  wrap.addEventListener('wheel', event => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    zoom += event.deltaY < 0 ? STEP : -STEP;
    applyZoom();
  }, { passive: false });

  compare.addEventListener('pointerdown', event => {
    if (event.target.closest('.comment-dot')) return;
    if (compare.dataset.pinTarget === 'true') return;

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

  applyZoom();
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

document.querySelectorAll('.place-dot-button').forEach(button => {
  button.addEventListener('click', () => {
    const slide = button.closest('.review-page');
    const form = button.closest('form');
    const canvas = slide.querySelector('[data-annotatable]');

    if (!canvas) {
      alert('This page does not have an image area for comment dots yet.');
      return;
    }

    document.querySelectorAll('form[data-pin-mode="true"]').forEach(activeForm => {
      activeForm.dataset.pinMode = 'false';
    });

    form.dataset.pinMode = 'true';
    canvas.dataset.pinTarget = 'true';
    canvas.classList.add('is-placing-dot');

    const location = form.querySelector('.dot-location');
    if (location) {
      location.hidden = false;
      location.textContent = 'Click the design where this comment should appear.';
    }
  });
});

document.querySelectorAll('[data-annotatable]').forEach(canvas => {
  canvas.addEventListener('click', event => {
    if (event.target.closest('.comment-dot')) return;

    const slide = canvas.closest('.review-page');
    const activeForm = slide.querySelector('form[data-pin-mode="true"]');

    if (!activeForm) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));

    activeForm.querySelector('input[name="dotX"]').value = x.toFixed(2);
    activeForm.querySelector('input[name="dotY"]').value = y.toFixed(2);

    canvas.querySelectorAll('.comment-dot.is-temp').forEach(dot => dot.remove());

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'comment-dot is-temp';
    dot.style.left = `${x}%`;
    dot.style.top = `${y}%`;
    dot.textContent = '+';
    dot.title = 'New unsaved comment dot';
    canvas.appendChild(dot);

    const location = activeForm.querySelector('.dot-location');
    if (location) {
      location.hidden = false;
      location.textContent = `Dot placed at ${x.toFixed(1)}%, ${y.toFixed(1)}%. Save feedback to keep it.`;
    }

    activeForm.dataset.pinMode = 'false';
    canvas.dataset.pinTarget = 'false';
    canvas.classList.remove('is-placing-dot');
  });
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
