/* ==========================================================================
   Master Web IDE Ultra - Code Snippet Card Exporter (Ray.so / Carbon style)
   ========================================================================== */

const CodeCard = (function () {
    let currentTheme = 'cyberpunk';

    const THEMES = {
        cyberpunk: { name: 'Cyberpunk', bg: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', windowBg: '#0e1118' },
        sunset: { name: 'Sunset Glow', bg: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)', windowBg: '#131118' },
        space: { name: 'Deep Space', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', windowBg: '#0f1019' },
        emerald: { name: 'Emerald', bg: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)', windowBg: '#0d1410' },
        midnight: { name: 'Midnight Dark', bg: 'linear-gradient(135deg, #1f2330 0%, #0d0f14 100%)', windowBg: '#161922' }
    };

    function openModal() {
        let modal = document.getElementById('code-card-modal');
        if (!modal) {
            createModalDOM();
            modal = document.getElementById('code-card-modal');
        }

        renderCardPreview();
        modal.classList.add('active');
        modal.style.display = 'flex';
    }

    function closeModal() {
        const modal = document.getElementById('code-card-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    }

    function setTheme(themeKey) {
        if (THEMES[themeKey]) {
            currentTheme = themeKey;
            renderCardPreview();
        }
    }

    function getCodeSnippet() {
        const cm = EditorController.getCM();
        if (!cm) return '// No active editor';

        let text = cm.getSelection();
        if (!text || text.trim().length === 0) {
            // Take first 10 lines of current file for a clean, non-overflowing card
            const doc = cm.getDoc();
            const lines = [];
            const max = Math.min(doc.lineCount(), 10);
            for (let i = 0; i < max; i++) {
                lines.push(doc.getLine(i));
            }
            text = lines.join('\n');
        }
        return text;
    }

    function renderCardPreview() {
        const previewWrap = document.getElementById('code-card-preview-container');
        if (!previewWrap) return;

        const theme = THEMES[currentTheme] || THEMES.cyberpunk;
        const filename = (typeof App !== 'undefined' && App.getCurrentFile) ? App.getCurrentFile() : 'code.js';
        const codeText = getCodeSnippet();

        const lines = codeText.split('\n');
        const linesHtml = lines.map((l, idx) => `
            <div style="display:flex; gap:10px; line-height:1.45; margin-bottom:2px;">
                <span style="color:rgba(255,255,255,0.25); font-family:var(--font-code); font-size:11px; min-width:18px; text-align:right; user-select:none;">${idx + 1}</span>
                <span style="color:#f8f8f2; font-family:var(--font-code); font-size:11px; word-break:break-all; text-align:left; white-space:pre-wrap;">${IDEUtils.escapeHtml(l || ' ')}</span>
            </div>
        `).join('');

        const pad = window.innerWidth <= 600 ? '14px' : '28px';

        previewWrap.innerHTML = `
            <div id="capture-card-root" style="background:${theme.bg}; padding:${pad}; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,0.6); width:100%; max-width:540px; margin:0 auto; box-sizing:border-box;">
                <div style="background:${theme.windowBg}; border-radius:10px; overflow:hidden; box-shadow:0 15px 40px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.12);">
                    
                    <!-- Mac Window Titlebar -->
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:rgba(0,0,0,0.3); border-bottom:1px solid rgba(255,255,255,0.06);">
                        <div style="display:flex; gap:6px;">
                            <span style="width:10px; height:10px; border-radius:50%; background:#ff5f56; display:inline-block;"></span>
                            <span style="width:10px; height:10px; border-radius:50%; background:#ffbd2e; display:inline-block;"></span>
                            <span style="width:10px; height:10px; border-radius:50%; background:#27c93f; display:inline-block;"></span>
                        </div>
                        <div style="font-family:var(--font-code); font-size:11px; color:rgba(255,255,255,0.7); font-weight:600;">${IDEUtils.escapeHtml(filename)}</div>
                        <div style="width:36px;"></div>
                    </div>

                    <!-- Code Body (Clean & Scrollbar-Free) -->
                    <div style="padding:14px 16px; overflow:hidden; text-align:left; background:rgba(0,0,0,0.15);">
                        ${linesHtml}
                    </div>

                    <!-- Watermark Footer -->
                    <div style="padding:7px 14px; background:rgba(0,0,0,0.4); border-top:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; font-size:9.5px; color:rgba(255,255,255,0.45); font-family:var(--font-ui);">
                        <span>⚡ Master IDE Ultra</span>
                        <span>Crafted by Prince</span>
                    </div>
                </div>
            </div>
        `;
    }

    async function downloadPng() {
        const root = document.getElementById('capture-card-root');
        if (!root) return;

        App.showToast("Generating high-res image card...", "info");

        // Convert the rendered HTML to canvas using inline SVG ForeignObject
        try {
            const width = root.offsetWidth;
            const height = root.offsetHeight;

            const canvas = document.createElement('canvas');
            canvas.width = width * 2;
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d');
            ctx.scale(2, 2);

            const data = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                    <foreignObject width="100%" height="100%">
                        <div xmlns="http://www.w3.org/1999/xhtml">
                            ${root.outerHTML}
                        </div>
                    </foreignObject>
                </svg>
            `;

            const img = new Image();
            const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            img.onload = function () {
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);

                canvas.toBlob((blob) => {
                    if (blob && typeof saveAs !== 'undefined') {
                        saveAs(blob, `code-${Date.now()}.png`);
                        App.showToast("Code Card downloaded!", "success");
                    } else if (blob) {
                        const dlUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = dlUrl;
                        a.download = `code-${Date.now()}.png`;
                        a.click();
                        URL.revokeObjectURL(dlUrl);
                        App.showToast("Code Card downloaded!", "success");
                    }
                }, 'image/png');
            };

            img.onerror = function () {
                URL.revokeObjectURL(url);
                App.showToast("Browser canvas security policy prevented direct download. You can take a screenshot of the card!", "warn");
            };
            img.src = url;
        } catch (e) {
            console.error("Canvas export error:", e);
            App.showToast("Could not export image directly: " + e.message, "error");
        }
    }

    function createModalDOM() {
        const div = document.createElement('div');
        div.id = 'code-card-modal';
        div.className = 'modal-overlay';
        div.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); display:none; align-items:center; justify-content:center; z-index:300000; padding:16px; box-sizing:border-box;';
        div.innerHTML = `
            <div class="modal-card" style="background:#13161f; border:1px solid var(--border-light); border-radius:14px; width:94%; max-width:540px; padding:16px; text-align:center; box-shadow:0 25px 60px rgba(0,0,0,0.9); position:relative; box-sizing:border-box; margin:auto; max-height:88vh; max-height:88dvh; overflow-y:auto;">
                
                <!-- Header with Title & Close -->
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <div style="font-size:14px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-camera" style="color:var(--accent);"></i> Code Card
                    </div>
                    <button onclick="CodeCard.closeModal()" style="background:transparent; border:none; color:var(--text-muted); font-size:18px; cursor:pointer; padding:4px 8px;"><i class="fas fa-times"></i></button>
                </div>

                <!-- Theme Dots Row -->
                <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid var(--border);">
                    <span style="font-size:11px; color:var(--text-muted); font-weight:600;">Theme:</span>
                    <button onclick="CodeCard.setTheme('cyberpunk')" class="btn-theme-dot" style="background:linear-gradient(135deg, #00f2fe, #4facfe); width:20px; height:20px; border-radius:50%; border:2px solid #fff; cursor:pointer;" title="Cyberpunk"></button>
                    <button onclick="CodeCard.setTheme('sunset')" class="btn-theme-dot" style="background:linear-gradient(135deg, #ff0844, #ffb199); width:20px; height:20px; border-radius:50%; border:1px solid #fff; cursor:pointer;" title="Sunset"></button>
                    <button onclick="CodeCard.setTheme('space')" class="btn-theme-dot" style="background:linear-gradient(135deg, #667eea, #764ba2); width:20px; height:20px; border-radius:50%; border:1px solid #fff; cursor:pointer;" title="Space"></button>
                    <button onclick="CodeCard.setTheme('emerald')" class="btn-theme-dot" style="background:linear-gradient(135deg, #0ba360, #3cba92); width:20px; height:20px; border-radius:50%; border:1px solid #fff; cursor:pointer;" title="Emerald"></button>
                    <button onclick="CodeCard.setTheme('midnight')" class="btn-theme-dot" style="background:#161922; width:20px; height:20px; border-radius:50%; border:1px solid #fff; cursor:pointer;" title="Midnight"></button>
                </div>

                <!-- Preview Area -->
                <div id="code-card-preview-container" style="margin-bottom:14px; overflow:hidden;"></div>

                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button onclick="CodeCard.closeModal()" class="btn-secondary" style="padding:8px 14px; font-size:12px; border-radius:6px; cursor:pointer;">Cancel</button>
                    <button onclick="CodeCard.downloadPng()" class="btn-primary" style="padding:8px 18px; font-size:12px; border-radius:6px; cursor:pointer;"><i class="fas fa-download"></i> Download PNG</button>
                </div>
            </div>
        `;
        div.onclick = (e) => {
            if (e.target === div) closeModal();
        };
        document.body.appendChild(div);
    }

    return {
        openModal,
        closeModal,
        setTheme,
        downloadPng
    };
})();
