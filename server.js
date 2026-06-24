require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const {
  ensureDataFiles,
  getPackets,
  savePackets,
  getResponses,
  saveResponses,
  makeId
} = require('./storage');

const { captureUrlAllPresets } = require('./screenshot');

const APP_VERSION = require('./package.json').version;

const app = express();

// PIIE_WEB_REVIEWER_REQUEST_LOGGER
function safeUrlForLog(url) {
  // Hide the admin key so it never lands in server logs.
  return String(url).replace(/([?&]key=)[^&]*/gi, '$1***');
}

// Lightweight in-memory rate limit for the open-ish quick-update route.
// Second layer behind reviewer auth; guards against runaway loops or abuse.
const quickUpdateHits = new Map();
function rateLimitQuickUpdate(req, res, next) {
  const windowMs = 60 * 1000;
  const maxHits = 30;
  const now = Date.now();
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const key = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
  const entry = quickUpdateHits.get(key);

  if (!entry || now - entry.start > windowMs) {
    quickUpdateHits.set(key, { start: now, count: 1 });
    return next();
  }

  entry.count += 1;
  if (entry.count > maxHits) {
    return res.status(429).send('Too many quick edits in a short time. Please wait a minute and try again.');
  }

  next();
}

app.use((req, res, next) => {
  const started = Date.now();
  const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  req.requestId = requestId;

  console.log(`[${requestId}] --> ${req.method} ${safeUrlForLog(req.originalUrl)}`);

  res.on('finish', () => {
    const duration = Date.now() - started;
    console.log(`[${requestId}] <-- ${res.statusCode} ${req.method} ${safeUrlForLog(req.originalUrl)} ${duration}ms`);
  });

  next();
});

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'change-me');

if (!ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD is required when NODE_ENV=production.');
}


const REVIEW_USERNAME = process.env.REVIEW_USERNAME || (process.env.NODE_ENV === 'production' ? '' : 'PIIE');
const REVIEW_PASSWORD = process.env.REVIEW_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'review-local-only');

if (process.env.NODE_ENV === 'production' && (!REVIEW_USERNAME || !REVIEW_PASSWORD)) {
  throw new Error('REVIEW_USERNAME and REVIEW_PASSWORD are required when NODE_ENV=production.');
}

// Optional second password specifically for quick edit. Empty = gate disabled.
const QUICK_EDIT_PASSWORD = process.env.QUICK_EDIT_PASSWORD || '';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.locals.appVersion = APP_VERSION;

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

const uploadStorage = multer.diskStorage({
  destination: path.join(__dirname, 'data', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `${makeId('upload')}${ext}`);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only PNG, JPG, WebP, or GIF images are allowed.'));
    }
    cb(null, true);
  }
});

function isAdmin(req) {
  return req.query.key === ADMIN_PASSWORD || req.body.key === ADMIN_PASSWORD;
}

function adminKey(req) {
  return req.query.key || req.body.key || '';
}

function uploadPath(file) {
  return file ? `/uploads/${file.filename}` : '';
}

// Safely delete a previously uploaded file when it is replaced or removed, so
// the data/uploads folder does not fill up with orphans. Only touches files
// inside data/uploads and never throws.
function removeUploadFile(webPath) {
  if (!webPath || typeof webPath !== 'string') return;
  if (!webPath.startsWith('/uploads/')) return;

  const name = path.basename(webPath);
  const full = path.join(__dirname, 'data', 'uploads', name);
  const base = path.join(__dirname, 'data', 'uploads');

  if (!full.startsWith(base + path.sep)) return;

  fs.promises.unlink(full).catch(() => {});
}

function removePacketUploads(packet) {
  if (!packet || !Array.isArray(packet.pages)) return;

  const uploadPaths = new Set();

  packet.pages.forEach(page => {
    [
      page.beforeImagePath,
      page.afterImagePath,
      page.devScreenshotPath,
      page.liveScreenshotPath
    ].forEach(filePath => {
      if (filePath) uploadPaths.add(filePath);
    });

    Object.values(page.devShots || {}).forEach(filePath => {
      if (filePath) uploadPaths.add(filePath);
    });

    Object.values(page.liveShots || {}).forEach(filePath => {
      if (filePath) uploadPaths.add(filePath);
    });

    Object.values(page.beforeShots || {}).forEach(filePath => {
      if (filePath) uploadPaths.add(filePath);
    });

    Object.values(page.afterShots || {}).forEach(filePath => {
      if (filePath) uploadPaths.add(filePath);
    });
  });

  uploadPaths.forEach(removeUploadFile);
}

