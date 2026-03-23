# Deploying Updates to NAS

After making changes locally:

```bash
# 1. Build the frontend
npm run build

# 2. Sync dist to NAS (no container restart needed)
rsync -av dist/ user@nas-ip:/volume1/docker/trainlog/dist/
```

If you changed **server/** code (backend API):

```bash
# 1. Sync the full project
rsync -av --exclude node_modules --exclude .git --exclude server/data \
  . user@nas-ip:/volume1/docker/trainlog/

# 2. Rebuild and restart the API container on the NAS
ssh user@nas-ip "cd /volume1/docker/trainlog && docker compose up -d --build api"
```

## Quick reference

| What changed | What to do |
|---|---|
| Frontend only (src/, styles) | `npm run build` + rsync `dist/` |
| Backend only (server/) | rsync project + `docker compose up -d --build api` |
| Both | All of the above |
| docker-compose.yml or nginx.conf | rsync project + `docker compose up -d` |
