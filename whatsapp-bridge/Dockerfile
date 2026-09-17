FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation tini && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true CCA_CHROME_PATH=/usr/bin/chromium CCA_CONTAINER=1 CCA_BRIDGE_DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY *.mjs ./
RUN mkdir -p /data && chown node:node /data /app
USER node
VOLUME ["/data"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "index.mjs"]
