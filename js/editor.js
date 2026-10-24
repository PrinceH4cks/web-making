/* ==========================================================================
   Master Web IDE Ultra - CodeMirror Controller & Snippets Engine
   ========================================================================== */

const EditorController = (function () {
    let cm = null;
    let changeHandler = null;
    let suppressChange = false;

    // Persisted editor preferences (restored from IDEPrefs on init)
    let fontSize = 14.5;
    let tabSize = 2;
    let lineWrapping = false; // Default: Single line (no wrap, horizontal scroll)

    const SNIPPETS = {
        html: {
            "html:5": `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>`,
            "!": `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>`,
            "btn": `<button class="btn">Click Me</button>`,
            "card": `<div class="card">\n  <h2>Card Title</h2>\n  <p>Card description goes here.</p>\n</div>`
        },
        js: {
            "clg": `console.log();`,
            "func": `function myFunc() {\n  \n}`,
            "arrow": `const myFunc = () => {\n  \n};`,
            "fetch": `fetch('https://api.example.com/data')\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`,
            "table": `console.table([\n  { id: 1, name: 'Item A', value: 100 },\n  { id: 2, name: 'Item B', value: 200 }\n]);`
        },
        css: {
            "flex": `display: flex;\nalign-items: center;\njustify-content: center;`,
            "grid": `display: grid;\ngrid-template-columns: repeat(auto-fit, minmax(250px, 1fr));\ngap: 1rem;`,
            "reset": `* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}`
        }
    };

    function init(containerId, options = {}) {
        const target = document.getElementById(containerId);
        if (!target) return;

        const p = (typeof IDEPrefs !== 'undefined' && IDEPrefs.get()) || {};
        fontSize = typeof p.fontSize === 'number' ? p.fontSize : 14.5;
        tabSize = typeof p.tabSize === 'number' ? p.tabSize : 2;
        lineWrapping = typeof p.lineWrapping === 'boolean' ? p.lineWrapping : false;

        cm = CodeMirror(target, {
            value: options.value || "",
            mode: options.mode || "htmlmixed",
            theme: options.theme || "dracula",
            lineNumbers: true,
            lineWrapping: lineWrapping,
            autoCloseBrackets: true,
            autoCloseTags: true,
            matchBrackets: true,
            styleActiveLine: true,
            tabSize: tabSize,
            indentUnit: tabSize,
            extraKeys: {
                "Ctrl-Space": "autocomplete",
                "Tab": handleTabSnippet,
                "Shift-Alt-F": formatCode,
                "Ctrl-S": () => {
                    if (options.onSave) options.onSave();
                },
                "Ctrl-Enter": () => {
                    if (options.onRun) options.onRun();
                }
            }
        });

        if (options.onChange) {
            changeHandler = options.onChange;
            cm.on("change", () => {
                // Programmatic content swaps must not trigger the autosave cycle
                if (suppressChange) return;
                changeHandler(cm.getValue());
            });
        }
        if (options.onCursorActivity) {
            cm.on("cursorActivity", () => options.onCursorActivity(cm.getCursor()));
        }

        // Apply the persisted font size to the freshly created editor
        applyFontSize();

        return cm;
    }

    function handleTabSnippet(cmInstance) {
        if (cmInstance.somethingSelected()) {
            cmInstance.indentSelection("add");
            return;
        }

        const cursor = cmInstance.getCursor();
        const line = cmInstance.getLine(cursor.line);
        const textBeforeCursor = line.slice(0, cursor.ch);
        const match = textBeforeCursor.match(/([a-zA-Z0-9:!_-]+)$/);

        if (match) {
            const word = match[1];
            const mode = cmInstance.getOption("mode");

            let category = "html";
            if (mode === "javascript" || mode === "application/json") category = "js";
            if (mode === "css") category = "css";

            if (SNIPPETS[category] && SNIPPETS[category][word]) {
                const snippet = SNIPPETS[category][word];
                const from = { line: cursor.line, ch: cursor.ch - word.length };
                const to = { line: cursor.line, ch: cursor.ch };
                cmInstance.replaceRange(snippet, from, to);

                // FIX: park the cursor on the first blank line of the snippet
                // (or at the very end when the snippet has none).
                const lines = snippet.split('\n');
                let targetLine = cursor.line + lines.length - 1;
                let targetCh = lines[lines.length - 1].length;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].trim() === '') {
                        targetLine = cursor.line + i;
                        targetCh = lines[i].length;
                        break;
                    }
                }
                cmInstance.setCursor({ line: targetLine, ch: targetCh });
                cmInstance.focus();
                return;
            }
        }

        cmInstance.execCommand("insertSoftTab");
    }

    function formatCode() {
        if (!cm) return;
        const mode = cm.getOption("mode");
        const content = cm.getValue();
        let formatted = content;
        let handled = true;

        try {
            if (mode === "htmlmixed" || mode === "xml") {
                formatted = html_beautify(content, { indent_size: 2, wrap_line_length: 90 });
            } else if (mode === "css") {
                formatted = css_beautify(content, { indent_size: 2 });
            } else if (mode === "javascript" || mode === "application/json") {
                formatted = js_beautify(content, { indent_size: 2 });
            } else {
                handled = false;
            }

            if (!handled) {
                App.showToast("Formatting is not supported for this file type", "info");
                return;
            }

            cm.setValue(formatted);
            App.showToast("Document Formatted!", "success");
        } catch (e) {
            App.showToast("Formatting Error: " + e.message, "error");
        }
    }

    function setContent(content, mode = "htmlmixed") {
        if (!cm) return;
        suppressChange = true;
        try {
            cm.setOption("mode", mode);
            cm.setValue(content === null || content === undefined ? '' : content);
            cm.clearHistory();
        } finally {
            suppressChange = false;
        }
    }

    function getValue() {
        return cm ? cm.getValue() : "";
    }

    function refresh() {
        if (cm) cm.refresh();
    }

    function undo() {
        if (cm) {
            cm.undo();
            cm.focus();
        }
    }

    function redo() {
        if (cm) {
            cm.redo();
            cm.focus();
        }
    }

    function insertTab() {
        if (cm) {
            cm.execCommand("insertSoftTab");
            cm.focus();
        }
    }

    function applyFontSize() {
        // CSS variable keeps the size consistent for every CodeMirror instance
        const root = document.documentElement;
        if (root && root.style && typeof root.style.setProperty === 'function') {
            root.style.setProperty('--editor-font-size', fontSize + 'px');
        }
        const el = document.querySelector('.CodeMirror');
        if (el) el.style.fontSize = fontSize + 'px';
    }

    function setFontSize(size) {
        const parsed = parseFloat(size);
        fontSize = isNaN(parsed) ? 14.5 : parsed;
        applyFontSize();
        refresh();
        if (typeof IDEPrefs !== 'undefined') IDEPrefs.set('fontSize', fontSize);
    }

    function getFontSize() {
        return fontSize;
    }

    function setTabSize(size) {
        const parsed = parseInt(size, 10);
        tabSize = isNaN(parsed) ? 2 : parsed;
        if (cm) {
            cm.setOption('tabSize', tabSize);
            cm.setOption('indentUnit', tabSize);
        }
        if (typeof IDEPrefs !== 'undefined') IDEPrefs.set('tabSize', tabSize);
    }

    function getTabSize() {
        return tabSize;
    }

    function setTheme(themeName) {
        if (cm) cm.setOption('theme', themeName);
    }

    function setLineWrapping(enabled) {
        lineWrapping = !!enabled;
        if (cm) {
            cm.setOption('lineWrapping', lineWrapping);
            refresh();
        }
        if (typeof IDEPrefs !== 'undefined') IDEPrefs.set('lineWrapping', lineWrapping);
    }

    function getLineWrapping() {
        return lineWrapping;
    }

    return {
        init,
        setContent,
        getValue,
        formatCode,
        refresh,
        undo,
        redo,
        insertTab,
        setFontSize,
        getFontSize,
        setTabSize,
        getTabSize,
        setTheme,
        setLineWrapping,
        getLineWrapping,
        getCM: () => cm
    };
})();
