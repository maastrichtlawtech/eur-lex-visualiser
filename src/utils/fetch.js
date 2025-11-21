export const fetchText = async (path) => {
  // Use Vite's BASE_URL to handle base path correctly
  const baseUrl = import.meta.env.BASE_URL;
  // Remove leading slash from baseUrl if present, and ensure path doesn't have leading slash
  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const fullPath = `${cleanBase}/${cleanPath}`;
  
  const res = await fetch(fullPath);
  if (!res.ok) throw new Error(`Failed to load ${fullPath}: ${res.status}`);
  return await res.text();
};

