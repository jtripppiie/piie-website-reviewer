const NOTES_KEY = 'piieWebReviewerNotes';
const CLEARED_KEY = 'piieWebReviewerClearedNoteIds';
const URLS_KEY = 'piieWebReviewerUrlOverrides';

const APP_VERSION = '0.4.8';

const PRESETS = {
  desktop: { label: 'Desktop', w: 1440, h: 900 },
  'laptop-15-6': { label: '15.6 display', w: 1366, h: 768 },
  'laptop-14-5': { label: '14.5 display', w: 1280, h: 760 },
  'laptop-13': { label: '13 display', w: 1180, h: 720 },
  mobile: { label: 'Mobile', w: 390, h: 844 }
};

const SCALE_LABELS = { fit: 'Fit to screen', '100': '100%', '75': '75%', '50': '50%' };
const STAGE_GAP = 16;

const state = {
  packet: null,
  activeSizes: {},
  scaleModes: {},
  notes: JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'),
  cleared: JSON.parse(localStorage.getItem(CLEARED_KEY) || '[]'),
  urlOverrides: JSON.parse(localStorage.getItem(URLS_KEY) || '{}')
};

const app = document.querySelector('#app');
const debugOutput = document.querySelector('#debugOutput');

const versionLabel = document.querySelector('#appVersion');
if (versionLabel) versionLabel.textContent = 'v' + APP_VERSION;

document.addEventListener('DOMContentLoaded', function () {
  var badge = document.createElement('div');
  badge.className = 'app-version-badge';
  badge.textContent = 'PIIE Reviewer v' + APP_VERSION + ' (demo)';
  document.body.appendChild(badge);
});

function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(state.notes));
}

function saveCleared() {
  localStorage.setItem(CLEARED_KEY, JSON.stringify(state.cleared));
}

function saveUrlOverrides() {
  localStorage.setItem(URLS_KEY, JSON.stringify(state.urlOverrides));
}

// On the static demo there is no server, so URL edits are kept in this browser
// and re-applied to the packet each time the page loads.
function applyUrlOverrides() {
  const overrides = state.urlOverrides || {};
  (state.packet?.pages || []).forEach(page => {
    const override = overrides[page.pageId];
    if (!override) return;
    if (typeof override.devUrl === 'string') page.devUrl = override.devUrl;
    if (typeof override.liveUrl === 'string') page.liveUrl = override.liveUrl;
  });
}

function screenSizeLabel(size) {
  return {
    desktop: 'Desktop',
    'laptop-15-6': '15.6 display',
    'laptop-14-5': '14.5 display',
    'laptop-13': '13 display',
    mobile: 'Mobile'
  }[size] || size;
}

function statusLabel(status) {
  return {
    approved: 'Approved',
    'approved-after-these-changes': 'Approved after these changes',
    'needs-design-changes': 'Needs design changes',
    'needs-content-changes': 'Needs content changes',
    'needs-mobile-review': 'Needs mobile review',
    'blocked-cannot-review': 'Blocked / cannot review',
    'not-approved': 'Not approved'
  }[status] || status;
}

function statusIcon(status) {
  if (status === 'approved') return '✓';
  if (status === 'not-approved' || status === 'blocked-cannot-review') return '×';
  if (status === 'approved-after-these-changes') return '↻';
  return '!';
}

function allNotes() {
  const demoNotes = Array.isArray(state.packet?.seedNotes) ? state.packet.seedNotes : [];
  const cleared = new Set(state.cleared);
  return [...demoNotes, ...state.notes].filter(note => !cleared.has(note.noteId));
}

function pageNotes(pageId, screenSize) {
  return allNotes().filter(note => note.pageId === pageId && note.screenSize === screenSize);
}

function updateDebug() {
  debugOutput.textContent = JSON.stringify({
    app: 'PIIE Web Reviewer Static Demo',
    mode: 'GitHub Pages static',
    version: APP_VERSION,
    time: new Date().toISOString(),
    packetTitle: state.packet?.title,
    packetId: state.packet?.packetId,
    pageCount: state.packet?.pages?.length || 0,
    activeSizes: state.activeSizes,
    demoNoteCount: state.packet?.seedNotes?.length || 0,
    localNoteCount: state.notes.length,
    totalVisibleNoteCount: allNotes().length,
    limitations: [
      'No Express server on GitHub Pages',
      'Notes save only to this browser localStorage',
      'Use Export Notes JSON to share notes',
      'Iframe previews may be blocked by the target site'
    ]
  }, null, 2);
}

