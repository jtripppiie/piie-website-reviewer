const NOTES_KEY = 'piieWebReviewerNotes';
const CLEARED_KEY = 'piieWebReviewerClearedNoteIds';
const URLS_KEY = 'piieWebReviewerUrlOverrides';

const APP_VERSION = '1.1.1';

const PRESETS = {
  desktop: { label: 'Full desktop', w: 1440, h: 900, dynamicWidth: true },
  'laptop-15-6': { label: '15.6 display', w: 1366, h: 768 },
  'laptop-14-5': { label: '14.5 display', w: 1280, h: 760 },
  'laptop-13': { label: '13 display', w: 1180, h: 720 },
  mobile: { label: 'Mobile', w: 390, h: 844 }
};

const STAGE_GAP = 16;

const state = {
  packet: null,
  activeSizes: {},
  compareModes: {},
  feedbackCollapsed: {},
  pendingDots: {},
  selectedNoteId: null,
  movingNoteId: null,
  debugMode: false,
  notes: JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'),
  cleared: JSON.parse(localStorage.getItem(CLEARED_KEY) || '[]'),
  urlOverrides: JSON.parse(localStorage.getItem(URLS_KEY) || '{}')
};

const app = document.querySelector('#app');
const debugOutput = document.querySelector('#debugOutput');

document.addEventListener('DOMContentLoaded', function () {
  var badge = document.createElement('div');
  badge.className = 'app-version-badge';
  badge.textContent = 'PIIE Reviewer v' + APP_VERSION + ' (demo)';
  document.body.appendChild(badge);
});

function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(state.notes.filter(note => !note.debugSample)));
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
    desktop: 'Full desktop',
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

function activePages() {
  return Array.isArray(state.packet?.pages)
    ? state.packet.pages.filter(page => !page.disabled)
    : [];
}

function allNotes() {
  const demoNotes = Array.isArray(state.packet?.seedNotes) ? state.packet.seedNotes : [];
  const cleared = new Set(state.cleared);
  const activePageIds = new Set(activePages().map(page => page.pageId));
  return [...demoNotes, ...state.notes].filter(note =>
    activePageIds.has(note.pageId) && !cleared.has(note.noteId)
  );
}

function pageNotes(pageId, screenSize) {
  return allNotes().filter(note => note.pageId === pageId && note.screenSize === screenSize);
}

function syncDebugNotes() {
  state.notes = state.notes.filter(note => !note.debugSample);
  if (!state.debugMode || !state.packet) return;

  const samples = [
    ['JT', 'approved', 'Navigation spacing looks consistent here.', 18, 20, '#b42318'],
    ['Alex', 'needs-design-changes', 'Please check the alignment of this content block.', 38, 36, '#175cd3'],
    ['Design', 'approved-after-these-changes', 'This image treatment is close; adjust the crop slightly.', 62, 54, '#067647'],
    ['MC', 'needs-mobile-review', 'Confirm this area at the mobile breakpoint.', 82, 72, '#7a5af8']
  ];

  activePages().filter(page => page.type === 'urlCompare').forEach(page => {
    normalizedScreenSizes(page.screenSizes).forEach(screenSize => {
      samples.forEach(([reviewerName, status, comment, dotX, dotY, dotColor], index) => {
        state.notes.push({
          noteId: `debug_note_${page.pageId}_${screenSize}_${index}`,
          pageId: page.pageId,
          screenSize,
          reviewerName,
          status,
          comment,
          dotX: String(dotX),
          dotY: String(dotY),
          dotColor,
          createdAt: new Date().toISOString(),
          debugSample: true
        });
      });
    });
  });
}

