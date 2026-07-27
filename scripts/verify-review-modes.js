'use strict';

const path = require('path');
const express = require('express');
const ejs = require('ejs');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');

async function main() {
  const app = express();
  app.use('/public', express.static(path.join(root, 'public')));
  app.get('/test', async (req, res, next) => {
    try {
      const html = await ejs.renderFile(path.join(root, 'views', 'review.ejs'), {
        appVersion: 'browser-test',
        packet: {
          packetId: 'packet_test',
          shareToken: 'share_test',
          title: 'Screenshot controls test',
          published: true,
          pages: [{
            pageId: 'page_test',
            type: 'urlCompare',
            title: 'Screenshot test',
            devUrl: '/public/demo/dev-home.html',
            liveUrl: '/public/demo/live-home.html',
            devScreenshotPath: '/public/demo/photo-after.svg',
            liveScreenshotPath: '/public/demo/photo-before.svg',
            devShots: {
              desktop: '/public/demo/photo-after.svg',
              mobile: '/public/demo/photo-after-mobile.svg'
            },
            liveShots: {
              desktop: '/public/demo/photo-before.svg',
              mobile: '/public/demo/photo-before-mobile.svg'
            },
            previewSource: req.query.source === 'url' ? 'url' : 'screenshots',
            screenSizes: ['desktop', 'mobile']
          }]
        },
        responses: [],
        isAdminView: true,
        adminKeyValue: 'test',
        canQuickEdit: true,
        quickEditGated: false,
        quickEditUnlocked: true,
        quickEditError: false
      });
      res.send(html);
    } catch (error) {
      next(error);
    }
  });

  const server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const address = server.address();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
    page.on('console', message => {
      if (message.type() === 'error') console.error('BROWSER ERROR:', message.text());
    });
    await page.goto(`http://127.0.0.1:${address.port}/test`, { waitUntil: 'networkidle0' });

    await page.$eval('[data-webpage-mode="annotate"]', element => {
      element.scrollIntoView({ block: 'center' });
    });
    const initial = await page.evaluate(() => ({
      screenshotModes: Boolean(document.querySelector('[data-screenshot-modes]')),
      interactDisabled: document.querySelector('[data-webpage-mode="interact"]')?.disabled,
      compareActive: document.querySelector('[data-webpage-mode="compare"]')?.classList.contains('active'),
      compareVisible: Boolean(document.querySelector('.shots-size.active [data-compare]')?.getClientRects().length),
      perSizeComparisons: document.querySelectorAll('.shots-size [data-compare]').length,
      compareReveal: document.querySelector('.shots-size.active [data-compare]')?.style.getPropertyValue('--reveal'),
      scripts: Array.from(document.scripts).map(script => script.src)
    }));
    await page.evaluate(() => window.scrollTo(0, 500));
    await new Promise(resolve => setTimeout(resolve, 100));
    initial.stickyRows = await page.evaluate(() => {
      const topbar = document.querySelector('.review-topbar')?.getBoundingClientRect();
      const controls = document.querySelector('.review-controls')?.getBoundingClientRect();
      return {
        topbarBottom: topbar?.bottom || 0,
        controlsTop: controls?.top || 0,
        separated: Boolean(topbar && controls && controls.top >= topbar.bottom - 1)
      };
    });
    initial.loadedScreenshotHandler = await page.evaluate(async () => {
      const source = await fetch('/public/js/review.js?v=inspect').then(response => response.text());
      return source.includes("event.target.closest('[data-screenshot-modes]')");
    });
    initial.annotateHitTarget = await page.evaluate(() => {
      const button = document.querySelector('[data-webpage-mode="annotate"]');
      const rect = button.getBoundingClientRect();
      const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const controls = button.closest('.review-controls');
      const panel = document.querySelector('.feedback-panel');
      return {
        target: target?.outerHTML?.slice(0, 160) || '',
        controlsZ: getComputedStyle(controls).zIndex,
        controlsPosition: getComputedStyle(controls).position,
        panelZ: getComputedStyle(panel).zIndex,
        buttonRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
      };
    });

    await page.click('[data-webpage-mode="annotate"]');
    const armed = await page.evaluate(() => ({
      annotateActive: document.querySelector('[data-webpage-mode="annotate"]')?.classList.contains('active'),
      pinTarget: document.querySelector('.shots-size.active [data-compare]')?.dataset.pinTarget,
      toast: document.querySelector('.app-fill-toast')?.textContent
    }));

    await page.$eval('.shots-size.active [data-compare]', element => element.scrollIntoView({ block: 'start' }));
    const compareBox = await page.$eval('.shots-size.active [data-compare]', element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    });
    await page.mouse.click(
      compareBox.left + Math.min(220, compareBox.width * 0.4),
      compareBox.top + Math.min(160, compareBox.height * 0.3)
    );
    const annotated = await page.evaluate(() => ({
      dotX: document.querySelector('.screen-feedback.active form.feedback [name="dotX"]')?.value,
      dotY: document.querySelector('.screen-feedback.active form.feedback [name="dotY"]')?.value,
      tempDot: Boolean(document.querySelector('.shots-size.active [data-compare] .comment-dot.is-temp'))
    }));

    await page.click('[data-webpage-diff]');
    const diffToast = await page.$eval(
      'body',
      element => element.querySelector('.app-fill-toast')?.textContent || ''
    );

    await page.click('[data-webpage-mode="compare"]');
    const compareRestored = await page.$eval(
      '[data-webpage-mode="compare"]',
      element => element.classList.contains('active')
    );

    const result = { initial, armed, annotated, diffToast, compareRestored };
    const screenshotPassed =
      initial.screenshotModes &&
      initial.interactDisabled &&
      initial.compareActive &&
      initial.compareVisible &&
      initial.perSizeComparisons === 2 &&
      initial.stickyRows.separated &&
      armed.annotateActive &&
      armed.pinTarget === 'true' &&
      Boolean(annotated.dotX) &&
      Boolean(annotated.dotY) &&
      annotated.tempDot &&
      /only available for URL previews/.test(diffToast) &&
      compareRestored;

    console.log(JSON.stringify(result, null, 2));

    await page.goto(`http://127.0.0.1:${address.port}/test?source=url`, { waitUntil: 'networkidle0' });
    await page.$eval('[data-webpage-mode="interact"]', element => {
      element.scrollIntoView({ block: 'center' });
    });
    await page.click('[data-webpage-mode="interact"]');
    const urlInteract = await page.evaluate(() => ({
      active: document.querySelector('[data-webpage-mode="interact"]')?.classList.contains('active'),
      slider: document.querySelector('[data-webpage-preview]')?.classList.contains('is-slider')
    }));

    await page.click('[data-webpage-mode="compare"]');
    const urlCompare = await page.evaluate(() => ({
      active: document.querySelector('[data-webpage-mode="compare"]')?.classList.contains('active'),
      slider: document.querySelector('[data-webpage-preview]')?.classList.contains('is-slider')
    }));

    await page.click('[data-webpage-mode="annotate"]');
    const urlAnnotate = await page.evaluate(() => ({
      active: document.querySelector('[data-webpage-mode="annotate"]')?.classList.contains('active'),
      annotating: document.querySelector('[data-webpage-preview]')?.classList.contains('is-annotating'),
      markLayer: Boolean(document.querySelector('[data-webpage-preview] .webpage-mark-layer'))
    }));

    await page.click('[data-webpage-diff]');
    await new Promise(resolve => setTimeout(resolve, 700));
    const urlDiff = await page.evaluate(() => {
      const button = document.querySelector('[data-webpage-diff]');
      return {
        text: button?.textContent || '',
        active: button?.classList.contains('active') || false,
        unavailable: button?.disabled && /unavailable/i.test(button?.textContent || '')
      };
    });

    const urlResult = { urlInteract, urlCompare, urlAnnotate, urlDiff };
    const urlPassed =
      urlInteract.active &&
      !urlInteract.slider &&
      urlCompare.active &&
      urlCompare.slider &&
      urlAnnotate.active &&
      urlAnnotate.annotating &&
      urlAnnotate.markLayer &&
      (urlDiff.active || urlDiff.unavailable || /Hide differences/.test(urlDiff.text));

    console.log(JSON.stringify(urlResult, null, 2));
    if (!screenshotPassed || !urlPassed) process.exitCode = 1;
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
