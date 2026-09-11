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
            const styleTag = `<style data-bundle-file="${cssPath}">\n${cssContent}\n</style>`;
            
            // Regex to match relative or exact link tag
            const fileName = cssPath.split('/').pop();
            const linkRegex = new RegExp(`<link[^>]*href=["'](?:\\.\\/)?(?:[^"']*\\/)?${fileName}["'][^>]*>`, 'gi');

            if (linkRegex.test(html)) {
                html = html.replace(linkRegex, styleTag);
            } else if (!html.includes(`data-bundle-file="${cssPath}"`)) {
                // Auto-inject if not explicitly linked
                if (html.includes('</head>')) {
                    html = html.replace('</head>', `${styleTag}\n</head>`);
                } else {
                    html = `${styleTag}\n` + html;
                }
            }
        });

        // 2. Resolve and replace JS scripts with inline <script>
        allPaths.filter(p => p.endsWith('.js')).forEach(jsPath => {
            const jsContent = VFS.get(jsPath).content;
            const scriptTag = `<script data-bundle-file="${jsPath}">\n${jsContent}\n<\/script>`;
            
            const fileName = jsPath.split('/').pop();
            const scriptRegex = new RegExp(`<script[^>]*src=["'](?:\\.\\/)?(?:[^"']*\\/)?${fileName}["'][^>]*><\\/script>`, 'gi');

            if (scriptRegex.test(html)) {
                html = html.replace(scriptRegex, scriptTag);
            } else if (!html.includes(`data-bundle-file="${jsPath}"`)) {
                // Auto-inject at end of body if not linked
                if (html.includes('</body>')) {
                    html = html.replace('</body>', `${scriptTag}\n</body>`);
                } else {
                    html = html + `\n${scriptTag}`;
                }
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
