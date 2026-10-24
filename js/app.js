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
        if (typeof APIHub !== 'undefined') APIHub.init();
        if (typeof Inspector !== 'undefined') Inspector.init();
        if (typeof ColorPickerEngine !== 'undefined') ColorPickerEngine.init();
        if (typeof Checkpoints !== 'undefined') Checkpoints.init();

        // 2. Restore persisted workspace preferences
        //    (theme, font size, tabs, panel states, split ratio, device size...)
        //    Everything below survives a page refresh / reopening the site later.
        const p = IDEPrefs.get();

        // Theme is also pre-applied by the inline <head> script (no flash of light theme)
        document.body.setAttribute('data-theme', p.theme);

        // Editor preferences (stored inside the editor module, applied on init)
        EditorController.setFontSize(p.fontSize);
        EditorController.setTabSize(p.tabSize);

        const delayInput = document.getElementById('delay-input');
        if (delayInput) delayInput.value = p.previewDelay;

        // Layout preferences
        isPreviewVisible = p.previewVisible !== false;
        isVerticalSplit = !!p.verticalSplit;
        currentMobileView = p.mobileView || 'code';

        // 3. Restore the tab list (sanitized against the real VFS contents)
        const savedTabs = Array.isArray(p.openTabs) ? p.openTabs : null;
        openTabs = (savedTabs && savedTabs.length ? savedTabs : ["index.html", "css/style.css", "js/main.js"])
            .filter(path => VFS.get(path));

        if (openTabs.length === 0) {
            openTabs = VFS.getAllPaths().slice(0, 3);
        }

        const savedActive = (p.activeFile && VFS.get(p.activeFile)) ? p.activeFile : null;
        currentFile = savedActive || openTabs[0] || null;

        if (!currentFile) {
            const firstHtml = VFS.getAllPaths().find(path => path.endsWith('.html'));
            if (firstHtml) {
                currentFile = firstHtml;
                openTabs.unshift(firstHtml);
            }
        }

        // 4. Initialize Editor
        EditorController.init("editor-container", {
            value: (currentFile && VFS.get(currentFile)) ? VFS.get(currentFile).content : "",
            mode: currentFile ? VFS.detectType(currentFile) : "htmlmixed",
            theme: codeMirrorThemeFor(p.theme),
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

        // 5. Render Initial UI Elements
        renderExplorer();
        renderTabs();
        initSplitResizer();
        initContextMenu();
        initFloatingWindow();
        initMobileListeners();
        updateStatusBar();

        // 6. Restore panel / layout states
        restoreLayoutState(p);

        // 7. Initial Mobile View state
        if (window.innerWidth <= 768) {
            setMobileView(currentMobileView);
        }

        // 8. Initial Preview Load
        setTimeout(() => {
            updatePreview();
            EditorController.refresh();
        }, 150);

        // 9. Global Keyboard Shortcuts & Window Resize
        window.addEventListener('keydown', handleGlobalKeydown);
        window.addEventListener('resize', handleWindowResize);
    }

    /** Re-applies every saved layout state (panels, split ratio, device size...). */
    function restoreLayoutState(p) {
        // Console drawer
        const drawer = document.getElementById('console-drawer');
        const consoleIcon = document.getElementById('console-toggle-icon');
        if (drawer) {
            drawer.classList.toggle('collapsed', !p.consoleOpen);
            if (consoleIcon) {
                consoleIcon.className = p.consoleOpen ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
            }
        }

        // Sidebar (desktop only — on mobile it is an overlay)
        if (window.innerWidth > 768) {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar) {
                sidebar.classList.toggle('active', p.sidebarOpen !== false);
                if (overlay) overlay.classList.toggle('active', p.sidebarOpen !== false);
            }
        }

        // Split orientation + ratio
        const splitArea = document.getElementById('split-work-area');
        if (splitArea) splitArea.classList.toggle('vertical-split', isVerticalSplit);
        applySplitRatio(p.splitRatio);

        // Preview pane visibility
        applyPreviewVisibility();

        // Floating / fullscreen preview
        if (p.floatingPreview) {
            setTimeout(() => {
                toggleFloat();
                if (p.previewFloatPos && typeof p.previewFloatPos.left === 'number') {
                    const pane = document.getElementById('pc-preview-pane');
                    if (pane) {
                        pane.style.left = p.previewFloatPos.left + 'px';
                        pane.style.top = p.previewFloatPos.top + 'px';
                    }
                }
                if (p.fullscreenPreview) toggleFullscreen();
            }, 120);
        }

        // Responsive device preview
        if (p.deviceSize && p.deviceSize !== 'responsive') {
            setTimeout(() => setDeviceSize(p.deviceSize), 100);
        }

        // AI Agent panel
        if (p.aiPanelOpen && typeof AIAgent !== 'undefined') {
            setTimeout(() => AIAgent.togglePanel(true), 100);
        }
    }

    /** Applies the editor/preview split ratio (percent for the editor pane). */
    function applySplitRatio(ratio) {
        const editorSec = document.getElementById('editor-section');
        const previewSec = document.getElementById('pc-preview-pane');
        if (!editorSec || !previewSec) return;

        // Mobile layout: each pane takes 100% full width and height
        if (window.innerWidth <= 768) {
            editorSec.style.setProperty('flex', '1 1 100%', 'important');
            editorSec.style.width = '100%';
            editorSec.style.maxWidth = '100%';
            editorSec.style.height = '100%';
            previewSec.style.setProperty('flex', '1 1 100%', 'important');
            previewSec.style.width = '100%';
            previewSec.style.maxWidth = '100%';
            previewSec.style.height = '100%';
            return;
        }

        let pct = parseFloat(ratio);
        if (isNaN(pct)) pct = 50;
        if (pct < 10) pct = 10;
        if (pct > 90) pct = 90;

        if (!isPreviewVisible || previewSec.classList.contains('floating')) {
            editorSec.style.setProperty('flex', '1 1 100%', 'important');
            editorSec.style.width = '100%';
            editorSec.style.maxWidth = '100%';
            previewSec.style.flex = '';
            previewSec.style.width = '';
            return;
        }

        editorSec.style.maxWidth = '';
        if (isVerticalSplit) {
            editorSec.style.setProperty('flex', `0 0 ${pct}%`, 'important');
            editorSec.style.height = `${pct}%`;
            editorSec.style.width = '100%';
            previewSec.style.setProperty('flex', `1 1 ${100 - pct}%`, 'important');
            previewSec.style.height = `${100 - pct}%`;
            previewSec.style.width = '100%';
        } else {
            editorSec.style.setProperty('flex', `0 0 ${pct}%`, 'important');
            editorSec.style.width = `${pct}%`;
            editorSec.style.height = '';
            previewSec.style.setProperty('flex', `1 1 ${100 - pct}%`, 'important');
            previewSec.style.width = `${100 - pct}%`;
            previewSec.style.height = '';
        }
    }

    /** Maps a UI theme name to its CodeMirror counterpart. */
    function codeMirrorThemeFor(themeName) {
        switch (themeName) {
            case 'onedark': return 'material-darker';
            case 'nightowl': return 'nord';
            case 'monokai': return 'monokai';
            case 'cyberpunk': return 'dracula';
            default: return 'dracula';
        }
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
        IDEPrefs.set('mobileView', view);
        const splitArea = document.getElementById('split-work-area');
        if (!splitArea) return;

        // Reset classes
        splitArea.classList.remove('show-view-code', 'show-view-preview', 'show-view-console');
        splitArea.classList.add(`show-view-${view}`);

        if (window.innerWidth <= 768) {
            applySplitRatio();
        }

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
            applySplitRatio();
            setMobileView(currentMobileView);
        } else {
            const splitArea = document.getElementById('split-work-area');
            if (splitArea) {
                splitArea.classList.remove('show-view-code', 'show-view-preview', 'show-view-console');
            }
            // FIX: do not force-reopen a preview pane the user had closed
            applyPreviewVisibility();
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
        }, {
            // Hover action buttons (new file / rename / delete)
            onNewFile: (folderPath) => openNewFileModal(folderPath),
            onRename: (path) => openRenameModal(path),
            onDelete: (path) => deletePath(path)
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
                <span>${IDEUtils.escapeHtml(fileName)}</span>
                <i class="fas fa-times close-tab" title="Close Tab"></i>
            `;

            tab.addEventListener('click', () => switchTab(path));

            const closeBtn = tab.querySelector('.close-tab');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeTab(path);
                });
            }

            container.appendChild(tab);
        });
    }

    function openFile(path) {
        if (!openTabs.includes(path)) {
            openTabs.push(path);
        }
        switchTab(path);
    }

    /** Persists the tab strip + active file so a refresh restores them exactly. */
    function persistTabState() {
        IDEPrefs.setMany({
            openTabs: openTabs.slice(),
            activeFile: currentFile
        });
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
        if (typeof ColorPickerEngine !== 'undefined') setTimeout(ColorPickerEngine.scan, 100);
        persistTabState();
    }

    function closeTab(path) {
        openTabs = openTabs.filter(p => p !== path);
        if (openTabs.length === 0) {
            currentFile = null;
            EditorController.setContent("", "text");
        } else if (currentFile === path) {
            switchTab(openTabs[openTabs.length - 1]);
            return;
        } else {
            renderTabs();
        }
        persistTabState();
    }

    // 🖥️ LIVE PREVIEW
    function updatePreview() {
        const html = Bundler.bundle();
        const pcFrame = document.getElementById('pc-preview-frame');
        if (pcFrame) pcFrame.srcdoc = html;

        const mobileFrame = document.getElementById('mobile-preview-frame');
        if (mobileFrame) {
            const modal = document.getElementById('mobile-preview-modal');
            if (modal && modal.style.display === 'flex') mobileFrame.srcdoc = html;
        }
    }

    /** Single source of truth for the preview pane visibility. */
    function applyPreviewVisibility() {
        const pane = document.getElementById('pc-preview-pane');
        const gutter = document.getElementById('split-gutter');
        const editorSec = document.getElementById('editor-section');
        const splitArea = document.getElementById('split-work-area');
        const toggleBtn = document.getElementById('toggle-preview-btn');

        if (splitArea) {
            splitArea.classList.toggle('preview-hidden', !isPreviewVisible);
        }

        if (pane) pane.style.display = isPreviewVisible ? 'flex' : 'none';
        if (gutter) gutter.style.display = isPreviewVisible ? 'flex' : 'none';

        if (toggleBtn) {
            toggleBtn.classList.toggle('active', isPreviewVisible);
        }

        if (editorSec) {
            if (!isPreviewVisible) {
                // When preview is cut/closed, expand editor to 100% full width
                editorSec.style.flex = '1 1 100%';
                editorSec.style.width = '100%';
                editorSec.style.maxWidth = '100%';
            } else {
                editorSec.style.width = '';
                editorSec.style.maxWidth = '';
                const p = (typeof IDEPrefs !== 'undefined' && IDEPrefs.get()) || {};
                const savedRatio = p.splitRatio || 50;
                applySplitRatio(savedRatio);
            }
        }

        if (typeof EditorController !== 'undefined' && EditorController.refresh) {
            setTimeout(() => EditorController.refresh(), 50);
        }
    }

    function togglePreview() {
        if (window.innerWidth <= 768) {
            setMobileView(currentMobileView === 'preview' ? 'code' : 'preview');
            return;
        }

        // FIX: was checking `pane.style.display === 'none'`, but the initial
        // state comes from CSS (inline style was empty) -> the first click
        // HID the preview instead of showing it.
        isPreviewVisible = !isPreviewVisible;
        applyPreviewVisibility();
        IDEPrefs.set('previewVisible', isPreviewVisible);

        if (isPreviewVisible) updatePreview();
        setTimeout(() => EditorController.refresh(), 50);
    }

    function setDeviceSize(type) {
        const wrapper = document.getElementById('device-wrapper');
        if (!wrapper) return;

        wrapper.className = `iframe-device-wrapper ${type}`;
        document.querySelectorAll('.preview-tools i[id^="icon-"]').forEach(i => i.classList.remove('active'));
        const activeIcon = document.getElementById(`icon-${type}`);
        if (activeIcon) activeIcon.classList.add('active');
        IDEPrefs.set('deviceSize', type);
    }

    function openPreviewInNewTab() {
        const html = Bundler.bundle();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Release the blob URL again (memory hygiene)
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    // 📊 STATUS BAR
    function updateStatusBar() {
        updateStatusBarCursor(EditorController.getCM() ? EditorController.getCM().getCursor() : { line: 0, ch: 0 });

        const content = EditorController.getValue();
        const bytes = new Blob([content]).size;
        const sizeEl = document.getElementById('file-size-status');
        if (sizeEl) {
            sizeEl.innerText = IDEUtils.formatBytes(bytes);
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

    // 🪟 MODALS & DIALOGS ENGINE
    function openModal(id) {
        closeMobileMenu();
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            modal.style.opacity = '1';
            modal.style.zIndex = '200000';
        }
        if (id === 'packages-modal' && typeof PackageManager !== 'undefined') {
            PackageManager.renderModalGrid('package-grid-container');
        } else if (id === 'templates-modal') {
            renderTemplatesModal();
        }
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
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

        folder = VFS.normalizePath(folder);
        if (!folder) return showToast("Folder name cannot be empty", "error");
        if (VFS.get(folder) || VFS.hasFolder(folder)) {
            return showToast("Folder already exists!", "error");
        }

        // FIX: used to create a stray "README.md" placeholder file.
        // The VFS now supports genuinely empty folders.
        VFS.addFolder(folder);
        closeModal('new-folder-modal');
        renderExplorer();
        showToast(`Folder "${folder}" created!`, "success");
    }

    /** Opens the rename dialog pre-filled with the given path. */
    function openRenameModal(path) {
        contextTarget = path;
        const renameInput = document.getElementById('rename-input');
        if (renameInput) renameInput.value = path;
        openModal('rename-modal');
        setTimeout(() => renameInput && renameInput.focus(), 50);
    }

    /** Deletes a file or a whole folder (with descendants) and cleans up tabs. */
    function deletePath(path) {
        if (!path) return;
        if (!confirm(`Delete "${path}"?`)) return;

        VFS.remove(path);

        openTabs = openTabs.filter(p => p !== path && !p.startsWith(path + '/'));
        if (currentFile === path || (currentFile && currentFile.startsWith(path + '/'))) {
            currentFile = openTabs[0] || null;
            if (currentFile) {
                switchTab(currentFile);
            } else {
                EditorController.setContent("", "text");
            }
        }

        renderExplorer();
        renderTabs();
        updatePreview();
        persistTabState();
        showToast(`Deleted ${path}`, "info");
    }

    function confirmRename() {
        const input = document.getElementById('rename-input');
        let newName = input ? input.value.trim() : '';
        if (!newName || !contextTarget) {
            closeModal('rename-modal');
            return;
        }

        const oldPath = contextTarget;

        if (VFS.rename(oldPath, newName)) {
            // Rename the tab itself + every tab living inside a renamed folder
            openTabs = openTabs.map(p => {
                if (p === oldPath) return newName;
                if (p.startsWith(oldPath + '/')) return newName + p.slice(oldPath.length);
                return p;
            });
            if (currentFile === oldPath) currentFile = newName;
            else if (currentFile && currentFile.startsWith(oldPath + '/')) {
                currentFile = newName + currentFile.slice(oldPath.length);
            }

            closeModal('rename-modal');
            renderExplorer();
            renderTabs();
            if (currentFile) switchTab(currentFile);
            updatePreview();
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
            // The whole project changed -> drop stale AI conversation context
            if (typeof AIAgent !== 'undefined' && AIAgent.resetContext) AIAgent.resetContext();
            closeModal('templates-modal');
            renderExplorer();
            renderTabs();
            switchTab(currentFile);
            updatePreview();
            persistTabState();
            showToast(`Loaded ${TEMPLATES[key].name}!`, "success");
        }
    }

    function resetProject() {
        closeMobileMenu();
        if (confirm("Reset entire project back to initial clean state?")) {
            VFS.resetToTemplate();
            openTabs = ["index.html", "css/style.css", "js/main.js"];
            currentFile = "index.html";
            if (typeof AIAgent !== 'undefined' && AIAgent.resetContext) AIAgent.resetContext();
            renderExplorer();
            renderTabs();
            switchTab("index.html");
            updatePreview();
            persistTabState();
            showToast("Workspace reset to default", "info");
        }
    }

    // ⚙️ STUDIO SETTINGS (reads the persisted preferences into the modal)
    function openSettings() {
        const p = IDEPrefs.get();

        const themeSelect = document.querySelector('#settings-modal select');
        if (themeSelect) themeSelect.value = p.theme;

        const fontInput = document.getElementById('font-size-input');
        if (fontInput) fontInput.value = p.fontSize;

        const tabInput = document.getElementById('tab-size-input');
        if (tabInput) tabInput.value = p.tabSize;

        const wrapSelect = document.getElementById('line-wrapping-select');
        if (wrapSelect) wrapSelect.value = String(!!p.lineWrapping);

        const delayInput = document.getElementById('delay-input');
        if (delayInput) delayInput.value = p.previewDelay;

        openModal('settings-modal');
    }

    /** Live-preview debounce (ms) — persisted so it survives a refresh. */
    function setPreviewDelay(ms) {
        const value = parseInt(ms, 10);
        const delay = isNaN(value) ? 400 : Math.min(2000, Math.max(100, value));
        IDEPrefs.set('previewDelay', delay);
        const input = document.getElementById('delay-input');
        if (input) input.value = delay;
    }

    /** Restores every appearance preference to its factory default. */
    function resetAppearance() {
        const d = IDEPrefs.DEFAULTS;
        IDEPrefs.setMany({
            theme: d.theme,
            fontSize: d.fontSize,
            tabSize: d.tabSize,
            lineWrapping: d.lineWrapping,
            previewDelay: d.previewDelay
        });
        setTheme(d.theme);
        EditorController.setFontSize(d.fontSize);
        EditorController.setTabSize(d.tabSize);
        EditorController.setLineWrapping(d.lineWrapping);
        setPreviewDelay(d.previewDelay);
        openSettings();
        showToast("Appearance settings reset to defaults", "info");
    }

    // 🧹 DATA PRIVACY — wipe EVERYTHING stored on this device
    // Useful when a shared computer/browser profile is used by more than one person.
    function clearAllLocalData() {
        if (!confirm(
            "Erase ALL data stored by Master Web IDE Ultra on this device?\n\n" +
            "• Project files (VFS)\n" +
            "• AI API key & provider settings\n" +
            "• AI chat history\n\n" +
            "This cannot be undone. Export a ZIP backup first if you need your work."
        )) return;

        const keys = [
            'master_ide_ultra_vfs',
            'master_ide_ai_config',
            'master_ide_ai_chat',
            'master_ide_ai_models',
            'master_ide_ai_stats',
            'master_ide_api_hub',
            'master_ide_api_usage',
            'master_ide_api_hub_chat',
            'master_ide_prefs'
        ];
        keys.forEach(k => {
            try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ }
        });

        // Cancel any pending debounced write so it cannot re-persist the erased data
        if (VFS.cancelPendingSave) VFS.cancelPendingSave();
        if (IDEPrefs.cancelPendingSave) IDEPrefs.cancelPendingSave();
        if (IDEPrefs.clear) IDEPrefs.clear();
        if (typeof AIModelRouter !== 'undefined' && AIModelRouter.clearAll) AIModelRouter.clearAll();
        if (typeof APIHub !== 'undefined' && APIHub.forget) APIHub.forgetAll();

        showToast("All local data erased. Reloading...", "success");
        setTimeout(() => window.location.reload(), 600);
    }

    // 🎨 THEME ENGINE
    function setTheme(themeName) {
        document.body.setAttribute('data-theme', themeName);
        EditorController.setTheme(codeMirrorThemeFor(themeName));
        IDEPrefs.set('theme', themeName);
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
                openRenameModal(path);
            };
        }

        const delItem = document.getElementById('ctx-delete');
        if (delItem) {
            delItem.onclick = () => {
                deletePath(path);
            };
        }
    }

    // ↔️ SPLIT RESIZER (Ultra-smooth Pointer Engine with setPointerCapture)
    function initSplitResizer() {
        const gutter = document.getElementById('split-gutter');
        const splitArea = document.getElementById('split-work-area');
        const editorSec = document.getElementById('editor-section');
        const previewSec = document.getElementById('pc-preview-pane');
        const previewFrame = document.getElementById('pc-preview-frame');
        if (!gutter || !splitArea || !editorSec || !previewSec) return;

        let isResizing = false;
        let activePointerId = null;
        let rafId = null;

        function startDrag(e) {
            if (window.innerWidth <= 768) return;
            // Only allow main button (left click) or touch
            if (e.button !== undefined && e.button !== 0) return;

            isResizing = true;
            gutter.classList.add('dragging');
            document.body.classList.add('is-resizing-splitter');
            if (isVerticalSplit) {
                document.body.classList.add('is-resizing-vertical');
            }

            if (previewFrame) previewFrame.style.pointerEvents = 'none';

            if (e.pointerId !== undefined && gutter.setPointerCapture) {
                try {
                    gutter.setPointerCapture(e.pointerId);
                    activePointerId = e.pointerId;
                } catch (err) {}
            }

            gutter.addEventListener('pointermove', onPointerMove);
            gutter.addEventListener('pointerup', stopDrag);
            gutter.addEventListener('pointercancel', stopDrag);

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', stopDrag);
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', stopDrag);

            e.preventDefault();
        }

        function onPointerMove(e) {
            if (!isResizing) return;
            queueMove(e.clientX, e.clientY);
        }

        function onMouseMove(e) {
            if (!isResizing) return;
            queueMove(e.clientX, e.clientY);
        }

        function onTouchMove(e) {
            if (!isResizing) return;
            if (e.touches && e.touches.length > 0) {
                e.preventDefault();
                queueMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }

        function queueMove(clientX, clientY) {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const rect = splitArea.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;

                let pct;
                if (isVerticalSplit) {
                    const pointerY = clientY - rect.top;
                    pct = (pointerY / rect.height) * 100;
                } else {
                    const pointerX = clientX - rect.left;
                    pct = (pointerX / rect.width) * 100;
                }

                if (pct < 10) pct = 10;
                if (pct > 90) pct = 90;

                applySplitRatio(pct);
            });
        }

        function stopDrag(e) {
            if (!isResizing) return;
            isResizing = false;
            if (rafId) cancelAnimationFrame(rafId);

            gutter.classList.remove('dragging');
            document.body.classList.remove('is-resizing-splitter', 'is-resizing-vertical');

            if (previewFrame) previewFrame.style.pointerEvents = '';

            if (activePointerId !== null && gutter.releasePointerCapture) {
                try {
                    gutter.releasePointerCapture(activePointerId);
                } catch (err) {}
                activePointerId = null;
            }

            gutter.removeEventListener('pointermove', onPointerMove);
            gutter.removeEventListener('pointerup', stopDrag);
            gutter.removeEventListener('pointercancel', stopDrag);

            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', stopDrag);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', stopDrag);

            // Refresh CodeMirror layout once drag finishes
            if (typeof EditorController !== 'undefined' && EditorController.refresh) {
                EditorController.refresh();
            }

            // Persist the new pane ratio so it survives a refresh
            const pct = parseFloat((editorSec.style.flex || '').replace(/[^0-9.]/g, ''));
            if (!isNaN(pct) && pct >= 10 && pct <= 90) {
                IDEPrefs.set('splitRatio', pct);
            }
        }

        gutter.addEventListener('pointerdown', startDrag);
        gutter.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length > 0) {
                startDrag(e);
            }
        }, { passive: false });
    }

    function toggleSplitOrientation() {
        const splitArea = document.getElementById('split-work-area');
        if (!splitArea) return;
        isVerticalSplit = !isVerticalSplit;
        splitArea.classList.toggle('vertical-split', isVerticalSplit);
        IDEPrefs.set('verticalSplit', isVerticalSplit);
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
                // Persist the floating window position
                IDEPrefs.set('previewFloatPos', {
                    left: parseFloat(pane.style.left) || 0,
                    top: parseFloat(pane.style.top) || 0
                });
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
            if (gutter) gutter.style.display = isPreviewVisible ? 'flex' : 'none';
            const savedRatio = (typeof IDEPrefs !== 'undefined' && IDEPrefs.get('splitRatio')) || 50;
            applySplitRatio(savedRatio);
            IDEPrefs.setMany({ floatingPreview: false, previewFloatPos: null });
        } else {
            const rect = pane.getBoundingClientRect();
            // FIX: absolute coordinates must be relative to the positioned
            // ancestor (.studio-body), not the viewport.
            const host = document.querySelector('.studio-body');
            const hostRect = host ? host.getBoundingClientRect() : { left: 0, top: 0 };
            pane.style.left = `${Math.max(0, rect.left - hostRect.left)}px`;
            pane.style.top = `${Math.max(0, rect.top - hostRect.top)}px`;
            pane.classList.add('floating');
            if (icon) icon.classList.add('active');
            if (gutter) gutter.style.display = 'none';
            const editorSec = document.getElementById('editor-section');
            if (editorSec) {
                editorSec.style.flex = '1 1 100%';
                editorSec.style.width = '100%';
                editorSec.style.maxWidth = '100%';
            }
            IDEPrefs.setMany({
                floatingPreview: true,
                previewFloatPos: { left: parseFloat(pane.style.left) || 0, top: parseFloat(pane.style.top) || 0 }
            });
        }
        setTimeout(() => EditorController.refresh(), 100);
    }

    function toggleFullscreen() {
        if (window.innerWidth <= 768) {
            openMobilePreview();
            return;
        }

        const pane = document.getElementById('pc-preview-pane');
        const icon = document.getElementById('icon-fullscreen');
        if (!pane) return;

        if (!pane.classList.contains('floating') && window.innerWidth > 768) toggleFloat();
        pane.classList.toggle('fullscreen');
        const isFull = pane.classList.contains('fullscreen');
        if (icon) icon.classList.toggle('active', isFull);
        IDEPrefs.set('fullscreenPreview', isFull);
    }

    // 📱 FULLSCREEN MOBILE PREVIEW MODAL
    function openMobilePreview() {
        const modal = document.getElementById('mobile-preview-modal');
        const frame = document.getElementById('mobile-preview-frame');
        if (!modal || !frame) return;
        frame.srcdoc = Bundler.bundle();
        modal.style.display = 'flex';
    }

    function closeMobilePreview() {
        const modal = document.getElementById('mobile-preview-modal');
        if (modal) modal.style.display = 'none';
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
        const isOpen = !drawer.classList.contains('collapsed');
        if (!isOpen) {
            if (icon) icon.className = 'fas fa-chevron-up';
        } else {
            if (icon) icon.className = 'fas fa-chevron-down';
            if (window.innerWidth > 768 && !('ontouchstart' in window)) {
                setTimeout(() => document.getElementById('console-eval-input')?.focus(), 80);
            }
        }
        IDEPrefs.set('consoleOpen', isOpen);
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

        toast.innerHTML = `<i class="${icon}"></i> <span>${IDEUtils.escapeHtml(message)}</span>`;
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
        document.body.classList.toggle('sidebar-open', sidebar.classList.contains('active'));
        IDEPrefs.set('sidebarOpen', sidebar.classList.contains('active'));
    }

    function handleGlobalKeydown(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            toggleSidebar();
        } else if (e.ctrlKey && e.key === '`') {
            e.preventDefault();
            toggleConsole();
        } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
            // FIX: Ctrl+Shift+A is CodeMirror's "select all" while editing.
            // Only hijack it when the editor has no active selection.
            const inEditor = e.target && e.target.closest && e.target.closest('.CodeMirror');
            const cm = EditorController.getCM();
            const hasSelection = !!(cm && cm.somethingSelected());
            if (inEditor && hasSelection) return;

            e.preventDefault();
            if (typeof AIAgent !== 'undefined') AIAgent.togglePanel();
        }
    }

    return {
        init,
        getCurrentFile: () => currentFile,
        openFile,
        renderExplorer,
        renderTabs,
        updatePreview,
        togglePreview,
        setDeviceSize,
        openPreviewInNewTab,
        openModal,
        closeModal,
        openNewFileModal,
        openNewFolderModal,
        openRenameModal,
        deletePath,
        confirmCreateFile,
        confirmCreateFolder,
        confirmRename,
        loadTemplate,
        resetProject,
        clearAllLocalData,
        setTheme,
        toggleSplitOrientation,
        toggleFloat,
        toggleFullscreen,
        openSettings,
        setPreviewDelay,
        resetAppearance,
        openMobilePreview,
        closeMobilePreview,
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
