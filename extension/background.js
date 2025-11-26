// Background service worker for the extension
// Handles storage retrieval for content scripts and opening tabs

// ============================================================================
// CONFIGURATION - TOGGLE BETWEEN LOCALHOST AND PRODUCTION
// ============================================================================
// Change USE_LOCALHOST below - that's it! All other files read from storage.
// Set to true for localhost, false for production
// ============================================================================

const USE_LOCALHOST = false;
const LOCALHOST_URL = 'http://localhost:5173/eur-lex-visualiser';
const PRODUCTION_URL = 'https://maastrichtlawtech.github.io/eur-lex-visualiser';

const config = {
  useLocalhost: USE_LOCALHOST,
  baseUrl: USE_LOCALHOST ? LOCALHOST_URL : PRODUCTION_URL,
  localhostUrl: LOCALHOST_URL,
  productionUrl: PRODUCTION_URL
};

// Initialize config in storage
chrome.storage.local.set({ eurlexConfig: config }, () => {
  console.log('Config initialized:', config);
});

// Helper to get config from storage
async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['eurlexConfig'], (result) => {
      resolve(result.eurlexConfig || config);
    });
  });
}

async function getExtensionUrl(storageKey) {
  const config = await getConfig();
  return `${config.baseUrl}/extension?extension=true&key=${encodeURIComponent(storageKey)}`;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('EUR-Lex Visualiser extension installed');
  // Ensure config is initialized
  chrome.storage.local.set({ eurlexConfig: config });
});

// Extract title from HTML and sanitize for use as storage key
function extractTitleKey(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const titleElement = doc.querySelector('title');
    if (titleElement && titleElement.textContent) {
      const title = titleElement.textContent.trim();
      const sanitized = title.replace(/[^a-zA-Z0-9._-]/g, '_');
      return sanitized || 'untitled';
    }
  } catch (e) {
    console.error('Error extracting title:', e);
  }
  return 'untitled';
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  // Only work on EUR-Lex pages
  if (!tab.url || !tab.url.includes('eur-lex.europa.eu')) {
    console.log('Not a EUR-Lex page, ignoring click');
    return;
  }
  
  console.log('Extension icon clicked on EUR-Lex page:', tab.url);
  
  try {
    // Capture HTML from the current tab
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return {
          html: document.documentElement.outerHTML,
          url: window.location.href
        };
      }
    });
    
    if (results && results[0] && results[0].result) {
      const { html, url } = results[0].result;
      
      // Extract title and create storage key
      const titleKey = extractTitleKey(html);
      const storageKey = `eurlex_html_${titleKey}`;
      
      // Store HTML in extension storage
      await chrome.storage.local.set({
        [storageKey]: html,
        [`${storageKey}_url`]: url
      });
      
      console.log('HTML stored with key:', storageKey);
      
      // Open visualiser
      const visualiserUrl = await getExtensionUrl(storageKey);
      chrome.tabs.create({ url: visualiserUrl });
    }
  } catch (error) {
    console.error('Error capturing page on icon click:', error);
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getHtml') {
    const storageKey = request.storageKey;
    chrome.storage.local.get([storageKey, `${storageKey}_url`], (result) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({
          html: result[storageKey] || null,
          url: result[`${storageKey}_url`] || ''
        });
      }
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'openLocalhost') {
    // Open visualiser in new tab
    chrome.tabs.create({ url: request.url }, (tab) => {
      console.log('Opened visualiser in tab:', tab.id);
      sendResponse({ success: true });
    });
    return true;
  }
});

