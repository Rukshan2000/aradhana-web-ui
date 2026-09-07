# syntax=docker/dockerfile:1
FROM node:22-slim AS base
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY knexfile.js ./
COPY migrations ./migrations
COPY scripts ./scripts
COPY src ./src

# Runs unprivileged; the image needs no write access to its own filesystem.
USER node

EXPOSE 4000
CMD ["node", "src/server.js"]
