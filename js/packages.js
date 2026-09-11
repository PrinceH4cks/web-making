/* ==========================================================================
   Master Web IDE Ultra - CDN Package Manager
   ========================================================================== */

const PackageManager = (function() {

    const LIBRARIES = [
        {
            id: 'tailwind',
            name: 'Tailwind CSS 3',
            category: 'CSS',
            desc: 'Modern utility-first CSS framework (Just-in-time runtime CDN).',
            icon: 'fab fa-css3-alt',
            tag: '<script src="https://cdn.tailwindcss.com"></script>',
            type: 'head-script'
        },
        {
            id: 'bootstrap',
            name: 'Bootstrap 5.3',
            category: 'CSS / UI',
            desc: 'The most popular responsive CSS and component library.',
            icon: 'fab fa-bootstrap',
            tag: '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">',
            type: 'head-link'
        },
        {
            id: 'font-awesome',
            name: 'Font Awesome 6',
            category: 'Icons',
            desc: 'Complete icon library with 2,000+ vector icons.',
            icon: 'fas fa-icons',
            tag: '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">',
            type: 'head-link'
        },
        {
            id: 'threejs',
            name: 'Three.js (3D)',
            category: '3D & Canvas',
            desc: 'Leading JavaScript 3D library for WebGL experiences.',
            icon: 'fas fa-cube',
            tag: '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>',
            type: 'head-script'
        },
        {
            id: 'gsap',
            name: 'GSAP Animation',
            category: 'Animation',
            desc: 'Professional-grade JavaScript animation engine by GreenSock.',
            icon: 'fas fa-film',
            tag: '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>',
            type: 'head-script'
        },
        {
            id: 'chartjs',
            name: 'Chart.js',
            category: 'Data Viz',
            desc: 'Simple yet flexible JavaScript charting library for designers & devs.',
            icon: 'fas fa-chart-pie',
            tag: '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>',
            type: 'head-script'
        },
        {
            id: 'confetti',
            name: 'Canvas Confetti',
            category: 'Effects',
            desc: 'Performant full-screen celebratory confetti particle bursts.',
            icon: 'fas fa-wand-magic-sparkles',
            tag: '<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>',
            type: 'head-script'
        },
        {
            id: 'axios',
            name: 'Axios HTTP',
            category: 'Network',
            desc: 'Promise-based HTTP client for API fetching and REST.',
            icon: 'fas fa-network-wired',
            tag: '<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>',
            type: 'head-script'
        },
        {
            id: 'react',
            name: 'React 18 + Babel',
            category: 'Framework',
            desc: 'React & ReactDOM with in-browser Babel JSX compiler.',
            icon: 'fab fa-react',
            tag: '<script src="https://unpkg.com/react@18/umd/react.development.js"></script>\n<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>\n<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>',
            type: 'head-script'
        },
        {
            id: 'vue',
            name: 'Vue 3 Global',
            category: 'Framework',
            desc: 'Progressive JavaScript framework for building user interfaces.',
            icon: 'fab fa-vuejs',
            tag: '<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>',
            type: 'head-script'
        }
    ];

    function injectPackage(pkgId) {
        const pkg = LIBRARIES.find(l => l.id === pkgId);
        if (!pkg) return;

        let indexHtml = VFS.get('index.html');
        if (!indexHtml) {
            App.showToast('No index.html found to inject package!', 'error');
            return;
        }

        let content = indexHtml.content;
        if (content.includes(pkg.name) || content.includes(pkg.tag)) {
            App.showToast(`${pkg.name} is already installed!`, 'info');
            return;
        }

        if (content.includes('</head>')) {
            content = content.replace('</head>', `  <!-- ${pkg.name} -->\n  ${pkg.tag}\n</head>`);
        } else {
            content = `${pkg.tag}\n` + content;
        }

        VFS.set('index.html', content);
        if (App.getCurrentFile() === 'index.html') {
            EditorController.setContent(content, 'htmlmixed');
        }

        App.updatePreview();
        App.showToast(`Installed ${pkg.name} into index.html!`, 'success');
    }

    function injectCustomUrl(url) {
        url = url.trim();
        if (!url) return;

        let tag = '';
        if (url.endsWith('.css') || url.includes('.css?')) {
            tag = `<link rel="stylesheet" href="${url}">`;
        } else {
            tag = `<script src="${url}"><\/script>`;
        }

        let indexHtml = VFS.get('index.html');
        if (!indexHtml) return;

        let content = indexHtml.content;
        if (content.includes('</head>')) {
            content = content.replace('</head>', `  ${tag}\n</head>`);
        } else {
            content = `${tag}\n` + content;
        }

        VFS.set('index.html', content);
        if (App.getCurrentFile() === 'index.html') {
            EditorController.setContent(content, 'htmlmixed');
        }

        App.updatePreview();
        App.showToast('Custom CDN package injected!', 'success');
    }

    function renderModalGrid(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = LIBRARIES.map(lib => `
            <div class="package-card">
                <div>
                    <div class="package-header">
                        <i class="${lib.icon}"></i>
                        <span class="package-name">${lib.name}</span>
                    </div>
                    <p class="package-desc">${lib.desc}</p>
                </div>
                <button class="btn btn-primary" style="width:100%; justify-content:center;" onclick="PackageManager.injectPackage('${lib.id}')">
                    <i class="fas fa-plus"></i> Add to Project
                </button>
            </div>
        `).join('');
    }

    return {
        LIBRARIES,
        injectPackage,
        injectCustomUrl,
        renderModalGrid
    };
})();
