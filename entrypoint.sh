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

# The Open Project browser starts at $HOME and treats each direct child as a
# selectable project, so clone repositories directly below it.
PROJECTS_DIR="$HOME"

clone_or_pull() {
  url="$1"
  name=$(basename "$url" .git)
  target="$PROJECTS_DIR/$name"
  auth_header=()
  if [ -n "$GITHUB_TOKEN" ] && [[ "$url" == https://github.com/* ]]; then
    basic_auth=$(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 | tr -d '\n')
    auth_header=(-c "http.https://github.com/.extraheader=Authorization: basic $basic_auth")
  fi
  if [ -d "$target/.git" ]; then
    echo "Updating $name..."
    git "${auth_header[@]}" -C "$target" pull --ff-only || echo "WARNING: pull failed for $name, keeping existing copy"
  else
    echo "Cloning $name..."
    git "${auth_header[@]}" clone "$url" "$target" || echo "WARNING: clone failed for $name"
  fi
}

# Option A: discover repositories via GitHub. A token includes private repos
# the token can read; without one, discovery falls back to public repos.
if [ -n "$GITHUB_USERNAME" ]; then
  echo "Discovering repos for $GITHUB_USERNAME..."
  page=1
  while :; do
    if [ -n "$GITHUB_TOKEN" ]; then
      resp=$(curl -sf \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/user/repos?affiliation=owner&per_page=100&page=${page}" || echo "[]")
    else
      resp=$(curl -sf \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/users/${GITHUB_USERNAME}/repos?type=owner&per_page=100&page=${page}" || echo "[]")
    fi
    count=$(echo "$resp" | jq 'length' 2>/dev/null || echo 0)
    [ "$count" = "0" ] && break
    urls=$(echo "$resp" | jq -r --arg owner "${GITHUB_USERNAME,,}" '.[] | select((.owner.login | ascii_downcase) == $owner and .fork == false and .archived == false) | .clone_url')
    for url in $urls; do
      clone_or_pull "$url"
    done
    page=$((page + 1))
  done
fi

# Option B: explicit comma-separated repo list, e.g. for private repos or repos not owned by GITHUB_USERNAME.
# For private repos, also set GITHUB_TOKEN (a fine-grained token with Contents: Read-only access).
if [ -n "$GIT_REPOS" ]; then
  IFS=',' read -ra REPOS <<< "$GIT_REPOS"
  for repo in "${REPOS[@]}"; do
    repo_trimmed=$(echo "$repo" | xargs)
    [ -z "$repo_trimmed" ] && continue
    clone_or_pull "$repo_trimmed"
  done
fi

if [ -z "$GITHUB_USERNAME" ] && [ -z "$GIT_REPOS" ]; then
  echo "NOTE: neither GITHUB_USERNAME nor GIT_REPOS is set — no repositories will be cloned."
fi

# opencode server itself stays private, reachable only inside the container
export OPENCODE_SERVER_USERNAME="${APP_USERNAME:-opencode}"
export OPENCODE_SERVER_PASSWORD="${APP_PASSWORD:-}"
cd "$PROJECTS_DIR"
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
