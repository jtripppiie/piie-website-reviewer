const fs = require('fs/promises');
const path = require('path');
const { Firestore } = require('@google-cloud/firestore');

const DATA_DIR = path.join(__dirname, 'data');
const PACKETS_FILE = path.join(DATA_DIR, 'packets.json');
const RESPONSES_FILE = path.join(DATA_DIR, 'responses.json');
const cloudEnabled = process.env.STORAGE_BACKEND === 'google';
const collectionPrefix = process.env.FIRESTORE_COLLECTION_PREFIX || 'piie_reviewer';
let firestore;

function db() {
  if (!cloudEnabled) return null;
  if (!firestore) {
    const options = {};
    if (process.env.GOOGLE_CLOUD_PROJECT) options.projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (process.env.FIRESTORE_DATABASE) options.databaseId = process.env.FIRESTORE_DATABASE;
    firestore = new Firestore(options);
  }
  return firestore;
}

function collection(name) {
  return db().collection(`${collectionPrefix}_${name}`);
}

async function ensureDataFiles() {
  if (cloudEnabled) return;
  await fs.mkdir(path.join(DATA_DIR, 'uploads'), { recursive: true });

  await ensureJsonFile(PACKETS_FILE, []);
  await ensureJsonFile(RESPONSES_FILE, []);
}

async function getCloudCollection(name) {
  const snapshot = await collection(name).get();
  return snapshot.docs.map(doc => doc.data());
}

async function replaceCloudCollection(name, idField, values) {
  const target = collection(name);
  const existing = await target.get();
  const desired = new Map(values.map(value => {
    const id = String(value[idField] || '');
    if (!id) throw new Error(`Cannot store ${name} item without ${idField}.`);
    return [id, value];
  }));
  const current = new Map(existing.docs.map(doc => [doc.id, doc]));
  const writes = [];

  current.forEach((doc, id) => {
    if (!desired.has(id)) writes.push({ type: 'delete', ref: doc.ref });
  });
  desired.forEach((value, id) => {
    const oldValue = current.get(id)?.data();
    if (!oldValue || JSON.stringify(oldValue) !== JSON.stringify(value)) {
      writes.push({ type: 'set', ref: target.doc(id), value });
    }
  });

  for (let index = 0; index < writes.length; index += 450) {
    const batch = db().batch();
    writes.slice(index, index + 450).forEach(write => {
      if (write.type === 'delete') batch.delete(write.ref);
      else batch.set(write.ref, write.value);
    });
    await batch.commit();
  }
}

async function ensureJsonFile(filePath, fallbackValue) {
  try {
    await fs.access(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await safeWriteJson(filePath, fallbackValue);
  }
}

async function readJson(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw || 'null') ?? fallbackValue;
  } catch (error) {
    if (error.code === 'ENOENT') return fallbackValue;
    throw error;
  }
}

async function safeWriteJson(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2));
  await fs.rename(tempPath, filePath);
}

const updateQueues = new Map();

function queuedUpdate(filePath, fallbackValue, updater) {
  const previous = updateQueues.get(filePath) || Promise.resolve();

  const next = previous
    .catch(() => {})
    .then(async () => {
      const value = await readJson(filePath, fallbackValue);
      const updatedValue = await updater(value);
      await safeWriteJson(filePath, updatedValue == null ? value : updatedValue);
      return updatedValue == null ? value : updatedValue;
    });

  updateQueues.set(filePath, next);
  return next;
}

async function getPackets() {
  if (cloudEnabled) return getCloudCollection('packets');
  return readJson(PACKETS_FILE, []);
}

async function savePackets(packets) {
  if (cloudEnabled) return replaceCloudCollection('packets', 'packetId', packets);
  return safeWriteJson(PACKETS_FILE, packets);
}

async function getResponses() {
  if (cloudEnabled) return getCloudCollection('responses');
  return readJson(RESPONSES_FILE, []);
}

async function saveResponses(responses) {
  if (cloudEnabled) return replaceCloudCollection('responses', 'responseId', responses);
  return safeWriteJson(RESPONSES_FILE, responses);
}

async function updateResponses(updater) {
  if (cloudEnabled) {
    const current = await getResponses();
    const updated = await updater(current);
    const value = updated == null ? current : updated;
    await saveResponses(value);
    return value;
  }
  return queuedUpdate(RESPONSES_FILE, [], updater);
}

function makeId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  ensureDataFiles,
  getPackets,
  savePackets,
  getResponses,
  saveResponses,
  updateResponses,
  makeId,
  readJson,
  cloudEnabled
};
