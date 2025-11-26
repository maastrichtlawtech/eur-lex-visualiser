// Content script for eur-lex.europa.eu pages
// Automatically captures HTML when page loads and opens visualiser

(function() {
  'use strict';
  
  // Helper to get config from storage
  function getConfig(callback) {
    chrome.storage.local.get(['eurlexConfig'], (result) => {
      const config = result.eurlexConfig || {
        useLocalhost: false,
        baseUrl: 'https://maastrichtlawtech.github.io/eur-lex-visualiser',
        localhostUrl: 'http://localhost:5173/eur-lex-visualiser',
        productionUrl: 'https://maastrichtlawtech.github.io/eur-lex-visualiser'
      };
      callback(config);
    });
  }
  
  function getExtensionUrl(storageKey, callback) {
    getConfig((config) => {
      const url = `${config.baseUrl}/extension?extension=true&key=${encodeURIComponent(storageKey)}`;
      callback(url);
    });
  }
  
  // Extract title from HTML and sanitize for use as storage key
  function extractTitleKey(html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const titleElement = doc.querySelector('title');
      if (titleElement && titleElement.textContent) {
        const title = titleElement.textContent.trim();
        // Replace any characters that might cause issues with a safe version
        const sanitized = title.replace(/[^a-zA-Z0-9._-]/g, '_');
        return sanitized || 'untitled';
      }
    } catch (e) {
      console.error('Error extracting title:', e);
    }
    return 'untitled';
  }
  
  // Wait for page to be fully loaded
  function captureAndOpen() {
    // Only work on legal-content pages
    if (!window.location.href.includes('eur-lex.europa.eu/legal-content/')) {
      console.log('Not a EUR-Lex legal-content page, skipping auto-capture');
      return;
    }
    
    // Check if page is fully loaded
    if (document.readyState !== 'complete') {
      window.addEventListener('load', captureAndOpen);
      return;
    }
    
    // Small delay to ensure all content is rendered
    setTimeout(() => {
      const html = document.documentElement.outerHTML;
      const url = window.location.href;
      
      console.log('Auto-capturing EUR-Lex page, URL:', url);
      
      // Extract title and create storage key
      const titleKey = extractTitleKey(html);
      const storageKey = `eurlex_html_${titleKey}`;
      
      // Clean up old storage before storing (request background script to do it)
      chrome.runtime.sendMessage({ action: 'cleanupStorage' }, () => {
        // Store HTML in extension storage
        chrome.storage.local.set({
          [storageKey]: html,
          [`${storageKey}_url`]: url
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error storing HTML:', chrome.runtime.lastError);
            return;
          }
          handleStorageSuccess();
        });
      });
      
      function handleStorageSuccess() {
        
        console.log('HTML stored with key:', storageKey);
        
        // Open visualiser in new tab
        getExtensionUrl(storageKey, (visualiserUrl) => {
          chrome.runtime.sendMessage({
            action: 'openLocalhost',
            url: visualiserUrl
          });
        });
      }
    }, 1000); // Wait 1 second after page load to ensure everything is ready
  }
  
  // Start capture process
  captureAndOpen();
  
  // Also listen for messages from popup (for manual capture if needed)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageHtml') {
      sendResponse({
        html: document.documentElement.outerHTML,
        url: window.location.href
      });
      return true; // Keep channel open for async response
    }
  });
})();

