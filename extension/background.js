/* global chrome */

const LOCALHOST_URL = 'http://localhost:5173';
const PRODUCTION_URL = 'https://legalviz.eu';
const COLOR_ICONS = {
  16: 'icon16.png',
  48: 'icon48.png',
  128: 'icon128.png',
};
const GREY_ICONS = {
  16: 'icon16-grey.png',
  48: 'icon48-grey.png',
  128: 'icon128-grey.png',
};

function isSupportedEurlexPage(urlString) {
  if (!urlString) return false;

  try {
    const url = new URL(urlString);
    if (url.hostname !== 'eur-lex.europa.eu') return false;

    return url.pathname.includes('/legal-content/') || url.pathname.includes('/eli/');
  } catch {
    return false;
  }
}

function padActNumber(value) {
  const trimmed = String(value || '').trim();
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  return trimmed.padStart(4, '0');
}

function extractCelexFromUrl(urlString) {
  if (!urlString) return null;

  try {
    const url = new URL(urlString);
    const uri = url.searchParams.get('uri') || '';
    const celexMatch = uri.match(/CELEX:(\d{5}[A-Z]\d{4})/i);
    if (celexMatch) {
      return celexMatch[1].toUpperCase();
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const eliIndex = segments.indexOf('eli');
    if (eliIndex === -1) return null;

    const actType = segments[eliIndex + 1];
    const year = segments[eliIndex + 2];
    const number = segments[eliIndex + 3];

    if (!/^\d{4}$/.test(year || '')) return null;

    const normalizedNumber = padActNumber(number);
    if (!normalizedNumber) return null;

    const typeMap = {
      reg: 'R',
      dir: 'L',
      dec: 'D',
    };

    const celexType = typeMap[actType];
    if (!celexType) return null;

    return `3${year}${celexType}${normalizedNumber}`;
  } catch {
    return null;
  }
}

async function detectBaseUrl() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);

    const response = await fetch(LOCALHOST_URL, {
      method: 'GET',
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (response?.ok) {
      const text = await response.text();
      if (text.includes('<title>LegalViz.EU</title>')) {
        return LOCALHOST_URL;
      }
    }
  } catch {
    // Ignore and fall back to production.
  }

  return PRODUCTION_URL;
}

async function openInLegalViz(tab) {
  const pageUrl = tab?.url || '';
  if (!isSupportedEurlexPage(pageUrl)) {
    return;
  }

  const celex = extractCelexFromUrl(pageUrl);
  if (!celex) {
    console.warn('Could not derive CELEX from EUR-Lex URL:', pageUrl);
    return;
  }

  const baseUrl = await detectBaseUrl();
  const targetUrl = new URL('/import', baseUrl);
  targetUrl.searchParams.set('celex', celex);

  chrome.tabs.create({ url: targetUrl.toString() });
}

async function updateIconState(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const supported = isSupportedEurlexPage(tab?.url || '');

    chrome.action.setIcon({
      tabId,
      path: supported ? COLOR_ICONS : GREY_ICONS,
    });

    chrome.action.setTitle({
      tabId,
      title: supported
        ? 'LegalViz.EU - Click to open this EUR-Lex law'
        : 'LegalViz.EU - Navigate to a supported EUR-Lex page to use this extension',
    });
  } catch (error) {
    console.error('Failed to update extension icon state:', error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('LegalViz.EU extension installed');

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id != null) {
        updateIconState(tab.id);
      }
    });
  });
});

chrome.action.onClicked.addListener((tab) => {
  openInLegalViz(tab).catch((error) => {
    console.error('Failed to open LegalViz import:', error);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url || tab?.url) {
    updateIconState(tabId);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  updateIconState(tabId);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action !== 'openImportFromPage') {
    return false;
  }

  openInLegalViz({
    url: request.url || sender.tab?.url || '',
  })
    .then(() => sendResponse({ success: true }))
    .catch((error) => {
      console.error('Failed to auto-open LegalViz import:', error);
      sendResponse({ success: false, error: String(error?.message || error) });
    });

  return true;
});
