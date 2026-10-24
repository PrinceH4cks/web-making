# 🚀 Prince Studio — Next-Gen Web & Mobile IDE

> **Prince Studio** is a modern, high-performance in-browser Web IDE featuring an **Autonomous AI Coding Agent**, real-time live preview, multi-model AI routing (DeepSeek, Gemini, Claude, Llama 3.3), Virtual File System (VFS), and zero-dependency local Node server with CORS proxy.

---

## 📂 Project Architecture & Directory Layout

```
prince-studio/
├── 📄 index.html              # Main IDE Application Entry Point
├── 📄 server.js                # Zero-dependency Node HTTP Server & CORS Proxy (/api/proxy)
├── 📄 sw.js                    # PWA Service Worker (Offline caching & Instant load)
├── 📄 manifest.json            # Web App Manifest for Mobile/Desktop PWA installation
├── 📄 package.json             # Project metadata, NPM scripts (start, dev, test)
├── 📄 .gitignore               # Ignored files (node_modules, logs, secrets)
├── 📄 README.md                # Project documentation & architectural guide
│
├── 📁 assets/                  # Static media, icons & brand assets
│   └── 📁 icons/
│       ├── 📄 favicon.svg      # Prince Studio browser tab icon (SVG)
│       └── 📄 icon-512.svg     # 512x512 PWA installable app icon (SVG)
│
├── 📁 css/                     # Modular Stylesheet Architecture (10 Modules)
│   ├── 📄 tokens.css           # Design tokens, color palette, dark mode variables & typography
│   ├── 📄 layout.css           # Main grid, navigation bar, sidebars, panes & resizers
│   ├── 📄 components.css       # Reusable UI elements: buttons, modals, dropdowns, badges
│   ├── 📄 editor.css           # CodeMirror editor layout, gutters, tabs, active lines
│   ├── 📄 preview.css          # Live preview iframe container & responsive screen switchers
│   ├── 📄 console.css          # In-browser developer console, log stream, terminal UI
│   ├── 📄 ai-agent.css         # AI Agent Studio sidebar, chat bubbles, thinking drawer & diff viewer
│   ├── 📄 api-hub.css          # API Connect Hub modal, token counters, usage analytics
│   ├── 📄 inspector.css        # DOM element inspector overlay & box model inspection
│   └── 📄 assets.css           # Asset manager dialog & file uploader styles
│
└── 📁 js/                      # Modular JavaScript Architecture (20 Modules)
    ├── 📄 utils.js             # General utilities, DOM helpers, debouncers, safe JSON parsers
    ├── 📄 prefs.js             # User settings persistence (theme, font-size, auto-save)
    ├── 📄 vfs.js               # Virtual File System (In-memory multi-file project storage)
    ├── 📄 bundler.js           # Live single-bundle compiler (combines HTML/CSS/JS into iframe)
    ├── 📄 editor.js            # CodeMirror editor controller & keybindings
    ├── 📄 console.js           # Browser console interceptor & virtual terminal
    ├── 📄 packages.js          # CDN Package Manager (1-click React, Tailwind, Vue, Three.js)
    ├── 📄 palette.js           # Command Palette (Ctrl+P / Command+P quick switcher)
    ├── 📄 templates.js         # Starter Project Templates (Canvas, Dashboard, Landing page, Portfolio)
    ├── 📄 router.js            # Auto Model Router (Adaptive scoring, TTFB/throughput heuristics, circuit breakers)
    ├── 📄 providers.js         # AI Provider Catalog & Model Specifications (83+ endpoints)
    ├── 📄 api-hub.js           # API Connect Hub (Multi-key manager, quota prober, token accountant)
    ├── 📄 ai-agent.js          # Autonomous AI Coding Agent (Multi-turn reasoning, VFS tool orchestration)
    ├── 📄 app.js               # Main Application Bootstrap & event coordinator
    ├── 📄 inspector.js         # Real-time DOM element inspector tool
    ├── 📄 qr.js                # QR code generator for live mobile testing on same Wi-Fi
    ├── 📄 assets.js            # Media & Asset manager for uploading images/fonts to VFS
    ├── 📄 color-picker.js      # Color picker palette with HEX/RGB/HSL conversion
    ├── 📄 code-card.js         # Export snippet as beautiful social media card image
    └── 📄 checkpoints.js       # Git-like project revision history & instant snapshots
```

---

## 🏗️ Core Architectural Modules

### 1. 🤖 Autonomous AI Agent Engine (`js/ai-agent.js`)
- Runs multi-turn autonomous coding workflows.
- Has direct tool access to the project Virtual File System (`create_or_update_file`, `read_file`, `delete_file`, `list_project_files`).
- Automatically extracts reasoning/thinking tokens (`<think>`) and displays them in a collapsible drawer.
- Provides automatic tool name aliasing (`list_files`, `write_file`, `dir` all map correctly).

### 2. ⚡ Auto Model Router (`js/router.js`)
- Intelligently balances requests across multiple connected models.
- Weights candidates based on **Reliability (50%)**, **Speed (25%)**, and **Intelligence (25%)**.
- Hedged racing: tries the fastest candidate and hedges with a second candidate if slow.
- Circuit breaker protection: automatically cools down failing models without locking the user out.

### 3. 💾 Virtual File System (`js/vfs.js`)
- In-browser file management saved to `localStorage`.
- Full hierarchical path support (`index.html`, `css/style.css`, `js/main.js`).
- Fast CRUD operations with atomic diff generation.

### 4. 🌐 Live Compiler & Bundler (`js/bundler.js`)
- Injects HTML, CSS, and JS into an isolated sandboxed `iframe`.
- Captures runtime errors, console logs, and uncaught exceptions and feeds them directly to the console & AI Agent for auto-fixing.

### 5. 🔌 API Connect Hub (`js/api-hub.js` & `js/providers.js`)
- Zero-backend privacy: API keys stay in the browser.
- Live quota probing, token accounting, and cost calculations.
- Supports Google AI Studio, OpenRouter, OpenAI, Anthropic, DeepSeek, Groq, Mistral, Cerebras, and more.

---

## 🚀 Running the Project

### Prerequisites
- Node.js (v14 or higher, no NPM packages required)

### Quick Start
```bash
# 1. Clone or navigate to the directory
cd "c:\antigravity\web making"

# 2. Start the server
npm start
# or
node server.js

# 3. Open in your browser
http://localhost:8000/
```

### Network Access
When `server.js` starts, it binds to `0.0.0.0:8000`, allowing live preview on any mobile phone or tablet on the same Wi-Fi network.

---

## 📋 Professional Code & Naming Conventions

| Category | Standard | Example |
|---|---|---|
| **File Names** | kebab-case (lowercase with hyphens) | `ai-agent.js`, `tokens.css`, `favicon.svg` |
| **Folder Names** | kebab-case / lowercase plural | `css/`, `js/`, `assets/icons/` |
| **JavaScript Modules** | IIFE revealing module pattern with PascalCase namespace | `const AIAgent = (function() { ... })();` |
| **CSS Architecture** | Modular CSS with semantic class naming and CSS Custom Properties | `:root { --bg-primary: #0d0f14; }` |
| **VFS Relative Paths** | Standard web paths without leading slashes | `index.html`, `js/app.js`, `css/main.css` |

---

## 📜 License
MIT © **Prince Studio**
