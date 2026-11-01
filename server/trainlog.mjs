#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const help = `TrainLog coach CLI (Node 20+; Tailscale required for the NAS)

  trainlog context                    Synced exercises, plans and completed history
  trainlog guide                      Complete agent instructions and examples
  trainlog schema                     JSON Schema for plan files
  trainlog plan check <file|->         Validate and preview; no writes
  trainlog plan apply <file|->         Apply a revision-checked plan
  trainlog notes set <file|->          Explicit global form-note update
  trainlog conflicts                  Read unresolved app/coach conflicts

Use node trainlog.mjs in place of trainlog. JSON goes to stdout; failures are
JSON on stderr with exit code 1. Read context before writing; include its
revision as baseRevision. Never refresh that token without reviewing changes.
Set TRAINLOG_URL or --url to override https://tjnas.tail217062.ts.net:8443.
Use separately named workout versions; set replaceScheduled: true in a plan
to authorize replacements. Started/completed dates cannot be changed.
`;

try {
  const args = process.argv.slice(2);
  let base = process.env.TRAINLOG_URL || 'https://tjnas.tail217062.ts.net:8443';
  const urlIndex = args.indexOf('--url');
  if (urlIndex !== -1) {
    if (!args[urlIndex + 1]) throw new Error('--url requires a URL');
    base = args[urlIndex + 1];
    args.splice(urlIndex, 2);
  }
  if (!args.length || args[0] === '--help' || args[0] === 'help') {
    process.stdout.write(help);
  } else {
    let route;
    let input;
    if (args.length === 1 && ['context', 'schema', 'guide', 'conflicts'].includes(args[0])) {
      route = args[0] === 'conflicts' ? '/sync/conflicts' : `/coach/${args[0]}`;
    } else if (args.length === 3 && args[0] === 'plan' && ['check', 'apply'].includes(args[1])) {
      route = `/coach/plan/${args[1]}`;
      input = args[2];
    } else if (args.length === 3 && args[0] === 'notes' && args[1] === 'set') {
      route = '/coach/notes';
      input = args[2];
    } else {
      throw new Error('Unknown command or arguments; use --help');
    }
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use a plain HTTP(S) TrainLog URL without credentials, query or fragment');
    const apiBase = url.toString().replace(/\/$/, '').replace(/\/api$/, '') + '/api';
    const body = input ? JSON.parse(readFileSync(input === '-' ? 0 : input, 'utf8')) : undefined;
    const response = await fetch(`${apiBase}${route}`, {
      method: input ? 'POST' : 'GET',
      headers: { Accept: 'application/json', ...(input ? { 'Content-Type': 'application/json' } : {}) },
      ...(input ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { throw new Error(`TrainLog returned non-JSON (HTTP ${response.status}); verify the URL and deploy the coach interface`); }
    if (!response.ok || result.valid === false) {
      const error = new Error(result.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.details = result;
      throw error;
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.message, status: error.status, details: error.details })}\n`);
  process.exitCode = 1;
}