function renderNotes(page, screenSize) {
  const notes = pageNotes(page.pageId, screenSize);

  if (!notes.length) {
    return '<p>Nothing here yet.</p>';
  }

  return `<p class="note-summary">${notes.length} ${notes.length === 1 ? 'note' : 'notes'} for ${escapeHtml(screenSizeLabel(screenSize))}.</p>` + '<ol class="notes-list">' + notes.map(note => `
    <li class="note ${note.status}">
      <span class="note-icon" aria-hidden="true">${statusIcon(note.status)}</span>
      <div>
        <div class="note-meta">
          <strong>${escapeHtml(note.reviewerName || 'Reviewer')}</strong>
          <span>${statusLabel(note.status)}</span>
        </div>
        ${note.comment ? `<p>${escapeHtml(note.comment)}</p>` : ''}
      </div>
    </li>
  `).join('') + '</ol>';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderPage(page, index) {
  const sizes = (page.screenSizes || ['desktop', 'laptop', 'mobile']).filter(size => size !== 'tablet');
  const activeSize = state.activeSizes[page.pageId] || sizes[0] || 'desktop';
  state.activeSizes[page.pageId] = activeSize;

  if (page.type === 'cover') {
    return `
      <section class="review-page">
        <div class="page-heading">
          <p class="eyebrow">Page ${index + 1}</p>
          <h2>${escapeHtml(page.title || 'Cover')}</h2>
          <p>${escapeHtml(page.subtitle || '')}</p>
          <p>${escapeHtml(page.body || '')}</p>
        </div>
      </section>
    `;
  }

  if (page.type !== 'urlCompare') {
    return `
      <section class="review-page">
        <div class="warning">
          Static demo currently supports URL review pages. This page type is ${escapeHtml(page.type)}.
        </div>
      </section>
    `;
  }

  return `
    <section class="review-page" data-page-id="${escapeHtml(page.pageId)}" data-preview-size="${escapeHtml(activeSize)}">
      <div class="review-workspace">
        <div class="page-heading">
          <p class="eyebrow">Page ${index + 1}</p>
          <h2>${escapeHtml(page.title || 'Untitled Page')}</h2>
          <p>${escapeHtml(page.instructions || '')}</p>
        </div>

        <div class="url-note">
          <p>This is the demo. The sample notes are made up, and anything you add only saves in this browser.</p>
          <div class="actions">
            ${page.devUrl ? `<a class="button" href="${escapeHtml(page.devUrl)}" target="_blank" rel="noopener">Open Dev</a>` : ''}
            ${page.liveUrl ? `<a class="button" href="${escapeHtml(page.liveUrl)}" target="_blank" rel="noopener">Open Live</a>` : ''}
          </div>
        </div>

        <div class="quick-edit" data-quick-edit>
          <div class="quick-edit__head">Quick edit - preview only (saved in this browser)</div>
          <form class="quick-edit__form" data-url-form="${escapeHtml(page.pageId)}">
            <div class="quick-edit__row">
              <label>Dev URL
                <input type="url" name="devUrl" value="${escapeHtml(page.devUrl || '')}" placeholder="https://dev.example.com">
              </label>
              <label>Live URL
                <input type="url" name="liveUrl" value="${escapeHtml(page.liveUrl || '')}" placeholder="https://www.example.com">
              </label>
            </div>
            <button type="submit">Update preview</button>
          </form>
          <button type="button" class="quick-edit__fill" data-fill-sample>Fill a sample review note</button>
        </div>

        <aside class="feedback-panel">
          <h3>Review Results</h3>
          <div data-notes-for="${escapeHtml(page.pageId)}">${renderNotes(page, activeSize)}</div>

          <button type="button" class="demo-clear" data-clear-notes="${escapeHtml(page.pageId)}">Clear results for this screen size</button>

          <form class="feedback-form" data-note-form="${escapeHtml(page.pageId)}">
            <input type="hidden" name="screenSize" value="${escapeHtml(activeSize)}">

            <label>
              Reviewer name or initials
              <input type="text" name="reviewerName" required>
            </label>

            <label>
              Status
              <select name="status">
                <option value="approved">Approved</option>
                <option value="approved-after-these-changes">Approved after these changes</option>
                <option value="needs-design-changes">Needs design changes</option>
                <option value="needs-content-changes">Needs content changes</option>
                <option value="needs-mobile-review">Needs mobile review</option>
                <option value="blocked-cannot-review">Blocked / cannot review</option>
                <option value="not-approved">Not approved</option>
              </select>
            </label>

            <label>
              Comment
              <textarea name="comment" placeholder="What did you notice?"></textarea>
            </label>

            <button type="submit">Save note</button>
          </form>
        </aside>

        <nav class="screen-tabs" aria-label="Screen size">
          ${sizes.map(size => `<button type="button" data-size="${escapeHtml(size)}" ${size === activeSize ? 'class="active"' : ''}>${escapeHtml(screenSizeLabel(size))}</button>`).join('')}
        </nav>

        <p class="viewport-note">
          Heads up: these are common screen widths, not exact inch sizes. Zoom, display scaling, and your monitor can all change what actually fits. We go by the browser width listed for each one.
        </p>

        <div class="preview-scale-controls" role="group" aria-label="Preview scale" data-scale-controls="${escapeHtml(page.pageId)}">
          <span class="preview-scale-controls__label">Preview scale:</span>
          ${Object.keys(SCALE_LABELS).map(mode => `<button type="button" data-scale="${mode}">${SCALE_LABELS[mode]}</button>`).join('')}
        </div>

        <div class="preview-status" data-status-for="${escapeHtml(page.pageId)}" aria-live="polite"></div>

        <div class="preview-stage">
          <article class="frame-card">
            <div class="frame-card__header">
              <strong>Dev preview</strong>
              ${page.devUrl ? `<a href="${escapeHtml(page.devUrl)}" target="_blank" rel="noopener">Open Dev</a>` : ''}
            </div>
            ${page.devScreenshotPath ? `<img class="preview-screenshot" src="${escapeHtml(page.devScreenshotPath)}" alt="Dev screenshot">` : page.devUrl ? `<iframe src="${escapeHtml(page.devUrl)}" title="Dev preview"></iframe>` : '<p>No Dev URL</p>'}
          </article>

          <article class="frame-card">
            <div class="frame-card__header">
              <strong>Live preview</strong>
              ${page.liveUrl ? `<a href="${escapeHtml(page.liveUrl)}" target="_blank" rel="noopener">Open Live</a>` : ''}
            </div>
            ${page.liveScreenshotPath ? `<img class="preview-screenshot" src="${escapeHtml(page.liveScreenshotPath)}" alt="Live screenshot">` : page.liveUrl ? `<iframe src="${escapeHtml(page.liveUrl)}" title="Live preview"></iframe>` : '<p>No Live URL</p>'}
          </article>
        </div>
      </div>
    </section>
  `;
}

function presetFor(size) {
  return PRESETS[size] || PRESETS.desktop;
}

function ensureScaler(card) {
  const iframe = card.querySelector('iframe');
  if (!iframe) return null;

  let scaler = iframe.closest('.viewport-scaler');
  if (!scaler) {
    scaler = document.createElement('div');
    scaler.className = 'viewport-scaler';
    iframe.parentNode.insertBefore(scaler, iframe);
    scaler.appendChild(iframe);
  }
  return scaler;
}

function computeScale(pageEl, preset, scaleMode) {
  if (scaleMode === '100') return 1;
  if (scaleMode === '75') return 0.75;
  if (scaleMode === '50') return 0.5;

  const stage = pageEl.querySelector('.preview-stage');
  if (!stage) return 1;
  const size = pageEl.dataset.previewSize;
  const cardCount = size === 'mobile' ? 2 : 1;
  const available = stage.clientWidth - STAGE_GAP * (cardCount - 1);
  const raw = (available / cardCount) / preset.w;
  // Desktop fills the available width. Laptop presets and mobile only scale down.
  return size === 'desktop' ? raw : Math.min(1, raw);
}

function applyLayout(pageEl) {
  const pageId = pageEl.dataset.pageId;
  if (!pageId) return;

  const size = state.activeSizes[pageId] || 'desktop';
  const scaleMode = state.scaleModes[pageId] || 'fit';
  const preset = presetFor(size);
  const stage = pageEl.querySelector('.preview-stage');
  if (!stage) return;

  pageEl.dataset.previewSize = size;

  const cardCount = size === 'mobile' ? 2 : 1;
  const scale = computeScale(pageEl, preset, scaleMode);

  stage.style.setProperty('display', 'flex', 'important');
  stage.style.setProperty('flex-wrap', 'wrap', 'important');
  stage.style.setProperty('gap', `${STAGE_GAP}px`, 'important');
  stage.style.setProperty('align-items', 'flex-start', 'important');
  stage.style.setProperty('justify-content', size === 'desktop' ? 'flex-start' : 'center', 'important');
  stage.style.setProperty('width', '100%', 'important');
  stage.style.setProperty('max-width', 'none', 'important');
  stage.style.setProperty('overflow-x', 'auto', 'important');

  let screenshotLine = '';

  stage.querySelectorAll('.frame-card').forEach(card => {
    card.style.setProperty('min-width', '0', 'important');
    card.style.setProperty('width', 'auto', 'important');
    card.style.setProperty('max-width', 'none', 'important');
    card.style.setProperty('flex', '0 0 auto', 'important');

    const img = card.querySelector('img.preview-screenshot');
    if (img) {
      const targetW = Math.round(preset.w * scale);
      card.style.setProperty('width', `${targetW}px`, 'important');
      card.style.setProperty('max-width', '100%', 'important');
      img.style.setProperty('width', '100%', 'important');
      img.style.setProperty('height', 'auto', 'important');
      img.style.setProperty('min-height', '0', 'important');
      img.style.setProperty('object-fit', 'unset', 'important');

      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w && !screenshotLine) {
        const match = w === preset.w && h === preset.h;
        screenshotLine = `Uploaded screenshot: ${w} x ${h} px. Selected preset: ${preset.w} x ${preset.h} CSS px. Match: ${match ? 'yes' : 'no'}`;
      }
      // Size and center screenshots the same way as the iframe previews so the
      // fallback looks consistent with the live preview layout.
      card.style.setProperty('width', `${Math.round(preset.w * scale)}px`, 'important');
      card.style.setProperty('max-width', '100%', 'important');
      const shot = card.querySelector('img.preview-screenshot');
      if (shot) {
        shot.style.setProperty('width', '100%', 'important');
        shot.style.setProperty('height', 'auto', 'important');
      }
      return;
    }

    const scaler = ensureScaler(card);
    if (!scaler) return;
    const iframe = scaler.querySelector('iframe');
    if (iframe) {
      iframe.style.setProperty('width', `${preset.w}px`, 'important');
      iframe.style.setProperty('height', `${preset.h}px`, 'important');
      iframe.style.setProperty('max-width', 'none', 'important');
      iframe.style.setProperty('border', '0', 'important');
      iframe.style.setProperty('transform', `scale(${scale})`, 'important');
      iframe.style.setProperty('transform-origin', 'top left', 'important');
      iframe.style.setProperty('display', 'block', 'important');
    }
    scaler.style.setProperty('width', `${Math.round(preset.w * scale)}px`, 'important');
    scaler.style.setProperty('height', `${Math.round(preset.h * scale)}px`, 'important');
    scaler.style.setProperty('overflow', 'hidden', 'important');
    scaler.style.setProperty('max-width', '100%', 'important');
  });

  const status = pageEl.querySelector(`[data-status-for="${pageId}"]`);
  if (status) {
    const percent = Math.round(scale * 100);
    const scaleText = scaleMode === 'fit' ? `Fit to screen (${percent}%)` : `${SCALE_LABELS[scaleMode]} (${percent}%)`;
    const rows = [
      `<p><strong>Selected review size:</strong> ${escapeHtml(preset.label)}</p>`,
      `<p><strong>Test viewport:</strong> ${preset.w} x ${preset.h} CSS px</p>`,
      `<p><strong>Preview scale:</strong> ${escapeHtml(scaleText)}</p>`
    ];
    if (screenshotLine) {
      const isMismatch = /Match: no/.test(screenshotLine);
      rows.push(`<p><strong>Screenshot check:</strong> ${escapeHtml(screenshotLine)}</p>`);
      if (isMismatch) {
        rows.push('<p>This screenshot does not match the selected viewport preset. It may still be useful for review, but it is not a strict viewport match.</p>');
      }
    }
    status.innerHTML = rows.join('');
  }

  const controls = pageEl.querySelector(`[data-scale-controls="${pageId}"]`);
  if (controls) {
    controls.querySelectorAll('button[data-scale]').forEach(button => {
      button.classList.toggle('active', button.dataset.scale === scaleMode);
    });
  }
}

