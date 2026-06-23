const NOTES_KEY = 'piieWebReviewerNotes';

const state = {
  packet: null,
  activeSizes: {},
  notes: JSON.parse(localStorage.getItem(NOTES_KEY) || '[]')
};

const app = document.querySelector('#app');
const debugOutput = document.querySelector('#debugOutput');

function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(state.notes));
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
  return [...demoNotes, ...state.notes];
}

function pageNotes(pageId, screenSize) {
  return allNotes().filter(note => note.pageId === pageId && note.screenSize === screenSize);
}

function updateDebug() {
  debugOutput.textContent = JSON.stringify({
    app: 'PIIE Web Reviewer Static Demo',
    mode: 'GitHub Pages static',
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
    return '<p>No saved notes in this browser yet.</p>';
  }

  return `<p class="note-summary">${notes.length} saved ${notes.length === 1 ? 'result' : 'results'} for ${escapeHtml(screenSizeLabel(screenSize))}.</p>` + '<ol class="notes-list">' + notes.map(note => `
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
          <p>GitHub Pages demo mode. Seeded notes show multiple reviewers. New notes save only in this browser.</p>
          <div class="actions">
            ${page.devUrl ? `<a class="button" href="${escapeHtml(page.devUrl)}" target="_blank" rel="noopener">Open Dev</a>` : ''}
            ${page.liveUrl ? `<a class="button" href="${escapeHtml(page.liveUrl)}" target="_blank" rel="noopener">Open Live</a>` : ''}
          </div>
        </div>

        <aside class="feedback-panel">
          <h3>Review Results</h3>
          <div data-notes-for="${escapeHtml(page.pageId)}">${renderNotes(page, activeSize)}</div>

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
              <textarea name="comment" placeholder="Add feedback here"></textarea>
            </label>

            <button type="submit">Save Local Note</button>
          </form>
        </aside>

        <nav class="screen-tabs" aria-label="Screen size">
          ${sizes.map(size => `<button type="button" data-size="${escapeHtml(size)}" ${size === activeSize ? 'class="active"' : ''}>${escapeHtml(screenSizeLabel(size))}</button>`).join('')}
        </nav>

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

function render() {
  app.innerHTML = `
    ${(state.packet.pages || []).map(renderPage).join('')}
  `;
  updateDebug();
}

app.addEventListener('click', event => {
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

  updateDebug();
});

app.addEventListener('submit', event => {
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

fetch('packet.json')
  .then(response => response.json())
  .then(packet => {
    state.packet = packet;
    render();
  })
  .catch(error => {
    app.innerHTML = `<p class="warning">Could not load packet.json: ${escapeHtml(error.message)}</p>`;
    updateDebug();
  });
