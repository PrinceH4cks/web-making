/* ==========================================================================
   Master Web IDE Ultra - Nested Virtual File System (VFS)
   ========================================================================== */

const VFS = (function() {
    const STORAGE_KEY = 'master_ide_ultra_vfs';
    
    // Default initial project files
    const defaultProject = {
        "index.html": {
            type: "htmlmixed",
            content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Master IDE Ultra Studio</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <main class="hero">
    <div class="glow"></div>
    <span class="badge">🔥 Next-Gen Web Studio</span>
    <h1>Master IDE Ultra</h1>
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

console.log('🚀 Master IDE Ultra Ready & Loaded!');`
        }
    };

    let files = {};
    let openFolders = new Set(['css', 'js']);

    function init() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                files = JSON.parse(saved);
            } else {
                files = JSON.parse(JSON.stringify(defaultProject));
                save();
            }
        } catch (e) {
            files = JSON.parse(JSON.stringify(defaultProject));
        }
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
        } catch (e) {
            console.error("VFS Save Error:", e);
        }
    }

    function get(path) {
        return files[path] || null;
    }

    function set(path, content, type) {
        if (!path) return;
        path = normalizePath(path);
        if (!type) type = detectType(path);
        
        files[path] = {
            type: type,
            content: content
        };
        save();
    }

    function remove(path) {
        path = normalizePath(path);
        if (files[path]) {
            delete files[path];
            save();
            return true;
        }
        return false;
    }

    function rename(oldPath, newPath) {
        oldPath = normalizePath(oldPath);
        newPath = normalizePath(newPath);
        if (files[oldPath]) {
            files[newPath] = files[oldPath];
            files[newPath].type = detectType(newPath);
            delete files[oldPath];
            save();
            return true;
        }
        return false;
    }

    function normalizePath(p) {
        return p.replace(/\\/g, '/').replace(/^\/+/, '');
    }

    function detectType(path) {
        if (path.endsWith('.html') || path.endsWith('.htm')) return 'htmlmixed';
        if (path.endsWith('.css')) return 'css';
        if (path.endsWith('.js')) return 'javascript';
        if (path.endsWith('.json')) return 'javascript';
        if (path.endsWith('.md')) return 'markdown';
        return 'text';
    }

    function getIconClass(path) {
        if (path.endsWith('.html')) return 'fab fa-html5 icon-html';
        if (path.endsWith('.css')) return 'fab fa-css3-alt icon-css';
        if (path.endsWith('.js')) return 'fab fa-js icon-js';
        if (path.endsWith('.json')) return 'fas fa-code icon-json';
        if (path.endsWith('.svg')) return 'fas fa-bezier-curve icon-svg';
        if (path.endsWith('.md')) return 'fab fa-markdown icon-md';
        return 'fas fa-file-code';
    }

    function getAllPaths() {
        return Object.keys(files).sort();
    }

    function resetToTemplate(templateObj) {
        files = JSON.parse(JSON.stringify(templateObj || defaultProject));
        save();
    }

    // 🌳 Build Hierarchical Tree for Explorer
    function buildTree() {
        const root = { name: '', isFolder: true, children: {} };

        for (const filePath of Object.keys(files)) {
            const parts = filePath.split('/');
            let curr = root;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLast = i === parts.length - 1;

                if (isLast) {
                    curr.children[part] = {
                        name: part,
                        path: filePath,
                        isFolder: false
                    };
                } else {
                    if (!curr.children[part]) {
                        curr.children[part] = {
                            name: part,
                            path: parts.slice(0, i + 1).join('/'),
                            isFolder: true,
                            children: {}
                        };
                    }
                    curr = curr.children[part];
                }
            }
        }
        return root;
    }

    function toggleFolder(folderPath) {
        if (openFolders.has(folderPath)) {
            openFolders.delete(folderPath);
        } else {
            openFolders.add(folderPath);
        }
    }

    // 🌳 Render Nested Folder Tree DOM
    function renderTree(container, activePath, onFileSelect, onContextMenu) {
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
                            <span>${item.name}</span>
                        </div>
                        <div class="tree-actions">
                            <i class="fas fa-plus" title="New File Inside" data-action="new-in-folder" data-path="${item.path}"></i>
                            <i class="fas fa-trash action-del" title="Delete Folder" data-action="del-folder" data-path="${item.path}"></i>
                        </div>
                    `;

                    row.addEventListener('click', (e) => {
                        if (e.target.closest('.tree-actions')) return;
                        toggleFolder(item.path);
                        renderTree(container, activePath, onFileSelect, onContextMenu);
                    });

                    row.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        if (onContextMenu) onContextMenu(e, item.path, true);
                    });

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
                            <span>${item.name}</span>
                        </div>
                        <div class="tree-actions">
                            <i class="fas fa-pen" title="Rename" data-action="rename" data-path="${item.path}"></i>
                            <i class="fas fa-trash action-del" title="Delete" data-action="delete" data-path="${item.path}"></i>
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

                    li.appendChild(row);
                }

                parentUl.appendChild(li);
            });
        }

        renderNodes(root, container);
    }

    // 📦 ZIP Export with full folder structure
    function exportZip(projectName = "Master_IDE_Ultra_Project") {
        if (typeof JSZip === 'undefined') {
            alert("JSZip not loaded!");
            return;
        }
        const zip = new JSZip();
        for (const filePath of Object.keys(files)) {
            zip.file(filePath, files[filePath].content);
        }
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
        getAllPaths,
        buildTree,
        renderTree,
        resetToTemplate,
        exportZip,
        normalizePath,
        detectType,
        save
    };
})();
