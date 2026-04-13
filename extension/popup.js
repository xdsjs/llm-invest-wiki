// Load saved settings
chrome.storage.local.get(["wikiDir", "port"], (data) => {
  if (data.wikiDir) document.getElementById("wikiDir").value = data.wikiDir;
  if (data.port) document.getElementById("port").value = data.port;
});

// Get current tab info
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (tab) {
    document.getElementById("title").value = tab.title || "";
  }
});

document.getElementById("clipBtn").addEventListener("click", async () => {
  const btn = document.getElementById("clipBtn");
  const status = document.getElementById("status");
  const wikiDir = document.getElementById("wikiDir").value.trim();
  const port = document.getElementById("port").value.trim() || "19827";
  const title = document.getElementById("title").value.trim();
  const tags = document.getElementById("tags").value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const notes = document.getElementById("notes").value.trim();

  if (!wikiDir) {
    status.textContent = "Please set wiki directory path";
    status.className = "status error";
    return;
  }

  // Save settings
  chrome.storage.local.set({ wikiDir, port });

  btn.disabled = true;
  status.textContent = "Extracting page content...";
  status.className = "status";

  try {
    // Extract content from the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
    });

    const content = result.result;

    // Send to local clip server
    const response = await fetch(`http://localhost:${port}/clip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || content.title,
        url: tab.url,
        content: content.markdown,
        tags,
        notes,
        wikiDir,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      status.textContent = `✓ Clipped to ${data.path}`;
      status.className = "status success";
    } else {
      const error = await response.text();
      status.textContent = `Error: ${error}`;
      status.className = "status error";
    }
  } catch (err) {
    status.textContent = `Error: ${err.message}. Is the clip server running?`;
    status.className = "status error";
  } finally {
    btn.disabled = false;
  }
});

function extractPageContent() {
  // Simple content extraction using document properties
  const title = document.title;

  // Try to get main content
  const selectors = [
    "article",
    'main',
    '[role="main"]',
    ".post-content",
    ".article-content",
    ".entry-content",
    "#content",
  ];

  let contentEl = null;
  for (const selector of selectors) {
    contentEl = document.querySelector(selector);
    if (contentEl) break;
  }

  if (!contentEl) {
    contentEl = document.body;
  }

  // Convert to simplified markdown
  function nodeToMarkdown(node, depth = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.trim();
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();

    // Skip non-content elements
    if (["script", "style", "nav", "footer", "header", "aside", "form"].includes(tag)) {
      return "";
    }

    const children = Array.from(node.childNodes)
      .map((c) => nodeToMarkdown(c, depth))
      .filter(Boolean)
      .join("");

    switch (tag) {
      case "h1": return `\n# ${children}\n`;
      case "h2": return `\n## ${children}\n`;
      case "h3": return `\n### ${children}\n`;
      case "h4": return `\n#### ${children}\n`;
      case "h5": return `\n##### ${children}\n`;
      case "h6": return `\n###### ${children}\n`;
      case "p": return `\n${children}\n`;
      case "br": return "\n";
      case "strong":
      case "b": return `**${children}**`;
      case "em":
      case "i": return `*${children}*`;
      case "code": return `\`${children}\``;
      case "pre": return `\n\`\`\`\n${node.textContent}\n\`\`\`\n`;
      case "a": {
        const href = node.getAttribute("href");
        return href ? `[${children}](${href})` : children;
      }
      case "img": {
        const alt = node.getAttribute("alt") || "";
        const src = node.getAttribute("src") || "";
        return `![${alt}](${src})`;
      }
      case "li": return `- ${children}\n`;
      case "ul":
      case "ol": return `\n${children}`;
      case "blockquote": return `\n> ${children.replace(/\n/g, "\n> ")}\n`;
      case "hr": return "\n---\n";
      default: return children;
    }
  }

  const markdown = nodeToMarkdown(contentEl)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, markdown };
}
