/* ==========================================================================
   Master Web IDE Ultra - Autonomous In-IDE AI Agent Studio
   ========================================================================== */

const AIAgent = (function() {
    const CONFIG_KEY = 'master_ide_ai_config';
    const CHAT_KEY = 'master_ide_ai_chat';
    const MODELS_KEY = 'master_ide_ai_models';

    const PROVIDERS = {
        gemini: {
            name: "Google Gemini",
            defaultModel: "gemini-2.5-flash",
            baseUrl: "https://generativelanguage.googleapis.com/v1beta"
        },
        deepseek: {
            name: "DeepSeek",
            defaultModel: "deepseek-chat",
            baseUrl: "https://api.deepseek.com/v1"
        },
        groq: {
            name: "Groq (Ultra-Fast)",
            defaultModel: "llama-3.3-70b-versatile",
            baseUrl: "https://api.groq.com/openai/v1"
        },
        openrouter: {
            name: "OpenRouter",
            defaultModel: "deepseek/deepseek-chat:free",
            baseUrl: "https://openrouter.ai/api/v1"
        },
        openai: {
            name: "OpenAI",
            defaultModel: "gpt-4o-mini",
            baseUrl: "https://api.openai.com/v1"
        },
        custom: {
            name: "Custom / OpenCode / Localhost (Ollama)",
            defaultModel: "qwen2.5-coder:7b",
            baseUrl: "http://localhost:11434/v1"
        }
    };

    const FALLBACK_MODELS = {
        gemini: [
            { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Recommended)", detail: "1M in / 8k out" },
            { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", detail: "Fast & High Quota" },
            { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", detail: "High Free Quota" },
            { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", detail: "2M in / 8k out" },
            { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", detail: "1M in / 8k out" },
            { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", detail: "2M in / 8k out" }
        ],
        groq: [
            { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile (Recommended)", detail: "Groq LPUs" },
            { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", detail: "Ultra-Fast" },
            { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", detail: "32k context" }
        ],
        openrouter: [
            { id: "deepseek/deepseek-chat:free", label: "DeepSeek Chat (Free)", detail: "Free tier" },
            { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (Free)", detail: "Free tier" },
            { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash (Free)", detail: "Free tier" },
            { id: "anthropic/claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", detail: "Anthropic" },
            { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", detail: "OpenAI" }
        ],
        deepseek: [
            { id: "deepseek-chat", label: "DeepSeek-V3 (Chat)", detail: "64k context" },
            { id: "deepseek-reasoner", label: "DeepSeek-R1 (Reasoner)", detail: "Reasoning" }
        ],
        openai: [
            { id: "gpt-4o", label: "GPT-4o", detail: "128k context" },
            { id: "gpt-4o-mini", label: "GPT-4o Mini (Fast)", detail: "128k context" },
            { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", detail: "Standard" }
        ],
        custom: [
            { id: "qwen2.5-coder:7b", label: "Qwen 2.5 Coder 7B", detail: "Ollama / Local" },
            { id: "llama3.2:latest", label: "Llama 3.2 Latest", detail: "Ollama / Local" }
        ]
    };

    let config = {
        provider: "auto",
        apiKey: "",
        model: "auto",
        baseUrl: "",
        temperature: 0.2,
        customRules: "",
        maxSteps: 8
    };

    const PROVIDER_KEY_URLS = {
        gemini: "https://aistudio.google.com/app/apikey",
        deepseek: "https://platform.deepseek.com/api_keys",
        groq: "https://console.groq.com/keys",
        openrouter: "https://openrouter.ai/keys",
        openai: "https://platform.openai.com/api-keys",
        custom: ""
    };

    let messages = [];
    let isBusy = false;

    // 🧩 MODEL DISCOVERY — the list of models the user's own API key unlocks
    let availableModels = [];
    let modelsFetchTimer = null;
    let modelsFetching = false;

    // 🔌 CONNECTION STATE — idle → checking → ok / err
    let connectionState = 'idle';
    let lastConnectedKey = '';
    let lastConnectedProvider = '';

    // 🧠 Conversation state (multi-turn memory)
    let geminiContents = [];
    let geminiStarted = false;
    let openaiConversation = null;

    // 🛠️ System Prompt for the Autonomous Agent
    function getSystemPrompt() {
        let base = `You are the Lead Autonomous AI Coding Agent inside Prince Studio.
You have direct autonomous tool access to create, edit, delete, and read files in the user's project Virtual File System.
Your goal is to build modern, stunning, responsive, bug-free web projects (HTML5, modern CSS3, JavaScript, Tailwind, Canvas, etc.).

RULES:
1. Always write complete, production-ready code — NEVER write placeholder comments like "// rest of code here".
2. When creating multi-file projects, create "index.html", "css/style.css", and "js/main.js" (or other appropriate files) and link them correctly.
3. Be helpful, concise, and explain the changes you made after executing your tools.`;

        if (config.customRules && config.customRules.trim()) {
            base += `\n\nUSER CUSTOM PREFERENCES & STYLE RULES:\n${config.customRules.trim()}`;
        }
        return base;
    }

    // 🛠️ Tool Definitions
    const TOOLS_SCHEMA = [
        {
            type: "function",
            function: {
                name: "create_or_update_file",
                description: "Create a new file or replace the entire content of an existing file in the project VFS.",
                parameters: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "Relative file path, e.g. 'index.html', 'css/style.css', 'js/main.js'"
                        },
                        content: {
                            type: "string",
                            description: "The complete code content of the file"
                        }
                    },
                    required: ["path", "content"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "read_file",
                description: "Read the current content of a file in the project to understand context before editing.",
                parameters: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "Relative path of the file to read"
                        }
                    },
                    required: ["path"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "delete_file",
                description: "Delete a file from the project VFS.",
                parameters: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "Relative path of the file to delete"
                        }
                    },
                    required: ["path"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "list_project_files",
                description: "List all existing files currently in the project.",
                parameters: {
                    type: "object",
                    properties: {}
                }
            }
        }
    ];

    function init() {
        loadConfig();
        loadChat();
        renderChat();
        updateModelTag();
        initResizer();
    }

    // ↔️ DRAGGABLE & EXPANDABLE RESIZE ENGINE FOR AI STUDIO PANEL
    function initResizer() {
        const panel = document.getElementById('ai-studio-panel');
        const resizer = document.getElementById('ai-panel-resizer');
        if (!panel) return;

        // On mobile phones (<= 768px), keep panel strictly full-screen (never apply custom width)
        if (window.innerWidth <= 768) {
            panel.style.width = '';
            panel.style.removeProperty('--ai-panel-width');
        } else {
            // Desktop: Restore saved width from localStorage
            try {
                const savedWidth = localStorage.getItem('master_ide_ai_panel_width');
                if (savedWidth) {
                    const w = parseInt(savedWidth, 10);
                    if (!isNaN(w) && w >= 320 && w <= (window.innerWidth - 60)) {
                        panel.style.width = `${w}px`;
                        panel.style.setProperty('--ai-panel-width', `${w}px`);
                    }
                }
            } catch (e) {}
        }

        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768) {
                panel.style.width = '';
                panel.style.removeProperty('--ai-panel-width');
            }
        });

        if (!resizer) return;

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        function onMouseDown(e) {
            if (window.innerWidth <= 768) return;
            isResizing = true;
            startX = e.clientX;
            startWidth = panel.getBoundingClientRect().width;
            panel.classList.add('resizing');
            resizer.classList.add('dragging');
            document.body.classList.add('ai-panel-resizing');

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        }

        function onMouseMove(e) {
            if (!isResizing) return;
            // Moving mouse to the left (negative delta from right edge) increases width
            const delta = startX - e.clientX;
            const minWidth = 320;
            const maxWidth = Math.max(minWidth, window.innerWidth - 60);
            const newWidth = Math.min(maxWidth, Math.max(minWidth, Math.round(startWidth + delta)));

            panel.style.width = `${newWidth}px`;
            panel.style.setProperty('--ai-panel-width', `${newWidth}px`);
        }

        function onMouseUp() {
            if (!isResizing) return;
            isResizing = false;
            panel.classList.remove('resizing');
            resizer.classList.remove('dragging');
            document.body.classList.remove('ai-panel-resizing');

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            const finalWidth = Math.round(panel.getBoundingClientRect().width);
            try {
                localStorage.setItem('master_ide_ai_panel_width', finalWidth);
            } catch (e) {}
            if (typeof EditorController !== 'undefined' && EditorController.refresh) {
                EditorController.refresh();
            }
        }

        resizer.addEventListener('mousedown', onMouseDown);

        // Touch drag support
        resizer.addEventListener('touchstart', (e) => {
            if (window.innerWidth <= 768 || !e.touches || !e.touches[0]) return;
            const touch = e.touches[0];
            onMouseDown({ clientX: touch.clientX, preventDefault: () => e.preventDefault() });
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (isResizing && e.touches && e.touches[0]) {
                onMouseMove({ clientX: e.touches[0].clientX });
            }
        }, { passive: true });

        window.addEventListener('touchend', () => {
            if (isResizing) onMouseUp();
        });
    }

    function toggleWideMode() {
        if (window.innerWidth <= 768) return; // Completely disabled on mobile phones
        const panel = document.getElementById('ai-studio-panel');
        if (!panel) return;
        const currentWidth = panel.getBoundingClientRect().width;
        const normalWidth = 420;
        const wideWidth = Math.min(window.innerWidth - 60, Math.max(680, Math.round(window.innerWidth * 0.65)));

        const isCurrentlyWide = currentWidth > (normalWidth + 100);
        const targetWidth = isCurrentlyWide ? normalWidth : wideWidth;

        panel.style.width = `${targetWidth}px`;
        panel.style.setProperty('--ai-panel-width', `${targetWidth}px`);
        try {
            localStorage.setItem('master_ide_ai_panel_width', targetWidth);
        } catch (e) {}

        const expandIcon = document.getElementById('ai-expand-icon');
        if (expandIcon) {
            expandIcon.className = isCurrentlyWide 
                ? 'fas fa-arrows-left-right-to-line' 
                : 'fas fa-compress';
        }

        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast(isCurrentlyWide ? "AI Panel: Standard Width" : "AI Panel: Expanded Wide View", "info");
        }
        if (typeof EditorController !== 'undefined' && EditorController.refresh) {
            setTimeout(() => EditorController.refresh(), 150);
        }
    }

    function loadConfig() {
        try {
            const saved = localStorage.getItem(CONFIG_KEY);
            if (saved) {
                config = { ...config, ...JSON.parse(saved) };
            }
            if (config.provider === 'gemini' && !config.apiKey) {
                config.provider = 'auto';
                config.model = 'auto';
            }
        } catch (e) {}
    }

    function saveConfig(silent = false) {
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
            updateModelTag();
            if (!silent) {
                App.showToast("AI Agent configuration saved!", "success");
            }
        } catch (e) {}
    }

    function loadChat() {
        try {
            const saved = localStorage.getItem(CHAT_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    messages = parsed;
                }
            }
        } catch (e) {}

        if (!Array.isArray(messages) || messages.length === 0) {
            messages = [
                {
                    role: "agent",
                    text: "👋 Hello! I am your Autonomous In-IDE AI Agent. Tell me what to build (e.g. *'Create a sleek glassmorphic weather app'*) and I will write files, organize folders, and update the live preview directly!"
                }
            ];
        }
    }

    function saveChat() {
        try {
            localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
        } catch (e) {}
    }

    function updateModelTag() {
        const tag = document.getElementById('ai-model-tag');
        if (tag) {
            if (!config.provider || config.provider === 'auto') {
                if (lastRoutedModel) {
                    const shortName = lastRoutedModel.length > 18 ? lastRoutedModel.substring(0, 16) + '…' : lastRoutedModel;
                    tag.innerText = `⚡ ${shortName}`;
                    tag.title = `Auto Router (Active: ${lastRoutedModel}) - Dynamic failover across connected APIs`;
                } else {
                    tag.innerText = "⚡ Auto Router";
                    tag.title = "Auto Router: Automatically balancing and choosing best live model";
                }
            } else {
                const label = (config.model && config.model !== 'auto') ? config.model : config.provider;
                tag.innerText = label.length > 20 ? label.substring(0, 18) + '…' : label;
                tag.title = `${config.provider}: ${config.model || 'Default Model'}`;
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  🧩 MODEL DISCOVERY
    //  The moment the user pastes their API key we ask THEIR OWN provider
    //  which models that key unlocks and offer them in a dropdown.
    //  Nothing is sent anywhere except the provider the user chose.
    // ══════════════════════════════════════════════════════════════════════

    /** Reads the currently visible values of the settings modal. */
    function readModalValues() {
        const providerSelect = document.getElementById('ai-provider-select');
        const apiKeyInput = document.getElementById('ai-api-key-input');
        const baseUrlInput = document.getElementById('ai-base-url-input');
        const modelInput = document.getElementById('ai-model-input');

        const provider = (providerSelect && providerSelect.value) || config.provider;
        // The visible input always wins — even when it was deliberately
        // cleared (an empty field must NOT fall back to a stale value).
        const apiKey = (apiKeyInput ? apiKeyInput.value : (config.apiKey || '')).trim();
        const baseUrl = (baseUrlInput ? baseUrlInput.value : (config.baseUrl || '')).trim();
        const model = (modelInput ? modelInput.value : (config.model || '')).trim();

        return { provider, apiKey, baseUrl, model };
    }

    /** Resolves the endpoint that should be queried for the model list. */
    function resolveModelsEndpoint(provider, baseUrl) {
        const meta = PROVIDERS[provider] || PROVIDERS.openai;
        const custom = (baseUrl || '').trim().replace(/\/+$/, '');
        const fallback = (meta.baseUrl || '').replace(/\/+$/, '');

        if (provider === 'gemini') {
            // Gemini exposes the catalogue on the models endpoint itself.
            return custom || fallback || 'https://generativelanguage.googleapis.com/v1beta/models';
        }
        // Every OpenAI-compatible provider exposes GET {base}/models
        return (custom || fallback) + '/models';
    }

    /** Lightweight connection test — minimal request to verify key works. */
    async function testConnection(provider, apiKey, baseUrl) {
        const endpoint = resolveModelsEndpoint(provider, baseUrl);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
            if (provider === 'gemini') {
                const url = `${endpoint}?key=${encodeURIComponent(apiKey)}&pageSize=1`;
                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timeout);
                if (res.ok) return { ok: true, provider: 'gemini' };
                const err = await readApiError(res);
                return { ok: false, error: err, status: res.status };
            } else {
                const headers = { 'Accept': 'application/json' };
                if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
                const res = await fetch(endpoint, { headers, signal: controller.signal });
                clearTimeout(timeout);
                if (res.ok) return { ok: true, provider: provider };
                const err = await readApiError(res);
                return { ok: false, error: err, status: res.status };
            }
        } catch (e) {
            clearTimeout(timeout);
            if (e.name === 'AbortError') {
                return { ok: false, error: 'Request timed out (10s). Check network or CORS.', status: 0 };
            }
            // CORS or network error
            const msg = String(e.message || e);
            if (/cors|network|Failed to fetch/i.test(msg)) {
                return { ok: false, error: 'CORS blocked — browser cannot call this API directly. Use a proxy or provider that allows browser calls.', status: 0, isCors: true };
            }
            return { ok: false, error: msg, status: 0 };
        }
    }

    /**
     * Fetches every model the user's key unlocks and fills the dropdown.
     * Safe to call as often as you like — it never throws.
     */
    async function fetchModels(options = {}) {
        const { provider, apiKey, baseUrl } = readModalValues();

        // Remember the key right away — the user asked for it to be saved the
        // moment it is entered, even if the provider is temporarily unreachable.
        if (apiKey) {
            config.provider = provider;
            config.apiKey = apiKey;
            config.baseUrl = baseUrl;
            saveConfig(true);

            // Cross-sync with APIHub if available
            if (typeof APIHub !== 'undefined') {
                try {
                    const hubProv = (provider === 'gemini') ? 'google' : provider;
                    APIHub.setDraftKey(hubProv, apiKey);
                } catch (e) { /* ignore */ }
            }
        }

        if (!apiKey && provider !== 'custom') {
            setConnectionState('err', 'No API key');
            setModelStatus('Enter your API key to load the available models.', 'muted');
            clearModelList();
            return [];
        }

        if (modelsFetching) return availableModels;
        modelsFetching = true;

        setConnectionState('checking', 'Checking…');
        setModelStatus('Loading models…', 'loading');

        try {
            let models = [];
            let fallbackUsed = false;
            try {
                if (provider === 'gemini') {
                    models = await fetchGeminiModels(apiKey, baseUrl);
                } else {
                    models = await fetchOpenAIModels(resolveModelsEndpoint(provider, baseUrl), apiKey);
                }
            } catch (netErr) {
                const errMsg = String((netErr && netErr.message) || '');
                if (/key.*not valid|invalid.*api.*key|unauthorized|401|403|permission_denied/i.test(errMsg)) {
                    throw netErr;
                }
                console.warn(`[AIAgent] Live models endpoint blocked (${errMsg}), using verified catalogue fallback.`);
                models = (FALLBACK_MODELS[provider] || []).slice();
                fallbackUsed = true;
            }

            if (!models.length && FALLBACK_MODELS[provider]) {
                models = FALLBACK_MODELS[provider].slice();
                fallbackUsed = true;
            }

            availableModels = models;
            renderModelList(models);

            if (models.length) {
                lastConnectedKey = apiKey;
                lastConnectedProvider = provider;
                setConnectionState('ok', `Connected · ${models.length} model${models.length === 1 ? '' : 's'}`);
                setModelStatus(fallbackUsed 
                    ? `✓ Connected (${models.length} verified models ready).` 
                    : `✓ ${models.length} model${models.length === 1 ? '' : 's'} available — pick one below.`, 'success');
            } else {
                setConnectionState('err', 'No models returned');
                setModelStatus('No models returned. You can still type a model name manually.', 'error');
            }

            // The key works → cache the catalogue for the next time
            saveModelCache(provider, models);

            // 🧭 The router now knows every model the key unlocks
            renderRouterPanel();

            // Auto-select the first model when nothing usable is chosen yet
            if (models.length && options.autoSelect) {
                const current = readModalValues().model;
                if (!current || !models.some(m => m.id === current)) {
                    pickModel(models[0].id);
                }
            }
        } catch (e) {
            const message = (e && e.message) ? e.message : 'Unknown error';
            setConnectionState('err', 'Connection failed');
            setModelStatus(`Could not load models: ${message}. You can still type a model name manually.`, 'error');
        } finally {
            modelsFetching = false;
        }

        return availableModels;
    }

    /** Turns a token count into a short human readable string (1M / 66k). */
    function formatTokens(n) {
        const value = Number(n) || 0;
        if (value <= 0) return '0';
        if (value >= 1000000) return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (value >= 1000) return Math.round(value / 1000) + 'k';
        return String(value);
    }

    /** GET {geminiBase}/models?key=… → [{ id, label, detail }] */
    async function fetchGeminiModels(apiKey, customBase) {
        const meta = PROVIDERS.gemini;
        const base = ((customBase || '').trim() || meta.baseUrl).replace(/\/+$/, '');
        const url = `${base}?key=${encodeURIComponent(apiKey)}&pageSize=200`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        let res;
        try {
            res = await fetch(url, { signal: controller.signal });
        } catch (e) {
            clearTimeout(timeout);
            if (e.name === 'AbortError') throw new Error('Request timed out (15s)');
            const msg = String(e.message || e);
            if (/cors|network|Failed to fetch/i.test(msg)) {
                throw new Error('CORS blocked — Google AI Studio does not allow direct browser calls. Use a proxy or OpenRouter.');
            }
            throw e;
        }
        clearTimeout(timeout);

        if (!res.ok) throw new Error(await readApiError(res));

        const data = await res.json();
        const raw = Array.isArray(data.models) ? data.models
            : (Array.isArray(data.data) ? data.data : []);

        return raw
            .filter(m => {
                const methods = m.supportedGenerationMethods;
                if (!Array.isArray(methods) || !methods.length) return true;
                return methods.includes('generateContent');
            })
            .map(m => ({
                id: String(m.name || m.id || '').replace(/^models\//, ''),
                label: m.displayName || m.name || m.id || '',
                detail: m.inputTokenLimit
                    ? `${formatTokens(m.inputTokenLimit)} in / ${formatTokens(m.outputTokenLimit)} out`
                    : ''
            }))
            .filter(m => m.id);
    }

    /** GET {base}/models with a bearer token → [{ id, label, detail }] */
    async function fetchOpenAIModels(url, apiKey) {
        const headers = { 'Accept': 'application/json' };
        if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        let res;
        try {
            res = await fetch(url, { headers, signal: controller.signal });
        } catch (e) {
            clearTimeout(timeout);
            if (e.name === 'AbortError') throw new Error('Request timed out (15s)');
            const msg = String(e.message || e);
            if (/cors|network|Failed to fetch/i.test(msg)) {
                throw new Error('CORS blocked — this provider does not allow direct browser calls. Use OpenRouter (openrouter.ai) which proxies requests with CORS enabled.');
            }
            throw e;
        }
        clearTimeout(timeout);

        if (!res.ok) throw new Error(await readApiError(res));

        const data = await res.json();
        const raw = Array.isArray(data.data) ? data.data
            : (Array.isArray(data.models) ? data.models : []);

        return raw
            .map(m => ({
                id: String(m.id || m.name || ''),
                label: m.name || m.id || '',
                detail: m.owned_by ? m.owned_by : (m.description ? String(m.description).slice(0, 60) : '')
            }))
            .filter(m => m.id);
    }

    /** Turns an error response into a readable one-liner. */
    async function readApiError(res) {
        try {
            const data = await res.json();
            const err = (data && (data.error || data)) || {};
            const message = err.message || err.status || err.code;
            if (message) return String(message);
        } catch (e) { /* not JSON */ }
        return `HTTP ${res.status}${res.statusText ? ' ' + res.statusText : ''}`;
    }

    /** Fills both the <datalist> and the <select> dropdown with the models. */
    function renderModelList(models) {
        const list = Array.isArray(models) ? models : [];

        const datalist = document.getElementById('ai-model-list');
        if (datalist) {
            datalist.innerHTML = list.map(m => {
                const label = m.detail ? `${m.label || m.id} — ${m.detail}` : (m.label || m.id);
                return `<option value="${IDEUtils.escapeAttr(m.id)}">${IDEUtils.escapeHtml(label)}</option>`;
            }).join('');
        }

        const select = document.getElementById('ai-model-select');
        if (select) {
            const currentValue = select.value;
            select.innerHTML = `<option value="">— Select a model (${list.length}) —</option>` + list.map(m => {
                const label = m.detail ? `${m.label || m.id} — ${m.detail}` : (m.label || m.id);
                return `<option value="${IDEUtils.escapeAttr(m.id)}">${IDEUtils.escapeHtml(label)}</option>`;
            }).join('');

            // The dropdown unlocks once the key is verified
            select.disabled = !list.length;
            select.classList.toggle('connected', !!list.length);

            // Keep the previous selection when it still exists
            if (currentValue && list.some(m => m.id === currentValue)) {
                select.value = currentValue;
            } else {
                const modelInput = document.getElementById('ai-model-input');
                const typed = modelInput ? modelInput.value.trim() : '';
                if (typed && list.some(m => m.id === typed)) select.value = typed;
            }
        }
    }

    /** Empties the dropdown (used when the provider changes). */
    function clearModelList() {
        availableModels = [];
        const datalist = document.getElementById('ai-model-list');
        if (datalist) datalist.innerHTML = '';
        const select = document.getElementById('ai-model-select');
        if (select) {
            select.innerHTML = '<option value="">— Connect to load models —</option>';
            select.disabled = true;
            select.classList.remove('connected');
        }
    }

    /** Updates the little status line under the model field. */
    function setModelStatus(text, kind = 'muted') {
        const el = document.getElementById('ai-model-status');
        if (!el) return;
        el.textContent = text;
        const colors = {
            success: '#22c55e',
            error: 'var(--danger, #ef4444)',
            loading: 'var(--accent, #8b5cf6)',
            muted: 'var(--text-muted)'
        };
        el.style.color = colors[kind] || colors.muted;
    }

    /** Updates the little connection pill above the model field. */
    function setConnectionState(state, message) {
        connectionState = state || 'idle';

        const badge = document.getElementById('ai-connection-badge');
        const text = document.getElementById('ai-connection-text');
        const select = document.getElementById('ai-model-select');
        const btn = document.getElementById('ai-connect-btn');

        if (badge) {
            badge.className = 'conn-badge conn-' + connectionState;
            const icon = badge.querySelector('i');
            if (icon) {
                if (connectionState === 'checking') {
                    icon.className = 'fas fa-circle-notch conn-spin';
                } else if (connectionState === 'ok') {
                    icon.className = 'fas fa-circle-check';
                } else if (connectionState === 'err') {
                    icon.className = 'fas fa-circle-exclamation';
                } else {
                    icon.className = 'fas fa-plug';
                }
            }
        }

        if (text) text.textContent = message;

        // The model dropdown only becomes usable once the key is verified
        if (select) {
            select.disabled = (connectionState !== 'ok');
            select.classList.toggle('connected', connectionState === 'ok');
        }

        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = connectionState === 'checking'
                    ? 'fas fa-circle-notch conn-spin'
                    : 'fas fa-plug';
            }
            btn.disabled = (connectionState === 'checking');
            btn.style.opacity = connectionState === 'checking' ? '0.7' : '1';
        }
    }

    /**
     * The "Connect" button — verifies the user's key and loads every model
     * it unlocks. Shows a green badge when the key works, red when it does not.
     */
    async function connect() {
        const { provider, apiKey, baseUrl } = readModalValues();

        if (!apiKey && provider !== 'custom') {
            setConnectionState('err', 'No API key');
            setModelStatus('Paste your API key first, then press Connect.', 'error');
            return [];
        }

        setConnectionState('checking', 'Testing connection…');
        setModelStatus('Verifying your API key…', 'loading');

        // Step 1: Quick connection test with clear error messages
        const testResult = await testConnection(provider, apiKey, baseUrl);

        if (!testResult.ok) {
            let userMessage = testResult.error;
            if (testResult.isCors) {
                userMessage = '⚠️ CORS blocked: This provider does not allow direct browser calls.\n\nSolutions:\n• Use OpenRouter (openrouter.ai) — it proxies 100+ models with CORS enabled\n• Use a CORS proxy (not recommended for production)\n• Run a local proxy server\n• For Ollama: start with `OLLAMA_ORIGINS="*" ollama serve`';
            } else if (testResult.status === 401 || testResult.status === 403) {
                userMessage = '🔐 Invalid API key — please check and re-enter.';
            } else if (testResult.status === 429) {
                userMessage = '⏱️ Rate limited — wait a moment and try again.';
            } else if (testResult.status === 0) {
                userMessage = '🌐 Network error — check internet connection.';
            }

            setConnectionState('err', 'Failed');
            setModelStatus(userMessage, 'error');
            App.showToast(`Connection failed: ${testResult.error}`, 'error');
            return [];
        }

        setConnectionState('checking', 'Loading models…');
        setModelStatus('Fetching available models…', 'loading');

        // Step 2: Fetch full model list
        const models = await fetchModels();

        if (models.length) {
            lastConnectedKey = apiKey;
            lastConnectedProvider = provider;
            App.showToast(`✅ Connected to ${PROVIDERS[provider]?.name || provider} — ${models.length} models loaded!`, 'success');
        }

        return models;
    }

    /** Called when a model is picked from the dropdown. */
    function pickModel(value) {
        if (!value) return;
        const modelInput = document.getElementById('ai-model-input');
        if (modelInput) modelInput.value = value;
        config.model = value;
        saveConfig(true);
        setModelStatus(`Selected: ${value}`, 'success');
    }

    /** Debounced: fires the model fetch as soon as the user stops typing. */
    function handleApiKeyInput() {
        clearTimeout(modelsFetchTimer);
        modelsFetchTimer = setTimeout(() => {
            const { provider, apiKey } = readModalValues();
            if (apiKey.length < 12) return;
            // Don't spam the provider if the key did not actually change
            if (apiKey === lastConnectedKey && provider === lastConnectedProvider) return;
            connect();
        }, 700);
    }

    /** Called while the user types a model name manually. */
    function handleModelInput() {
        const modelInput = document.getElementById('ai-model-input');
        if (!modelInput) return;
        const value = modelInput.value.trim();
        config.model = value;

        // Keep the dropdown in sync with a hand-typed model
        const select = document.getElementById('ai-model-select');
        if (select && value && availableModels.some(m => m.id === value)) {
            select.value = value;
        }
    }

    /** Shows / hides the API key using .masked class (prevents mobile privacy keyboard). */
    function toggleApiKeyVisibility() {
        const input = document.getElementById('ai-api-key-input');
        if (!input) return;
        input.type = 'text';
        input.classList.toggle('masked');
    }

    /** Exposed wrapper for the test button in the modal. */
    async function testConnectionExposed() {
        const { provider, apiKey, baseUrl } = readModalValues();

        if (!apiKey && provider !== 'custom') {
            setConnectionState('err', 'No API key');
            setModelStatus('Paste your API key first, then press Test.', 'error');
            App.showToast('Please enter an API key first', 'error');
            return;
        }

        const btn = document.getElementById('ai-test-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Testing…';
        }

        setConnectionState('checking', 'Testing…');
        setModelStatus('Verifying your API key…', 'loading');

        const result = await testConnection(provider, apiKey, baseUrl);

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-vial"></i> Test';
        }

        if (result.ok) {
            setConnectionState('ok', 'Key valid');
            setModelStatus('✅ API key works! Press Connect to load models.', 'success');
            App.showToast('Connection test passed! Key is valid.', 'success');
        } else {
            let userMessage = result.error;
            if (result.isCors) {
                userMessage = '⚠️ CORS blocked — this provider does not allow direct browser calls.\nUse OpenRouter (openrouter.ai) or a local proxy.';
            } else if (result.status === 401 || result.status === 403) {
                userMessage = '🔐 Invalid API key — please check and re-enter.';
            } else if (result.status === 429) {
                userMessage = '⏱️ Rate limited — wait a moment and try again.';
            } else if (result.status === 0) {
                userMessage = '🌐 Network error — check internet connection.';
            }

            setConnectionState('err', 'Failed');
            setModelStatus(userMessage, 'error');
            App.showToast(`Test failed: ${result.error}`, 'error');
        }
    }

    /** Persists the fetched model list so reopening the modal is instant. */
    function saveModelCache(provider, models) {
        try {
            localStorage.setItem(MODELS_KEY, JSON.stringify({
                provider,
                ts: Date.now(),
                models: models || []
            }));
        } catch (e) { /* storage unavailable */ }
    }

    /** Restores the previously fetched model list (same provider only). */
    function loadModelCache(provider) {
        try {
            const raw = localStorage.getItem(MODELS_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.provider !== provider || !Array.isArray(parsed.models)) return null;
            return parsed.models;
        } catch (e) {
            return null;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  🧭 AUTO MODEL ROUTER
    //  The user never has to pick a model again: the router scores every
    //  model their key unlocks, puts the best one first and quietly falls
    //  over to the next one when something goes wrong.
    // ══════════════════════════════════════════════════════════════════════

    /** Reads a router preference (falls back to the router's own default). */
    function routerPref(key, fallback) {
        try {
            if (typeof IDEPrefs !== 'undefined') {
                const v = IDEPrefs.get(key);
                if (v !== undefined && v !== null) return v;
            }
        } catch (e) { /* prefs unavailable */ }
        return fallback;
    }

    /** Stores a router preference persistently. */
    function setRouterPref(key, value) {
        try {
            if (typeof IDEPrefs !== 'undefined') IDEPrefs.set(key, value);
        } catch (e) { /* prefs unavailable */ }
    }

    /** Is the auto router switched on? */
    function isRouterEnabled() {
        return routerPref('aiRouterEnabled', true) !== false;
    }

    /** Current strategy id (balanced / smartest / fastest / reliable). */
    function routerStrategy() {
        const s = routerPref('aiRouterStrategy', 'balanced');
        return (typeof AIModelRouter !== 'undefined' && AIModelRouter.STRATEGIES[s]) ? s : 'balanced';
    }

    /** Total time budget for one routed request (ms). */
    function routerBudgetMs() {
        const v = Number(routerPref('aiRouterBudgetMs', 45000));
        return isFinite(v) && v > 0 ? v : 45000;
    }

    /** Per-model attempt timeout (ms). */
    function routerAttemptTimeoutMs() {
        const v = Number(routerPref('aiRouterAttemptTimeoutMs', 20000));
        return isFinite(v) && v > 0 ? v : 20000;
    }

    /** Should a second model be started while the first is still thinking? */
    function routerHedgeEnabled() {
        return routerPref('aiRouterHedge', true) !== false;
    }

    /** How long to wait before the hedge starts (ms). */
    function routerHedgeMs() {
        const v = Number(routerPref('aiRouterHedgeMs', 6000));
        return isFinite(v) && v > 0 ? v : 6000;
    }

    /**
     * Builds the ordered candidate chain.
     *
     * Besides the models of the currently selected provider it also folds in
     * every API that was connected in the API Connect Hub, so the agent can
     * fail over from one provider to another — not just from model to model.
     */
    function buildRouterChain(provider, models, preferred) {
        if (typeof AIModelRouter === 'undefined') return [];
        const activeProv = provider || config.provider;
        const chain = (activeProv && activeProv !== 'auto')
            ? AIModelRouter.buildChain(activeProv, models || availableModels, {
                strategy: routerStrategy(),
                preferred: preferred || ''
            })
            : [];

        if (typeof APIHub !== 'undefined' && APIHub.routerCandidates) {
            try {
                const extra = APIHub.routerCandidates() || [];
                const seen = {};
                chain.forEach(c => { seen[c.key || c.id] = true; });
                extra.forEach(cand => {
                    if (activeProv && activeProv !== 'auto' && cand.provider === activeProv) return;
                    if (/north-mini-code|content-safety|lfm-2|moderation|guard/i.test(cand.model || cand.id || '')) return;
                    // The router reads the model id from `id`, the hub calls it `model`.
                    const entry = { id: cand.model, label: cand.label };
                    const sub = AIModelRouter.buildChain(cand.provider, [entry], { strategy: routerStrategy() });
                    if (!sub.length) return;
                    if (seen[sub[0].key]) return;
                    seen[sub[0].key] = true;
                    sub[0].hubProvider = cand.provider;
                    sub[0].hubLabel = cand.label;
                    sub[0].label = cand.label;
                    chain.push(sub[0]);
                });
            } catch (e) { /* API Hub not available */ }
        }

        // Merge the two sources back into one score-ordered list.
        chain.sort((a, b) => {
            const aBad = (a.benched ? 1 : 0) + (a.breakerOpen ? 2 : 0);
            const bBad = (b.benched ? 1 : 0) + (b.breakerOpen ? 2 : 0);
            if (aBad !== bBad) return aBad - bBad;
            if (b.score !== a.score) return b.score - a.score;
            return String(a.id).localeCompare(String(b.id));
        });

        return chain;
    }

    /** Creates the abort-style error used when a race is lost. */
    function makeAbortedError() {
        const err = new Error('Superseded by a faster model.');
        err.name = 'AbortError';
        err.superseded = true;
        return err;
    }

    /** Automatically detects provider and kind based on API key prefixes. */
    function detectKeyProvider(apiKey) {
        const key = String(apiKey || '').trim();
        if (key.startsWith('AIzaSy')) {
            return { provider: 'gemini', kind: 'gemini', defaultModel: 'gemini-2.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' };
        }
        if (key.startsWith('sk-or-')) {
            return { provider: 'openrouter', kind: 'openai', defaultModel: 'deepseek/deepseek-chat:free', baseUrl: 'https://openrouter.ai/api/v1' };
        }
        if (key.startsWith('gsk_')) {
            return { provider: 'groq', kind: 'openai', defaultModel: 'llama-3.3-70b-versatile', baseUrl: 'https://api.groq.com/openai/v1' };
        }
        if (key.startsWith('sk-ant-')) {
            return { provider: 'anthropic', kind: 'openai', defaultModel: 'claude-3-5-sonnet-20241022', baseUrl: 'https://api.anthropic.com/v1' };
        }
        if (config.provider && config.provider !== 'auto') {
            const p = config.provider;
            const kind = (p === 'gemini' || p === 'google') ? 'gemini' : 'openai';
            return { provider: p, kind: kind, defaultModel: PROVIDERS[p]?.defaultModel || 'gemini-2.5-flash', baseUrl: PROVIDERS[p]?.baseUrl || '' };
        }
        return { provider: 'gemini', kind: 'gemini', defaultModel: 'gemini-2.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' };
    }

    /** Wraps a fetch() call with CORS/network error detection & automatic proxy fallback. */
    async function safeFetch(url, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        let combinedSignal = controller.signal;
        if (options.signal) {
            if (typeof AbortSignal !== 'undefined' && AbortSignal.any) {
                combinedSignal = AbortSignal.any([controller.signal, options.signal]);
            } else {
                options.signal.addEventListener('abort', () => controller.abort(options.signal.reason), { once: true });
            }
        }

        try {
            // First attempt: direct fetch
            const res = await fetch(url, { ...options, signal: combinedSignal });
            clearTimeout(timeout);
            return res;
        } catch (e) {
            clearTimeout(timeout);
            if (e.name === 'AbortError') {
                if (options.signal && options.signal.aborted) {
                    throw options.signal.reason || e;
                }
                throw new Error('Request timed out (60s).');
            }

            const msg = String(e.message || e);
            const isCorsOrNetwork = /cors|network|Failed to fetch|load failed/i.test(msg);

            // 🚀 AUTOMATIC PROXY FALLBACK WHEN BROWSER BLOCKS CORS 🚀
            if (isCorsOrNetwork && !url.includes('/api/proxy')) {
                try {
                    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
                    const proxyRes = await fetch(proxyUrl, { ...options, signal: options.signal });
                    // CRITICAL: Reject 404/405/502 from local static servers (like Live Server)
                    if (proxyRes.ok || (proxyRes.status !== 404 && proxyRes.status !== 405 && proxyRes.status !== 502)) {
                        return proxyRes;
                    }
                } catch (proxyErr) {
                    // Proxy failed, fall through to informative error
                }
                throw new Error('CORS or network error — browser cannot reach this API directly. Check API key, internet connection, or run via `node server.js`.');
            }
            throw e;
        }
    }

    /**
     * Runs one prompt through the router: the best model first, automatic
     * failover to the next one when a model fails or hangs.
     */
    async function runWithRouter(promptText, attachment) {
        const chain = buildRouterChain(config.provider, availableModels, '');
        const usable = chain.filter(c => !c.disabled);

        if (!usable.length) {
            // No catalogue → fall back to the plain single-model path
            return runSingleAgent(promptText, attachment);
        }

        const dispatch = (cand, attempt) => {
            // A candidate may come from the API Connect Hub — then it carries
            // its own base URL / key and speaks its own protocol.
            let over = null;
            if (cand.hubProvider && typeof APIHub !== 'undefined' && APIHub.credentials) {
                over = APIHub.credentials(cand.hubProvider);
            }
            if (!over || !over.key) {
                const detected = detectKeyProvider(config.apiKey);
                const prov = cand.hubProvider || detected.provider || 'gemini';
                const isGem = prov === 'gemini' || prov === 'google' || cand.id.startsWith('gemini');
                over = {
                    id: prov,
                    name: prov,
                    baseUrl: isGem ? 'https://generativelanguage.googleapis.com/v1beta' : (config.baseUrl || PROVIDERS[prov]?.baseUrl || 'https://openrouter.ai/api/v1'),
                    kind: isGem ? 'gemini' : 'openai',
                    key: config.apiKey,
                    keyless: false
                };
            }

            const isGeminiModel = cand.id.startsWith('gemini') || (over && over.kind === 'gemini') || (cand.hubProvider === 'google' || cand.hubProvider === 'gemini');
            if (isGeminiModel) {
                return runGeminiAgent(promptText, cand.id, attempt, over, attachment);
            }
            return runOpenAIAgent(promptText, cand.id, attempt, over, attachment);
        };

        const result = await AIModelRouter.runChain(usable, dispatch, {
            timeBudgetMs: routerBudgetMs(),
            attemptTimeoutMs: routerAttemptTimeoutMs(),
            hedgeMs: routerHedgeEnabled() ? routerHedgeMs() : 0
        });

        lastRoutedModel = result.model;
        renderRouterPanel();
        return result;
    }

    /** The single-model path (used when a specific provider is selected). */
    async function runSingleAgent(promptText, attachment) {
        let creds = null;
        if (typeof APIHub !== 'undefined' && APIHub.credentials && config.provider !== 'auto') {
            creds = APIHub.credentials(config.provider);
        }
        if (!creds && config.apiKey) {
            const detected = detectKeyProvider(config.apiKey);
            const activeProv = (config.provider && config.provider !== 'auto') ? config.provider : detected.provider;
            const isGem = activeProv === 'gemini' || activeProv === 'google' || detected.kind === 'gemini';
            creds = {
                id: activeProv,
                name: activeProv,
                baseUrl: config.baseUrl || detected.baseUrl || (PROVIDERS[activeProv]?.baseUrl || ''),
                kind: isGem ? 'gemini' : 'openai',
                key: config.apiKey,
                keyless: false
            };
        }
        const isGemini = (creds && creds.kind === 'gemini') || (config.provider === 'gemini' || config.provider === 'google');
        const activeModel = (config.model && config.model !== 'auto')
            ? config.model
            : (isGemini ? 'gemini-2.5-flash' : (PROVIDERS[creds?.id]?.defaultModel || 'gpt-4o-mini'));
        if (isGemini) {
            return runGeminiAgent(promptText, activeModel, null, creds, attachment);
        }
        return runOpenAIAgent(promptText, activeModel, null, creds, attachment);
    }

    /** The model that answered the previous prompt (shown in the AI header). */
    let lastRoutedModel = '';

    // ── Router panel (settings modal) ──────────────────────────────────────
    /** Human readable health colour for a candidate. */
    function healthClass(health) {
        if (health === 'good') return 'rt-dot good';
        if (health === 'fair') return 'rt-dot fair';
        if (health === 'poor') return 'rt-dot poor';
        if (health === 'down') return 'rt-dot down';
        return 'rt-dot unknown';
    }

    /** Renders the live router panel (chain, health, stats). */
    function renderRouterPanel() {
        const host = document.getElementById('ai-router-chain');
        if (!host) return;

        const provider = (document.getElementById('ai-provider-select')?.value) || config.provider;
        const models = availableModels;
        const chain = buildRouterChain(provider, models, '');

        if (!chain.length) {
            host.innerHTML = '<div class="rt-empty">Connect first — the router needs your model list to build a chain.</div>';
            const summary = document.getElementById('ai-router-summary');
            if (summary) summary.textContent = '';
            return;
        }

        const rows = chain.map((c, i) => {
            const st = c.stats || {};
            const rate = st.successRate === null || st.successRate === undefined
                ? '—'
                : Math.round(st.successRate * 100) + '%';
            const latency = st.avgLatency ? Math.round(st.avgLatency) + ' ms' : '—';
            const flags = [];
            if (c.disabled) flags.push('<span class="rt-flag off">off</span>');
            if (c.benched) flags.push('<span class="rt-flag bench">benched</span>');
            if (c.breakerOpen) flags.push('<span class="rt-flag bench">breaker</span>');
            if (c.penalty > 0) flags.push('<span class="rt-flag pen">−' + c.penalty + '</span>');

            return `
                <div class="rt-row${c.disabled ? ' disabled' : ''}" data-model="${IDEUtils.escapeAttr(c.id)}">
                    <span class="rt-rank">${i + 1}</span>
                    <span class="${healthClass(c.health)}" title="${c.health}"></span>
                    <span class="rt-name" title="${IDEUtils.escapeAttr(c.id)}">${IDEUtils.escapeHtml(c.label)}</span>
                    <span class="rt-metrics">
                        <span title="success rate">${rate}</span>
                        <span title="average latency">${latency}</span>
                        <span title="router score">${(c.score * 100).toFixed(0)}</span>
                    </span>
                    <span class="rt-flags">${flags.join('')}</span>
                    <button class="rt-toggle" title="${c.disabled ? 'Enable this model' : 'Disable this model'}"
                        onclick="AIAgent.toggleRouterModel('${IDEUtils.jsString(c.id)}')">
                        <i class="fas ${c.disabled ? 'fa-toggle-off' : 'fa-toggle-on'}"></i>
                    </button>
                </div>`;
        }).join('');

        host.innerHTML = rows;

        const summary = document.getElementById('ai-router-summary');
        if (summary) {
            let ok = 0, fail = 0;
            chain.forEach(c => {
                ok += c.stats && c.stats.successes ? c.stats.successes : 0;
                fail += c.stats && c.stats.failures ? c.stats.failures : 0;
            });
            const rate = (ok + fail) ? Math.round((ok / (ok + fail)) * 100) : null;
            summary.textContent = chain.length + ' models in chain' +
                (rate !== null ? ' · ' + rate + '% success' : ' · no data yet') +
                (lastRoutedModel ? ' · last: ' + lastRoutedModel : '');
        }

        updateRunningModelBadge();
    }

    function updateRunningModelBadge() {
        const nameEl = document.getElementById('ai-running-model-name');
        const subEl = document.getElementById('ai-running-model-sub');
        const badgeEl = document.getElementById('ai-running-status-badge');

        if (!nameEl) return;

        if (isRouterEnabled() || !config.provider || config.provider === 'auto') {
            if (lastRoutedModel) {
                nameEl.textContent = `${lastRoutedModel} (Auto Selected)`;
                if (subEl) subEl.textContent = `Last query answered by ${lastRoutedModel}. Dynamic failover enabled across all connected APIs.`;
            } else {
                nameEl.textContent = '⚡ Auto Router Active (All Connected APIs)';
                if (subEl) subEl.textContent = 'Will automatically pick the best live model among all connected APIs upon prompt.';
            }
            if (badgeEl) {
                badgeEl.textContent = 'Auto Select Active';
                badgeEl.className = 'conn-badge conn-ok';
            }
        } else {
            const label = (config.model && config.model !== 'auto') ? config.model : (PROVIDERS[config.provider]?.name || config.provider);
            nameEl.textContent = `${label} (Manual Mode Locked)`;
            if (subEl) subEl.textContent = `Locked to ${PROVIDERS[config.provider]?.name || config.provider}. Auto failover disabled.`;
            if (badgeEl) {
                badgeEl.textContent = 'Manual Mode Locked';
                badgeEl.className = 'conn-badge conn-idle';
            }
        }
    }

    /** Enables / disables a single model in the chain. */
    function toggleRouterModel(modelId) {
        if (typeof AIModelRouter === 'undefined') return;
        const provider = (document.getElementById('ai-provider-select')?.value) || config.provider;
        const next = !AIModelRouter.isModelDisabled(provider, modelId);
        AIModelRouter.setModelDisabled(provider, modelId, next);
        renderRouterPanel();
    }

    /** Turns the auto router on / off. */
    function setRouterEnabled(enabled) {
        setRouterPref('aiRouterEnabled', !!enabled);
        renderRouterPanel();
    }

    /** Changes the scoring strategy. */
    function setRouterStrategy(strategy) {
        setRouterPref('aiRouterStrategy', strategy);
        renderRouterPanel();
    }

    let isRouterEditing = false;

    function toggleRouterEdit() {
        isRouterEditing = !isRouterEditing;
        updateRouterControlsUI();
    }

    function resetRouterDefaults() {
        setRouterPref('aiRouterStrategy', 'balanced');
        setRouterPref('aiRouterBudgetMs', 45000);
        setRouterPref('aiRouterHedge', true);

        const strat = document.getElementById('ai-router-strategy');
        const budget = document.getElementById('ai-router-budget');
        const hedge = document.getElementById('ai-router-hedge');

        if (strat) strat.value = 'balanced';
        if (budget) budget.value = '45';
        if (hedge) hedge.checked = true;

        handleRouterBudgetInput(45);
        renderRouterPanel();

        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast("Router defaults restored: Balanced Strategy · 45s Time Budget · Race Mode ON", "info");
        }
    }

    function applyRouterPreset(name) {
        let strat = 'balanced', sec = 45;
        if (name === 'fast') { strat = 'fastest'; sec = 15; }
        else if (name === 'deep') { strat = 'smartest'; sec = 90; }
        else if (name === 'max') { strat = 'reliable'; sec = 180; }
        else { strat = 'balanced'; sec = 45; }

        setRouterPref('aiRouterStrategy', strat);
        setRouterPref('aiRouterBudgetMs', sec * 1000);

        const stratEl = document.getElementById('ai-router-strategy');
        const budgetEl = document.getElementById('ai-router-budget');
        if (stratEl) stratEl.value = strat;
        if (budgetEl) budgetEl.value = String(sec);

        handleRouterBudgetInput(sec);
        renderRouterPanel();

        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast(`Router preset applied: ${strat.toUpperCase()} (${sec}s budget)`, "success");
        }
    }

    function handleRouterBudgetInput(seconds) {
        const sec = Math.max(10, Math.min(180, parseInt(seconds, 10) || 45));
        const valText = sec + 's';
        const out = document.getElementById('ai-router-budget-value');
        const chip = document.getElementById('chip-router-budget');
        if (out) out.textContent = valText;
        if (chip) chip.textContent = valText;
        setRouterPref('aiRouterBudgetMs', sec * 1000);
    }

    function updateRouterControlsUI() {
        const card = document.getElementById('ai-router-controls-card');
        const strat = document.getElementById('ai-router-strategy');
        const budget = document.getElementById('ai-router-budget');
        const hedge = document.getElementById('ai-router-hedge');
        const editBtn = document.getElementById('ai-router-edit-btn');
        const badge = document.getElementById('ai-router-state-badge');

        if (!card) return;

        if (isRouterEditing) {
            card.classList.add('editing');
            if (strat) strat.disabled = false;
            if (budget) budget.disabled = false;
            if (hedge) hedge.disabled = false;
            if (editBtn) {
                editBtn.innerHTML = '<i class="fas fa-check"></i> Done';
                editBtn.classList.add('btn-primary');
                editBtn.classList.remove('btn-secondary');
            }
            if (badge) {
                badge.className = 'ai-tuning-state-badge unlocked';
                badge.innerHTML = '<i class="fas fa-lock-open"></i> Editing';
            }
        } else {
            card.classList.remove('editing');
            if (strat) strat.disabled = true;
            if (budget) budget.disabled = true;
            if (hedge) hedge.disabled = true;
            if (editBtn) {
                editBtn.innerHTML = '<i class="fas fa-pen-to-square"></i> Edit';
                editBtn.classList.remove('btn-primary');
                editBtn.classList.add('btn-secondary');
            }
            if (badge) {
                badge.className = 'ai-tuning-state-badge locked';
                badge.innerHTML = '<i class="fas fa-lock"></i> Locked';
            }
        }
    }

    /** Changes the total time budget for one routed request. */
    function setRouterBudget(ms) {
        setRouterPref('aiRouterBudgetMs', Math.max(5000, Number(ms) || 45000));
        renderRouterPanel();
    }

    /** Turns the parallel hedge (race) on / off. */
    function setRouterHedge(enabled) {
        setRouterPref('aiRouterHedge', !!enabled);
        renderRouterPanel();
    }

    /** Wipes every learned statistic. */
    function resetRouterStats() {
        if (typeof AIModelRouter === 'undefined') return;
        AIModelRouter.resetStats();
        renderRouterPanel();
        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast("Router statistics reset — every model starts fresh.", "success");
        }
    }

    /** Refreshes the router panel (called after models are loaded). */
    function refreshRouter() {
        renderRouterPanel();
    }

    function updateContextBar() {
        const fileLabel = document.getElementById('ai-active-file-label');
        const countLabel = document.getElementById('ai-vfs-files-count');
        if (fileLabel && typeof App !== 'undefined' && App.getCurrentFile) {
            fileLabel.textContent = `Editing: ${App.getCurrentFile() || 'index.html'}`;
        }
        if (countLabel && typeof VFS !== 'undefined' && VFS.getAllPaths) {
            const total = VFS.getAllPaths().length;
            countLabel.textContent = `${total} file${total === 1 ? '' : 's'} in project`;
        }
    }

    // 📎 ATTACHED IMAGE STATE & UTILS
    let attachedImage = null; // { name, size, mimeType, base64, dataUrl }

    function triggerImageUpload() {
        const fileInput = document.getElementById('ai-image-input');
        if (fileInput) fileInput.click();
    }

    function handleImageUpload(e) {
        const file = e.target && e.target.files && e.target.files[0];
        if (!file) return;
        processImageFile(file);
        e.target.value = '';
    }

    function processImageFile(file) {
        if (!file || !file.type || !file.type.startsWith('image/')) {
            App.showToast('Please select a valid image file (PNG, JPG, WebP, GIF, SVG)', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            App.showToast('Image size should be less than 10MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(evt) {
            const dataUrl = evt.target.result;
            const base64 = dataUrl.split(',')[1];
            attachedImage = {
                name: file.name,
                size: (file.size / 1024).toFixed(1) + ' KB',
                mimeType: file.type,
                base64: base64,
                dataUrl: dataUrl
            };
            renderAttachmentPreview();

            const input = document.getElementById('ai-prompt-input');
            if (input && window.innerWidth > 768) input.focus();

            const sendBtn = document.getElementById('ai-send-btn');
            if (sendBtn) sendBtn.classList.add('has-text');
        };
        reader.readAsDataURL(file);
    }

    function clearAttachment() {
        attachedImage = null;
        renderAttachmentPreview();
        const input = document.getElementById('ai-prompt-input');
        const sendBtn = document.getElementById('ai-send-btn');
        if (sendBtn && (!input || !input.value.trim())) {
            sendBtn.classList.remove('has-text');
        }
    }

    function renderAttachmentPreview() {
        const previewContainer = document.getElementById('ai-attachment-preview');
        if (!previewContainer) return;

        if (!attachedImage) {
            previewContainer.innerHTML = '';
            previewContainer.style.display = 'none';
            return;
        }

        previewContainer.style.display = 'flex';
        previewContainer.innerHTML = `
            <img src="${attachedImage.dataUrl}" class="ai-attachment-thumb" alt="Preview">
            <div class="ai-attachment-meta">
                <span class="ai-attachment-name" title="${escapeHtml(attachedImage.name)}">${escapeHtml(attachedImage.name)}</span>
                <span class="ai-attachment-size">${attachedImage.size}</span>
            </div>
            <button type="button" class="ai-attachment-remove" onclick="AIAgent.clearAttachment()" title="Remove image">
                <i class="fas fa-times"></i>
            </button>
        `;
    }

    function handleInputPaste(event) {
        if (!event.clipboardData || !event.clipboardData.items) return;
        const items = event.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type && items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    processImageFile(blob);
                    event.preventDefault();
                    return;
                }
            }
        }
    }

    // Helper to format model badge cleanly (e.g. nvidia/nemotron-3-nano...:free -> ⚡ nemotron-3-nano…)
    function formatModelBadge(rawModel) {
        if (!rawModel) return '';
        const rawStr = String(rawModel).trim();
        let clean = rawStr.replace(/:(free|beta|extended|latest)$/i, '');
        if (clean.includes('/')) {
            const parts = clean.split('/');
            clean = parts[parts.length - 1];
        }
        if (clean.length > 18) {
            clean = clean.substring(0, 16) + '…';
        }
        return `<span class="ai-msg-model-badge" title="${IDEUtils.escapeAttr(rawStr)}">⚡ ${escapeHtml(clean)}</span>`;
    }

    let currentLoadingStatus = "Thinking...";

    function updateLoadingStatus(text) {
        currentLoadingStatus = text || "Thinking...";
        const el = document.getElementById('ai-gemini-loading-label');
        if (el) el.textContent = currentLoadingStatus;
    }

    // ⚡ REAL-TIME LIVE STREAMING TOKEN RENDERER
    let streamStartTime = 0;

    function resetStreamMetrics() {
        streamStartTime = Date.now();
    }

    function formatStreamingMarkdown(text) {
        if (!text) return '';
        let processed = text;
        // Auto-close unclosed code fences while streaming so code looks formatted live
        const codeMatches = processed.match(/```/g);
        if (codeMatches && codeMatches.length % 2 !== 0) {
            processed += '\n```';
        }
        return formatMarkdown(processed);
    }

    function onStreamChunk(streamData) {
        if (!streamData) return;
        const currentText = typeof streamData === 'string' ? streamData : (streamData.text || '');
        const reasoningText = (typeof streamData === 'object' && streamData.reasoning) ? streamData.reasoning : '';

        if (!currentText && !reasoningText) return;

        let placeholder = document.getElementById('ai-loading-placeholder');
        const streamContainer = document.getElementById('ai-chat-stream');
        if (!placeholder) {
            renderChat();
            placeholder = document.getElementById('ai-loading-placeholder');
            if (!placeholder) return;
        }

        const bubble = placeholder.querySelector('.ai-bubble');
        if (!bubble) return;

        bubble.classList.remove('ai-gemini-loading-bubble');

        // Calculate live token speed and word count
        const allText = (currentText + ' ' + reasoningText).trim();
        const wordCount = allText ? allText.split(/\s+/).filter(Boolean).length : 0;
        const elapsedSec = streamStartTime ? Math.max(0.1, (Date.now() - streamStartTime) / 1000) : 0.5;
        const wordsPerSec = Math.round(wordCount / elapsedSec);

        // 1. Live Thinking / Reasoning Accordion
        let thoughtHtml = '';
        if (reasoningText) {
            const thinkWordCount = reasoningText.split(/\s+/).filter(Boolean).length;
            thoughtHtml = `
                <details class="ai-thought-box" open>
                    <summary class="ai-thought-summary">
                        <div class="ai-thought-summary-left">
                            <i class="fas fa-brain fa-spin" style="color:#c084fc;"></i>
                            <span>Thinking Process</span>
                            <span class="ai-thought-status-badge live">Reasoning (${thinkWordCount} words)...</span>
                        </div>
                        <span class="ai-thought-chevron"><i class="fas fa-chevron-down"></i></span>
                    </summary>
                    <div class="ai-thought-content">
                        ${escapeHtml(reasoningText)}<span class="ai-streaming-cursor"></span>
                    </div>
                </details>
            `;
        }

        // 2. Live Content
        let contentHtml = '';
        if (currentText) {
            contentHtml = `<div class="ai-msg-content">${formatStreamingMarkdown(currentText)}<span class="ai-streaming-cursor"></span></div>`;
        }

        // 3. Live Streaming Stats Badge Bar
        const metaHtml = `
            <div class="ai-streaming-live-meta">
                <span class="ai-live-pulse-dot"></span>
                <div class="ai-live-tok-info">
                    <span class="tok-badge words"><i class="fas fa-font"></i> ${wordCount} words</span>
                    <span class="tok-badge time"><i class="fas fa-clock"></i> ${elapsedSec.toFixed(1)}s</span>
                    <span class="tok-badge speed"><i class="fas fa-bolt"></i> ${wordsPerSec} w/s</span>
                    <span class="tok-status">Live streaming…</span>
                </div>
            </div>
        `;

        bubble.innerHTML = thoughtHtml + contentHtml + metaHtml;

        if (streamContainer) {
            streamContainer.scrollTop = streamContainer.scrollHeight;
        }
    }

    // 💬 CHAT RENDERING
    function renderChat() {
        const container = document.getElementById('ai-chat-stream');
        if (!container) return;

        updateContextBar();

        if (!Array.isArray(messages) || messages.length === 0) {
            loadChat();
        }

        try {
            const html = messages.map((msg, index) => {
                if (!msg || typeof msg !== 'object') return '';
                const rawText = (msg.text !== undefined && msg.text !== null) ? msg.text : (msg.content || '');
                const timeStr = formatMsgTime(msg.timestamp);

                if (msg.role === 'user') {
                    const imgHtml = msg.image ? `<img src="${msg.image}" class="ai-bubble-image" alt="Attached photo">` : '';
                    return `
                        <div class="ai-msg user" id="ai-msg-${index}">
                            <div class="ai-msg-header user">
                                <span class="ai-msg-sender">You</span>
                                <span class="ai-msg-time">${timeStr}</span>
                            </div>
                            <div class="ai-bubble user">
                                ${imgHtml}
                                ${rawText ? `<div class="ai-msg-content">${escapeHtml(rawText).replace(/\n/g, '<br>')}</div>` : ''}
                            </div>
                        </div>
                    `;
                } else {
                    // Agent message
                    // 1. Thinking / Reasoning box
                    let thoughtHtml = '';
                    if (msg.thinking) {
                        thoughtHtml = `
                            <details class="ai-thought-box" open>
                                <summary class="ai-thought-summary">
                                    <div class="ai-thought-summary-left">
                                        <i class="fas fa-brain"></i>
                                        <span>Thinking Process</span>
                                        <span class="ai-thought-status-badge">Reasoned</span>
                                    </div>
                                    <span class="ai-thought-chevron"><i class="fas fa-chevron-down"></i></span>
                                </summary>
                                <div class="ai-thought-content">
                                    ${escapeHtml(msg.thinking).replace(/\n/g, '<br>')}
                                </div>
                            </details>
                        `;
                    }

                    // 2. Diff cards for modified files
                    let diffCardsHtml = '';
                    if (Array.isArray(msg.toolsExecuted) && msg.toolsExecuted.length > 0) {
                        diffCardsHtml = msg.toolsExecuted.map(t => {
                            if (!t || !t.path) return '';
                            const toolId = t.toolId || ('diff-' + Math.random().toString(36).substring(2, 9));
                            t.toolId = toolId;
                            const isDelete = t.action === 'delete';
                            const isCreate = t.action === 'create';
                            const actionLabel = isDelete ? 'Deleted' : (isCreate ? 'Created' : 'Updated');
                            const addedCount = t.added || 0;
                            const removedCount = t.removed || 0;

                            let diffLinesHtml = '';
                            if (Array.isArray(t.lines) && t.lines.length > 0) {
                                diffLinesHtml = t.lines.map((l, lIdx) => {
                                    const isAdd = l.type === '+';
                                    const isDel = l.type === '-';
                                    const lineCls = isAdd ? 'diff-line-add' : (isDel ? 'diff-line-del' : 'diff-line-same');
                                    const marker = isAdd ? '+' : (isDel ? '-' : ' ');
                                    return `
                                        <div class="diff-line ${lineCls}">
                                            <span class="diff-num">${l.num || lIdx + 1}</span>
                                            <span class="diff-marker">${marker}</span>
                                            <span class="diff-code">${escapeHtml(l.text)}</span>
                                        </div>
                                    `;
                                }).join('');
                            } else {
                                diffLinesHtml = `<div class="diff-empty-note">File ${actionLabel}: ${escapeHtml(t.path)}</div>`;
                            }

                            return `
                                <div class="ai-diff-card ${isDelete ? 'del' : ''}" id="diff-card-${toolId}">
                                    <div class="ai-diff-header" onclick="AIAgent.toggleDiff('${toolId}')">
                                        <div class="ai-diff-info">
                                            <span class="ai-diff-icon ${isDelete ? 'del' : ''}">
                                                <i class="fas fa-${isDelete ? 'trash' : 'file-code'}"></i>
                                            </span>
                                            <span class="ai-diff-filename" title="${IDEUtils.escapeAttr(t.path)}">${IDEUtils.escapeHtml(t.path)}</span>
                                            ${!isDelete ? `<span class="ai-diff-badge-add">+${addedCount}</span>` : ''}
                                            ${removedCount > 0 ? `<span class="ai-diff-badge-del">-${removedCount}</span>` : ''}
                                        </div>
                                        <div class="ai-diff-actions" onclick="event.stopPropagation()">
                                            ${!isDelete ? `
                                                <button type="button" class="ai-diff-btn" onclick="App.openFile('${IDEUtils.escapeAttr(t.path)}')" title="Open file in editor">
                                                    <i class="fas fa-arrow-up-right-from-square"></i> Open
                                                </button>
                                                <button type="button" class="ai-diff-btn" onclick="AIAgent.copyDiffContent('${toolId}')" title="Copy file code">
                                                    <i class="fas fa-copy"></i> Copy
                                                </button>
                                            ` : ''}
                                            <button type="button" class="ai-diff-btn ai-diff-toggle-btn" onclick="AIAgent.toggleDiff('${toolId}')" title="Toggle Diff View">
                                                <i class="fas fa-code-compare"></i> Diff
                                            </button>
                                        </div>
                                    </div>
                                    <div class="ai-diff-body" id="diff-body-${toolId}" style="display:none;">
                                        <div class="ai-diff-table">
                                            ${diffLinesHtml}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('');
                    }

                    const modelBadge = formatModelBadge(msg.model);

                    return `
                        <div class="ai-msg agent" id="ai-msg-${index}">
                            <div class="ai-msg-header agent">
                                <div class="ai-avatar agent" title="AI Agent">
                                    <i class="fas fa-brain"></i>
                                </div>
                                <span class="ai-msg-sender">AI Agent</span>
                                ${modelBadge}
                                <span class="ai-msg-time">${timeStr}</span>
                            </div>
                            <div class="ai-bubble agent">
                                ${thoughtHtml}
                                ${diffCardsHtml}
                                <div class="ai-msg-content" id="ai-msg-text-${index}">${formatMarkdown(rawText)}</div>
                                <div class="ai-msg-footer">
                                    <button type="button" class="ai-msg-action-btn" onclick="AIAgent.copyMessageText(${index})" title="Copy response text">
                                        <i class="fas fa-copy"></i> Copy
                                    </button>
                                    <button type="button" class="ai-msg-action-btn" onclick="AIAgent.retryLastMessage()" title="Retry request">
                                        <i class="fas fa-rotate"></i> Retry
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }).join('');

            // In-stream Gemini Loading Animation placeholder when waiting for AI response
            let loadingHtml = '';
            if (isBusy) {
                const activeModel = (typeof Router !== 'undefined' && Router.getActiveModel) ? Router.getActiveModel() : (config.model || 'AI Agent');
                const modelBadge = formatModelBadge(activeModel);
                loadingHtml = `
                    <div class="ai-msg agent ai-msg-loading" id="ai-loading-placeholder">
                        <div class="ai-msg-header agent">
                            <div class="ai-avatar agent" title="AI Agent">
                                <i class="fas fa-brain"></i>
                            </div>
                            <span class="ai-msg-sender">AI Agent</span>
                            ${modelBadge}
                        </div>
                        <div class="ai-bubble agent ai-gemini-loading-bubble">
                            <div class="gemini-aurora-glow"></div>
                            <div class="gemini-loading-wrap">
                                <div class="gemini-dots">
                                    <span class="gemini-dot d1"></span>
                                    <span class="gemini-dot d2"></span>
                                    <span class="gemini-dot d3"></span>
                                </div>
                                <span class="gemini-loading-text" id="ai-gemini-loading-label">${escapeHtml(currentLoadingStatus)}</span>
                            </div>
                        </div>
                    </div>
                `;
            }

            container.innerHTML = (html + loadingHtml) || `
                <div class="ai-msg agent">
                    <div class="ai-msg-header agent">
                        <div class="ai-avatar agent"><i class="fas fa-brain"></i></div>
                        <span class="ai-msg-sender">AI Agent</span>
                    </div>
                    <div class="ai-bubble agent">
                        <div class="ai-msg-content">👋 <b>Hello!</b> I am your Autonomous In-IDE AI Agent.<br>Ask me anything to write code, design websites, debug errors, or refactor code.</div>
                    </div>
                </div>
            `;
            container.scrollTop = container.scrollHeight;
        } catch (e) {
            console.error("renderChat error:", e);
            container.innerHTML = `<div class="ai-msg agent"><div class="ai-bubble">👋 Hello! How can I help you build your web app today?</div></div>`;
        }

        updateChipsVisibility();
    }

    // 💡 STARTER CHIPS VISIBILITY: Only visible before writing/starting chat
    function updateChipsVisibility() {
        const chipsWrap = document.getElementById('ai-chips-wrap');
        const input = document.getElementById('ai-prompt-input');
        if (!chipsWrap) return;

        const hasUserChatted = Array.isArray(messages) && messages.some(m => m && m.role === 'user');
        const isTyping = !!(input && input.value && input.value.trim().length > 0);

        if (hasUserChatted || isTyping) {
            chipsWrap.classList.add('hidden');
        } else {
            chipsWrap.classList.remove('hidden');
        }
    }

    // 📐 AUTO-RESIZE INPUT TEXTAREA (Expands dynamically with text lines)
    function autoResize(el) {
        if (!el) el = document.getElementById('ai-prompt-input');
        if (!el) return;

        // Reset height to let scrollHeight calculate accurately
        el.style.height = 'auto';

        const isMobile = window.innerWidth <= 768;
        const minH = isMobile ? 20 : 22;
        const maxH = isMobile ? 110 : 140;

        const contentHeight = el.scrollHeight;
        const targetHeight = Math.min(Math.max(contentHeight, minH), maxH);
        el.style.height = targetHeight + 'px';
        el.style.overflowY = contentHeight > maxH ? 'auto' : 'hidden';

        // Toggle send button active gradient state
        const sendBtn = document.getElementById('ai-send-btn');
        if (sendBtn) {
            const hasText = (el && el.value.trim().length > 0) || !!attachedImage;
            if (hasText) {
                sendBtn.classList.add('has-text');
            } else {
                sendBtn.classList.remove('has-text');
            }
        }

        // Hide starter chips when user starts typing
        updateChipsVisibility();
    }

    // ⌨️ INPUT KEYDOWN HANDLER (Smart Mobile / Desktop behavior)
    function handleInputKeydown(event) {
        if (!event) return;
        // Ignore IME composition events (e.g., Hindi / Japanese keyboard autocomplete)
        if (event.isComposing || event.keyCode === 229) return;

        if (event.key === 'Enter') {
            const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth <= 1024);
            if (isMobile) {
                // On mobile keyboards, the bottom-right key is the Return/Newline key.
                // It works like Shift+Enter (inserts a newline \n) and allows text box to auto-expand.
                // It must NEVER send or open settings!
                if (event.ctrlKey) {
                    event.preventDefault();
                    sendMessage();
                    return;
                }
                // Allow default newline insertion and trigger autoResize
                setTimeout(() => {
                    const el = document.getElementById('ai-prompt-input');
                    if (el) autoResize(el);
                }, 10);
                return;
            }

            // On desktop: Enter sends message, Shift+Enter creates a newline
            if (!event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        }
    }

    // 📐 CODE DIFF COMPUTATION ENGINE
    function computeDiff(oldStr, newStr) {
        const oldLines = (oldStr !== undefined && oldStr !== null && oldStr !== '') ? String(oldStr).split('\n') : [];
        const newLines = (newStr !== undefined && newStr !== null && newStr !== '') ? String(newStr).split('\n') : [];

        const N = oldLines.length;
        const M = newLines.length;

        if (N === 0) {
            return {
                added: M,
                removed: 0,
                lines: newLines.map((l, idx) => ({ type: '+', text: l, num: idx + 1 }))
            };
        }
        if (M === 0) {
            return {
                added: 0,
                removed: N,
                lines: oldLines.map((l, idx) => ({ type: '-', text: l, num: idx + 1 }))
            };
        }

        // Fast path for large files (> 600 lines) to avoid heavy matrix allocation
        if (N > 600 || M > 600) {
            return {
                added: M,
                removed: N,
                lines: [
                    ...oldLines.slice(0, 35).map((l, idx) => ({ type: '-', text: l, num: idx + 1 })),
                    { type: ' ', text: `... (${N} lines replaced with ${M} new lines) ...`, num: '…' },
                    ...newLines.slice(0, 35).map((l, idx) => ({ type: '+', text: l, num: idx + 1 }))
                ]
            };
        }

        const dp = Array.from({ length: N + 1 }, () => new Int32Array(M + 1));
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < M; j++) {
                if (oldLines[i] === newLines[j]) {
                    dp[i + 1][j + 1] = dp[i][j] + 1;
                } else {
                    dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
                }
            }
        }

        const diff = [];
        let i = N, j = M;
        let added = 0, removed = 0;

        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
                diff.push({ type: ' ', text: oldLines[i - 1], num: j });
                i--;
                j--;
            } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                diff.push({ type: '+', text: newLines[j - 1], num: j });
                added++;
                j--;
            } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
                diff.push({ type: '-', text: oldLines[i - 1], num: i });
                removed++;
                i--;
            }
        }

        diff.reverse();
        return { added, removed, lines: diff };
    }

    // 🚀 EXECUTE TOOLS ON VFS
    function executeTool(rawName, rawArgs, attempt) {
        if (attempt && attempt.superseded) {
            return { status: "skipped", message: "Superseded by a faster model — this attempt changed nothing." };
        }

        const toolId = 'diff-' + Math.random().toString(36).substring(2, 9);
        const args = (rawArgs && typeof rawArgs === 'object') ? rawArgs : {};

        // Robust argument extraction (handles filename, file_path, code, etc.)
        const path = String(args.path || args.filePath || args.file_path || args.filename || args.fileName || args.name || args.file || '').trim();
        const content = (args.content !== undefined) 
            ? String(args.content) 
            : ((args.code !== undefined) ? String(args.code) : ((args.file_content !== undefined) ? String(args.file_content) : String(args.text || '')));

        // Robust tool name mapping (handles aliases models often produce)
        const nameClean = String(rawName || '').toLowerCase().replace(/[-_]/g, '');
        let name = rawName;
        if (nameClean.includes('list') || nameClean.includes('dir') || nameClean === 'ls' || nameClean.includes('tree') || nameClean.includes('projectfile')) {
            name = 'list_project_files';
        } else if (nameClean.includes('read') || nameClean.includes('view') || nameClean.includes('open') || nameClean.includes('cat') || nameClean.includes('getfile') || nameClean.includes('showfile')) {
            name = 'read_file';
        } else if (nameClean.includes('delete') || nameClean.includes('remove') || nameClean === 'rm' || nameClean.includes('del')) {
            name = 'delete_file';
        } else if (nameClean.includes('create') || nameClean.includes('write') || nameClean.includes('update') || nameClean.includes('save') || nameClean.includes('edit') || nameClean.includes('put')) {
            name = 'create_or_update_file';
        }

        if (name === "create_or_update_file") {
            if (!path) {
                return { error: "Missing required argument 'path'. Please specify which file to create or update." };
            }
            const existingFile = VFS.get(path);
            const oldContent = existingFile ? (existingFile.content || '') : '';
            const diffResult = computeDiff(oldContent, content);
            const action = existingFile ? 'update' : 'create';

            VFS.set(path, content);
            App.renderExplorer();
            App.updatePreview();
            if (App.getCurrentFile() === path) {
                EditorController.setContent(content, VFS.detectType(path));
            }
            return {
                status: "success",
                message: `Successfully wrote file: ${path}`,
                diffInfo: {
                    toolId: toolId,
                    action: action,
                    path: path,
                    added: diffResult.added,
                    removed: diffResult.removed,
                    lines: diffResult.lines,
                    newContent: content
                }
            };
        }

        if (name === "delete_file") {
            if (!path) return { error: "Missing required argument 'path'." };
            const existingFile = VFS.get(path);
            const oldContent = existingFile ? (existingFile.content || '') : '';
            const removedLines = oldContent ? oldContent.split('\n').length : 0;
            const res = VFS.remove(path);
            App.renderExplorer();
            App.updatePreview();
            return {
                status: res ? "success" : "not_found",
                message: `File deleted: ${path}`,
                diffInfo: {
                    toolId: toolId,
                    action: 'delete',
                    path: path,
                    added: 0,
                    removed: removedLines,
                    lines: oldContent ? oldContent.split('\n').map((l, i) => ({ type: '-', text: l, num: i + 1 })) : []
                }
            };
        }

        if (name === "read_file") {
            if (!path) return { error: "Missing required argument 'path'." };
            const file = VFS.get(path);
            if (!file) return { error: `File '${path}' not found in project. Current files: [${VFS.getAllPaths().join(', ')}]` };
            return { path: path, content: file.content };
        }

        if (name === "list_project_files") {
            const allFiles = VFS.getAllPaths();
            return { 
                status: "success", 
                files: allFiles, 
                message: `Project currently contains ${allFiles.length} file(s): [${allFiles.join(', ')}]` 
            };
        }

        return { 
            error: `Tool '${rawName}' executed. Current project files: [${VFS.getAllPaths().join(', ')}]`,
            files: VFS.getAllPaths()
        };
    }

    // 🚀 SEND PROMPT / RUN AGENT
    async function sendMessage(promptText) {
        promptText = promptText || document.getElementById('ai-prompt-input')?.value.trim();
        const currentAttachment = attachedImage;
        if ((!promptText && !currentAttachment) || isBusy) return;

        if (!promptText && currentAttachment) {
            promptText = "Please inspect this attached image and implement or improve the website code accordingly.";
        }

        // Reset router breakers so each new message gets a fresh chance
        if (typeof AIModelRouter !== 'undefined' && AIModelRouter.resetBreakers) {
            AIModelRouter.resetBreakers();
        }

        // Verify connected APIs
        const connected = (typeof APIHub !== 'undefined' && APIHub.getConnectedProviders)
            ? APIHub.getConnectedProviders()
            : [];

        const isAuto = (!config.provider || config.provider === 'auto');
        const hasDirectKey = !!(config.apiKey && config.apiKey.trim());

        if (isAuto) {
            if (!connected.length && !hasDirectKey) {
                App.showToast("Koi bhi AI provider connected nahi hai! Pehle AI Settings me API key dalein ya 'Connect' tab se connect karein.", "error");
                openSettings('ai-settings');
                return;
            }
        } else {
            const targetProv = (config.provider === 'gemini') ? 'google' : config.provider;
            const provConnected = connected.find(p => p.id === targetProv || p.id === config.provider);
            if (!provConnected && !hasDirectKey && config.provider !== 'custom') {
                App.showToast(`Provider "${config.provider}" connected nahi hai! Pehle API key dalein.`, "error");
                openSettings('ai-settings');
                return;
            }
        }

        // Add user message
        messages.push({
            role: "user",
            text: promptText,
            image: currentAttachment ? currentAttachment.dataUrl : null
        });
        renderChat();

        clearAttachment();

        const inputEl = document.getElementById('ai-prompt-input');
        if (inputEl) {
            inputEl.value = '';
            autoResize(inputEl);
        }

        setBusy(true);

        try {
            if (isAuto || isRouterEnabled()) {
                // 🧭 Auto mode: the router picks the model, balances and falls over
                await runWithRouter(promptText, currentAttachment);
            } else {
                await runSingleAgent(promptText, currentAttachment);
            }
        } catch (err) {
            const detail = (err && err.message) ? err.message : 'Unknown error';
            let attemptsHtml = '';
            if (err && Array.isArray(err.attempts) && err.attempts.length) {
                attemptsHtml = '\n\n**Routing trace:**\n' + err.attempts.map(a => {
                    if (a.status === 'success') return `- \`${a.model}\` → answered in ${Math.round(a.ms)} ms`;
                    if (a.status === 'error') return `- \`${a.model}\` → failed (${a.cls || 'error'})`;
                    if (a.status === 'skipped') return `- \`${a.model}\` → skipped (${a.reason})`;
                    if (a.status === 'hedge') return `- \`${a.model}\` → started as a hedge`;
                    if (a.status === 'lost') return `- \`${a.model}\` → slower, lost the race`;
                    if (a.status === 'breaker') return `- circuit breaker opened (${a.reason})`;
                    return `- ${a.model}`;
                }).join('\n');
            }
            messages.push({
                role: "agent",
                text: `❌ **Error:** ${detail}${attemptsHtml}\n\nPlease verify your API key and network connection in AI Settings.`
            });
            renderChat();
        } finally {
            setBusy(false);
            saveChat();
        }
    }

    // 🤖 RUN GOOGLE GEMINI AGENT
    async function runGeminiAgent(userPrompt, modelOverride, attempt, override, attachment) {
        // Snapshot the conversation so a failed attempt can be rolled back
        // cleanly before the next model in the chain tries the same prompt.
        const convSnapshot = { contents: geminiContents.slice(), started: geminiStarted };
        try {
            return await doRunGeminiAgent(userPrompt, modelOverride, attempt, override, attachment);
        } catch (err) {
            geminiContents = convSnapshot.contents;
            geminiStarted = convSnapshot.started;
            throw err;
        }
    }

    async function doRunGeminiAgent(userPrompt, modelOverride, attempt, override, attachment) {
        const apiKey = (override && override.key !== undefined) ? String(override.key || '').trim() : config.apiKey.trim();
        const model = modelOverride || config.model || "gemini-2.5-flash";
        const geminiBase = (override && override.baseUrl)
            ? String(override.baseUrl).replace(/\/+$/, '').replace(/\/models$/, '')
            : 'https://generativelanguage.googleapis.com/v1beta';
        const url = `${geminiBase}/models/${model}:generateContent?key=${apiKey}`;

        // Gemini Function Declarations
        const geminiTools = [
            {
                functionDeclarations: [
                    {
                        name: "create_or_update_file",
                        description: "Create or overwrite a file in the project VFS",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                path: { type: "STRING", description: "Relative file path" },
                                content: { type: "STRING", description: "Complete file content" }
                            },
                            required: ["path", "content"]
                        }
                    },
                    {
                        name: "read_file",
                        description: "Read content of a project file",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                path: { type: "STRING", description: "File path" }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "delete_file",
                        description: "Delete a file",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                path: { type: "STRING", description: "File path" }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "list_project_files",
                        description: "List all files in project",
                        parameters: { type: "OBJECT", properties: {} }
                    }
                ]
            }
        ];

        // Format conversation history for Gemini
        // FIX: the conversation is now PERSISTENT between turns, so the agent
        // actually remembers what it did in previous messages.
        if (!geminiStarted) {
            geminiContents = [];
            geminiStarted = true;
        }

        const userParts = [
            { text: userPrompt },
            { text: `Current project files: [${VFS.getAllPaths().join(', ')}]` }
        ];
        if (attachment && attachment.base64 && attachment.mimeType) {
            userParts.push({
                inlineData: {
                    mimeType: attachment.mimeType,
                    data: attachment.base64
                }
            });
        }

        geminiContents.push({
            role: "user",
            parts: userParts
        });

        let executedTools = [];
        let finalResponseText = "";
        let geminiReasoningAccum = "";
        let isStreamed = false;
        let iterations = 0;
        const MAX_ITERATIONS = Math.min(15, Math.max(1, config.maxSteps || 8));

        while (iterations < MAX_ITERATIONS) {
            iterations++;

            // A newer model won the race → stop right here, change nothing.
            if (attempt && attempt.superseded) {
                throw makeAbortedError();
            }

            const fetchOptions = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: getSystemPrompt() }] },
                    contents: geminiContents,
                    tools: geminiTools,
                    generationConfig: {
                        temperature: typeof config.temperature === 'number' ? config.temperature : 0.2
                    }
                })
            };
            if (attempt && attempt.controller) fetchOptions.signal = attempt.controller.signal;

            // Use Gemini streamGenerateContent with Server-Sent Events (alt=sse), with seamless fallback to generateContent
            let res = null;
            const streamUrl = `${geminiBase}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
            const standardUrl = `${geminiBase}/models/${model}:generateContent?key=${apiKey}`;

            try {
                res = await safeFetch(streamUrl, fetchOptions);
                if (!res.ok && res.status >= 400 && res.status < 500) {
                    // If stream rejected with 400/404, try standard endpoint
                    const fallbackRes = await safeFetch(standardUrl, fetchOptions);
                    if (fallbackRes.ok) {
                        res = fallbackRes;
                    }
                }
            } catch (streamErr) {
                // If stream fetch threw (CORS or network), try standard generateContent
                res = await safeFetch(standardUrl, fetchOptions);
            }

            // Time to first byte — the fetch resolves when the headers land
            if (attempt) attempt.ttfb = Date.now() - attempt.startedAt;

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const err = new Error(errData.error?.message || `HTTP ${res.status} ${res.statusText}`);
                err.status = res.status;
                throw err;
            }

            let geminiAccumText = "";
            let geminiFuncCalls = [];
            let streamBuffer = "";
            resetStreamMetrics();

            if (res.body && typeof res.body.getReader === 'function') {
                const reader = res.body.getReader();
                const decoder = new TextDecoder("utf-8");

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        isStreamed = true;
                        streamBuffer += decoder.decode(value, { stream: true });
                        const lines = streamBuffer.split("\n");
                        streamBuffer = lines.pop() || "";

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed.startsWith(":")) continue;
                            if (trimmed.startsWith("data: ")) {
                                try {
                                    const chunk = JSON.parse(trimmed.slice(6));
                                    const parts = chunk.candidates?.[0]?.content?.parts || [];
                                    let chunkEmitted = false;

                                    for (const p of parts) {
                                        if (p.thought || p.isThought) {
                                            geminiReasoningAccum += (p.text || '');
                                            chunkEmitted = true;
                                        } else if (p.text) {
                                            geminiAccumText += p.text;
                                            chunkEmitted = true;
                                        }
                                        if (p.functionCall) {
                                            geminiFuncCalls.push(p.functionCall);
                                        }
                                    }

                                    if (chunkEmitted) {
                                        if (attempt) {
                                            attempt.isStreaming = true;
                                            attempt.tokens = (attempt.tokens || 0) + 1;
                                        }

                                        const inlineThink = extractThinking(geminiAccumText);
                                        const displayReasoning = geminiReasoningAccum || inlineThink.thinking;
                                        const displayText = inlineThink.text;

                                        onStreamChunk({
                                            text: displayText,
                                            reasoning: displayReasoning,
                                            model: model,
                                            startTime: streamStartTime
                                        });
                                    }
                                } catch (e) {}
                            }
                        }
                    }
                } catch (readErr) {
                    console.warn("Gemini stream error:", readErr);
                }
            }

            if (!isStreamed) {
                let data = null;
                const trimmedBuf = streamBuffer.trim();
                if (trimmedBuf.startsWith('{')) {
                    try { data = JSON.parse(trimmedBuf); } catch (e) {}
                }
                if (!data) {
                    try { data = await res.json(); } catch (e) {}
                }
                if (!data) throw new Error("No response generated by Gemini.");
                const candidate = data.candidates?.[0];
                if (!candidate) throw new Error("No candidate generated by Gemini.");
                const contentPart = candidate.content?.parts || [];
                geminiContents.push(candidate.content);
                geminiFuncCalls = contentPart.filter(p => p.functionCall).map(p => p.functionCall);
                geminiAccumText = contentPart.map(p => p.text || '').join('');
            } else {
                const builtParts = [];
                if (geminiAccumText) builtParts.push({ text: geminiAccumText });
                for (const fc of geminiFuncCalls) builtParts.push({ functionCall: fc });
                geminiContents.push({ role: "model", parts: builtParts });
            }

            if (attempt && attempt.tokens === 0) {
                attempt.tokens = (geminiAccumText + ' ' + geminiReasoningAccum).split(/\s+/).filter(Boolean).length;
            }

            // Check for function calls
            if (geminiFuncCalls.length > 0) {
                const responseParts = [];

                for (const fn of geminiFuncCalls) {
                    const result = executeTool(fn.name, fn.args || {}, attempt);
                    if (attempt) attempt.toolCalls++;

                    if (result && result.diffInfo) {
                        executedTools.push(result.diffInfo);
                    } else if (fn.name === "create_or_update_file") {
                        executedTools.push({ action: 'create', path: fn.args.path });
                    } else if (fn.name === "delete_file") {
                        executedTools.push({ action: 'delete', path: fn.args.path });
                    }

                    responseParts.push({
                        functionResponse: {
                            name: fn.functionName || fn.name,
                            response: { result: result }
                        }
                    });
                }

                geminiContents.push({
                    role: "user",
                    parts: responseParts
                });
            } else {
                // Final text response
                finalResponseText = geminiAccumText;
                break;
            }
        }

        if (attempt && attempt.superseded) {
            throw makeAbortedError();
        }

        const parsedReply = extractThinking(finalResponseText);
        const combinedThinking = geminiReasoningAccum || parsedReply.thinking;
        const activeModelName = modelOverride || config.model || "Google Gemini";

        let replyText = parsedReply.text;
        if (!replyText && combinedThinking) {
            const cleaned = combinedThinking.replace(/<[^>]+>/g, '').trim();
            if (!/error in the function call|correct function name|apologize for the repeated attempts/i.test(cleaned)) {
                const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
                replyText = lines[lines.length - 1] || cleaned;
            }
        }
        if (!replyText) {
            const allFiles = VFS.getAllPaths();
            replyText = executedTools.length 
                ? "Maine aapke project me changes successfully apply kar diye hain!" 
                : `Haan, mujhe aapka project dikh raha hai! Project me abhi ${allFiles.length} file(s) hain: ${allFiles.join(', ')}. Bataiye inme kya banana ya badalna hai?`;
        }

        const agentMsgObj = {
            role: "agent",
            text: replyText,
            toolsExecuted: executedTools,
            thinking: combinedThinking,
            timestamp: Date.now(),
            model: activeModelName,
            wasStreamed: isStreamed
        };
        messages.push(agentMsgObj);
        renderChat();
        startTypewriterStreaming(messages.length - 1, agentMsgObj.text, isStreamed);
    }

    // 🤖 RUN OPENAI / OPENCODE / GROQ / DEEPSEEK AGENT
    async function runOpenAIAgent(userPrompt, modelOverride, attempt, override, attachment) {
        // Snapshot the conversation so a failed attempt can be rolled back
        // cleanly before the next model in the chain tries the same prompt.
        const convSnapshot = openaiConversation ? openaiConversation.slice() : null;
        try {
            return await doRunOpenAIAgent(userPrompt, modelOverride, attempt, override, attachment);
        } catch (err) {
            openaiConversation = convSnapshot;
            throw err;
        }
    }

    async function doRunOpenAIAgent(userPrompt, modelOverride, attempt, override, attachment) {
        const apiKey = (override && override.key !== undefined) ? String(override.key || '').trim() : config.apiKey.trim();
        const chosenProv = (override && override.id) ? override.id : config.provider;
        const catalogMeta = (typeof AIProviderCatalog !== 'undefined') ? AIProviderCatalog.get(chosenProv) : null;
        const providerMeta = catalogMeta || PROVIDERS[chosenProv] || PROVIDERS.openai;
        const defaultBase = providerMeta.baseUrl || 'https://api.openai.com/v1';
        const baseUrl = ((override && override.baseUrl) ? override.baseUrl : (config.baseUrl || defaultBase)).replace(/\/+$/, '');
        const model = modelOverride || config.model || providerMeta.defaultModel || 'gpt-4o-mini';
        const url = `${baseUrl}/chat/completions`;

        const existingFiles = VFS.getAllPaths().join(', ');

        // FIX: persistent conversation -> the agent remembers previous turns
        if (!openaiConversation) {
            openaiConversation = [
                {
                    role: "system",
                    content: `${getSystemPrompt()}\n\nCurrent files in project: [${existingFiles}]`
                }
            ];
        } else {
            // Keep the system prompt fresh with the current file list
            openaiConversation[0].content = `${getSystemPrompt()}\n\nCurrent files in project: [${existingFiles}]`;
        }

        if (attachment && attachment.dataUrl) {
            openaiConversation.push({
                role: "user",
                content: [
                    { type: "text", text: userPrompt },
                    { type: "image_url", image_url: { url: attachment.dataUrl } }
                ]
            });
        } else {
            openaiConversation.push({
                role: "user",
                content: userPrompt
            });
        }

        let executedTools = [];
        let finalResponseText = "";
        let reasoningAccum = "";
        let isStreamed = false;
        let iterations = 0;
        const MAX_ITERATIONS = Math.min(15, Math.max(1, config.maxSteps || 8));

        while (iterations < MAX_ITERATIONS) {
            iterations++;

            // A newer model won the race → stop right here, change nothing.
            if (attempt && attempt.superseded) {
                throw makeAbortedError();
            }

            const headers = {
                "Content-Type": "application/json"
            };
            if (apiKey) {
                headers["Authorization"] = `Bearer ${apiKey}`;
            }

            const fetchOptions = {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    model: model,
                    messages: openaiConversation,
                    tools: TOOLS_SCHEMA,
                    tool_choice: "auto",
                    stream: true,
                    temperature: typeof config.temperature === 'number' ? config.temperature : 0.2
                })
            };
            if (attempt && attempt.controller) fetchOptions.signal = attempt.controller.signal;

            let res = null;
            try {
                res = await safeFetch(url, fetchOptions);
                if (!res.ok && res.status >= 400 && res.status < 500) {
                    const nonStreamOptions = {
                        ...fetchOptions,
                        body: JSON.stringify({
                            model: model,
                            messages: openaiConversation,
                            tools: TOOLS_SCHEMA,
                            tool_choice: "auto",
                            stream: false,
                            temperature: typeof config.temperature === 'number' ? config.temperature : 0.2
                        })
                    };
                    const fallbackRes = await safeFetch(url, nonStreamOptions);
                    if (fallbackRes.ok) res = fallbackRes;
                }
            } catch (fetchErr) {
                const nonStreamOptions = {
                    ...fetchOptions,
                    body: JSON.stringify({
                        model: model,
                        messages: openaiConversation,
                        tools: TOOLS_SCHEMA,
                        tool_choice: "auto",
                        stream: false,
                        temperature: typeof config.temperature === 'number' ? config.temperature : 0.2
                    })
                };
                res = await safeFetch(url, nonStreamOptions);
            }

            // Time to first byte — the fetch resolves when the headers land
            if (attempt) attempt.ttfb = Date.now() - attempt.startedAt;

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const err = new Error(errData.error?.message || `HTTP ${res.status} ${res.statusText}`);
                err.status = res.status;
                throw err;
            }

            let textAccum = "";
            let toolCallsMap = {};
            let streamBuffer = "";
            resetStreamMetrics();

            if (res.body && typeof res.body.getReader === 'function') {
                const reader = res.body.getReader();
                const decoder = new TextDecoder("utf-8");

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        isStreamed = true;
                        streamBuffer += decoder.decode(value, { stream: true });
                        const lines = streamBuffer.split("\n");
                        streamBuffer = lines.pop() || "";

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed.startsWith(":")) continue;
                            if (trimmed === "data: [DONE]") continue;
                            if (trimmed.startsWith("data: ")) {
                                try {
                                    const chunk = JSON.parse(trimmed.slice(6));
                                    const delta = chunk.choices?.[0]?.delta;
                                    if (!delta) continue;

                                    let chunkEmitted = false;

                                    // 1. Capture reasoning/thinking tokens
                                    const reasoningDelta = delta.reasoning_content || delta.reasoning || delta.thought || '';
                                    if (reasoningDelta) {
                                        reasoningAccum += reasoningDelta;
                                        chunkEmitted = true;
                                    }

                                    // 2. Capture regular content tokens
                                    if (delta.content) {
                                        textAccum += delta.content;
                                        chunkEmitted = true;
                                    }

                                    if (chunkEmitted) {
                                        if (attempt) {
                                            attempt.isStreaming = true;
                                            attempt.tokens = (attempt.tokens || 0) + 1;
                                        }

                                        const inlineThink = extractThinking(textAccum);
                                        const displayReasoning = reasoningAccum || inlineThink.thinking;
                                        const displayText = inlineThink.text;

                                        onStreamChunk({
                                            text: displayText,
                                            reasoning: displayReasoning,
                                            model: model,
                                            startTime: streamStartTime
                                        });
                                    }

                                    if (delta.tool_calls) {
                                        for (const tc of delta.tool_calls) {
                                            const idx = tc.index ?? 0;
                                            if (!toolCallsMap[idx]) {
                                                toolCallsMap[idx] = {
                                                    id: tc.id || "",
                                                    type: "function",
                                                    function: { name: tc.function?.name || "", arguments: "" }
                                                };
                                            }
                                            if (tc.id) toolCallsMap[idx].id = tc.id;
                                            if (tc.function?.name) toolCallsMap[idx].function.name += tc.function.name;
                                            if (tc.function?.arguments) toolCallsMap[idx].function.arguments += tc.function.arguments;
                                        }
                                    }
                                } catch (e) {}
                            }
                        }
                    }
                } catch (readErr) {
                    console.warn("Stream reading interrupted:", readErr);
                }
            }

            let message = null;
            const collectedToolCalls = Object.values(toolCallsMap);

            if (isStreamed && (textAccum || collectedToolCalls.length)) {
                message = {
                    role: "assistant",
                    content: textAccum,
                    tool_calls: collectedToolCalls.length ? collectedToolCalls : undefined
                };
            } else {
                let data = null;
                const trimmedBuf = streamBuffer.trim();
                if (trimmedBuf.startsWith('{')) {
                    try { data = JSON.parse(trimmedBuf); } catch (e) {}
                }
                if (!data) {
                    try { data = await res.json(); } catch (e) {}
                }
                if (!data) throw new Error("No response received from AI model.");
                const choice = data.choices?.[0];
                if (!choice) throw new Error("No choice returned by AI model.");
                message = choice.message || {};
                textAccum = message.content || "";
            }

            if (attempt && attempt.tokens === 0) {
                attempt.tokens = (textAccum + ' ' + reasoningAccum).split(/\s+/).filter(Boolean).length;
            }

            openaiConversation.push(message);

            if (message.tool_calls && message.tool_calls.length > 0) {
                for (const toolCall of message.tool_calls) {
                    const fnName = toolCall.function.name;
                    let fnArgs = {};
                    try {
                        fnArgs = JSON.parse(toolCall.function.arguments);
                    } catch(e) {}

                    const result = executeTool(fnName, fnArgs, attempt);
                    if (attempt) attempt.toolCalls++;

                    if (result && result.diffInfo) {
                        executedTools.push(result.diffInfo);
                    } else if (fnName === "create_or_update_file") {
                        executedTools.push({ action: 'create', path: fnArgs.path });
                    } else if (fnName === "delete_file") {
                        executedTools.push({ action: 'delete', path: fnArgs.path });
                    }

                    openaiConversation.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(result)
                    });
                }
            } else {
                finalResponseText = textAccum || message.content || "";
                break;
            }
        }

        if (attempt && attempt.superseded) {
            throw makeAbortedError();
        }

        const parsedReply = extractThinking(finalResponseText);
        const combinedThinking = reasoningAccum || parsedReply.thinking;
        const activeModelName = modelOverride || config.model || (override && override.id) || "AI Agent";

        let replyText = parsedReply.text;
        if (!replyText && combinedThinking) {
            const cleaned = combinedThinking.replace(/<[^>]+>/g, '').trim();
            if (!/error in the function call|correct function name|apologize for the repeated attempts/i.test(cleaned)) {
                const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
                replyText = lines[lines.length - 1] || cleaned;
            }
        }
        if (!replyText) {
            const allFiles = VFS.getAllPaths();
            replyText = executedTools.length 
                ? "Maine aapke project me changes successfully apply kar diye hain!" 
                : `Haan, mujhe aapka project dikh raha hai! Project me abhi ${allFiles.length} file(s) hain: ${allFiles.join(', ')}. Bataiye inme kya banana ya badalna hai?`;
        }

        const agentMsgObj = {
            role: "agent",
            text: replyText,
            toolsExecuted: executedTools,
            thinking: combinedThinking,
            timestamp: Date.now(),
            model: activeModelName,
            wasStreamed: isStreamed
        };
        messages.push(agentMsgObj);
        renderChat();
        startTypewriterStreaming(messages.length - 1, agentMsgObj.text, isStreamed);
    }

    // 🐛 AUTO-FIX RUNTIME ERRORS REPORTED FROM CONSOLE
    function fixError(errorMsg) {
        togglePanel(true);
        const prompt = `Fix this runtime error in my project:\n"${errorMsg}"\nInspect the affected files, fix the root cause, and update the project code.`;
        sendMessage(prompt);
    }

    function clearChat() {
        messages = [
            {
                role: "agent",
                text: "Chat cleared. What would you like to build or modify next?"
            }
        ];
        const input = document.getElementById('ai-prompt-input');
        if (input) {
            input.value = '';
            autoResize(input);
        }
        clearAttachment();
        resetContext();
        saveChat();
        renderChat();
    }

    /** Drops the AI conversation memory (used when the project is replaced). */
    function resetContext() {
        geminiContents = [];
        geminiStarted = false;
        openaiConversation = null;
    }

    function setBusy(busy) {
        isBusy = busy;
        if (busy) {
            currentLoadingStatus = "Thinking...";
        }
        const thinking = document.getElementById('ai-thinking');
        if (thinking) {
            thinking.classList.remove('active');
            thinking.style.display = 'none';
        }
        const sendBtn = document.getElementById('ai-send-btn');
        if (sendBtn) {
            sendBtn.innerHTML = busy ? `<i class="fas fa-spinner fa-spin"></i>` : `<i class="fas fa-paper-plane"></i>`;
            sendBtn.disabled = busy;
        }
        renderChat();
    }

    function togglePanel(forceOpen) {
        const panel = document.getElementById('ai-studio-panel');
        if (!panel) return;

        try {
            let open = (forceOpen !== undefined) ? !!forceOpen : !panel.classList.contains('active');

            if (open) {
                panel.classList.add('active');
                panel.style.display = 'flex';
                panel.style.visibility = 'visible';
                panel.style.right = '0px';

                if (window.innerWidth <= 768) {
                    // Strictly full screen on mobile phone
                    panel.style.width = '';
                    panel.style.removeProperty('--ai-panel-width');
                } else {
                    const savedWidth = localStorage.getItem('master_ide_ai_panel_width');
                    if (savedWidth) {
                        const w = parseInt(savedWidth, 10);
                        if (!isNaN(w) && w >= 320 && w <= (window.innerWidth - 60)) {
                            panel.style.width = `${w}px`;
                            panel.style.setProperty('--ai-panel-width', `${w}px`);
                        }
                    }
                }

                if (typeof IDEPrefs !== 'undefined') IDEPrefs.set('aiPanelOpen', true);
                renderChat();
                
                // Do NOT auto-focus on mobile or touch screens to prevent virtual keyboard from popping up automatically
                const isTouchOrMobile = window.innerWidth <= 768 || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
                if (!isTouchOrMobile) {
                    setTimeout(() => document.getElementById('ai-prompt-input')?.focus(), 150);
                } else {
                    const promptInput = document.getElementById('ai-prompt-input');
                    if (promptInput && document.activeElement === promptInput) {
                        promptInput.blur();
                    }
                }
            } else {
                panel.classList.remove('active');
                panel.style.right = '';
                panel.style.visibility = '';
                panel.style.display = '';
                if (typeof IDEPrefs !== 'undefined') IDEPrefs.set('aiPanelOpen', false);
            }
        } catch (e) {
            console.error("togglePanel error:", e);
            panel.classList.add('active');
        }
    }

    let isTuningEditing = false;

    function toggleTuningEdit() {
        isTuningEditing = !isTuningEditing;
        updateTuningUI();
    }

    function resetTuningDefaults() {
        const tempInput = document.getElementById('ai-temp-input');
        const stepsInput = document.getElementById('ai-steps-input');
        if (tempInput) {
            tempInput.value = 0.2;
            handleTempInput(0.2);
        }
        if (stepsInput) {
            stepsInput.value = 8;
            handleStepsInput(8);
        }
        config.temperature = 0.2;
        config.maxSteps = 8;
        saveConfig(true);
        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast("Default parameters restored: Temp 0.20 · 8 Tool Steps", "info");
        }
    }

    function applyTuningPreset(name) {
        let t = 0.2, s = 8;
        if (name === 'precise') { t = 0.05; s = 6; }
        else if (name === 'creative') { t = 0.7; s = 12; }
        else if (name === 'power') { t = 0.2; s = 18; }
        else { t = 0.2; s = 8; }

        const tempInput = document.getElementById('ai-temp-input');
        const stepsInput = document.getElementById('ai-steps-input');
        if (tempInput) {
            tempInput.value = t;
            handleTempInput(t);
        }
        if (stepsInput) {
            stepsInput.value = s;
            handleStepsInput(s);
        }
        config.temperature = t;
        config.maxSteps = s;
        saveConfig(true);
        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast(`Preset: ${name.toUpperCase()} (Temp ${t} · Steps ${s})`, "success");
        }
    }

    function handleTempInput(val) {
        val = parseFloat(val);
        if (isNaN(val)) val = 0.2;
        const tVal = document.getElementById('ai-temp-val');
        const cVal = document.getElementById('chip-temp-val');
        const str = val.toFixed(2);
        if (tVal) tVal.innerText = str;
        if (cVal) cVal.innerText = str;
        config.temperature = val;
    }

    function handleStepsInput(val) {
        val = parseInt(val, 10);
        if (isNaN(val)) val = 8;
        const sVal = document.getElementById('ai-steps-val');
        const cVal = document.getElementById('chip-steps-val');
        if (sVal) sVal.innerText = val;
        if (cVal) cVal.innerText = `${val} Steps`;
        config.maxSteps = val;
    }

    function updateTuningUI() {
        const card = document.getElementById('ai-tuning-card');
        const tempInput = document.getElementById('ai-temp-input');
        const stepsInput = document.getElementById('ai-steps-input');
        const editBtn = document.getElementById('ai-tuning-edit-btn');
        const badge = document.getElementById('ai-tuning-state-badge');

        if (!card) return;

        if (isTuningEditing) {
            card.classList.add('editing');
            if (tempInput) tempInput.disabled = false;
            if (stepsInput) stepsInput.disabled = false;
            if (editBtn) {
                editBtn.innerHTML = '<i class="fas fa-check"></i> Done';
                editBtn.classList.add('btn-primary');
                editBtn.classList.remove('btn-secondary');
            }
            if (badge) {
                badge.className = 'ai-tuning-state-badge unlocked';
                badge.innerHTML = '<i class="fas fa-lock-open"></i> Editing';
            }
        } else {
            card.classList.remove('editing');
            if (tempInput) tempInput.disabled = true;
            if (stepsInput) stepsInput.disabled = true;
            if (editBtn) {
                editBtn.innerHTML = '<i class="fas fa-pen-to-square"></i> Edit';
                editBtn.classList.remove('btn-primary');
                editBtn.classList.add('btn-secondary');
            }
            if (badge) {
                badge.className = 'ai-tuning-state-badge locked';
                badge.innerHTML = '<i class="fas fa-lock"></i> Locked';
            }
        }
    }

    function openSettings(defaultTab) {
        defaultTab = defaultTab || 'agent';
        const modal = document.getElementById('ai-settings-modal');
        if (!modal) return;

        const tempInput = document.getElementById('ai-temp-input');
        const stepsInput = document.getElementById('ai-steps-input');
        const rulesInput = document.getElementById('ai-custom-rules-input');

        if (tempInput) {
            const t = typeof config.temperature === 'number' ? config.temperature : 0.2;
            tempInput.value = t;
            handleTempInput(t);
        }
        if (stepsInput) {
            const s = typeof config.maxSteps === 'number' ? config.maxSteps : 8;
            stepsInput.value = s;
            handleStepsInput(s);
        }
        if (rulesInput) {
            rulesInput.value = config.customRules || '';
        }

        isTuningEditing = false;
        updateTuningUI();

        // Render the connected providers tab
        renderConnectedProvidersTab();

        // 🧭 Restore the router controls + paint the live chain
        syncRouterControls();
        renderRouterPanel();

        switchModalTab(defaultTab);

        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.zIndex = '200000';

        // Force-render APIHub tab content immediately
        if (typeof APIHub !== 'undefined' && APIHub.render) {
            APIHub.render();
        }
    }

    function switchModalTab(tabId) {
        tabId = tabId || 'agent';
        if (tabId.startsWith('apihub-')) tabId = tabId.replace('apihub-', '');

        const agentTab = document.getElementById('ai-tab-agent');
        const routerTab = document.getElementById('ai-tab-router');
        const apihubTab = document.getElementById('ai-tab-apihub');

        // Update tab button highlights
        document.querySelectorAll('.ai-modal-tab').forEach(btn => btn.classList.remove('active'));

        if (tabId === 'agent') {
            if (agentTab) agentTab.style.display = 'block';
            if (routerTab) routerTab.style.display = 'none';
            if (apihubTab) apihubTab.style.display = 'none';

            const btn = document.getElementById('tab-btn-agent');
            if (btn) btn.classList.add('active');

            renderConnectedProvidersTab();
        } else if (tabId === 'router') {
            if (agentTab) agentTab.style.display = 'none';
            if (routerTab) routerTab.style.display = 'block';
            if (apihubTab) apihubTab.style.display = 'none';

            const btn = document.getElementById('tab-btn-router');
            if (btn) btn.classList.add('active');

            syncRouterControls();
            renderRouterPanel();
        } else {
            if (agentTab) agentTab.style.display = 'none';
            if (routerTab) routerTab.style.display = 'none';
            if (apihubTab) apihubTab.style.display = 'block';

            const btn = document.getElementById('tab-btn-apihub-' + tabId);
            if (btn) btn.classList.add('active');

            if (typeof APIHub !== 'undefined') {
                APIHub.setTab(tabId);
                APIHub.render();
            }
        }
    }

    /** Renders the connected providers summary, badge, and dropdown in the AI Agent tab */
    function renderConnectedProvidersTab() {
        const badge = document.getElementById('ai-agent-connected-badge');
        const countText = document.getElementById('ai-agent-connected-count');
        const summaryBox = document.getElementById('ai-connected-summary-box');
        const provSelect = document.getElementById('ai-agent-provider-select');
        const optgroup = document.getElementById('ai-agent-connected-optgroup');

        const connected = (typeof APIHub !== 'undefined' && APIHub.getConnectedProviders)
            ? APIHub.getConnectedProviders()
            : [];

        // 1. Connection Badge & Count
        if (badge && countText) {
            badge.className = 'conn-badge ' + (connected.length > 0 ? 'conn-ok' : 'conn-idle');
            countText.textContent = `${connected.length}/83 Connected`;
        }

        // 2. Summary Box (Pills or Empty State)
        if (summaryBox) {
            if (connected.length === 0) {
                summaryBox.innerHTML = `
                    <div class="ai-clean-empty-bar">
                        <div class="ai-clean-empty-left">
                            <i class="fas fa-plug-circle-exclamation" style="color:#f59e0b; font-size:12px;"></i>
                            <span style="white-space:nowrap; font-size:11.5px; font-weight:600;">No APIs connected</span>
                        </div>
                        <div class="ai-clean-empty-right">
                            <button type="button" class="btn btn-primary btn-sm" style="white-space:nowrap; padding:3px 9px; font-size:11px;" onclick="AIAgent.switchModalTab('apihub-connect')">
                                <i class="fas fa-plus"></i> Connect (83)
                            </button>
                        </div>
                    </div>
                `;
            } else {
                const pillsHtml = connected.map(p => {
                    const mCount = p.models ? p.models.length : 0;
                    return `
                        <div class="ai-conn-pill" title="${IDEUtils.escapeAttr(p.name)} · ${p.baseUrl || 'Direct API'}">
                            <span class="dot"></span>
                            <span>${IDEUtils.escapeHtml(p.name)}</span>
                            <span class="models-count">(${mCount} model${mCount === 1 ? '' : 's'})</span>
                        </div>
                    `;
                }).join('');

                summaryBox.innerHTML = `
                    <div class="ai-conn-pills-wrap">
                        ${pillsHtml}
                        <button type="button" class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px; margin-left: auto;" onclick="AIAgent.switchModalTab('apihub-connect')">
                            <i class="fas fa-plus"></i> Connect More (83 Total)
                        </button>
                    </div>
                `;
            }
        }

        // 3. Populate Provider Select
        if (provSelect && optgroup) {
            optgroup.innerHTML = '';
            if (connected.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No APIs Connected';
                opt.disabled = true;
                optgroup.appendChild(opt);
            } else {
                connected.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    const mCount = p.models ? p.models.length : 0;
                    opt.textContent = `${p.name} (${mCount} model${mCount === 1 ? '' : 's'})`;
                    optgroup.appendChild(opt);
                });
            }

            const currentProv = config.provider || 'auto';
            const hasOption = Array.from(provSelect.options).some(o => o.value === currentProv);
            provSelect.value = hasOption ? currentProv : 'auto';
        }

        handleAgentProviderChange(provSelect ? provSelect.value : 'auto');
    }

    function handleAgentProviderChange(providerId) {
        const provHint = document.getElementById('ai-agent-provider-hint');
        const modelSelect = document.getElementById('ai-agent-model-select');
        const modelHint = document.getElementById('ai-agent-model-hint');

        if (!providerId || providerId === 'auto') {
            if (provHint) {
                provHint.textContent = '';
            }
            if (modelSelect) {
                modelSelect.innerHTML = `<option value="auto">⚡ Auto (Best Model)</option>`;
                modelSelect.disabled = true;
            }
            if (modelHint) {
                modelHint.textContent = '';
            }
            return;
        }

        // Specific provider chosen
        const connected = (typeof APIHub !== 'undefined' && APIHub.getConnectedProviders)
            ? APIHub.getConnectedProviders()
            : [];
        const targetProv = (providerId === 'gemini') ? 'google' : providerId;
        const p = connected.find(item => item.id === targetProv || item.id === providerId);

        if (provHint) {
            provHint.textContent = p ? `Using ${p.name} directly. All code generation prompts will run through this provider.` : 'Provider selected.';
        }

        if (modelSelect) {
            modelSelect.disabled = false;
            modelSelect.innerHTML = '';

            let models = p && p.models ? p.models : [];
            if (!models.length && typeof AIProviderCatalog !== 'undefined') {
                models = AIProviderCatalog.modelsFor(providerId) || [];
            }

            if (!models.length) {
                const opt = document.createElement('option');
                opt.value = 'default';
                opt.textContent = 'Default Model';
                modelSelect.appendChild(opt);
            } else {
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.label || m.id;
                    modelSelect.appendChild(opt);
                });
            }

            // Restore previously selected model or pick the first
            const hasModel = Array.from(modelSelect.options).some(o => o.value === config.model);
            modelSelect.value = hasModel ? config.model : (models[0]?.id || 'default');
        }

        handleAgentModelChange(modelSelect ? modelSelect.value : '');
    }

    function handleAgentModelChange(modelId) {
        const modelHint = document.getElementById('ai-agent-model-hint');
        const provSelect = document.getElementById('ai-agent-provider-select');
        const providerId = provSelect ? provSelect.value : 'auto';

        if (providerId === 'auto') {
            if (modelHint) modelHint.textContent = 'Auto Router automatically balances speed, reliability, and accuracy.';
        } else {
            if (modelHint) modelHint.textContent = modelId ? `Selected model: ${modelId}` : 'Select a model from this provider.';
        }
    }

    /** Pushes the stored router preferences into the modal controls. */
    function syncRouterControls() {
        const toggle = document.getElementById('ai-router-enabled');
        const strategy = document.getElementById('ai-router-strategy');
        const budget = document.getElementById('ai-router-budget');
        const budgetOut = document.getElementById('ai-router-budget-value');
        const hedge = document.getElementById('ai-router-hedge');

        const sec = Math.round(routerBudgetMs() / 1000);

        if (toggle) toggle.checked = isRouterEnabled();
        if (strategy) strategy.value = routerStrategy();
        if (budget) budget.value = String(sec);
        if (budgetOut) budgetOut.textContent = sec + 's';
        const chip = document.getElementById('chip-router-budget');
        if (chip) chip.textContent = sec + 's';
        if (hedge) hedge.checked = routerHedgeEnabled();

        isRouterEditing = false;
        updateRouterControlsUI();

        // Grey out the panel when the router is off
        const panel = document.getElementById('ai-router-panel');
        if (panel) panel.classList.toggle('rt-off', !isRouterEnabled());
    }

    function saveSettingsFromModal() {
        const providerSelect = document.getElementById('ai-agent-provider-select') || document.getElementById('ai-provider-select');
        const modelSelect = document.getElementById('ai-agent-model-select') || document.getElementById('ai-model-select');
        const tempInput = document.getElementById('ai-temp-input');
        const stepsInput = document.getElementById('ai-steps-input');
        const rulesInput = document.getElementById('ai-custom-rules-input');

        const chosenProvider = providerSelect ? providerSelect.value : 'auto';
        const chosenModel = modelSelect ? modelSelect.value : 'auto';

        config.provider = chosenProvider || 'auto';
        config.model = chosenModel || 'auto';
        if (tempInput) config.temperature = parseFloat(tempInput.value) || 0.2;
        if (stepsInput) config.maxSteps = parseInt(stepsInput.value, 10) || 8;
        if (rulesInput) config.customRules = rulesInput.value.trim();

        saveConfig(true);
        updateModelTag();

        if (typeof App !== 'undefined' && App.closeModal) {
            App.closeModal('ai-settings-modal');
            App.showToast("AI Agent settings save ho gayi hain!", "success");
        } else {
            document.getElementById('ai-settings-modal')?.classList.remove('active');
        }
    }

    function updateProviderFields(forceModel = false) {
        const provider = document.getElementById('ai-provider-select')?.value || 'gemini';
        const modelInput = document.getElementById('ai-model-input');
        const baseUrlGroup = document.getElementById('ai-base-url-group');
        const baseUrlInput = document.getElementById('ai-base-url-input');
        const apiKeyInput = document.getElementById('ai-api-key-input');
        const keyLink = document.getElementById('ai-key-link');

        // Update key registration link
        if (keyLink) {
            const url = PROVIDER_KEY_URLS[provider] || '';
            if (url) {
                keyLink.href = url;
                keyLink.style.display = 'inline-flex';
            } else {
                keyLink.style.display = 'none';
            }
        }

        // Auto-fill key from APIHub if input is empty
        if (apiKeyInput && !apiKeyInput.value && typeof APIHub !== 'undefined') {
            const hubProv = (provider === 'gemini') ? 'google' : provider;
            const creds = APIHub.credentials ? APIHub.credentials(hubProv) : null;
            if (creds && creds.key) {
                apiKeyInput.value = creds.key;
            }
        }

        // FIX: always refresh the model when the provider actually changes
        if (modelInput && (forceModel || !modelInput.value)) {
            modelInput.value = PROVIDERS[provider]?.defaultModel || '';
        }

        const usesCustomUrl = (provider === 'custom' || provider === 'openrouter');
        if (baseUrlGroup) {
            baseUrlGroup.style.display = usesCustomUrl ? 'block' : 'none';
        }

        // FIX: a stale base URL from a previous provider would send the model
        // request to the wrong endpoint → clear / prefill it accordingly.
        if (baseUrlInput) {
            if (!usesCustomUrl) {
                baseUrlInput.value = '';
            } else if (forceModel || !baseUrlInput.value.trim()) {
                // The provider really changed → start from its default endpoint
                baseUrlInput.value = PROVIDERS[provider]?.baseUrl || '';
            }
        }

        // Only clear model list if provider actually changed
        if (forceModel && provider !== lastConnectedProvider) {
            clearTimeout(modelsFetchTimer);
            clearModelList();
            lastConnectedKey = '';
            lastConnectedProvider = '';
            setConnectionState('idle', 'Not connected');
            setModelStatus('Paste your API key and press Connect — every model your key unlocks will show up here.', 'muted');
            renderRouterPanel();
        }

        const { apiKey } = readModalValues();
        if (apiKey) {
            // Give the browser a tick so the provider value is settled
            setTimeout(() => connect(), 60);
        }
    }

    // 🧠 THINKING EXTRACTOR
    function extractThinking(text) {
        if (!text) return { thinking: '', text: '' };
        const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i) || text.match(/\[thinking\]([\s\S]*?)\[\/thinking\]/i);
        if (thinkMatch) {
            const thinking = thinkMatch[1].trim();
            const cleanText = text.replace(thinkMatch[0], '').trim();
            return { thinking, text: cleanText };
        }
        // Also catch unclosed <think> tag during live streaming
        const openMatch = text.match(/<think>([\s\S]*)$/i) || text.match(/\[thinking\]([\s\S]*)$/i);
        if (openMatch) {
            const thinking = openMatch[1].trim();
            const cleanText = text.replace(openMatch[0], '').trim();
            return { thinking, text: cleanText };
        }
        return { thinking: '', text: text.trim() };
    }

    // 🕒 TIME FORMATTER
    function formatMsgTime(ts) {
        if (!ts) ts = Date.now();
        const d = new Date(ts);
        let h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    // 📝 ADVANCED MARKDOWN FORMATTER (ChatGPT & Gemini Quality)
    function formatMarkdown(text) {
        if (!text) return '';

        // Extract inline thinking if any remains in text
        let content = text;
        let thinkHtml = '';
        const parsedThink = extractThinking(content);
        if (parsedThink.thinking) {
            content = parsedThink.text;
            thinkHtml = `
                <details class="ai-thought-box" open>
                    <summary class="ai-thought-summary">
                        <div class="ai-thought-summary-left">
                            <i class="fas fa-brain"></i>
                            <span>Thinking Process</span>
                            <span class="ai-thought-status-badge">Reasoned</span>
                        </div>
                        <span class="ai-thought-chevron"><i class="fas fa-chevron-down"></i></span>
                    </summary>
                    <div class="ai-thought-content">
                        ${escapeHtml(parsedThink.thinking).replace(/\n/g, '<br>')}
                    </div>
                </details>
            `;
        }

        // Fenced code blocks with language header and sleek Copy button
        const codeBlocks = [];
        content = content.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const cleanLang = (lang || 'code').toLowerCase().trim();
            const displayLang = cleanLang ? cleanLang.toUpperCase() : 'CODE';
            const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
            const escapedCode = escapeHtml(code.trimEnd());
            codeBlocks.push(`
                <div class="ai-codeblock" data-lang="${cleanLang}">
                    <div class="ai-codeblock-bar">
                        <span class="ai-codeblock-lang"><i class="fas fa-code"></i> ${displayLang}</span>
                        <button type="button" class="ai-codeblock-copy" onclick="AIAgent.copyCodeBlock(this)" title="Copy Code">
                            <i class="fas fa-copy"></i> <span>Copy</span>
                        </button>
                    </div>
                    <pre class="ai-codeblock-pre"><code class="language-${cleanLang}">${escapedCode}</code></pre>
                </div>
            `);
            return token;
        });

        // Basic HTML escaping
        let html = escapeHtml(content);

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h4 class="ai-md-h3">$1</h4>');
        html = html.replace(/^## (.*$)/gim, '<h3 class="ai-md-h2">$1</h3>');
        html = html.replace(/^# (.*$)/gim, '<h2 class="ai-md-h1">$1</h2>');

        // Blockquotes
        html = html.replace(/^\> (.*$)/gim, '<blockquote class="ai-md-quote">$1</blockquote>');

        // Bold & Italic
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
        html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

        // Unordered lists (- or *)
        html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ai-md-li">$1</li>');
        html = html.replace(/(<li class="ai-md-li">.*<\/li>)/gim, '<ul class="ai-md-ul">$1</ul>');
        html = html.replace(/<\/ul>\s*<ul class="ai-md-ul">/gim, '');

        // Horizontal rules
        html = html.replace(/^---$/gim, '<hr class="ai-md-hr">');

        // Line breaks (convert double newlines to paragraph gap, single newline to <br>)
        html = html.replace(/\n\n+/g, '<br><br>');
        html = html.replace(/([^\n])\n([^\n])/g, '$1<br>$2');

        // Restore code blocks
        codeBlocks.forEach((blockHtml, idx) => {
            html = html.replace(`@@CODE_BLOCK_${idx}@@`, blockHtml);
        });

        return (thinkHtml ? thinkHtml : '') + html;
    }

    // 📋 COPY HELPERS
    function copyCodeBlock(buttonEl) {
        if (!buttonEl) return;
        const codeblock = buttonEl.closest('.ai-codeblock');
        if (!codeblock) return;
        const codeEl = codeblock.querySelector('code');
        if (!codeEl) return;
        const text = codeEl.innerText || codeEl.textContent || '';
        copyTextWithFeedback(text, buttonEl);
    }

    function copyDiffContent(toolId) {
        let contentToCopy = '';
        let filePath = '';
        for (const msg of messages) {
            if (Array.isArray(msg.toolsExecuted)) {
                const found = msg.toolsExecuted.find(t => t.toolId === toolId);
                if (found) {
                    contentToCopy = found.newContent || '';
                    filePath = found.path;
                    break;
                }
            }
        }
        if (!contentToCopy && filePath) {
            const f = VFS.get(filePath);
            if (f) contentToCopy = f.content;
        }

        if (contentToCopy) {
            copyTextWithFeedback(contentToCopy, null, `Copied updated ${filePath} to clipboard!`);
        }
    }

    function copyMessageText(index) {
        const msg = messages[index];
        if (!msg) return;
        const text = msg.text || msg.content || '';
        copyTextWithFeedback(text, null, "Message copied to clipboard!");
    }

    function copyTextWithFeedback(text, buttonEl, toastMsg) {
        const fallback = () => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                if (buttonEl) showCopyFeedback(buttonEl);
                if (toastMsg && typeof App !== 'undefined' && App.showToast) App.showToast(toastMsg, "success");
            } catch (e) {}
            document.body.removeChild(ta);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                if (buttonEl) showCopyFeedback(buttonEl);
                if (toastMsg && typeof App !== 'undefined' && App.showToast) App.showToast(toastMsg, "success");
            }).catch(fallback);
        } else {
            fallback();
        }
    }

    function showCopyFeedback(buttonEl) {
        const span = buttonEl.querySelector('span');
        const icon = buttonEl.querySelector('i');
        const origIcon = icon ? icon.className : 'fas fa-copy';
        const origText = span ? span.textContent : 'Copy';

        if (icon) icon.className = 'fas fa-check';
        if (span) span.textContent = 'Copied!';
        buttonEl.classList.add('copied');

        setTimeout(() => {
            if (icon) icon.className = origIcon;
            if (span) span.textContent = origText;
            buttonEl.classList.remove('copied');
        }, 2000);
    }

    function toggleDiff(toolId) {
        const body = document.getElementById(`diff-body-${toolId}`);
        const card = document.getElementById(`diff-card-${toolId}`);
        if (!body) return;
        const isHidden = (body.style.display === 'none' || !body.style.display);
        body.style.display = isHidden ? 'block' : 'none';
        if (card) {
            card.classList.toggle('expanded', isHidden);
            const toggleIcon = card.querySelector('.ai-diff-toggle-btn i');
            if (toggleIcon) {
                toggleIcon.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-code-compare';
            }
        }
    }

    function retryLastMessage() {
        if (isBusy) return;
        if (typeof AIModelRouter !== 'undefined' && AIModelRouter.resetStats) {
            AIModelRouter.resetStats();
        }
        let lastUserMsg = null;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                lastUserMsg = messages[i];
                break;
            }
        }
        if (lastUserMsg && lastUserMsg.text) {
            sendMessage(lastUserMsg.text);
        }
    }

    // 🌊 PROGRESSIVE TYPEWRITER STREAMING ANIMATION
    let activeStreamingTimer = null;

    function startTypewriterStreaming(msgIndex, fullText, isAlreadyStreamed) {
        if (!fullText || fullText.length === 0) return;
        const textTarget = document.getElementById(`ai-msg-text-${msgIndex}`);
        const streamContainer = document.getElementById('ai-chat-stream');
        if (!textTarget) return;

        // If the message was already streamed token-by-token live over SSE,
        // it is already on screen in real time — finalize immediately!
        if (isAlreadyStreamed) {
            textTarget.innerHTML = formatMarkdown(fullText);
            if (streamContainer) {
                streamContainer.scrollTop = streamContainer.scrollHeight;
            }
            return;
        }

        if (activeStreamingTimer) {
            clearInterval(activeStreamingTimer);
            activeStreamingTimer = null;
        }

        const totalChars = fullText.length;
        const chunkSize = Math.max(3, Math.min(25, Math.ceil(totalChars / 90)));
        let charIndex = 0;

        textTarget.innerHTML = '<span class="ai-streaming-cursor"></span>';

        activeStreamingTimer = setInterval(() => {
            charIndex += chunkSize;
            if (charIndex >= totalChars) {
                charIndex = totalChars;
                clearInterval(activeStreamingTimer);
                activeStreamingTimer = null;
                textTarget.innerHTML = formatMarkdown(fullText);
            } else {
                const slice = fullText.substring(0, charIndex);
                textTarget.innerHTML = formatMarkdown(slice) + '<span class="ai-streaming-cursor"></span>';
            }

            if (streamContainer) {
                streamContainer.scrollTop = streamContainer.scrollHeight;
            }
        }, 16);

        // Click on bubble immediately skips/finishes typing
        textTarget.closest('.ai-bubble')?.addEventListener('click', function onSkip() {
            if (activeStreamingTimer) {
                clearInterval(activeStreamingTimer);
                activeStreamingTimer = null;
                textTarget.innerHTML = formatMarkdown(fullText);
            }
        }, { once: true });
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function fixError(errorMsg) {
        togglePanel(true);
        const prompt = `I encountered this error in the console:\n"${errorMsg}"\nPlease analyze my project code, explain what caused this error, and fix the code.`;
        setTimeout(() => {
            const input = document.getElementById('ai-prompt-input');
            if (input) {
                input.value = prompt;
                autoResize(input);
            }
            sendMessage(prompt);
        }, 150);
    }

    return {
        init,
        sendMessage,
        fixError,
        clearChat,
        resetContext,
        togglePanel,
        toggleWideMode,
        openSettings,
        switchModalTab,
        saveSettingsFromModal,
        toggleTuningEdit,
        resetTuningDefaults,
        applyTuningPreset,
        handleTempInput,
        handleStepsInput,
        renderConnectedProvidersTab,
        handleAgentProviderChange,
        handleAgentModelChange,
        updateModelTag,
        updateProviderFields,
        fetchModels,
        connect,
        testConnection: testConnectionExposed,
        pickModel,
        handleApiKeyInput,
        handleModelInput,
        toggleApiKeyVisibility,
        getAvailableModels: () => availableModels.slice(),
        getConfig: () => config,
        saveConfig,

        // 🧭 Auto model router
        setRouterEnabled,
        setRouterStrategy,
        setRouterBudget,
        setRouterHedge,
        toggleRouterModel,
        resetRouterStats,
        toggleRouterEdit,
        resetRouterDefaults,
        applyRouterPreset,
        handleRouterBudgetInput,
        refreshRouter,
        renderRouterPanel,
        buildRouterChain,
        isRouterEnabled,
        routerStrategy,
        updateChipsVisibility,
        autoResize,
        handleInputKeydown,
        triggerImageUpload,
        handleImageUpload,
        clearAttachment,
        handleInputPaste,

        // 🚀 Advanced Chat Extras
        copyCodeBlock,
        copyDiffContent,
        copyMessageText,
        toggleDiff,
        retryLastMessage
    };
})();
