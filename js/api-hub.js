/* ════════════════════════════════════════════════════════════════════════════
   API CONNECT HUB — Master Web IDE Ultra
   Multi-provider API keys, live quota probing, detailed token accounting and
   a working chat — modelled on FreeLLMAPI.

   DATA ISOLATION
   • Every key, counter and chat message lives in this browser's localStorage.
   • The only network calls this module makes go to the provider the user
     explicitly connected, and only after the user presses Connect / Send.
   • There is no backend, no telemetry, no analytics.
   ════════════════════════════════════════════════════════════════════════════ */
const APIHub = (function () {
    'use strict';

    const HUB_KEY = 'master_ide_api_hub';
    const USAGE_KEY = 'master_ide_api_usage';
    const CHAT_KEY = 'master_ide_api_hub_chat';

    const TABS = [
        { id: 'connect', label: 'Connect', icon: 'fa-plug' },
        { id: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
        { id: 'usage', label: 'Usage', icon: 'fa-chart-column' },
        { id: 'models', label: 'All AIs', icon: 'fa-brain' },
        { id: 'chat', label: 'API Chat', icon: 'fa-comments' }
    ];

    /* ── state ───────────────────────────────────────────────────────────── */
    let hub = blankHub();
    let usage = blankUsage();
    let chat = { messages: [], provider: '', model: '' };
    let activeTab = 'connect';
    let filterText = '';
    let filterMode = 'all';
    let usageDay = 'all';
    let busy = false;
    let probeTimer = null;
    let pickerProviderId = null;
    let pickerTempSelection = new Set();
    let pickerModels = [];
    let pickerFilterQuery = '';
    let pickerActiveFilter = 'all';

    function blankHub() {
        return { version: 1, providers: {}, settings: { autoRefresh: true } };
    }
    function blankUsage() {
        return { version: 1, providers: {} };
    }

    /* ── tiny helpers ───────────────────────────────────────────────────── */
    function esc(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function num(value, fallback) {
        const n = Number(value);
        return isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
    }
    function today() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function stamp() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }
    function fmt(n) {
        const v = num(n);
        if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + 'B';
        if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
        if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(2) + 'K';
        return String(Math.round(v * 100) / 100);
    }
    function fmtMoney(n) {
        const v = num(n);
        if (v === 0) return '$0.00';
        if (v < 0.01) return '$' + v.toFixed(6);
        return '$' + v.toFixed(4);
    }
    function toast(msg, type) {
        if (typeof App !== 'undefined' && App.showToast) App.showToast(msg, type || 'info');
    }
    function el(id) { return document.getElementById(id); }
    function debounce(fn, ms) {
        let t = null;
        return function () {
            const args = arguments;
            clearTimeout(t);
            t = setTimeout(() => fn.apply(null, args), ms);
        };
    }

    /* ── persistence ────────────────────────────────────────────────────── */
    function load() {
        try {
            const raw = localStorage.getItem(HUB_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    hub = Object.assign(blankHub(), parsed);
                    hub.providers = parsed.providers || {};
                    hub.settings = Object.assign({ autoRefresh: true }, parsed.settings || {});

                    // Clean up any old keyless providers or empty-key connections
                    // Every single provider requires an API key from the user
                    let hubChanged = false;
                    Object.keys(hub.providers).forEach(id => {
                        const rec = hub.providers[id];
                        if (rec) {
                            if (rec.keyless) {
                                rec.keyless = false;
                                hubChanged = true;
                            }
                            // Clean up lingering checking state from previous sessions or aborted requests
                            if (rec.status === 'checking') {
                                rec.status = 'idle';
                                rec.message = '';
                                hubChanged = true;
                            }
                            // If provider has no key or empty key, reset any error/checking/ok state to clean idle
                            if (!rec.key || !String(rec.key).trim()) {
                                if (rec.status !== 'idle' || rec.message) {
                                    rec.status = 'idle';
                                    rec.message = '';
                                    rec.models = [];
                                    rec.enabledModels = [];
                                    hubChanged = true;
                                }
                            } else {
                                // Auto-heal: If provider has a valid key and enabled models, heal status to 'ok'
                                if (rec.status !== 'err' && Array.isArray(rec.enabledModels) && rec.enabledModels.length > 0 && rec.status !== 'ok') {
                                    rec.status = 'ok';
                                    hubChanged = true;
                                }
                            }
                            // Ensure connected providers have enabledModels array populated
                            if (rec.status === 'ok' && (!Array.isArray(rec.enabledModels) || !rec.enabledModels.length)) {
                                const ms = (rec.models && rec.models.length) ? rec.models : getSeededModels(id);
                                rec.enabledModels = ms.map(m => m.id);
                                hubChanged = true;
                            }
                        }
                    });
                    if (hubChanged) {
                        try { localStorage.setItem(HUB_KEY, JSON.stringify(hub)); } catch (e) {}
                    }
                }
            }
        } catch (e) { hub = blankHub(); }
        try {
            const raw = localStorage.getItem(USAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    usage = Object.assign(blankUsage(), parsed);
                    usage.providers = parsed.providers || {};
                }
            }
        } catch (e) { usage = blankUsage(); }
        try {
            const raw = localStorage.getItem(CHAT_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    chat = Object.assign({ messages: [], provider: '', model: '' }, parsed);
                    chat.messages = Array.isArray(parsed.messages) ? parsed.messages : [];
                }
            }
        } catch (e) { chat = { messages: [], provider: '', model: '' }; }
    }

    function saveHub() {
        try { localStorage.setItem(HUB_KEY, JSON.stringify(hub)); } catch (e) { /* quota / private mode */ }
    }
    function saveUsage() {
        try { localStorage.setItem(USAGE_KEY, JSON.stringify(usage)); } catch (e) { /* ignore */ }
    }
    function saveChat() {
        try { localStorage.setItem(CHAT_KEY, JSON.stringify(chat)); } catch (e) { /* ignore */ }
    }

    /* ── provider records ───────────────────────────────────────────────── */
    function meta(id) {
        const known = (typeof AIProviderCatalog !== 'undefined') ? AIProviderCatalog.get(id) : null;
        return known || hub.providers[id] || { id: id, name: id, baseUrl: '', kind: 'openai' };
    }

    function record(id) {
        if (!hub.providers[id]) {
            const m = meta(id);
            hub.providers[id] = {
                id: id,
                name: m.name || id,
                baseUrl: m.baseUrl || '',
                kind: m.kind || 'openai',
                keyless: false,
                key: '',
                status: 'idle',
                message: '',
                models: [],
                quota: null,
                addedAt: 0,
                checkedAt: 0
            };
        }
        return hub.providers[id];
    }

    function connectedIds() {
        return Object.keys(hub.providers).filter(id => {
            const r = hub.providers[id];
            return r && r.status === 'ok' && r.key && String(r.key).trim().length > 0;
        });
    }
    function isConnected(id) {
        const r = hub.providers[id];
        return !!(r && r.status === 'ok' && r.key && String(r.key).trim().length > 0);
    }

    /* ── network helpers ────────────────────────────────────────────────── */
    function authHeaders(rec) {
        const headers = { 'Accept': 'application/json' };
        if (rec.key) headers['Authorization'] = 'Bearer ' + rec.key;
        return headers;
    }

    function readRateLimitHeaders(id, res) {
        const spec = (typeof AIProviderCatalog !== 'undefined') ? AIProviderCatalog.headerSpec(id) : null;
        if (!spec || !res || !res.headers || typeof res.headers.get !== 'function') return null;
        const out = [];
        spec.forEach(s => {
            const limit = res.headers.get(s.limit);
            const remaining = res.headers.get(s.remaining);
            const reset = res.headers.get(s.reset);
            if (limit === null && remaining === null && reset === null) return;
            out.push({
                metric: s.metric,
                limit: limit === null ? null : num(limit, null),
                remaining: remaining === null ? null : num(remaining, null),
                reset: reset || null,
                strategy: s.strategy
            });
        });
        return out.length ? out : null;
    }

    function applyRateLimit(id, res) {
        const observed = readRateLimitHeaders(id, res);
        if (!observed) return;
        const rec = record(id);
        rec.quota = {
            metric: observed[0].metric,
            limit: observed[0].limit,
            remaining: observed[0].remaining,
            reset: observed[0].reset,
            source: 'rate-limit-headers',
            observedAt: Date.now(),
            all: observed
        };
        saveHub();
    }

    const KNOWN_DEFAULT_MODELS = {
        google: [
            { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
            { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
            { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
            { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
            { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
        ],
        openrouter: [
            // ── Free Models ──
            { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super 120B (free)', size: 'Medium', ctx: '1M ctx', isFree: true },
            { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (free)', size: 'Large', ctx: '262K ctx', isFree: true },
            { id: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B-A4B (free)', size: 'Large', ctx: '262K ctx', isFree: true },
            { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', label: 'Nemotron 3 Nano 30B Reasoning (free)', size: 'Medium', ctx: '262K ctx', isFree: true },
            { id: 'cohere/north-mini-code:free', label: 'North Mini Code (free)', size: 'Medium', ctx: '256K ctx', isFree: true },
            { id: 'dots-studio/dots-3-note-preview:free', label: 'Dots3 Note Preview (free)', size: 'Frontier', ctx: '512K ctx', isFree: true },
            { id: 'liquid/lfm-2.5-2.6b:free', label: 'LFM2.5 2.6B (free)', size: 'Medium', ctx: '33K ctx', isFree: true },
            { id: 'nvidia/nemotron-3.5-content-safety:free', label: 'Nemotron 3.5 Content Safety (free)', size: 'Small', ctx: '128K ctx', isFree: true },
            { id: 'nvidia/nemotron-3.5-lightning:free', label: 'Nemotron 3.5 Lightning (free)', size: 'Medium', ctx: '1M ctx', isFree: true },
            { id: 'poolside/laguna-s-2.1:free', label: 'Poolside Laguna S 2.1 (free)', size: 'Large', ctx: '262K ctx', isFree: true },
            { id: 'poolside/laguna-xs-2.1:free', label: 'Poolside Laguna XS 2.1 (free)', size: 'Large', ctx: '131K ctx', isFree: true },
            // ── Top Paid Models ──
            { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', size: 'Frontier', ctx: '200K ctx', isFree: false },
            { id: 'openai/gpt-4o', label: 'GPT-4o', size: 'Frontier', ctx: '128K ctx', isFree: false },
            { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (Reasoner)', size: 'Frontier', ctx: '64K ctx', isFree: false },
            { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct', size: 'Large', ctx: '128K ctx', isFree: false },
            { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', size: 'Medium', ctx: '1M ctx', isFree: false }
        ],
        groq: [
            { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', size: 'Large', ctx: '128K ctx' },
            { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', size: 'Small', ctx: '128K ctx' },
            { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', size: 'Medium', ctx: '32K ctx' }
        ],
        cerebras: [
            { id: 'llama-3.3-70b', label: 'Llama 3.3 70B (Cerebras Ultra-Fast)', size: 'Large', ctx: '128K ctx' },
            { id: 'llama3.1-8b', label: 'Llama 3.1 8B', size: 'Small', ctx: '128K ctx' }
        ],
        openai: [
            { id: 'gpt-4o', label: 'GPT-4o', size: 'Frontier', ctx: '128K ctx' },
            { id: 'gpt-4o-mini', label: 'GPT-4o Mini', size: 'Medium', ctx: '128K ctx' },
            { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', size: 'Small', ctx: '16K ctx' }
        ],
        anthropic: [
            { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', size: 'Frontier', ctx: '200K ctx' },
            { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', size: 'Medium', ctx: '200K ctx' }
        ],
        deepseek: [
            { id: 'deepseek-chat', label: 'DeepSeek-V3 (Chat)', size: 'Large', ctx: '64K ctx' },
            { id: 'deepseek-reasoner', label: 'DeepSeek-R1 (Reasoner)', size: 'Frontier', ctx: '64K ctx' }
        ],
        mistral: [
            { id: 'mistral-large-latest', label: 'Mistral Large', size: 'Frontier', ctx: '128K ctx' },
            { id: 'codestral-latest', label: 'Codestral', size: 'Large', ctx: '256K ctx' },
            { id: 'mistral-small-latest', label: 'Mistral Small', size: 'Medium', ctx: '32K ctx' }
        ],
        opencode: [
            { id: 'deepseek-chat', label: 'DeepSeek V3 (Chat)', size: 'Large', ctx: '64K ctx' },
            { id: 'deepseek-reasoner', label: 'DeepSeek R1 (Reasoner)', size: 'Frontier', ctx: '64K ctx' },
            { id: 'qwen2.5-coder-32b-instruct', label: 'Qwen 2.5 Coder 32B', size: 'Large', ctx: '32K ctx' },
            { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct', size: 'Large', ctx: '128K ctx' },
            { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', size: 'Medium', ctx: '128K ctx' },
            { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', size: 'Frontier', ctx: '200K ctx' },
            { id: 'default', label: 'OpenCode Zen (Auto Default)', size: 'Medium', ctx: '128K ctx' }
        ],
        together: [
            { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Turbo', size: 'Large', ctx: '128K ctx' },
            { id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3', size: 'Large', ctx: '64K ctx' },
            { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen 2.5 Coder 32B', size: 'Large', ctx: '32K ctx' }
        ],
        siliconflow: [
            { id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3 (Free/Fast)', size: 'Large', ctx: '64K ctx' },
            { id: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1', size: 'Frontier', ctx: '64K ctx' },
            { id: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen 2.5 7B', size: 'Small', ctx: '32K ctx' }
        ],
        sambanova: [
            { id: 'Meta-Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B (SambaNova Turbo)', size: 'Large', ctx: '128K ctx' },
            { id: 'Meta-Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B', size: 'Small', ctx: '128K ctx' },
            { id: 'Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B', size: 'Frontier', ctx: '32K ctx' }
        ],
        hyperbolic: [
            { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B', size: 'Large', ctx: '128K ctx' },
            { id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3', size: 'Large', ctx: '64K ctx' },
            { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen 2.5 Coder 32B', size: 'Large', ctx: '32K ctx' }
        ],
        fireworks: [
            { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', label: 'Llama 3.3 70B', size: 'Large', ctx: '128K ctx' },
            { id: 'accounts/fireworks/models/deepseek-v3', label: 'DeepSeek V3', size: 'Large', ctx: '64K ctx' },
            { id: 'accounts/fireworks/models/qwen2p5-coder-32b-instruct', label: 'Qwen 2.5 Coder 32B', size: 'Large', ctx: '32K ctx' }
        ],
        aihorde: [
            { id: 'auto', label: 'AI Horde Auto (Best Free Gateway)', size: 'Medium', ctx: '32K ctx' },
            { id: 'mistralai/Mistral-7B-Instruct-v0.2', label: 'Mistral 7B Instruct', size: 'Small', ctx: '32K ctx' },
            { id: 'meta-llama/Llama-3-8b-instruct', label: 'Llama 3 8B Instruct', size: 'Small', ctx: '8K ctx' }
        ],
        kilo: [
            { id: 'auto', label: 'Kilo Free Gateway (Auto)', size: 'Medium', ctx: '32K ctx' }
        ],
        ovh: [
            { id: 'meta-llama-3-8b-instruct', label: 'OVH Llama 3 8B Free', size: 'Small', ctx: '8K ctx' }
        ],
        parallel: [
            { id: 'default', label: 'Parallel Gateway (Auto)', size: 'Medium', ctx: '32K ctx' }
        ]
    };

    function getSeededModels(providerId) {
        if (KNOWN_DEFAULT_MODELS[providerId]) {
            return KNOWN_DEFAULT_MODELS[providerId].slice();
        }
        const fromCat = (typeof AIProviderCatalog !== 'undefined') ? AIProviderCatalog.modelsFor(providerId) : [];
        if (fromCat && fromCat.length) {
            return fromCat.map(m => ({
                id: m.id,
                label: m.name || m.id,
                size: m.size || 'Medium',
                ctx: m.ctx ? (m.ctx >= 1000000 ? Math.round(m.ctx/1000000) + 'M ctx' : Math.round(m.ctx/1024) + 'K ctx') : '128K ctx'
            }));
        }
        const metaInfo = meta(providerId);
        return [
            { id: 'default', label: (metaInfo.name || providerId) + ' (Default Model)', size: 'Medium', ctx: '128K ctx' }
        ];
    }

    /** GET {base}/models with live discovery + graceful verified catalogue fallback */
    async function fetchModels(rec) {
        const id = rec.id;
        const base = String(rec.baseUrl || '').replace(/\/+$/, '');
        if (!base) return getSeededModels(id);

        if (id === 'openrouter') {
            return getSeededModels('openrouter');
        }

        let liveModels = null;
        try {
            if (rec.kind === 'gemini') {
                const url = base + '/models?key=' + encodeURIComponent(rec.key || '') + '&pageSize=200';
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2500);
                try {
                    const res = await fetch(url, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (res.ok) {
                        const data = await res.json();
                        const list = (Array.isArray(data.models) ? data.models : [])
                            .filter(m => !Array.isArray(m.supportedGenerationMethods) ||
                                m.supportedGenerationMethods.indexOf('generateContent') !== -1)
                            .map(m => ({
                                id: String(m.name || '').replace(/^models\//, ''),
                                label: m.displayName || String(m.name || '').replace(/^models\//, '')
                            }))
                            .filter(m => m.id);
                        if (list.length) {
                            applyRateLimit(id, res);
                            liveModels = list;
                        }
                    } else if (res.status === 400 || res.status === 401 || res.status === 403) {
                        const errTxt = await errorMessage(res);
                        if (/key|invalid|unauthorized|argument/i.test(errTxt)) {
                            throw new Error(errTxt);
                        }
                    }
                } catch (fetchErr) {
                    clearTimeout(timeoutId);
                    throw fetchErr;
                }
            } else {
                // OpenAI-compatible endpoint
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2500);
                try {
                    const res = await fetch(base + '/models', {
                        headers: authHeaders(rec),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (res.ok) {
                        const data = await res.json();
                        const raw = Array.isArray(data.data) ? data.data
                            : Array.isArray(data.models) ? data.models
                                : Array.isArray(data) ? data : [];
                        const list = raw.map(m => {
                            if (typeof m === 'string') return { id: m, label: m };
                            const mid = m.id || m.name || m.slug || '';
                            return { id: String(mid), label: m.display_name || m.name || String(mid) };
                        }).filter(m => m.id);
                        if (list.length) {
                            applyRateLimit(id, res);
                            liveModels = list;
                        }
                    } else if (res.status === 401 || res.status === 403) {
                        const errTxt = await errorMessage(res);
                        throw new Error(errTxt || 'Invalid API key or unauthorized (HTTP ' + res.status + ')');
                    }
                } catch (fetchErr) {
                    clearTimeout(timeoutId);
                    throw fetchErr;
                }
            }
        } catch (netErr) {
            if (/key|invalid|unauthorized|argument|401|403|denied|forbidden/i.test(netErr.message)) {
                throw netErr;
            }
            console.warn(`[APIHub] Live /models check for ${id} blocked (likely CORS or network), using verified catalogue:`, netErr.message);
        }

        if (liveModels && liveModels.length) {
            return liveModels;
        }

        // Return verified seeded catalogue models for this provider
        const seeded = getSeededModels(id);
        if (seeded && seeded.length) {
            return seeded;
        }
        return [{ id: 'default', label: (rec.name || id) + ' (Default Model)' }];
    }

    async function errorMessage(res) {
        try {
            const data = await res.json();
            const err = (data && (data.error || data)) || {};
            const message = err.message || err.status || err.code || data.message;
            if (message) return res.status + ' — ' + message;
        } catch (e) { /* not json */ }
        return res.status + ' ' + (res.statusText || 'Request failed');
    }

    /* ── quota probes ───────────────────────────────────────────────────── */
    function pickField(obj, names) {
        for (let i = 0; i < names.length; i++) {
            const v = obj ? obj[names[i]] : undefined;
            if (v !== undefined && v !== null && v !== '') return num(v, null);
        }
        return null;
    }

    async function probeQuota(id) {
        const rec = hub.providers[id];
        if (!rec) return null;
        const m = meta(id);
        const probe = m.probe;
        if (!probe || !probe.url) return rec.quota || null;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        try {
            const res = await fetch(probe.url, {
                headers: authHeaders(rec),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) return rec.quota || null;
            const body = await res.json();
            const scope = (body && body.data && typeof body.data === 'object') ? body.data : body;
            const limit = pickField(scope, probe.limitFields);
            const remaining = pickField(scope, probe.remainingFields);
            rec.quota = {
                metric: probe.metric || 'requests',
                limit: limit,
                remaining: remaining,
                reset: null,
                source: 'quota-api',
                observedAt: Date.now()
            };
            applyRateLimit(id, res);
            saveHub();
            return rec.quota;
        } catch (e) {
            clearTimeout(timeoutId);
            return rec.quota || null;
        }
    }

    function setDraftKey(id, val) {
        const rec = record(id);
        rec.key = String(val === undefined || val === null ? '' : val).trim();
        if (rec.status === 'err') {
            rec.status = 'idle';
            rec.message = '';
            render();
        }
        saveHub();
    }

    /* ── connect / disconnect ───────────────────────────────────────────── */
    async function connect(id, key) {
        const m = meta(id);
        hub.providers[id] = hub.providers[id] || record(id);
        const rec = hub.providers[id];
        rec.name = m.name || rec.name;
        if (!rec.baseUrl && m.baseUrl) rec.baseUrl = m.baseUrl;
        rec.keyless = false;

        // Auto-read from input element if not explicitly provided
        if (key === undefined || key === null || key === '') {
            const input = el('apikey-' + id);
            if (input && input.value) key = input.value;
        }

        const typed = String(key === undefined ? '' : key).trim();
        if (!typed && !rec.key) {
            rec.status = 'err';
            rec.message = 'Paste an API key first.';
            render();
            toast('Please paste your ' + (m.name || id) + ' API key first.', 'warning');
            setTimeout(() => {
                if (!rec.key && rec.status === 'err') {
                    rec.status = 'idle';
                    rec.message = '';
                    render();
                }
            }, 3000);
            return false;
        }
        if (typed) rec.key = typed;

        // In-memory UI checking state
        rec.status = 'checking';
        rec.message = 'Verifying API key…';
        render();

        try {
            // Strict authentication probe for OpenRouter:
            // Since OpenRouter's /models endpoint is public, we must check /api/v1/key to authenticate
            if (id === 'openrouter') {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                try {
                    const probeRes = await fetch('https://openrouter.ai/api/v1/key', {
                        headers: {
                            'Authorization': 'Bearer ' + rec.key,
                            'HTTP-Referer': (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://localhost',
                            'X-Title': 'Web Maker IDE'
                        },
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    if (!probeRes.ok) {
                        let errTxt = 'Invalid OpenRouter API Key (HTTP ' + probeRes.status + ')';
                        try {
                            const errBody = await probeRes.json();
                            if (errBody && errBody.error && errBody.error.message) {
                                errTxt = errBody.error.message;
                            }
                        } catch (e) {}
                        throw new Error(errTxt);
                    }
                } catch (netErr) {
                    clearTimeout(timeoutId);
                    throw netErr;
                }
            }

            const models = await fetchModels(rec);
            rec.models = models;
            rec.status = 'ok';
            // Enable all models by default on connect
            rec.enabledModels = models.map(x => x.id);
            rec.message = models.length + ' of ' + models.length + ' model' + (models.length === 1 ? '' : 's') + ' enabled';
            rec.addedAt = rec.addedAt || Date.now();
            rec.checkedAt = Date.now();
            saveHub();

            // Auto-sync with AIAgent if applicable
            syncToAIAgent(id, rec.key);

            try {
                await Promise.race([
                    probeQuota(id),
                    new Promise(r => setTimeout(r, 1500))
                ]);
            } catch (qErr) { /* non-fatal */ }

            render();
            toast(m.name + ' connected successfully!', 'success');

            // Open Model Selection popup ONLY when key is genuinely verified!
            openModelSelector(id);
            return true;
        } catch (err) {
            rec.status = 'err';
            rec.message = (err && err.message) ? String(err.message) : 'Connection failed';
            rec.checkedAt = Date.now();
            saveHub();
            render();
            toast(m.name + ': ' + rec.message, 'error');
            return false;
        }
    }

    function syncToAIAgent(id, key) {
        if (!key || typeof AIAgent === 'undefined') return;
        try {
            const aiCfg = AIAgent.getConfig ? AIAgent.getConfig() : null;
            if (aiCfg) {
                const targetProv = (id === 'google') ? 'gemini' : id;
                if (aiCfg.provider === targetProv && !aiCfg.apiKey) {
                    aiCfg.apiKey = key;
                    if (AIAgent.saveConfig) AIAgent.saveConfig(true);
                }
            }
        } catch (e) { /* ignore */ }
    }

    function disconnect(id) {
        const rec = hub.providers[id];
        if (!rec) return;
        rec.key = '';
        rec.status = 'idle';
        rec.message = '';
        rec.models = [];
        rec.quota = null;
        saveHub(); render();
    }

    function forget(id) {
        delete hub.providers[id];
        saveHub(); render();
    }

    /** wipe every key, quota snapshot, counter and chat message */
    function forgetAll() {
        hub = blankHub();
        usage = blankUsage();
        chat = { messages: [], provider: '', model: '' };
        // Remove the storage entries outright — an empty placeholder would
        // still leave a trace on a shared device.
        try { localStorage.removeItem(HUB_KEY); } catch (e) { /* storage blocked */ }
        try { localStorage.removeItem(USAGE_KEY); } catch (e) { /* storage blocked */ }
        try { localStorage.removeItem(CHAT_KEY); } catch (e) { /* storage blocked */ }
    }

    /* ── usage accounting ───────────────────────────────────────────────── */
    function usageFor(id) {
        if (!usage.providers[id]) {
            usage.providers[id] = {
                requests: 0, ok: 0, errors: 0,
                inputTokens: 0, outputTokens: 0, cost: 0,
                byModel: {}, byDay: {}
            };
        }
        return usage.providers[id];
    }

    function bump(bucket, model, delta) {
        bucket.requests += 1;
        if (delta.ok) bucket.ok += 1; else bucket.errors += 1;
        bucket.inputTokens += num(delta.inputTokens);
        bucket.outputTokens += num(delta.outputTokens);
        bucket.cost += num(delta.cost);
        if (model) {
            if (!bucket.byModel[model]) {
                bucket.byModel[model] = { requests: 0, ok: 0, errors: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
            }
            const m = bucket.byModel[model];
            m.requests += 1;
            if (delta.ok) m.ok += 1; else m.errors += 1;
            m.inputTokens += num(delta.inputTokens);
            m.outputTokens += num(delta.outputTokens);
            m.cost += num(delta.cost);
        }
        const day = today();
        if (!bucket.byDay[day]) {
            bucket.byDay[day] = { requests: 0, ok: 0, errors: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
        }
        const d = bucket.byDay[day];
        d.requests += 1;
        if (delta.ok) d.ok += 1; else d.errors += 1;
        d.inputTokens += num(delta.inputTokens);
        d.outputTokens += num(delta.outputTokens);
        d.cost += num(delta.cost);
    }

    /** record one request; usage = {prompt_tokens, completion_tokens, total_tokens} */
    function recordUsage(id, model, usageObj, ok) {
        const bucket = usageFor(id);
        const inputTokens = num(usageObj && (usageObj.prompt_tokens !== undefined ? usageObj.prompt_tokens : usageObj.inputTokens));
        const outputTokens = num(usageObj && (usageObj.completion_tokens !== undefined ? usageObj.completion_tokens : usageObj.outputTokens));
        const price = (typeof AIProviderCatalog !== 'undefined') ? AIProviderCatalog.priceFor(id, model) : null;
        let cost = 0;
        if (price) {
            cost = (inputTokens / 1e6) * num(price.in) + (outputTokens / 1e6) * num(price.out);
        }
        bump(bucket, model, { ok: ok, inputTokens: inputTokens, outputTokens: outputTokens, cost: cost });
        saveUsage();
        return cost;
    }

    /* ── chat engine ────────────────────────────────────────────────────── */
    function buildChatBody(rec, model, messages) {
        const base = String(rec.baseUrl || '').replace(/\/+$/, '');
        if (rec.kind === 'gemini') {
            const contents = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: String(m.content || '') }]
                }));
            const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
            const body = { contents: contents };
            if (system) body.systemInstruction = { parts: [{ text: system }] };
            return { url: base + '/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(rec.key || ''), body: body, gemini: true };
        }
        const body = {
            model: model,
            messages: messages.map(m => ({ role: m.role, content: String(m.content || '') }))
        };
        return { url: base + '/chat/completions', body: body, gemini: false };
    }

    function parseChatReply(payload, gemini) {
        if (gemini) {
            const parts = payload && payload.candidates && payload.candidates[0] &&
                payload.candidates[0].content && payload.candidates[0].content.parts;
            const text = (parts || []).map(p => p.text || '').join('');
            const meta = payload && payload.usageMetadata ? payload.usageMetadata : {};
            return {
                text: text,
                usage: {
                    prompt_tokens: num(meta.promptTokenCount),
                    completion_tokens: num(meta.candidatesTokenCount),
                    total_tokens: num(meta.totalTokenCount)
                }
            };
        }
        const choice = payload && payload.choices && payload.choices[0];
        const text = choice && choice.message ? String(choice.message.content || '') : '';
        const u = payload && payload.usage ? payload.usage : {};
        return {
            text: text,
            usage: {
                prompt_tokens: num(u.prompt_tokens !== undefined ? u.prompt_tokens : u.input_tokens),
                completion_tokens: num(u.completion_tokens !== undefined ? u.completion_tokens : u.output_tokens),
                total_tokens: num(u.total_tokens !== undefined ? u.total_tokens : (num(u.prompt_tokens) + num(u.completion_tokens)))
            }
        };
    }

    /** One chat round-trip against a connected provider. */
    async function chatOnce(providerId, model, messages) {
        const rec = hub.providers[providerId];
        if (!rec.key || !String(rec.key).trim()) throw new Error('No API key provided for ' + (rec.name || providerId) + '. Connect with your API key first.');
        const spec = buildChatBody(rec, model, messages);
        const headers = { 'Content-Type': 'application/json' };
        if (spec.gemini) {
            if (rec.key) headers['x-goog-api-key'] = rec.key;
        } else if (rec.key) {
            headers['Authorization'] = 'Bearer ' + rec.key;
        }
        const res = await fetch(spec.url, { method: 'POST', headers: headers, body: JSON.stringify(spec.body) });
        if (!res.ok) throw new Error(await errorMessage(res));
        const payload = await res.json();
        applyRateLimit(providerId, res);
        return parseChatReply(payload, spec.gemini);
    }

    /* ── totals for the dashboard ───────────────────────────────────────── */
    function totals() {
        const t = {
            providers: 0, models: 0, requests: 0, ok: 0, errors: 0,
            inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0,
            freeTokens: 0, freeTokenProviders: 0, reportedRemaining: 0, reportedLimit: 0
        };

        // Token / request counters — only providers that actually saw traffic.
        Object.keys(usage.providers).forEach(id => {
            const u = usage.providers[id];
            t.requests += num(u.requests);
            t.ok += num(u.ok);
            t.errors += num(u.errors);
            t.inputTokens += num(u.inputTokens);
            t.outputTokens += num(u.outputTokens);
            t.cost += num(u.cost);
        });

        // Connected APIs — every one of them counts towards the free-token
        // total, even if nothing has been sent through it yet.
        Object.keys(hub.providers).forEach(id => {
            const rec = hub.providers[id];
            if (!rec || rec.status !== 'ok' || !rec.key || !String(rec.key).trim()) return;
            t.providers += 1;
            t.models += (rec.models || []).length;
            const seeded = (typeof AIProviderCatalog !== 'undefined') ? AIProviderCatalog.modelsFor(id) : [];
            let free = 0;
            seeded.forEach(m => { free += AIProviderCatalog.parseBudget(m.budget); });
            if (free > 0) { t.freeTokens += free; t.freeTokenProviders += 1; }
            if (rec.quota && rec.quota.remaining !== null && rec.quota.remaining !== undefined) {
                t.reportedRemaining += num(rec.quota.remaining);
                t.reportedLimit += num(rec.quota.limit);
            }
        });

        t.totalTokens = t.inputTokens + t.outputTokens;
        return t;
    }

    /* ── rendering ──────────────────────────────────────────────────────── */
    function render() {
        const root = el('api-hub-body-modal') || el('api-hub-body');
        if (!root) return;
        renderTabs();
        if (activeTab === 'connect') renderConnect(root);
        else if (activeTab === 'dashboard' || activeTab === 'usage') renderDashboard(root);
        else if (activeTab === 'models') renderModels(root);
        else if (activeTab === 'chat') renderChat(root);
    }

    function renderTabs() {
        const nav = el('api-hub-tabs');
        if (!nav) return;
        nav.innerHTML = TABS.map(t =>
            '<button class="apihub-tab' + (t.id === activeTab ? ' active' : '') + '" data-tab="' + t.id +
            '" onclick="APIHub.setTab(\'' + t.id + '\')"><i class="fas ' + t.icon + '"></i> ' + t.label + '</button>'
        ).join('');
    }

    function providerCard(m) {
        const rec = hub.providers[m.id];
        const status = rec ? rec.status : 'idle';
        const message = rec ? rec.message : '';
        const keyValue = rec && rec.key ? rec.key : '';
        const quota = rec ? rec.quota : null;
        const seeded = (typeof AIProviderCatalog !== 'undefined') ? AIProviderCatalog.modelsFor(m.id) : [];
        const seededText = seeded.length
            ? seeded.length + ' free-tier model' + (seeded.length === 1 ? '' : 's')
            : '';

        let quotaHtml = '';
        if (quota && (quota.remaining !== null && quota.remaining !== undefined)) {
            const pct = (quota.limit > 0) ? Math.max(0, Math.min(100, (num(quota.remaining) / num(quota.limit)) * 100)) : null;
            quotaHtml =
                '<div class="apihub-quota">' +
                '<span class="apihub-quota-label">' + esc(quota.metric || 'remaining') + '</span>' +
                '<b>' + fmt(quota.remaining) + '</b>' +
                (quota.limit !== null && quota.limit !== undefined && quota.limit !== 0 ? ' / ' + fmt(quota.limit) : '') +
                (pct !== null ? '<span class="apihub-bar"><i style="width:' + pct.toFixed(1) + '%"></i></span>' : '') +
                '</div>';
        }

        const statusHtml =
            '<span class="apihub-status apihub-' + status + '">' +
            (status === 'ok' ? '<i class="fas fa-check-circle"></i> Connected'
                : status === 'checking' ? '<i class="fas fa-spinner fa-spin"></i> Checking'
                    : status === 'err' ? '<i class="fas fa-exclamation-circle"></i> Failed'
                        : '<i class="fas fa-circle"></i> Not connected') +
            '</span>';

        const keyInput =
            '<div class="apihub-keyrow">' +
            '<input type="password" class="apihub-keyinput" id="apikey-' + esc(m.id) + '" placeholder="Paste API key…" value="' + esc(keyValue) + '" onfocus="APIHub.clearCardError(\'' + esc(m.id) + '\')" oninput="APIHub.setDraftKey(\'' + esc(m.id) + '\', this.value)" onkeydown="if(event.key===\'Enter\') APIHub.connect(\'' + esc(m.id) + '\')">' +
            '<button class="btn btn-secondary apihub-eye" title="Show / hide" onclick="APIHub.toggleKeyVisibility(\'' + esc(m.id) + '\')"><i class="fas fa-eye"></i></button>' +
            '<button class="btn btn-primary apihub-connect" onclick="APIHub.connect(\'' + esc(m.id) + '\')">' +
            (status === 'checking' ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-plug"></i>') +
            ' ' + (status === 'ok' ? 'Re-check' : 'Connect') + '</button>' +
            '</div>';

        const keyLink = m.keyUrl
            ? '<a class="apihub-link" href="' + esc(m.keyUrl) + '" target="_blank" rel="noopener noreferrer" title="Open the ' + esc(m.name) + ' API key page in a new tab">' +
            '<i class="fas fa-key"></i> Get API key <i class="fas fa-arrow-up-right-from-square"></i></a>'
            : '<span class="apihub-nolink"><i class="fas fa-circle-info"></i> custom endpoint — set your own URL</span>';

        const baseRow = m.baseUrl
            ? '<button class="apihub-base" title="Copy base URL" onclick="APIHub.copyText(\'' + esc(m.baseUrl) + '\')">' +
            '<i class="fas fa-link"></i> ' + esc(m.baseUrl) + '</button>'
            : '<span class="apihub-base apihub-base-empty">no base URL</span>';

        const tierLabel = (m.tier && m.tier.toLowerCase().includes('no key')) ? 'Free / paid tier' : (m.tier || 'Free / paid tier');

        const allCardModels = (rec && rec.models && rec.models.length) ? rec.models : getSeededModels(m.id);
        const cardEnabled = (rec && Array.isArray(rec.enabledModels) && rec.enabledModels.length) ? rec.enabledModels : allCardModels.map(x => x.id);
        const enabledCount = cardEnabled.length;
        const totalCount = allCardModels.length;

        const enabledPill = (status === 'ok')
            ? '<div class="apihub-enabled-pill" onclick="APIHub.openModelSelector(\'' + esc(m.id) + '\')" title="Click to select or deselect models">' +
              '<i class="fas fa-brain"></i> ' + enabledCount + ' of ' + totalCount + ' AI models enabled' +
              '<span class="apihub-pill-link">Edit <i class="fas fa-chevron-right"></i></span></div>'
            : '';

        return '<div class="apihub-card apihub-card-' + status + '" data-provider="' + esc(m.id) + '">' +
            '<div class="apihub-card-head">' +
            '<div class="apihub-card-title"><i class="fas fa-robot"></i> ' + esc(m.name) +
            '<span class="apihub-tier">' + esc(tierLabel) + '</span></div>' +
            statusHtml +
            '</div>' +
            '<div class="apihub-card-meta">' + baseRow + '</div>' +
            '<div class="apihub-card-links">' + keyLink +
            (seededText ? '<span class="apihub-seeded"><i class="fas fa-layer-group"></i> ' + seededText + '</span>' : '') +
            '</div>' +
            enabledPill +
            keyInput +
            (message ? '<div class="apihub-msg apihub-msg-' + status + '">' + esc(message) + (status === 'err' ? ' <button type="button" class="apihub-msg-dismiss" onclick="APIHub.dismissError(\'' + esc(m.id) + '\')" title="Dismiss error"><i class="fas fa-times"></i></button>' : '') + '</div>' : '') +
            quotaHtml +
            (status === 'ok' ? '<div class="apihub-card-actions">' +
                '<button class="apihub-mini apihub-mini-primary apihub-btn-select-models" onclick="APIHub.openModelSelector(\'' + esc(m.id) + '\')" title="Choose which AI models/agents are active"><i class="fas fa-list-check"></i> Select AI Models (' + enabledCount + '/' + totalCount + ')</button>' +
                '<button class="apihub-mini" onclick="APIHub.refreshQuota(\'' + esc(m.id) + '\')"><i class="fas fa-gauge"></i> Quota</button>' +
                '<button class="apihub-mini" onclick="APIHub.refreshModels(\'' + esc(m.id) + '\')"><i class="fas fa-rotate"></i> Models</button>' +
                '<button class="apihub-mini apihub-mini-danger" onclick="APIHub.disconnect(\'' + esc(m.id) + '\')"><i class="fas fa-link-slash"></i> Disconnect</button>' +
                '</div>' : '') +
            '</div>';
    }

    function visibleProviders() {
        let list = [];
        try {
            if (typeof AIProviderCatalog !== 'undefined' && AIProviderCatalog.all) {
                list = AIProviderCatalog.all() || [];
            }
        } catch (e) {
            list = [];
        }

        if (!Array.isArray(list) || list.length === 0) {
            list = [
                { id: 'google', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models', kind: 'gemini', keyless: false, keyUrl: 'https://aistudio.google.com/app/apikey', tier: 'Free Tier' },
                { id: 'groq', name: 'Groq (Ultra-Fast LPUs)', baseUrl: 'https://api.groq.com/openai/v1', kind: 'openai', keyless: false, keyUrl: 'https://console.groq.com/keys', tier: 'Free Tier' },
                { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', kind: 'openai', keyless: false, keyUrl: 'https://platform.deepseek.com/api_keys', tier: 'Ultra Cost-Effective' },
                { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', kind: 'openai', keyless: false, keyUrl: 'https://openrouter.ai/keys', tier: '100+ Models' },
                { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', kind: 'openai', keyless: false, keyUrl: 'https://platform.openai.com/api-keys', tier: 'GPT-4o' },
                { id: 'cerebras', name: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', kind: 'openai', keyless: false, keyUrl: 'https://cloud.cerebras.ai', tier: 'Ultra-Fast LPUs' },
                { id: 'aihorde', name: 'AI Horde', baseUrl: 'https://oai.aihorde.net/v1', kind: 'openai', keyless: false, keyUrl: 'https://aihorde.net/register', tier: 'Free / paid tier' }
            ];
        }

        const popularIds = ['google', 'groq', 'openrouter', 'deepseek', 'openai', 'cerebras', 'aihorde', 'anthropic', 'mistral', 'cohere'];
        if (filterMode === 'popular') list = list.filter(m => popularIds.includes(m.id));
        else if (filterMode === 'connected') list = list.filter(m => isConnected(m.id));
        else if (filterMode === 'free') list = list.filter(m => /free/i.test(m.tier || ''));

        const q = (filterText || '').trim().toLowerCase();
        if (!q) return list;

        const rawTokens = q.split(/\s+/).filter(Boolean);
        const scored = [];

        for (let i = 0; i < list.length; i++) {
            const m = list[i];
            if (!m) continue;
            const name = (m.name || '').toLowerCase();
            const id = (m.id || '').toLowerCase();

            let score = 0;

            if (rawTokens.length > 1) {
                // Multi-token search
                const seeded = (typeof AIProviderCatalog !== 'undefined' && AIProviderCatalog.modelsFor) ? AIProviderCatalog.modelsFor(m.id) : [];
                const modStr = (seeded || []).map(s => (s.id + ' ' + (s.name || '')).toLowerCase()).join(' ');
                const allStr = name + ' ' + id + ' ' + (m.tier || '').toLowerCase() + ' ' + modStr;
                if (rawTokens.every(tok => allStr.includes(tok))) {
                    score = name.startsWith(rawTokens[0]) ? 800 : 400;
                }
            } else {
                // Single-token search (e.g. typing 'o', 'op', 'deep', 'g', 'groq')
                // 1. Exact match on name or ID
                if (name === q || id === q) {
                    score = 1000;
                }
                // 2. Name starts with query (e.g. 'o' -> OpenAI, OpenRouter, Ollama)
                else if (name.startsWith(q)) {
                    score = 900;
                }
                // 3. ID starts with query
                else if (id.startsWith(q)) {
                    score = 800;
                }
                // 4. Any word inside name starts with query (e.g. 'router' -> OpenRouter, 'horde' -> AI Horde)
                else if (name.split(/\s+/).some(w => w.startsWith(q))) {
                    score = 700;
                }
                // 5. Name contains query
                else if (name.includes(q)) {
                    score = 500;
                }
                // 6. ID contains query
                else if (id.includes(q)) {
                    score = 400;
                }
                // 7. For queries >= 3 chars: also check models & tier
                else if (q.length >= 3) {
                    const seeded = (typeof AIProviderCatalog !== 'undefined' && AIProviderCatalog.modelsFor) ? AIProviderCatalog.modelsFor(m.id) : [];
                    if (seeded && seeded.some(mod =>
                        (mod.id && mod.id.toLowerCase().includes(q)) ||
                        (mod.name && mod.name.toLowerCase().includes(q)) ||
                        (mod.label && mod.label.toLowerCase().includes(q))
                    )) {
                        score = 200;
                    } else {
                        const rec = hub.providers[m.id];
                        if (rec && rec.models && rec.models.some(mod =>
                            (mod.id && mod.id.toLowerCase().includes(q)) ||
                            (mod.label && mod.label.toLowerCase().includes(q))
                        )) {
                            score = 190;
                        } else if (m.tier && m.tier.toLowerCase().includes(q)) {
                            score = 150;
                        }
                    }
                }
            }

            if (score > 0) {
                scored.push({ provider: m, score: score });
            }
        }

        // Sort descending by match score, then alphabetically
        scored.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.provider.name.localeCompare(b.provider.name);
        });

        return scored.map(s => s.provider);
    }

    function onSearchInput(val) {
        filterText = String(val === undefined || val === null ? '' : val);
        const clr = el('apihub-search-clear');
        if (clr) clr.style.display = filterText ? 'inline-flex' : 'none';
        updateGridOnly();
    }

    function clearSearch() {
        filterText = '';
        const input = el('apihub-search');
        if (input) {
            input.value = '';
            input.focus();
        }
        const clr = el('apihub-search-clear');
        if (clr) clr.style.display = 'none';
        updateGridOnly();
    }

    function updateGridOnly() {
        const grid = document.querySelector('.apihub-grid');
        const count = document.querySelector('.apihub-count');
        if (!grid) {
            render();
            return;
        }
        const list = visibleProviders();
        grid.innerHTML = list.length
            ? list.map(providerCard).join('')
            : '<div class="apihub-empty" style="grid-column: 1 / -1; text-align:center; padding:36px 16px;">' +
              '<i class="fas fa-magnifying-glass" style="font-size:26px; color:var(--text-faint); margin-bottom:10px; display:block;"></i>' +
              'No API provider matches "' + esc(filterText) + '"' +
              '<div style="margin-top:12px;"><button type="button" class="btn btn-secondary" onclick="APIHub.clearSearch()" style="font-size:12px; padding:5px 14px;"><i class="fas fa-rotate-left"></i> Clear Search</button></div>' +
              '</div>';
        if (count) {
            count.textContent = list.length + ' provider' + (list.length === 1 ? '' : 's');
        }

        // Scroll to top of modal content so top matching cards are visible right away
        if (filterText && filterText.trim()) {
            const modalContent = document.querySelector('#ai-settings-modal .modal-content');
            if (modalContent) modalContent.scrollTop = 0;
            const hubBody = el('api-hub-body-modal');
            if (hubBody) hubBody.scrollTop = 0;
        }
    }

    function renderConnect(root) {
        try {
            const list = visibleProviders();
            const total = (typeof AIProviderCatalog !== 'undefined' && AIProviderCatalog.all) ? AIProviderCatalog.all().length : list.length;
            const connected = connectedIds().length;
            const savedKeys = Object.keys(hub.providers).filter(id => hub.providers[id].key && String(hub.providers[id].key).trim()).length;

            root.innerHTML =
                '<div class="apihub-summary" style="margin-bottom:16px;">' +
                '<div class="apihub-sumcard"><span class="apihub-sumlabel">Catalogue Providers</span><b>' + total + '</b></div>' +
                '<div class="apihub-sumcard"><span class="apihub-sumlabel">Connected APIs</span><b class="apihub-good">' + connected + '</b></div>' +
                '<div class="apihub-sumcard"><span class="apihub-sumlabel">Saved API Keys</span><b>' + savedKeys + '</b></div>' +
                '<div class="apihub-sumcard" style="justify-content:center; gap:8px;">' +
                '<button class="btn btn-primary apihub-bulk-btn" onclick="APIHub.refreshAll()" style="font-size:11px; padding:6px 12px; background:linear-gradient(135deg, var(--accent, #8b5cf6), #38bdf8); border:none;"><i class="fas fa-rotate"></i> Re-check All Keys</button>' +
                '<button class="btn btn-secondary apihub-bulk-btn" onclick="APIHub.quotaAll()" style="font-size:11px; padding:6px 12px;"><i class="fas fa-gauge"></i> Probe Quotas</button>' +
                '</div>' +
                '</div>' +

                '<div class="apihub-toolbar">' +
                '<div class="apihub-search"><i class="fas fa-magnifying-glass"></i>' +
                '<input type="text" id="apihub-search" placeholder="Search API provider, name or URL…" value="' + esc(filterText) + '" oninput="APIHub.onSearchInput(this.value)" onkeyup="APIHub.onSearchInput(this.value)" onchange="APIHub.onSearchInput(this.value)" onkeydown="if(event.key===\'Escape\')APIHub.clearSearch()">' +
                '<button type="button" id="apihub-search-clear" class="apihub-search-clear" onclick="APIHub.clearSearch()" style="' + (filterText ? 'display:inline-flex;' : 'display:none;') + '" title="Clear search"><i class="fas fa-times"></i></button>' +
                '</div>' +
                '<div class="apihub-filters">' +
                [
                    { id: 'all', label: 'All' },
                    { id: 'popular', label: '⭐ Top Popular' },
                    { id: 'connected', label: 'Connected' },
                    { id: 'free', label: 'Free tier' }
                ].map(f =>
                    '<button type="button" class="apihub-chip' + (filterMode === f.id ? ' active' : '') + '" data-filter="' + f.id + '" onclick="APIHub.setFilter(\'' + f.id + '\')">' +
                    f.label + '</button>').join('') +
                '</div>' +
                '<span class="apihub-count">' + list.length + ' provider' + (list.length === 1 ? '' : 's') + '</span>' +
                '</div>' +

                '<div class="apihub-grid">' +
                (list.length ? list.map(providerCard).join('')
                    : '<div class="apihub-empty" style="grid-column: 1 / -1; text-align:center; padding:36px 16px;"><i class="fas fa-magnifying-glass" style="font-size:26px; color:var(--text-faint); margin-bottom:10px; display:block;"></i>No API provider matches that search.<div style="margin-top:12px;"><button type="button" class="btn btn-secondary" onclick="APIHub.clearSearch()" style="font-size:12px; padding:5px 14px;"><i class="fas fa-rotate-left"></i> Clear Search</button></div></div>') +
                '</div>';
        } catch (err) {
            console.error("[APIHub] renderConnect error:", err);
            root.innerHTML = '<div class="apihub-empty" style="color:var(--danger);"><i class="fas fa-triangle-exclamation"></i> Error rendering Connect tab: ' + esc(err.message) + '</div>';
        }
    }

    function renderDashboard(root) {
        const t = totals();
        const ids = Object.keys(hub.providers);
        const rows = ids.map(id => {
            const rec = hub.providers[id];
            const u = usage.providers[id] || { requests: 0, ok: 0, errors: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
            const seeded = (typeof AIProviderCatalog !== 'undefined') ? AIProviderCatalog.modelsFor(id) : [];
            let free = 0;
            seeded.forEach(m => { free += AIProviderCatalog.parseBudget(m.budget); });
            const used = u.inputTokens + u.outputTokens;
            const pct = free > 0 ? Math.max(0, Math.min(100, (used / free) * 100)) : null;
            const q = rec.quota;
            return '<tr>' +
                '<td><b>' + esc(rec.name) + '</b><div class="apihub-sub">' + esc(id) + '</div></td>' +
                '<td><span class="apihub-status apihub-' + rec.status + '">' + (rec.status === 'ok' ? 'Connected' : rec.status === 'err' ? 'Failed' : rec.status === 'checking' ? 'Checking' : 'Idle') + '</span></td>' +
                '<td>' + (rec.models || []).length + '</td>' +
                '<td>' + (free ? fmt(free) : '<span class="apihub-muted">—</span>') + '</td>' +
                '<td>' + fmt(used) + (pct !== null ? ' <span class="apihub-pct">' + pct.toFixed(1) + '%</span>' : '') + '</td>' +
                '<td>' + (q && q.remaining !== null && q.remaining !== undefined ? fmt(q.remaining) + ' <span class="apihub-sub">' + esc(q.source || '') + '</span>' : '<span class="apihub-muted">—</span>') + '</td>' +
                '<td>' + fmt(u.requests) + '</td>' +
                '<td>' + fmt(u.inputTokens) + '</td>' +
                '<td>' + fmt(u.outputTokens) + '</td>' +
                '<td>' + fmt(u.errors) + '</td>' +
                '<td>' + fmtMoney(u.cost) + '</td>' +
                '</tr>';
        }).join('');

        root.innerHTML =
            '<div class="apihub-stats">' +
            statCard('Free tokens / month (all connected)', fmt(t.freeTokens), 'From ' + t.freeTokenProviders + ' provider' + (t.freeTokenProviders === 1 ? '' : 's') + ' with a published free tier') +
            statCard('Tokens used', fmt(t.totalTokens), fmt(t.inputTokens) + ' in · ' + fmt(t.outputTokens) + ' out') +
            statCard('Requests', fmt(t.requests), fmt(t.ok) + ' ok · ' + fmt(t.errors) + ' failed') +
            statCard('Remaining (provider reported)', fmt(t.reportedRemaining), 'of ' + fmt(t.reportedLimit) + ' — live from provider headers / quota API') +
            statCard('Connected APIs', String(t.providers), fmt(t.models) + ' models unlocked') +
            statCard('Estimated cost', fmtMoney(t.cost), 'from published per-1M prices') +
            '</div>' +

            '<div class="apihub-panel">' +
            '<div class="apihub-panel-head"><h4><i class="fas fa-table-list"></i> Per-API breakdown</h4>' +
            '<button class="apihub-mini" onclick="APIHub.exportUsage()"><i class="fas fa-file-export"></i> Export CSV</button></div>' +
            '<div class="apihub-tablewrap"><table class="apihub-table">' +
            '<thead><tr><th>API</th><th>Status</th><th>Models</th><th>Free tokens/mo</th><th>Tokens used</th><th>Remaining</th><th>Req</th><th>In</th><th>Out</th><th>Err</th><th>Cost</th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="11" class="apihub-muted">No API connected yet — go to the Connect tab.</td></tr>') + '</tbody>' +
            '</table></div></div>' +

            '<div class="apihub-panel">' +
            '<div class="apihub-panel-head"><h4><i class="fas fa-clock-rotate-left"></i> Last 14 days</h4></div>' +
            '<div class="apihub-tablewrap"><table class="apihub-table">' +
            '<thead><tr><th>Day</th><th>Requests</th><th>Input</th><th>Output</th><th>Errors</th><th>Cost</th></tr></thead>' +
            '<tbody>' + dailyRows() + '</tbody></table></div></div>';
    }

    function statCard(label, value, sub) {
        return '<div class="apihub-stat"><span class="apihub-stat-label">' + esc(label) + '</span>' +
            '<b class="apihub-stat-value">' + esc(value) + '</b>' +
            '<span class="apihub-stat-sub">' + esc(sub || '') + '</span></div>';
    }

    function dailyRows() {
        const days = {};
        Object.keys(usage.providers).forEach(id => {
            const byDay = usage.providers[id].byDay || {};
            Object.keys(byDay).forEach(d => {
                if (!days[d]) days[d] = { requests: 0, inputTokens: 0, outputTokens: 0, errors: 0, cost: 0 };
                days[d].requests += byDay[d].requests;
                days[d].inputTokens += byDay[d].inputTokens;
                days[d].outputTokens += byDay[d].outputTokens;
                days[d].errors += byDay[d].errors;
                days[d].cost += byDay[d].cost;
            });
        });
        const keys = Object.keys(days).sort().reverse();
        if (!keys.length) return '<tr><td colspan="6" class="apihub-muted">No traffic yet.</td></tr>';
        return keys.map(d => '<tr><td>' + esc(d) + '</td><td>' + fmt(days[d].requests) + '</td><td>' + fmt(days[d].inputTokens) +
            '</td><td>' + fmt(days[d].outputTokens) + '</td><td>' + fmt(days[d].errors) + '</td><td>' + fmtMoney(days[d].cost) + '</td></tr>').join('');
    }

    function renderUsage(root) {
        const ids = Object.keys(usage.providers);
        const days = [];
        ids.forEach(id => {
            Object.keys(usage.providers[id].byDay || {}).forEach(d => { if (days.indexOf(d) === -1) days.push(d); });
        });
        days.sort().reverse();

        let rows = '';
        ids.forEach(id => {
            const u = usage.providers[id];
            const rec = hub.providers[id];
            const name = rec ? rec.name : id;
            const models = Object.keys(u.byModel || {});
            models.forEach(m => {
                const s = u.byModel[m];
                const price = (typeof AIProviderCatalog !== 'undefined') ? AIProviderCatalog.priceFor(id, m) : null;
                rows += '<tr><td><b>' + esc(name) + '</b></td><td>' + esc(id) + '</td><td class="apihub-mono">' + esc(m) + '</td>' +
                    '<td>' + fmt(s.requests) + '</td><td>' + fmt(s.ok) + '</td><td>' + fmt(s.errors) + '</td>' +
                    '<td>' + fmt(s.inputTokens) + '</td><td>' + fmt(s.outputTokens) + '</td>' +
                    '<td>' + fmt(s.inputTokens + s.outputTokens) + '</td>' +
                    '<td>' + (price ? esc(price.in + ' / ' + price.out) : '<span class="apihub-muted">—</span>') + '</td>' +
                    '<td>' + fmtMoney(s.cost) + '</td></tr>';
            });
            if (!models.length) {
                rows += '<tr><td><b>' + esc(name) + '</b></td><td>' + esc(id) + '</td><td class="apihub-muted">no model traffic</td>' +
                    '<td>' + fmt(u.requests) + '</td><td>' + fmt(u.ok) + '</td><td>' + fmt(u.errors) + '</td>' +
                    '<td>' + fmt(u.inputTokens) + '</td><td>' + fmt(u.outputTokens) + '</td>' +
                    '<td>' + fmt(u.inputTokens + u.outputTokens) + '</td><td>—</td><td>' + fmtMoney(u.cost) + '</td></tr>';
            }
        });

        root.innerHTML =
            '<div class="apihub-toolbar">' +
            '<label class="apihub-lbl">Day</label>' +
            '<select id="apihub-usage-day" class="apihub-select" onchange="APIHub.setUsageDay(this.value)">' +
            '<option value="all"' + (usageDay === 'all' ? ' selected' : '') + '>All days</option>' +
            days.map(d => '<option value="' + esc(d) + '"' + (usageDay === d ? ' selected' : '') + '>' + esc(d) + '</option>').join('') +
            '</select>' +
            '<span class="apihub-count">Everything below is measured on this device only.</span>' +
            '<button class="apihub-mini apihub-mini-danger" onclick="APIHub.resetUsage()"><i class="fas fa-eraser"></i> Reset counters</button>' +
            '</div>' +
            '<div class="apihub-panel"><div class="apihub-panel-head"><h4><i class="fas fa-table-cells"></i> Every model, every token</h4></div>' +
            '<div class="apihub-tablewrap"><table class="apihub-table">' +
            '<thead><tr><th>API</th><th>Platform</th><th>Model</th><th>Req</th><th>OK</th><th>Err</th><th>In</th><th>Out</th><th>Total</th><th>$/1M in/out</th><th>Cost</th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="11" class="apihub-muted">No usage recorded yet.</td></tr>') + '</tbody>' +
            '</table></div></div>';
    }

    function renderModels(root) {
        const groups = {};
        ((typeof AIProviderCatalog !== 'undefined') ? AIProviderCatalog.allModels() : []).forEach(m => {
            groups[m.provider] = groups[m.provider] || [];
            groups[m.provider].push(m);
        });
        let html = '<div class="apihub-panel"><div class="apihub-panel-head"><h4><i class="fas fa-brain"></i> Every AI in the catalogue</h4>' +
            '<span class="apihub-count">' + (typeof AIProviderCatalog !== 'undefined' ? AIProviderCatalog.allModels().length : 0) + ' models</span></div>';

        Object.keys(groups).sort().forEach(pid => {
            const m = meta(pid);
            const live = hub.providers[pid];
            html += '<div class="apihub-modelgroup">' +
                '<div class="apihub-modelgroup-head"><i class="fas fa-robot"></i> <b>' + esc(m.name) + '</b>' +
                '<span class="apihub-sub">' + esc(pid) + '</span>' +
                (live && live.status === 'ok' ? '<span class="apihub-status apihub-ok"><i class="fas fa-check-circle"></i> ' + (live.models || []).length + ' live</span>' : '') +
                '</div><table class="apihub-table apihub-table-compact"><thead><tr>' +
                '<th>Model</th><th>Intelligence</th><th>Speed</th><th>Size</th><th>RPM</th><th>RPD</th><th>TPM</th><th>TPD</th><th>Context</th><th>Free tokens/mo</th><th>$/1M in</th><th>$/1M out</th>' +
                '</tr></thead><tbody>';
            groups[pid].forEach(row => {
                const price = (typeof AIProviderCatalog !== 'undefined') ? AIProviderCatalog.priceFor(pid, row.id) : null;
                html += '<tr><td class="apihub-mono">' + esc(row.name) + '<div class="apihub-sub">' + esc(row.id) + '</div></td>' +
                    '<td>#' + esc(row.intelligence) + '</td><td>#' + esc(row.speed) + '</td><td>' + esc(row.size) + '</td>' +
                    '<td>' + (row.rpm ? esc(row.rpm) : '—') + '</td><td>' + (row.rpd ? esc(row.rpd) : '—') + '</td>' +
                    '<td>' + (row.tpm ? esc(row.tpm) : '—') + '</td><td>' + (row.tpd ? esc(row.tpd) : '—') + '</td>' +
                    '<td>' + (row.ctx ? fmt(row.ctx) : '—') + '</td>' +
                    '<td>' + esc(row.budget || '—') + '</td>' +
                    '<td>' + (price ? esc(price.in) : '—') + '</td><td>' + (price ? esc(price.out) : '—') + '</td></tr>';
            });
            html += '</tbody></table></div>';
        });
        html += '</div>';

        /* ── live models discovered from the connected APIs ─────────────────
           These come straight from the provider's own /models response, so
           they are escaped like everything else. */
        const live = Object.keys(hub.providers)
            .filter(id => (hub.providers[id].models || []).length);
        if (live.length) {
            html += '<div class="apihub-panel"><div class="apihub-panel-head">' +
                '<h4><i class="fas fa-satellite-dish"></i> Live models from your connected APIs</h4>' +
                '<span class="apihub-count">' +
                live.reduce((n, id) => n + hub.providers[id].models.length, 0) + ' models</span></div>';
            live.sort().forEach(id => {
                const rec = hub.providers[id];
                html += '<div class="apihub-modelgroup">' +
                    '<div class="apihub-modelgroup-head"><i class="fas fa-robot"></i> <b>' + esc(rec.name) + '</b>' +
                    '<span class="apihub-sub">' + esc(id) + '</span>' +
                    '<span class="apihub-status apihub-ok"><i class="fas fa-check-circle"></i> ' + rec.models.length + ' live</span>' +
                    '</div><div class="apihub-livegrid">' +
                    rec.models.map(m => '<span class="apihub-livechip" title="' + esc(m.id) + '">' + esc(m.label || m.id) + '</span>').join('') +
                    '</div></div>';
            });
            html += '</div>';
        }
        root.innerHTML = html;
    }

    function renderChat(root) {
        const connected = Object.keys(hub.providers).filter(id => {
            const p = hub.providers[id];
            return p && p.status === 'ok' && p.key && String(p.key).trim().length > 0;
        });
        const providers = connected.map(id => hub.providers[id]);
        if (chat.provider && connected.indexOf(chat.provider) === -1) chat.provider = '';
        if (!chat.provider && providers.length) chat.provider = providers[0].id;

        let models = [];
        if (chat.provider) {
            const rec = hub.providers[chat.provider];
            models = (rec && rec.models) ? rec.models : [];
            if (chat.model && !models.some(m => m.id === chat.model)) chat.model = '';
            if (!chat.model && models.length) chat.model = models[0].id;
        }

        const stream = chat.messages.map(m =>
            '<div class="apihub-msg ' + esc(m.role) + '">' +
            '<span class="apihub-msg-role">' + (m.role === 'user' ? '<i class="fas fa-user"></i> You' : '<i class="fas fa-robot"></i> ' + esc(m.providerName || 'AI')) + '</span>' +
            '<div class="apihub-msg-body">' + esc(m.content) + '</div>' +
            (m.usage ? '<div class="apihub-msg-meta">in ' + fmt(m.usage.prompt_tokens) + ' · out ' + fmt(m.usage.completion_tokens) + ' · ' + fmt(m.usage.total_tokens) + ' tokens' +
                (m.cost ? ' · ' + fmtMoney(m.cost) : '') + '</div>' : '') +
            '</div>').join('');

        root.innerHTML =
            '<div class="apihub-chat">' +
            '<div class="apihub-chat-side">' +
            '<label class="apihub-lbl">Provider</label>' +
            '<select id="apihub-chat-provider" class="apihub-select" onchange="APIHub.setChatProvider(this.value)">' +
            (providers.length
                ? providers.map(p => '<option value="' + esc(p.id) + '"' + (p.id === chat.provider ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('')
                : '<option value="">— connect an API first —</option>') +
            '</select>' +
            '<label class="apihub-lbl">Model</label>' +
            '<select id="apihub-chat-model" class="apihub-select" onchange="APIHub.setChatModel(this.value)">' +
            (models.length
                ? models.map(m => '<option value="' + esc(m.id) + '"' + (m.id === chat.model ? ' selected' : '') + '>' + esc(m.label || m.id) + '</option>').join('')
                : '<option value="">— no models —</option>') +
            '</select>' +
            '<div class="apihub-chat-stats" id="apihub-chat-stats">' + chatStatsHtml() + '</div>' +
            '<button class="apihub-mini apihub-mini-danger" onclick="APIHub.clearChat()"><i class="fas fa-trash"></i> Clear chat</button>' +
            '</div>' +
            '<div class="apihub-chat-main">' +
            '<div class="apihub-chat-stream" id="apihub-chat-stream">' +
            (stream || '<div class="apihub-empty"><i class="fas fa-comments"></i> Ask something — every token is counted and billed to the Usage tab.</div>') +
            '</div>' +
            '<div class="apihub-chat-input">' +
            '<textarea id="apihub-chat-text" class="apihub-textarea" placeholder="Type a message… (Enter to send, Shift+Enter for a new line)" onkeydown="APIHub.chatKeydown(event)"></textarea>' +
            '<button class="btn btn-primary" id="apihub-chat-send" onclick="APIHub.sendChat()"' + (busy ? ' disabled' : '') + '>' +
            '<i class="fas ' + (busy ? 'fa-spinner fa-spin' : 'fa-paper-plane') + '"></i> Send</button>' +
            '</div></div></div>';
    }

    function chatStatsHtml() {
        const id = chat.provider;
        const u = id ? usage.providers[id] : null;
        if (!u) return '<div class="apihub-sub">No usage yet for this provider.</div>';
        return '<div class="apihub-mini-stats">' +
            '<div><span>Requests</span><b>' + fmt(u.requests) + '</b></div>' +
            '<div><span>Input</span><b>' + fmt(u.inputTokens) + '</b></div>' +
            '<div><span>Output</span><b>' + fmt(u.outputTokens) + '</b></div>' +
            '<div><span>Errors</span><b>' + fmt(u.errors) + '</b></div>' +
            '<div><span>Cost</span><b>' + fmtMoney(u.cost) + '</b></div>' +
            '</div>';
    }

    /* ── actions ────────────────────────────────────────────────────────── */
    function setTab(tab) {
        activeTab = tab || 'connect';
        try { hub.settings.lastTab = activeTab; saveHub(); } catch (e) { /* ignore */ }

        // Sync active tab button highlight in modal header
        document.querySelectorAll('.ai-modal-tab').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById('tab-btn-apihub-' + activeTab);
        if (activeBtn) activeBtn.classList.add('active');

        render();
    }
    function setFilter(mode) {
        filterMode = mode || 'all';
        document.querySelectorAll('.apihub-chip').forEach(chip => {
            const chipMode = chip.getAttribute('data-filter') || '';
            chip.classList.toggle('active', chipMode === filterMode);
        });
        updateGridOnly();
    }
    function setUsageDay(day) { usageDay = day; render(); }
    function setChatProvider(id) { chat.provider = id; chat.model = ''; saveChat(); render(); }
    function setChatModel(model) { chat.model = model; saveChat(); }

    function dismissError(id) {
        const rec = hub.providers[id];
        if (rec) {
            rec.status = (rec.key && String(rec.key).trim()) ? 'ok' : 'idle';
            rec.message = '';
            saveHub();
            render();
        }
    }

    function clearCardError(id) {
        const rec = hub.providers[id];
        if (rec && rec.status === 'err' && (!rec.key || !String(rec.key).trim())) {
            rec.status = 'idle';
            rec.message = '';
            render();
        }
    }

    function toggleKeyVisibility(id) {
        const input = el('apikey-' + id);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(
                () => toast('Base URL copied', 'success'),
                () => toast('Copy failed', 'error'));
            return;
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); toast('Base URL copied', 'success'); }
        catch (e) { toast('Copy failed', 'error'); }
        document.body.removeChild(ta);
    }

    async function connectBulk() {
        const text = el('apihub-bulk-text');
        const def = el('apihub-bulk-provider');
        if (!text) return { ok: 0, fail: 0, results: [] };
        const lines = text.value.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) { toast('Paste at least one key', 'error'); return { ok: 0, fail: 0, results: [] }; }
        const defaultProvider = def ? def.value : '';
        const jobs = [];
        lines.forEach(line => {
            const m = line.match(/^([a-z0-9_-]+)\s*[=:]\s*(.+)$/i);
            if (m) jobs.push({ id: m[1].toLowerCase(), key: m[2].trim() });
            else jobs.push({ id: defaultProvider, key: line });
        });
        let ok = 0, fail = 0;
        const results = [];
        for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i];
            if (!job.id) { fail++; results.push({ id: '', ok: false }); continue; }
            const done = await connect(job.id, job.key);
            if (done) ok++; else fail++;
            results.push({ id: job.id, ok: !!done });
        }
        if (text) text.value = '';
        toast('Connected ' + ok + ' API' + (ok === 1 ? '' : 's') + (fail ? ', ' + fail + ' failed' : ''), ok ? 'success' : 'error');
        render();
        return { ok: ok, fail: fail, results: results };
    }

    async function refreshModels(id) {
        const rec = hub.providers[id];
        if (!rec) return;
        rec.status = 'checking'; rec.message = 'Refreshing models…'; render();
        try {
            rec.models = await fetchModels(rec);
            rec.status = 'ok';
            rec.message = rec.models.length + ' models unlocked';
            rec.checkedAt = Date.now();
            saveHub(); render();
            toast(rec.name + ': ' + rec.models.length + ' models', 'success');
        } catch (err) {
            rec.status = 'err';
            rec.message = (err && err.message) ? err.message : 'Failed';
            saveHub(); render();
        }
    }

    async function refreshQuota(id) {
        const rec = hub.providers[id];
        if (!rec) return;
        rec.message = 'Probing quota…'; render();
        const q = await probeQuota(id);
        render();
        if (q && q.remaining !== null && q.remaining !== undefined) {
            toast(rec.name + ': ' + fmt(q.remaining) + ' ' + (q.metric || 'remaining') + ' left', 'success');
        } else {
            toast(rec.name + ': this provider does not publish a quota endpoint', 'info');
        }
    }

    /* ── model selector modal ────────────────────────────────────────────── */
    function isModelFree(m) {
        if (!m) return false;
        if (m.isFree === true || m.free === true) return true;
        if (m.isFree === false || m.free === false) return false;
        const text = (String(m.id || '') + ' ' + String(m.label || '')).toLowerCase();
        if (text.includes(':free') || text.includes('(free)') || text.includes('free tier') || /\bfree\b/.test(text)) {
            return true;
        }
        if (m.pricing && (Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0)) {
            return true;
        }
        return false;
    }

    function getModelCategory(m) {
        const text = (String(m.id || '') + ' ' + String(m.label || '')).toLowerCase();
        if (/reasoning|reasoner|thinking|r1|deepseek-r1|nano.*reasoning/.test(text)) return 'reasoning';
        if (/code|coder|dev|starcoder|codestral/.test(text)) return 'code';
        if ((m.size === 'Large' || m.size === 'Frontier') || /1m|512k/i.test(m.ctx || '')) return 'large';
        if (/lightning|instant|turbo|33k|nano|fast|flash/.test(text)) return 'fast';
        return 'general';
    }

    function getModelIcon(m) {
        const text = (String(m.id || '') + ' ' + String(m.label || '')).toLowerCase();
        if (/reasoning|reasoner|thinking|r1/.test(text)) return 'fas fa-brain';
        if (/code|coder|dev|starcoder|codestral/.test(text)) return 'fas fa-code';
        if (/lightning|instant|turbo|fast|flash/.test(text)) return 'fas fa-bolt';
        if (/1m|512k|frontier/.test((m.ctx || '') + ' ' + (m.size || ''))) return 'fas fa-layer-group';
        return 'fas fa-robot';
    }

    function openModelSelector(id) {
        hub.providers[id] = hub.providers[id] || record(id);
        const rec = hub.providers[id];
        pickerProviderId = id;
        pickerFilterQuery = '';
        pickerActiveFilter = 'all';

        // Reset search input and clear button
        const searchInput = el('ai-model-picker-search');
        if (searchInput) searchInput.value = '';
        const searchClear = el('ai-picker-search-clear');
        if (searchClear) searchClear.style.display = 'none';

        const customInput = el('ai-picker-custom-input');
        if (customInput) customInput.value = '';

        // Reset active category chip to 'all'
        const chips = document.querySelectorAll('#ai-picker-chips .ai-picker-chip');
        chips.forEach(c => {
            if (c.getAttribute('data-filter') === 'all') c.classList.add('active');
            else c.classList.remove('active');
        });

        // Get all models for this provider
        pickerModels = (rec.models && rec.models.length) ? rec.models.slice() : getSeededModels(id);
        if (!pickerModels || !pickerModels.length) {
            pickerModels = [{ id: 'default', label: (rec.name || id) + ' (Default Model)', size: 'Medium', ctx: '128K ctx', isFree: false }];
        }

        // Initialize checked items: all models checked by default!
        if (Array.isArray(rec.enabledModels) && rec.enabledModels.length) {
            pickerTempSelection = new Set(rec.enabledModels);
        } else {
            pickerTempSelection = new Set(pickerModels.map(m => m.id));
        }

        // Top provider badge & name
        const provBadgeEl = el('picker-prov-badge');
        if (provBadgeEl) provBadgeEl.textContent = (rec.name || id) + ' AI';

        const provNameEl = el('picker-prov-name');
        if (provNameEl) provNameEl.textContent = rec.name || id;

        // Update category chip counts (All, Free, Paid)
        updateChipCounts();

        renderPickerList();
        updatePickerCount();

        // Show modal
        const modal = el('ai-model-selector-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
    }

    function updateChipCounts() {
        const allCount = pickerModels.length;
        let freeCount = 0;
        let paidCount = 0;
        pickerModels.forEach(m => {
            if (isModelFree(m)) freeCount++;
            else paidCount++;
        });

        const allCountEl = el('chip-count-all');
        if (allCountEl) allCountEl.textContent = allCount;

        const freeCountEl = el('chip-count-free');
        if (freeCountEl) freeCountEl.textContent = freeCount;

        const paidCountEl = el('chip-count-paid');
        if (paidCountEl) paidCountEl.textContent = paidCount;
    }

    function onPickerSearchInput(val) {
        pickerFilterQuery = String(val || '').trim().toLowerCase();
        const clearBtn = el('ai-picker-search-clear');
        if (clearBtn) clearBtn.style.display = pickerFilterQuery ? 'flex' : 'none';
        renderPickerList();
    }

    function clearPickerSearch() {
        pickerFilterQuery = '';
        const input = el('ai-model-picker-search');
        if (input) input.value = '';
        const clearBtn = el('ai-picker-search-clear');
        if (clearBtn) clearBtn.style.display = 'none';
        renderPickerList();
    }

    function setPickerFilter(filterName) {
        pickerActiveFilter = filterName || 'all';
        const chips = document.querySelectorAll('#ai-picker-chips .ai-picker-chip');
        chips.forEach(c => {
            if (c.getAttribute('data-filter') === pickerActiveFilter) c.classList.add('active');
            else c.classList.remove('active');
        });
        renderPickerList();
    }

    function addCustomPickerModel() {
        const input = el('ai-picker-custom-input');
        if (!input) return;
        const val = String(input.value || '').trim();
        if (!val) {
            toast('Please enter a model ID (e.g. meta-llama/llama-3.3-70b-instruct)', 'warning');
            return;
        }
        const existing = pickerModels.find(m => String(m.id).toLowerCase() === val.toLowerCase());
        if (existing) {
            pickerTempSelection.add(existing.id);
            toast('Model already in catalog — enabled!', 'info');
        } else {
            const isFree = /free/i.test(val);
            const newModel = {
                id: val,
                label: val,
                size: 'Custom',
                ctx: 'Auto',
                isFree: isFree,
                isCustom: true
            };
            pickerModels.unshift(newModel);
            pickerTempSelection.add(val);
            toast('Added custom model: ' + val, 'success');
        }
        input.value = '';
        updateChipCounts();
        renderPickerList();
        updatePickerCount();
    }

    function closeModelSelector() {
        const modal = el('ai-model-selector-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
        if (pickerProviderId && hub.providers[pickerProviderId]) {
            const rec = hub.providers[pickerProviderId];
            if (rec.key && rec.status !== 'err') {
                rec.status = 'ok';
                if (!Array.isArray(rec.enabledModels) || !rec.enabledModels.length) {
                    rec.enabledModels = (rec.models && rec.models.length) ? rec.models.map(m => m.id) : [];
                }
                rec.message = rec.enabledModels.length + ' of ' + (rec.models ? rec.models.length : rec.enabledModels.length) + ' models enabled';
                saveHub();
                render();
            }
        }
        pickerProviderId = null;
    }

    function renderPickerList() {
        const container = el('ai-model-picker-list');
        if (!container) return;

        if (!pickerModels.length) {
            container.innerHTML = '<div style="text-align:center; padding:28px 16px; color:var(--text-muted); font-size:13px;">No models in catalog</div>';
            return;
        }

        const filtered = pickerModels.filter(m => {
            // Free / Paid filter
            if (pickerActiveFilter === 'free') {
                if (!isModelFree(m)) return false;
            } else if (pickerActiveFilter === 'paid') {
                if (isModelFree(m)) return false;
            } else if (pickerActiveFilter !== 'all') {
                const cat = getModelCategory(m);
                if (cat !== pickerActiveFilter) return false;
            }
            // Search text filter
            if (pickerFilterQuery) {
                const haystack = (String(m.id || '') + ' ' + String(m.label || '') + ' ' + (m.size || '') + ' ' + (m.ctx || '')).toLowerCase();
                if (!haystack.includes(pickerFilterQuery)) return false;
            }
            return true;
        });

        if (!filtered.length) {
            container.innerHTML = '<div style="text-align:center; padding:28px 16px; color:var(--text-muted); font-size:12.5px;">' +
                '<i class="fas fa-search" style="font-size:18px; margin-bottom:8px; opacity:0.5; display:block;"></i>' +
                'No models match the filter "<strong>' + esc(pickerActiveFilter !== 'all' ? pickerActiveFilter : pickerFilterQuery) + '</strong>"' +
                '</div>';
            return;
        }

        container.innerHTML = filtered.map(m => {
            const isChecked = pickerTempSelection.has(m.id);
            const mId = String(m.id);
            const mLabel = String(m.label || m.id);
            const mSize = m.size || 'Medium';
            const mCtx = m.ctx || '256K ctx';
            const iconClass = getModelIcon(m);
            const isFree = isModelFree(m);

            return '<div class="ai-model-picker-row' + (isChecked ? ' selected' : '') + '" onclick="APIHub.togglePickerRow(\'' + esc(m.id) + '\', event)">' +
                '<label class="ai-picker-row-left" onclick="event.stopPropagation()">' +
                '<input type="checkbox" id="chk-picker-' + esc(m.id) + '" ' + (isChecked ? 'checked' : '') + ' onchange="APIHub.togglePickerModel(\'' + esc(m.id) + '\', this.checked)">' +
                '<span class="ai-picker-model-icon"><i class="' + esc(iconClass) + '"></i></span>' +
                '<div class="ai-picker-model-meta">' +
                '<span class="ai-picker-model-title">' + esc(mLabel) + '</span>' +
                '<span class="ai-picker-model-id">' + esc(mId) + '</span>' +
                '</div>' +
                '</label>' +
                '<div class="ai-picker-badges">' +
                (isFree 
                    ? '<span class="ai-picker-pill-free"><i class="fas fa-gift"></i> Free</span>' 
                    : '<span class="ai-picker-pill-paid"><i class="fas fa-coins"></i> Paid</span>') +
                '<span class="ai-picker-pill">' + esc(mSize) + '</span>' +
                '<span class="ai-picker-pill">' + esc(mCtx) + '</span>' +
                '</div>' +
                '</div>';
        }).join('');
    }

    function togglePickerRow(modelId, event) {
        if (event && event.target && event.target.tagName === 'INPUT') return;
        const willCheck = !pickerTempSelection.has(modelId);
        togglePickerModel(modelId, willCheck);
    }

    function togglePickerModel(modelId, isChecked) {
        if (isChecked) {
            pickerTempSelection.add(modelId);
        } else {
            pickerTempSelection.delete(modelId);
        }
        updatePickerCount();
        const chk = el('chk-picker-' + modelId);
        if (chk) {
            chk.checked = isChecked;
            const parent = chk.closest('.ai-model-picker-row');
            if (parent) {
                if (isChecked) parent.classList.add('selected');
                else parent.classList.remove('selected');
            }
        }
    }

    function toggleAllPickerModels(selectAll) {
        if (selectAll) {
            pickerModels.forEach(m => pickerTempSelection.add(m.id));
        } else {
            pickerTempSelection.clear();
        }
        renderPickerList();
        updatePickerCount();
    }

    function updatePickerCount() {
        const total = pickerModels.length;
        const selected = pickerTempSelection.size;
        const countText = el('ai-model-picker-count');
        if (countText) {
            countText.textContent = selected + ' of ' + total + ' selected';
        }
        const saveCountText = el('ai-model-picker-save-count');
        if (saveCountText) {
            saveCountText.textContent = selected;
        }
        const selectAllChk = el('picker-select-all-chk');
        if (selectAllChk) {
            selectAllChk.checked = (total > 0 && selected === total);
            selectAllChk.indeterminate = (selected > 0 && selected < total);
        }
    }

    function saveModelSelector() {
        if (!pickerProviderId) return;
        const rec = hub.providers[pickerProviderId];
        if (!rec) return;

        if (pickerTempSelection.size === 0) {
            toast('Please select at least 1 model to enable.', 'warning');
            return;
        }

        rec.models = pickerModels;
        rec.enabledModels = Array.from(pickerTempSelection);
        rec.status = 'ok'; // CRITICAL: Always guarantee status remains 'ok' (green)!
        rec.message = rec.enabledModels.length + ' of ' + rec.models.length + ' model' + (rec.models.length === 1 ? '' : 's') + ' enabled';
        rec.checkedAt = Date.now();
        saveHub();
        closeModelSelector();
        render();

        // Also sync AIAgent if this provider is currently active
        if (typeof AIAgent !== 'undefined') {
            if (AIAgent.renderConnectedProvidersTab) AIAgent.renderConnectedProvidersTab();
            if (AIAgent.syncRouterControls) AIAgent.syncRouterControls();
        }

        toast((rec.name || pickerProviderId) + ': ' + rec.enabledModels.length + ' AI models enabled and ready!', 'success');
    }

    async function refreshAll() {
        const ids = Object.keys(hub.providers).filter(id => hub.providers[id] && hub.providers[id].key && String(hub.providers[id].key).trim().length > 0);
        if (!ids.length) { toast('No API connected yet — paste your API key to connect', 'info'); return; }
        for (let i = 0; i < ids.length; i++) {
            const rec = hub.providers[ids[i]];
            rec.status = 'checking'; render();
            try {
                rec.models = await fetchModels(rec);
                rec.status = 'ok';
                rec.message = rec.models.length + ' models unlocked';
                rec.checkedAt = Date.now();
                await probeQuota(ids[i]);
            } catch (err) {
                rec.status = 'err';
                rec.message = (err && err.message) ? err.message : 'Failed';
            }
            saveHub(); render();
        }
        toast('Checked ' + ids.length + ' API' + (ids.length === 1 ? '' : 's'), 'success');
    }

    async function quotaAll() {
        const ids = Object.keys(hub.providers).filter(id => hub.providers[id] && hub.providers[id].status === 'ok' && hub.providers[id].key && String(hub.providers[id].key).trim().length > 0);
        if (!ids.length) { toast('No API connected yet', 'info'); return; }
        for (let i = 0; i < ids.length; i++) { await probeQuota(ids[i]); render(); }
        toast('Quota probed for ' + ids.length + ' API' + (ids.length === 1 ? '' : 's'), 'success');
    }

    function resetUsage() {
        if (!confirm('Reset every token counter, request counter and cost estimate?')) return;
        usage = blankUsage();
        saveUsage();
        render();
        toast('Usage counters reset', 'success');
    }

    function clearChat() {
        chat.messages = [];
        saveChat();
        render();
    }

    function exportUsage() {
        const rows = [['platform', 'model', 'requests', 'ok', 'errors', 'input_tokens', 'output_tokens', 'total_tokens', 'cost_usd']];
        Object.keys(usage.providers).forEach(id => {
            const u = usage.providers[id];
            Object.keys(u.byModel || {}).forEach(m => {
                const s = u.byModel[m];
                rows.push([id, m, s.requests, s.ok, s.errors, s.inputTokens, s.outputTokens, s.inputTokens + s.outputTokens, (s.cost || 0).toFixed(6)]);
            });
        });
        const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'master-ide-api-usage.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('Usage exported', 'success');
    }

    /* ── chat send ──────────────────────────────────────────────────────── */
    function chatKeydown(event) {
        if (!event) return;
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key === 'Enter') {
            const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth <= 1024);
            if (isMobile) {
                if (event.ctrlKey) {
                    event.preventDefault();
                    sendChat();
                }
                return;
            }
            if (!event.shiftKey) {
                event.preventDefault();
                sendChat();
            }
        }
    }

    async function sendChat() {
        if (busy) return;
        const input = el('apihub-chat-text');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        if (!chat.provider) { toast('Connect an API first', 'error'); return; }
        if (!chat.model) { toast('Pick a model first', 'error'); return; }

        const rec = hub.providers[chat.provider];
        const providerName = rec ? rec.name : chat.provider;

        chat.messages.push({ role: 'user', content: text, at: Date.now() });
        input.value = '';
        busy = true;
        render();

        const history = chat.messages.map(m => ({ role: m.role, content: m.content }));
        try {
            const reply = await chatOnce(chat.provider, chat.model, history);
            const cost = recordUsage(chat.provider, chat.model, reply.usage, true);
            chat.messages.push({
                role: 'assistant', content: reply.text, provider: chat.provider, providerName: providerName,
                model: chat.model, usage: reply.usage, cost: cost, at: Date.now()
            });
        } catch (err) {
            recordUsage(chat.provider, chat.model, {}, false);
            chat.messages.push({
                role: 'error', content: (err && err.message) ? String(err.message) : 'Request failed',
                provider: chat.provider, providerName: providerName, at: Date.now()
            });
        }
        busy = false;
        saveChat();
        render();
        const stream = el('apihub-chat-stream');
        if (stream) stream.scrollTop = stream.scrollHeight;
    }

    /* ── integration with the auto router ───────────────────────────────── */
    /** every connected provider/model pair the router may try */
    function routerCandidates() {
        const out = [];
        const seen = new Set();
        Object.keys(hub.providers).forEach(id => {
            const rec = hub.providers[id];
            if (!rec) return;
            const isOk = (rec.status === 'ok') && (rec.key && String(rec.key).trim().length > 0);
            if (!isOk) return;
            let models = (rec.models && rec.models.length) ? rec.models : [];
            if (!models.length && typeof AIProviderCatalog !== 'undefined') {
                models = AIProviderCatalog.modelsFor(id) || [];
            }
            if (!models.length && KNOWN_DEFAULT_MODELS[id]) {
                models = KNOWN_DEFAULT_MODELS[id];
            }
            if (Array.isArray(rec.enabledModels) && rec.enabledModels.length) {
                const enSet = new Set(rec.enabledModels);
                models = models.filter(m => enSet.has(m.id));
            }
            models.forEach(m => {
                const key = `${id}:${m.id}`;
                if (seen.has(key)) return;
                seen.add(key);
                out.push({
                    provider: id,
                    model: m.id,
                    label: (rec.name || id) + ' · ' + (m.label || m.id)
                });
            });
        });

        // Also include AIAgent's direct key if set
        if (typeof AIAgent !== 'undefined' && AIAgent.getConfig) {
            try {
                const aiCfg = AIAgent.getConfig();
                if (aiCfg && aiCfg.apiKey && aiCfg.apiKey.trim()) {
                    const legacyId = (aiCfg.provider === 'gemini') ? 'google' : (aiCfg.provider || 'google');
                    const legacyModel = (aiCfg.model && aiCfg.model !== 'auto') ? aiCfg.model : 'gemini-2.5-flash';
                    const key = `${legacyId}:${legacyModel}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        out.push({
                            provider: legacyId,
                            model: legacyModel,
                            label: (legacyId === 'google' ? 'Google AI Studio' : legacyId) + ' · ' + legacyModel
                        });
                    }
                }
            } catch (e) {}
        }
        return out;
    }

    /**
     * The credentials of one connected API — used by the IDE agent when the
     * auto-router fails over to a provider that was connected in this hub.
     */
    function credentials(id) {
        if (!id) return null;
        let rec = hub.providers[id];
        if (!rec && id === 'gemini') rec = hub.providers['google'];
        if (!rec && id === 'google') rec = hub.providers['gemini'];
        if (!rec) return null;
        const m = meta(id);
        const provKind = rec.kind || m.kind || ((id === 'gemini' || id === 'google') ? 'gemini' : 'openai');
        return {
            id: id,
            name: rec.name || m.name || id,
            baseUrl: rec.baseUrl || m.baseUrl || '',
            kind: provKind,
            key: rec.key || '',
            keyless: false
        };
    }

    /** Returns list of all connected providers with their active models */
    function getConnectedProviders() {
        load();
        const out = [];
        const seen = new Set();
        Object.keys(hub.providers).forEach(id => {
            const rec = hub.providers[id];
            if (!rec) return;
            const isOk = (rec.status === 'ok') && (rec.key && String(rec.key).trim().length > 0);
            if (!isOk) return;
            const m = meta(id);
            let models = (rec.models && rec.models.length) ? rec.models : [];
            if (!models.length && typeof AIProviderCatalog !== 'undefined') {
                models = AIProviderCatalog.modelsFor(id) || [];
            }
            if (!models.length && KNOWN_DEFAULT_MODELS[id]) {
                models = KNOWN_DEFAULT_MODELS[id];
            }
            if (Array.isArray(rec.enabledModels) && rec.enabledModels.length) {
                const enSet = new Set(rec.enabledModels);
                models = models.filter(m => enSet.has(m.id));
            }
            seen.add(id);
            out.push({
                id: id,
                name: rec.name || m.name || id,
                kind: rec.kind || m.kind || ((id === 'gemini' || id === 'google') ? 'gemini' : 'openai'),
                baseUrl: rec.baseUrl || m.baseUrl || '',
                key: rec.key || '',
                keyless: false,
                status: rec.status,
                models: models
            });
        });

        // Also check if AIAgent has a legacy key saved in its config
        if (typeof AIAgent !== 'undefined') {
            try {
                const aiCfg = AIAgent.getConfig ? AIAgent.getConfig() : null;
                if (aiCfg && aiCfg.apiKey && aiCfg.apiKey.trim()) {
                    const legacyId = (aiCfg.provider === 'gemini') ? 'google' : (aiCfg.provider || 'google');
                    if (!seen.has(legacyId) && !seen.has('gemini') && !seen.has('google')) {
                        const m = meta(legacyId);
                        out.push({
                            id: legacyId,
                            name: m.name || (legacyId === 'google' ? 'Google AI Studio' : legacyId),
                            kind: legacyId === 'google' || legacyId === 'gemini' ? 'gemini' : 'openai',
                            baseUrl: m.baseUrl || '',
                            key: aiCfg.apiKey,
                            keyless: false,
                            status: 'ok',
                            models: KNOWN_DEFAULT_MODELS[legacyId] || [{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }]
                        });
                    }
                }
            } catch (e) {}
        }

        return out;
    }

    /** run one prompt through a specific provider (used by the IDE agent) */
    async function runProviderChat(providerId, model, promptText, systemText) {
        const messages = [];
        if (systemText) messages.push({ role: 'system', content: systemText });
        messages.push({ role: 'user', content: promptText });
        const reply = await chatOnce(providerId, model, messages);
        recordUsage(providerId, model, reply.usage, true);
        return reply.text;
    }

    /* ── page open / close ──────────────────────────────────────────────── */
    function open(requestedTab) {
        load();
        if (typeof AIAgent !== 'undefined') {
            try {
                const aiCfg = AIAgent.getConfig ? AIAgent.getConfig() : null;
                if (aiCfg && aiCfg.apiKey && aiCfg.provider) {
                    const hubProv = (aiCfg.provider === 'gemini') ? 'google' : aiCfg.provider;
                    const r = record(hubProv);
                    if (!r.key) {
                        r.key = aiCfg.apiKey;
                        saveHub();
                    }
                }
            } catch (e) { /* ignore */ }
        }

        if (requestedTab && TABS.some(t => t.id === requestedTab)) {
            activeTab = requestedTab;
        } else if (hub.settings.lastTab && TABS.some(t => t.id === hub.settings.lastTab)) {
            activeTab = hub.settings.lastTab;
        }

        // Open the enlarged AI Settings & API Connect Hub modal
        if (typeof AIAgent !== 'undefined' && AIAgent.openSettings) {
            AIAgent.openSettings('apihub-' + activeTab);
        } else if (typeof App !== 'undefined' && App.openModal) {
            App.openModal('ai-settings-modal');
        }

        render();

        // Search input is hooked directly in the DOM via oninput="APIHub.onSearchInput(this.value)"
        if (hub.settings.autoRefresh) {
            clearInterval(probeTimer);
            probeTimer = setInterval(() => { if (isOpen()) quotaAll(); }, 120000);
        }
    }

    function close() {
        if (typeof App !== 'undefined' && App.closeModal) {
            App.closeModal('ai-settings-modal');
        }
        clearInterval(probeTimer);
    }

    function isOpen() {
        const modal = el('ai-settings-modal');
        const tab = el('ai-tab-apihub');
        return !!(modal && modal.classList.contains('active') && tab && tab.style.display !== 'none');
    }

    function toggle() { isOpen() ? close() : open(); }

    /* ── boot ───────────────────────────────────────────────────────────── */
    function init() {
        load();
    }

    async function connectAllFreeKeyless() {
        toast('All providers require an individual API key. Paste your key on any card to connect.', 'info');
    }

    return {
        init, open, close, toggle, isOpen, render, setTab, setFilter, setUsageDay,
        onSearchInput, clearSearch, updateGridOnly, dismissError, clearCardError,
        connect, connectBulk, connectAllFreeKeyless, disconnect, forget, forgetAll, refreshModels, refreshQuota,
        refreshAll, quotaAll, resetUsage, clearChat, exportUsage, sendChat, chatKeydown,
        setChatProvider, setChatModel, toggleKeyVisibility, copyText, setDraftKey,
        routerCandidates, runProviderChat, credentials, getConnectedProviders,
        openModelSelector, closeModelSelector, togglePickerModel, togglePickerRow,
        toggleAllPickerModels, saveModelSelector, onPickerSearchInput, clearPickerSearch,
        setPickerFilter, addCustomPickerModel,
        // exposed for tests / other modules
        _state: () => ({ hub: hub, usage: usage, chat: chat, activeTab: activeTab }),
        _totals: totals,
        _recordUsage: recordUsage,
        _fetchModels: fetchModels,
        _probeQuota: probeQuota,
        _chatOnce: chatOnce,
        _parseBudget: (t) => AIProviderCatalog.parseBudget(t)
    };
})();
