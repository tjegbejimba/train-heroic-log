# Deploying TrainLog to the NAS

## Primary path: push to `main` (CI)

Every push to `main` runs `.github/workflows/deploy.yml` ("Deploy to NAS"). It:

1. Runs `npm ci`, installs Playwright Chromium, and runs `npm run test:ci` (unit + E2E).
2. Runs `npm run build`.
3. Joins the tailnet (`tag:ci`) and connects to the NAS over SSH (`tjegbejimba@100.104.13.117`).
4. `scp`s `docker-compose.yml` and `nginx.conf` into `/volume2/docker/trainlog/`.
5. Empties `/volume2/docker/trainlog/dist/` (`rm -rf dist/*`) and untars the new build into it.
6. Tars the repo's `server/` directory over the top of `/volume2/docker/trainlog/server/`.
7. Runs `sudo /usr/local/bin/docker compose up -d --build --force-recreate` in `/volume2/docker/trainlog`.

**Merging to `main` deploys to production.** If tests fail, nothing is deployed.

## What lives on the NAS

| Path / resource | Source | Notes |
|---|---|---|
| `/volume2/docker/trainlog/dist/` | CI build | Bind-mounted read-only into the `trainlog` nginx container |
| `/volume2/docker/trainlog/nginx.conf` | repo | Bind-mounted read-only as a single file |
| `/volume2/docker/trainlog/docker-compose.yml` | repo | |
| `/volume2/docker/trainlog/server/` | repo `server/` | Build context for the `trainlog-api` image |
| `/volume2/docker/trainlog/server/.env` | **NAS only** | Secrets. Not in git; never overwrite or delete it |
| Docker volume `trainlog-data` → `/app/data` | **NAS only** | All synced user data. Never remove it (`docker compose down -v` deletes it) |

Your local `server/data/` is dev-only data and must never be copied to the NAS.

## Node runtime

The API container runs the exact Node version pinned in `server/Dockerfile` (currently `node:24.22.1-alpine3.24`). The three workflows pin only the Node major (`node-version: 24`).

- Stay on a Node line that still receives security fixes. Node 24 gets them until 2028-04-30. See the [release schedule](https://nodejs.org/en/about/previous-releases).
- Keep the exact version in the Dockerfile. `docker compose up -d --build` does not pass `--pull`, so a floating tag such as `node:24-alpine` stays on whichever copy the NAS cached first and never picks up a patched release.
- When Node announces a security release, bump the Dockerfile to the patched version and push to `main`. The deploy rebuilds the image. The `trainlog-data` volume holds plain JSON, so a Node change does not touch the data.
- To roll back, revert the commit and push. The next deploy rebuilds on the previous version.

## Access

The `trainlog` container publishes `127.0.0.1:3080:80`: loopback only on the NAS. The app has no auth, so it is reached only through Tailscale Serve (tailnet only):

- App: `https://tjnas.tail217062.ts.net:8443` → `http://localhost:3080`
- Check: `tailscale serve status` on the NAS

Direct LAN access to `http://<nas-ip>:3080` is intentionally blocked.

## Manual fallback (CI unavailable)

Use this only when the workflow can't run. `tjnas` is an SSH alias for `tjegbejimba@100.104.13.117`.

Rules:

- Always run `rsync --dry-run` first and read the file list before the real run.
- Never use `--delete`.
- Never copy, overwrite, or delete `server/.env`, `server/data/`, `node_modules`, or the `trainlog-data` volume.
- Never rsync the whole project directory. Sync only the paths below.
- Bind-mounted paths (`dist/`, `nginx.conf`) must be replaced **in place**. Don't rename, move, or swap `dist/` or `nginx.conf` (no `mv dist dist.old`, no symlink swaps, no write-to-temp-then-rename). Docker binds the original inode, so a replaced file or directory leaves the container serving stale or missing content. Use `rsync --inplace` for `nginx.conf`, and update files inside `dist/` rather than replacing the directory.

### Frontend (`src/`, styles, `public/`)

```bash
npm run test:ci
npm run build

rsync -av --dry-run --exclude '.DS_Store' dist/ tjnas:/volume2/docker/trainlog/dist/
rsync -av          --exclude '.DS_Store' dist/ tjnas:/volume2/docker/trainlog/dist/
```

No container restart is needed; nginx serves the updated files. Without `--delete`, old hashed assets stay in `dist/`. They are harmless, and the next CI deploy clears them.

### Backend (`server/`)

```bash
SERVER_EXCLUDES=(--exclude node_modules --exclude data --exclude '.env' --exclude '.env.*' --exclude '.DS_Store')

rsync -av --dry-run "${SERVER_EXCLUDES[@]}" server/ tjnas:/volume2/docker/trainlog/server/
rsync -av          "${SERVER_EXCLUDES[@]}" server/ tjnas:/volume2/docker/trainlog/server/

ssh -t tjnas 'cd /volume2/docker/trainlog && sudo /usr/local/bin/docker compose up -d --build api'
```

### `docker-compose.yml` or `nginx.conf`

```bash
rsync -av --inplace --dry-run docker-compose.yml nginx.conf tjnas:/volume2/docker/trainlog/
rsync -av --inplace           docker-compose.yml nginx.conf tjnas:/volume2/docker/trainlog/

ssh -t tjnas 'cd /volume2/docker/trainlog && sudo /usr/local/bin/docker compose up -d --force-recreate'
```

### Verify

```bash
ssh tjnas 'sudo /usr/local/bin/docker ps --format "{{.Names}} {{.Status}} {{.Ports}}" | grep trainlog'
ssh tjnas 'curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3080/ && curl -s http://127.0.0.1:3080/api/health'
```

Expect `trainlog` on `127.0.0.1:3080->80/tcp`, HTTP `200`, and a healthy API response. Then open `https://tjnas.tail217062.ts.net:8443` from a tailnet device.

## Quick reference

| What changed | CI (default) | Manual fallback |
|---|---|---|
| Frontend only | push to `main` | build + rsync `dist/` |
| Backend (`server/`) | push to `main` | rsync `server/` (with excludes) + `docker compose up -d --build api` |
| `docker-compose.yml` / `nginx.conf` | push to `main` | `rsync --inplace` both + `docker compose up -d --force-recreate` |