app.get('/', (req, res) => {
  res.redirect('/admin');
});

app.get('/admin', async (req, res) => {
  if (!isAdmin(req)) {
    return res.render('login', { error: null });
  }

  const packets = await getPackets();
  res.render('admin', {
    packets,
    key: adminKey(req)
  });
});

app.post('/admin/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.render('login', { error: 'Wrong password.' });
  }

  res.redirect(`/admin?key=${encodeURIComponent(req.body.password)}`);
});

app.post('/admin/packets', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();

  const packet = {
    packetId: makeId('packet'),
    shareToken: makeId('share'),
    title: req.body.title || 'Untitled Review Packet',
    published: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pages: []
  };

  packets.push(packet);
  await savePackets(packets);

  res.redirect(`/admin/packets/${packet.packetId}/edit?key=${encodeURIComponent(adminKey(req))}`);
});

app.get('/admin/packets/:packetId/edit', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);

  if (!packet) return res.status(404).send('Packet not found');

  res.render('edit-packet', {
    packet,
    key: adminKey(req)
  });
});


app.post('/admin/packets/:packetId/update', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  packet.title = req.body.title || 'Untitled Review Packet';
  packet.updatedAt = new Date().toISOString();

  await savePackets(packets);

  res.redirect(`/admin/packets/${packet.packetId}/edit?key=${encodeURIComponent(adminKey(req))}`);
});

app.post('/admin/packets/:packetId/pages/:pageId/update', upload.fields([
  { name: 'beforeImage', maxCount: 1 },
  { name: 'afterImage', maxCount: 1 },
  { name: 'devScreenshot', maxCount: 1 },
  { name: 'liveScreenshot', maxCount: 1 }
]), async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  const page = packet.pages.find(p => p.pageId === req.params.pageId);
  if (!page) return res.status(404).send('Page not found');

  page.title = req.body.title || page.title || 'Untitled Page';

  if ('instructions' in req.body) {
    page.instructions = req.body.instructions || '';
  }

  if (page.type === 'cover') {
    page.subtitle = req.body.subtitle || '';
    page.body = req.body.body || '';
  }

  if (page.type === 'imageCompare') {
    page.beforeLabel = req.body.beforeLabel || 'Before';
    page.afterLabel = req.body.afterLabel || 'After';

    const before = req.files?.beforeImage?.[0];
    const after = req.files?.afterImage?.[0];

    if (before) {
      removeUploadFile(page.beforeImagePath);
      page.beforeImagePath = uploadPath(before);
    }
    if (after) {
      removeUploadFile(page.afterImagePath);
      page.afterImagePath = uploadPath(after);
    }

    if (req.body.removeBeforeImage === 'true') {
      removeUploadFile(page.beforeImagePath);
      page.beforeImagePath = '';
    }
    if (req.body.removeAfterImage === 'true') {
      removeUploadFile(page.afterImagePath);
      page.afterImagePath = '';
    }
  }

  if (page.type === 'urlCompare') {
    page.devUrl = req.body.devUrl || '';
    page.liveUrl = req.body.liveUrl || '';
    page.screenSizes = ['desktop', 'laptop-15-6', 'laptop-14-5', 'laptop-13', 'mobile'];

    const devScreenshot = req.files?.devScreenshot?.[0];
    const liveScreenshot = req.files?.liveScreenshot?.[0];

    // A manual screenshot upload or removal replaces any auto captured shots,
    // so clear the per size captures to keep the review display consistent.
    if (devScreenshot) {
      removeUploadFile(page.devScreenshotPath);
      page.devScreenshotPath = uploadPath(devScreenshot);
      delete page.devShots;
    }
    if (liveScreenshot) {
      removeUploadFile(page.liveScreenshotPath);
      page.liveScreenshotPath = uploadPath(liveScreenshot);
      delete page.liveShots;
    }

    if (req.body.removeDevScreenshot === 'true') {
      removeUploadFile(page.devScreenshotPath);
      page.devScreenshotPath = '';
      delete page.devShots;
    }
    if (req.body.removeLiveScreenshot === 'true') {
      removeUploadFile(page.liveScreenshotPath);
      page.liveScreenshotPath = '';
      delete page.liveShots;
    }
  }

  page.updatedAt = new Date().toISOString();
  packet.updatedAt = new Date().toISOString();

  await savePackets(packets);

  res.redirect(`/admin/packets/${packet.packetId}/edit?key=${encodeURIComponent(adminKey(req))}`);
});


