/**
 * Force Dev / Live preview layout.
 *
 * Desktop: Dev top, Live bottom, full width
 * Laptop presets: Dev top, Live bottom, fixed target width
 * Mobile: Dev left, Live right
 * Tablet: hidden
 */

(function () {
  const viewportPresets = {
    desktop: {
      label: 'Desktop',
      width: '100%',
      height: '78vh',
      minHeight: '700px',
      columns: '1fr',
      maxWidth: '100%'
    },
    'laptop-15-6': {
      label: '15.6 display',
      width: '1366px',
      height: '768px',
      minHeight: '768px',
      columns: '1fr',
      maxWidth: '1366px'
    },
    'laptop-14-5': {
      label: '14.5 display',
      width: '1280px',
      height: '760px',
      minHeight: '760px',
      columns: '1fr',
      maxWidth: '1280px'
    },
    'laptop-13': {
      label: '13 display',
      width: '1180px',
      height: '720px',
      minHeight: '720px',
      columns: '1fr',
      maxWidth: '1180px'
    },
    mobile: {
      label: 'Mobile',
      width: '390px',
      height: '844px',
      minHeight: '844px',
      columns: '1fr 1fr',
      maxWidth: '900px'
    }
  };

  function applyPreviewLayout(slide, size) {
    if (!slide) return;

    const stage = slide.querySelector('.webpage-preview-stage');
    if (!stage) return;

    const preset = viewportPresets[size] || viewportPresets.desktop;
    const cards = stage.querySelectorAll('.webpage-frame-card');
    const frames = stage.querySelectorAll('.webpage-frame-card iframe');

    slide.dataset.previewSize = size;

    stage.style.display = 'grid';
    stage.style.gridTemplateColumns = preset.columns;
    stage.style.width = '100%';
    stage.style.maxWidth = preset.maxWidth;
    stage.style.height = 'auto';
    stage.style.gap = '16px';
    stage.style.marginLeft = size === 'desktop' ? '0' : 'auto';
    stage.style.marginRight = size === 'desktop' ? '0' : 'auto';

    cards.forEach(card => {
      card.style.width = '100%';
      card.style.maxWidth = preset.width === '100%' ? '100%' : preset.width;
      card.style.minWidth = '0';
      card.style.marginLeft = 'auto';
      card.style.marginRight = 'auto';
    });

    frames.forEach(frame => {
      frame.style.width = preset.width;
      frame.style.maxWidth = '100%';
      frame.style.height = preset.height;
      frame.style.minHeight = preset.minHeight;
      frame.style.marginLeft = 'auto';
      frame.style.marginRight = 'auto';
      frame.style.display = 'block';
    });
  }

  function wireTabs() {
    document.querySelectorAll('[data-url-tabs]').forEach(tabGroup => {
      const slide = tabGroup.closest('.review-page');
      if (!slide) return;

      tabGroup.querySelectorAll('button[data-size="tablet"]').forEach(button => {
        button.hidden = true;
        button.style.display = 'none';
      });

      const activeButton =
        tabGroup.querySelector('button.active:not([data-size="tablet"])') ||
        tabGroup.querySelector('button[data-size="desktop"]') ||
        tabGroup.querySelector('button[data-size="laptop-15-6"]') ||
        tabGroup.querySelector('button[data-size="laptop-14-5"]') ||
        tabGroup.querySelector('button[data-size="laptop-13"]') ||
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
