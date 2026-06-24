// Local power tools for the review page.
// Triple-click any page heading to toggle "quick edit" mode. That reveals the
// per-page panels for setting Dev/Live URLs and dropping in images, plus a
// button to fill a sample review note. Filling never auto-submits.
(function () {
  const SAMPLE_REVIEWERS = ['JT', 'Alex P.', 'Sam Rivera', 'Design Team', 'M. Chen'];
  const SAMPLE_STATUSES = ['approved', 'approved-after-these-changes', 'needs-design-changes', 'needs-content-changes', 'needs-mobile-review'];
  const SAMPLE_COMMENTS = [
    'Header spacing looks tighter on live, can we match the dev padding?',
    'Looks great on desktop. Mobile menu could use a bit more breathing room.',
    'Colors are good. The hero font feels a touch small to me.',
    'Good to go once the footer links are updated.',
    'Buttons line up nicely now, thanks for the fix.'
  ];

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

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

  function fillForms(scope) {
    const root = scope || document;
    const forms = root.querySelectorAll('form.feedback');
    if (!forms.length) {
      showToast('No forms to fill here.');
      return;
    }
    forms.forEach(form => {
      const name = form.querySelector('[name="reviewerName"]');
      const status = form.querySelector('[name="status"]');
      const comment = form.querySelector('[name="comment"]');
      if (name) name.value = pick(SAMPLE_REVIEWERS);
      if (status) status.value = pick(SAMPLE_STATUSES);
      if (comment) comment.value = pick(SAMPLE_COMMENTS);
    });
    showToast('Filled ' + forms.length + ' form' + (forms.length === 1 ? '' : 's') + ' with sample data. Hit Save note to submit.');
  }

  function toggleQuickEdit() {
    const on = document.body.classList.toggle('quick-edit-on');
    showToast(on ? 'Quick edit on. Set URLs or drop in images, then Save.' : 'Quick edit off.');
  }

  let clicks = 0;
  let timer = null;
  document.addEventListener('click', event => {
    const fillButton = event.target.closest('[data-fill-sample]');
    if (fillButton) {
      fillForms(fillButton.closest('.review-page') || document);
      return;
    }

    if (!event.target.closest('.page-heading') && !event.target.closest('.cover-slide')) return;
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
