#!/usr/bin/env node

/**
 * Bulk YouTube Link Importer
 *
 * Usage:
 *   1. Create a file called youtube-links.txt with one entry per line:
 *        Exercise Name | https://youtube.com/watch?v=...
 *
 *   2. Run: node scripts/import-youtube-links.js youtube-links.txt
 *
 *   This will push the links to your TrainLog API server.
 *   If the server isn't running, it outputs a JSON blob you can
 *   paste into browser DevTools console instead.
 *
 * Options:
 *   --server URL   API base URL (default: http://localhost:3080/api)
 *   --list         List all exercises from the server (helps you match names)
 *   --dry-run      Show what would be imported without saving
 */

import fs from 'fs';

const args = process.argv.slice(2);
const serverFlag = args.indexOf('--server');
const API_BASE = serverFlag !== -1 ? args[serverFlag + 1] : 'http://localhost:3080/api';
const dryRun = args.includes('--dry-run');
const listMode = args.includes('--list');
const inputFile = args.find((a) => !a.startsWith('--') && (serverFlag === -1 || a !== args[serverFlag + 1]));

async function fetchExerciseNames() {
  try {
    const res = await fetch(`${API_BASE}/data/th_workouts`);
    if (!res.ok) return null;
    const { data } = await res.json();
    if (!data) return [];
    const names = new Set();
    Object.values(data).forEach((workout) => {
      (workout.blocks || []).forEach((block) => {
        (block.exercises || []).forEach((ex) => names.add(ex.title));
      });
    });
    return [...names].sort();
  } catch {
    return null;
  }
}

async function fetchExistingLinks() {
  try {
    const res = await fetch(`${API_BASE}/data/th_yt_links`);
    if (!res.ok) return {};
    const { data } = await res.json();
    return data || {};
  } catch {
    return {};
  }
}

async function saveLinks(links) {
  const res = await fetch(`${API_BASE}/data/th_yt_links`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: links }),
  });
  return res.ok;
}

function parseInputFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const entries = [];

  content.split('\n').forEach((line, lineNum) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return; // skip empty/comments

    // Support both "Name | URL" and "Name, URL" formats
    const sep = line.includes('|') ? '|' : ',';
    const parts = line.split(sep).map((p) => p.trim());

    if (parts.length < 2) {
      console.warn(`Line ${lineNum + 1}: skipping (no separator found): ${line}`);
      return;
    }

    const [name, url] = parts;
    if (!url.startsWith('http')) {
      console.warn(`Line ${lineNum + 1}: skipping (invalid URL): ${url}`);
      return;
    }

    entries.push({ name, url });
  });

  return entries;
}

async function main() {
  // List mode: show all exercise names
  if (listMode) {
    console.log('Fetching exercise names from server...');
    const names = await fetchExerciseNames();
    if (names === null) {
      console.error(`Could not connect to server at ${API_BASE}`);
      console.error('Start the server or use --server URL');
      process.exit(1);
    }
    console.log(`\n${names.length} exercises:\n`);
    names.forEach((n) => console.log(`  ${n}`));
    console.log('\nCopy these names into your youtube-links.txt file.');
    return;
  }

  if (!inputFile) {
    console.log('Usage: node scripts/import-youtube-links.js <file.txt> [--dry-run] [--server URL]');
    console.log('       node scripts/import-youtube-links.js --list [--server URL]');
    console.log('\nFile format (one per line):');
    console.log('  Exercise Name | https://youtube.com/watch?v=...');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  const entries = parseInputFile(inputFile);
  console.log(`Parsed ${entries.length} entries from ${inputFile}`);

  if (entries.length === 0) {
    console.log('Nothing to import.');
    return;
  }

  // Validate against known exercises
  const knownNames = await fetchExerciseNames();
  if (knownNames !== null) {
    entries.forEach((e) => {
      if (!knownNames.includes(e.name)) {
        console.warn(`  Warning: "${e.name}" not found in workouts (will still save)`);
      }
    });
  }

  if (dryRun) {
    console.log('\nDry run — would import:');
    entries.forEach((e) => console.log(`  ${e.name} -> ${e.url}`));
    return;
  }

  // Try to push to server
  const existing = await fetchExistingLinks();
  const merged = { ...existing };
  entries.forEach((e) => {
    merged[e.name] = e.url;
  });

  const ok = await saveLinks(merged);
  if (ok) {
    console.log(`\nSaved ${entries.length} YouTube links to server!`);
  } else {
    // Fallback: output JSON for manual paste
    console.log('\nCould not reach server. Paste this into browser DevTools console:\n');
    console.log(`localStorage.setItem('th_yt_links', '${JSON.stringify(merged)}');`);
    console.log('\nThen reload the app.');
  }
}

main().catch(console.error);
