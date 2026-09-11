/* ==========================================================================
   Master Web IDE Ultra - High-End Starter Templates Hub
   ========================================================================== */

const TEMPLATES = {
    threejs: {
        name: "Three.js 3D World",
        desc: "Interactive 3D WebGL scene with animated neon shapes, lighting, and mouse rotation.",
        icon: "fas fa-cube",
        files: {
            "index.html": {
                type: "htmlmixed",
                content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Three.js 3D Interactive World</title>
  <link rel="stylesheet" href="css/style.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
</head>
<body>
  <div id="canvas-container"></div>
  <div class="overlay">
    <h2>Three.js 3D Studio</h2>
    <p>Move mouse to orbit and rotate the 3D crystal wireframe.</p>
  </div>
  <script src="js/scene.js"><\/script>
</body>
</html>`
            },
            "css/style.css": {
                type: "css",
                content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #05060a; overflow: hidden; height: 100vh; font-family: system-ui, sans-serif; }
#canvas-container { width: 100%; height: 100%; display: block; }
.overlay {
  position: absolute;
  top: 30px; left: 30px;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px 24px;
  border-radius: 16px;
  color: #fff;
  pointer-events: none;
}
.overlay h2 { font-size: 1.3rem; color: #38bdf8; margin-bottom: 6px; }
.overlay p { font-size: 0.85rem; color: #94a3b8; }`
            },
            "js/scene.js": {
                type: "javascript",
                content: `const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060a, 0.04);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Glowing Torus Knot
const geometry = new THREE.TorusKnotGeometry(1.2, 0.35, 100, 16);
const material = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  roughness: 0.2,
  metalness: 0.8,
  wireframe: true
});
const knot = new THREE.Mesh(geometry, material);
scene.add(knot);

// Lights
const pointLight = new THREE.PointLight(0xa855f7, 2, 50);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Mouse Interaction
let mouseX = 0, mouseY = 0;
window.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  knot.rotation.x += 0.01;
  knot.rotation.y += 0.015;
  knot.rotation.x += (mouseY - knot.rotation.x) * 0.05;
  knot.rotation.y += (mouseX - knot.rotation.y) * 0.05;
  renderer.render(scene, camera);
}
animate();

console.log('✅ Three.js Scene initialized!');`
            }
        }
    },

    react: {
        name: "React 18 + Babel",
        desc: "Modern React with Hooks, state management, and real-time Babel compilation.",
        icon: "fab fa-react",
        files: {
            "index.html": {
                type: "htmlmixed",
                content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>React 18 Playground</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
</head>
<body class="bg-slate-950 text-slate-100 flex items-center justify-center min-h-screen p-4">
  <div id="root"></div>
  <script type="text/babel" src="js/app.js"><\/script>
</body>
</html>`
            },
            "js/app.js": {
                type: "javascript",
                content: `const { useState, useEffect } = React;

function App() {
  const [todos, setTodos] = useState([
    { id: 1, text: 'Build Ultra Web IDE', done: true },
    { id: 2, text: 'Create React 18 CDN Template', done: true },
    { id: 3, text: 'Ship amazing web applications', done: false }
  ]);
  const [input, setInput] = useState('');

  const addTodo = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setTodos([...todos, { id: Date.now(), text: input, done: false }]);
    setInput('');
    console.log('Added new todo:', input);
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xl font-bold border border-cyan-500/20">
          ⚛️
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">React 18 Studio</h1>
          <p className="text-xs text-slate-400">Declarative State & Hooks</p>
        </div>
      </div>

      <form onSubmit={addTodo} className="flex gap-2 mb-6">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-cyan-500"
        />
        <button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition">
          Add
        </button>
      </form>

      <div className="space-y-2">
        {todos.map(todo => (
          <div 
            key={todo.id}
            onClick={() => toggleTodo(todo.id)}
            className="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700 transition"
          >
            <input type="checkbox" checked={todo.done} readOnly className="rounded" />
            <span className={todo.done ? "line-through text-slate-500 text-sm" : "text-slate-200 text-sm"}>
              {todo.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
console.log('⚛️ React 18 App Rendered Successfully!');`
            }
        }
    },

    tailwind: {
        name: "Tailwind SaaS UI",
        desc: "Clean glassmorphic SaaS dashboard with metric cards and responsive layout.",
        icon: "fab fa-css3-alt",
        files: {
            "index.html": {
                type: "htmlmixed",
                content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SaaS Dashboard</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-8">
  <div class="max-w-4xl mx-auto">
    <!-- Header -->
    <header class="flex justify-between items-center mb-8 pb-6 border-b border-slate-800">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Cloud Node Cluster</h1>
        <p class="text-sm text-slate-400">Server Health & Load Monitoring</p>
      </div>
      <button onclick="pingServers()" class="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-cyan-500/20">
        <i class="fas fa-rotate"></i> Refresh Node Stats
      </button>
    </header>

    <!-- Metrics Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">CPU Utilization</div>
        <div class="text-3xl font-extrabold text-cyan-400" id="cpu-stat">28.4%</div>
        <div class="text-xs text-emerald-400 mt-2"><i class="fas fa-arrow-trend-down"></i> 3.2% lower than usual</div>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Active Sessions</div>
        <div class="text-3xl font-extrabold text-white" id="session-stat">1,482</div>
        <div class="text-xs text-emerald-400 mt-2"><i class="fas fa-arrow-trend-up"></i> +14% growth today</div>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Latency</div>
        <div class="text-3xl font-extrabold text-violet-400" id="latency-stat">18 ms</div>
        <div class="text-xs text-slate-400 mt-2">Edge PoP Mumbai-01</div>
      </div>
    </div>
  </div>
  <script src="js/dashboard.js"><\/script>
</body>
</html>`
            },
            "js/dashboard.js": {
                type: "javascript",
                content: `function pingServers() {
  const cpu = (Math.random() * 30 + 15).toFixed(1) + '%';
  const sessions = Math.floor(Math.random() * 500 + 1200);
  const latency = Math.floor(Math.random() * 15 + 12) + ' ms';

  document.getElementById('cpu-stat').innerText = cpu;
  document.getElementById('session-stat').innerText = sessions.toLocaleString();
  document.getElementById('latency-stat').innerText = latency;

  console.info('📡 Cluster nodes pinged! Latency: ' + latency);
}

console.log('SaaS Dashboard Initialized');`
            }
        }
    },

    canvas_physics: {
        name: "Canvas Physics Engine",
        desc: "60 FPS Interactive Particle Gravity & Collision Playground with mouse force fields.",
        icon: "fas fa-gamepad",
        files: {
            "index.html": {
                type: "htmlmixed",
                content: `<!DOCTYPE html>
<html>
<head>
  <title>Canvas Physics Simulation</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#030712; overflow:hidden; height:100vh; font-family:sans-serif; }
    canvas { display:block; width:100%; height:100%; }
    .hud { position:absolute; bottom:20px; left:50%; transform:translateX(-50%); color:#64748b; font-size:12px; letter-spacing:1px; pointer-events:none; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div class="hud">Move mouse or touch screen to create gravity particle repulsions</div>
  <script src="js/physics.js"><\/script>
</body>
</html>`
            },
            "js/physics.js": {
                type: "javascript",
                content: `const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let w = canvas.width = window.innerWidth;
let h = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
});

const particles = [];
const NUM = 120;
const mouse = { x: w / 2, y: h / 2, radius: 120 };

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

class Particle {
  constructor() {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.radius = Math.random() * 3 + 2;
    this.color = 'hsl(' + (Math.random() * 50 + 190) + ', 95%, 65%)';
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0 || this.x > w) this.vx *= -1;
    if (this.y < 0 || this.y > h) this.vy *= -1;

    // Mouse repulsion
    const dx = this.x - mouse.x;
    const dy = this.y - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < mouse.radius) {
      const angle = Math.atan2(dy, dx);
      const force = (mouse.radius - dist) / mouse.radius;
      this.x += Math.cos(angle) * force * 5;
      this.y += Math.sin(angle) * force * 5;
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fill();
  }
}

for (let i = 0; i < NUM; i++) particles.push(new Particle());

function loop() {
  ctx.fillStyle = 'rgba(3, 7, 18, 0.25)';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < particles.length; i++) {
    particles[i].update();
    particles[i].draw();

    // Connect lines
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(56, 189, 248,' + (1 - dist / 100) * 0.3 + ')';
        ctx.lineWidth = 1;
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  requestAnimationFrame(loop);
}
loop();
console.log('🎮 60 FPS Particle Canvas Simulation Running!');`
            }
        }
    },

    gsap: {
        name: "GSAP Timeline Animations",
        desc: "Cinematic web animations using the GreenSock GSAP 3 animation suite.",
        icon: "fas fa-film",
        files: {
            "index.html": {
                type: "htmlmixed",
                content: `<!DOCTYPE html>
<html>
<head>
  <title>GSAP Animation Studio</title>
  <link rel="stylesheet" href="css/style.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"><\/script>
</head>
<body>
  <div class="hero">
    <h1 class="anim-item">Motion Crafted with GSAP</h1>
    <p class="anim-item">Smooth easing, sequenced timelines, and interactive physics.</p>
    <div class="boxes">
      <div class="box anim-box">1</div>
      <div class="box anim-box">2</div>
      <div class="box anim-box">3</div>
      <div class="box anim-box">4</div>
    </div>
    <button id="replay-btn" class="anim-item">Replay Timeline</button>
  </div>
  <script src="js/anim.js"><\/script>
</body>
</html>`
            },
            "css/style.css": {
                type: "css",
                content: `* { margin:0; padding:0; box-sizing:border-box; }
body { min-height:100vh; background:#0f172a; display:flex; align-items:center; justify-content:center; font-family:system-ui, sans-serif; color:#fff; }
.hero { text-align:center; max-width:600px; }
h1 { font-size:2.5rem; margin-bottom:1rem; color:#38bdf8; }
p { color:#94a3b8; margin-bottom:2rem; }
.boxes { display:flex; gap:16px; justify-content:center; margin-bottom:2rem; }
.box { width:60px; height:60px; background:linear-gradient(135deg, #a855f7, #ec4899); border-radius:12px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.2rem; box-shadow:0 10px 25px rgba(236, 72, 153, 0.4); }
button { padding:12px 24px; background:#38bdf8; color:#0f172a; font-weight:bold; border:none; border-radius:10px; cursor:pointer; }`
            },
            "js/anim.js": {
                type: "javascript",
                content: `function runAnimation() {
  const tl = gsap.timeline();
  tl.from(".anim-item", {
    y: 40,
    opacity: 0,
    duration: 0.8,
    stagger: 0.15,
    ease: "power3.out"
  })
  .from(".anim-box", {
    scale: 0,
    rotation: 180,
    duration: 0.6,
    stagger: 0.1,
    ease: "back.out(1.7)"
  }, "-=0.3");
}

document.getElementById('replay-btn').addEventListener('click', runAnimation);
runAnimation();
console.log('🎬 GSAP Sequence Started!');`
            }
        }
    },

    clean: {
        name: "Standard Web Stack",
        desc: "Clean HTML5, CSS3 Custom Properties, and ES6 JavaScript with nested structure.",
        icon: "fas fa-globe",
        files: {
            "index.html": {
                type: "htmlmixed",
                content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Master Web App</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="card">
    <h1>Welcome to Master IDE Ultra</h1>
    <p>The premier in-browser web development suite.</p>
    <button id="btn" class="btn">Click Me</button>
  </div>
  <script src="js/main.js"><\/script>
</body>
</html>`
            },
            "css/style.css": {
                type: "css",
                content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #111827; color: #f9fafb; font-family: sans-serif; }
.card { background: #1f2937; padding: 2.5rem; border-radius: 1rem; text-align: center; border: 1px solid #374151; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
h1 { color: #38bdf8; margin-bottom: 0.5rem; }
p { color: #9ca3af; margin-bottom: 1.5rem; }
.btn { background: #38bdf8; color: #111827; font-weight: bold; padding: 0.75rem 1.5rem; border: none; border-radius: 0.5rem; cursor: pointer; }
.btn:hover { background: #7dd3fc; }`
            },
            "js/main.js": {
                type: "javascript",
                content: `document.getElementById('btn').addEventListener('click', () => {
  console.log('Standard web button clicked!');
  alert('Hello from Master IDE Ultra!');
});
console.log('Standard project initialized.');`
            }
        }
    }
};
