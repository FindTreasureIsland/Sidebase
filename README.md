# Sidebase

一个基于 Chrome 扩展 + Node.js 后端的网页助手：在页面中智能提取并高亮关键词，点击后在侧边栏流式展示由 Gemini 生成的总结与相关来源。

## 功能特性
- 网页关键词提取：后端调用 Gemini，根据页面文本返回约 20 个关键词。
- 关键词高亮与可点击：页面内将关键词替换为可点击链接。
- 侧边栏智能总结：点击关键词后，在侧边栏以 Markdown 流式展示总结与来源列表。
- 优雅降级：不支持 `sidePanel` 时自动使用弹窗展示。
- 设置管理：可自定义高亮颜色、网站黑名单。

## 目录结构
```
sidebase/
├── extension/           # Chrome 扩展
│   ├── content.js       # 注入网页，提取并高亮关键词
│   ├── background.js    # 打开侧边栏并在组件间传递数据
│   ├── sidebar.html     # 侧边栏页面
│   ├── sidebar.js       # 侧边栏逻辑（SSE 流式渲染）
│   ├── options.html     # 扩展设置页面（颜色/黑名单）
│   ├── options.js       # 设置逻辑
│   ├── marked.min.js    # Markdown 渲染库
│   ├── manifest.json    # 扩展清单
│   └── prompts/         # 提示词模板
└── server/              # Node.js 后端
    ├── server.js        # API 服务与 Gemini 调用
    ├── config.js        # 模型与响应模式配置
    └── package.json
```

## 快速开始
### 1) 启动后端
```bash
cd server
# 设置 Gemini API 密钥（请使用你的真实密钥）
export GEMINI_API_KEY="<你的API密钥>"

npm install
node server.js
# 服务将运行在 http://localhost:3000
```

### 2) 加载 Chrome 扩展
1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角“开发者模式”
3. 点击“加载已解压的扩展程序”，选择项目中的 `extension` 文件夹
4. 在任意网页刷新，即可看到高亮的关键词

## 使用说明
- 在页面中点击被高亮的关键词，侧边栏会显示该关键词的总结与来源；内容以 Markdown 流式渲染。
- 在“扩展选项”中可设置：
  - 关键词高亮颜色（`chrome.storage.sync.highlightColor`）
  - 网站黑名单（`chrome.storage.sync.blacklist`），命中后扩展将不运行

## 后端 API
- `POST /api/extract-keywords`
  - 请求体：`{ "text": "页面完整文本" }`
  - 响应：`["关键词1", "关键词2", ...]`

- `GET /api/search?q=<keyword>`
  - SSE 流式返回 Markdown 文本（包含 `---SOURCES---` 分隔，之后为来源列表）

示例（提取关键词）：
```bash
curl -X POST http://localhost:3000/api/extract-keywords \
  -H 'Content-Type: application/json' \
  -d '{"text":"<你的页面文本>"}'
```

## 配置与模式
- 在 `server/config.js` 可调整：
  - `LLM_RESPONSE_MODE`：`summarize`（默认，基于模型内部知识）或 `search`（提示返回来源列表）
  - `MODEL_NAME`、`API_KEY` 由环境变量 `GEMINI_API_KEY` 控制是否启用

## 常见问题
- 无法连接后端：确认后端运行在 `http://localhost:3000`，且未被防火墙阻断。
- 侧边栏不显示：检查浏览器是否支持 `sidePanel`；若不支持会自动弹窗显示。
- Markdown 未渲染：确保 `extension/sidebar.html` 正确引入 `marked.min.js`。
- API 密钥：不要将密钥或私密文件提交到仓库，使用环境变量。

## 开发建议
- 内容脚本对 DOM 的替换采用 `TreeWalker + DocumentFragment`，避免直接 `replaceChild` 导致异常。
- 后端对响应做了简单缓存（内存），可按需扩展为持久化缓存。
- 如需切换响应模式，在 `server/config.js` 中修改 `LLM_RESPONSE_MODE` 并重启后端。

## 许可证
本项目使用 ISC 许可证（如需变更，请在 `package.json` 中更新）。