function applyAllLayouts() {
  document.querySelectorAll('.review-page[data-page-id]').forEach(pageEl => {
    applyLayout(pageEl);
    pageEl.querySelectorAll('.frame-card iframe').forEach(iframe => {
      iframe.addEventListener('load', () => applyLayout(pageEl), { once: true });
    });
    pageEl.querySelectorAll('img.preview-screenshot').forEach(img => {
      if (!img.complete) img.addEventListener('load', () => applyLayout(pageEl), { once: true });
    });
  });
}

function render() {
  app.innerHTML = `
    ${(state.packet.pages || []).map(renderPage).join('')}
  `;
  requestAnimationFrame(applyAllLayouts);
  updateDebug();
}

app.addEventListener('click', event => {
  const fillButton = event.target.closest('button[data-fill-sample]');
  if (fillButton) {
    fillDemoData();
    return;
  }

  const clearButton = event.target.closest('button[data-clear-notes]');
  if (clearButton) {
    const pageEl = clearButton.closest('.review-page');
    const pageId = clearButton.dataset.clearNotes;
    const size = state.activeSizes[pageId] || 'desktop';

    if (!confirm('Clear review results for this page and screen size? This cannot be undone in the demo.')) return;

    // Hide both seeded and local notes for this page and size, and remember it.
    const toClear = pageNotes(pageId, size);
    toClear.forEach(note => {
      if (note.noteId && !state.cleared.includes(note.noteId)) {
        state.cleared.push(note.noteId);
      }
    });
    state.notes = state.notes.filter(note => !(note.pageId === pageId && note.screenSize === size));

    saveCleared();
    saveNotes();
    render();
    return;
  }

  const scaleButton = event.target.closest('button[data-scale]');
  if (scaleButton) {
    const pageEl = scaleButton.closest('.review-page');
    if (!pageEl || !pageEl.dataset.pageId) return;
    state.scaleModes[pageEl.dataset.pageId] = scaleButton.dataset.scale;
    applyLayout(pageEl);
    return;
  }

  const button = event.target.closest('button[data-size]');
  if (!button) return;

  const pageEl = button.closest('.review-page');
  const pageId = pageEl.dataset.pageId;
  const size = button.dataset.size;

  state.activeSizes[pageId] = size;
  pageEl.dataset.previewSize = size;

  pageEl.querySelectorAll('.screen-tabs button').forEach(tab => {
    tab.classList.toggle('active', tab === button);
  });

  const hidden = pageEl.querySelector('input[name="screenSize"]');
  if (hidden) hidden.value = size;

  const page = state.packet.pages.find(item => item.pageId === pageId);
  const notesTarget = pageEl.querySelector(`[data-notes-for="${pageId}"]`);
  if (page && notesTarget) notesTarget.innerHTML = renderNotes(page, size);

  applyLayout(pageEl);
  updateDebug();
});