app.post('/admin/packets/:packetId/pages/:pageId/upload-shots', upload.fields(
  ['desktop', 'laptop-15-6', 'laptop-14-5', 'laptop-13', 'mobile'].flatMap(size => [
    { name: `devShot_${size}`, maxCount: 1 },
    { name: `liveShot_${size}`, maxCount: 1 },
    { name: `beforeShot_${size}`, maxCount: 1 },
    { name: `afterShot_${size}`, maxCount: 1 }
  ])
), async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  const page = packet.pages.find(p => p.pageId === req.params.pageId);
  if (!page) return res.status(404).send('Page not found');

  const sizes = ['desktop', 'laptop-15-6', 'laptop-14-5', 'laptop-13', 'mobile'];
  if (page.type === 'urlCompare') {
    page.devShots = page.devShots || {};
    page.liveShots = page.liveShots || {};

    sizes.forEach(size => {
      const dev = req.files?.[`devShot_${size}`]?.[0];
      const live = req.files?.[`liveShot_${size}`]?.[0];
      if (dev) {
        removeUploadFile(page.devShots[size]);
        page.devShots[size] = uploadPath(dev);
      }
      if (live) {
        removeUploadFile(page.liveShots[size]);
        page.liveShots[size] = uploadPath(live);
      }
      if (req.body[`removeDevShot_${size}`] === 'true') {
        removeUploadFile(page.devShots[size]);
        delete page.devShots[size];
      }
      if (req.body[`removeLiveShot_${size}`] === 'true') {
        removeUploadFile(page.liveShots[size]);
        delete page.liveShots[size];
      }
    });

    if (!Object.keys(page.devShots).length) delete page.devShots;
    if (!Object.keys(page.liveShots).length) delete page.liveShots;

    page.devScreenshotPath = (page.devShots && (page.devShots['laptop-15-6'] || page.devShots.desktop)) || '';
    page.liveScreenshotPath = (page.liveShots && (page.liveShots['laptop-15-6'] || page.liveShots.desktop)) || '';
  } else if (page.type === 'imageCompare') {
    page.beforeShots = page.beforeShots || {};
    page.afterShots = page.afterShots || {};

    sizes.forEach(size => {
      const before = req.files?.[`beforeShot_${size}`]?.[0];
      const after = req.files?.[`afterShot_${size}`]?.[0];
      if (before) {
        removeUploadFile(page.beforeShots[size]);
        page.beforeShots[size] = uploadPath(before);
      }
      if (after) {
        removeUploadFile(page.afterShots[size]);
        page.afterShots[size] = uploadPath(after);
      }
      if (req.body[`removeBeforeShot_${size}`] === 'true') {
        removeUploadFile(page.beforeShots[size]);
        delete page.beforeShots[size];
      }
      if (req.body[`removeAfterShot_${size}`] === 'true') {
        removeUploadFile(page.afterShots[size]);
        delete page.afterShots[size];
      }
    });

    if (!Object.keys(page.beforeShots).length) delete page.beforeShots;
    if (!Object.keys(page.afterShots).length) delete page.afterShots;
  } else {
    return res.status(400).send('Per size uploads are only available for comparison pages.');
  }

  page.updatedAt = new Date().toISOString();
  packet.updatedAt = new Date().toISOString();

  await savePackets(packets);

  res.redirect(`/admin/packets/${packet.packetId}/edit?key=${encodeURIComponent(adminKey(req))}#page-${page.pageId}`);
});


