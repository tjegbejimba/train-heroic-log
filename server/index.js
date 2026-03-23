import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const PORT = process.env.PORT || 3001;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Valid storage keys (mirrors localStorage keys)
const VALID_KEYS = [
  'th_workouts',
  'th_schedule',
  'th_yt_links',
  'th_logs',
  'th_active',
  'th_templates',
];

function dataFile(key) {
  return path.join(DATA_DIR, `${key}.json`);
}

function readData(key) {
  const file = dataFile(key);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function writeData(key, value) {
  fs.writeFileSync(dataFile(key), JSON.stringify(value, null, 2), 'utf-8');
}

const app = express();
app.use(express.json({ limit: '50mb' }));

// CORS for dev (frontend on :5173, backend on :3001)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// GET /api/data/:key — read one key
app.get('/api/data/:key', (req, res) => {
  const { key } = req.params;
  if (!VALID_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Invalid key' });
  }
  const data = readData(key);
  res.json({ key, data, updatedAt: getUpdatedAt(key) });
});

// PUT /api/data/:key — write one key
app.put('/api/data/:key', (req, res) => {
  const { key } = req.params;
  if (!VALID_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Invalid key' });
  }
  writeData(key, req.body.data);
  res.json({ key, ok: true, updatedAt: new Date().toISOString() });
});

// DELETE /api/data/:key — delete one key
app.delete('/api/data/:key', (req, res) => {
  const { key } = req.params;
  if (!VALID_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Invalid key' });
  }
  const file = dataFile(key);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ key, ok: true });
});

// GET /api/data — read all keys at once (for initial sync)
app.get('/api/data', (req, res) => {
  const result = {};
  for (const key of VALID_KEYS) {
    result[key] = {
      data: readData(key),
      updatedAt: getUpdatedAt(key),
    };
  }
  res.json(result);
});

// PUT /api/data — write all keys at once (for full sync push)
app.put('/api/data', (req, res) => {
  const updates = req.body;
  for (const key of VALID_KEYS) {
    if (key in updates) {
      writeData(key, updates[key]);
    }
  }
  res.json({ ok: true, updatedAt: new Date().toISOString() });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

function getUpdatedAt(key) {
  const file = dataFile(key);
  if (!fs.existsSync(file)) return null;
  return fs.statSync(file).mtime.toISOString();
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TrainLog API running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
