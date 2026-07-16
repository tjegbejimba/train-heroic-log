import { rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const visualIndex = args.indexOf('--visual');
const visualMode = visualIndex !== -1;

if (visualMode) {
  args.splice(visualIndex, 1);
  args.push('--grep', '@visual');
  rmSync(path.join(repoRoot, 'artifacts', 'visual'), { recursive: true, force: true });
}

async function findAvailablePort() {
  if (process.env.PLAYWRIGHT_PORT) return process.env.PLAYWRIGHT_PORT;

  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolve(String(address.port));
      });
    });
  });
}

const port = await findAvailablePort();
const playwrightBin = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'playwright.cmd' : 'playwright',
);

const child = spawn(playwrightBin, ['test', ...args], {
  cwd: repoRoot,
  env: {
    ...process.env,
    PLAYWRIGHT_PORT: port,
    VISUAL_EVIDENCE: visualMode ? '1' : process.env.VISUAL_EVIDENCE,
  },
  stdio: 'inherit',
  shell: false,
});

child.on('error', (error) => {
  console.error(`Unable to start Playwright: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Playwright exited after signal ${signal}`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
