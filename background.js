// Background service worker for AI Tab Organizer
// Handles any background tasks if needed

chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Tab Organizer installed');
});

// Listen for messages from popup if needed for future features
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabs') {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      sendResponse({ tabs });
    });
    return true; // Keep message channel open for async response
  }
});
