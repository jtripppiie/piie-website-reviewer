# PIIE Web Reviewer container image.
# Works on Render, Railway, Fly.io, or any host that runs a Dockerfile.
FROM node:20-slim

# System libraries Chromium needs so Puppeteer can capture screenshots.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-liberation \
      libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so Docker can cache this layer.
# Puppeteer downloads its own Chromium during this step.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the app.
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
