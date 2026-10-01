// Service worker: the toolbar button opens a new tab (which is this extension's page).
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({});
});
