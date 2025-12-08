// Content script injected into visualiser pages
// Acts as a bridge between the web app and the extension background script
// Uses window.postMessage to communicate with the web app without direct DOM injection

(function() {
  'use strict';
  
  console.log('LegalViz.EU Bridge loaded');
  
  // Listen for messages from the web app
  window.addEventListener('message', (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) return;
    
    if (event.data.type && event.data.type.startsWith('EURLEX_')) {
      handleAppMessage(event.data);
    }
  });

  function handleAppMessage(data) {
    console.log('Bridge received message:', data.type);
    
    switch (data.type) {
      case 'EURLEX_GET_LAW':
        chrome.runtime.sendMessage(
          { action: 'getLaw', storageKey: data.key },
          (response) => {
            window.postMessage({
              type: 'EURLEX_LAW_DATA',
              payload: response || { error: 'No response from extension' }
            }, '*');
          }
        );
        break;
        
      case 'EURLEX_GET_LIST':
        chrome.runtime.sendMessage(
          { action: 'getLawList' },
          (response) => {
            window.postMessage({
              type: 'EURLEX_LAW_LIST',
              payload: response || { laws: [] }
            }, '*');
          }
        );
        break;
        
      case 'EURLEX_DELETE_LAW':
        chrome.runtime.sendMessage(
          { action: 'deleteLaw', storageKey: data.key },
          (response) => {
            window.postMessage({
              type: 'EURLEX_DELETE_SUCCESS',
              payload: { key: data.key, success: response?.success }
            }, '*');
          }
        );
        break;
    }
  }

  // Notify the app that the extension is ready
  // We do this after a small delay to ensure the app is initialized,
  // and we can also do it periodically or when requested if we had a handshake.
  // For now, let's just send a ready signal.
  setTimeout(() => {
    window.postMessage({ type: 'EURLEX_EXTENSION_READY' }, '*');
  }, 500);

})();
