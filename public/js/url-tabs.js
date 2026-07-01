document.querySelectorAll('[data-url-tabs]').forEach(tabGroup => {
  const slide = tabGroup.closest('.review-slide');
  const review = slide.querySelector('[data-url-review]');
  const feedbackPanels = slide.querySelectorAll('[data-feedback-size]');

  tabGroup.addEventListener('click', event => {
    const button = event.target.closest('button[data-size]');
    if (!button) return;

    const size = button.dataset.size;

    tabGroup.querySelectorAll('button[data-size]').forEach(btn => {
      btn.classList.toggle('active', btn === button);
    });

    review.dataset.size = size;

    feedbackPanels.forEach(panel => {
      panel.classList.toggle('active', panel.dataset.feedbackSize === size);
    });
  });
});
