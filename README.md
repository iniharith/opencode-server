# opencode-server

Always-on OpenCode server, deployed to Railway, separate from any other project (e.g. kampungcetak.com).
Runs `opencode serve` inside a container so you can connect from OpenCode Mobile anywhere — no need to keep your PC on.

## 1. Push this repo to GitHub

```powershell
cd opencode-server
git init
git add .
git commit -m "init opencode server"
git branch -M main
git remote add origin https://github.com/iniharith/opencode-server.git
git push -u origin main
```

(Create the empty repo `opencode-server` on GitHub first, under your account.)

## 2. Deploy on Railway

1. New Project > Deploy from GitHub repo > select `opencode-server`.
2. Railway detects the `Dockerfile` automatically and builds it.
3. Go to **Variables** and add:
   - `OPENCODE_SERVER_PASSWORD` — pick a strong password, this protects your server since it's public.
   - `OPENCODE_ZEN_API_KEY` — your OpenCode Zen API key (for the Big Pickle model). Get this from https://opencode.ai/zen after signing in and adding billing details (Big Pickle itself is free, but Zen still requires an account + API key).

   The container's `entrypoint.sh` writes this into `~/.config/opencode/opencode.json` automatically on startup, so `opencode/big-pickle` is available as soon as the service boots — no manual `/connect` step needed.
4. Go to **Settings > Networking > Generate Domain**. You'll get a URL like `https://opencode-server-production.up.railway.app`.

## 3. Test it

From your phone's browser:

```
https://<your-railway-domain>/global/health
```

Should return `{"healthy":true}`.

## 4. Connect from OpenCode Mobile

- Server URL: `https://<your-railway-domain>`
- Username/password: whatever you set as `OPENCODE_SERVER_PASSWORD` (and `OPENCODE_SERVER_USERNAME` if you set one).

## Notes

- This container starts with an empty `/workspace`. If you want opencode to work on your actual repos (shop-co, NothingLyrics, etc.), you'll need to either `git clone` them into the container (e.g. via a startup script with a `GITHUB_TOKEN` env var for private repos), or mount a persistent Railway volume so cloned repos survive restarts.
- Keep this project completely separate from your `shop-co` Railway project — don't add this service inside the same project as your production backend.
