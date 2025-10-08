window.addEventListener("load", () => {
  const contentDiv = document.getElementById("content");
  if (!contentDiv) {
    console.error("Could not find #content element");
    return;
  }

  if (typeof marked === 'undefined') {
    console.error("Error: marked.js is not loaded or defined.");
    contentDiv.innerText = "Request failed: Markdown rendering library not loaded.";
    return;
  }

  let eventSource = null; // To keep track of the current connection

  async function loadKeyword() {
    // Close any existing connection before starting a new one
    if (eventSource) {
      eventSource.close();
    }

    const { currentKeyword } = await chrome.storage.local.get("currentKeyword");

    if (!currentKeyword) {
      contentDiv.innerText = "Waiting for a keyword...";
      return;
    }

    // Initial UI setup
    contentDiv.innerHTML = `
      <p style="margin-bottom: 1rem;"><b>关键词:</b> ${currentKeyword}</p>
      <div id="summary-container"></div>
      <div id="sources-container" style="margin-top: 1rem;"></div>
    `;
    const summaryContainer = document.getElementById('summary-container');
    const sourcesContainer = document.getElementById('sources-container');
    summaryContainer.innerHTML = `<p style="opacity: 0.7;">加载中...</p>`;

    eventSource = new EventSource(`http://localhost:3000/api/search?q=${encodeURIComponent(currentKeyword)}`);

    let summaryText = '';
    let sourcesText = '';
    let inSourcesSection = false;

    // 1. Handle incoming tokens
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const token = data.token;

        if (inSourcesSection) {
          sourcesText += token;
        } else {
          if (summaryText.length === 0) { // On first token
            summaryContainer.innerHTML = ""; // Clear "Loading..."
          }
          summaryText += token;
        }

        // Check for separator and split content if necessary
        if (!inSourcesSection && summaryText.includes('---SOURCES---')) {
          inSourcesSection = true;
          const parts = summaryText.split('---SOURCES---');
          summaryText = parts[0];
          sourcesText = parts[1] || '';
          sourcesContainer.innerHTML = '<h3 style="font-size: 1rem; margin-bottom: 0.5rem;">相关资源</h3>';
        }

        // Re-render the appropriate container on each message
        if (inSourcesSection) {
          sourcesContainer.innerHTML = '<h3 style="font-size: 1rem; margin-bottom: 0.5rem;">相关资源</h3>' + marked.parse(sourcesText);
        } else {
          summaryContainer.innerHTML = marked.parse(summaryText);
        }
      } catch (e) {
        console.error("Failed to parse message or render content", e);
      }
    };

    // 2. Handle the end of the stream
    eventSource.addEventListener('end', (event) => {
      eventSource.close();
    });

    // 3. Handle errors sent from the server
    eventSource.addEventListener('error', (event) => {
      let errorMessage = "无法连接到服务器或发生流错误。";
      if (event.data) {
        try {
          const errorData = JSON.parse(event.data);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // The event data was not a valid JSON string
          console.error("Could not parse error event data:", event.data);
        }
      }
      console.error("EventSource error:", event);
      contentDiv.innerHTML = `
        <div style="padding: 10px; color: #D32F2F; background-color: #FFCDD2; border-radius: 8px;">
          <strong>请求失败</strong>
          <p style="margin-top: 5px; font-size: 12px;">${errorMessage}</p>
        </div>
      `;
      eventSource.close();
    });
  }

  // Initial load
  loadKeyword();

  // Listen for storage changes to reload content
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.currentKeyword) {
      loadKeyword();
    }
  });
});