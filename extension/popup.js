const captureBtn = document.getElementById('captureBtn');
const sendBtn = document.getElementById('sendBtn');
const statusDiv = document.getElementById('status');
const urlDisplay = document.getElementById('urlDisplay');

function showStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
}

function hideStatus() {
  statusDiv.style.display = 'none';
}

// Check if we have stored HTML
chrome.storage.local.get(['capturedHtml', 'capturedUrl'], (result) => {
  if (result.capturedHtml) {
    sendBtn.disabled = false;
    if (result.capturedUrl) {
      urlDisplay.textContent = result.capturedUrl;
      urlDisplay.style.display = 'block';
    }
    showStatus('HTML captured. Ready to send.', 'success');
  }
});

// Capture current page
captureBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url || (!tab.url.includes('eur-lex.europa.eu/legal-content/') && !tab.url.includes('eur-lex.europa.eu/eli/reg'))) {
      showStatus('Please navigate to a EUR-Lex page first.', 'error');
      return;
    }

    showStatus('Capturing page content...', 'info');
    
    // Inject script to capture HTML
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
      
      // Store in extension storage
      await chrome.storage.local.set({
        capturedHtml: html,
        capturedUrl: url
      });

      sendBtn.disabled = false;
      urlDisplay.textContent = url;
      urlDisplay.style.display = 'block';
      showStatus('Page captured successfully!', 'success');
    } else {
      showStatus('Failed to capture page content.', 'error');
    }
  } catch (error) {
    console.error('Capture error:', error);
    showStatus(`Error: ${error.message}`, 'error');
  }
});

// Extract title from HTML and sanitize for use as storage key
function extractTitleKey(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const titleElement = doc.querySelector('title');
    if (titleElement && titleElement.textContent) {
      // Use title as key, sanitize it (remove invalid characters for storage keys)
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

// Send to visualiser
sendBtn.addEventListener('click', async () => {
  try {
    const result = await chrome.storage.local.get(['capturedHtml', 'capturedUrl']);
    
    if (!result.capturedHtml) {
      showStatus('No captured HTML found. Please capture a page first.', 'error');
      return;
    }

    showStatus('Sending to visualiser...', 'info');
    
    // Generate storage key based on title from HTML
    const titleKey = extractTitleKey(result.capturedHtml);
    const storageKey = `eurlex_html_${titleKey}`;
    
    console.log('Storing HTML with key:', storageKey, 'Title:', titleKey, 'Length:', result.capturedHtml.length);
    
    // Store HTML with title-based key (will overwrite if same title)
    await chrome.storage.local.set({
      [storageKey]: result.capturedHtml,
      [`${storageKey}_url`]: result.capturedUrl || ''
    });
    
    // Verify storage
    chrome.storage.local.get([storageKey], (verify) => {
      if (verify[storageKey]) {
        console.log('HTML stored successfully, length:', verify[storageKey].length);
      } else {
        console.error('Failed to verify storage!');
      }
    });
    
    // Get config from storage and build URL
    chrome.storage.local.get(['eurlexConfig'], (result) => {
      const config = result.eurlexConfig || {
        baseUrl: 'https://maastrichtlawtech.github.io/eur-lex-visualiser'
      };
      const visualiserUrl = `${config.baseUrl}/extension?extension=true&key=${encodeURIComponent(storageKey)}`;
      
      console.log('Opening URL:', visualiserUrl);
      
      // Open in new tab
      chrome.tabs.create({ url: visualiserUrl }, () => {
        showStatus('Opening visualiser...', 'success');
        setTimeout(() => {
          window.close();
        }, 1000);
      });
    });
  } catch (error) {
    console.error('Send error:', error);
    showStatus(`Error: ${error.message}`, 'error');
  }
});

