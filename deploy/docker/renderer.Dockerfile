FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    TURBO_PREVIEW_PORT=4177 \
    TURBO_PREVIEW_HOST=0.0.0.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --chown=node:node scripts/ctv-ott-renderer.mjs ./scripts/ctv-ott-renderer.mjs
COPY --chown=node:node scripts/box-feedback-upload.mjs ./scripts/box-feedback-upload.mjs
COPY --chown=node:node preview ./preview

USER node
EXPOSE 4177
CMD ["node", "scripts/ctv-ott-renderer.mjs"]
