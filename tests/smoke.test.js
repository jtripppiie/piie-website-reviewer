'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { makeId } = require(path.join(root, 'storage.js'));

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

test('quick-update URL contract accepts http(s) and rejects junk', () => {
  // Mirrors the validation used by the /r/:shareToken/quick-update route.
  const isHttpUrl = value => /^https?:\/\/\S+$/i.test(value);

  assert.ok(isHttpUrl('https://example.com'));
  assert.ok(isHttpUrl('http://localhost:3000/page'));
  assert.ok(!isHttpUrl('ftp://example.com'));
  assert.ok(!isHttpUrl('javascript:alert(1)'));
  assert.ok(!isHttpUrl('example.com'));
  assert.ok(!isHttpUrl(''));
});

test('server exposes the notes and per-size upload routes', () => {
  const server = read('server.js');

  assert.match(server, /\/r\/:shareToken\/notes['"`]/, 'view notes route missing');
  assert.match(server, /\/r\/:shareToken\/notes\/download/, 'download notes route missing');
  assert.match(server, /\/pages\/:pageId\/upload-shots/, 'per-size upload route missing');
});

test('removeUploadFile only targets files inside data/uploads', () => {
  const server = read('server.js');

  // The cleanup helper must refuse paths outside the uploads folder.
  assert.match(server, /function removeUploadFile/, 'removeUploadFile helper missing');
  assert.match(server, /startsWith\('\/uploads\/'\)/, 'removeUploadFile should guard the /uploads/ prefix');
});
