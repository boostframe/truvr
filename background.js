// background.js

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('Failed to set panel behavior:', error));
});


chrome.action.onClicked.addListener(async (tab) => {
  // Optionally, open the side panel directly with:
  chrome.sidePanel.open();  

});


function checkTabUrl(patterns) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
          const currentUrl = new URL(tabs[0].url);

          // Loop through each pattern to check for a match
          const isMatch = patterns.some((pattern) => {
              // Convert the wildcard pattern to a valid regex pattern
              const regexPattern = new RegExp(
                  pattern
                      .replace(/\*/g, '.*') // Convert '*' to '.*' for wildcard matching
                      .replace(/\//g, '\\/') // Escape forward slashes
              );

              // Check against href to include full URL
              return regexPattern.test(currentUrl.href);
          });

          if (isMatch) {
              console.log(`The current URL (${currentUrl.href}) matches one of the patterns.`);
              sendMessageToContentScript({ type: 'URL_NOW', url: currentUrl.href });
          } else {
              //console.log(`The current URL (${currentUrl.href}) does not match any pattern.`);
          }
      }
  });
}

// Use both patterns for checking
//checkTabUrl([
//  'https://.*\.amazon\.com/.*/dp/.*',  // First pattern
//  'https://amazon.com/dp/*'           // Second pattern
//]);


let messageSentTabs = new Set();

function sendMessageToContentScript(message) {
  chrome.runtime.sendMessage(message);
}

// Adds a listener to tab change
//chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//chrome.webNavigation.onHistoryStateUpdated.addListener((tabId, changeInfo, tab) => {
//  if (changeInfo.url && tab.active) {
      // Calls the check function on URL update
      //checkTabUrl('https://.*\.amazon\.com/.*/dp/.*');
      
//  }
//});
//chrome.webNavigation.onHistoryStateUpdated.addListener

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Busy wait loop
  }
}


chrome.webNavigation.onCompleted.addListener(function(details) {
  if(details.frameId === 0) {
      // Fires only when details.url === currentTab.url
      chrome.tabs.get(details.tabId, function(tab) {
          if(tab.url === details.url && tab.active) {
              console.log("onHistoryStateUpdated");
              checkTabUrl([
                'https://.*\.amazon\.com/.*/dp/.*',  // First pattern
                'https://.*\.amazon.com/dp/*'           // Second pattern
            ]);
          }
      });
      sleep(5000);
  }
});