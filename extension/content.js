function showErrorNotification(message) {
  // Check if a banner already exists
  if (document.querySelector('#sidebase-error-banner')) {
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'sidebase-error-banner';
  banner.style.position = 'fixed';
  banner.style.top = '10px';
  banner.style.left = '50%';
  banner.style.transform = 'translateX(-50%)';
  banner.style.padding = '10px 20px';
  banner.style.background = '#D32F2F'; // A more material red
  banner.style.color = 'white';
  banner.style.zIndex = '2147483647'; // Max z-index
  banner.style.borderRadius = '8px';
  banner.style.fontFamily = 'Roboto, sans-serif'; // More modern font
  banner.style.fontSize = '14px';
  banner.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  banner.textContent = `Sidebase: ${message}`;

  const closeButton = document.createElement('span');
  closeButton.textContent = '✖';
  closeButton.style.marginLeft = '15px';
  closeButton.style.cursor = 'pointer';
  closeButton.onclick = () => banner.remove();
  banner.appendChild(closeButton);

  document.body.appendChild(banner);

  setTimeout(() => {
    if (banner) {
      banner.remove();
    }
  }, 7000); // 7 seconds
}

async function main() {
  console.log("Sidebase: Starting keyword extraction...");
  const pageText = document.body.innerText;

  if (!pageText || pageText.trim().length < 200) {
    console.log("Sidebase: Page content too short, skipping.");
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/extract-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: pageText }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Handle cases where body is not JSON
      const message = errorData.error || `The server responded with status ${response.status}`;
      throw new Error(message);
    }

    const keywords = await response.json();
    console.log("Sidebase: Extracted keywords:", keywords);

    if (!Array.isArray(keywords) || keywords.length === 0) {
      console.log("Sidebase: No keywords returned from API.");
      return;
    }

    const keywordsRegex = new RegExp(keywords.map(k => k.replace(/[.*+?^${}()|[\\]/g, '\\$&')).join('|'), 'gi');

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parentTag = node.parentNode.tagName.toUpperCase();
          if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'A'].includes(parentTag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.nodeValue.trim().length === 0) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
    );

    const nodesToProcess = [];
    let node;
    while ((node = walker.nextNode())) {
      if (keywordsRegex.test(node.nodeValue)) {
        nodesToProcess.push(node);
      }
    }

    // Get highlight color from storage, then process the nodes
    chrome.storage.sync.get('highlightColor', (data) => {
      const highlightColor = data.highlightColor || 'blue'; // Default to blue

      nodesToProcess.forEach(node => {
        if (!node.parentNode) {
          return; // Node was already replaced by a previous operation
        }

        const fragments = document.createDocumentFragment();
        let lastIndex = 0;
        let match;

        keywordsRegex.lastIndex = 0; // Reset regex state for each node

        while ((match = keywordsRegex.exec(node.nodeValue)) !== null) {
          if (match.index > lastIndex) {
            fragments.appendChild(document.createTextNode(node.nodeValue.substring(lastIndex, match.index)));
          }

          const keyword = match[0];
          const a = document.createElement('a');
          a.href = '#';
          a.textContent = keyword;
          a.style.color = highlightColor; // Use the fetched color
          a.style.cursor = 'pointer';
          a.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const originalKeyword = keywords.find(k => k.toLowerCase() === keyword.toLowerCase());
            chrome.runtime.sendMessage({ action: 'openSidebar', keyword: originalKeyword || keyword });
          };

          const tag = document.createElement("span");
          tag.textContent = " [Sidebase]";
          tag.style.color = "red";

          fragments.appendChild(a);
          fragments.appendChild(tag);

          lastIndex = match.index + keyword.length;
        }

        if (lastIndex < node.nodeValue.length) {
          fragments.appendChild(document.createTextNode(node.nodeValue.substring(lastIndex)));
        }

        if (fragments.childNodes.length > 0) {
          node.parentNode.replaceChild(fragments, node);
        }
      });
    });

  } catch (error) {
    console.error("Sidebase: Failed to process page:", error);
    showErrorNotification(error.message);
  }
}

// --- Main Execution ---
// Check the blacklist before running the script
chrome.storage.sync.get('blacklist', (data) => {
  const blacklist = data.blacklist || [];
  const currentHostname = window.location.hostname;

  if (blacklist.some(site => currentHostname.includes(site))) {
    console.log(`Sidebase: Skipping blacklisted site: ${currentHostname}`);
    return;
  }
  
  // Run the script on non-blacklisted sites
  window.addEventListener("load", () => setTimeout(main, 1000));
});
