const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

const LOCAL_UPLOADS_DIR = path.join(__dirname, 'data', 'uploads');
const cloudEnabled = process.env.STORAGE_BACKEND === 'google';
const bucketName = process.env.GCS_BUCKET || '';
let bucket;

if (cloudEnabled && !bucketName) {
  throw new Error('GCS_BUCKET is required when STORAGE_BACKEND=google.');
}

function getBucket() {
  if (!cloudEnabled) return null;
  if (!bucket) bucket = new Storage().bucket(bucketName);
  return bucket;
}

function uploadPath(name) {
  return `/uploads/${path.basename(name)}`;
}

function uploadName(webPath) {
  if (!webPath || typeof webPath !== 'string' || !webPath.startsWith('/uploads/')) return '';
  return path.basename(webPath);
}

async function saveUploadBuffer(name, buffer, contentType = 'image/png') {
  const safeName = path.basename(name);
  if (cloudEnabled) {
    await getBucket().file(safeName).save(buffer, {
      resumable: false,
      metadata: { contentType, cacheControl: 'private, max-age=3600' }
    });
  } else {
    await fs.promises.mkdir(LOCAL_UPLOADS_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(LOCAL_UPLOADS_DIR, safeName), buffer);
  }
  return uploadPath(safeName);
}

async function deleteUpload(webPath) {
  const name = uploadName(webPath);
  if (!name) return;
  if (cloudEnabled) {
    await getBucket().file(name).delete({ ignoreNotFound: true });
  } else {
    await fs.promises.unlink(path.join(LOCAL_UPLOADS_DIR, name)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

function multerStorage(makeId) {
  if (!cloudEnabled) {
    const multer = require('multer');
    return multer.diskStorage({
      destination: LOCAL_UPLOADS_DIR,
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
        cb(null, `${makeId('upload')}${ext}`);
      }
    });
  }

  return {
    _handleFile(req, file, cb) {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
      const filename = `${makeId('upload')}${ext}`;
      const target = getBucket().file(filename);
      const stream = target.createWriteStream({
        resumable: false,
        metadata: { contentType: file.mimetype, cacheControl: 'private, max-age=3600' }
      });
      let size = 0;
      let settled = false;
      const done = (error, result) => {
        if (settled) return;
        settled = true;
        cb(error, result);
      };
      file.stream.on('data', chunk => { size += chunk.length; });
      stream.on('error', error => done(error));
      stream.on('finish', () => done(null, { filename, path: uploadPath(filename), size }));
      file.stream.pipe(stream);
    },
    _removeFile(req, file, cb) {
      deleteUpload(uploadPath(file.filename)).then(() => cb()).catch(cb);
    }
  };
}

async function serveUpload(name, res) {
  if (!cloudEnabled) return false;
  const safeName = path.basename(name);
  if (!safeName || safeName !== name) return false;
  const file = getBucket().file(safeName);
  const [exists] = await file.exists();
  if (!exists) return false;
  const [metadata] = await file.getMetadata();
  res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
  res.setHeader('Cache-Control', metadata.cacheControl || 'private, max-age=3600');
  file.createReadStream().on('error', error => {
    if (!res.headersSent) res.status(500).send('Could not read upload.');
    else res.destroy(error);
  }).pipe(res);
  return true;
}

module.exports = {
  LOCAL_UPLOADS_DIR,
  cloudEnabled,
  bucketName,
  uploadPath,
  saveUploadBuffer,
  deleteUpload,
  multerStorage,
  serveUpload
};
