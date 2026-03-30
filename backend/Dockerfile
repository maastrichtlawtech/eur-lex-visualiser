FROM node:24-slim

# Install Playwright's Chromium system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libx11-xcb1 \
    fonts-liberation \
    fonts-noto-color-emoji \
    unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Install Playwright Chromium browser binaries
RUN npx playwright install chromium

COPY . .

# Ensure cache directory exists (can be overridden with Railway volume mount via CACHE_DIR)
RUN mkdir -p law-cache

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
