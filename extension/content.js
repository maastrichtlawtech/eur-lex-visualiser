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
  
  // Extract title from HTML using smart parsing logic
  function smartExtractTitle(html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const getText = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
      
      // Helper to format title (cut after "of" and Title Case)
      const formatTitle = (t) => {
        if (!t) return "";
        // Cut after " of " (case insensitive)
        let short = t.split(/\s+of\s+/i)[0];
        
        // Convert to Title Case logic
        // 1. Lowercase everything
        // 2. Capitalize first letter of each word
        // 3. Fix specific acronyms like (EU), (EC)
        return short.toLowerCase()
          .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase())
          .replace(/\b(Eu|Ec|Eec|Euratom)\b/gi, (match) => match.toUpperCase());
      };

      // Extract title (first occurrence of title classes)
      const titleEl = doc.querySelector(".oj-doc-ti, .doc-ti, .title-doc-first");
      let mainTitle = "";
      if (titleEl) {
        mainTitle = formatTitle(getText(titleEl));
      }

      // Look for short title in parentheses (e.g. "Artificial Intelligence Act")
      let shortTitle = "";
      const docTitles = doc.querySelectorAll(".oj-doc-ti, .doc-ti");
      for (const el of docTitles) {
        const txt = getText(el);
        // Match pattern like "... (Artificial Intelligence Act)" at end of string
        const match = txt.match(/\(([^)]+)\)$/);
        if (match) {
          const candidate = match[1].trim();
          // Heuristic: Short titles are usually Capitalized Words, not "Text with EEA relevance"
          if (
            !candidate.toLowerCase().includes("text with eea relevance") &&
            !candidate.match(/^\d{4}\/\d+$/) && // not just a number
            candidate.length > 3 &&
            candidate.length < 100
          ) {
            // Found a likely short title -> prioritize it
            shortTitle = candidate;
            break; 
          }
        }
      }

      // Combine titles if both exist and are different
      let title = "";
      if (shortTitle && mainTitle && !mainTitle.includes(shortTitle)) {
        title = `${shortTitle} — ${mainTitle}`;
      } else {
        title = shortTitle || mainTitle;
      }
      
      // Fallback to <title> tag if no smart title found
      if (!title) {
        const t = doc.querySelector('title');
        if (t) title = t.textContent.trim();
      }

      return title || 'Untitled Law';
    } catch (e) {
      console.error('Error extracting smart title:', e);
      return 'Untitled Law';
    }
  }

  // Generate storage key from title
  function generateStorageKey(title) {
    const sanitized = title.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `eurlex_law_${sanitized}`;
  }
  
  // Wait for page to be fully loaded
  function captureAndOpen() {
    // Only work on legal-content pages
    if (!window.location.href.includes('eur-lex.europa.eu/legal-content/')) {
      console.log('Not a EUR-Lex legal-content page, skipping auto-capture');
      return;
    }

    // Only work on specific HTML view pages (must contain /TXT/HTML/)
    if (!window.location.href.includes('/TXT/HTML/')) {
      console.log('Not a EUR-Lex HTML view (missing /TXT/HTML/), skipping auto-capture');
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
      // Remove /HTML/ from URL to link to the main text view instead of the HTML view
      const url = window.location.href.replace(/\/TXT\/HTML\//, '/TXT/');
      
      console.log('Auto-capturing EUR-Lex page, URL:', url);
      
      // Extract title and create storage key
      const title = smartExtractTitle(html);
      const storageKey = generateStorageKey(title);
      
      // Clean up old storage before storing (request background script to do it)
      chrome.runtime.sendMessage({ action: 'cleanupStorage' }, () => {
        // Store HTML and metadata in extension storage
        const data = {
          html: html,
          metadata: {
            title: title,
            url: url,
            timestamp: Date.now()
          }
        };

        chrome.storage.local.set({
          [storageKey]: data
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error storing HTML:', chrome.runtime.lastError);
            return;
          }
          handleStorageSuccess(storageKey);
        });
      });
      
      function handleStorageSuccess(key) {
        console.log('Law stored with key:', key);
        
        // Open visualiser in new tab
        getExtensionUrl(key, (visualiserUrl) => {
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

