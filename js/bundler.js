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

    function getInspectorInterceptorScript() {
        return `
<script>
(function() {
  let isInspectActive = false;
  let overlay = null;
  let label = null;
  let selectedEl = null;

  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = '__ide_inspector_overlay';
    overlay.style.cssText = 'position:fixed; pointer-events:none; z-index:99999999; border:2px solid #00f2fe; background:rgba(0, 242, 254, 0.2); transition:all 0.05s ease-out; display:none; border-radius:3px;';
    
    label = document.createElement('div');
    label.style.cssText = 'position:absolute; top:-24px; left:0; background:#00f2fe; color:#0b0d13; font-size:10px; font-weight:700; padding:2px 6px; border-radius:3px; font-family:monospace; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.4);';
    overlay.appendChild(label);
    document.body.appendChild(overlay);
  }

  function getHierarchy(el) {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement && parts.length < 5) {
      let desc = cur.tagName.toLowerCase();
      if (cur.id) desc += '#' + cur.id;
      else if (cur.className && typeof cur.className === 'string') {
        const c = cur.className.trim().split(/\\s+/)[0];
        if (c) desc += '.' + c;
      }
      parts.unshift(desc);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function highlight(el) {
    if (!el || el === document.body || el === document.documentElement || el === overlay) {
      if (overlay) overlay.style.display = 'none';
      return;
    }
    createOverlay();
    const r = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = r.top + 'px';
    overlay.style.left = r.left + 'px';
    overlay.style.width = r.width + 'px';
    overlay.style.height = r.height + 'px';

    let tagText = el.tagName.toLowerCase();
    if (el.id) tagText += '#' + el.id;
    else if (el.className && typeof el.className === 'string') {
      const c = el.className.trim().split(/\\s+/)[0];
      if (c) tagText += '.' + c;
    }
    label.innerText = tagText + ' (' + Math.round(r.width) + ' × ' + Math.round(r.height) + ')';
  }

  function inspectElement(el) {
    if (!el || el === document.body || el === document.documentElement) return;
    selectedEl = el;
    highlight(el);

    const s = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const payload = {
      tagName: el.tagName.toLowerCase(),
      id: el.id || '',
      className: typeof el.className === 'string' ? el.className : '',
      hierarchy: getHierarchy(el),
      outerHTML: el.outerHTML ? el.outerHTML.slice(0, 400) : '',
      computed: {
        color: s.color,
        backgroundColor: s.backgroundColor,
        fontSize: s.fontSize,
        fontFamily: s.fontFamily.split(',')[0].replace(/['"]/g, ''),
        display: s.display,
        margin: s.marginTop + ' ' + s.marginRight + ' ' + s.marginBottom + ' ' + s.marginLeft,
        padding: s.paddingTop + ' ' + s.paddingRight + ' ' + s.paddingBottom + ' ' + s.paddingLeft,
        borderRadius: s.borderRadius,
        border: s.borderWidth + ' ' + s.borderStyle + ' ' + s.borderColor,
        width: Math.round(r.width) + 'px',
        height: Math.round(r.height) + 'px'
      }
    };

    window.parent.postMessage({
      source: 'IDE_INSPECTOR',
      type: 'ELEMENT_SELECTED',
      data: payload
    }, '*');
  }

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.source !== 'IDE_INSPECTOR_HOST') return;

    if (e.data.action === 'ENABLE') {
      isInspectActive = true;
      document.body.style.cursor = 'crosshair';
      createOverlay();
    } else if (e.data.action === 'DISABLE') {
      isInspectActive = false;
      document.body.style.cursor = '';
      if (overlay) overlay.style.display = 'none';
    } else if (e.data.action === 'APPLY_STYLE' && selectedEl) {
      try {
        selectedEl.style[e.data.prop] = e.data.value;
        highlight(selectedEl);
      } catch(err) {}
    }
  });

  window.addEventListener('pointermove', function(e) {
    if (!isInspectActive) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    highlight(el);
  }, { passive: true });

  window.addEventListener('click', function(e) {
    if (!isInspectActive) return;
    e.preventDefault();
    e.stopPropagation();
    inspectElement(e.target);
  }, true);
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

        // 3. Inject DevTools Console & Inspector interceptors at the top
    const interceptors = getConsoleInterceptorScript() + '\n' + getInspectorInterceptorScript();
    if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>\n${interceptors}`);
    } else {
        html = interceptors + html;
    }

    return html;
}

    return {
        bundle
    };
})();
