/* ==========================================================================
   Master Web IDE Ultra - QR Code PC-to-Phone Bridge
   ========================================================================== */

const QRBridge = (function () {
    const defaultWifiUrl = 'http://10.41.236.195:8000/';

    function getTargetUrl() {
        // If current window is on IP address, use current origin
        if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            return window.location.origin + window.location.pathname;
        }
        return defaultWifiUrl;
    }

    function openModal() {
        let modal = document.getElementById('qr-bridge-modal');
        if (!modal) {
            createModal();
            modal = document.getElementById('qr-bridge-modal');
        }

        const url = getTargetUrl();
        const input = document.getElementById('qr-url-input');
        if (input) input.value = url;

        // Render QR Code using Google Chart API fallback + inline dynamic SVG
        const img = document.getElementById('qr-image-display');
        if (img) {
            img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&bgcolor=141720&color=00f2fe`;
        }

        modal.classList.add('active');
        modal.style.display = 'flex';
    }

    function closeModal() {
        const modal = document.getElementById('qr-bridge-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    }

    function copyUrl() {
        const url = getTargetUrl();
        navigator.clipboard.writeText(url).then(() => {
            App.showToast("URL Copied! Open this in your phone's browser.", "success");
        }).catch(() => {
            App.showToast(`URL: ${url}`, "info");
        });
    }

    function createModal() {
        const div = document.createElement('div');
        div.id = 'qr-bridge-modal';
        div.className = 'modal-overlay';
        div.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); display:none; align-items:center; justify-content:center; z-index:300000; padding:16px; box-sizing:border-box;';
        div.innerHTML = `
            <div class="modal-card" style="background:#13161f; border:1px solid var(--border-light); border-radius:14px; width:92%; max-width:390px; padding:22px; text-align:center; box-shadow:0 25px 60px rgba(0,0,0,0.9); position:relative; margin:auto; box-sizing:border-box;">
                <button onclick="QRBridge.closeModal()" style="position:absolute; top:12px; right:12px; background:transparent; border:none; color:var(--text-muted); font-size:18px; cursor:pointer; padding:4px 8px;"><i class="fas fa-times"></i></button>
                
                <div style="font-size:30px; color:var(--accent); margin-bottom:8px;"><i class="fas fa-qrcode"></i></div>
                <h3 style="font-size:16px; font-weight:700; color:#fff; margin-bottom:6px;">Test Live on Your Phone</h3>
                <p style="font-size:11.5px; color:var(--text-muted); margin-bottom:16px; line-height:1.45;">
                    Apne phone ke camera ya Google Lens se scan karein aur website ko phone me live chalate huye dekhein!
                </p>

                <div style="background:#0c0e14; padding:12px; border-radius:12px; display:inline-block; border:1px solid var(--border); margin-bottom:16px;">
                    <img id="qr-image-display" src="" alt="QR Code" width="180" height="180" style="display:block; border-radius:6px;">
                </div>

                <div style="display:flex; gap:6px; margin-bottom:12px;">
                    <input type="text" id="qr-url-input" readonly style="flex:1; min-width:0; background:#0c0e14; border:1px solid var(--border); color:#fff; font-family:var(--font-code); font-size:11.5px; padding:8px 10px; border-radius:8px; outline:none;">
                    <button onclick="QRBridge.copyUrl()" class="btn-primary" style="padding:0 14px; font-size:12px; border-radius:8px; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:5px;"><i class="fas fa-copy"></i> Copy</button>
                </div>

                <div style="font-size:10.5px; color:var(--text-muted); display:flex; align-items:center; justify-content:center; gap:6px;">
                    <i class="fas fa-wifi"></i> Note: Phone aur PC dono same Wi-Fi / Hotspot se connected hone chahiye.
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
        copyUrl
    };
})();
