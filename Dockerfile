FROM node:20-slim

# git is needed so opencode can clone/work with your repos inside the container
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates bash curl jq \
    && rm -rf /var/lib/apt/lists/*

# Install opencode globally
RUN npm install -g opencode-ai@latest

# Gateway (themed login + proxy) dependencies
WORKDIR /gateway
COPY gateway/package*.json ./
RUN npm ci --omit=dev
COPY gateway/ ./

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Railway injects PORT at runtime; the gateway binds to it and proxies internally to opencode
CMD ["/entrypoint.sh"]
