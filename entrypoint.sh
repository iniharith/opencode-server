#!/bin/bash
set -e

CONFIG_DIR="$HOME/.config/opencode"
mkdir -p "$CONFIG_DIR"

if [ -z "$OPENCODE_ZEN_API_KEY" ]; then
  echo "WARNING: OPENCODE_ZEN_API_KEY is not set. Big Pickle / OpenCode Zen models will not work until you set it in Railway Variables."
fi

# Write opencode.json so the "opencode" (Zen) provider, including big-pickle, is available
cat > "$CONFIG_DIR/opencode.json" <<EOF
{
  "providers": {
    "opencode": {
      "apiKey": "${OPENCODE_ZEN_API_KEY:-}",
      "models": [
        {
          "id": "big-pickle",
          "name": "Big Pickle",
          "reasoning": true,
          "input": ["text"],
          "contextWindow": 200000,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
          "compat": { "supportsStore": false, "supportsDeveloperRole": false, "maxTokensField": "max_tokens" }
        }
      ],
      "api": "openai-completions",
      "baseUrl": "https://opencode.ai/zen/v1"
    }
  }
}
EOF

if [ -z "$APP_PASSWORD" ]; then
  echo "WARNING: APP_PASSWORD is not set. The gateway will reject all logins until it is configured in Railway Variables."
fi

# Clone your actual repos into /workspace so opencode has something to work on.
# Set GIT_REPOS in Railway Variables as a comma-separated list, e.g.:
#   https://github.com/iniharith/shop-co.git,https://github.com/iniharith/NothingLyrics.git
# For private repos, also set GITHUB_TOKEN (a GitHub Personal Access Token with repo read access).
mkdir -p /workspace
if [ -n "$GIT_REPOS" ]; then
  IFS=',' read -ra REPOS <<< "$GIT_REPOS"
  for repo in "${REPOS[@]}"; do
    repo_trimmed=$(echo "$repo" | xargs)
    [ -z "$repo_trimmed" ] && continue
    name=$(basename "$repo_trimmed" .git)
    target="/workspace/$name"
    if [ -d "$target/.git" ]; then
      echo "Updating $name..."
      git -C "$target" pull --ff-only || echo "WARNING: pull failed for $name, keeping existing copy"
    else
      echo "Cloning $name..."
      if [ -n "$GITHUB_TOKEN" ]; then
        auth_url=$(echo "$repo_trimmed" | sed "s#https://#https://${GITHUB_TOKEN}@#")
        git clone "$auth_url" "$target" || echo "WARNING: clone failed for $name"
      else
        git clone "$repo_trimmed" "$target" || echo "WARNING: clone failed for $name (private repo? set GITHUB_TOKEN)"
      fi
    fi
  done
else
  echo "NOTE: GIT_REPOS is not set — /workspace will stay empty. Set GIT_REPOS in Railway Variables to clone your projects in automatically."
fi

# opencode server itself stays private, reachable only inside the container
export OPENCODE_SERVER_USERNAME="${APP_USERNAME:-opencode}"
export OPENCODE_SERVER_PASSWORD="${APP_PASSWORD:-}"
cd /workspace
opencode serve --hostname 127.0.0.1 --port 4096 &
OPENCODE_PID=$!

# give opencode a moment to boot before the gateway starts proxying to it
sleep 2

# gateway is what's actually exposed publicly (Railway's $PORT)
cd /gateway
APP_USERNAME="${APP_USERNAME:-opencode}" \
APP_PASSWORD="$APP_PASSWORD" \
OPENCODE_INTERNAL_URL="http://127.0.0.1:4096" \
PORT="${PORT:-8080}" \
node server.js &
GATEWAY_PID=$!

wait -n "$OPENCODE_PID" "$GATEWAY_PID"
