/* ==========================================================================
   Master Web IDE Ultra - Nested Virtual File System (VFS)
   Supports: nested folders (incl. EMPTY folders), recursive rename/delete,
   debounced persistence and tree action buttons.
   ========================================================================== */

const VFS = (function() {
    const STORAGE_KEY = 'master_ide_ultra_vfs';
    const SAVE_DEBOUNCE = 400;

    // Default initial project files
    const defaultProject = {
        "index.html": {
            type: "htmlmixed",
            content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prince Studio</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <main class="hero">
    <div class="glow"></div>
    <span class="badge">🔥 Next-Gen Web Studio</span>
    <h1>Prince Studio</h1>
    <p>Real-time bundler, nested folders, interactive terminal, and 1-click packages.</p>
    
    <div class="actions">
      <button id="counter-btn" class="btn-primary">⚡ Click Me: <span id="count">0</span></button>
      <button onclick="testConsole()" class="btn-secondary">Run DevTools Log</button>
    </div>
  </main>
  <script src="js/main.js"><\/script>
</body>
</html>`
        },
        "css/style.css": {
            type: "css",
            content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  background: radial-gradient(circle at 50% 20%, #1e1b4b, #09090b);
  font-family: system-ui, -apple-system, sans-serif;
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero {
  position: relative;
  text-align: center;
  padding: 3rem 2rem;
  max-width: 540px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
}

.glow {
  position: absolute;
  top: -80px; left: 50%;
  transform: translateX(-50%);
  width: 200px; height: 160px;
  background: #38bdf8;
  filter: blur(80px);
  opacity: 0.25;
  pointer-events: none;
}

.badge {
  display: inline-block;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 4px 12px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 1.2rem;
}

h1 {
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 0.8rem;
  background: linear-gradient(to right, #ffffff, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

p {
  color: #94a3b8;
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 2rem;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

button {
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary {
  background: #38bdf8;
  color: #0c0e14;
  box-shadow: 0 4px 15px rgba(56, 189, 248, 0.35);
}
.btn-primary:hover {
  transform: translateY(-2px);
  background: #7dd3fc;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}`
        },
        "js/main.js": {
            type: "javascript",
            content: `let count = 0;
const countEl = document.getElementById('count');
const btn = document.getElementById('counter-btn');

btn.addEventListener('click', () => {
  count++;
  countEl.innerText = count;
  console.log('Button clicked! Total:', count);
});

function testConsole() {
  console.info('Running performance benchmark test...');
  console.table([
    { name: 'HTML5 Parser', speed: '0.2ms', status: 'Optimal' },
    { name: 'CSS Engine', speed: '0.5ms', status: 'Optimal' },
    { name: 'JS V8 Sandbox', speed: '0.1ms', status: 'Optimal' }
  ]);
  console.warn('Memory usage is well within limits.');
}

console.log('🚀 Prince Studio Ready & Loaded!');`
        }
    };

    let files = {};
    let folders = new Set();          // explicit folder paths (may be empty)
    let openFolders = new Set(['css', 'js']);

    let saveTimer = null;
    let saveWarned = false;

    // ────────────────────────────────────────────────────────────── PERSISTENCE
    function init() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                files = parsed && parsed.files ? parsed.files : {};
                folders = new Set((parsed && parsed.folders) ? parsed.folders : []);
                // Restore the expanded/collapsed state of the folder tree
                if (parsed && Array.isArray(parsed.openFolders) && parsed.openFolders.length) {
                    openFolders = new Set(parsed.openFolders);
                }
                // Backward compatibility: derive missing folders from file paths
                Object.keys(files).forEach(p => ensureParentFolders(p));
            } else {
                files = JSON.parse(JSON.stringify(defaultProject));
                folders = new Set();
                Object.keys(files).forEach(p => ensureParentFolders(p));
                persist();
            }
        } catch (e) {
            files = JSON.parse(JSON.stringify(defaultProject));
            folders = new Set();
            Object.keys(files).forEach(p => ensureParentFolders(p));
        }
    }

    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                files: files,
                folders: Array.from(folders),
                openFolders: Array.from(openFolders)
            }));
            saveWarned = false;
        } catch (e) {
            console.error("VFS Save Error:", e);
            if (!saveWarned) {
                saveWarned = true;
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast("Browser storage is full — changes are NOT persisted!", "error");
                }
            }
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

    /** Drops a pending write WITHOUT persisting (used when erasing all local data). */
    function cancelPendingSave() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
    }

    window.addEventListener('beforeunload', flushPendingSave);

    // ────────────────────────────────────────────────────────────── PATH HELPERS
    function normalizePath(p) {
        return String(p || '')
            .replace(/\\/g, '/')
            .replace(/^\/+/, '')
            .replace(/\/+$/, '')
            .replace(/\/{2,}/g, '/');
    }

    function ensureParentFolders(path) {
        const parts = String(path).split('/');
        parts.pop();
        let acc = '';
        parts.forEach(part => {
            acc = acc ? acc + '/' + part : part;
            folders.add(acc);
        });
    }

    // ────────────────────────────────────────────────────────────── CRUD
    function get(path) {
        return files[normalizePath(path)] || null;
    }

    function set(path, content, type) {
        if (!path) return false;
        path = normalizePath(path);
        if (!path) return false;
        if (!type) type = detectType(path);

        files[path] = {
            type: type,
            content: content === null || content === undefined ? '' : content
        };
        ensureParentFolders(path);
        save();
        return true;
    }

    /** Deletes a file OR a folder (with all of its descendants). */
    function remove(path) {
        path = normalizePath(path);
        if (!path) return false;

        const prefix = path + '/';
        let removed = false;

        Object.keys(files).forEach(p => {
            if (p === path || p.startsWith(prefix)) {
                delete files[p];
                removed = true;
            }
        });

        Array.from(folders).forEach(f => {
            if (f === path || f.startsWith(prefix)) {
                folders.delete(f);
                removed = true;
            }
        });

        if (removed) save();
        return removed;
    }

    /** Renames a file OR a folder (with all of its descendants). */
    function rename(oldPath, newPath) {
        oldPath = normalizePath(oldPath);
        newPath = normalizePath(newPath);

        if (!oldPath || !newPath || oldPath === newPath) return false;
        if (files[newPath] || folders.has(newPath)) return false;

        const prefix = oldPath + '/';
        let moved = false;

        // Move files (and every descendant of a folder)
        Object.keys(files).forEach(p => {
            let target = null;
            if (p === oldPath) {
                target = newPath;
            } else if (p.startsWith(prefix)) {
                target = newPath + p.slice(oldPath.length);
            }
            if (target) {
                files[target] = {
                    type: detectType(target),
                    content: files[p].content
                };
                delete files[p];
                moved = true;
            }
        });

        // Move folders
        if (moved || folders.has(oldPath)) {
            const nextFolders = new Set();
            Array.from(folders).forEach(f => {
                if (f === oldPath) {
                    nextFolders.add(newPath);
                    moved = true;
                } else if (f.startsWith(prefix)) {
                    nextFolders.add(newPath + f.slice(oldPath.length));
                    moved = true;
                } else {
                    nextFolders.add(f);
                }
            });
            folders = nextFolders;
        }

        if (moved) {
            ensureParentFolders(newPath);
            save();
        }
        return moved;
    }

    /** Creates an explicitly empty folder. */
    function addFolder(path) {
        path = normalizePath(path);
        if (!path) return false;
        if (files[path] || folders.has(path)) return false;
        folders.add(path);
        ensureParentFolders(path);
        openFolders.add(path);
        save();
        return true;
    }

    function hasFolder(path) {
        return folders.has(normalizePath(path));
    }

    function detectType(path) {
        const p = String(path).toLowerCase();
        if (p.endsWith('.html') || p.endsWith('.htm')) return 'htmlmixed';
        if (p.endsWith('.css')) return 'css';
        if (p.endsWith('.js') || p.endsWith('.mjs') || p.endsWith('.jsx')) return 'javascript';
        if (p.endsWith('.json')) return 'application/json';
        if (p.endsWith('.xml') || p.endsWith('.svg')) return 'xml';
        if (p.endsWith('.md') || p.endsWith('.markdown')) return 'markdown';
        return 'text';
    }

    function getIconClass(path) {
        const p = String(path).toLowerCase();
        if (p.endsWith('.html') || p.endsWith('.htm')) return 'fab fa-html5 icon-html';
        if (p.endsWith('.css')) return 'fab fa-css3-alt icon-css';
        if (p.endsWith('.js') || p.endsWith('.jsx')) return 'fab fa-js icon-js';
        if (p.endsWith('.json')) return 'fas fa-code icon-json';
        if (p.endsWith('.svg')) return 'fas fa-bezier-curve icon-svg';
        if (p.endsWith('.xml')) return 'fas fa-code icon-json';
        if (p.endsWith('.md')) return 'fab fa-markdown icon-md';
        return 'fas fa-file-code';
    }

    function getAllPaths() {
        return Object.keys(files).sort();
    }

    function getAllFolders() {
        return Array.from(folders).sort();
    }

    function resetToTemplate(templateObj) {
        files = JSON.parse(JSON.stringify(templateObj || defaultProject));
        folders = new Set();
        Object.keys(files).forEach(p => ensureParentFolders(p));
        save(true);
    }

    // ────────────────────────────────────────────────────────────── TREE
    function buildTree() {
        const root = { name: '', path: '', isFolder: true, children: {} };

        function ensureFolderNode(parent, path) {
            const parts = path.split('/');
            let node = parent;
            let acc = '';
            parts.forEach(part => {
                acc = acc ? acc + '/' + part : part;
                if (!node.children[part] || !node.children[part].isFolder) {
                    node.children[part] = { name: part, path: acc, isFolder: true, children: {} };
                }
                node = node.children[part];
            });
            return node;
        }

        getAllFolders().forEach(f => ensureFolderNode(root, f));

        Object.keys(files).forEach(fp => {
            const parts = fp.split('/');
            const fileName = parts.pop();
            const parent = parts.length ? ensureFolderNode(root, parts.join('/')) : root;
            parent.children[fileName] = { name: fileName, path: fp, isFolder: false };
        });

        return root;
    }

    function toggleFolder(folderPath) {
        if (openFolders.has(folderPath)) {
            openFolders.delete(folderPath);
        } else {
            openFolders.add(folderPath);
        }
        // Persist the tree state so the folders stay expanded after a refresh
        save();
    }

    /** Render the nested folder tree DOM. */
    function renderTree(container, activePath, onFileSelect, onContextMenu, actions = {}) {
        container.innerHTML = '';
        const root = buildTree();

        function renderNodes(parentNode, parentUl) {
            const entries = Object.values(parentNode.children);
            // Sort: folders first, then files alphabetically
            entries.sort((a, b) => {
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                return a.name.localeCompare(b.name);
            });

            entries.forEach(item => {
                const li = document.createElement('li');
                li.className = 'tree-node';

                if (item.isFolder) {
                    const isOpen = openFolders.has(item.path);
                    const row = document.createElement('div');
                    row.className = 'tree-row folder-row';
                    row.innerHTML = `
                        <div class="tree-info">
                            <i class="fas fa-chevron-${isOpen ? 'down' : 'right'}" style="font-size: 10px; width: 10px; color: var(--text-faint);"></i>
                            <i class="fas fa-folder${isOpen ? '-open' : ''} icon-folder"></i>
                            <span>${IDEUtils.escapeHtml(item.name)}</span>
                        </div>
                        <div class="tree-actions">
                            <i class="fas fa-plus" title="New File Inside" data-action="new-in-folder" data-path="${IDEUtils.escapeAttr(item.path)}"></i>
                            <i class="fas fa-trash action-del" title="Delete Folder" data-action="del-folder" data-path="${IDEUtils.escapeAttr(item.path)}"></i>
                        </div>
                    `;

                    row.addEventListener('click', (e) => {
                        if (e.target.closest('.tree-actions')) return;
                        toggleFolder(item.path);
                        renderTree(container, activePath, onFileSelect, onContextMenu, actions);
                    });

                    row.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        if (onContextMenu) onContextMenu(e, item.path, true);
                    });

                    // Hover action buttons (previously dead UI)
                    const newBtn = row.querySelector('[data-action="new-in-folder"]');
                    if (newBtn && actions.onNewFile) {
                        newBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            actions.onNewFile(item.path);
                        });
                    }
                    const delBtn = row.querySelector('[data-action="del-folder"]');
                    if (delBtn && actions.onDelete) {
                        delBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            actions.onDelete(item.path);
                        });
                    }

                    li.appendChild(row);

                    const childrenUl = document.createElement('ul');
                    childrenUl.className = `tree-folder-children ${isOpen ? '' : 'collapsed'}`;
                    renderNodes(item, childrenUl);
                    li.appendChild(childrenUl);

                } else {
                    const row = document.createElement('div');
                    row.className = `tree-row file-row ${item.path === activePath ? 'active' : ''}`;
                    const icon = getIconClass(item.path);
                    row.innerHTML = `
                        <div class="tree-info">
                            <i class="${icon}"></i>
                            <span>${IDEUtils.escapeHtml(item.name)}</span>
                        </div>
                        <div class="tree-actions">
                            <i class="fas fa-pen" title="Rename" data-action="rename" data-path="${IDEUtils.escapeAttr(item.path)}"></i>
                            <i class="fas fa-trash action-del" title="Delete" data-action="delete" data-path="${IDEUtils.escapeAttr(item.path)}"></i>
                        </div>
                    `;

                    row.addEventListener('click', (e) => {
                        if (e.target.closest('.tree-actions')) return;
                        if (onFileSelect) onFileSelect(item.path);
                    });

                    row.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        if (onContextMenu) onContextMenu(e, item.path, false);
                    });

                    const renameBtn = row.querySelector('[data-action="rename"]');
                    if (renameBtn && actions.onRename) {
                        renameBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            actions.onRename(item.path);
                        });
                    }
                    const delBtn = row.querySelector('[data-action="delete"]');
                    if (delBtn && actions.onDelete) {
                        delBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            actions.onDelete(item.path);
                        });
                    }

                    li.appendChild(row);
                }

                parentUl.appendChild(li);
            });
        }

        renderNodes(root, container);
    }

    // ────────────────────────────────────────────────────────────── EXPORT
    /** ZIP Export with full folder structure */
    function exportZip(projectName = "Master_IDE_Ultra_Project") {
        if (typeof JSZip === 'undefined') {
            alert("JSZip not loaded!");
            return;
        }
        flushPendingSave();

        const zip = new JSZip();
        Object.keys(files).forEach(filePath => {
            zip.file(filePath, files[filePath].content);
        });
        zip.generateAsync({ type: "blob" }).then(blob => {
            saveAs(blob, `${projectName}.zip`);
        });
    }

    init();

    return {
        get,
        set,
        remove,
        rename,
        addFolder,
        hasFolder,
        getAllPaths,
        getAllFolders,
        buildTree,
        renderTree,
        resetToTemplate,
        exportZip,
        normalizePath,
        detectType,
        getIconClass,
        save,
        flushPendingSave,
        cancelPendingSave
    };
})();
