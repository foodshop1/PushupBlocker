// Load settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadBlockedSites();
  loadPushupCount();
  
  // Add event listeners
  document.getElementById('savePushupCount').addEventListener('click', savePushupCount);
  document.getElementById('addSite').addEventListener('click', addBlockedSite);
});

// Load and display blocked sites
function loadBlockedSites() {
  chrome.runtime.sendMessage({ action: "getBlockedSites" }, (response) => {
    const siteList = document.getElementById('siteList');
    siteList.innerHTML = '';
    
    response.blockedSites.forEach(site => {
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';
      
      const siteName = document.createElement('span');
      siteName.textContent = site;
      
      const removeButton = document.createElement('button');
      removeButton.className = 'remove-site';
      removeButton.textContent = 'X';
      removeButton.addEventListener('click', () => removeBlockedSite(site));
      
      siteItem.appendChild(siteName);
      siteItem.appendChild(removeButton);
      siteList.appendChild(siteItem);
    });
  });
}

// Load pushup count
function loadPushupCount() {
  chrome.runtime.sendMessage({ action: "getPushupCount" }, (response) => {
    document.getElementById('pushupCount').value = response.pushupCount;
  });
}

// Save pushup count
function savePushupCount() {
  const count = parseInt(document.getElementById('pushupCount').value);
  if (count > 0) {
    chrome.runtime.sendMessage({ 
      action: "updatePushupCount", 
      pushupCount: count 
    });
  }
}

// Add a new site to block
function addBlockedSite() {
  const newSite = document.getElementById('newSite').value.trim();
  if (newSite) {
    chrome.runtime.sendMessage({ action: "getBlockedSites" }, (response) => {
      const blockedSites = response.blockedSites;
      
      // Only add if not already in the list
      if (!blockedSites.includes(newSite)) {
        blockedSites.push(newSite);
        chrome.runtime.sendMessage({ 
          action: "updateBlockedSites", 
          blockedSites: blockedSites 
        }, () => {
          document.getElementById('newSite').value = '';
          loadBlockedSites();
        });
      }
    });
  }
}

// Remove a site from blocked list
function removeBlockedSite(site) {
  chrome.runtime.sendMessage({ action: "getBlockedSites" }, (response) => {
    const blockedSites = response.blockedSites.filter(s => s !== site);
    chrome.runtime.sendMessage({ 
      action: "updateBlockedSites", 
      blockedSites: blockedSites 
    }, () => {
      loadBlockedSites();
    });
  });
}