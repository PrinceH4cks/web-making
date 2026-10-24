/* ==========================================================================
   Master Web IDE Ultra - In-App Mobile & Desktop Element Inspector
   ========================================================================== */

const Inspector = (function () {
    let isActive = false;
    let selectedData = null;
    let activeTab = 'styles'; // 'styles' | 'box-model' | 'html'
    const previewFrameId = 'pc-preview-frame';

    function init() {
        window.addEventListener('message', (e) => {
            if (!e.data || e.data.source !== 'IDE_INSPECTOR') return;

            if (e.data.type === 'ELEMENT_SELECTED') {
                selectedData = e.data.data;
                openDrawer();
                render();
            }
        });
    }

    function toggle() {
        isActive = !isActive;
        const icon = document.getElementById('icon-inspect');
        if (icon) icon.classList.toggle('inspector-active', isActive);

        const drawer = document.getElementById('inspector-drawer');
        if (drawer && !isActive) {
            drawer.classList.remove('active');
        }

        // Send enable/disable signal to preview iframe
        notifyIframe({ action: isActive ? 'ENABLE' : 'DISABLE' });

        if (isActive) {
            App.showToast("Inspector Active: Tap any element in the preview to inspect!", "info");
        }
    }

    function notifyIframe(msg) {
        const frame = document.getElementById(previewFrameId);
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({
                source: 'IDE_INSPECTOR_HOST',
                ...msg
            }, '*');
        }
    }

    function openDrawer() {
        const drawer = document.getElementById('inspector-drawer');
        if (drawer) drawer.classList.add('active');
    }

    function closeDrawer() {
        const drawer = document.getElementById('inspector-drawer');
        if (drawer) drawer.classList.remove('active');
        if (isActive) toggle(); // disable inspector
    }

    function setTab(tab) {
        activeTab = tab;
        document.querySelectorAll('.inspector-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        render();
    }

    function render() {
        if (!selectedData) return;

        // Render Badge & Breadcrumbs
        const badge = document.getElementById('inspector-badge');
        const breadcrumbs = document.getElementById('inspector-breadcrumbs');

        let selector = selectedData.tagName;
        if (selectedData.id) selector += `#${selectedData.id}`;
        if (selectedData.className && typeof selectedData.className === 'string') {
            const firstClass = selectedData.className.trim().split(/\s+/)[0];
            if (firstClass) selector += `.${firstClass}`;
        }

        if (badge) badge.innerText = `<${selector}>`;
        if (breadcrumbs) breadcrumbs.innerText = selectedData.hierarchy || selector;

        // Render Tab content
        const body = document.getElementById('inspector-tab-content');
        if (!body) return;

        if (activeTab === 'styles') {
            renderStylesTab(body);
        } else if (activeTab === 'box-model') {
            renderBoxModelTab(body);
        } else if (activeTab === 'html') {
            renderHtmlTab(body);
        }
    }

    function renderStylesTab(container) {
        const comp = selectedData.computed || {};
        const props = [
            { key: 'color', label: 'Color', val: comp.color, isColor: true },
            { key: 'backgroundColor', label: 'Background', val: comp.backgroundColor, isColor: true },
            { key: 'fontSize', label: 'Font Size', val: comp.fontSize },
            { key: 'fontFamily', label: 'Font Family', val: comp.fontFamily },
            { key: 'display', label: 'Display', val: comp.display },
            { key: 'padding', label: 'Padding', val: comp.padding },
            { key: 'margin', label: 'Margin', val: comp.margin },
            { key: 'borderRadius', label: 'Border Radius', val: comp.borderRadius },
            { key: 'border', label: 'Border', val: comp.border },
            { key: 'width', label: 'Width', val: comp.width },
            { key: 'height', label: 'Height', val: comp.height }
        ];

        let html = `<div class="inspector-props-grid">`;
        props.forEach(p => {
            let colorDot = '';
            if (p.isColor && p.val && p.val !== 'transparent' && p.val !== 'rgba(0, 0, 0, 0)') {
                colorDot = `<span class="inspector-color-dot" style="background-color:${p.val};"></span>`;
            }
            html += `
                <div class="inspector-prop-card">
                    <span class="inspector-prop-name">${p.label}</span>
                    <div class="inspector-prop-val-row">
                        ${colorDot}
                        <input class="inspector-prop-input" value="${IDEUtils.escapeHtml(p.val || 'none')}" 
                            data-prop="${p.key}"
                            onchange="Inspector.applyLiveStyle('${p.key}', this.value)"
                            title="Click to live-edit style">
                    </div>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
    }

    function renderBoxModelTab(container) {
        const c = selectedData.computed || {};
        container.innerHTML = `
            <div class="inspector-box-model">
                <div class="box-margin">
                    <span class="box-label">Margin: ${IDEUtils.escapeHtml(c.margin || '0')}</span>
                    <div class="box-border">
                        <span class="box-label">Border: ${IDEUtils.escapeHtml(c.border || 'none')}</span>
                        <div class="box-padding">
                            <span class="box-label">Padding: ${IDEUtils.escapeHtml(c.padding || '0')}</span>
                            <div class="box-content">
                                ${IDEUtils.escapeHtml(c.width || '-')} × ${IDEUtils.escapeHtml(c.height || '-')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderHtmlTab(container) {
        container.innerHTML = `
            <div class="inspector-html-preview"><code>${IDEUtils.escapeHtml(selectedData.outerHTML || '<element />')}</code></div>
        `;
    }

    function applyLiveStyle(prop, value) {
        notifyIframe({
            action: 'APPLY_STYLE',
            prop: prop,
            value: value
        });
    }

    // 🎯 JUMP TO SOURCE IN CODEMIRROR
    function jumpToCode() {
        if (!selectedData) return;
        const cm = EditorController.getCM();
        if (!cm) return;

        let query = '';
        if (selectedData.id) {
            query = `id="${selectedData.id}"`;
        } else if (selectedData.className && typeof selectedData.className === 'string') {
            const firstClass = selectedData.className.trim().split(/\s+/)[0];
            if (firstClass) query = `class="${firstClass}"`;
        }

        if (!query) {
            query = `<${selectedData.tagName}`;
        }

        // Switch to code view if on mobile
        if (window.innerWidth <= 768 && App.setMobileView) {
            App.setMobileView('code');
        }

        // Search in current editor document
        const cursor = cm.getSearchCursor ? cm.getSearchCursor(query) : null;
        if (cursor && cursor.findNext()) {
            cm.setSelection(cursor.from(), cursor.to());
            cm.scrollIntoView({ from: cursor.from(), to: cursor.to() }, 100);
            App.showToast(`Found line ${cursor.from().line + 1}!`, "success");
        } else {
            // Check in other files
            App.showToast(`Looking for '${query}' in current file...`, "info");
        }
    }

    return {
        init,
        toggle,
        closeDrawer,
        setTab,
        applyLiveStyle,
        jumpToCode,
        isActive: () => isActive
    };
})();
