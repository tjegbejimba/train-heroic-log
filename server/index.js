import express from 'express';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import webpush from 'web-push';
import cron from 'node-cron';
import { buildIssueTitle, buildGithubIssueBody } from './feedback.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const PORT = process.env.PORT || 3001;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// VAPID setup — keys auto-generated on first start, persisted to data dir
const VAPID_FILE    = path.join(DATA_DIR, 'vapid.json');
const SUBS_FILE     = path.join(DATA_DIR, 'push_subscriptions.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');

let vapidKeys;
if (fs.existsSync(VAPID_FILE)) {
  vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), 'utf-8');
  console.log('Generated new VAPID keys →', VAPID_FILE);
}
webpush.setVapidDetails('mailto:admin@trainlog.local', vapidKeys.publicKey, vapidKeys.privateKey);

function readSubscriptions() {
  if (!fs.existsSync(SUBS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8')); } catch { return []; }
}
function writeSubscriptions(subs) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf-8');
}

function readFeedback() {
  if (!fs.existsSync(FEEDBACK_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8')); } catch { return []; }
}

function postGithubIssue(token, owner, repo, issuePayload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(issuePayload);
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/issues`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'TrainLog-Server/1.0',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
        else reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// --- Workout reminder cron ---
const REMINDER_FILE = path.join(DATA_DIR, 'reminder_config.json');
let reminderTask = null;

function readReminderConfig() {
  if (!fs.existsSync(REMINDER_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(REMINDER_FILE, 'utf-8')); } catch { return null; }
}

async function sendWorkoutReminder() {
  const schedule = readData('th_schedule');
  if (!schedule) return;
  // Get today's date in the server's local time (cron already fires at the right wall-clock time)
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const workoutTitle = schedule[today];
  if (!workoutTitle) return;

  const subs = readSubscriptions();
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title: 'Workout today',
    body: workoutTitle,
    tag: 'workout-reminder',
  });

  const dead = [];
  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(sub, payload).catch((err) => {
        if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub.endpoint);
      })
    )
  );
  if (dead.length > 0) {
    writeSubscriptions(readSubscriptions().filter((s) => !dead.includes(s.endpoint)));
  }
  console.log(`Workout reminder sent: "${workoutTitle}" (${subs.length - dead.length} subscribers)`);
}

function scheduleReminder(config) {
  if (reminderTask) { reminderTask.stop(); reminderTask = null; }
  if (!config?.time) return;
  const [hour, minute] = config.time.split(':');
  reminderTask = cron.schedule(
    `${minute} ${hour} * * *`,
    sendWorkoutReminder,
    { timezone: config.timezone || 'UTC' }
  );
  console.log(`Workout reminder scheduled at ${config.time} (${config.timezone || 'UTC'})`);
}

// Start reminder on boot if config exists
const savedReminderConfig = readReminderConfig();
if (savedReminderConfig) scheduleReminder(savedReminderConfig);

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
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
  try {
    writeData(key, req.body.data);
    res.json({ key, ok: true, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error(`Failed to write ${key}:`, e);
    res.status(500).json({ error: 'Write failed', key });
  }
});

// DELETE /api/data/:key — delete one key
app.delete('/api/data/:key', (req, res) => {
  const { key } = req.params;
  if (!VALID_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Invalid key' });
  }
  try {
    const file = dataFile(key);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ key, ok: true });
  } catch (e) {
    console.error(`Failed to delete ${key}:`, e);
    res.status(500).json({ error: 'Delete failed', key });
  }
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
  const errors = [];
  for (const key of VALID_KEYS) {
    if (key in updates) {
      try {
        writeData(key, updates[key]);
      } catch (e) {
        console.error(`Failed to write ${key}:`, e);
        errors.push(key);
      }
    }
  }
  if (errors.length > 0) {
    return res.status(500).json({ ok: false, errors, updatedAt: new Date().toISOString() });
  }
  res.json({ ok: true, updatedAt: new Date().toISOString() });
});

// GET /api/push/vapid-public-key
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// POST /api/push/subscribe
app.post('/api/push/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  const subs = readSubscriptions();
  if (!subs.some((s) => s.endpoint === subscription.endpoint)) {
    subs.push(subscription);
    writeSubscriptions(subs);
  }
  res.json({ ok: true });
});

// POST /api/push/unsubscribe
app.post('/api/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  writeSubscriptions(readSubscriptions().filter((s) => s.endpoint !== endpoint));
  res.json({ ok: true });
});

// POST /api/push/notify — send to all subscribers (internal / future use)
app.post('/api/push/notify', async (req, res) => {
  const { title = 'TrainLog', body = '', data = {} } = req.body || {};
  const payload = JSON.stringify({ title, body, data });
  const subs = readSubscriptions();
  const dead = [];
  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(sub, payload).catch((err) => {
        if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub.endpoint);
      })
    )
  );
  if (dead.length > 0) {
    writeSubscriptions(readSubscriptions().filter((s) => !dead.includes(s.endpoint)));
  }
  res.json({ ok: true, sent: subs.length - dead.length, total: subs.length });
});

// POST /api/push/reminder-config — save reminder time and reschedule cron
app.post('/api/push/reminder-config', (req, res) => {
  const { time, timezone } = req.body || {};
  if (time === null || time === undefined) {
    if (reminderTask) { reminderTask.stop(); reminderTask = null; }
    if (fs.existsSync(REMINDER_FILE)) fs.unlinkSync(REMINDER_FILE);
    return res.json({ ok: true, scheduled: false });
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: 'Invalid time, expected HH:MM' });
  }
  const config = { time, timezone: timezone || 'UTC' };
  fs.writeFileSync(REMINDER_FILE, JSON.stringify(config, null, 2), 'utf-8');
  scheduleReminder(config);
  res.json({ ok: true, scheduled: true, time, timezone: config.timezone });
});

// Feedback — saves locally and optionally creates a GitHub issue
app.post('/api/feedback', async (req, res) => {
  const { title, category, description, meta = {}, snapshot } = req.body || {};
  if (!title || !category || !description)
    return res.status(400).json({ error: 'title, category, and description are required' });

  const timestamp = new Date().toISOString();
  const record = { title, category, description, meta, hasSnapshot: !!snapshot, timestamp };

  try {
    const existing = readFeedback();
    existing.push(record);
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(existing, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save feedback locally:', e);
    return res.status(500).json({ error: 'Failed to save feedback' });
  }

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO)
    return res.json({ saved: true, github: false });

  try {
    await postGithubIssue(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, {
      title: buildIssueTitle(category, title),
      body: buildGithubIssueBody(description, meta, snapshot, timestamp),
    });
    res.json({ success: true });
  } catch (e) {
    console.error('GitHub issue creation failed:', e.message);
    res.json({ saved: true, github: false, githubError: e.message });
  }
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