app.post('/admin/packets/:packetId/pages/:pageId/capture', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  const page = packet.pages.find(p => p.pageId === req.params.pageId);
  if (!page) return res.status(404).send('Page not found');

  if (page.type !== 'urlCompare') {
    return res.status(400).send('Screenshot capture is only available for Dev vs Live pages.');
  }

  if (!page.devUrl && !page.liveUrl) {
    return res.status(400).send('Enter a Dev URL or Live URL before capturing screenshots.');
  }

  try {
    if (page.devUrl) {
      page.devShots = await captureUrlAllPresets(page.devUrl, 'dev');
      page.devScreenshotPath = page.devShots['laptop-15-6'] || page.devShots.desktop || '';
    }

    if (page.liveUrl) {
      page.liveShots = await captureUrlAllPresets(page.liveUrl, 'live');
      page.liveScreenshotPath = page.liveShots['laptop-15-6'] || page.liveShots.desktop || '';
    }

    page.capturedAt = new Date().toISOString();
    page.updatedAt = new Date().toISOString();
    packet.updatedAt = new Date().toISOString();

    await savePackets(packets);

    res.redirect(`/admin/packets/${packet.packetId}/edit?key=${encodeURIComponent(adminKey(req))}#page-${page.pageId}`);
  } catch (error) {
    console.error('Screenshot capture failed:', error.message);
    res.status(500).type('html').send(`
      <p>Screenshot capture failed: ${error.message.replace(/[<>&]/g, '')}</p>
      <p>Make sure the URLs load in a browser and that the headless browser system libraries are installed.</p>
      <p><a href="/admin/packets/${packet.packetId}/edit?key=${encodeURIComponent(adminKey(req))}#page-${page.pageId}">Back to edit</a></p>
    `);
  }
});

app.post('/admin/packets/:packetId/cover', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  packet.pages.push({
    pageId: makeId('page'),
    type: 'cover',
    title: req.body.title || 'Cover Page',
    subtitle: req.body.subtitle || '',
    body: req.body.body || '',
    order: packet.pages.length
  });

  packet.updatedAt = new Date().toISOString();
  await savePackets(packets);

  res.redirect(`/admin/packets/${packet.packetId}/edit?key=${encodeURIComponent(adminKey(req))}`);
});

app.post('/admin/packets/:packetId/image-compare', upload.fields([
  { name: 'beforeImage', maxCount: 1 },
  { name: 'afterImage', maxCount: 1 }
]), async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  const before = req.files?.beforeImage?.[0];
  const after = req.files?.afterImage?.[0];

  if (!before || !after) {
    return res.status(400).send('Please upload both before and after images.');
  }

  packet.pages.push({
    pageId: makeId('page'),
    type: 'imageCompare',
    title: req.body.title || 'Before and After',
    instructions: req.body.instructions || '',
    beforeLabel: req.body.beforeLabel || 'Before',
    afterLabel: req.body.afterLabel || 'After',
    beforeImagePath: uploadPath(before),
    afterImagePath: uploadPath(after),
    order: packet.pages.length
  });

  packet.updatedAt = new Date().toISOString();
  await savePackets(packets);

  res.redirect(`/admin/packets/${packet.packetId}/edit?key=${encodeURIComponent(adminKey(req))}`);
});

app.post('/admin/packets/:packetId/url-compare', upload.fields([
  { name: 'devScreenshot', maxCount: 1 },
  { name: 'liveScreenshot', maxCount: 1 }
]), async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  const devScreenshot = req.files?.devScreenshot?.[0];
  const liveScreenshot = req.files?.liveScreenshot?.[0];

  packet.pages.push({
    pageId: makeId('page'),
    type: 'urlCompare',
    title: req.body.title || 'Dev vs Live',
    instructions: req.body.instructions || '',
    devUrl: req.body.devUrl || '',
    liveUrl: req.body.liveUrl || '',
    devScreenshotPath: uploadPath(devScreenshot),
    liveScreenshotPath: uploadPath(liveScreenshot),
    screenSizes: ['desktop', 'laptop-15-6', 'laptop-14-5', 'laptop-13', 'mobile'],
    order: packet.pages.length
  });

  packet.updatedAt = new Date().toISOString();
  await savePackets(packets);

  res.redirect(`/admin/packets/${packet.packetId}/edit?key=${encodeURIComponent(adminKey(req))}`);
});

app.post('/admin/packets/:packetId/publish', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  packet.published = req.body.published === 'true';
  packet.updatedAt = new Date().toISOString();

  await savePackets(packets);
  res.redirect(`/admin/packets/${packet.packetId}/edit?key=${encodeURIComponent(adminKey(req))}`);
});


function parseCookies(req) {
  const header = req.headers.cookie || '';

  return header.split(';').reduce((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) return cookies;

    cookies[rawName] = decodeURIComponent(rawValue.join('=') || '');
    return cookies;
  }, {});
}

function reviewerCookieValue() {
  return crypto
    .createHash('sha256')
    .update(`${REVIEW_USERNAME}:${REVIEW_PASSWORD}:${ADMIN_PASSWORD}`)
    .digest('hex');
}

function isReviewer(req) {
  const cookies = parseCookies(req);
  return cookies.piie_reviewer === reviewerCookieValue();
}

