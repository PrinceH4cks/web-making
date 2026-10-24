/* ==========================================================================
   Master Web IDE Ultra - Web Materials & Assets Hub (Icons, Photos & UI)
   Click to Copy Code - Paste anywhere in your project!
   ========================================================================== */

const AssetManager = (function () {
    const safeEscape = (str) => (typeof IDEUtils !== 'undefined' && IDEUtils.escapeHtml) ? IDEUtils.escapeHtml(str) : String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let activeTab = 'icons'; // default to icons (most frequently used in web design)
    let currentFilter = 'all';

    const CURATED_PHOTOS = [
        // 👤 AVATARS & USER PROFILES
        {
            title: 'Avatar - Male Developer',
            tag: 'avatar',
            desc: 'Profile photo for team, author or comment cards',
            url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=240&q=80',
            htmlSnippet: '<img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=240&q=80" alt="Developer Avatar" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">'
        },
        {
            title: 'Avatar - Female Designer',
            tag: 'avatar',
            desc: 'Creative UI/UX designer profile avatar',
            url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80',
            htmlSnippet: '<img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80" alt="Designer Avatar" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">'
        },
        {
            title: 'Avatar - Tech Lead',
            tag: 'avatar',
            desc: 'Tech leader or founder avatar image',
            url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=240&q=80',
            htmlSnippet: '<img src="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=240&q=80" alt="Tech Lead Avatar" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">'
        },
        {
            title: 'Avatar - Team Member',
            tag: 'avatar',
            desc: 'Customer support or engineer profile avatar',
            url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=240&q=80',
            htmlSnippet: '<img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=240&q=80" alt="Team Member Avatar" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">'
        },

        // 🛍️ PRODUCTS (E-COMMERCE)
        {
            title: 'Product - Smart Watch',
            tag: 'product',
            desc: 'Minimalist smart watch for product showcase cards',
            url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
            htmlSnippet: '<img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80" alt="Smart Watch" style="width:100%; max-width:320px; border-radius:8px; object-fit:cover;">'
        },
        {
            title: 'Product - Wireless Headphones',
            tag: 'product',
            desc: 'Audio gadget for tech store cards',
            url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
            htmlSnippet: '<img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80" alt="Wireless Headphones" style="width:100%; max-width:320px; border-radius:8px; object-fit:cover;">'
        },
        {
            title: 'Product - Running Shoes',
            tag: 'product',
            desc: 'Sport sneakers for shopping websites',
            url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
            htmlSnippet: '<img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80" alt="Running Shoes" style="width:100%; max-width:320px; border-radius:8px; object-fit:cover;">'
        },
        {
            title: 'Product - Modern Laptop',
            tag: 'product',
            desc: 'Tech laptop workstation product photo',
            url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80',
            htmlSnippet: '<img src="https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80" alt="Laptop" style="width:100%; max-width:320px; border-radius:8px; object-fit:cover;">'
        },

        // 🌌 HERO BANNERS & WEBSITE BACKGROUNDS
        {
            title: 'Hero - Dark Tech Workspace',
            tag: 'hero',
            desc: 'Sleek dark coding workspace hero image',
            url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
            htmlSnippet: '<img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80" alt="Tech Workspace Banner" style="width:100%; height:340px; object-fit:cover; border-radius:12px;">'
        },
        {
            title: 'Hero - Cyber Grid Mesh',
            tag: 'hero',
            desc: 'Modern colorful mesh gradient for landing pages',
            url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80',
            htmlSnippet: '<img src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80" alt="Mesh Gradient Banner" style="width:100%; height:340px; object-fit:cover; border-radius:12px;">'
        },
        {
            title: 'Hero - Server Data Center',
            tag: 'hero',
            desc: 'Cloud servers & IT infrastructure photo',
            url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
            htmlSnippet: '<img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80" alt="Server Infrastructure Banner" style="width:100%; height:340px; object-fit:cover; border-radius:12px;">'
        },
        {
            title: 'Hero - Minimalist Office',
            tag: 'hero',
            desc: 'Modern architectural workspace banner',
            url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
            htmlSnippet: '<img src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80" alt="Office Space Banner" style="width:100%; height:340px; object-fit:cover; border-radius:12px;">'
        }
    ];

    const ICONS_CATALOG = [
        // Navigation & Menu
        { name: 'house', label: 'Home' },
        { name: 'bars', label: 'Menu' },
        { name: 'magnifying-glass', label: 'Search' },
        { name: 'arrow-right', label: 'Next' },
        { name: 'arrow-left', label: 'Back' },
        { name: 'chevron-down', label: 'Dropdown' },
        { name: 'link', label: 'Link' },
        
        // User & Profiles
        { name: 'user', label: 'User' },
        { name: 'users', label: 'Team' },
        { name: 'user-circle', label: 'Profile' },
        { name: 'lock', label: 'Lock' },
        { name: 'key', label: 'Key' },
        { name: 'shield-halved', label: 'Security' },

        // Engagement & Social
        { name: 'heart', label: 'Like' },
        { name: 'star', label: 'Star / Rating' },
        { name: 'thumbs-up', label: 'Thumbs Up' },
        { name: 'share-nodes', label: 'Share' },
        { name: 'comment', label: 'Comment' },
        { name: 'comments', label: 'Chat' },
        { name: 'envelope', label: 'Email' },
        { name: 'phone', label: 'Call' },
        { name: 'bell', label: 'Alert' },
        { name: 'paper-plane', label: 'Send' },

        // E-Commerce
        { name: 'cart-shopping', label: 'Cart' },
        { name: 'bag-shopping', label: 'Shop Bag' },
        { name: 'credit-card', label: 'Card' },
        { name: 'tag', label: 'Discount Tag' },
        { name: 'wallet', label: 'Wallet' },
        { name: 'truck-fast', label: 'Shipping' },

        // Tech & Development
        { name: 'code', label: 'Code' },
        { name: 'laptop-code', label: 'Dev Laptop' },
        { name: 'terminal', label: 'Console' },
        { name: 'database', label: 'Database' },
        { name: 'server', label: 'Server' },
        { name: 'cloud', label: 'Cloud' },
        { name: 'bolt', label: 'Speed' },
        { name: 'fire', label: 'Trending' },
        { name: 'rocket', label: 'Launch' },

        // Media & Utility
        { name: 'play', label: 'Play' },
        { name: 'camera', label: 'Camera' },
        { name: 'image', label: 'Photo' },
        { name: 'gear', label: 'Settings' },
        { name: 'sliders', label: 'Filter' },
        { name: 'trash', label: 'Delete' },
        { name: 'pen', label: 'Edit' },
        { name: 'check', label: 'Done' },
        { name: 'xmark', label: 'Close' },
        { name: 'plus', label: 'Add' },
        { name: 'circle-info', label: 'Info' }
    ];

    const UI_COMPONENTS = [
        {
            title: 'Responsive Navbar Header',
            desc: 'Modern dark navbar with logo and navigation links',
            snippet: `<nav style="display:flex; align-items:center; justify-content:space-between; padding:14px 24px; background:#0f172a; color:#fff; border-bottom:1px solid #1e293b;">\n  <div style="font-weight:700; font-size:18px; display:flex; align-items:center; gap:8px;">\n    <i class="fas fa-bolt" style="color:#00f2fe;"></i> Brand\n  </div>\n  <div style="display:flex; gap:18px; font-size:14px;">\n    <a href="#" style="color:#f8fafc; text-decoration:none; font-weight:500;">Home</a>\n    <a href="#" style="color:#94a3b8; text-decoration:none;">Features</a>\n    <a href="#" style="color:#94a3b8; text-decoration:none;">Contact</a>\n  </div>\n</nav>`
        },
        {
            title: 'Modern Gradient Action Button',
            desc: 'Eye-catching glowing cyan gradient button',
            snippet: `<button style="background:linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); color:#0b0d13; font-weight:700; border:none; padding:10px 22px; border-radius:8px; cursor:pointer; font-size:14px; box-shadow:0 4px 15px rgba(0, 242, 254, 0.35); transition:transform 0.15s ease;">\n  Get Started &rarr;\n</button>`
        },
        {
            title: 'Glassmorphism Feature Card',
            desc: 'Frosted glass UI card with border glow and description',
            snippet: `<div style="background:rgba(255, 255, 255, 0.05); backdrop-filter:blur(12px); border:1px solid rgba(255, 255, 255, 0.12); border-radius:14px; padding:24px; color:#fff; box-shadow:0 10px 30px rgba(0,0,0,0.5); max-width:380px;">\n  <div style="font-size:24px; color:#00f2fe; margin-bottom:12px;"><i class="fas fa-rocket"></i></div>\n  <h3 style="margin-top:0; font-size:1.25rem;">Ultra Performance</h3>\n  <p style="color:rgba(255,255,255,0.7); font-size:0.9rem; line-height:1.5;">Clean, modern and fully responsive component ready to be used in any website.</p>\n</div>`
        },
        {
            title: 'User Testimonial Card with Avatar',
            desc: 'Review card with round user photo, name and star ratings',
            snippet: `<div style="background:#1e293b; border-radius:12px; padding:20px; color:#fff; border:1px solid #334155; max-width:360px;">\n  <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">\n    <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" alt="User" style="width:44px; height:44px; border-radius:50%; object-fit:cover;">\n    <div>\n      <div style="font-weight:600; font-size:14px;">Aarav Sharma</div>\n      <div style="color:#94a3b8; font-size:12px;">Full Stack Developer</div>\n    </div>\n  </div>\n  <div style="color:#fbbf24; font-size:13px; margin-bottom:8px;">\n    <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>\n  </div>\n  <p style="color:#cbd5e1; font-size:13px; line-height:1.5; margin:0;">"This is hands down the best code editor in the browser. Super fast and sleek!"</p>\n</div>`
        },
        {
            title: 'Pill Status Badge / Tag',
            desc: 'Small glowing badge for cards and tables',
            snippet: `<span style="display:inline-flex; align-items:center; gap:6px; background:rgba(0, 242, 254, 0.12); color:#00f2fe; font-size:12px; font-weight:600; padding:4px 10px; border-radius:20px; border:1px solid rgba(0, 242, 254, 0.3);">\n  <span style="width:6px; height:6px; border-radius:50%; background:#00f2fe;"></span> Active\n</span>`
        }
    ];

    function openModal(tab = 'icons') {
        let modal = document.getElementById('assets-modal');
        if (!modal) {
            createModalDOM();
            modal = document.getElementById('assets-modal');
        }
        setTab(tab);
        modal.classList.add('active');
        modal.style.display = 'flex';
    }

    function closeModal() {
        const modal = document.getElementById('assets-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    }

    function setTab(tab) {
        activeTab = tab;
        document.querySelectorAll('.assets-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        const filterRow = document.getElementById('assets-filter-chips');
        if (filterRow) {
            filterRow.style.display = tab === 'photos' ? 'flex' : 'none';
        }

        const searchInput = document.getElementById('assets-search-input');
        if (searchInput) searchInput.value = '';

        renderContent();
    }

    function setFilter(filter) {
        currentFilter = filter;
        document.querySelectorAll('.assets-chip').forEach(c => {
            c.classList.toggle('active', c.dataset.filter === filter);
        });
        renderContent();
    }

    function handleSearch(query) {
        renderContent(query.trim().toLowerCase());
    }

    // 📋 CLIPBOARD COPY (Primary Action requested by user)
    function copySnippet(snippet, title) {
        if (!snippet) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(snippet).then(() => {
                showCopySuccess(title);
            }).catch(() => {
                fallbackCopy(snippet, title);
            });
        } else {
            fallbackCopy(snippet, title);
        }
    }

    function fallbackCopy(text, title) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showCopySuccess(title);
        } catch (e) {
            App.showToast("Could not copy automatically: " + e.message, "error");
        }
    }

    function showCopySuccess(title) {
        App.showToast(`Copied "${title}"! Ab code me jahan chahein Ctrl+V se paste karein.`, "success");
    }

    // ✏️ DIRECT INSERT (Optional secondary action)
    function insertSnippetDirectly(snippet, title) {
        const cm = EditorController.getCM();
        if (!cm) {
            App.showToast("Open an editor tab first!", "error");
            return;
        }

        const doc = cm.getDoc();
        doc.replaceRange(snippet, doc.getCursor());
        closeModal();
        cm.focus();
        App.showToast(`Inserted "${title}" into code!`, "success");
    }

    function renderContent(searchQuery = '') {
        const container = document.getElementById('assets-tab-content');
        if (!container) return;

        if (activeTab === 'icons') {
            let list = ICONS_CATALOG;
            if (searchQuery) {
                list = list.filter(i => i.name.toLowerCase().includes(searchQuery) || i.label.toLowerCase().includes(searchQuery));
            }

            container.innerHTML = `
                <div class="icons-grid">
                    ${list.map(icon => `
                        <div class="icon-item" onclick="AssetManager.copyIconByName('${icon.name}')" title="Click to copy: &lt;i class=&quot;fas fa-${icon.name}&quot;&gt;&lt;/i&gt;">
                            <i class="fas fa-${icon.name}"></i>
                            <span>${icon.name}</span>
                            <div style="font-size:9.5px; color:var(--accent); margin-top:2px; font-weight:600;"><i class="fas fa-copy"></i> Copy</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (activeTab === 'photos') {
            let list = CURATED_PHOTOS;
            if (currentFilter !== 'all') {
                list = list.filter(p => p.tag === currentFilter);
            }
            if (searchQuery) {
                list = list.filter(p => p.title.toLowerCase().includes(searchQuery) || p.desc.toLowerCase().includes(searchQuery));
            }

            container.innerHTML = `
                <div class="photos-grid">
                    ${list.map((p, idx) => `
                        <div class="photo-card" onclick="AssetManager.copyPhotoTag(${idx})">
                            <img src="${p.url}" alt="${p.title}" loading="lazy">
                            <div class="photo-card-footer">${safeEscape(p.title)}</div>
                            <div class="photo-card-overlay">
                                <button class="asset-action-btn primary" onclick="event.stopPropagation(); AssetManager.copyPhotoTag(${idx})">
                                    <i class="fas fa-copy"></i> Copy &lt;img&gt;
                                </button>
                                <button class="asset-action-btn secondary" onclick="event.stopPropagation(); AssetManager.copyPhotoUrlByIndex(${idx})">
                                    <i class="fas fa-link"></i> Copy URL
                                </button>
                                <button class="asset-action-btn secondary" onclick="event.stopPropagation(); AssetManager.insertPhotoDirect(${idx})" title="Insert directly at cursor">
                                    <i class="fas fa-arrow-down"></i> Insert
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (activeTab === 'mock') {
            container.innerHTML = `
                <div class="mock-cards-list">
                    ${UI_COMPONENTS.map((item, idx) => `
                        <div class="mock-card" onclick="AssetManager.copyComponent(${idx})">
                            <div style="flex:1; padding-right:12px;">
                                <div class="mock-card-title">${safeEscape(item.title)}</div>
                                <div class="mock-card-desc">${safeEscape(item.desc)}</div>
                            </div>
                            <div class="asset-actions-row">
                                <button class="asset-action-btn primary" onclick="event.stopPropagation(); AssetManager.copyComponent(${idx})">
                                    <i class="fas fa-copy"></i> Copy Code
                                </button>
                                <button class="asset-action-btn secondary" onclick="event.stopPropagation(); AssetManager.insertComponentDirect(${idx})" title="Insert directly at cursor">
                                    <i class="fas fa-arrow-down"></i> Insert
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    function copyIconByName(name) {
        const snippet = `<i class="fas fa-${name}"></i>`;
        copySnippet(snippet, name);
    }

    function copyPhotoTag(index) {
        const item = CURATED_PHOTOS[index];
        if (item) {
            copySnippet(item.htmlSnippet, item.title);
        }
    }

    function copyPhotoUrlByIndex(index) {
        const item = CURATED_PHOTOS[index];
        if (item) {
            copySnippet(item.url, `${item.title} URL`);
        }
    }

    function insertPhotoDirect(index) {
        const item = CURATED_PHOTOS[index];
        if (item) {
            insertSnippetDirectly(item.htmlSnippet, item.title);
        }
    }

    function copyComponent(index) {
        const item = UI_COMPONENTS[index];
        if (item) {
            copySnippet(item.snippet, item.title);
        }
    }

    function insertComponentDirect(index) {
        const item = UI_COMPONENTS[index];
        if (item) {
            insertSnippetDirectly(item.snippet, item.title);
        }
    }

    function createModalDOM() {
        const div = document.createElement('div');
        div.id = 'assets-modal';
        div.className = 'assets-modal';
        div.innerHTML = `
            <div class="assets-card">
                <div class="assets-header">
                    <div class="assets-title">
                        <i class="fas fa-shapes"></i> Materials
                    </div>

                    <div class="assets-tabs">
                        <button class="assets-tab-btn active" data-tab="icons" onclick="AssetManager.setTab('icons')">
                            <i class="fas fa-icons"></i> Icons
                        </button>
                        <button class="assets-tab-btn" data-tab="photos" onclick="AssetManager.setTab('photos')">
                            <i class="fas fa-image"></i> Photos
                        </button>
                        <button class="assets-tab-btn" data-tab="mock" onclick="AssetManager.setTab('mock')">
                            <i class="fas fa-layer-group"></i> Components
                        </button>
                    </div>

                    <button class="assets-close-btn" onclick="AssetManager.closeModal()" title="Close"><i class="fas fa-times"></i></button>
                </div>

                <div class="assets-search-bar">
                    <input type="text" id="assets-search-input" class="assets-search-input" placeholder="Search icons, photos or UI components..." oninput="AssetManager.handleSearch(this.value)">
                    <div class="assets-chips-row" id="assets-filter-chips" style="display:none;">
                        <span class="assets-chip active" data-filter="all" onclick="AssetManager.setFilter('all')">All</span>
                        <span class="assets-chip" data-filter="avatar" onclick="AssetManager.setFilter('avatar')">Avatars</span>
                        <span class="assets-chip" data-filter="product" onclick="AssetManager.setFilter('product')">Products</span>
                        <span class="assets-chip" data-filter="hero" onclick="AssetManager.setFilter('hero')">Banners</span>
                    </div>
                </div>

                <div class="assets-content" id="assets-tab-content">
                    <!-- Populated dynamically -->
                </div>
            </div>
        `;
        document.body.appendChild(div);
    }

    return {
        openModal,
        closeModal,
        setTab,
        setFilter,
        handleSearch,
        copySnippet,
        copyIconByName,
        copyPhotoTag,
        copyPhotoUrlByIndex,
        insertPhotoDirect,
        copyComponent,
        insertComponentDirect
    };
})();
