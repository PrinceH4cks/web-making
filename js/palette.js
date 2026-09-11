/* ==========================================================================
   Master Web IDE Ultra - Command Palette Engine (Ctrl + Shift + P / F1)
   ========================================================================== */

const CommandPalette = (function() {
    let isOpen = false;
    let selectedIndex = 0;
    let filteredCommands = [];

    const COMMANDS = [
        {
            id: 'format',
            title: 'Format Document',
            icon: 'fas fa-wand-magic-sparkles',
            shortcut: 'Shift + Alt + F',
            action: () => EditorController.formatCode()
        },
        {
            id: 'open-ai-agent',
            title: 'Open AI Agent Studio (Cursor / Composer Mode)',
            icon: 'fas fa-robot',
            shortcut: 'Ctrl + Shift + A',
            action: () => AIAgent.togglePanel(true)
        },
        {
            id: 'config-ai-agent',
            title: 'Configure AI Agent API Key & Model',
            icon: 'fas fa-key',
            shortcut: '',
            action: () => AIAgent.openSettings()
        },
        {
            id: 'run-preview',
            title: 'Run & Refresh Live Preview',
            icon: 'fas fa-play',
            shortcut: 'Ctrl + Enter',
            action: () => App.updatePreview()
        },
        {
            id: 'toggle-console',
            title: 'Toggle Developer Console',
            icon: 'fas fa-terminal',
            shortcut: 'Ctrl + `',
            action: () => App.toggleConsole()
        },
        {
            id: 'add-package',
            title: 'Add CDN Package / Library',
            icon: 'fas fa-box-open',
            shortcut: '',
            action: () => App.openModal('packages-modal')
        },
        {
            id: 'load-template',
            title: 'Load Starter Template',
            icon: 'fas fa-shapes',
            shortcut: '',
            action: () => App.openModal('templates-modal')
        },
        {
            id: 'theme-dracula',
            title: 'Theme: Dracula Pro',
            icon: 'fas fa-palette',
            shortcut: '',
            action: () => App.setTheme('dracula')
        },
        {
            id: 'theme-onedark',
            title: 'Theme: One Dark Pro',
            icon: 'fas fa-palette',
            shortcut: '',
            action: () => App.setTheme('onedark')
        },
        {
            id: 'theme-cyberpunk',
            title: 'Theme: Cyberpunk 2077',
            icon: 'fas fa-palette',
            shortcut: '',
            action: () => App.setTheme('cyberpunk')
        },
        {
            id: 'theme-nightowl',
            title: 'Theme: Night Owl',
            icon: 'fas fa-palette',
            shortcut: '',
            action: () => App.setTheme('nightowl')
        },
        {
            id: 'theme-monokai',
            title: 'Theme: Monokai Pro',
            icon: 'fas fa-palette',
            shortcut: '',
            action: () => App.setTheme('monokai')
        },
        {
            id: 'new-file',
            title: 'Create New File',
            icon: 'fas fa-file-circle-plus',
            shortcut: '',
            action: () => App.openNewFileModal()
        },
        {
            id: 'new-folder',
            title: 'Create New Folder',
            icon: 'fas fa-folder-plus',
            shortcut: '',
            action: () => App.openNewFolderModal()
        },
        {
            id: 'export-zip',
            title: 'Export Project to ZIP',
            icon: 'fas fa-file-zipper',
            shortcut: '',
            action: () => VFS.exportZip()
        },
        {
            id: 'toggle-split',
            title: 'Toggle Split Layout (Vertical / Horizontal)',
            icon: 'fas fa-table-columns',
            shortcut: '',
            action: () => App.toggleSplitOrientation()
        },
        {
            id: 'toggle-sidebar',
            title: 'Toggle Explorer Sidebar',
            icon: 'fas fa-bars',
            shortcut: 'Ctrl + B',
            action: () => App.toggleSidebar()
        },
        {
            id: 'reset-project',
            title: 'Reset Project to Defaults',
            icon: 'fas fa-rotate-left',
            shortcut: '',
            action: () => App.resetProject()
        }
    ];

    function init() {
        const input = document.getElementById('palette-input');
        if (!input) return;

        input.addEventListener('input', (e) => {
            filter(e.target.value);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % filteredCommands.length;
                renderList();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
                renderList();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                executeSelected();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
            }
        });

        // Global Palette Hotkeys: Ctrl + Shift + P or F1
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') || e.key === 'F1') {
                e.preventDefault();
                toggle();
            }
        });
    }

    function toggle() {
        if (isOpen) close();
        else open();
    }

    function open() {
        isOpen = true;
        selectedIndex = 0;
        const overlay = document.getElementById('palette-overlay');
        const input = document.getElementById('palette-input');
        if (overlay) overlay.classList.add('active');
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 50);
        }
        filter('');
    }

    function close() {
        isOpen = false;
        const overlay = document.getElementById('palette-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    function filter(query) {
        const q = query.trim().toLowerCase();
        if (!q) {
            filteredCommands = COMMANDS;
        } else {
            filteredCommands = COMMANDS.filter(cmd => 
                cmd.title.toLowerCase().includes(q) || cmd.id.toLowerCase().includes(q)
            );
        }
        selectedIndex = 0;
        renderList();
    }

    function renderList() {
        const list = document.getElementById('palette-list');
        if (!list) return;

        if (filteredCommands.length === 0) {
            list.innerHTML = `<li style="padding:12px; color:var(--text-faint); text-align:center;">No matching commands found</li>`;
            return;
        }

        list.innerHTML = filteredCommands.map((cmd, idx) => `
            <li class="palette-item ${idx === selectedIndex ? 'active' : ''}" onclick="CommandPalette.selectAndRun(${idx})">
                <div class="item-title">
                    <i class="${cmd.icon}"></i>
                    <span>${cmd.title}</span>
                </div>
                ${cmd.shortcut ? `<kbd>${cmd.shortcut}</kbd>` : ''}
            </li>
        `).join('');

        const activeElem = list.children[selectedIndex];
        if (activeElem) activeElem.scrollIntoView({ block: 'nearest' });
    }

    function executeSelected() {
        if (filteredCommands[selectedIndex]) {
            const cmd = filteredCommands[selectedIndex];
            close();
            cmd.action();
        }
    }

    function selectAndRun(idx) {
        selectedIndex = idx;
        executeSelected();
    }

    return {
        init,
        open,
        close,
        toggle,
        selectAndRun
    };
})();
