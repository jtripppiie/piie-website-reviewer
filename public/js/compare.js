document.querySelectorAll('[data-compare]').forEach(compare => {
  let dragging = false;

  function setReveal(clientX) {
    const rect = compare.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    compare.style.setProperty('--reveal', percent);
  }

  compare.style.setProperty('--reveal', 50);

  compare.addEventListener('pointerdown', event => {
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
