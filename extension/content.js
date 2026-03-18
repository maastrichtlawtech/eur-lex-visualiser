/* global chrome */

(function () {
  'use strict';

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

  function hasCelex(urlString) {
    try {
      const url = new URL(urlString);
      const uri = url.searchParams.get('uri') || '';
      if (/CELEX:\d{5}[A-Z]\d{4}/i.test(uri)) {
        return true;
      }

      const segments = url.pathname.split('/').filter(Boolean);
      const eliIndex = segments.indexOf('eli');
      if (eliIndex === -1) return false;

      const actType = segments[eliIndex + 1];
      const year = segments[eliIndex + 2];
      const number = segments[eliIndex + 3];

      return ['reg', 'dir', 'dec'].includes(actType) &&
        /^\d{4}$/.test(year || '') &&
        /^\d{1,4}$/.test(number || '');
    } catch {
      return false;
    }
  }

  function isAutoOpenPage(urlString) {
    if (!urlString) return false;

    try {
      const url = new URL(urlString);
      return url.hostname === 'eur-lex.europa.eu' &&
        url.pathname.includes('/legal-content/') &&
        url.pathname.includes('/TXT/HTML/');
    } catch {
      return false;
    }
  }

  function shouldAutoOpen(urlString) {
    return isAutoOpenPage(urlString) && hasCelex(urlString);
  }

  function autoOpenIfNeeded() {
    const pageUrl = window.location.href;
    if (!shouldAutoOpen(pageUrl)) {
      return;
    }

    chrome.runtime.sendMessage({
      action: 'openImportFromPage',
      url: pageUrl,
    });
  }

  if (document.readyState === 'complete') {
    autoOpenIfNeeded();
  } else {
    window.addEventListener('load', autoOpenIfNeeded, { once: true });
  }
})();
