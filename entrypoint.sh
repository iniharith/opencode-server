#!/bin/sh
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

exec opencode serve --hostname 0.0.0.0 --port "${PORT:-4096}"
