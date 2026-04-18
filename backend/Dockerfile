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

# Install Playwright Chromium browser binaries.
# IMPORTANT: pin the npx version to match the installed playwright-core in
# package.json. Bare `npx playwright install` does NOT find the local
# playwright-core package (only the full `playwright` package registers the
# `playwright` bin), so npx silently downloads the LATEST playwright from
# the registry and installs browser binaries for that version. At runtime,
# playwright-core@1.58.x looks for browser revision 1208 and crashes when
# only the newer revision is on disk.
#
# In Playwright 1.49+, headless: true defaults to the chromium-headless-shell
# variant (smaller, faster), which must be installed alongside full chromium.
RUN PW_VERSION=$(node -p "require('playwright-core/package.json').version") \
    && echo "Installing Playwright browsers for version $PW_VERSION" \
    && npx -y playwright@$PW_VERSION install chromium chromium-headless-shell

# Show what actually landed in the browser cache so future build logs reveal
# any path/variant changes without failing the build.
RUN ls -1 /root/.cache/ms-playwright/ || true

COPY . .

# Ensure cache directory exists (can be overridden with Railway volume mount via CACHE_DIR)
RUN mkdir -p law-cache

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
