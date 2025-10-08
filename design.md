# Sidebase 项目设计文档

## 1. 项目概述

Sidebase 是一个浏览器扩展应用，旨在增强用户的网页浏览体验。它通过**利用 Google Gemini 大模型**从当前页面提取关键词，并在用户点击这些关键词时，在侧边栏中展示**由 Gemini 模型生成**的相关搜索信息和总结。

项目主要由两部分构成：
- **Chrome 浏览器扩展**: 负责前端逻辑，包括页面内容分析、用户交互和信息展示。
- **Node.js 后端服务器**: 作为 Gemini API 的代理，提供 API 接口，根据前端发送的关键词或页面内容，调用 Gemini 模型进行分析和总结。

## 2. 核心功能

- **智能关键词提取与高亮**: 扩展将网页文本内容发送至后端，**由 Gemini 大模型分析并提取约 20 个最相关的关键词**。这些关键词在页面上被渲染为可点击的链接。
- **侧边栏智能搜索与总结**: 用户点击关键词后，扩展会拉起一个侧边栏（Side Panel），将关键词发送至后端。后端调用 **Gemini 大模型进行搜索和总结**，并将结果展示在侧边栏中。
- **Markdown 格式显示**: 侧边栏内容支持 Markdown 格式，提供更好的排版和阅读体验。
- **优雅降级**: 在用户的浏览器不支持侧边栏（Side Panel）API 的情况下，系统会自动降级，通过弹出窗口（Popup）来展示信息，确保核心功能可用。
- **实时更新**: 侧边栏内容会根据用户的点击实时更新，无需刷新页面。

## 3. 系统架构

系统分为前端浏览器扩展和后端 Gemini API 代理服务器两部分，架构清晰，职责分离。

### 3.1. 前端 (Chrome 扩展)

| 文件 | 类型 | 主要职责 |
| :--- | :--- | :--- |
| `manifest.json` | 配置文件 | 定义扩展的名称、版本、权限、背景脚本、内容脚本、侧边栏和**内容安全策略 (CSP)**。 |
| `content.js` | 内容脚本 | 注入到目标网页，负责将页面内容发送至后端获取关键词，并以健壮的方式将关键词渲染为可点击链接。 |
| `background.js` | 背景脚本 | 作为 Service Worker 运行，处理来自内容脚本的消息，管理侧边栏的打开，并负责在不同组件间传递数据。 |
| `sidebar.html` | 侧边栏 UI | 侧边栏的 HTML 结构，**包含 UTF-8 编码声明，并引入 `marked.min.js` 用于 Markdown 渲染**。 |
| `sidebar.js` | 侧边栏逻辑 | 负责获取关键词，向后端请求 Gemini 数据，**并使用 `marked.parse()` 将结果动态渲染到侧边栏中**。 |
| `styles.css` | 样式文件 | (在此项目中未提供) 定义侧边栏和页面高亮元素的样式。 |
| `marked.min.js` | 第三方库 | Markdown 解析库，用于将 Markdown 文本转换为 HTML。 |
| `prompts/` | 提示词目录 | 存放用于 Gemini API 调用的提示词文件。 |

### 3.2. 后端 (Node.js 服务器)

| 文件 | 类型 | 主要职责 |
| :--- | :--- | :--- |
| `server.js` | 应用主程序 | 基于 Express.js 构建的 **Gemini API 代理服务器**，负责接收前端请求，加载提示词，调用 Gemini API，并返回处理后的数据。 |
| `package.json` | 依赖配置 | 定义服务器所需的依赖，如 `express`、`cors` 和 **`@google/generative-ai`**。 |
| `prompts/` | 提示词目录 | 存放用于 Gemini API 调用的提示词文件。 |

#### API 端点

-   **`POST /api/extract-keywords`**
    -   **功能**: 接收网页文本内容，调用 Gemini 模型提取关键词。
    -   **请求体**: `{ "text": "网页的完整文本内容" }`
    -   **响应体**: `["关键词1", "关键词2", ...]` (JSON 数组)

