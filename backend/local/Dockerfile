FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY backend/worker.js ./worker.js
COPY backend/local ./local
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=8787 MG_DATABASE_PATH=/app/data/marketing-genius.sqlite
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["node", "local/server.mjs"]
