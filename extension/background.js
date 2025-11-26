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

// Check if URL is a valid EUR-Lex page (legal-content or eli/reg)
function isValidPage(url) {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  return urlLower.includes('eur-lex.europa.eu/legal-content/') || 
         urlLower.includes('eur-lex.europa.eu/eli/reg');
}

// Update icon state based on whether the page is valid
async function updateIconState(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isValidPage(tab.url)) {
      // Enable icon - use colored icons
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          16: 'icon16.png',
          48: 'icon48.png',
          128: 'icon128.png'
        }
      });
      chrome.action.setBadgeText({ tabId: tabId, text: '' });
      chrome.action.setTitle({ 
        tabId: tabId, 
        title: 'EUR-Lex Visualiser - Click to capture and visualise this page' 
      });
    } else {
      // Disable icon - use greyscale icons (default)
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          16: 'icon16-grey.png',
          48: 'icon48-grey.png',
          128: 'icon128-grey.png'
        }
      });
      chrome.action.setBadgeText({ tabId: tabId, text: '' });
      chrome.action.setTitle({ 
        tabId: tabId, 
        title: 'EUR-Lex Visualiser - Navigate to a EUR-Lex legal-content page to use this extension' 
      });
    }
  } catch (error) {
    console.error('Error updating icon state:', error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('EUR-Lex Visualiser extension installed');
  // Ensure config is initialized
  chrome.storage.local.set({ eurlexConfig: config });
  // Initialize icons for all open tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        updateIconState(tab.id);
      }
    });
  });
});

// Update icon when tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateIconState(tabId);
  }
});

// Update icon when tab is activated
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateIconState(activeInfo.tabId);
});

// Clean up old stored HTML to free up storage space
async function cleanupOldStorage() {
  try {
    const allItems = await new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        resolve(items || {});
      });
    });
    
    // Find all HTML storage keys
    const htmlKeys = Object.keys(allItems).filter(key => 
      key.startsWith('eurlex_html_') && !key.endsWith('_url')
    );
    
    // If we have more than 100 stored pages, remove the oldest ones
    // (Keep the 100 most recent based on storage order)
    // Note: With unlimitedStorage permission, we can store more, but still clean up old entries
    if (htmlKeys.length > 100) {
      const keysToRemove = htmlKeys.slice(0, htmlKeys.length - 100);
      const removePromises = keysToRemove.map(key => {
        return new Promise((resolve) => {
          chrome.storage.local.remove([key, `${key}_url`], resolve);
        });
      });
      
      await Promise.all(removePromises);
      console.log(`Cleaned up ${keysToRemove.length} old HTML entries`);
    }
  } catch (error) {
    console.error('Error cleaning up storage:', error);
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Icon clicked, tab URL:', tab.url);
  
  // Check if it's a valid EUR-Lex page (legal-content or eli/reg)
  const urlLower = tab.url ? tab.url.toLowerCase() : '';
  const isLegalContent = urlLower.includes('eur-lex.europa.eu/legal-content/');
  const isEliReg = urlLower.includes('eur-lex.europa.eu/eli/reg');
  
  if (!tab.url || (!isLegalContent && !isEliReg)) {
    console.log('Not a valid EUR-Lex page, ignoring click. URL:', tab.url);
    return;
  }
  
  console.log('Extension icon clicked on EUR-Lex page:', tab.url, 'Type:', isLegalContent ? 'legal-content' : 'eli/reg');
  
  try {
    // Capture HTML and title from the current tab
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Extract title from the page (has DOM access)
        let titleKey = 'untitled';
        try {
          const titleElement = document.querySelector('title');
          if (titleElement && titleElement.textContent) {
            const title = titleElement.textContent.trim();
            // Sanitize title for use as storage key
            titleKey = title.replace(/[^a-zA-Z0-9._-]/g, '_') || 'untitled';
          }
        } catch (e) {
          console.error('Error extracting title:', e);
        }
        
        return {
          html: document.documentElement.outerHTML,
          url: window.location.href,
          titleKey: titleKey
        };
      }
    });
    
    console.log('Script execution results:', results);
    
    if (results && results[0] && results[0].result) {
      const { html, url, titleKey } = results[0].result;
      
      // Create storage key from extracted title
      const storageKey = `eurlex_html_${titleKey}`;
      
      console.log('Extracted title key:', titleKey, 'Storage key:', storageKey);
      
      // Clean up old storage before storing new content
      await cleanupOldStorage();
      
      // Store HTML in extension storage
      await chrome.storage.local.set({
        [storageKey]: html,
        [`${storageKey}_url`]: url
      });
      
      console.log('HTML stored with key:', storageKey);
      
      // Open visualiser
      const visualiserUrl = await getExtensionUrl(storageKey);
      console.log('Opening visualiser URL:', visualiserUrl);
      chrome.tabs.create({ url: visualiserUrl });
    } else {
      console.error('No results from script execution');
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

