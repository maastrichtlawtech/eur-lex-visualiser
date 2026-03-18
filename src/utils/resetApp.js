async function clearLocalBrowserData() {
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }

  try {
    window.sessionStorage.clear();
  } catch {
    // ignore
  }

  try {
    if (window.indexedDB) {
      window.indexedDB.deleteDatabase("formex-cache");
    }
  } catch {
    // ignore
  }

  try {
    if ("caches" in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
    }
  } catch {
    // ignore
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // ignore
  }
}

export async function resetWholeApp() {
  const confirmed = window.confirm(
    "This will remove local settings, cached law data, and offline app caches stored by LegalViz in this browser. Continue?"
  );

  if (!confirmed) return false;

  await clearLocalBrowserData();

  window.location.href = window.location.origin + window.location.pathname;
  return true;
}