window.addEventListener('resize', () => {
  document.querySelectorAll('.review-page[data-page-id]').forEach(applyLayout);
});

app.addEventListener('submit', event => {
  const urlForm = event.target.closest('[data-url-form]');
  if (urlForm) {
    event.preventDefault();
    handleUrlForm(urlForm);
    return;
  }

  const form = event.target.closest('[data-note-form]');
  if (!form) return;

  event.preventDefault();

  const pageId = form.dataset.noteForm;
  const data = new FormData(form);

  state.notes.push({
    noteId: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    pageId,
    screenSize: data.get('screenSize'),
    reviewerName: data.get('reviewerName'),
    status: data.get('status'),
    comment: data.get('comment'),
    createdAt: new Date().toISOString()
  });

  saveNotes();
  form.reset();
  render();
});

// Apply a URL edit from the demo quick-edit panel. Preview only - it updates
// the in-memory packet and remembers the change in this browser.
function handleUrlForm(form) {
  const pageId = form.dataset.urlForm;
  const page = state.packet.pages.find(p => p.pageId === pageId);
  if (!page) return;

  const data = new FormData(form);
  const isHttpUrl = value => /^https?:\/\/\S+$/i.test((value || '').trim());
  const dev = (data.get('devUrl') || '').trim();
  const live = (data.get('liveUrl') || '').trim();

  if (dev !== '' && !isHttpUrl(dev)) {
    showDemoToast('Dev URL must start with http:// or https://');
    return;
  }
  if (live !== '' && !isHttpUrl(live)) {
    showDemoToast('Live URL must start with http:// or https://');
    return;
  }

  page.devUrl = dev;
  page.liveUrl = live;
  state.urlOverrides[pageId] = { devUrl: dev, liveUrl: live };
  saveUrlOverrides();
  render();
  showDemoToast('Preview updated. This is saved in your browser only.');
}

