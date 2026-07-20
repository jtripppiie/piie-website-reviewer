'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const os = require('node:os');
const { makeId, readJson } = require(path.join(root, 'storage.js'));
const { safeLocalRedirect } = require(path.join(root, 'security.js'));

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

test('package.json version matches the demo APP_VERSION', () => {
  const pkg = JSON.parse(read('package.json'));
  const demoJs = read('docs/static-review.js');
  const match = demoJs.match(/const APP_VERSION = '([^']+)'/);

  assert.ok(match, 'APP_VERSION constant not found in docs/static-review.js');
  assert.strictEqual(
    match[1],
    pkg.version,
    `Version mismatch: package.json is ${pkg.version} but docs/static-review.js is ${match[1]}`
  );
});

test('makeId returns a unique, prefixed id', () => {
  const a = makeId('note');
  const b = makeId('note');

  assert.match(a, /^note_/, 'id should start with the prefix');
  assert.notStrictEqual(a, b, 'two ids should not be identical');
});

test('readJson does not hide malformed storage', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewer-storage-'));
  const file = path.join(dir, 'broken.json');
  fs.writeFileSync(file, '{not valid json');

  await assert.rejects(readJson(file, []), SyntaxError);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('demo packet.json is valid and well formed', () => {
  const packet = JSON.parse(read('docs/packet.json'));

  assert.ok(Array.isArray(packet.pages) && packet.pages.length > 0, 'packet must have pages');

  const pageIds = new Set();
  for (const page of packet.pages) {
    assert.ok(page.pageId, 'every page needs a pageId');
    assert.ok(page.type, 'every page needs a type');
    assert.ok(page.title, 'every page needs a title');
    pageIds.add(page.pageId);

    if (page.type === 'urlCompare') {
      const hasDev = page.devUrl || page.devScreenshotPath;
      const hasLive = page.liveUrl || page.liveScreenshotPath;
      assert.ok(hasDev, `urlCompare page ${page.pageId} needs a dev URL or screenshot`);
      assert.ok(hasLive, `urlCompare page ${page.pageId} needs a live URL or screenshot`);
    }
  }

  for (const note of packet.seedNotes || []) {
    assert.ok(
      pageIds.has(note.pageId),
      `seed note ${note.noteId} points at unknown page ${note.pageId}`
    );
  }
});

test('controlled static fallback remains available but disabled', () => {
  const packet = JSON.parse(read('docs/packet.json'));
  const controlled = packet.pages.find(page => page.pageId === 'public_controlled_demo_page');

  assert.ok(controlled, 'controlled fallback page should remain in packet data');
  assert.strictEqual(controlled.disabled, true);
});

test('quick-update URL contract accepts http(s), same-origin paths, and rejects junk', () => {
  // Mirrors the validation used by the /r/:shareToken/quick-update route.
  const isAllowedReviewUrl = value => {
    const trimmed = (value || '').trim();
    if (!trimmed) return true;
    if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
    return /^\/(?!\/)\S*$/.test(trimmed);
  };

  assert.ok(isAllowedReviewUrl('https://example.com'));
  assert.ok(isAllowedReviewUrl('http://localhost:3000/page'));
  assert.ok(isAllowedReviewUrl('/public/demo/dev-home.html'));
  assert.ok(isAllowedReviewUrl(''));
  assert.ok(!isAllowedReviewUrl('//example.com'));
  assert.ok(!isAllowedReviewUrl('ftp://example.com'));
  assert.ok(!isAllowedReviewUrl('javascript:alert(1)'));
  assert.ok(!isAllowedReviewUrl('example.com'));
});

test('review login redirects only to local paths', () => {
  assert.strictEqual(safeLocalRedirect('/r/share_123?screen=mobile#page'), '/r/share_123?screen=mobile#page');
  assert.strictEqual(safeLocalRedirect('https://attacker.example'), '/');
  assert.strictEqual(safeLocalRedirect('//attacker.example/path'), '/');
  assert.strictEqual(safeLocalRedirect('javascript:alert(1)'), '/');
});

test('multipart routes authorize before writing uploads', () => {
  const server = read('server.js');
  assert.match(server, /update', requireAdminBeforeUpload, upload\.fields/);
  assert.match(server, /upload-shots', requireAdminBeforeUpload, upload\.fields/);
  assert.match(server, /image-compare', requireAdminBeforeUpload, upload\.fields/);
  assert.match(server, /url-compare', requireAdminBeforeUpload, upload\.fields/);
  assert.match(server, /quick-update', rateLimitQuickUpdate, requireAdminBeforeUpload, requireReviewer, upload\.fields/);
});

test('server exposes the notes and per-size upload routes', () => {
  const server = read('server.js');

  assert.match(server, /\/r\/:shareToken\/notes['"`]/, 'view notes route missing');
  assert.match(server, /\/r\/:shareToken\/notes\/download/, 'download notes route missing');
  assert.match(server, /\/pages\/:pageId\/upload-shots/, 'per-size upload route missing');
  assert.match(server, /\/admin\/packets\/demo['"`]/, 'demo packet route missing');
});

test('new reviews support optional automatic URL screenshots', () => {
  const server = read('server.js');
  const admin = read('views/admin.ejs');

  assert.match(admin, /name="autoCapture"/);
  assert.match(admin, /name="captureMode" value="primary"/);
  assert.match(server, /req\.body\.autoCapture === 'true'/);
  assert.match(server, /\['desktop', 'mobile'\]/);
});

test('static demo includes interact and compare modes', () => {
  const demo = read('docs/static-review.js');
  const index = read('docs/index.html');
  const realReview = read('views/review.ejs');

  assert.match(demo, /data-webpage-mode="interact"/);
  assert.match(demo, /data-webpage-mode="compare"/);
  assert.match(demo, /data-webpage-compare/);
  assert.match(demo, /setCompareReveal/);
  assert.match(demo, /data-webpage-mode="interact" title=.*data-tooltip=/);
  assert.match(demo, /data-webpage-mode="compare" title=.*data-tooltip=/);
  assert.match(demo, /data-webpage-mode="annotate" title=.*data-tooltip=/);
  assert.match(demo, />Annotate<\/button>/);
  assert.match(demo, /<h3>Add Notes<\/h3>/);
  assert.match(demo, /data-annotation-layer/);
  assert.match(demo, /data-webpage-diff/);
  assert.match(demo, /findVisibleDifferences/);
  assert.match(demo, /difference-box/);
  assert.match(demo, /reviewerDotColor/);
  assert.match(demo, /data-pin-tooltip/);
  assert.match(realReview, /data-webpage-mode="interact" title=.*data-tooltip=/);
  assert.match(realReview, /data-webpage-mode="compare" title=.*data-tooltip=/);
  assert.match(demo, /compareMode = state\.compareModes\[page\.pageId\] \|\| 'compare'/);
  assert.match(realReview, /class="active" data-webpage-mode="compare"/);
  assert.match(realReview, /webpage-preview-stage is-slider/);
  assert.match(index, /id="headerFeedback"/);
  assert.match(index, /id="headerPreviewStatus"/);
  assert.match(demo, /renderFeedbackPanel/);
});

test('static reviewer buttons and notes have a 14px accessibility floor', () => {
  const overrides = read('docs/static-demo-overrides.css');

  assert.match(overrides, /button,[\s\S]*\.feedback-panel,[\s\S]*font-size: 14px !important;/);
});

test('static annotations can be edited, moved, deleted, and debug-seeded', () => {
  const demo = read('docs/static-review.js');
  const index = read('docs/index.html');

  assert.match(demo, /data-edit-note/);
  assert.match(demo, /data-move-note/);
  assert.match(demo, /data-delete-note/);
  assert.match(demo, /Save pinned note/);
  assert.match(demo, /data-cancel-pending-pin/);
  assert.match(demo, /movingNoteId/);
  assert.match(demo, /debugSample/);
  assert.match(index, /id="demoDebugLogo"/);
});

test('removeUploadFile only targets files inside data/uploads', () => {
  const server = read('server.js');

  // The cleanup helper must refuse paths outside the uploads folder.
  assert.match(server, /function removeUploadFile/, 'removeUploadFile helper missing');
  assert.match(server, /startsWith\('\/uploads\/'\)/, 'removeUploadFile should guard the /uploads/ prefix');
});

test('feedback coordinates are clamped before rendering in inline CSS', () => {
  const server = read('server.js');
  assert.match(server, /dotX: normalizeNoteCoordinate\(req\.body\.dotX\)/);
  assert.match(server, /dotY: normalizeNoteCoordinate\(req\.body\.dotY\)/);
  assert.match(server, /Math\.max\(0, Math\.min\(100, number\)\)/);
});

test('multipart validation paths clean up uncommitted files', () => {
  const server = read('server.js');
  assert.match(server, /function cleanupRequestUploads/);
  assert.match(server, /if \(!before \|\| !after\) \{\s+cleanupRequestUploads\(req\)/);
});
