import { LAWS } from "../constants/laws.js";

/**
 * Get the law key from the current URL path
 * Expects format: /law/:key
 */
export const getLawKeyFromPath = (pathname) => {
  // Remove base path and extract law key
  const basePath = "";
  const pathWithoutBase = pathname.replace(basePath, "");
  const match = pathWithoutBase.match(/^\/law\/([^/]+)/);
  return match ? match[1] : null;
};

/**
 * Get the law path (file path) from a law key
 */
export const getLawPathFromKey = (key) => {
  if (!key) return "";
  const entry = LAWS.find(l => l.key === key);
  return entry ? entry.value : "";
};

