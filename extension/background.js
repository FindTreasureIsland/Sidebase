chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === "openSidebar") {
    // 写入关键词到 storage
    chrome.storage.local.set({ currentKeyword: msg.keyword }, () => {
      console.log("关键词写入 storage:", msg.keyword);

      // 尝试打开 side panel
      if (chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ windowId: sender.tab.windowId });
      } else {
        // fallback: 弹窗
        chrome.windows.create({
          url: chrome.runtime.getURL("sidebar.html"),
          type: "popup",
          width: 400,
          height: 600,
        });
      }
    });
  }
});
