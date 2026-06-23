const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const PACKETS_FILE = path.join(DATA_DIR, 'packets.json');
const RESPONSES_FILE = path.join(DATA_DIR, 'responses.json');

async function ensureDataFiles() {
  await fs.mkdir(path.join(DATA_DIR, 'uploads'), { recursive: true });

  await ensureJsonFile(PACKETS_FILE, []);
  await ensureJsonFile(RESPONSES_FILE, []);
}

async function ensureJsonFile(filePath, fallbackValue) {
  try {
    await fs.access(filePath);
  } catch {
    await safeWriteJson(filePath, fallbackValue);
  }
}

async function readJson(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw || 'null') ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}

async function safeWriteJson(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2));
  await fs.rename(tempPath, filePath);
}

async function getPackets() {
  return readJson(PACKETS_FILE, []);
}

async function savePackets(packets) {
  return safeWriteJson(PACKETS_FILE, packets);
}

async function getResponses() {
  return readJson(RESPONSES_FILE, []);
}

async function saveResponses(responses) {
  return safeWriteJson(RESPONSES_FILE, responses);
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
  makeId
};