-   **`POST /api/search`**
    -   **功能**: 接收关键词，调用 Gemini 模型进行搜索和总结。
    -   **请求体**: `{ "q": "要搜索的关键词" }`
    -   **响应体** (Markdown 格式的摘要和来源):
        ```json
        {
          "summary": "关于 '关键词' 的总结，支持 **Markdown** 格式。",
          "sources": [
            { "title": "来源标题 1", "url": "https://example.com/1" },
            { "title": "来源标题 2", "url": "https://example.com/2" }
          ]
        }
        ```

## 4. 数据流

整个工作流程从用户加载页面开始，到最终在侧边栏看到结果，形成一个完整的数据闭环。

```mermaid
graph TD;
    A[用户加载网页] --> B[1. content.js 获取页面文本];
    B --> C[2. content.js POST /api/extract-keywords (页面文本)];
    C --> D[3. server.js 加载 extract_keywords_prompt.txt];
    D --> E[4. server.js 调用 Gemini API (页面文本 + 关键词提取提示词)];
    E --> F[5. Gemini API 返回关键词];
    F --> G[6. server.js 返回关键词给 content.js];
    G --> H[7. content.js 将关键词渲染为可点击链接];
    H --> I[8. 用户点击关键词链接];
    I --> J[9. content.js 发送消息(action: 'openSidebar', keyword)给 background.js];
    J --> K[10. background.js 将关键词存入 chrome.storage.local];
    K --> L[11. background.js 打开侧边栏];
    L --> M[12. sidebar.js 从 storage 读取关键词];
    M --> N[13. sidebar.js POST /api/search (关键词)];
    N --> O[14. server.js 加载 sidebar_search_prompt.txt];
    O --> P[15. server.js 调用 Gemini API (关键词 + 搜索总结提示词)];
    P --> Q[16. Gemini API 返回总结和来源 (Markdown)];
    Q --> R[17. server.js 返回总结和来源给 sidebar.js];
    R --> S[18. sidebar.js 使用 marked.parse() 渲染数据并展示给用户];
```

## 5. 组件详细设计

### 5.1. `manifest.json`

-   **`permissions`**:
    -   `storage`: 允许扩展使用 `chrome.storage` API，用于在 content script, background script 和 sidebar 之间传递关键词。
    -   `activeTab` / `scripting`: 允许内容脚本在当前激活的标签页上运行。
    -   `sidePanel`: 允许使用 Side Panel API，是新一代的侧边栏标准。
-   **`content_security_policy`**: 明确声明了 `extension_pages` 的 CSP 为 `script-src 'self'; object-src 'self';`，确保扩展内部脚本（如 `marked.min.js`）能够加载。
-   **`background`**: 注册 `background.js` 为 Service Worker，使其能在后台处理事件。
-   **`content_scripts`**: 将 `content.js` 注入到所有 URL (`<all_urls>`) 的页面中。
-   **`side_panel`**: 指定 `sidebar.html` 为默认的侧边栏页面。

### 5.2. `extension/prompts/` 目录

-   **`extract_keywords_prompt.txt`**: 包含用于指导 Gemini 模型从网页内容中提取关键词的提示词。
-   **`sidebar_search_prompt.txt`**: 包含用于指导 Gemini 模型根据关键词进行搜索和总结的提示词，并要求返回特定的 JSON 格式（包含 Markdown 格式的 `summary`）。

### 5.3. `content.js`

-   **关键词提取**: 不再进行本地提取，而是将 `document.body.innerText` 发送至后端 `/api/extract-keywords` 端点，由 Gemini 模型处理。
-   **DOM 遍历与修改**: 
    -   使用 `document.createTreeWalker` 遍历页面所有可见的文本节点。
    -   采用健壮的 DOM 替换策略：首先构建一个包含所有关键词链接和文本的 `DocumentFragment`，然后一次性替换原始文本节点。这解决了之前 `TypeError: Cannot read properties of null (reading 'replaceChild')` 的问题，并确保了多关键词的正确高亮。