function reviewerCookieHeader() {
  const parts = [
    `piie_reviewer=${encodeURIComponent(reviewerCookieValue())}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=604800'
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function requireReviewer(req, res, next) {
  if (isAdmin(req) || isReviewer(req)) {
    return next();
  }

  const nextUrl = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(`/review-login?next=${nextUrl}`);
}

function quickEditEnabled() {
  return Boolean(QUICK_EDIT_PASSWORD);
}

function quickEditCookieValue() {
  return crypto
    .createHash('sha256')
    .update(`quickedit:${QUICK_EDIT_PASSWORD}:${ADMIN_PASSWORD}`)
    .digest('hex');
}

function isQuickEditUnlocked(req) {
  if (!quickEditEnabled() || isAdmin(req)) return true;
  return parseCookies(req).piie_quickedit === quickEditCookieValue();
}

function quickEditCookieHeader() {
  // Session cookie (no Max-Age) so the unlock is remembered until the browser closes.
  const parts = [
    `piie_quickedit=${encodeURIComponent(quickEditCookieValue())}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/'
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

app.get('/review-login', (req, res) => {
  const nextUrl = req.query.next || '/';
  const safeNext = String(nextUrl).replaceAll('"', '&quot;');
  const error = req.query.error ? '<p class="error">Wrong reviewer username or password.</p>' : '';

  res.type('html').send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Reviewer Login</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #f5f7fa; margin: 0; padding: 32px; }
          main { max-width: 420px; margin: 10vh auto; background: #fff; border: 1px solid #d8dee6; border-radius: 12px; padding: 24px; }
          label { display: grid; gap: 6px; margin-bottom: 14px; font-weight: 700; }
          input { padding: 10px; border: 1px solid #d8dee6; border-radius: 8px; font: inherit; }
          button { padding: 10px 14px; border: 0; border-radius: 8px; background: #407ca7; color: #fff; font-weight: 800; cursor: pointer; }
          .error { color: #b91c1c; font-weight: 700; }
          .muted { color: #667085; }
        </style>
      </head>
      <body>
        <main>
          <h1>Reviewer Access</h1>
          <p class="muted">Enter the reviewer credentials to view this review packet.</p>
          ${error}

          <form method="post" action="/review-login">
            <input type="hidden" name="next" value="${safeNext}">

            <label>
              Username
              <input type="text" name="username" autocomplete="username" required>
            </label>

            <label>
              Password
              <input type="password" name="password" autocomplete="current-password" required>
            </label>

            <button type="submit">View Review</button>
          </form>
        </main>
      </body>
    </html>
  `);
});

app.post('/review-login', (req, res) => {
  const nextUrl = req.body.next || '/';

  if (req.body.username !== REVIEW_USERNAME || req.body.password !== REVIEW_PASSWORD) {
    return res.redirect(`/review-login?error=1&next=${encodeURIComponent(nextUrl)}`);
  }

  res.setHeader('Set-Cookie', reviewerCookieHeader());
  res.redirect(nextUrl);
});


app.get('/r/:shareToken', requireReviewer, async (req, res) => {
  const packets = await getPackets();
  const packet = packets.find(p => p.shareToken === req.params.shareToken && p.published);

  if (!packet) return res.status(404).send('Review packet not found or not published.');

  const responses = await getResponses();
  const packetResponses = responses.filter(r => r.packetId === packet.packetId);

  res.render('review', {
    packet,
    responses: packetResponses,
    isAdminView: isAdmin(req),
    adminKeyValue: isAdmin(req) ? adminKey(req) : '',
    quickEditGated: quickEditEnabled() && !isAdmin(req),
    quickEditUnlocked: isQuickEditUnlocked(req),
    quickEditError: Boolean(req.query.quickEditError)
  });
});

function humanScreenSize(size) {
  const labels = {
    desktop: 'Desktop',
    'laptop-15-6': '15.6 display',
    'laptop-14-5': '14.5 display',
    'laptop-13': '13 display',
    mobile: 'Mobile'
  };
  return labels[size] || size || 'General';
}

function humanStatus(status) {
  if (!status) return '';
  return status.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  return `"${text.replace(/"/g, '""')}"`;
}

// Shared page/status filtering for the notes view and download.
function filterNotes(list, query) {
  const pageId = query.page || '';
  const status = query.status || '';
  return list.filter(r => {
    if (pageId && r.pageId !== pageId) return false;
    if (status && (r.status || '') !== status) return false;
    return true;
  });
}

app.get('/r/:shareToken/notes', requireReviewer, async (req, res) => {
  const packets = await getPackets();
  const packet = packets.find(p => p.shareToken === req.params.shareToken && p.published);
  if (!packet) return res.status(404).send('Review packet not found or not published.');

  const responses = await getResponses();
  const packetResponses = filterNotes(
    responses.filter(r => r.packetId === packet.packetId),
    req.query
  ).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  res.render('notes', {
    packet,
    responses: packetResponses,
    humanScreenSize,
    humanStatus,
    filterPage: req.query.page || '',
    filterStatus: req.query.status || '',
    isAdminView: isAdmin(req),
    adminKeyValue: isAdmin(req) ? adminKey(req) : ''
  });
});

app.get('/r/:shareToken/notes/download', requireReviewer, async (req, res) => {
  const packets = await getPackets();
  const packet = packets.find(p => p.shareToken === req.params.shareToken && p.published);
  if (!packet) return res.status(404).send('Review packet not found or not published.');

  const responses = await getResponses();
  const packetResponses = filterNotes(
    responses.filter(r => r.packetId === packet.packetId),
    req.query
  ).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  const pageTitle = id => {
    const page = packet.pages.find(p => p.pageId === id);
    return page ? (page.title || 'Untitled page') : id;
  };

  const header = ['Page', 'Screen size', 'Reviewer', 'Status', 'Comment', 'Marked a spot', 'Date'];
  const rows = packetResponses.map(r => [
    pageTitle(r.pageId),
    humanScreenSize(r.screenSize),
    r.reviewerName || r.initials || '',
    humanStatus(r.status),
    r.comment || '',
    r.dotX && r.dotY ? 'Yes' : '',
    r.createdAt ? new Date(r.createdAt).toLocaleString() : ''
  ]);

  const csv = [header, ...rows]
    .map(cols => cols.map(csvCell).join(','))
    .join('\r\n');

  const safeName = (packet.title || 'review-notes')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'review-notes';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}-notes.csv"`);
  res.send('\ufeff' + csv);
});

app.post('/r/:shareToken/feedback', requireReviewer, async (req, res) => {
  const packets = await getPackets();
  const packet = packets.find(p => p.shareToken === req.params.shareToken && p.published);

  if (!packet) return res.status(404).send('Review packet not found or not published.');

  const responses = await getResponses();

  responses.push({
    responseId: makeId('response'),
    packetId: packet.packetId,
    pageId: req.body.pageId,
    screenSize: req.body.screenSize || '',
    reviewerName: req.body.reviewerName || req.body.initials || '',
    initials: req.body.initials || req.body.reviewerName || '',
    status: req.body.status || 'needs-review',
    comment: req.body.comment || '',
    dotX: req.body.dotX || '',
    dotY: req.body.dotY || '',
    createdAt: new Date().toISOString()
  });

  await saveResponses(responses);

  const hash = req.body.pageId ? `#${req.body.pageId}` : '';
  res.redirect(`/r/${packet.shareToken}${hash}`);
});

app.post('/r/:shareToken/clear-notes', async (req, res) => {
  // Admin only. Normal reviewers cannot clear notes.
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.shareToken === req.params.shareToken);
  if (!packet) return res.status(404).send('Review packet not found.');

  const pageId = req.body.pageId || '';
  if (!pageId) return res.status(400).send('A page is required to clear notes.');

  const screenSize = req.body.screenSize || '';
  const hasScreenFilter = 'screenSize' in req.body;

  const responses = await getResponses();

  const kept = responses.filter(response => {
    if (response.packetId !== packet.packetId) return true;
    if (response.pageId !== pageId) return true;
    if (hasScreenFilter && (response.screenSize || '') !== screenSize) return true;
    return false;
  });

  await saveResponses(kept);

  const hash = pageId ? `#${pageId}` : '';
  const keyPart = `?key=${encodeURIComponent(adminKey(req))}`;
  res.redirect(`/r/${packet.shareToken}${keyPart}${hash}`);
});

// Optional unlock step for quick edit. When QUICK_EDIT_PASSWORD is set, a
// reviewer must enter it once per browser session before they can save edits.
app.post('/r/:shareToken/quick-unlock', rateLimitQuickUpdate, requireReviewer, (req, res) => {
  const shareToken = req.params.shareToken;
  const pageId = (req.body.pageId || '').trim();
  const anchor = pageId ? `#${encodeURIComponent(pageId)}` : '';

  if (!quickEditEnabled() || (req.body.quickEditPassword || '') === QUICK_EDIT_PASSWORD) {
    if (quickEditEnabled()) res.setHeader('Set-Cookie', quickEditCookieHeader());
    return res.redirect(`/r/${shareToken}${anchor}`);
  }

  return res.redirect(`/r/${shareToken}?quickEditError=1${anchor}`);
});

// Quick edit from the review page itself. Reviewers (no admin key needed) can
// set Dev/Live URLs and drop in screenshots or before/after images. URLs are
// limited to http(s) so a javascript: URL cannot be stored and run later.
app.post('/r/:shareToken/quick-update', rateLimitQuickUpdate, requireReviewer, upload.fields([
  { name: 'beforeImage', maxCount: 1 },
  { name: 'afterImage', maxCount: 1 },
  { name: 'devScreenshot', maxCount: 1 },
  { name: 'liveScreenshot', maxCount: 1 }
]), async (req, res) => {
  const packets = await getPackets();
  const packet = packets.find(p => p.shareToken === req.params.shareToken && p.published);
  if (!packet) return res.status(404).send('Review packet not found or not published.');

  const page = packet.pages.find(p => p.pageId === req.body.pageId);
  if (!page) return res.status(404).send('Page not found');

  if (!isQuickEditUnlocked(req)) {
    const anchor = page.pageId ? `#${encodeURIComponent(page.pageId)}` : '';
    return res.redirect(`/r/${req.params.shareToken}?quickEditError=1${anchor}`);
  }

  const isHttpUrl = value => /^https?:\/\/\S+$/i.test((value || '').trim());

  if (page.type === 'urlCompare') {
    if ('devUrl' in req.body) {
      const value = (req.body.devUrl || '').trim();
      if (value === '' || isHttpUrl(value)) page.devUrl = value;
    }
    if ('liveUrl' in req.body) {
      const value = (req.body.liveUrl || '').trim();
      if (value === '' || isHttpUrl(value)) page.liveUrl = value;
    }

    const devScreenshot = req.files?.devScreenshot?.[0];
    const liveScreenshot = req.files?.liveScreenshot?.[0];
    if (devScreenshot) {
      page.devScreenshotPath = uploadPath(devScreenshot);
      delete page.devShots;
    }
    if (liveScreenshot) {
      page.liveScreenshotPath = uploadPath(liveScreenshot);
      delete page.liveShots;
    }
  }

  if (page.type === 'imageCompare') {
    const before = req.files?.beforeImage?.[0];
    const after = req.files?.afterImage?.[0];
    if (before) page.beforeImagePath = uploadPath(before);
    if (after) page.afterImagePath = uploadPath(after);
  }

  page.updatedAt = new Date().toISOString();
  packet.updatedAt = new Date().toISOString();
  await savePackets(packets);

  const keyPart = adminKey(req) ? `?key=${encodeURIComponent(adminKey(req))}` : '';
  res.redirect(`/r/${packet.shareToken}${keyPart}#${page.pageId}`);
});

app.get('/admin/packets/:packetId/results', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  const responses = await getResponses();
  const packetResponses = responses.filter(r => r.packetId === packet.packetId);

  res.render('results', {
    packet,
    responses: packetResponses,
    key: adminKey(req)
  });
});

app.post('/admin/packets/:packetId/clear-results', async (req, res) => {
  // Admin only. Clears every review note for this packet.
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  const responses = await getResponses();
  const kept = responses.filter(response => response.packetId !== packet.packetId);
  await saveResponses(kept);

  res.redirect(`/admin?key=${encodeURIComponent(adminKey(req))}`);
});

app.post('/admin/packets/:packetId/delete', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  removePacketUploads(packet);

  const keptPackets = packets.filter(p => p.packetId !== packet.packetId);
  await savePackets(keptPackets);

  const responses = await getResponses();
  const keptResponses = responses.filter(response => response.packetId !== packet.packetId);
  await saveResponses(keptResponses);

  res.redirect(`/admin?key=${encodeURIComponent(adminKey(req))}`);
});

app.get('/admin/packets/:packetId/export.json', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  const responses = await getResponses();
  const packetResponses = responses.filter(r => r.packetId === packet.packetId);

  res.json({
    packet,
    responses: packetResponses
  });
});

app.get('/admin/packets/:packetId/export.md', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();
  const packet = packets.find(p => p.packetId === req.params.packetId);
  if (!packet) return res.status(404).send('Packet not found');

  const responses = await getResponses();
  const packetResponses = responses.filter(r => r.packetId === packet.packetId);

  const statusLabels = {
    'approved': 'Approved',
    'approved-minor-changes': 'Approved after these changes',
    'approved-after-these-changes': 'Approved after these changes',
    'needs-design-changes': 'Needs design changes',
    'needs-content-changes': 'Needs content changes',
    'needs-mobile-review': 'Needs mobile review',
    'blocked-cannot-review': 'Blocked / cannot review',
    'not-approved': 'Not approved',
    'needs-review': 'Needs review'
  };

  const screenLabels = {
    desktop: 'Desktop',
    'laptop-15-6': '15.6 display',
    'laptop-14-5': '14.5 display',
    'laptop-13': '13 display',
    mobile: 'Mobile'
  };

  const lines = [];
  lines.push(`# Review feedback: ${packet.title}`);
  lines.push('');
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push('');

  packet.pages.forEach(page => {
    lines.push(`## ${page.title || 'Untitled page'}`);
    lines.push(`Page ID: ${page.pageId}`);
    lines.push('');

    const pageResponses = packetResponses.filter(r => r.pageId === page.pageId);

    if (!pageResponses.length) {
      lines.push('There are no notes for this page.');
      lines.push('');
      return;
    }

    pageResponses.forEach(response => {
      const reviewer = response.reviewerName || response.initials || 'Unknown';
      const status = statusLabels[response.status] || response.status || 'Needs review';
      const screen = response.screenSize ? (screenLabels[response.screenSize] || response.screenSize) : 'Not specified';
      lines.push(`- Screen size: ${screen}`);
      lines.push(`  - Status: ${status}`);
      lines.push(`  - Reviewer: ${reviewer}`);
      lines.push(`  - Comment: ${response.comment ? response.comment : 'No comment'}`);
      lines.push(`  - Created: ${response.createdAt || 'Unknown'}`);
      lines.push('');
    });
  });

  res.type('text/markdown').send(lines.join('\n'));
});

