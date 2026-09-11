/* ==========================================================================
   Master Web IDE Ultra - DevTools Console & REPL Engine
   ========================================================================== */

const ConsoleController = (function() {
    let logs = [];
    let currentFilter = 'all';
    let previewFrameId = 'pc-preview-frame';

    function init() {
        window.addEventListener('message', (e) => {
            if (e.data && e.data.source === 'IDE_CONSOLE') {
                addLog(e.data);
            }
        });
    }

    function addLog(data) {
        logs.push(data);
        updateCounters();
        render();
    }

    function updateCounters() {
        const errs = logs.filter(l => l.level === 'error').length;
        const warns = logs.filter(l => l.level === 'warn').length;

        const errBadge = document.getElementById('console-err-count');
        const warnBadge = document.getElementById('console-warn-count');
        const sbErrBadge = document.getElementById('sb-err-badge');

        if (errBadge) errBadge.innerText = errs;
        if (warnBadge) warnBadge.innerText = warns;
        if (sbErrBadge) {
            sbErrBadge.innerText = `${errs} errors`;
            sbErrBadge.style.color = errs > 0 ? 'var(--danger)' : 'var(--text-muted)';
        }
    }

    function render() {
        const container = document.getElementById('console-body');
        if (!container) return;

        let filtered = logs;
        if (currentFilter === 'error') filtered = logs.filter(l => l.level === 'error');
        if (currentFilter === 'warn') filtered = logs.filter(l => l.level === 'warn');
        if (currentFilter === 'log') filtered = logs.filter(l => l.level === 'log' || l.level === 'info');
        if (currentFilter === 'table') filtered = logs.filter(l => l.isTable);

        if (filtered.length === 0) {
            container.innerHTML = `<div style="color:var(--text-faint); padding:10px; font-size:11px;">No logs to display for filter "${currentFilter}".</div>`;
            return;
        }

        container.innerHTML = filtered.map(item => {
            if (item.isTable && item.tableData) {
                return renderTableEntry(item);
            }

            let fixBtn = '';
            if (item.level === 'error') {
                const safeMsg = encodeURIComponent(item.message);
                fixBtn = `<button class="btn-ai-fix" onclick="AIAgent.fixError(decodeURIComponent('${safeMsg}'))"><i class="fas fa-wand-magic-sparkles"></i> Fix with AI</button>`;
            }

            return `
                <div class="console-entry ${item.level}">
                    <span class="console-time">${item.time || ''}</span>
                    <span class="console-icon"><i class="${icon}"></i></span>
                    <span class="console-text">${escapeHtml(item.message)} ${fixBtn}</span>
                </div>
            `;
        }).join('');

        container.scrollTop = container.scrollHeight;
    }

    function renderTableEntry(item) {
        const data = item.tableData;
        let html = `
            <div class="console-entry log">
                <span class="console-time">${item.time || ''}</span>
                <span class="console-icon"><i class="fas fa-table" style="color:var(--accent);"></i></span>
                <div class="console-text">
        `;

        if (Array.isArray(data)) {
            if (data.length === 0) {
                html += `<div>(empty array)</div>`;
            } else {
                const keys = Array.from(new Set(data.flatMap(row => (typeof row === 'object' && row !== null) ? Object.keys(row) : ['Value'])));
                html += `
                    <div class="console-table-container">
                        <table class="console-table">
                            <thead>
                                <tr>
                                    <th>(index)</th>
                                    ${keys.map(k => `<th>${escapeHtml(k)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${data.map((row, idx) => {
                                    return `
                                        <tr>
                                            <td style="color:var(--text-faint);">${idx}</td>
                                            ${keys.map(k => {
                                                const val = (typeof row === 'object' && row !== null) ? row[k] : row;
                                                return `<td>${escapeHtml(String(val !== undefined ? val : ''))}</td>`;
                                            }).join('')}
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        } else if (typeof data === 'object' && data !== null) {
            html += `
                <div class="console-table-container">
                    <table class="console-table">
                        <thead>
                            <tr><th>(index)</th><th>Value</th></tr>
                        </thead>
                        <tbody>
                            ${Object.entries(data).map(([k, v]) => `
                                <tr>
                                    <td style="color:var(--text-faint);">${escapeHtml(k)}</td>
                                    <td>${escapeHtml(String(v))}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        html += `</div></div>`;
        return html;
    }

    function clear() {
        logs = [];
        updateCounters();
        render();
    }

    function setFilter(filterType) {
        currentFilter = filterType;
        document.querySelectorAll('.console-tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.console-tab-btn[data-filter="${filterType}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        render();
    }

    function evalCommand(cmd) {
        if (!cmd) return;

        addLog({
            source: 'IDE_CONSOLE',
            level: 'info',
            message: '> ' + cmd,
            time: new Date().toLocaleTimeString()
        });

        try {
            const frame = document.getElementById(previewFrameId);
            if (!frame || !frame.contentWindow) throw new Error("Preview frame not ready");
            const result = frame.contentWindow.eval(cmd);
            addLog({
                source: 'IDE_CONSOLE',
                level: 'log',
                message: '< ' + (result !== undefined ? String(result) : 'undefined'),
                time: new Date().toLocaleTimeString()
            });
        } catch (err) {
            addLog({
                source: 'IDE_CONSOLE',
                level: 'error',
                message: err.message,
                time: new Date().toLocaleTimeString()
            });
        }
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    return {
        init,
        addLog,
        clear,
        setFilter,
        evalCommand,
        setPreviewFrameId: (id) => { previewFrameId = id; }
    };
})();