-   **事件处理**: `<a>` 标签的 `onclick` 事件会阻止默认跳转行为，并通过 `chrome.runtime.sendMessage` 通知 `background.js`。

### 5.4. `background.js`

-   **消息监听**: `chrome.runtime.onMessage.addListener` 监听所有运行时消息。
-   **数据存储**: 当收到 `openSidebar` 动作时，它首先将关键词通过 `chrome.storage.local.set` 保存。
-   **打开侧边栏**: 
    -   它优先尝试使用 `chrome.sidePanel.open()`。
    -   如果失败，则会调用 `chrome.windows.create` 创建一个弹出窗口作为替代方案。

### 5.5. `sidebar.html`

-   **编码声明**: `<head>` 中添加了 `<meta charset="UTF-8">`，确保页面正确显示中文。
-   **Markdown 库引入**: 引入了 `marked.min.js` 脚本，位于 `extension/marked.min.js`。

### 5.6. `sidebar.js`

-   **数据加载**: 
    -   页面加载时，`loadKeyword` 函数会从 `chrome.storage.local.get` 读取 `currentKeyword`。
    -   它会向后端 `/api/search` 端点发送一个 `fetch` POST 请求。
-   **Markdown 渲染**: 接收到后端返回的 Markdown 格式的 `summary` 后，使用 `marked.parse()` 函数将其转换为 HTML，然后设置到 `contentDiv.innerHTML`。
-   **错误处理**: 增加了对 `marked` 库是否加载的检查。
-   **自动更新**: 通过 `chrome.storage.onChanged.addListener` 监听存储变化，实现侧边栏的无刷新更新。

### 5.7. `server.js`

-   **Gemini API 集成**: 
    -   引入 `@google/generative-ai` 库。
    -   从环境变量 `GEMINI_API_KEY` 获取 API 密钥。
    -   使用 `gemini-2.5-pro` 模型（可根据实际可用性调整）。
-   **提示词加载**: 动态读取 `extension/prompts/` 目录下的提示词文件。
-   **API 端点实现**: 
    -   `/api/extract-keywords`: 调用 Gemini 模型进行关键词提取。
    -   `/api/search`: 调用 Gemini 模型进行关键词搜索和总结。
-   **CORS 支持**: 使用 `cors` 中间件允许跨域请求。
-   **错误处理**: 包含对 API 密钥缺失和 Gemini API 调用失败的错误处理。

## 6. 如何运行项目

### 6.1. 启动后端服务器

1.  进入 `server` 目录 (`cd server`)。
2.  **设置 Gemini API 密钥**: 在终端中执行 `export GEMINI_API_KEY="您的API密钥"`。
    *   **重要**: 请确保在启动服务器的同一个终端会话中设置此环境变量。
3.  安装依赖: `npm install`
4.  启动服务器: `node server.js`
5.  服务器将运行在 `http://localhost:3000`。

### 6.2. 加载 Chrome 扩展

1.  打开 Chrome 浏览器，进入 `chrome://extensions/`。
2.  打开右上角的 "开发者模式" (Developer mode)。
3.  点击 "加载已解压的扩展程序" (Load unpacked)。
4.  选择本项目的 `extension` 文件夹。
5.  加载成功后，在任意网页上刷新，即可看到由 Gemini 分析出的关键词被高亮。

## 7. 未来可改进点

-   **模型选择与配置**: 允许用户在扩展设置中选择不同的 Gemini 模型或配置模型参数。
-   **错误信息优化**: 针对 Gemini API 返回的错误，提供更友好的用户提示。
-   **性能优化**: 对于超长页面，可以考虑分块处理文本，或优化 DOM 操作以提高性能。
-   **用户自定义**: 允许用户自定义关键词高亮样式、黑名单网站等。
-   **缓存机制**: 对 Gemini API 的请求结果进行缓存，减少重复请求和提高响应速度。
-   **流式响应**: 考虑使用流式 API 响应，以改善用户体验，尤其是在 Gemini 生成内容较长时。