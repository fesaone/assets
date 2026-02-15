/* ===============================
   KONFIGURASI
   <button onclick="toggleDisplay('penalty')">Penalty</button>
================================ */

// indikator yang hanya ON/OFF manual
const MANUAL_ONLY = [
    'penalty',
    'dimulai'
];

// indikator yang ON/OFF + auto-reset
const AUTO_RESET = new Set([
    'hideall',
    'scoreboard-bottom',
    'yellowcard-home',
    'yellowcard-away',
    'redcard-home',
    'redcard-away',
    'fouls',
    'corner',
    'pergantian-home',
    'pergantian-away'
]);

// gabungan semua indikator (single source)
const INDICATORS = [...MANUAL_ONLY, ...AUTO_RESET];

const AUTO_RESET_TIME = 10000; // 10 detik

/* ===============================
   STATE TIMER (MEMORY)
================================ */
const resetTimers = Object.create(null);

/* ===============================
   UTIL
================================ */
const keyOf = name => `indicator:${name}`;

/* ===============================
   MATIKAN SEMUA + BATALKAN TIMER
================================ */
function clearAllIndicators() {
    INDICATORS.forEach(name => {
        localStorage.setItem(keyOf(name), '0');

        if (resetTimers[name]) {
            clearTimeout(resetTimers[name]);
            delete resetTimers[name];
        }
    });
}

/* ===============================
   SINKRON BODY CLASS
================================ */
function syncIndicators() {
    INDICATORS.forEach(name => {
        const active = localStorage.getItem(keyOf(name)) === '1';
        document.body.classList.toggle(name, active);
    });
}

/* ===============================
   TOGGLE UNIVERSAL (MANUAL + AUTO)
================================ */
function toggleDisplay(name) {
    const key = keyOf(name);
    const isActive = localStorage.getItem(key) === '1';

    if (isActive) {
        // === OFF MANUAL ===
        localStorage.setItem(key, '0');

        if (resetTimers[name]) {
            clearTimeout(resetTimers[name]);
            delete resetTimers[name];
        }

        syncIndicators();
        return;
    }

    // === ON ===
    clearAllIndicators();
    localStorage.setItem(key, '1');
    syncIndicators();

    // === AUTO RESET JIKA ADA ===
    if (AUTO_RESET.has(name)) {
        resetTimers[name] = setTimeout(() => {
            if (localStorage.getItem(key) === '1') {
                localStorage.setItem(key, '0');
                syncIndicators();
            }
            delete resetTimers[name];
        }, AUTO_RESET_TIME);
    }
}

/* ===============================
   INIT & SYNC LINTAS HALAMAN
================================ */
document.addEventListener('DOMContentLoaded', syncIndicators);
window.addEventListener('storage', syncIndicators);