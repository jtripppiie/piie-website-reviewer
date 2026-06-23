require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');

const {
  ensureDataFiles,
  getPackets,
  savePackets,
  getResponses,
  saveResponses,
  makeId
} = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

  const before = req.files.beforeImage?.[0];
  const after = req.files.afterImage?.[0];

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

  const devScreenshot = req.files.devScreenshot?.[0];
  const liveScreenshot = req.files.liveScreenshot?.[0];

  packet.pages.push({
    pageId: makeId('page'),
    type: 'urlCompare',
    title: req.body.title || 'Dev vs Live',
    instructions: req.body.instructions || '',
    devUrl: req.body.devUrl || '',
    liveUrl: req.body.liveUrl || '',
    devScreenshotPath: uploadPath(devScreenshot),
    liveScreenshotPath: uploadPath(liveScreenshot),
    screenSizes: ['desktop', 'laptop', 'tablet', 'mobile'],
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

app.get('/r/:shareToken', async (req, res) => {
  const packets = await getPackets();
  const packet = packets.find(p => p.shareToken === req.params.shareToken && p.published);

  if (!packet) return res.status(404).send('Review packet not found or not published.');

  const responses = await getResponses();
  const packetResponses = responses.filter(r => r.packetId === packet.packetId);

  res.render('review', {
    packet,
    responses: packetResponses
  });
});

app.post('/r/:shareToken/feedback', async (req, res) => {
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

ensureDataFiles().then(() => {
  app.listen(PORT, () => {
    console.log(`Before After Design Review running at http://localhost:${PORT}`);
  });
});
