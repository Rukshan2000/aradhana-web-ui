# syntax=docker/dockerfile:1

# Vite inlines VITE_* variables into the bundle at build time, so these are
# build args, not runtime environment: changing either needs a rebuild.
FROM node:22-slim AS build
WORKDIR /app

ARG VITE_API_BASE=""
ARG VITE_SITE_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_SITE_BASE=$VITE_SITE_BASE

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
