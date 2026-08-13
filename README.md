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
   - `APP_PASSWORD` — pick a strong password. This is the ONE password used both by OpenCode Mobile (as Basic Auth) and by the themed browser login page.
   - `APP_USERNAME` — optional, defaults to `opencode`.
   - `OPENCODE_ZEN_API_KEY` — your OpenCode Zen API key (for the Big Pickle model), from https://opencode.ai/zen.

   Internally, `opencode serve` runs privately on `127.0.0.1:4096` inside the container. A small gateway (`gateway/`) is the only thing actually exposed publicly — it proxies through to opencode, injecting the right auth automatically.
4. Go to **Settings > Networking > Generate Domain**. You'll get a URL like `https://opencode-server-production.up.railway.app`.

## 3. Test it

Open the domain in a normal browser — you'll see a themed login page (styled to match iniharith.github.io). Enter `APP_PASSWORD` to get in.

## 4. Connect from OpenCode Mobile

- Server URL: `https://<your-railway-domain>`
- Username: `APP_USERNAME` (default `opencode`)
- Password: `APP_PASSWORD`

The app talks to the API directly with Basic Auth, so it never sees the themed page — that only shows up when you open the link in a regular browser.

## Notes

- This container starts with an empty `/workspace`. If you want opencode to work on your actual repos (shop-co, NothingLyrics, etc.), you'll need to either `git clone` them into the container (e.g. via a startup script with a `GITHUB_TOKEN` env var for private repos), or mount a persistent Railway volume so cloned repos survive restarts.
- Keep this project completely separate from your `shop-co` Railway project — don't add this service inside the same project as your production backend.
