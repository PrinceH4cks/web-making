/* ==========================================================================
   Master Web IDE Ultra - Project Checkpoints & Time Machine Engine
   ========================================================================== */

const Checkpoints = (function () {
    const STORAGE_KEY = 'master_ide_checkpoints_v1';
    const MAX_CHECKPOINTS = 15;
    let list = [];

    function init() {
        load();
        // Auto-checkpoint every 12 minutes
        setInterval(() => {
            saveAutoCheckpoint();
        }, 12 * 60 * 1000);
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                list = JSON.parse(raw);
            }
        } catch (e) {
            list = [];
        }
    }

    function persist() {
        try {
            if (list.length > MAX_CHECKPOINTS) {
                list = list.slice(0, MAX_CHECKPOINTS);
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (e) {
            console.warn("Checkpoints storage limit reached:", e);
        }
    }

    function getProjectSnapshot() {
        const files = {};
        const paths = (typeof VFS !== 'undefined' && VFS.getAllPaths) ? VFS.getAllPaths() : [];
        paths.forEach(p => {
            const f = VFS.get(p);
            if (f) files[p] = f.content;
        });
        return files;
    }

    function create(label = '') {
        const files = getProjectSnapshot();
        const fileCount = Object.keys(files).length;
        if (fileCount === 0) return;

        const date = new Date();
        const entry = {
            id: 'cp_' + Date.now(),
            label: label || `Snapshot ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            time: date.toLocaleString(),
            fileCount: fileCount,
            files: files
        };

        list.unshift(entry);
        persist();
        App.showToast(`Checkpoint created: "${entry.label}"`, "success");
        renderList();
    }

    function saveAutoCheckpoint() {
        const files = getProjectSnapshot();
        if (Object.keys(files).length === 0) return;

        const date = new Date();
        const entry = {
            id: 'cp_' + Date.now(),
            label: `Auto-save ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            time: date.toLocaleString(),
            fileCount: Object.keys(files).length,
            files: files,
            isAuto: true
        };

        list.unshift(entry);
        persist();
    }

    function restore(checkpointId) {
        const cp = list.find(c => c.id === checkpointId);
        if (!cp || !cp.files) {
            App.showToast("Checkpoint not found", "error");
            return;
        }

        if (!confirm(`Are you sure you want to restore "${cp.label}"? Your current unsaved edits will be replaced.`)) {
            return;
        }

        // Restore files to VFS
        Object.keys(cp.files).forEach(path => {
            VFS.set(path, cp.files[path]);
        });

        App.renderExplorer();
        const curr = App.getCurrentFile();
        if (curr && cp.files[curr] !== undefined) {
            EditorController.setContent(cp.files[curr], VFS.detectType(curr));
        } else {
            const first = Object.keys(cp.files)[0];
            if (first) App.openFile(first);
        }

        App.updatePreview();
        closeModal();
        App.showToast(`Restored checkpoint "${cp.label}" successfully!`, "success");
    }

    function remove(checkpointId) {
        list = list.filter(c => c.id !== checkpointId);
        persist();
        renderList();
    }

    function openModal() {
        let modal = document.getElementById('checkpoints-modal');
        if (!modal) {
            createModalDOM();
            modal = document.getElementById('checkpoints-modal');
        }

        renderList();
        modal.classList.add('active');
        modal.style.display = 'flex';
    }

    function closeModal() {
        const modal = document.getElementById('checkpoints-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    }

    function renderList() {
        const container = document.getElementById('checkpoints-list-container');
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:30px; color:var(--text-muted); font-size:12px;">
                    <i class="fas fa-history" style="font-size:24px; margin-bottom:8px; display:block; opacity:0.4;"></i>
                    No saved checkpoints yet. Click "+ Save Checkpoint" above to record a project restore point!
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(cp => `
            <div style="background:#151822; border:1px solid var(--border); border-radius:8px; padding:12px 14px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; transition:0.15s;">
                <div>
                    <div style="font-size:12.5px; font-weight:700; color:#fff; display:flex; align-items:center; gap:6px;">
                        <i class="fas ${cp.isAuto ? 'fa-clock' : 'fa-bookmark'}" style="color:${cp.isAuto ? 'var(--text-muted)' : 'var(--accent)'}; font-size:11px;"></i>
                        ${IDEUtils.escapeHtml(cp.label)}
                    </div>
                    <div style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">
                        ${IDEUtils.escapeHtml(cp.time)} · ${cp.fileCount} files
                    </div>
                </div>

                <div style="display:flex; gap:6px;">
                    <button onclick="Checkpoints.restore('${cp.id}')" class="btn-primary" style="padding:4px 10px; font-size:11px; border-radius:5px; cursor:pointer;">
                        <i class="fas fa-rotate-left"></i> Restore
                    </button>
                    <button onclick="Checkpoints.remove('${cp.id}')" style="background:transparent; border:none; color:var(--text-muted); padding:4px 8px; cursor:pointer;" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    function createModalDOM() {
        const div = document.createElement('div');
        div.id = 'checkpoints-modal';
        div.className = 'modal-overlay';
        div.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); display:none; align-items:center; justify-content:center; z-index:300000; padding:16px; box-sizing:border-box;';
        div.innerHTML = `
            <div class="modal-card" style="background:#13161f; border:1px solid var(--border-light); border-radius:14px; width:94%; max-width:520px; padding:20px; box-shadow:0 25px 60px rgba(0,0,0,0.9); position:relative; font-family:var(--font-ui); margin:auto; max-height:86vh; max-height:86dvh; display:flex; flex-direction:column; box-sizing:border-box;">
                <button onclick="Checkpoints.closeModal()" style="position:absolute; top:12px; right:12px; background:transparent; border:none; color:var(--text-muted); font-size:18px; cursor:pointer; padding:4px 8px;"><i class="fas fa-times"></i></button>

                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid var(--border); padding-right:24px;">
                    <div style="font-size:14px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-history" style="color:var(--accent);"></i> Project Checkpoints & Time Machine
                    </div>
                </div>

                <!-- Create checkpoint row -->
                <div style="display:flex; gap:8px; margin-bottom:14px;">
                    <input type="text" id="new-checkpoint-input" placeholder="Checkpoint title (e.g. Before refactoring navbar)..." style="flex:1; min-width:0; background:#0c0e14; border:1px solid var(--border); color:#fff; font-size:12px; padding:9px 12px; border-radius:8px; outline:none;" onkeydown="if(event.key==='Enter'){Checkpoints.create(this.value); this.value='';}">
                    <button onclick="Checkpoints.create(document.getElementById('new-checkpoint-input').value); document.getElementById('new-checkpoint-input').value='';" class="btn-primary" style="padding:0 14px; font-size:12px; border-radius:8px; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:5px;">
                        <i class="fas fa-plus"></i> Save
                    </button>
                </div>

                <!-- List of checkpoints -->
                <div id="checkpoints-list-container" style="max-height:320px; overflow-y:auto; padding-right:4px;"></div>
            </div>
        `;
        div.onclick = (e) => {
            if (e.target === div) closeModal();
        };
        document.body.appendChild(div);
    }

    return {
        init,
        create,
        restore,
        remove,
        openModal,
        closeModal
    };
})();
