// Content script injected into visualiser pages
// This script reads HTML from extension storage via background script and makes it available to the page

(function() {
  'use strict';
  
  // Get storage key from URL
  const urlParams = new URLSearchParams(window.location.search);
  const storageKey = urlParams.get('key');
  const isExtension = urlParams.get('extension') === 'true';
  
  if (!isExtension || !storageKey) {
    return; // Not an extension request
  }
  
  console.log('Content script loaded, storage key:', storageKey);
  
  // Function to inject HTML into DOM as JSON
  const injectIntoDOM = (html, url) => {
    if (!html) {
      console.error('injectIntoDOM called with no HTML');
      return;
    }
    
    console.log('Injecting HTML into DOM as JSON, length:', html.length);
    
    // Remove any existing injection
    const existing = document.getElementById('eurlex-extension-html');
    if (existing) {
      existing.remove();
    }
    
    // Create a script tag with type="application/json" containing the HTML
    const script = document.createElement('script');
    script.id = 'eurlex-extension-html';
    script.type = 'application/json';
    script.setAttribute('data-storage-key', storageKey);
    if (url) {
      script.setAttribute('data-source-url', url);
    }
    script.textContent = html;
    
    // Inject into page
    (document.head || document.documentElement).appendChild(script);
    
    console.log('HTML injected into DOM');
  };
  
  // Get HTML from extension storage via background script
  const fetchHtml = () => {
    chrome.runtime.sendMessage(
      { action: 'getHtml', storageKey: storageKey },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error communicating with background script:', chrome.runtime.lastError);
          return;
        }
        
        if (response && response.html) {
          injectIntoDOM(response.html, response.url || '');
        } else if (response && response.error) {
          console.error('Background script error:', response.error);
        } else {
          console.warn('No HTML found in extension storage for key:', storageKey);
        }
      }
    );
  };
  
  // Try to fetch immediately
  fetchHtml();
  
  // Also set up a polling mechanism as backup
  let pollCount = 0;
  const pollInterval = setInterval(() => {
    pollCount++;
    if (pollCount > 50) {
      clearInterval(pollInterval);
    } else {
      // Retry fetching
      fetchHtml();
    }
  }, 200);
})();

