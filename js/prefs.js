/* ==========================================================================
   Master Web IDE Ultra - Persistent Workspace Preferences (IDEPrefs)
   ---------------------------------------------------------------------------
   Stores EVERY UI / editor / workspace preference in localStorage so that a
   page refresh (or reopening the site months later) NEVER loses the user's
   setup: theme, font size, open tabs, active file, panel states, split ratio,
   device preview size, AI panel state, expanded folders ...

   Data stays 100% on the user's own device. Nothing is ever uploaded.
   ========================================================================== */

const IDEPrefs = (function() {
    const STORAGE_KEY = 'master_ide_prefs';
    const SAVE_DEBOUNCE = 300;

    /** Factory defaults — used when the user has never changed anything. */
    const DEFAULTS = {
        theme: 'dracula',          // UI theme (body[data-theme])
        fontSize: 14.5,            // editor font size in px
        tabSize: 2,                // indentation width
        lineWrapping: false,       // code line wrapping (false = single line / horizontal scroll [default], true = wrap lines)
        previewDelay: 400,         // live-preview debounce (ms)

        openTabs: null,            // null => derive default tabs from the VFS
        activeFile: null,          // currently focused file

        sidebarOpen: true,         // file explorer (desktop)
        consoleOpen: false,        // bottom console drawer
        previewVisible: true,      // live preview pane
        verticalSplit: false,      // horizontal vs vertical split
        splitRatio: 50,            // editor pane width in %

        deviceSize: 'responsive',  // responsive / mobile / tablet / desktop
        mobileView: 'code',        // code | preview | console (mobile only)

        floatingPreview: false,    // detached preview window
        fullscreenPreview: false,  // fullscreen preview
        previewFloatPos: null,     // { left, top } of the floating preview

        aiPanelOpen: false,        // AI Agent side panel

        // 🧭 Auto model router
        aiRouterEnabled: true,     // let the IDE pick the best model automatically
        aiRouterStrategy: 'balanced', // balanced | smartest | fastest | reliable
        aiRouterBudgetMs: 45000,  // total time budget for one routed request
        aiRouterAttemptTimeoutMs: 20000, // per-model attempt timeout
        aiRouterHedge: true,       // start a 2nd model while the 1st is thinking
        aiRouterHedgeMs: 6000      // how long to wait before the hedge starts
    };

    let prefs = Object.assign({}, DEFAULTS);
    let saveTimer = null;

    // ────────────────────────────────────────────────────────────── LOAD
    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return prefs;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                Object.keys(DEFAULTS).forEach(key => {
                    if (parsed[key] !== undefined && parsed[key] !== null) {
                        prefs[key] = parsed[key];
                    }
                });
            }
        } catch (e) {
            console.warn('IDEPrefs: could not read preferences', e);
        }
        return prefs;
    }

    // ────────────────────────────────────────────────────────────── SAVE
    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch (e) {
            console.error('IDEPrefs: could not save preferences', e);
        }
    }

    /** Debounced write. Pass `true` to flush immediately. */
    function save(immediate = false) {
        if (immediate) {
            clearTimeout(saveTimer);
            saveTimer = null;
            persist();
            return;
        }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTimer = null;
            persist();
        }, SAVE_DEBOUNCE);
    }

    function flushPendingSave() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
            persist();
        }
    }

    function cancelPendingSave() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
    }

    // Never lose the last few milliseconds of changes
    window.addEventListener('beforeunload', flushPendingSave);
    window.addEventListener('pagehide', flushPendingSave);

    // ────────────────────────────────────────────────────────────── API
    function get(key, fallback) {
        if (key === undefined) return prefs;
        const value = prefs[key];
        if (value === undefined || value === null) {
            if (fallback !== undefined) return fallback;
            return DEFAULTS[key];
        }
        return value;
    }

    function set(key, value) {
        prefs[key] = value;
        save();
        return value;
    }

    function setMany(obj) {
        if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach(k => { prefs[k] = obj[k]; });
            save();
        }
        return prefs;
    }

    /** Restores every preference to its factory default. */
    function reset() {
        prefs = Object.assign({}, DEFAULTS);
        save(true);
        return prefs;
    }

    /** Completely removes the preferences from this device. */
    function clear() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* storage blocked */ }
        prefs = Object.assign({}, DEFAULTS);
    }

    load();

    return {
        get,
        set,
        setMany,
        save,
        reset,
        clear,
        flushPendingSave,
        cancelPendingSave,
        DEFAULTS
    };
})();
