// Content script for LLM Wiki Web Clipper
// This script runs in the context of web pages and can be called
// by the popup to extract page content.

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractContent") {
    const content = extractContent();
    sendResponse(content);
  }
  return true;
});

function extractContent() {
  return {
    title: document.title,
    url: window.location.href,
    text: document.body.innerText,
  };
}