document.querySelector('#exportNotes').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(allNotes(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'piie-web-reviewer-notes.json';
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector('#clearNotes').addEventListener('click', () => {
  if (!confirm('Clear notes saved in this browser? Demo notes will remain visible.')) return;
  state.notes = [];
  saveNotes();
  render();
});

// Hidden demo helper: triple-click the title to auto-fill every feedback form
// with sample data so the demo is quick to show without typing it all out.
const SAMPLE_REVIEWERS = ['JT', 'Alex P.', 'Sam Rivera', 'Design Team', 'M. Chen'];
const SAMPLE_STATUSES = ['approved', 'approved-after-these-changes', 'needs-design-changes', 'needs-content-changes', 'needs-mobile-review'];
const SAMPLE_COMMENTS = [
  'Header spacing looks tighter on live, can we match the dev padding?',
  'Looks great on desktop. Mobile menu could use a bit more breathing room.',
  'Colors are good. The hero font feels a touch small to me.',
  'Good to go once the footer links are updated.',
  'Buttons line up nicely now, thanks for the fix.'
];

function pickSample(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function showDemoToast(message) {
  let toast = document.querySelector('.demo-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'demo-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showDemoToast.timer);
  showDemoToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function fillDemoData() {
  const forms = document.querySelectorAll('[data-note-form]');
  if (!forms.length) {
    showDemoToast('No forms to fill yet.');
    return;
  }
  forms.forEach(form => {
    const name = form.querySelector('[name="reviewerName"]');
    const status = form.querySelector('[name="status"]');
    const comment = form.querySelector('[name="comment"]');
    if (name) name.value = pickSample(SAMPLE_REVIEWERS);
    if (status) status.value = pickSample(SAMPLE_STATUSES);
    if (comment) comment.value = pickSample(SAMPLE_COMMENTS);
  });
  showDemoToast(`Filled ${forms.length} form${forms.length === 1 ? '' : 's'} with sample data. Hit Save note to add them.`);
}

(function wireDemoHelper() {
  const trigger = document.querySelector('.app-header h1');
  if (!trigger) return;
  trigger.style.cursor = 'pointer';
  trigger.title = 'Triple-click to toggle quick edit (change URLs in this browser)';
  let clicks = 0;
  let timer = null;
  trigger.addEventListener('click', () => {
    clicks += 1;
    clearTimeout(timer);
    timer = setTimeout(() => { clicks = 0; }, 600);
    if (clicks >= 3) {
      clicks = 0;
      clearTimeout(timer);
      const on = document.body.classList.toggle('quick-edit-on');
      showDemoToast(on ? 'Quick edit on. Change the URLs below, then Update preview.' : 'Quick edit off.');
    }
  });
})();

(function wireDebugToggle() {
  const trigger = document.querySelector('.app-header .eyebrow');
  if (!trigger) return;
  trigger.style.cursor = 'pointer';
  trigger.title = 'Triple-click to show or hide the debug box';
  let clicks = 0;
  let timer = null;
  trigger.addEventListener('click', () => {
    clicks += 1;
    clearTimeout(timer);
    timer = setTimeout(() => { clicks = 0; }, 600);
    if (clicks >= 3) {
      clicks = 0;
      clearTimeout(timer);
      const on = document.body.classList.toggle('debug-on');
      showDemoToast(on ? 'Debug box shown.' : 'Debug box hidden.');
    }
  });
})();

fetch('packet.json')
  .then(response => response.json())
  .then(packet => {
    state.packet = packet;
    applyUrlOverrides();
    render();
  })
  .catch(error => {
    app.innerHTML = `<p class="warning">Could not load packet.json: ${escapeHtml(error.message)}</p>`;
    updateDebug();
  });
