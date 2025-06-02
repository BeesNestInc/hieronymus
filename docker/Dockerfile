# ========== build ==========
FROM node:23-bookworm-slim AS builder

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  curl \
  gosu \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

USER node
WORKDIR /app/hieronymus

COPY --chown=node:node . .

RUN npm install
RUN npm run build
RUN npm run build-ssr

# ========== runtime ==========
FROM node:23-bookworm-slim

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
  postgresql-client \
  gosu \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Playwright依存（Chromiumのみ）インストール
RUN npx playwright install chromium --with-deps

# アプリ実行ユーザーの設定
USER node
WORKDIR /app/hieronymus

# ビルド成果物のみコピー（node_modules含む）
COPY --from=builder --chown=node:node /app/hieronymus /app/hieronymus

RUN npx playwright install chromium

# エントリポイント
COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# config.jsonをコピー（必要に応じて）
COPY --chown=node:node config/docker-config.json.sample ./config/config.json

USER root
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]