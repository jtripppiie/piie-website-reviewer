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

    if (compare.dataset.pinTarget === 'true') {
      event.preventDefault();
      placeDot(compare, event.clientX, event.clientY);
      return;
    }

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

document.querySelectorAll('[data-webpage-compare]').forEach(stage => {
  let dragging = false;

  function setReveal(clientX) {
    const rect = stage.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    stage.style.setProperty('--reveal', percent);
  }

  stage.style.setProperty('--reveal', 50);

  stage.addEventListener('pointerdown', event => {
    if (event.target.closest('.comment-dot')) return;
    if (stage.dataset.pinTarget === 'true') return;
    if (!stage.classList.contains('is-slider')) return;

    event.preventDefault();
    dragging = true;
    setReveal(event.clientX);
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener('pointermove', event => {
    if (dragging) setReveal(event.clientX);
  });

  stage.addEventListener('pointerup', () => {
    dragging = false;
  });

  stage.addEventListener('pointercancel', () => {
    dragging = false;
  });

  if (!stage.hasAttribute('tabindex')) stage.setAttribute('tabindex', '0');

  stage.addEventListener('keydown', event => {
    if (!stage.classList.contains('is-slider')) return;

    const current = parseFloat(stage.style.getPropertyValue('--reveal')) || 50;
    let next = current;

    if (event.key === 'ArrowLeft') next = current - (event.shiftKey ? 10 : 2);
    else if (event.key === 'ArrowRight') next = current + (event.shiftKey ? 10 : 2);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 100;
    else return;

    event.preventDefault();
    stage.style.setProperty('--reveal', Math.max(0, Math.min(100, next)));
  });
});

function activeFeedbackFormForStage(stage) {
  return stage.closest('.review-page')?.querySelector('.screen-feedback.active form.feedback') || null;
}

function ensureWebpageMarkLayer(stage) {
  if (stage.querySelector('.webpage-mark-layer')) return;

  const layer = document.createElement('button');
  layer.type = 'button';
  layer.className = 'webpage-mark-layer';
  layer.setAttribute('aria-label', 'Place note on webpage preview');
  layer.addEventListener('pointerdown', pointerEvent => {
    const form = activeFeedbackFormForStage(stage);
    if (!form) {
      showReviewToast('Pick a screen size before marking the preview.');
      return;
    }

    pointerEvent.preventDefault();
    placeDot(stage, pointerEvent.clientX, pointerEvent.clientY, form, false);
  });
  stage.appendChild(layer);
}

function removeWebpageMarkLayer(stage) {
  stage.querySelector('.webpage-mark-layer')?.remove();
}

document.querySelectorAll('[data-webpage-modes]').forEach(modeGroup => {
  const slide = modeGroup.closest('.review-page');
  const stage = slide?.querySelector('[data-webpage-preview]');
  if (!stage) return;

  modeGroup.addEventListener('click', event => {
    const button = event.target.closest('[data-webpage-mode]');
    if (!button) return;

    const mode = button.dataset.webpageMode;
    modeGroup.querySelectorAll('[data-webpage-mode]').forEach(modeButton => {
      modeButton.classList.toggle('active', modeButton === button);
    });

    stage.classList.toggle('is-slider', mode === 'compare');
    stage.classList.toggle('is-annotating', mode === 'annotate');
    stage.style.setProperty('--reveal', 50);

    if (mode === 'annotate') {
      ensureWebpageMarkLayer(stage);
      stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showReviewToast('Click the preview to mark a spot for the active note form.');
    } else {
      removeWebpageMarkLayer(stage);
      if (mode === 'compare') stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

document.querySelectorAll('[data-url-tabs]').forEach(tabGroup => {
  const slide = tabGroup.closest('.review-page');
  const feedbackPanels = slide.querySelectorAll("[data-feedback-size]");
  const shotSizes = slide.querySelectorAll('[data-shots-size]');
  const screenDots = slide.querySelectorAll('[data-dot-screen]');

  function showSize(size) {
    slide.dataset.previewSize = size;

    feedbackPanels.forEach(panel => {
      panel.classList.toggle('active', panel.dataset.feedbackSize === size);
    });

    shotSizes.forEach(block => {
      block.classList.toggle('active', block.dataset.shotsSize === size);
    });

    screenDots.forEach(dot => {
      dot.hidden = Boolean(dot.dataset.dotScreen) && dot.dataset.dotScreen !== size;
    });
  }

  tabGroup.addEventListener('click', event => {
    const button = event.target.closest('button[data-size]');
    if (!button) return;

    const size = button.dataset.size;

    tabGroup.querySelectorAll('button[data-size]').forEach(btn => {
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

function showReviewToast(message) {
  let toast = document.querySelector('.app-fill-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'app-fill-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showReviewToast.timer);
  showReviewToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

let armedDotForm = null;
let armedDotTarget = null;

function activeMarkTargetForForm(form) {
  if (!form) return null;

  const slide = form.closest('.review-page');
  if (!slide) return null;

  const activeShot = slide.querySelector('.shots-size.active');
  if (activeShot) return activeShot.querySelector('[data-compare]');

  return slide.querySelector('[data-webpage-preview]') || slide.querySelector('[data-compare]');
}

function disarmDotPlacement() {
  if (armedDotTarget) {
    armedDotTarget.classList.remove('is-placing-dot');
    delete armedDotTarget.dataset.pinTarget;
    armedDotTarget.querySelector('.webpage-mark-layer')?.remove();
  }

  armedDotForm = null;
  armedDotTarget = null;
}

function clearTempDot(target) {
  target?.querySelectorAll('.comment-dot.is-temp').forEach(dot => dot.remove());
}

function setFormDot(form, x, y) {
  if (!form) return;

  const dotX = form.querySelector('[name="dotX"]');
  const dotY = form.querySelector('[name="dotY"]');
  const location = form.querySelector('[data-dot-location]');
  const clearButton = form.querySelector('[data-clear-dot]');

  if (dotX) dotX.value = x.toFixed(2);
  if (dotY) dotY.value = y.toFixed(2);
  if (location) {
    location.hidden = false;
    location.textContent = `Pinned spot: ${Math.round(x)}%, ${Math.round(y)}%`;
  }
  if (clearButton) clearButton.hidden = false;
}

function clearFormDot(form) {
  if (!form) return;

  const dotX = form.querySelector('[name="dotX"]');
  const dotY = form.querySelector('[name="dotY"]');
  const location = form.querySelector('[data-dot-location]');
  const clearButton = form.querySelector('[data-clear-dot]');
  const target = activeMarkTargetForForm(form);

  if (dotX) dotX.value = '';
  if (dotY) dotY.value = '';
  if (location) {
    location.hidden = true;
    location.textContent = '';
  }
  if (clearButton) clearButton.hidden = true;
  clearTempDot(target);
  disarmDotPlacement();
}

function placeDot(target, clientX, clientY, formOverride = null, disarmAfter = true) {
  const form = formOverride || armedDotForm;
  if (!form) return;

  const rect = target.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

  clearTempDot(target);
  setFormDot(form, x, y);

  const dot = document.createElement('button');
  dot.type = 'button';
  dot.className = 'comment-dot is-temp';
  dot.style.left = `${x}%`;
  dot.style.top = `${y}%`;
  dot.textContent = '+';
  dot.setAttribute('aria-label', 'Pending note spot');
  target.appendChild(dot);

  if (disarmAfter) disarmDotPlacement();
  showReviewToast('Spot marked. Add your note, then save.');
}

document.addEventListener('click', event => {
  const startButton = event.target.closest('[data-start-dot]');
  if (startButton) {
    const form = startButton.closest('form.feedback');
    const target = activeMarkTargetForForm(form);

    if (!target) {
      showReviewToast('This page does not have a markable preview yet.');
      return;
    }

    disarmDotPlacement();
    armedDotForm = form;
    armedDotTarget = target;
    clearTempDot(target);
    target.dataset.pinTarget = 'true';
    target.classList.add('is-placing-dot');

    if (target.matches('[data-webpage-preview]')) {
      const layer = document.createElement('button');
      layer.type = 'button';
      layer.className = 'webpage-mark-layer';
      layer.setAttribute('aria-label', 'Place note on webpage preview');
      layer.addEventListener('pointerdown', pointerEvent => {
        pointerEvent.preventDefault();
        placeDot(target, pointerEvent.clientX, pointerEvent.clientY);
      }, { once: true });
      target.appendChild(layer);
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showReviewToast('Click the preview to place the note.');
    return;
  }

  const clearButton = event.target.closest('[data-clear-dot]');
  if (clearButton) {
    clearFormDot(clearButton.closest('form.feedback'));
  }
});

function closeDotPopover() {
  document.querySelector('.comment-popover')?.remove();
}

function humanStatus(status) {
  return String(status || 'Review note').replace(/-/g, ' ').replace(/^\w/, char => char.toUpperCase());
}

document.addEventListener('click', event => {
  const dot = event.target.closest('.comment-dot:not(.is-temp)');
  if (!dot) {
    if (!event.target.closest('.comment-popover')) closeDotPopover();
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  closeDotPopover();

  const popover = document.createElement('aside');
  popover.className = 'comment-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Pinned review note');

  const title = document.createElement('strong');
  title.textContent = dot.dataset.reviewer || 'Reviewer';

  const meta = document.createElement('span');
  meta.textContent = `${humanStatus(dot.dataset.status)} · ${dot.dataset.screen || 'Screen size'}`;

  const comment = document.createElement('p');
  comment.textContent = dot.dataset.comment || 'No comment added.';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.addEventListener('click', closeDotPopover);

  popover.append(title, meta, comment, close);
  document.body.appendChild(popover);

  const rect = dot.getBoundingClientRect();
  const left = Math.min(window.innerWidth - 260, Math.max(12, rect.left + rect.width + 8));
  const top = Math.min(window.innerHeight - 180, Math.max(12, rect.top));
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
});

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
