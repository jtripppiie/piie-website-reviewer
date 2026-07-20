/**
 * Honest viewport presets for the Dev / Live preview.
 *
 * Important concept:
 * - Test viewport is the real CSS pixel size being reviewed. It never changes
 *   when you change preview scale.
 * - Preview scale only changes how big the preview looks, not what size is
 *   being tested.
 *
 * The friendly labels (15.6 display, 14.5 display, 13 display, Mobile) are
 * laptop-class viewport presets, not guaranteed physical screen inches.
 */

(function () {
  const PRESETS = {
    desktop: { label: 'Full desktop', w: 1440, h: 900, dynamicWidth: true },
    'desktop-1440': { label: '1440 desktop', w: 1440, h: 900 },
    'laptop-15-6': { label: '15.6 display', w: 1366, h: 768 },
    'laptop-14-5': { label: '14.5 display', w: 1280, h: 760 },
    'laptop-13': { label: '13 display', w: 1180, h: 720 },
    mobile: { label: 'Mobile', w: 390, h: 844 }
  };

  const SCALE_MODES = ['100', '75', '50'];
  const STAGE_GAP = 16;

  function presetFor(size) {
    return PRESETS[size] || PRESETS.desktop;
  }

  function resolvedPreset(stage, preset) {
    if (!preset.dynamicWidth) return preset;

    const availableWidth = Math.max(1024, Math.floor(stage.clientWidth || preset.w));
    return {
      ...preset,
      w: availableWidth
    };
  }

  function slideState(slide) {
    if (!slide._previewState) {
      slide._previewState = { size: 'desktop', scaleMode: '100' };
    }
    return slide._previewState;
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

  function ensureControls(slide) {
    const tabs = slide.querySelector('[data-url-tabs]');
    const stage = slide.querySelector('.webpage-preview-stage');
    if (!tabs || !stage) return null;

    let controls = slide.querySelector('.preview-scale-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'preview-scale-controls';
      controls.setAttribute('role', 'group');
      controls.setAttribute('aria-label', 'Preview scale');

      const labelText = document.createElement('span');
      labelText.className = 'preview-scale-controls__label';
      labelText.textContent = 'Preview scale:';
      controls.appendChild(labelText);

      const buttonLabels = {
        '100': '100%',
        '75': '75%',
        '50': '50%'
      };

      SCALE_MODES.forEach(mode => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.scale = mode;
        button.textContent = buttonLabels[mode];
        button.addEventListener('click', () => {
          slideState(slide).scaleMode = mode;
          setActiveScaleButton(slide);
          applyLayout(slide);
        });
        controls.appendChild(button);
      });

      stage.parentNode.insertBefore(controls, stage);
    }

    let status = slide.querySelector('.preview-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'preview-status';
      status.setAttribute('aria-live', 'polite');
      stage.parentNode.insertBefore(status, stage);
    }

    return { controls, status };
  }

  function computeScale(slide, preset) {
    const state = slideState(slide);
    if (state.scaleMode === '100') return 1;
    if (state.scaleMode === '75') return 0.75;
    if (state.scaleMode === '50') return 0.5;

    return 1;
  }

  function verifyIframe(scaler, preset) {
    const iframe = scaler.querySelector('iframe');
    if (!iframe) return 'No preview frame.';

    try {
      const innerWidth = iframe.contentWindow && iframe.contentWindow.innerWidth;
      const innerHeight = iframe.contentWindow && iframe.contentWindow.innerHeight;
      if (innerWidth) {
        const match = Math.abs(innerWidth - preset.w) <= 2;
        return `Verified inside frame: ${innerWidth} x ${innerHeight} CSS px${match ? '' : ' (does not match preset)'}`;
      }
    } catch (error) {
      // Cross-origin frames block reading inside. Fall back to element size.
    }

    return `Set frame element size: ${preset.w} x ${preset.h} CSS px (cross-origin, cannot read inside)`;
  }

  function applyLayout(slide) {
    const state = slideState(slide);
    const stage = slide.querySelector('.webpage-preview-stage');
    if (!stage) return;
    const preset = resolvedPreset(stage, presetFor(state.size));

    slide.dataset.previewSize = state.size;

    const scale = computeScale(slide, preset);
    const isFullDesktop = state.size === 'desktop';
    const isStackedDesktop = state.size === 'desktop' || state.size === 'desktop-1440';
    const isSlider = stage.classList.contains('is-slider');

    const scaledWidth = Math.round(preset.w * scale);
    const canFitTwoCards = cardsFitSideBySide(stage, scaledWidth);
    const cardCount = stage.querySelectorAll('.webpage-frame-card').length || 1;
    const visibleCardCount = isSlider ? 1 : (canFitTwoCards ? cardCount : 1);
    const stageMaxWidth = isFullDesktop
      ? '100%'
      : `${scaledWidth * visibleCardCount + STAGE_GAP * (visibleCardCount - 1) + visibleCardCount * 2}px`;

    stage.style.setProperty('display', 'flex', 'important');
    stage.style.setProperty('flex-direction', isStackedDesktop ? 'column' : (canFitTwoCards ? 'row' : 'column'), 'important');
    stage.style.setProperty('flex-wrap', isStackedDesktop ? 'nowrap' : (canFitTwoCards ? 'wrap' : 'nowrap'), 'important');
    stage.style.setProperty('gap', `${STAGE_GAP}px`, 'important');
    stage.style.setProperty('align-items', isStackedDesktop ? (isFullDesktop ? 'stretch' : 'center') : (canFitTwoCards ? 'flex-start' : 'center'), 'important');
    stage.style.setProperty('justify-content', 'center', 'important');
    stage.style.setProperty('width', '100%', 'important');
    stage.style.setProperty('min-width', '0', 'important');
    stage.style.setProperty('max-width', stageMaxWidth, 'important');
    stage.style.setProperty('margin-left', isFullDesktop ? '0' : 'auto', 'important');
    stage.style.setProperty('margin-right', isFullDesktop ? '0' : 'auto', 'important');
    stage.style.setProperty('overflow-x', isFullDesktop ? 'hidden' : (canFitTwoCards ? 'auto' : 'hidden'), 'important');

    const cards = stage.querySelectorAll('.webpage-frame-card');
    cards.forEach(card => {
      const scaler = ensureScaler(card);
      card.style.setProperty('min-width', '0', 'important');
      card.style.setProperty('width', isFullDesktop ? '100%' : 'auto', 'important');
      card.style.setProperty('max-width', isFullDesktop ? '100%' : (canFitTwoCards ? 'none' : '100%'), 'important');
      card.style.setProperty('flex', isFullDesktop ? '1 1 100%' : '0 0 auto', 'important');
      card.style.setProperty('overflow', isFullDesktop ? 'hidden' : (canFitTwoCards ? 'hidden' : 'auto'), 'important');
      card.style.setProperty('align-self', isStackedDesktop ? (isFullDesktop ? 'stretch' : 'center') : (canFitTwoCards ? 'auto' : 'center'), 'important');

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

      scaler.style.setProperty('width', `${scaledWidth}px`, 'important');
      scaler.style.setProperty('height', `${Math.round(preset.h * scale)}px`, 'important');
      scaler.style.setProperty('overflow', 'hidden', 'important');
      scaler.style.setProperty('max-width', '100%', 'important');
    });

    updateStatus(slide, preset, scale);
  }

  function cardsFitSideBySide(stage, scaledWidth) {
    const cardCount = stage.querySelectorAll('.webpage-frame-card').length;
    if (cardCount <= 1) return false;

    const requiredWidth = scaledWidth * cardCount + STAGE_GAP * (cardCount - 1);
    return stage.clientWidth >= requiredWidth;
  }

  function updateStatus(slide, preset, scale) {
    const status = slide.querySelector('.preview-status');
    if (!status) return;

    const state = slideState(slide);
    const scaleLabel = {
      '100': '100%',
      '75': '75%',
      '50': '50%'
    }[state.scaleMode];

    const percent = Math.round(scale * 100);
    const scaleText = `${scaleLabel} (${percent}%)`;

    const scalers = slide.querySelectorAll('.viewport-scaler');
    const verifyText = scalers.length ? verifyIframe(scalers[0], preset) : '';
    const closestPreset = Object.entries(PRESETS).filter(([key]) => key !== 'desktop-1440').map(([, candidate]) => candidate).reduce((closest, candidate) =>
      Math.abs(candidate.w - window.innerWidth) < Math.abs(closest.w - window.innerWidth) ? candidate : closest
    , PRESETS.desktop);

    status.innerHTML = '';

    const lines = [
      ['Selected review size', preset.label],
      ['Test viewport', `${preset.w} x ${preset.h} CSS px`],
      ['Your browser viewport', `${Math.round(window.innerWidth)} x ${Math.round(window.innerHeight)} CSS px`],
      ['Closest review preset', `${closestPreset.label} (based on browser width)`],
      ['Preview scale', scaleText]
    ];

    if (verifyText) {
      lines.push(['Frame check', verifyText]);
    }

    lines.forEach(([key, value]) => {
      const row = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = `${key}: `;
      row.appendChild(strong);
      row.appendChild(document.createTextNode(value));
      status.appendChild(row);
    });
  }

  function setActiveScaleButton(slide) {
    const state = slideState(slide);
    slide.querySelectorAll('.preview-scale-controls button').forEach(button => {
      button.classList.toggle('active', button.dataset.scale === state.scaleMode);
    });
  }

  function wireTabs() {
    document.querySelectorAll('[data-url-tabs]').forEach(tabGroup => {
      const slide = tabGroup.closest('.review-page');
      if (!slide) return;
      if (!slide.querySelector('.webpage-preview-stage')) return;

      ensureControls(slide);

      tabGroup.querySelectorAll('button[data-size="tablet"]').forEach(button => {
        button.hidden = true;
        button.style.display = 'none';
      });

      const activeButton =
        tabGroup.querySelector('button.active[data-size]:not([data-size="tablet"])') ||
        tabGroup.querySelector('button[data-size="desktop"]') ||
        tabGroup.querySelector('button[data-size]:not([data-size="tablet"])');

      if (activeButton) {
        tabGroup.querySelectorAll('button[data-size]').forEach(button => {
          button.classList.toggle('active', button === activeButton);
        });
        slideState(slide).size = activeButton.dataset.size;
      }

      setActiveScaleButton(slide);
      requestAnimationFrame(() => applyLayout(slide));

      tabGroup.addEventListener('click', event => {
        const button = event.target.closest('button[data-size]');
        if (!button || button.dataset.size === 'tablet') return;

        tabGroup.querySelectorAll('button[data-size]').forEach(tab => {
          tab.classList.toggle('active', tab === button);
        });

        slideState(slide).size = button.dataset.size;
        applyLayout(slide);
      });

      // Verify same-origin frames once they load.
      slide.querySelectorAll('.webpage-frame-card iframe').forEach(iframe => {
        iframe.addEventListener('load', () => applyLayout(slide));
      });
    });
  }

  function reflowAll() {
    document.querySelectorAll('[data-url-tabs]').forEach(tabGroup => {
      const slide = tabGroup.closest('.review-page');
      if (slide && slide.querySelector('.webpage-preview-stage')) {
        applyLayout(slide);
      }
    });
  }

  window.addEventListener('load', wireTabs);
  document.addEventListener('DOMContentLoaded', wireTabs);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(reflowAll, 150);
  });
  window.visualViewport?.addEventListener('resize', reflowAll);
})();
