FROM node:20-slim

# git is needed so opencode can clone/work with your repos inside the container
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install opencode globally
RUN npm install -g opencode-ai@latest

WORKDIR /workspace

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Railway injects PORT at runtime; opencode needs 0.0.0.0 so it's reachable from outside the container
CMD ["/entrypoint.sh"]
