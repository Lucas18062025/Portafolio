const canvas = document.getElementById('bg-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

let W;
let H;
let particles = [];
let grid = [];
let isAnimating = true;

const DPR = Math.min(window.devicePixelRatio || 1, 2);

const COLS = ['#0066FF', '#00D4FF', '#7b2fff'];

function initParticlesAndGrid() {
    if (!canvas) return;
    grid = [];
    particles = [];

    const isMobile = W < 768;
    const s = isMobile ? 60 : 42;
    const count = isMobile ? 50 : 110;

    for (let x = 0; x < W; x += s) {
        for (let y = 0; y < H; y += s) {
            grid.push({ x, y });
        }
    }

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 2.8 + 1.2,
            vx: (Math.random() - 0.5) * 0.9,
            vy: (Math.random() - 0.5) * 0.9,
            color: COLS[Math.floor(Math.random() * COLS.length)],
            alpha: Math.random() * 0.5 + 0.35
        });
    }
}

function resize() {
    if (!canvas || !ctx) return;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    initParticlesAndGrid();
}

window.addEventListener('resize', resize);
resize();

let t = 0;
let last = 0;

function draw(now) {
    if (!isAnimating || !ctx) return;

    // Reloj de paso fijo: velocidad constante en cualquier hardware.
    // Si un frame tarda mas (PC lenta), se avanza en pasos de 16.67ms
    // con tope de 5 para no entrar en espiral de la muerte.
    const elapsed = (now && last) ? Math.min(now - last, 83.35) : 16.67;
    last = now || 0;
    const step = elapsed / 16.67;

    ctx.clearRect(0, 0, W, H);

    const g = ctx.createRadialGradient(
        W * 0.5,
        H * 0.1,
        0,
        W * 0.5,
        H * 0.5,
        H * 0.9
    );

    g.addColorStop(0, 'rgba(0,10,25,0.15)');
    g.addColorStop(0.5, 'rgba(0,5,10,0.08)');
    g.addColorStop(1, 'rgba(2,4,8,0)');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    grid.forEach((p) => {
        const f =
            0.08 +
            0.06 * Math.sin(
                t * 0.4 +
                p.x * 0.05 +
                p.y * 0.05
            );

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,102,255,${f})`;
        ctx.fill();
    });

    particles.forEach((p) => {
        p.x += p.vx * step;
        p.y += p.vy * step;

        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;

        ctx.fill();

        ctx.globalAlpha = 1;
    });

    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {

            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;

            // Comparar distancia al cuadrado evita ~6000 sqrt por frame;
            // el sqrt solo se calcula para los pares que si se dibujan.
            const d2 = dx * dx + dy * dy;

            if (d2 < 19600) {
                const d = Math.sqrt(d2);
                ctx.beginPath();

                ctx.moveTo(
                    particles[i].x,
                    particles[i].y
                );

                ctx.lineTo(
                    particles[j].x,
                    particles[j].y
                );

                ctx.strokeStyle =
                    `rgba(0,212,255,${0.15 * (1 - d / 140)})`;

                ctx.lineWidth = 0.85;
                ctx.stroke();
            }
        }
    }

    t += step;

    if (isAnimating) {
        requestAnimationFrame(draw);
    }
}

function playCanvas() {
    if (!isAnimating) {
        isAnimating = true;
        last = 0;
        requestAnimationFrame(draw);
    }
}

function pauseCanvas() {
    isAnimating = false;
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        pauseCanvas();
    } else {
        playCanvas();
    }
});

function logCanvasMode(mode) {
    if (typeof console !== 'undefined' && console.info) {
        console.info('[canvas] mode=' + mode);
    }
}

draw();
logCanvasMode('full');


function handleImgError(img) {
    img.setAttribute('data-error', 'true');
    img.classList.add('img-error');

    const placeholderId =
        img.getAttribute('data-placeholder-id');

    if (placeholderId) {
        const ph =
            document.getElementById(placeholderId);

        if (ph) {
            ph.classList.remove('hidden');
        }
    }
}


document.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => {
        handleImgError(img);
    });
});

// Stack tabs: una sola línea + desplegable sincronizados (CSP-safe: sin inline handlers)
(function () {
    function showStackFallback(img) {
        img.classList.add('s-img-error');
        const fb = img.parentElement ? img.parentElement.querySelector('.s-fallback') : null;
        if (fb) fb.style.display = 'block';
    }
    document.querySelectorAll('.s-icon-box img').forEach((img) => {
        img.addEventListener('error', () => showStackFallback(img));
        if (img.complete && img.naturalWidth === 0) showStackFallback(img);
    });
    const tabs = Array.from(document.querySelectorAll('.stack-tab'));
    const panels = Array.from(document.querySelectorAll('.stack-panel'));
    const select = document.getElementById('stack-select');
    if (!tabs.length || !panels.length) return;
    function activate(key) {
        tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.stack === key ? 'true' : 'false'));
        panels.forEach(p => {
            const show = p.id === 'panel-' + key;
            if (show) p.removeAttribute('hidden');
            else p.setAttribute('hidden', '');
        });
        if (select && select.value !== key) select.value = key;
    }
    tabs.forEach(t => t.addEventListener('click', () => activate(t.dataset.stack)));
    if (select) select.addEventListener('change', () => activate(select.value));
    const tablist = document.querySelector('.stack-tabs');
    if (tablist) tablist.addEventListener('keydown', (e) => {
        const i = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
        let n = null;
        if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        else return;
        tabs[n].focus();
        activate(tabs[n].dataset.stack);
        e.preventDefault();
    });
})();