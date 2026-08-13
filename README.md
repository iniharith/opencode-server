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
   - `GITHUB_USERNAME` — set this to `iniharith` and it auto-discovers and clones all your public repos on startup.
   - `GITHUB_TOKEN` — optional but required for private repos. Use a fine-grained token restricted to the required repositories with **Contents: Read-only** permission.
   - `GIT_REPOS` — optional, comma-separated list of extra repo URLs to clone. Token authentication is applied automatically to GitHub HTTPS URLs.

   Internally, `opencode serve` runs privately on `127.0.0.1:4096` inside the container. A small gateway (`gateway/`) is the only thing actually exposed publicly — it proxies through to opencode, injecting the right auth automatically.
4. Go to **Settings > Networking > Generate Domain**. You'll get a URL like `https://opencode-server-production.up.railway.app`.

## 3. Test it

Open the domain in a normal browser — you'll see a themed login page (styled to match iniharith.github.io). Enter `APP_PASSWORD` to get in.

## 4. Connect from OpenCode Mobile

- Server URL: `https://<your-railway-domain>`
- Username: `APP_USERNAME` (default `opencode`)
- Password: `APP_PASSWORD`

The app talks to the API directly with Basic Auth, so it never sees the themed page — that only shows up when you open the link in a regular browser.

## 5. Edit Android Documents projects

1. On Android, compress the project folder as a `.zip` using Files by Google or your file manager.
2. Open `https://<your-railway-domain>/mobile-projects` in Chrome and sign in.
3. Enter a project name, choose the ZIP from **Documents** or **Downloads**, and tap **Upload & Extract**.
4. In OpenCode Mobile, open the project using the same project name.
5. After editing, return to `/mobile-projects` and tap **Download ZIP**.
6. Extract the downloaded ZIP back into Android Documents if needed.

Uploads default to 100 MB compressed, 500 MB extracted, and 10,000 files. You can change these with `MAX_PROJECT_UPLOAD_MB`, `MAX_PROJECT_EXTRACTED_MB`, and `MAX_PROJECT_FILES` Railway variables. Downloads omit `.git`, dependencies, build caches, ZIP files, and `.env` secrets.

## Notes

- Repos are cloned directly into `/root`, where OpenCode's **Open Project** browser starts, so every repository appears as an individual project. OpenCode limits the idle **Recent projects** group to five entries; search by repository name to find the rest.
- Repositories are pulled on every container restart. Railway containers do not persist disk between deploys unless you attach a volume. Add a Railway volume mounted at `/root` so uploaded Android projects, cloned repositories, and OpenCode state survive restarts.
- Keep this project completely separate from your `shop-co` Railway project — don't add this service inside the same project as your production backend.
