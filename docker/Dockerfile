FROM node:23-bookworm-slim

USER root
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  curl \
  postgresql-client \
  gosu \
  && rm -rf /var/lib/apt/lists/*

USER node
WORKDIR /app/hieronymus
COPY --chown=node:node . .
COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
RUN npm install

USER root
RUN npx playwright install --with-deps

USER node
RUN npx playwright install
RUN npm run build
RUN npm run build-ssr
COPY --chown=node:node config/docker-config.json.sample ./config/config.json

USER root
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]