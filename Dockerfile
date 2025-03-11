FROM node:23-bookworm-slim
RUN apt-get update && apt-get install -y curl postgresql-client
USER node
WORKDIR /app/hieronymus
COPY --chown=node:node . .
RUN npm install
RUN npm run build-production
CMD ["./bin/docker-www"]
