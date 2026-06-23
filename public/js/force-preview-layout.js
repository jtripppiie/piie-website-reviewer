/**
 * Force Dev / Live preview layout.
 *
 * Desktop: Dev top, Live bottom
 * Laptop: Dev top, Live bottom
 * Mobile: Dev left, Live right
 * Tablet: hidden
 */

(function () {
  function applyPreviewLayout(slide, size) {
    if (!slide) return;

    const stage = slide.querySelector('.webpage-preview-stage');
    if (!stage) return;

    const frames = stage.querySelectorAll('.webpage-frame-card iframe');

    slide.dataset.previewSize = size;

    stage.style.display = 'grid';
    stage.style.width = '100%';
    stage.style.maxWidth = '100%';
    stage.style.height = 'auto';
    stage.style.gap = '16px';

    if (size === 'mobile') {
      stage.style.gridTemplateColumns = '1fr 1fr';
      stage.style.maxWidth = '900px';
      stage.style.marginLeft = 'auto';
      stage.style.marginRight = 'auto';

      frames.forEach(frame => {
        frame.style.height = '844px';
        frame.style.minHeight = '844px';
        frame.style.width = '100%';
      });

      return;
    }

    // Desktop and laptop stack vertically.
    stage.style.gridTemplateColumns = '1fr';
    stage.style.maxWidth = '100%';
    stage.style.marginLeft = '0';
    stage.style.marginRight = '0';

    frames.forEach(frame => {
      frame.style.height = '78vh';
      frame.style.minHeight = '700px';
      frame.style.width = '100%';
    });
  }

  function wireTabs() {
    document.querySelectorAll('[data-url-tabs]').forEach(tabGroup => {
      const slide = tabGroup.closest('.review-page');
      if (!slide) return;

      // Hide tablet.
      tabGroup.querySelectorAll('button[data-size="tablet"]').forEach(button => {
        button.hidden = true;
        button.style.display = 'none';
      });

      const activeButton =
        tabGroup.querySelector('button.active:not([data-size="tablet"])') ||
        tabGroup.querySelector('button[data-size="desktop"]') ||
        tabGroup.querySelector('button[data-size="laptop"]') ||
        tabGroup.querySelector('button[data-size="mobile"]');

      if (activeButton) {
        tabGroup.querySelectorAll('button').forEach(button => {
          button.classList.toggle('active', button === activeButton);
        });

        applyPreviewLayout(slide, activeButton.dataset.size);
      }

      tabGroup.addEventListener('click', event => {
        const button = event.target.closest('button[data-size]');
        if (!button || button.dataset.size === 'tablet') return;

        tabGroup.querySelectorAll('button').forEach(tab => {
          tab.classList.toggle('active', tab === button);
        });

        applyPreviewLayout(slide, button.dataset.size);
      });
    });
  }

  window.addEventListener('load', wireTabs);
  document.addEventListener('DOMContentLoaded', wireTabs);
})();
