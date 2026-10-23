/* ==========================================================================
   Master Web IDE Ultra - Dependency Bundler & Code Injector
   ========================================================================== */

const Bundler = (function() {

    function getConsoleInterceptorScript() {
        return `
<script>
(function() {
  function serialize(data) {
    try {
      if (data === undefined) return "undefined";
      if (data === null) return "null";
      if (typeof data === "object") return JSON.stringify(data, null, 2);
      return String(data);
    } catch(e) {
      return String(data);
    }
  }

  function emit(level, args, isTable = false, tableData = null) {
    try {
      const message = Array.from(args).map(serialize).join(' ');
      window.parent.postMessage({
        source: 'IDE_CONSOLE',
        level: level,
        message: message,
        isTable: isTable,
        tableData: tableData,
        time: new Date().toLocaleTimeString()
      }, '*');
    } catch(e) {}
  }

  const _log = console.log;
  const _warn = console.warn;
  const _error = console.error;
  const _info = console.info;
  const _table = console.table;
  const _timeMap = {};

  console.log = function(...args) { emit('log', args); _log.apply(console, args); };
  console.warn = function(...args) { emit('warn', args); _warn.apply(console, args); };
  console.error = function(...args) { emit('error', args); _error.apply(console, args); };
  console.info = function(...args) { emit('info', args); _info.apply(console, args); };
  
  console.table = function(tabularData, properties) {
    let dataForTable = tabularData;
    if (typeof tabularData === 'object' && tabularData !== null) {
      emit('table', ['[Table View]'], true, tabularData);
    } else {
      emit('log', [tabularData]);
    }
    if (_table) _table.apply(console, arguments);
  };

  console.time = function(label = 'default') {
    _timeMap[label] = performance.now();
  };

  console.timeEnd = function(label = 'default') {
    if (_timeMap[label]) {
      const duration = (performance.now() - _timeMap[label]).toFixed(2);
      emit('info', [label + ': ' + duration + 'ms']);
      delete _timeMap[label];
    }
  };

  window.onerror = function(msg, url, line, col, err) {
    const filename = url ? url.split('/').pop() : 'inline';
    emit('error', [msg + ' (' + filename + ':' + line + ':' + col + ')']);
    return false;
  };
})();
<\/script>
`;
    }

    // ── Escaping helpers ────────────────────────────────────────────────
    function escapeRegExp(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /** Neutralise a premature </script> inside inlined JavaScript. */
    function escapeForInlineScript(code) {
        return String(code === null || code === undefined ? '' : code)
            .replace(/<\/(script)/gi, '<\\/$1');
    }

    /** Neutralise a premature </style> inside inlined CSS. */
    function escapeForInlineStyle(css) {
        return String(css === null || css === undefined ? '' : css)
            .replace(/<\/(style)/gi, '<\\/$1');
    }

    function escapeAttrValue(str) {
        return String(str).replace(/"/g, '&quot;');
    }

    /**
     * Find the <link>/<script> tag that references the given project file.
     * 1) exact project path first ("css/style.css")
     * 2) basename fallback, but ONLY when the basename is unique in the project
     *    (prevents "css/style.css" from matching "js/style.css")
     */
    function findLinkedTag(html, filePath, isScript) {
        const tag = isScript ? 'script' : 'link';
        const attr = isScript ? 'src' : 'href';
        const escapedPath = escapeRegExp(filePath);
        const closing = isScript ? '(?:<\\/script>)?' : '';

        let re = new RegExp(
            `<${tag}([^>]*?)\\s${attr}\\s*=\\s*["'](?:\\.\\/)?${escapedPath}["']([^>]*)>${closing}`,
            'gi'
        );
        if (re.test(html)) return re;

        const fileName = filePath.split('/').pop();
        const allPaths = VFS.getAllPaths();
        const sameName = allPaths.filter(p => p === fileName || p.endsWith('/' + fileName));

        if (sameName.length === 1) {
            const escapedName = escapeRegExp(fileName);
            re = new RegExp(
                `<${tag}([^>]*?)\\s${attr}\\s*=\\s*["'](?:\\.\\/)?(?:[^"']*\\/)?${escapedName}["']([^>]*)>${closing}`,
                'gi'
            );
            if (re.test(html)) return re;
        }

        return null;
    }

    function injectBefore(html, anchor, tag) {
        if (html.includes(anchor)) {
            return html.replace(anchor, `${tag}\n${anchor}`);
        }
        return tag + '\n' + html;
    }

    function bundle(entryHtmlPath = "index.html") {
        const allPaths = VFS.getAllPaths();
        let targetHtml = entryHtmlPath;

        if (!VFS.get(targetHtml)) {
            targetHtml = allPaths.find(p => p.endsWith('.html')) || null;
        }

        if (!targetHtml) {
            return "<h3 style='color:#ef4444;font-family:sans-serif;text-align:center;padding:40px;'>No HTML file found in project!</h3>";
        }

        let html = VFS.get(targetHtml).content;

        // 1. Resolve and replace CSS links with inline <style>
        allPaths.filter(p => p.endsWith('.css')).forEach(cssPath => {
            const cssContent = VFS.get(cssPath).content;
            const styleTag = `<style data-bundle-file="${escapeAttrValue(cssPath)}">\n${escapeForInlineStyle(cssContent)}\n</style>`;

            const linkRegex = findLinkedTag(html, cssPath, false);
            if (linkRegex) {
                html = html.replace(linkRegex, () => styleTag);
            } else {
                // Auto-inject if not explicitly linked
                html = injectBefore(html, '</head>', styleTag);
            }
        });

        // 2. Resolve and replace JS scripts with inline <script>
        //    (attributes such as type="text/babel" are PRESERVED)
        allPaths.filter(p => p.endsWith('.js') || p.endsWith('.mjs')).forEach(jsPath => {
            const jsContent = VFS.get(jsPath).content;
            const safeJs = escapeForInlineScript(jsContent);

            const scriptRegex = findLinkedTag(html, jsPath, true);
            if (scriptRegex) {
                html = html.replace(scriptRegex, (match, preAttrs, postAttrs) => {
                    const attrs = `${preAttrs || ''} ${postAttrs || ''}`.replace(/\s+/g, ' ').trim();
                    const cleaned = attrs
                        .replace(/\ssrc\s*=\s*["'][^"']*["']/i, '')
                        .replace(/\sdefer\b/i, '')
                        .replace(/\sasync\b/i, '')
                        .trim();
                    const newAttrs = cleaned ? ` ${cleaned}` : '';
                    return `<script${newAttrs} data-bundle-file="${escapeAttrValue(jsPath)}">\n${safeJs}\n<\/script>`;
                });
            } else {
                // Auto-inject at end of body if not linked
                const scriptTag = `<script data-bundle-file="${escapeAttrValue(jsPath)}">\n${safeJs}\n<\/script>`;
                html = injectBefore(html, '</body>', scriptTag);
            }
        });

        // 3. Inject DevTools Console interceptor at the top
        const interceptor = getConsoleInterceptorScript();
        if (html.includes('<head>')) {
            html = html.replace('<head>', `<head>\n${interceptor}`);
        } else {
            html = interceptor + html;
        }

        return html;
    }

    return {
        bundle
    };
})();
