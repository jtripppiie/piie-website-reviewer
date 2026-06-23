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
});

document.querySelectorAll('[data-url-tabs]').forEach(tabGroup => {
  const slide = tabGroup.closest('.review-page');
  const feedbackPanels = slide.querySelectorAll('[data-feedback-size]');

  tabGroup.addEventListener('click', event => {
    const button = event.target.closest('button[data-size]');
    if (!button) return;

    const size = button.dataset.size;

    tabGroup.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn === button);
    });

    feedbackPanels.forEach(panel => {
      panel.classList.toggle('active', panel.dataset.feedbackSize === size);
    });
  });
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
