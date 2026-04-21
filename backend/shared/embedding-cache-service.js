const fs = require('fs');
const path = require('path');
const { gzip, gunzip } = require('zlib');
const { promisify } = require('util');

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * On-disk cache for derived recital maps.
 *
 * Stores gzip-compressed JSON alongside FMX and HTML caches in the same directory.
 * Each cache service only evicts its own file type.
 *
 * File naming: {CELEX}_{LANG}.recital-map.json.gz
 */
function createEmbeddingCacheService({ CACHE_DIR, STORAGE_LIMIT_MB }) {
  function cacheFileName(celex, lang) {
    return `${celex}_${lang}.recital-map.json.gz`;
  }

  function cachePath(celex, lang) {
    return path.join(CACHE_DIR, cacheFileName(celex, lang));
  }

  function getCacheFiles() {
    try {
      return fs
        .readdirSync(CACHE_DIR)
        .filter((filename) => filename.endsWith('.recital-map.json.gz'))
        .map((filename) => {
          const stat = fs.statSync(path.join(CACHE_DIR, filename));
          return { filename, path: path.join(CACHE_DIR, filename), size: stat.size, mtime: stat.mtime };
        })
        .sort((a, b) => a.mtime - b.mtime);
    } catch {
      return [];
    }
  }

  function getCacheSizeMB() {
    return getCacheFiles().reduce((sum, file) => sum + file.size, 0) / (1024 * 1024);
  }

  function evictOldestIfNeeded(requiredMB) {
    const currentMB = getCacheSizeMB();
    if (currentMB + requiredMB <= STORAGE_LIMIT_MB) {
      return { evicted: 0 };
    }

    const files = getCacheFiles();
    const targetMB = currentMB + requiredMB - STORAGE_LIMIT_MB;
    let freedMB = 0;
    let evicted = 0;

    for (const file of files) {
      if (freedMB >= targetMB) break;
      fs.unlinkSync(file.path);
      freedMB += file.size / (1024 * 1024);
      evicted += 1;
      console.log(`[EmbeddingCache] Evicted ${file.filename} (freed ${(file.size / 1024).toFixed(0)} KB)`);
    }

    return { evicted, freedMB: freedMB.toFixed(2) };
  }

  async function get(celex, lang) {
    const filePath = cachePath(celex, lang);
    try {
      const compressed = fs.readFileSync(filePath);
      const json = (await gunzipAsync(compressed)).toString('utf8');
      const payload = JSON.parse(json);
      const now = new Date();
      fs.utimesSync(filePath, now, now);
      console.log(`[EmbeddingCache] Hit: ${cacheFileName(celex, lang)}`);
      return payload;
    } catch {
      return null;
    }
  }

  async function put(celex, lang, value) {
    const serialized = JSON.stringify(value);
    const compressed = await gzipAsync(Buffer.from(serialized, 'utf8'));
    const requiredMB = compressed.length / (1024 * 1024);
    evictOldestIfNeeded(requiredMB);

    const filePath = cachePath(celex, lang);
    fs.writeFileSync(filePath, compressed);
    console.log(`[EmbeddingCache] Stored: ${cacheFileName(celex, lang)} (${(compressed.length / 1024).toFixed(1)} KB)`);
  }

  function remove(celex, lang) {
    const filePath = cachePath(celex, lang);
    try {
      fs.unlinkSync(filePath);
      console.log(`[EmbeddingCache] Removed: ${cacheFileName(celex, lang)}`);
      return true;
    } catch {
      return false;
    }
  }

  return { get, put, remove, getCacheSizeMB, evictOldestIfNeeded };
}

module.exports = { createEmbeddingCacheService };