function updateDebug() {
  debugOutput.textContent = JSON.stringify({
    app: 'PIIE Web Reviewer Static Demo',
    mode: 'GitHub Pages static',
    version: APP_VERSION,
    time: new Date().toISOString(),
    packetTitle: state.packet?.title,
    packetId: state.packet?.packetId,
    pageCount: activePages().length,
    activeSizes: state.activeSizes,
    demoNoteCount: state.packet?.seedNotes?.length || 0,
    localNoteCount: state.notes.length,
    totalVisibleNoteCount: allNotes().length,
    limitations: [
      'No Express server on GitHub Pages',
      'Notes save only to this browser localStorage',
      'Use View notes to see everyone\'s feedback',
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

function renderFeedbackPanel(page, activeSize) {
  const collapsed = Boolean(state.feedbackCollapsed[page.pageId]);
  const pendingDot = state.pendingDots[page.pageId] || {};
  const hasPendingDot = Boolean(pendingDot.dotX && pendingDot.dotY);
  const selectedNote = state.notes.find(note => note.noteId === state.selectedNoteId && note.pageId === page.pageId);
  const movingNote = state.notes.find(note => note.noteId === state.movingNoteId && note.pageId === page.pageId);
  return `
    <aside class="feedback-panel${collapsed ? ' is-collapsed' : ''}" data-feedback-panel data-feedback-page="${escapeHtml(page.pageId)}">
      <div class="feedback-panel__bar">
        <h3>Add Notes</h3>
        <button type="button" class="feedback-panel__toggle" data-feedback-toggle aria-expanded="${collapsed ? 'false' : 'true'}">
          ${collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      ${movingNote ? `
        <div class="note-workflow-message" role="status">
          Moving <strong>${escapeHtml(movingNote.reviewerName || 'Reviewer')}</strong>'s pin. Click its new location on the preview.
          <button type="button" data-cancel-note-move>Cancel move</button>
        </div>
      ` : ''}
      ${selectedNote ? renderNoteEditor(selectedNote) : ''}
      <div data-notes-for="${escapeHtml(page.pageId)}">${renderNotes(page, activeSize)}</div>

      <button type="button" class="demo-clear" data-clear-notes="${escapeHtml(page.pageId)}">Clear results for this screen size</button>

      <p class="pending-pin-message" data-pending-pin-message ${hasPendingDot ? '' : 'hidden'}>Pin placed—add your note below.</p>

      <form class="feedback-form${hasPendingDot ? ' is-pinning' : ''}" data-note-form="${escapeHtml(page.pageId)}">
        <input type="hidden" name="screenSize" value="${escapeHtml(activeSize)}">
        <input type="hidden" name="dotX" value="${escapeHtml(pendingDot.dotX || '')}">
        <input type="hidden" name="dotY" value="${escapeHtml(pendingDot.dotY || '')}">

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
            <option value="needs-mobile-review">Needs mobile review</option>
          </select>
        </label>

        <label>
          Comment
          <textarea name="comment"></textarea>
        </label>

        <div class="feedback-form__actions">
          <button type="submit" data-save-note>${hasPendingDot ? 'Save pinned note' : 'Save note'}</button>
          <button type="button" data-cancel-pending-pin ${hasPendingDot ? '' : 'hidden'}>Cancel pin</button>
        </div>
      </form>
    </aside>
  `;
}

function renderNoteEditor(note) {
  return `
    <form class="note-editor" data-edit-note="${escapeHtml(note.noteId)}">
      <h4>Edit selected pin</h4>
      <label>Reviewer name or initials
        <input type="text" name="reviewerName" value="${escapeHtml(note.reviewerName || '')}" required>
      </label>
      <label>Status
        <select name="status">
          ${['approved', 'approved-after-these-changes', 'needs-design-changes', 'needs-mobile-review'].map(status =>
            `<option value="${status}"${note.status === status ? ' selected' : ''}>${escapeHtml(statusLabel(status))}</option>`
          ).join('')}
        </select>
      </label>
      <label>Comment
        <textarea name="comment">${escapeHtml(note.comment || '')}</textarea>
      </label>
      <div class="note-editor__actions">
        <button type="submit">Save changes</button>
        <button type="button" data-move-note="${escapeHtml(note.noteId)}">Move pin</button>
        <button type="button" data-delete-note="${escapeHtml(note.noteId)}" class="danger">Delete note</button>
        <button type="button" data-cancel-note-edit>Cancel</button>
      </div>
    </form>
  `;
}

function renderPage(page, index) {
  const sizes = normalizedScreenSizes(page.screenSizes);
  const activeSize = state.activeSizes[page.pageId] || sizes[0] || 'desktop';
  const compareMode = state.compareModes[page.pageId] || 'compare';
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
        <div class="quick-edit" data-quick-edit>
          <div class="quick-edit__head">Quick edit - preview only (saved in this browser)</div>
          <form class="quick-edit__form" data-url-form="${escapeHtml(page.pageId)}">
            <div class="quick-edit__row">
              <label>Dev URL
                <input type="text" name="devUrl" inputmode="url" value="${escapeHtml(page.devUrl || '')}" placeholder="https://dev.example.com or /public/demo/dev-home.html">
              </label>
              <label>Live URL
                <input type="text" name="liveUrl" inputmode="url" value="${escapeHtml(page.liveUrl || '')}" placeholder="https://www.example.com or /public/demo/live-home.html">
              </label>
            </div>
            <button type="submit">Update preview</button>
          </form>
          <button type="button" class="quick-edit__fill" data-fill-sample>Fill a sample review note</button>
        </div>

        <div class="review-controls">
          <span class="review-control-label">Screen size</span>
          <nav class="screen-tabs screen-size-tabs" aria-label="Screen size">
            ${sizes.map(size => `<button type="button" data-size="${escapeHtml(size)}" ${size === activeSize ? 'class="active"' : ''}>${escapeHtml(screenSizeLabel(size))}</button>`).join('')}
          </nav>
          <span class="review-control-label">Review mode</span>
          <nav class="screen-tabs review-mode-tabs" aria-label="Review mode">
            <button type="button" data-webpage-mode="interact" hidden disabled aria-hidden="true">Interact</button>
            <button type="button" data-webpage-mode="compare" title="Stack Dev and Live together and drag the slider to compare visual differences." data-tooltip="Stack Dev and Live together and drag the slider to compare visual differences." class="${compareMode === 'compare' ? 'active' : ''}">Compare</button>
            <button type="button" data-webpage-mode="annotate" title="Click a spot on the preview, then save a note pinned to that location." data-tooltip="Click a spot on the preview, then save a note pinned to that location." class="${compareMode === 'annotate' ? 'active' : ''}">Annotate</button>
            <button type="button" data-webpage-diff title="Highlight visible differences when both previews can be inspected by this page." data-tooltip="Highlight visible differences when both previews can be inspected by this page.">Find differences</button>
          </nav>
        </div>

        <div class="preview-stage${compareMode === 'compare' ? ' is-slider' : ''}${compareMode === 'annotate' ? ' is-annotating' : ''}" data-webpage-compare>
          <article class="frame-card frame-card--dev">
            <div class="frame-card__header">
              <strong>Dev preview</strong>
              ${page.devUrl ? `<a href="${escapeHtml(page.devUrl)}" target="_blank" rel="noopener">Open Dev</a>` : ''}
            </div>
            ${page.devScreenshotPath ? `<img class="preview-screenshot" src="${escapeHtml(page.devScreenshotPath)}" alt="Dev screenshot">` : page.devUrl ? `<iframe src="${escapeHtml(page.devUrl)}" title="Dev preview"></iframe>` : '<p>No Dev URL</p>'}
          </article>

          <article class="frame-card frame-card--live">
            <div class="frame-card__header">
              <strong>Live preview</strong>
              ${page.liveUrl ? `<a href="${escapeHtml(page.liveUrl)}" target="_blank" rel="noopener">Open Live</a>` : ''}
            </div>
            ${page.liveScreenshotPath ? `<img class="preview-screenshot" src="${escapeHtml(page.liveScreenshotPath)}" alt="Live screenshot">` : page.liveUrl ? `<iframe src="${escapeHtml(page.liveUrl)}" title="Live preview"></iframe>` : '<p>No Live URL</p>'}
          </article>
          <span class="compare-label compare-label--dev">Dev</span>
          <span class="compare-label compare-label--live">Live</span>
          <div class="compare-divider" aria-hidden="true"></div>
          <button class="compare-handle" type="button" aria-label="Drag comparison handle"></button>
          <div class="annotation-dots" data-annotation-dots>
            ${renderAnnotationDots(page, activeSize)}
          </div>
          <button class="annotation-layer" type="button" data-annotation-layer aria-label="Click a location to pin the next note"></button>
          <div class="difference-layer" data-difference-layer aria-live="polite"></div>
        </div>
      </div>
    </section>
  `;
}

function renderAnnotationDots(page, screenSize) {
  return pageNotes(page.pageId, screenSize)
    .filter(note =>
      note.dotX !== '' && note.dotY !== '' &&
      note.dotX != null && note.dotY != null &&
      Number.isFinite(Number(note.dotX)) && Number.isFinite(Number(note.dotY))
    )
    .map((note, index) => `
      <span
        class="demo-comment-dot"
        tabindex="0"
        style="left:${Number(note.dotX)}%;top:${Number(note.dotY)}%;background:${note.dotColor || reviewerDotColor(note.reviewerName)}"
        title="${escapeHtml((note.reviewerName || 'Reviewer') + ': ' + (note.comment || 'Pinned note'))}"
        aria-label="${escapeHtml((note.reviewerName || 'Reviewer') + ': ' + (note.comment || 'Pinned note'))}"
        data-note-id="${escapeHtml(note.noteId || '')}"
        data-pin-tooltip="${escapeHtml((note.reviewerName || 'Reviewer') + ': ' + (note.comment || 'Pinned note'))}">${index + 1}</span>
    `).join('');
}

const reviewerColorAssignments = new Map();
const reviewerColorPalette = ['#b42318', '#175cd3', '#067647', '#7a5af8', '#c11574', '#b54708', '#026aa2', '#4e5ba6'];

function reviewerDotColor(reviewerName) {
  const name = String(reviewerName || 'Reviewer').trim().toLowerCase();
  if (!reviewerColorAssignments.has(name)) {
    const used = new Set(reviewerColorAssignments.values());
    const available = reviewerColorPalette.find(color => !used.has(color));
    reviewerColorAssignments.set(name, available || reviewerColorPalette[reviewerColorAssignments.size % reviewerColorPalette.length]);
  }
  return reviewerColorAssignments.get(name);
}

function clearDifferenceLayer(pageEl) {
  const layer = pageEl?.querySelector('[data-difference-layer]');
  if (layer) layer.innerHTML = '';
  const button = pageEl?.querySelector('[data-webpage-diff]');
  if (button) {
    button.classList.remove('active');
    button.textContent = 'Find differences';
  }
}

function visibleElementSnapshot(frame) {
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  if (!win || !doc) throw new Error('Preview document is unavailable.');

  const selector = 'header, nav, main, section, article, h1, h2, h3, p, a, button, img';
  return [...doc.querySelectorAll(selector)].map((element, index) => {
    const rect = element.getBoundingClientRect();
    const style = win.getComputedStyle(element);
    if (rect.width < 4 || rect.height < 4 || rect.bottom < 0 || rect.top > win.innerHeight || style.visibility === 'hidden' || style.display === 'none') {
      return null;
    }

    const text = String(element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    const media = element.tagName === 'IMG' ? String(element.getAttribute('src') || '') : '';
    return {
      key: `${element.tagName}:${index}`,
      signature: [text, media, style.color, style.backgroundColor, style.fontSize, style.fontWeight].join('|'),
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      },
      viewport: { width: win.innerWidth, height: win.innerHeight }
    };
  }).filter(Boolean);
}

function drawDifferenceBoxes(pageEl, differences) {
  const layer = pageEl.querySelector('[data-difference-layer]');
  if (!layer) return;

  layer.innerHTML = differences.slice(0, 30).map((difference, index) => {
    const { rect, viewport } = difference;
    const left = Math.max(0, Math.min(100, (rect.left / viewport.width) * 100));
    const top = Math.max(0, Math.min(100, (rect.top / viewport.height) * 100));
    const width = Math.max(1, Math.min(100 - left, (rect.width / viewport.width) * 100));
    const height = Math.max(1, Math.min(100 - top, (rect.height / viewport.height) * 100));
    return `<span class="difference-box" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%"><span>${index + 1}</span></span>`;
  }).join('');
}

async function findVisibleDifferences(pageEl, { automatic = false } = {}) {
  const stage = pageEl.querySelector('[data-webpage-compare]');
  const button = pageEl.querySelector('[data-webpage-diff]');
  const frames = pageEl.querySelectorAll('.frame-card iframe');
  if (!stage || !button || frames.length < 2) {
    showDemoToast('Both Dev and Live previews are required to find differences.');
    return;
  }

  if (button.classList.contains('active')) {
    if (automatic) return;
    clearDifferenceLayer(pageEl);
    return;
  }

  if (button.disabled) return;
  button.disabled = true;
  button.textContent = 'Finding...';

  try {
    const dev = visibleElementSnapshot(frames[0]);
    const live = visibleElementSnapshot(frames[1]);
    const liveByKey = new Map(live.map(item => [item.key, item]));
    const differences = dev.filter(item => {
      const counterpart = liveByKey.get(item.key);
      return !counterpart || counterpart.signature !== item.signature;
    });

    state.compareModes[pageEl.dataset.pageId] = 'compare';
    pageEl.querySelectorAll('[data-webpage-mode]').forEach(modeButton => {
      modeButton.classList.toggle('active', modeButton.dataset.webpageMode === 'compare');
    });
    stage.classList.add('is-slider');
    stage.classList.remove('is-annotating');
    drawDifferenceBoxes(pageEl, differences);
    button.classList.add('active');
    button.textContent = `${differences.length} differences`;
    applyLayout(pageEl);
    if (!automatic) showDemoToast(differences.length ? `${differences.length} visible differences highlighted.` : 'No visible differences found in the current viewport.');
  } catch {
    clearDifferenceLayer(pageEl);
    if (!automatic) showDemoToast('This external website cannot be inspected by GitHub Pages. Use the local app or captured screenshots for difference highlighting.');
  } finally {
    button.disabled = false;
  }
}

function autoApplyVisibleDifferences(pageEl) {
  const mode = state.compareModes[pageEl?.dataset.pageId] || 'compare';
  if (!pageEl || mode !== 'compare') return;

  const attempt = () => {
    if (pageEl.isConnected) findVisibleDifferences(pageEl, { automatic: true });
  };
  pageEl.querySelectorAll('.frame-card iframe').forEach(frame => frame.addEventListener('load', attempt, { once: true }));
  setTimeout(attempt, 500);
}

function presetFor(size) {
  return PRESETS[size] || PRESETS.desktop;
}

function closestPresetForBrowser() {
  return Object.values(PRESETS).reduce((closest, preset) =>
    Math.abs(preset.w - window.innerWidth) < Math.abs(closest.w - window.innerWidth) ? preset : closest
  , PRESETS.desktop);
}

function normalizedScreenSizes(sizes) {
  const defaults = ['desktop', 'laptop-15-6', 'laptop-14-5', 'laptop-13', 'mobile'];
  const result = [];
  const source = Array.isArray(sizes) && sizes.length ? sizes : defaults;
  source.filter(size => size !== 'tablet' && size !== 'desktop-1440').forEach(size => {
    if (!result.includes(size)) result.push(size);
  });
  defaults.forEach(size => {
    if (!result.includes(size)) result.push(size);
  });
  return result;
}

function resolvedPreset(pageEl, preset) {
  if (!preset.dynamicWidth) return preset;
  const stage = pageEl.querySelector('.preview-stage');
  const availableWidth = Math.max(1024, Math.floor(stage?.clientWidth || preset.w));
  return { ...preset, w: availableWidth };
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

function computeScale(pageEl, preset) {
  const stage = pageEl.querySelector('.preview-stage');
  if (!stage) return 1;
  const size = pageEl.dataset.previewSize;
  const cardCount = stage.classList.contains('is-slider') ? 1 : (size === 'mobile' ? 2 : 1);
  const available = stage.clientWidth - STAGE_GAP * (cardCount - 1);
  const raw = (available / cardCount) / preset.w;
  // Desktop fills the available width. Laptop presets and mobile only scale down.
  return size === 'desktop' ? raw : Math.min(1, raw);
}

function applyLayout(pageEl) {
  const pageId = pageEl.dataset.pageId;
  if (!pageId) return;

  const size = state.activeSizes[pageId] || 'desktop';
  const stage = pageEl.querySelector('.preview-stage');
  if (!stage) return;
  const preset = resolvedPreset(pageEl, presetFor(size));
  const sliderMode = stage.classList.contains('is-slider');

  pageEl.dataset.previewSize = size;

  const cardCount = size === 'mobile' ? 2 : 1;
  const scale = computeScale(pageEl, preset);

  stage.style.setProperty('display', sliderMode ? 'grid' : 'flex', 'important');
  stage.style.setProperty('flex-wrap', 'wrap', 'important');
  stage.style.setProperty('gap', `${STAGE_GAP}px`, 'important');
  stage.style.setProperty('align-items', 'flex-start', 'important');
  stage.style.setProperty('justify-content', size === 'desktop' ? 'flex-start' : 'center', 'important');
  stage.style.setProperty('width', '100%', 'important');
  stage.style.setProperty('max-width', 'none', 'important');
  stage.style.setProperty('overflow-x', 'auto', 'important');

  let screenshotLine = '';

  stage.querySelectorAll('.frame-card').forEach(card => {
    card.style.setProperty('grid-area', sliderMode ? '1 / 1' : 'auto', 'important');
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

  const status = document.querySelector(`[data-status-for="${pageId}"]`);
  if (status) {
    const closestPreset = closestPresetForBrowser();
    const rows = [
      `<p><strong>Selected review size:</strong> ${escapeHtml(preset.label)}</p>`,
      `<p><strong>Test viewport:</strong> ${preset.w} x ${preset.h} CSS px</p>`,
      `<p><strong>Your browser viewport:</strong> ${Math.round(window.innerWidth)} x ${Math.round(window.innerHeight)} CSS px</p>`,
      `<p><strong>Closest review preset:</strong> ${escapeHtml(closestPreset.label)} (based on browser width)</p>`
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

window.visualViewport?.addEventListener('resize', applyAllLayouts);

function render() {
  const pages = activePages();
  const debugLogo = document.querySelector('#demoDebugLogo');
  if (debugLogo) debugLogo.setAttribute('aria-pressed', state.debugMode ? 'true' : 'false');
  app.innerHTML = `
    ${pages.map(renderPage).join('')}
  `;
  const feedbackHost = document.querySelector('#headerFeedback');
  const statusHost = document.querySelector('#headerPreviewStatus');
  const feedbackPage = pages.find(page => page.type === 'urlCompare');
  if (feedbackHost) {
    const activeSize = feedbackPage
      ? (state.activeSizes[feedbackPage.pageId] || normalizedScreenSizes(feedbackPage.screenSizes)[0] || 'desktop')
      : 'desktop';
    feedbackHost.innerHTML = feedbackPage ? renderFeedbackPanel(feedbackPage, activeSize) : '';
  }
  if (statusHost) {
    if (feedbackPage) {
      statusHost.dataset.statusFor = feedbackPage.pageId;
    } else {
      delete statusHost.dataset.statusFor;
      statusHost.innerHTML = '';
    }
  }
  requestAnimationFrame(() => {
    applyAllLayouts();
    document.querySelectorAll('.review-page[data-page-id]').forEach(autoApplyVisibleDifferences);
  });
  updateDebug();
}

function refreshPageNotesUi(pageId) {
  const page = activePages().find(item => item.pageId === pageId);
  if (!page) return;
  const size = state.activeSizes[pageId] || normalizedScreenSizes(page.screenSizes)[0] || 'desktop';
  const pageEl = document.querySelector(`.review-page[data-page-id="${pageId}"]`);
  const notesTarget = document.querySelector(`[data-notes-for="${pageId}"]`);
  const dotsTarget = pageEl?.querySelector('[data-annotation-dots]');
  const feedbackPage = activePages().find(item => item.type === 'urlCompare');
  const feedbackHost = document.querySelector('#headerFeedback');

  if (notesTarget) notesTarget.innerHTML = renderNotes(page, size);
  if (dotsTarget) dotsTarget.innerHTML = renderAnnotationDots(page, size);
  if (feedbackHost && feedbackPage?.pageId === pageId) {
    feedbackHost.innerHTML = renderFeedbackPanel(page, size);
  }
  updateDebug();
}

let draggedPinId = null;
let suppressPinClickUntil = 0;

app.addEventListener('pointerdown', event => {
  const pin = event.target.closest('.demo-comment-dot[data-note-id]:not(.pending-comment-dot)');
  if (!pin || event.button !== 0) return;

  const note = state.notes.find(item => item.noteId === pin.dataset.noteId);
  const stage = pin.closest('[data-webpage-compare]');
  if (!note || !stage) return;

  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;

  function positionPin(pointerEvent) {
    const rect = stage.getBoundingClientRect();
    const dotX = Math.max(0, Math.min(100, ((pointerEvent.clientX - rect.left) / rect.width) * 100));
    const dotY = Math.max(0, Math.min(100, ((pointerEvent.clientY - rect.top) / rect.height) * 100));
    pin.style.left = `${dotX.toFixed(2)}%`;
    pin.style.top = `${dotY.toFixed(2)}%`;
    return { dotX, dotY };
  }

  function onMove(pointerEvent) {
    if (!dragging && Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY) < 5) return;
    dragging = true;
    draggedPinId = note.noteId;
    pin.classList.add('is-dragging');
    positionPin(pointerEvent);
    pointerEvent.preventDefault();
  }

  function finish(pointerEvent) {
    pin.removeEventListener('pointermove', onMove);
    pin.removeEventListener('pointerup', finish);
    pin.removeEventListener('pointercancel', cancel);
    pin.classList.remove('is-dragging');
    if (!dragging) return;

    const { dotX, dotY } = positionPin(pointerEvent);
    note.dotX = dotX.toFixed(2);
    note.dotY = dotY.toFixed(2);
    state.selectedNoteId = note.noteId;
    state.feedbackCollapsed[note.pageId] = false;
    suppressPinClickUntil = Date.now() + 500;
    saveNotes();
    refreshPageNotesUi(note.pageId);
    showDemoToast('Pin moved.');
  }

  function cancel() {
    pin.removeEventListener('pointermove', onMove);
    pin.removeEventListener('pointerup', finish);
    pin.removeEventListener('pointercancel', cancel);
    pin.classList.remove('is-dragging');
    draggedPinId = null;
    pin.style.left = `${note.dotX}%`;
    pin.style.top = `${note.dotY}%`;
  }

  pin.setPointerCapture(event.pointerId);
  pin.addEventListener('pointermove', onMove);
  pin.addEventListener('pointerup', finish);
  pin.addEventListener('pointercancel', cancel);
});

document.addEventListener('click', event => {
  const pin = event.target.closest('.demo-comment-dot[data-note-id]');
  if (pin) {
    if (pin.dataset.noteId === draggedPinId && Date.now() < suppressPinClickUntil) {
      draggedPinId = null;
      return;
    }
    const note = state.notes.find(item => item.noteId === pin.dataset.noteId);
    if (!note) return;
    state.selectedNoteId = note.noteId;
    state.movingNoteId = null;
    state.feedbackCollapsed[note.pageId] = false;
    refreshPageNotesUi(note.pageId);
    return;
  }

  const cancelPendingPin = event.target.closest('[data-cancel-pending-pin]');
  if (cancelPendingPin) {
    const form = cancelPendingPin.closest('[data-note-form]');
    const pageId = form?.dataset.noteForm;
    if (!form || !pageId) return;
    delete state.pendingDots[pageId];
    form.elements.dotX.value = '';
    form.elements.dotY.value = '';
    form.classList.remove('is-pinning');
    form.querySelector('[data-save-note]').textContent = 'Save note';
    cancelPendingPin.hidden = true;
    document.querySelector('[data-pending-pin-message]')?.setAttribute('hidden', '');
    document.querySelector(`.review-page[data-page-id="${pageId}"] .pending-comment-dot`)?.remove();
    return;
  }

  const cancelEdit = event.target.closest('[data-cancel-note-edit]');
  if (cancelEdit) {
    const pageId = cancelEdit.closest('[data-feedback-page]')?.dataset.feedbackPage;
    state.selectedNoteId = null;
    if (pageId) refreshPageNotesUi(pageId);
    return;
  }

  const deleteNote = event.target.closest('[data-delete-note]');
  if (deleteNote) {
    const note = state.notes.find(item => item.noteId === deleteNote.dataset.deleteNote);
    if (!note || !confirm('Delete this note and its pin?')) return;
    state.notes = state.notes.filter(item => item.noteId !== note.noteId);
    state.selectedNoteId = null;
    saveNotes();
    refreshPageNotesUi(note.pageId);
    return;
  }

  const moveNote = event.target.closest('[data-move-note]');
  if (moveNote) {
    const note = state.notes.find(item => item.noteId === moveNote.dataset.moveNote);
    if (!note) return;
    state.movingNoteId = note.noteId;
    state.selectedNoteId = null;
    state.compareModes[note.pageId] = 'annotate';
    state.feedbackCollapsed[note.pageId] = true;
    const pageEl = document.querySelector(`.review-page[data-page-id="${note.pageId}"]`);
    const stage = pageEl?.querySelector('[data-webpage-compare]');
    pageEl?.querySelectorAll('[data-webpage-mode]').forEach(button => {
      button.classList.toggle('active', button.dataset.webpageMode === 'annotate');
    });
    stage?.classList.remove('is-slider');
    stage?.classList.add('is-annotating');
    clearDifferenceLayer(pageEl);
    refreshPageNotesUi(note.pageId);
    showDemoToast('Move mode: click the new pin location.');
    return;
  }

  if (event.target.closest('[data-cancel-note-move]')) {
    const pageId = event.target.closest('[data-feedback-page]')?.dataset.feedbackPage;
    state.movingNoteId = null;
    if (pageId) refreshPageNotesUi(pageId);
    return;
  }

  const feedbackToggle = event.target.closest('[data-feedback-toggle]');
  if (feedbackToggle) {
    const panel = feedbackToggle.closest('[data-feedback-panel]');
    const pageId = panel?.dataset.feedbackPage;
    if (!panel || !pageId) return;

    const collapsed = panel.classList.toggle('is-collapsed');
    state.feedbackCollapsed[pageId] = collapsed;
    feedbackToggle.textContent = collapsed ? 'Expand' : 'Collapse';
    feedbackToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    return;
  }

  const fillButton = event.target.closest('button[data-fill-sample]');
  if (fillButton) {
    fillDemoData();
    return;
  }

  const clearButton = event.target.closest('button[data-clear-notes]');
  if (clearButton) {
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
    refreshPageNotesUi(pageId);
    return;
  }

  const modeButton = event.target.closest('button[data-webpage-mode]');
  if (modeButton) {
    const pageEl = modeButton.closest('.review-page[data-page-id]');
    if (!pageEl) return;

    const mode = modeButton.dataset.webpageMode;
    const stage = pageEl.querySelector('[data-webpage-compare]');
    clearDifferenceLayer(pageEl);
    state.compareModes[pageEl.dataset.pageId] = mode;
    pageEl.querySelectorAll('[data-webpage-mode]').forEach(button => {
      button.classList.toggle('active', button === modeButton);
    });
    stage?.classList.toggle('is-slider', mode === 'compare');
    stage?.classList.toggle('is-annotating', mode === 'annotate');
    applyLayout(pageEl);
    if (mode === 'compare') autoApplyVisibleDifferences(pageEl);
    return;
  }

  const diffButton = event.target.closest('[data-webpage-diff]');
  if (diffButton) {
    const pageEl = diffButton.closest('.review-page[data-page-id]');
    if (pageEl) findVisibleDifferences(pageEl);
    return;
  }

  const annotationLayer = event.target.closest('[data-annotation-layer]');
  if (annotationLayer) {
    const pageEl = annotationLayer.closest('.review-page[data-page-id]');
    const stage = annotationLayer.closest('[data-webpage-compare]');
    if (!pageEl || !stage) return;

    const rect = stage.getBoundingClientRect();
    const dotX = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const dotY = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    const pageId = pageEl.dataset.pageId;

    if (state.movingNoteId) {
      const note = state.notes.find(item => item.noteId === state.movingNoteId && item.pageId === pageId);
      if (note) {
        note.dotX = dotX.toFixed(2);
        note.dotY = dotY.toFixed(2);
        state.selectedNoteId = note.noteId;
        state.movingNoteId = null;
        state.feedbackCollapsed[pageId] = false;
        saveNotes();
        refreshPageNotesUi(pageId);
        showDemoToast('Pin moved.');
        return;
      }
    }

    state.pendingDots[pageId] = { dotX: dotX.toFixed(2), dotY: dotY.toFixed(2) };

    const panel = document.querySelector(`[data-feedback-panel][data-feedback-page="${pageId}"]`);
    if (panel) {
      panel.classList.remove('is-collapsed');
      const toggle = panel.querySelector('[data-feedback-toggle]');
      if (toggle) {
        toggle.textContent = 'Collapse';
        toggle.setAttribute('aria-expanded', 'true');
      }
      state.feedbackCollapsed[pageId] = false;
    }

    const form = document.querySelector(`[data-note-form="${pageId}"]`);
    if (form) {
      form.elements.dotX.value = dotX.toFixed(2);
      form.elements.dotY.value = dotY.toFixed(2);
      form.classList.add('is-pinning');
      form.querySelector('[data-save-note]').textContent = 'Save pinned note';
      form.querySelector('[data-cancel-pending-pin]').hidden = false;
      const message = document.querySelector('[data-pending-pin-message]');
      if (message) message.hidden = false;
      form.querySelector('textarea[name="comment"]')?.focus();
    }

    stage.querySelector('.pending-comment-dot')?.remove();
    const pending = document.createElement('span');
    pending.className = 'demo-comment-dot pending-comment-dot';
    pending.style.left = `${dotX}%`;
    pending.style.top = `${dotY}%`;
    pending.textContent = '+';
    stage.querySelector('[data-annotation-dots]')?.appendChild(pending);
    return;
  }

  const button = event.target.closest('button[data-size]');
  if (!button) return;

  const pageEl = button.closest('.review-page');
  const pageId = pageEl.dataset.pageId;
  const size = button.dataset.size;

  clearDifferenceLayer(pageEl);

  state.activeSizes[pageId] = size;
  pageEl.dataset.previewSize = size;

  pageEl.querySelectorAll('.screen-size-tabs button[data-size]').forEach(tab => {
    tab.classList.toggle('active', tab === button);
  });

  const hidden = document.querySelector(`[data-note-form="${pageId}"] input[name="screenSize"]`);
  if (hidden) hidden.value = size;
  delete state.pendingDots[pageId];
  const noteForm = document.querySelector(`[data-note-form="${pageId}"]`);
  if (noteForm) {
    noteForm.elements.dotX.value = '';
    noteForm.elements.dotY.value = '';
  }
  applyLayout(pageEl);
  autoApplyVisibleDifferences(pageEl);

  const page = state.packet.pages.find(item => item.pageId === pageId);
  const notesTarget = document.querySelector(`[data-notes-for="${pageId}"]`);
  if (page && notesTarget) notesTarget.innerHTML = renderNotes(page, size);
  const dotsTarget = pageEl.querySelector('[data-annotation-dots]');
  if (page && dotsTarget) dotsTarget.innerHTML = renderAnnotationDots(page, size);

  applyLayout(pageEl);
  updateDebug();
});

let activeCompareDrag = null;

function setCompareReveal(stage, clientX) {
  const stageRect = stage.getBoundingClientRect();
  const rect = stage.querySelector('.frame-card')?.getBoundingClientRect() || stageRect;
  const clampedX = Math.max(rect.left, Math.min(rect.right, clientX));
  const reveal = ((clampedX - rect.left) / rect.width) * 100;
  stage.style.setProperty('--reveal', `${reveal}%`);
  stage.style.setProperty('--handle-left', `${clampedX - stageRect.left}px`);
}

app.addEventListener('pointerdown', event => {
  const handle = event.target.closest('.compare-handle, .compare-divider');
  const stage = handle?.closest('[data-webpage-compare].is-slider');
  if (!stage) return;

  activeCompareDrag = stage;
  setCompareReveal(stage, event.clientX);
  handle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
});

app.addEventListener('pointermove', event => {
  if (activeCompareDrag) setCompareReveal(activeCompareDrag, event.clientX);
});

app.addEventListener('pointerup', () => {
  activeCompareDrag = null;
});

app.addEventListener('pointercancel', () => {
  activeCompareDrag = null;
});

window.addEventListener('resize', () => {
  document.querySelectorAll('.review-page[data-page-id]').forEach(applyLayout);
});

document.addEventListener('submit', event => {
  const editForm = event.target.closest('[data-edit-note]');
  if (editForm) {
    event.preventDefault();
    const note = state.notes.find(item => item.noteId === editForm.dataset.editNote);
    if (!note) return;
    const data = new FormData(editForm);
    note.reviewerName = String(data.get('reviewerName') || '').trim();
    note.status = String(data.get('status') || 'approved');
    note.comment = String(data.get('comment') || '').trim();
    note.updatedAt = new Date().toISOString();
    state.selectedNoteId = null;
    saveNotes();
    refreshPageNotesUi(note.pageId);
    return;
  }

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
    dotX: data.get('dotX') || '',
    dotY: data.get('dotY') || '',
    createdAt: new Date().toISOString()
  });

  delete state.pendingDots[pageId];
  saveNotes();
  refreshPageNotesUi(pageId);
});

// Apply a URL edit from the demo quick-edit panel. Preview only - it updates
// the in-memory packet and remembers the change in this browser.
function handleUrlForm(form) {
  const pageId = form.dataset.urlForm;
  const page = state.packet.pages.find(p => p.pageId === pageId);
  if (!page) return;

  const data = new FormData(form);
  const isAllowedReviewUrl = value => {
    const trimmed = (value || '').trim();
    if (!trimmed) return true;
    if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
    return /^\/(?!\/)\S*$/.test(trimmed);
  };
  const dev = (data.get('devUrl') || '').trim();
  const live = (data.get('liveUrl') || '').trim();

  if (!isAllowedReviewUrl(dev)) {
    showDemoToast('Dev URL must start with http://, https://, or a same-origin /path');
    return;
  }
  if (!isAllowedReviewUrl(live)) {
    showDemoToast('Live URL must start with http://, https://, or a same-origin /path');
    return;
  }

  page.devUrl = dev;
  page.liveUrl = live;
  state.urlOverrides[pageId] = { devUrl: dev, liveUrl: live };
  saveUrlOverrides();
  render();
  showDemoToast('Preview updated. This is saved in your browser only.');
}

function renderNotesView() {
  const pages = activePages();
  const notes = allNotes();

  const sections = pages.map(page => {
    const forPage = notes.filter(note => note.pageId === page.pageId);
    if (!forPage.length) return '';

    const sizes = normalizedScreenSizes(page.screenSizes);
    const bySize = sizes.map(size => {
      const sizeNotes = forPage.filter(note => note.screenSize === size);
      if (!sizeNotes.length) return '';

      const items = sizeNotes.map(note => `
        <li class="note ${note.status}">
          <span class="note-icon" aria-hidden="true">${statusIcon(note.status)}</span>
          <div>
            <div class="note-meta">
              <strong>${escapeHtml(note.reviewerName || 'Reviewer')}</strong>
              <span>${statusLabel(note.status)}</span>
            </div>
            ${note.comment ? `<p>${escapeHtml(note.comment)}</p>` : '<p class="muted">No comment.</p>'}
            ${note.createdAt ? `<p class="muted note-date">${escapeHtml(new Date(note.createdAt).toLocaleString())}</p>` : ''}
          </div>
        </li>
      `).join('');

      return `<h4>${escapeHtml(screenSizeLabel(size))}</h4><ol class="notes-list">${items}</ol>`;
    }).join('');

    return `<section class="notes-view__group"><h3>${escapeHtml(page.title || 'Untitled page')}</h3>${bySize}</section>`;
  }).join('');

  const body = sections || '<p class="muted">No notes have been left yet.</p>';

  return `
    <div class="notes-view__panel" role="dialog" aria-label="All review notes">
      <div class="notes-view__bar">
        <h2>All notes</h2>
        <button type="button" id="closeNotesView">Close</button>
      </div>
      <p class="muted">${notes.length} ${notes.length === 1 ? 'note' : 'notes'} across all screen sizes.</p>
      ${body}
    </div>
  `;
}

function openNotesView() {
  closeNotesView();
  const overlay = document.createElement('div');
  overlay.className = 'notes-view';
  overlay.id = 'notesView';
  overlay.innerHTML = renderNotesView();
  overlay.addEventListener('click', event => {
    if (event.target === overlay || event.target.id === 'closeNotesView') closeNotesView();
  });
  document.addEventListener('keydown', onNotesViewKey);
  document.body.appendChild(overlay);
}

function onNotesViewKey(event) {
  if (event.key === 'Escape') closeNotesView();
}

function closeNotesView() {
  const existing = document.querySelector('#notesView');
  if (existing) existing.remove();
  document.removeEventListener('keydown', onNotesViewKey);
}

document.querySelector('#viewNotes').addEventListener('click', openNotesView);

document.querySelector('#clearNotes').addEventListener('click', () => {
  if (!confirm('Clear notes saved in this browser? Demo notes will remain visible.')) return;
  state.notes = [];
  state.debugMode = false;
  state.selectedNoteId = null;
  state.movingNoteId = null;
  saveNotes();
  render();
});

{
  const debugLogo = document.querySelector('#demoDebugLogo');
  let debugLogoClicks = 0;
  let debugLogoTimer = null;

  debugLogo.addEventListener('click', event => {
    debugLogoClicks += 1;
    clearTimeout(debugLogoTimer);
    debugLogoTimer = setTimeout(() => { debugLogoClicks = 0; }, 700);
    if (debugLogoClicks < 3) return;

    debugLogoClicks = 0;
    clearTimeout(debugLogoTimer);
    state.debugMode = !state.debugMode;
    syncDebugNotes();
    event.currentTarget.setAttribute('aria-pressed', state.debugMode ? 'true' : 'false');
    render();
    showDemoToast(state.debugMode ? 'Debug notes enabled.' : 'Debug notes hidden.');
  });
}

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
    syncDebugNotes();
    render();
  })
  .catch(error => {
    app.innerHTML = `<p class="warning">Could not load packet.json: ${escapeHtml(error.message)}</p>`;
    updateDebug();
  });
