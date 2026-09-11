/* ==========================================================================
   Master Web IDE Ultra - CodeMirror Controller & Snippets Engine
   ========================================================================== */

const EditorController = (function() {
    let cm = null;

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

        cm = CodeMirror(target, {
            value: options.value || "",
            mode: options.mode || "htmlmixed",
            theme: options.theme || "dracula",
            lineNumbers: true,
            lineWrapping: true,
            autoCloseBrackets: true,
            autoCloseTags: true,
            matchBrackets: true,
            styleActiveLine: true,
            tabSize: 2,
            indentUnit: 2,
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
            cm.on("change", () => options.onChange(cm.getValue()));
        }
        if (options.onCursorActivity) {
            cm.on("cursorActivity", () => options.onCursorActivity(cm.getCursor()));
        }

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
            if (mode === "javascript") category = "js";
            if (mode === "css") category = "css";

            if (SNIPPETS[category] && SNIPPETS[category][word]) {
                const snippet = SNIPPETS[category][word];
                const from = { line: cursor.line, ch: cursor.ch - word.length };
                const to = { line: cursor.line, ch: cursor.ch };
                cmInstance.replaceRange(snippet, from, to);
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

        try {
            if (mode === "htmlmixed" || mode === "xml") {
                formatted = html_beautify(content, { indent_size: 2, wrap_line_length: 90 });
            } else if (mode === "css") {
                formatted = css_beautify(content, { indent_size: 2 });
            } else if (mode === "javascript") {
                formatted = js_beautify(content, { indent_size: 2 });
            }
            cm.setValue(formatted);
            App.showToast("Document Formatted!", "success");
        } catch (e) {
            App.showToast("Formatting Error: " + e.message, "error");
        }
    }

    function setContent(content, mode = "htmlmixed") {
        if (!cm) return;
        cm.setOption("mode", mode);
        cm.setValue(content);
        cm.clearHistory();
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

    function setFontSize(size) {
        const el = document.querySelector('.CodeMirror');
        if (el) el.style.fontSize = size + 'px';
        refresh();
    }

    function setTabSize(size) {
        if (cm) {
            cm.setOption('tabSize', parseInt(size));
            cm.setOption('indentUnit', parseInt(size));
        }
    }

    function setTheme(themeName) {
        if (cm) cm.setOption('theme', themeName);
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
        setTabSize,
        setTheme,
        getCM: () => cm
    };
})();
