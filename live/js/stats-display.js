// --- 1. SYNC LOGIC (INDEXEDDB + BROADCAST) ---
const DB_NAME = 'StatsDB';
const STORE_NAME = 'stats_data';
const CHANNEL_NAME = 'stats_sync_channel';

let db;
const channel = new BroadcastChannel(CHANNEL_NAME);

function openDB() {
const request = indexedDB.open(DB_NAME, 1);
request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
};
request.onsuccess = (event) => {
    db = event.target.result;
    renderDisplay(); // Render data pertama kali
};
}

function renderDisplay() {
if (!db) return;
const transaction = db.transaction([STORE_NAME], 'readonly');
const store = transaction.objectStore(STORE_NAME);
const request = store.get('current_match_stats');

request.onsuccess = () => {
    if (request.result) {
    const data = request.result.payload;
    updateDOM(data);
    }
};
}

// Mendengarkan pesan dari config
channel.onmessage = () => {
renderDisplay();
};

// --- 2. UPDATE DOM ---
function updateDOM(data) {
// Helper update
const updateText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
};
const updateWidth = (id, pct) => {
    const el = document.getElementById(id);
    if (el) el.style.width = pct + '%';
};

// 1. Update Skor Header
updateText('disp-score-home', data.stats.score.home);
updateText('disp-score-away', data.stats.score.away);

// 2. Loop semua statistik
Object.keys(data.stats).forEach(type => {
    const s = data.stats[type];
    const total = s.home + s.away;
    let homePct = 50, awayPct = 50;

    if (total > 0) {
    homePct = (s.home / total) * 100;
    awayPct = (s.away / total) * 100;
    }

    updateText(`disp-val-${type}-home`, s.home);
    updateText(`disp-val-${type}-away`, s.away);

    updateWidth(`disp-bar-${type}-home`, homePct);
    updateWidth(`disp-bar-${type}-away`, awayPct);
});

// 3. Update Possession
const { home, away } = data.possession;
const totalSec = home + away;
let posPctHome = 50, posPctAway = 50;
if (totalSec > 0) {
    posPctHome = Math.round((home / totalSec) * 100);
    posPctAway = 100 - posPctHome;
}

const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
};

updateText('disp-val-possession-home', posPctHome + '%');
updateText('disp-val-possession-away', posPctAway + '%');
updateText('disp-time-home', formatTime(home));
updateText('disp-time-away', formatTime(away));
updateText('disp-match-time', formatTime(totalSec));

updateWidth('disp-bar-possession-home', posPctHome);
updateWidth('disp-bar-possession-away', posPctAway);
}

// --- INIT ---
openDB();