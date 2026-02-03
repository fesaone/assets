// --- 1. INJECT CSS KE HEAD ---
const styleSheet = document.createElement("style");
styleSheet.innerText = `
    canvas {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 0;
    }
    .vignette {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        background: radial-gradient(circle, transparent 50%, rgba(0, 0, 0, 0.8) 100%);
        z-index: 1;
    }
    .grain {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        opacity: 0.04;
        z-index: 2;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    }
`;
document.head.appendChild(styleSheet);

// --- 2. TAMBAHKAN HTML KE BODY ---
const canvasEl = document.createElement('canvas');
canvasEl.id = 'cosmosCanvas';
document.body.appendChild(canvasEl);

const vignetteEl = document.createElement('div');
vignetteEl.className = 'vignette';
document.body.appendChild(vignetteEl);

const grainEl = document.createElement('div');
grainEl.className = 'grain';
document.body.appendChild(grainEl);

// --- 3. LOGIKA ANIMASI ---

/**
 * SCIENTIFIC OBSERVATION ENGINE
 * 
 * Principles:
 * - Fixed Perspective: Observer is static, space moves.
 * - Unified Flow: All matter drifts diagonally (Top-Right -> Bottom-Left).
 * - Silence vs. Event: Long periods of stillness punctuated by rare trails.
 * - Accidentality: Constellations are rare probabilistic events.
 */

const canvas = document.getElementById('cosmosCanvas');
const ctx = canvas.getContext('2d');

// --- CONFIGURATION ---
const config = {
    bg: '#020204',
    dustColor: '210, 235, 255', // Pale blue-white
    dustCount: 250,
    
    // Unified Flow (Angle ~225 degrees)
    flowX: -0.04, 
    flowY: 0.02,
    
    // Comet/Fragment Logic
    fragmentPool: 10,
    eventProbability: 0.005, // Chance per frame of an event starting
    
    // Constellation Logic
    connectDist: 150,
    connectProb: 0.92 // 1.0 - 0.08 = 8% chance to connect if close
};

let width, height;
let particles = [];
let fragments = [];
let time = 0;
let frameCount = 0;

// --- UTILS ---
function random(min, max) {
    return Math.random() * (max - min) + min;
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener('resize', resize);

// --- CLASS 1: COSMIC DUST (Fixed Perspective) ---
class Dust {
    constructor() {
        this.init(true);
    }

    init(randomY) {
        this.x = random(0, width);
        this.y = randomY ? random(0, height) : random(0, height);
        
        // Depth: 0 (far) to 1 (near)
        this.depth = random(0.2, 1.0);
        
        // Size is tiny, sharp
        this.size = random(0.8, 1.8) * this.depth;
        
        // Alpha
        this.baseAlpha = random(0.3, 0.7);
        
        // Parallax/Flow Speed multiplier
        this.speedMod = this.depth * random(0.8, 1.2);
        
        // Twinkle (Imperceptible)
        this.twinkleOffset = random(0, Math.PI * 2);
    }

    update() {
        // Apply Unified Flow
        // No mouse interaction. The observer is fixed.
        this.x += config.flowX * this.speedMod;
        this.y += config.flowY * this.speedMod;

        // Screen Wrapping (Infinite Space)
        if (this.x < -10) this.x = width + 10;
        if (this.y > height + 10) this.y = -10;
        if (this.y < -10) this.y = height + 10;
        if (this.x > width + 10) this.x = -10;

        // Calculate alpha with subtle twinkle
        const twinkle = Math.sin(time * 0.02 + this.twinkleOffset) * 0.05;
        this.alpha = Math.max(0.1, Math.min(1, this.baseAlpha + twinkle));
    }

    draw() {
        ctx.fillStyle = `rgba(${config.dustColor}, ${this.alpha})`;
        ctx.fillRect(this.x, this.y, this.size, this.size); // Sharp pixel
    }
}

// --- CLASS 2: FRAGMENTS (Micro-Asteroids) ---
class Fragment {
    constructor() {
        this.active = false;
        this.resetTimer = 0;
    }

    spawn() {
        this.active = true;
        
        // Spawn at random edge of Top-Right
        if (Math.random() > 0.5) {
            this.x = width + 50;
            this.y = random(-50, height * 0.5);
        } else {
            this.x = random(width * 0.5, width + 50);
            this.y = -50;
        }

        // Move faster than dust, but same vector
        const speed = random(2.5, 4.5);
        // Precise angle matching flow vector
        const angle = Math.PI * 0.80 + random(-0.1, 0.1); 
        
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        // Trail Properties
        this.trailLen = random(150, 300);
        this.width = random(0.5, 1.2);
        this.opacity = random(0.4, 0.7); // Restrained brightness
    }

    update() {
        if (!this.active) return;

        this.x += this.vx;
        this.y += this.vy;

        // Despawn
        if (this.x < -this.trailLen || this.y > height + this.trailLen) {
            this.active = false;
        }
    }

    draw() {
        if (!this.active) return;

        ctx.save();
        ctx.globalCompositeOperation = 'screen'; // Soft additive blending

        const tailX = this.x - (this.vx * (this.trailLen / 4));
        const tailY = this.y - (this.vy * (this.trailLen / 4));

        const grad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 255, 255, ${this.opacity})`);
        grad.addColorStop(0.1, `rgba(220, 240, 255, ${this.opacity * 0.5})`);
        grad.addColorStop(1, `rgba(220, 240, 255, 0)`);

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = this.width;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.restore();
    }
}

// --- INITIALIZATION ---
function init() {
    resize();

    // Create Dust
    for (let i = 0; i < config.dustCount; i++) {
        particles.push(new Dust());
    }

    // Create Fragment Pool
    for (let i = 0; i < config.fragmentPool; i++) {
        fragments.push(new Fragment());
    }

    animate();
}

// --- CONSTELLATION LOGIC ---
function drawConstellations() {
    ctx.lineWidth = 0.4;

    for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        if (p1.alpha < 0.2) continue; // Only bright particles connect

        for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < config.connectDist * config.connectDist) {
                
                // PROBABILISTIC CONNECTION
                // Even if close, only connect rarely (8% chance)
                if (Math.random() > config.connectProb) {
                    const dist = Math.sqrt(distSq);
                    const opacity = (1 - dist / config.connectDist) * 0.15;
                    
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(${config.dustColor}, ${opacity})`;
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
        }
    }
}

// --- ANIMATION LOOP ---
function animate() {
    time++;
    frameCount++;

    // Clear
    ctx.fillStyle = config.bg;
    ctx.fillRect(0, 0, width, height);

    // 1. Draw Dust
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    // 2. Draw Constellations (Background layer)
    drawConstellations();

    // 3. Fragment Logic (Visual Silence Management)
    // Only try to spawn a fragment randomly
    if (Math.random() < config.eventProbability) {
        const inactive = fragments.find(f => !f.active);
        if (inactive) inactive.spawn();
    }

    fragments.forEach(f => {
        f.update();
        f.draw();
    });

    // Update Timer
    if (frameCount % 60 === 0) {
        const d = new Date();
        const m = d.getMinutes().toString().padStart(2, '0');
        const s = d.getSeconds().toString().padStart(2, '0');
        const ms = Math.floor(d.getMilliseconds() / 10).toString().padStart(2, '0');
        // document.getElementById('timer').innerText = `00:${m}:${s}`;
    }

    requestAnimationFrame(animate);
}

init();