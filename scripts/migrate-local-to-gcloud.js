#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');

if (process.env.STORAGE_BACKEND !== 'google') {
  throw new Error('Set STORAGE_BACKEND=google before running this migration.');
}
if (process.env.MIGRATE_CONFIRM !== 'yes') {
  throw new Error('Set MIGRATE_CONFIRM=yes to confirm replacing the configured cloud collections.');
}

const { savePackets, saveResponses } = require('../storage');
const objectStorage = require('../object-storage');
const dataDir = path.join(__dirname, '..', 'data');

async function readJson(name) {
  const raw = await fs.readFile(path.join(dataDir, name), 'utf8');
  return JSON.parse(raw);
}

(async () => {
  const packets = await readJson('packets.json');
  const responses = await readJson('responses.json');
  await savePackets(packets);
  await saveResponses(responses);

  const uploadsDir = path.join(dataDir, 'uploads');
  const names = await fs.readdir(uploadsDir).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
  let uploaded = 0;
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const fullPath = path.join(uploadsDir, name);
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) continue;
    const buffer = await fs.readFile(fullPath);
    const ext = path.extname(name).toLowerCase();
    const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webp' ? 'image/webp'
        : ext === '.gif' ? 'image/gif' : 'image/png';
    await objectStorage.saveUploadBuffer(name, buffer, contentType);
    uploaded += 1;
  }

  console.log(`Migrated ${packets.length} packets, ${responses.length} notes, and ${uploaded} uploads.`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
