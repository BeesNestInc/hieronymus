FROM node:23-bookworm-slim

USER root
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  curl \
  postgresql-client \
  && rm -rf /var/lib/apt/lists/*

USER node
WORKDIR /app/hieronymus
COPY --chown=node:node . .
RUN npm install
RUN npm run build
RUN npm run build-ssr
COPY --chown=node:node config/docker-config.json.sample ./config/config.json
CMD ["./bin/docker-www"]