ensureDataFiles().then(() => {
  
// PIIE_WEB_REVIEWER_DEBUG_ROUTES
app.get('/healthz', async (req, res) => {
  res.json({
    ok: true,
    app: 'PIIE Web Reviewer',
    time: new Date().toISOString(),
    cwd: process.cwd(),
    node: process.version
  });
});

app.get('/admin/debug', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Forbidden');

  const packets = await getPackets();

  const routeList = [];
  app._router.stack.forEach(layer => {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
      routeList.push(`${methods} ${layer.route.path}`);
    }
  });

  res.type('html').send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>PIIE Web Reviewer Debug</title>
        <style>
          body { font-family: system-ui, sans-serif; margin: 24px; line-height: 1.45; }
          pre { background: #f6f7f9; padding: 12px; overflow: auto; border-radius: 8px; }
          code { background: #eef1f4; padding: 2px 5px; border-radius: 4px; }
          .ok { color: #15803d; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>PIIE Web Reviewer Debug</h1>
        <p class="ok">App is running.</p>

        <h2>Runtime</h2>
        <pre>${JSON.stringify({
          app: 'PIIE Web Reviewer',
          time: new Date().toISOString(),
          cwd: process.cwd(),
          node: process.version,
          env: process.env.NODE_ENV || 'not set',
          port: process.env.PORT || '3000',
          packetCount: packets.length
        }, null, 2)}</pre>

        <h2>Packets</h2>
        <pre>${JSON.stringify(packets.map(packet => ({
          packetId: packet.packetId,
          title: packet.title,
          published: packet.published,
          shareToken: packet.shareToken,
          pageCount: packet.pages?.length || 0,
          editUrl: `/admin/packets/${packet.packetId}/edit?key=${encodeURIComponent(adminKey(req))}`,
          reviewUrl: packet.shareToken ? `/r/${packet.shareToken}` : null
        })), null, 2)}</pre>

        <h2>Routes</h2>
        <pre>${routeList.join('\n')}</pre>

        <h2>Useful Checks</h2>
        <pre>GET  /healthz
GET  /admin/debug?key=change-me
GET  /admin?key=change-me
POST /admin/packets/:packetId/pages/:pageId/update?key=change-me</pre>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
    console.log(`PIIE Web Reviewer running at http://localhost:${PORT}`);
  });
});
