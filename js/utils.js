/* ==========================================================================
   Master Web IDE Ultra - Shared Utility Helpers
   Loaded FIRST so every module can rely on it.
   ========================================================================== */

const IDEUtils = {
    /**
     * Escape a value for safe insertion into HTML text content.
     */
    escapeHtml(str) {
        return String(str === null || str === undefined ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Build a single-quoted JavaScript string literal that is safe to place
     * inside an HTML attribute (e.g. onclick="...").
     * Handles quotes, backslashes, newlines and the </script> breakout.
     */
    jsString(str) {
        return "'" + String(str === null || str === undefined ? '' : str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029')
            .replace(/</g, '\\u003C') +
            "'";
    },

    /**
     * Escape a complete JavaScript expression so it can be used as the value
     * of a double-quoted HTML attribute (onclick / onchange ...).
     */
    attrExpression(jsCode) {
        return this.escapeHtml(jsCode);
    },

    /**
     * Escape a value for use inside a double-quoted HTML attribute.
     */
    escapeAttr(str) {
        return this.escapeHtml(str);
    },

    /**
     * Trailing-edge debounce helper.
     */
    debounce(fn, wait) {
        let timer = null;
        const debounced = function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), wait);
        };
        debounced.cancel = () => {
            clearTimeout(timer);
            timer = null;
        };
        debounced.pending = () => timer !== null;
        return debounced;
    },

    /**
     * Human readable byte size.
     */
    formatBytes(bytes) {
        const b = Number(bytes) || 0;
        if (b < 1024) return b + ' B';
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
        return (b / (1024 * 1024)).toFixed(2) + ' MB';
    }
};

if (typeof window !== 'undefined') {
    window.IDEUtils = IDEUtils;
}
