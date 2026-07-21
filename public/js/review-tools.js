// Review-page tools:
//  - "Clear My Notes" deletes every note this browser saved (server-side) and
//    wipes any unsaved draft text. Other reviewers' notes are never affected.
//  - Triple-click the title, a page heading, or the cover toggles quick-edit
//    mode, revealing the per-page panels for setting Dev/Live URLs and dropping
//    in images.
(function () {
  function showToast(message) {
    let toast = document.querySelector('.app-fill-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'app-fill-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  function toggleQuickEdit() {
    const on = document.body.classList.toggle('quick-edit-on');
    showToast(on ? 'Quick edit on. Set URLs or drop in images, then Save.' : 'Quick edit off.');
  }

  function clearLocalDrafts() {
    const button = document.querySelector('[data-clear-local-notes]');
    const clearUrl = button ? button.getAttribute('data-clear-mine-url') : '';

    if (!confirm('Delete every note you saved from this browser? Other reviewers\u2019 notes are not affected. This cannot be undone.')) return;

    // Always wipe any unsaved draft text in the open forms first.
    document.querySelectorAll('form.feedback').forEach(form => {
      const name = form.querySelector('[name="reviewerName"]');
      const status = form.querySelector('[name="status"]');
      const comment = form.querySelector('[name="comment"]');
      if (name) name.value = '';
      if (comment) comment.value = '';
      if (status) status.selectedIndex = 0;
    });

    if (!clearUrl) {
      showToast('Cleared unsaved note drafts in this browser.');
      return;
    }

    if (button) button.disabled = true;
    fetch(clearUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'fetch', 'Accept': 'application/json' }
    })
      .then(response => {
        if (!response.ok) throw new Error('clear-failed');
        return response.json();
      })
      .then(data => {
        showToast(data.removed ? `Removed ${data.removed} of your saved note${data.removed === 1 ? '' : 's'}.` : 'No saved notes from this browser to remove.');
        // Reload so pins and note lists for every screen size refresh.
        setTimeout(() => window.location.reload(), 500);
      })
      .catch(() => {
        if (button) button.disabled = false;
        showToast('Could not clear your saved notes. Please try again.');
      });
  }

  function clearAllNotes(button) {
    const clearUrl = button ? button.getAttribute('data-clear-all-url') : '';
    if (!clearUrl) return;

    if (!confirm('Delete ALL notes in this review from EVERY reviewer, across all pages and screen sizes? This cannot be undone.')) return;

    button.disabled = true;
    fetch(clearUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'fetch', 'Accept': 'application/json' }
    })
      .then(response => {
        if (!response.ok) throw new Error('clear-failed');
        return response.json();
      })
      .then(data => {
        showToast(data.removed ? `Deleted all ${data.removed} note${data.removed === 1 ? '' : 's'}.` : 'There were no notes to delete.');
        setTimeout(() => window.location.reload(), 500);
      })
      .catch(() => {
        button.disabled = false;
        showToast('Could not clear all notes. Please try again.');
      });
  }

  let clicks = 0;
  let timer = null;
  document.addEventListener('click', event => {
    if (event.target.closest('[data-clear-local-notes]')) {
      clearLocalDrafts();
      return;
    }

    if (event.target.closest('[data-clear-all-notes]')) {
      clearAllNotes(event.target.closest('[data-clear-all-notes]'));
      return;
    }

    if (!event.target.closest('.page-heading') && !event.target.closest('.cover-slide') && !event.target.closest('.review-brand')) return;
    clicks += 1;
    clearTimeout(timer);
    timer = setTimeout(() => { clicks = 0; }, 600);
    if (clicks >= 3) {
      clicks = 0;
      clearTimeout(timer);
      toggleQuickEdit();
    }
  });
})();
