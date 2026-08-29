const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let W;
let H;
let particles = [];
let grid = [];

function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;

    grid = [];

    const s = 48;

    for (let x = 0; x < W; x += s) {
        for (let y = 0; y < H; y += s) {
            grid.push({ x, y });
        }
    }
}

window.addEventListener('resize', resize);
resize();

const COLS = ['#0066FF', '#00D4FF', '#7b2fff'];

for (let i = 0; i < 55; i++) {
    particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        color: COLS[Math.floor(Math.random() * COLS.length)],
        alpha: Math.random() * 0.5 + 0.1
    });
}

let t = 0;

function draw() {
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
            0.05 +
            0.04 * Math.sin(
                t * 0.4 +
                p.x * 0.05 +
                p.y * 0.05
            );

        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,102,255,${f})`;
        ctx.fill();
    });

    particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

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

            const d = Math.sqrt(dx * dx + dy * dy);

            if (d < 120) {
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
                    `rgba(0,212,255,${0.05 * (1 - d / 120)})`;

                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }

    t++;

    requestAnimationFrame(draw);
}

draw();


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


function handleCertError(img) {
    img.setAttribute('data-error', 'true');

    const certPreview =
        img.closest('.cert-preview');

    if (certPreview) {
        const placeholder =
            certPreview.querySelector('.cert-placeholder');

        if (placeholder) {
            placeholder.classList.add('visible');
        }
    }
}


function openPDF(filename) {
    const url =
        window.location.origin +
        window.location.pathname.replace('index.html', '') +
        filename;

    window.open(url, '_blank');
}
document.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => {
        handleImgError(img);
    });
});