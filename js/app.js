/* ==========================================================================
   Master Web IDE Ultra - Core Application Coordinator (Responsive & Adaptive)
   ========================================================================== */

const App = (function() {
    let currentFile = "index.html";
    let openTabs = ["index.html", "css/style.css", "js/main.js"];
    let previewTimer = null;
    let isPreviewVisible = true;
    let isVerticalSplit = false;
    let currentMobileView = 'code'; // 'code', 'preview', 'console'
    let contextTarget = null;

    function init() {
        // 1. Initialize Console, Palette & AI Agent
        ConsoleController.init();
        CommandPalette.init();
        if (typeof AIAgent !== 'undefined') AIAgent.init();

        // 2. Initialize Editor
        EditorController.init("editor-container", {
            value: VFS.get(currentFile) ? VFS.get(currentFile).content : "",
            mode: VFS.detectType(currentFile),
            theme: "dracula",
            onChange: onEditorChange,
            onCursorActivity: updateStatusBarCursor,
            onSave: () => {
                saveCurrentFile();
                showToast("Saved & Live Preview Updated!", "success");
            },
            onRun: () => {
                updatePreview();
                showToast("Live Output Reloaded!", "info");
            }
        });

        // 3. Render Initial UI Elements
        renderExplorer();
        renderTabs();
        initSplitResizer();
        initContextMenu();
        initFloatingWindow();
        initMobileListeners();
        updateStatusBar();

        // 4. Initial Mobile View state
        if (window.innerWidth <= 768) {
            setMobileView('code');
        }

        // 5. Initial Preview Load
        setTimeout(() => {
            updatePreview();
            EditorController.refresh();
        }, 150);

        // 6. Global Keyboard Shortcuts & Window Resize
        window.addEventListener('keydown', handleGlobalKeydown);
        window.addEventListener('resize', handleWindowResize);
    }

    function onEditorChange(value) {
        if (!currentFile || !VFS.get(currentFile)) return;
        
        setSaveStatus(false);
        VFS.set(currentFile, value);
        updateStatusBar();

        clearTimeout(previewTimer);
        const delay = parseInt(document.getElementById('delay-input')?.value) || 400;
        previewTimer = setTimeout(() => {
            setSaveStatus(true);
            if (isPreviewVisible) updatePreview();
        }, delay);
    }

    function setSaveStatus(isSaved) {
        const dot = document.getElementById('save-dot');
        const text = document.getElementById('save-status-text');
        if (dot && text) {
            if (isSaved) {
                dot.classList.remove('saving');
                text.innerText = "Saved";
            } else {
                dot.classList.add('saving');
                text.innerText = "Saving...";
            }
        }
    }

    function saveCurrentFile() {
        if (!currentFile) return;
        VFS.set(currentFile, EditorController.getValue());
        setSaveStatus(true);
        updatePreview();
    }

    // 📱 MOBILE VIEW SWITCHER (Code / Preview / Console)
    function setMobileView(view) {
        currentMobileView = view;
        const splitArea = document.getElementById('split-work-area');
        if (!splitArea) return;

        // Reset classes
        splitArea.classList.remove('show-view-code', 'show-view-preview', 'show-view-console');
        splitArea.classList.add(`show-view-${view}`);

        // Update button states
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-view-${view}`);
        if (activeBtn) activeBtn.classList.add('active');

        // Close mobile actions menu if open
        closeMobileMenu();

        if (view === 'preview') {
            updatePreview();
        } else if (view === 'code') {
            setTimeout(() => EditorController.refresh(), 50);
        } else if (view === 'console') {
            // Expand console drawer if needed
            const drawer = document.getElementById('console-drawer');
            if (drawer && drawer.classList.contains('collapsed')) {
                toggleConsole();
            }
        }
    }

    function toggleMobileMenu() {
        const menu = document.getElementById('mobile-actions-menu');
        if (menu) menu.classList.toggle('active');
    }

    function closeMobileMenu() {
        const menu = document.getElementById('mobile-actions-menu');
        if (menu) menu.classList.remove('active');
    }

    function initMobileListeners() {
        window.addEventListener('click', (e) => {
            if (!e.target.closest('.mobile-more-btn') && !e.target.closest('.mobile-actions-menu')) {
                closeMobileMenu();
            }
        });
    }

    function handleWindowResize() {
        if (window.innerWidth <= 768) {
            setMobileView(currentMobileView);
        } else {
            const splitArea = document.getElementById('split-work-area');
            if (splitArea) {
                splitArea.classList.remove('show-view-code', 'show-view-preview', 'show-view-console');
            }
            const pane = document.getElementById('pc-preview-pane');
            const gutter = document.getElementById('split-gutter');
            if (pane) pane.style.display = 'flex';
            if (gutter) gutter.style.display = 'flex';
        }
        EditorController.refresh();
    }

    // 🌳 EXPLORER TREE
    function renderExplorer() {
        const container = document.getElementById('file-tree');
        if (!container) return;

        VFS.renderTree(container, currentFile, (path) => {
            openFile(path);
            if (window.innerWidth <= 768) toggleSidebar(false);
        }, (e, path, isFolder) => {
            showContextMenu(e, path, isFolder);
        });
    }

    // 📑 TABS
    function renderTabs() {
        const container = document.getElementById('tabs-container');
        if (!container) return;
        container.innerHTML = '';

        openTabs.forEach(path => {
            const tab = document.createElement('div');
            tab.className = `tab ${path === currentFile ? 'active' : ''}`;
            const icon = VFS.getIconClass ? VFS.getIconClass(path) : 'fas fa-file-code';
            const fileName = path.split('/').pop();

            tab.innerHTML = `
                <i class="${icon}"></i>
                <span>${fileName}</span>
                <i class="fas fa-times close-tab" title="Close Tab"></i>
            `;

            tab.addEventListener('click', () => switchTab(path));
            tab.querySelector('.close-tab').addEventListener('click', (e) => {
                e.stopPropagation();
                closeTab(path);
            });

            container.appendChild(tab);
        });
    }

    function openFile(path) {
        if (!openTabs.includes(path)) {
            openTabs.push(path);
        }
        switchTab(path);
    }

    function switchTab(path) {
        const file = VFS.get(path);
        if (!file) return;

        currentFile = path;
        EditorController.setContent(file.content, VFS.detectType(path));
        renderExplorer();
        renderTabs();
        updateStatusBar();
        EditorController.refresh();
    }

    function closeTab(path) {
        openTabs = openTabs.filter(p => p !== path);
        if (openTabs.length === 0) {
            currentFile = null;
            EditorController.setContent("", "text");
        } else if (currentFile === path) {
            switchTab(openTabs[openTabs.length - 1]);
        } else {
            renderTabs();
        }
    }

    // 🖥️ LIVE PREVIEW
    function updatePreview() {
        const html = Bundler.bundle();
        const pcFrame = document.getElementById('pc-preview-frame');
        if (pcFrame) pcFrame.srcdoc = html;

        const mobileFrame = document.getElementById('mobile-preview-frame');
        if (mobileFrame && mobileFrame.parentElement.style.display === 'flex') {
            mobileFrame.srcdoc = html;
        }
    }

    function togglePreview() {
        if (window.innerWidth <= 768) {
            setMobileView(currentMobileView === 'preview' ? 'code' : 'preview');
            return;
        }

        const pane = document.getElementById('pc-preview-pane');
        const gutter = document.getElementById('split-gutter');
        if (!pane) return;

        if (pane.style.display === 'none') {
            pane.style.display = 'flex';
            if (gutter) gutter.style.display = 'flex';
            isPreviewVisible = true;
            updatePreview();
        } else {
            pane.style.display = 'none';
            if (gutter) gutter.style.display = 'none';
            isPreviewVisible = false;
        }
        setTimeout(() => EditorController.refresh(), 50);
    }

    function setDeviceSize(type) {
        const wrapper = document.getElementById('device-wrapper');
        if (!wrapper) return;

        wrapper.className = `iframe-device-wrapper ${type}`;
        document.querySelectorAll('.preview-tools i[id^="icon-"]').forEach(i => i.classList.remove('active'));
        const activeIcon = document.getElementById(`icon-${type}`);
        if (activeIcon) activeIcon.classList.add('active');
    }

    function openPreviewInNewTab() {
        const html = Bundler.bundle();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    // 📊 STATUS BAR
    function updateStatusBar() {
        updateStatusBarCursor(EditorController.getCM() ? EditorController.getCM().getCursor() : { line: 0, ch: 0 });
        
        const content = EditorController.getValue();
        const bytes = new Blob([content]).size;
        const sizeEl = document.getElementById('file-size-status');
        if (sizeEl) {
            sizeEl.innerText = bytes > 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes + ' B';
        }

        const langEl = document.getElementById('lang-indicator');
        if (langEl && currentFile) {
            langEl.innerText = currentFile.split('.').pop().toUpperCase();
        }
    }

    function updateStatusBarCursor(cursor) {
        const posEl = document.getElementById('cursor-pos');
        if (posEl && cursor) {
            posEl.innerText = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
        }
    }

    // 🪟 MODALS & DIALOGS
    function openModal(id) {
        closeMobileMenu();
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('active');
        if (id === 'packages-modal') {
            PackageManager.renderModalGrid('package-grid-container');
        } else if (id === 'templates-modal') {
            renderTemplatesModal();
        }
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
    }

    function openNewFileModal(folderPrefix = '') {
        closeMobileMenu();
        const input = document.getElementById('new-filename-input');
        if (input) {
            input.value = folderPrefix ? (folderPrefix.endsWith('/') ? folderPrefix : folderPrefix + '/') : '';
            openModal('new-file-modal');
            setTimeout(() => input.focus(), 50);
        }
    }

    function openNewFolderModal() {
        closeMobileMenu();
        const input = document.getElementById('new-foldername-input');
        if (input) {
            input.value = '';
            openModal('new-folder-modal');
            setTimeout(() => input.focus(), 50);
        }
    }

    function confirmCreateFile() {
        const input = document.getElementById('new-filename-input');
        let name = input ? input.value.trim() : '';
        if (!name) return showToast("File name cannot be empty", "error");

        if (VFS.get(name)) return showToast("File already exists!", "error");

        VFS.set(name, name.endsWith('.html') ? '<!DOCTYPE html>\n<html>\n<head></head>\n<body>\n  \n</body>\n</html>' : '');
        closeModal('new-file-modal');
        renderExplorer();
        openFile(name);
        showToast(`Created ${name}`, "success");
    }

    function confirmCreateFolder() {
        const input = document.getElementById('new-foldername-input');
        let folder = input ? input.value.trim() : '';
        if (!folder) return showToast("Folder name cannot be empty", "error");

        folder = folder.replace(/^\/+|\/+$/g, '');
        const dummyFile = `${folder}/README.md`;
        VFS.set(dummyFile, `# ${folder} Folder\nCreated in Master IDE Ultra.`);
        closeModal('new-folder-modal');
        renderExplorer();
        showToast(`Folder "${folder}" created!`, "success");
    }

    function confirmRename() {
        const input = document.getElementById('rename-input');
        let newName = input ? input.value.trim() : '';
        if (!newName || !contextTarget) {
            closeModal('rename-modal');
            return;
        }

        if (VFS.rename(contextTarget, newName)) {
            const idx = openTabs.indexOf(contextTarget);
            if (idx !== -1) openTabs[idx] = newName;
            if (currentFile === contextTarget) currentFile = newName;

            closeModal('rename-modal');
            renderExplorer();
            renderTabs();
            showToast(`Renamed to ${newName}`, "success");
        } else {
            showToast("Rename failed or target exists", "error");
        }
    }

    // 🌟 TEMPLATES MODAL
    function renderTemplatesModal() {
        const container = document.getElementById('template-grid-container');
        if (!container) return;

        container.innerHTML = Object.entries(TEMPLATES).map(([key, t]) => `
            <div class="template-card" onclick="App.loadTemplate('${key}')">
                <i class="${t.icon}"></i>
                <h4>${t.name}</h4>
                <p>${t.desc}</p>
            </div>
        `).join('');
    }

    function loadTemplate(key) {
        if (!TEMPLATES[key]) return;
        if (confirm(`Load "${TEMPLATES[key].name}" template? Current workspace files will be replaced.`)) {
            VFS.resetToTemplate(TEMPLATES[key].files);
            openTabs = Object.keys(TEMPLATES[key].files).slice(0, 3);
            currentFile = openTabs[0];
            closeModal('templates-modal');
            renderExplorer();
            renderTabs();
            switchTab(currentFile);
            updatePreview();
            showToast(`Loaded ${TEMPLATES[key].name}!`, "success");
        }
    }

    function resetProject() {
        closeMobileMenu();
        if (confirm("Reset entire project back to initial clean state?")) {
            VFS.resetToTemplate();
            openTabs = ["index.html", "css/style.css", "js/main.js"];
            currentFile = "index.html";
            renderExplorer();
            renderTabs();
            switchTab("index.html");
            updatePreview();
            showToast("Workspace reset to default", "info");
        }
    }

    // 🎨 THEME ENGINE
    function setTheme(themeName) {
        document.body.setAttribute('data-theme', themeName);
        let cmTheme = "dracula";
        if (themeName === "onedark") cmTheme = "material-darker";
        if (themeName === "nightowl") cmTheme = "nord";
        if (themeName === "monokai") cmTheme = "monokai";
        if (themeName === "cyberpunk") cmTheme = "dracula";

        EditorController.setTheme(cmTheme);
        showToast(`Switched theme to ${themeName}`, "info");
    }

    // 🖱️ RIGHT-CLICK CONTEXT MENU
    function initContextMenu() {
        const menu = document.getElementById('context-menu');
        window.addEventListener('click', () => {
            if (menu) menu.style.display = 'none';
        });
    }

    function showContextMenu(e, path, isFolder) {
        const menu = document.getElementById('context-menu');
        if (!menu) return;

        contextTarget = path;
        menu.style.display = 'block';
        menu.style.left = `${Math.min(e.clientX, window.innerWidth - 180)}px`;
        menu.style.top = `${Math.min(e.clientY, window.innerHeight - 150)}px`;

        const newFileItem = document.getElementById('ctx-new-file');
        if (newFileItem) {
            newFileItem.onclick = () => {
                openNewFileModal(isFolder ? path : '');
            };
        }

        const renameItem = document.getElementById('ctx-rename');
        if (renameItem) {
            renameItem.onclick = () => {
                const renameInput = document.getElementById('rename-input');
                if (renameInput) renameInput.value = path;
                openModal('rename-modal');
                setTimeout(() => renameInput.focus(), 50);
            };
        }

        const delItem = document.getElementById('ctx-delete');
        if (delItem) {
            delItem.onclick = () => {
                if (confirm(`Delete "${path}"?`)) {
                    VFS.remove(path);
                    openTabs = openTabs.filter(p => p !== path);
                    if (currentFile === path) {
                        currentFile = openTabs[0] || null;
                        if (currentFile) switchTab(currentFile);
                        else EditorController.setContent("", "text");
                    }
                    renderExplorer();
                    renderTabs();
                    updatePreview();
                    showToast(`Deleted ${path}`, "info");
                }
            };
        }
    }

    // ↔️ SPLIT RESIZER
    function initSplitResizer() {
        const gutter = document.getElementById('split-gutter');
        const splitArea = document.getElementById('split-work-area');
        const editorSec = document.getElementById('editor-section');
        const previewSec = document.getElementById('pc-preview-pane');
        if (!gutter || !splitArea) return;

        let isResizing = false;

        gutter.addEventListener('mousedown', () => {
            if (window.innerWidth <= 768) return;
            isResizing = true;
            gutter.classList.add('dragging');
            document.getElementById('pc-preview-frame').style.pointerEvents = 'none';
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', stopDrag);
        });

        function onDrag(e) {
            if (!isResizing) return;
            const rect = splitArea.getBoundingClientRect();

            if (isVerticalSplit) {
                const pointerY = e.clientY - rect.top;
                let pct = (pointerY / rect.height) * 100;
                if (pct < 15) pct = 15;
                if (pct > 85) pct = 85;
                editorSec.style.flex = `0 0 ${pct}%`;
                previewSec.style.flex = `1 1 ${100 - pct}%`;
            } else {
                const pointerX = e.clientX - rect.left;
                let pct = (pointerX / rect.width) * 100;
                if (pct < 15) pct = 15;
                if (pct > 85) pct = 85;
                editorSec.style.flex = `0 0 ${pct}%`;
                previewSec.style.flex = `1 1 ${100 - pct}%`;
            }
            EditorController.refresh();
        }

        function stopDrag() {
            isResizing = false;
            gutter.classList.remove('dragging');
            document.getElementById('pc-preview-frame').style.pointerEvents = 'auto';
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
            EditorController.refresh();
        }
    }

    function toggleSplitOrientation() {
        const splitArea = document.getElementById('split-work-area');
        if (!splitArea) return;
        isVerticalSplit = !isVerticalSplit;
        splitArea.classList.toggle('vertical-split', isVerticalSplit);
        EditorController.refresh();
        showToast(isVerticalSplit ? "Vertical Split Enabled" : "Horizontal Split Enabled", "info");
    }

    // 🚀 FLOATING WINDOW CONTROLS
    function initFloatingWindow() {
        const pane = document.getElementById('pc-preview-pane');
        const header = document.getElementById('pc-preview-header');
        if (!pane || !header) return;

        let isDragging = false, startX, startY, initLeft, initTop;

        header.addEventListener('mousedown', (e) => {
            if (window.innerWidth <= 768) return;
            if (!pane.classList.contains('floating') || pane.classList.contains('fullscreen')) return;
            if (e.target.tagName === 'I') return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initLeft = pane.offsetLeft;
            initTop = pane.offsetTop;
            document.getElementById('pc-preview-frame').style.pointerEvents = 'none';

            function onMove(ev) {
                if (!isDragging) return;
                let newLeft = initLeft + ev.clientX - startX;
                let newTop = initTop + ev.clientY - startY;
                if (newTop < 0) newTop = 0;
                pane.style.left = `${newLeft}px`;
                pane.style.top = `${newTop}px`;
            }

            function onUp() {
                isDragging = false;
                document.getElementById('pc-preview-frame').style.pointerEvents = 'auto';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function toggleFloat() {
        if (window.innerWidth <= 768) return;
        const pane = document.getElementById('pc-preview-pane');
        const icon = document.getElementById('icon-float');
        const gutter = document.getElementById('split-gutter');
        if (!pane) return;

        if (pane.classList.contains('fullscreen')) toggleFullscreen();

        if (pane.classList.contains('floating')) {
            pane.classList.remove('floating');
            pane.style.left = ''; pane.style.top = ''; pane.style.width = ''; pane.style.height = '';
            if (icon) icon.classList.remove('active');
            if (gutter) gutter.style.display = 'flex';
        } else {
            const rect = pane.getBoundingClientRect();
            pane.style.left = `${rect.left}px`;
            pane.style.top = `${rect.top}px`;
            pane.classList.add('floating');
            if (icon) icon.classList.add('active');
            if (gutter) gutter.style.display = 'none';
        }
        setTimeout(() => EditorController.refresh(), 100);
    }

    function toggleFullscreen() {
        const pane = document.getElementById('pc-preview-pane');
        const icon = document.getElementById('icon-fullscreen');
        if (!pane) return;

        if (!pane.classList.contains('floating') && window.innerWidth > 768) toggleFloat();
        pane.classList.toggle('fullscreen');
        if (icon) icon.classList.toggle('active', pane.classList.contains('fullscreen'));
    }

    // 📟 CONSOLE DRAWER TOGGLE
    function toggleConsole() {
        if (window.innerWidth <= 768) {
            setMobileView(currentMobileView === 'console' ? 'code' : 'console');
            return;
        }

        const drawer = document.getElementById('console-drawer');
        const icon = document.getElementById('console-toggle-icon');
        if (!drawer) return;

        drawer.classList.toggle('collapsed');
        if (drawer.classList.contains('collapsed')) {
            if (icon) icon.className = 'fas fa-chevron-up';
        } else {
            if (icon) icon.className = 'fas fa-chevron-down';
            setTimeout(() => document.getElementById('console-eval-input')?.focus(), 80);
        }
        setTimeout(() => EditorController.refresh(), 200);
    }

    // 🍞 TOAST NOTIFICATIONS
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'fas fa-info-circle';
        if (type === 'success') icon = 'fas fa-check-circle';
        if (type === 'error') icon = 'fas fa-triangle-exclamation';

        toast.innerHTML = `<i class="${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        }, 2800);
    }

    function toggleSidebar(forceOpen) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (!sidebar) return;

        if (forceOpen === undefined) {
            sidebar.classList.toggle('active');
            if (overlay) overlay.classList.toggle('active', sidebar.classList.contains('active'));
        } else {
            sidebar.classList.toggle('active', forceOpen);
            if (overlay) overlay.classList.toggle('active', forceOpen);
        }
    }

    function handleGlobalKeydown(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            toggleSidebar();
        } else if (e.ctrlKey && e.key === '`') {
            e.preventDefault();
            toggleConsole();
        } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            if (typeof AIAgent !== 'undefined') AIAgent.togglePanel();
        }
    }

    return {
        init,
        getCurrentFile: () => currentFile,
        openFile,
        updatePreview,
        togglePreview,
        setDeviceSize,
        openPreviewInNewTab,
        openModal,
        closeModal,
        openNewFileModal,
        openNewFolderModal,
        confirmCreateFile,
        confirmCreateFolder,
        confirmRename,
        loadTemplate,
        resetProject,
        setTheme,
        toggleSplitOrientation,
        toggleFloat,
        toggleFullscreen,
        toggleConsole,
        toggleSidebar,
        toggleAIAgent: () => { if (typeof AIAgent !== 'undefined') AIAgent.togglePanel(); },
        setMobileView,
        toggleMobileMenu,
        closeMobileMenu,
        showToast
    };
})();

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
