// Content script for eur-lex.europa.eu pages
// Automatically captures HTML when page loads and opens localhost visualiser

(function() {
  'use strict';
  
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
      
      // Store HTML in extension storage
      chrome.storage.local.set({
        [storageKey]: html,
        [`${storageKey}_url`]: url
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error storing HTML:', chrome.runtime.lastError);
          return;
        }
        
        console.log('HTML stored with key:', storageKey);
        
        // Open localhost visualiser in new tab
        const localhostUrl = `http://localhost:5173/eur-lex-visualiser/extension?extension=true&key=${encodeURIComponent(storageKey)}`;
        chrome.runtime.sendMessage({
          action: 'openLocalhost',
          url: localhostUrl
        });
      });
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

