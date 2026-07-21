// Review-page tools:
//  - "Clear Local Notes" wipes note drafts typed in this browser but not yet
//    saved. Saved notes are never affected.
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
    if (!confirm('Clear notes typed in this browser but not yet saved? Saved notes are not affected.')) return;
    const forms = document.querySelectorAll('form.feedback');
    let cleared = 0;
    forms.forEach(form => {
      const name = form.querySelector('[name="reviewerName"]');
      const status = form.querySelector('[name="status"]');
      const comment = form.querySelector('[name="comment"]');
      if (name && name.value) { name.value = ''; cleared += 1; }
      if (comment && comment.value) { comment.value = ''; cleared += 1; }
      if (status) status.selectedIndex = 0;
    });
    showToast(cleared ? 'Cleared unsaved note drafts in this browser.' : 'No unsaved drafts to clear.');
  }

  let clicks = 0;
  let timer = null;
  document.addEventListener('click', event => {
    if (event.target.closest('[data-clear-local-notes]')) {
      clearLocalDrafts();
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
