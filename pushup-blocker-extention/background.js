// Default blocked sites
const DEFAULT_BLOCKED_SITES = [
    "youtube.com",
    "reddit.com",
    "facebook.com",
    "twitter.com",
    "instagram.com",
    "tiktok.com",
    "instagram.com"
  ];
  
  // Default pushup requirement
  const DEFAULT_PUSHUP_COUNT = 10;
  
  // Initialize storage with defaults if not set
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['blockedSites', 'pushupCount'], (result) => {
      if (!result.blockedSites) {
        chrome.storage.local.set({ blockedSites: DEFAULT_BLOCKED_SITES });
      }
      if (!result.pushupCount) {
        chrome.storage.local.set({ pushupCount: DEFAULT_PUSHUP_COUNT });
      }
      
      // Initialize unblockTimers as an empty object
      chrome.storage.local.set({ unblockTimers: {} });
    });
  });
  
  // Listen for web navigation and check if site is blocked
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0) { // Main frame only
      const url = new URL(details.url);
      const domain = url.hostname.replace('www.', '');
      
      chrome.storage.local.get(['blockedSites', 'unblockTimers'], (result) => {
        const blockedSites = result.blockedSites || [];
        const unblockTimers = result.unblockTimers || {};
        
        // Check if the site is blocked and not temporarily unblocked
        const isBlocked = blockedSites.some(site => domain.includes(site));
        const isUnblocked = unblockTimers[domain] && unblockTimers[domain] > Date.now();
        
        if (isBlocked && !isUnblocked) {
          // Redirect to blocked page
          chrome.tabs.update(details.tabId, {
            url: chrome.runtime.getURL("blocked.html") + "?site=" + domain
          });
        }
      });
    }
  });
  
  // Listen for messages from popup or blocked page
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getBlockedSites") {
      chrome.storage.local.get(['blockedSites'], (result) => {
        sendResponse({ blockedSites: result.blockedSites || [] });
      });
      return true; // Required for async response
    }
    
    if (request.action === "updateBlockedSites") {
      chrome.storage.local.set({ blockedSites: request.blockedSites });
      sendResponse({ success: true });
      return true;
    }
    
    if (request.action === "getPushupCount") {
      chrome.storage.local.get(['pushupCount'], (result) => {
        sendResponse({ pushupCount: result.pushupCount || DEFAULT_PUSHUP_COUNT });
      });
      return true;
    }
    
    if (request.action === "updatePushupCount") {
      chrome.storage.local.set({ pushupCount: request.pushupCount });
      sendResponse({ success: true });
      return true;
    }
    
    if (request.action === "temporarilyUnblock") {
      const domain = request.domain;
      const durationMs = request.duration || 30 * 60 * 1000; // Default: 30 minutes
      
      chrome.storage.local.get(['unblockTimers'], (result) => {
        const unblockTimers = result.unblockTimers || {};
        unblockTimers[domain] = Date.now() + durationMs;
        
        chrome.storage.local.set({ unblockTimers }, () => {
          sendResponse({ success: true });
          
          // Navigate to the unblocked site
          if (request.redirectUrl) {
            chrome.tabs.update(sender.tab.id, { url: request.redirectUrl });
          }
        });
      });
      return true;
    }
  });