// --- 1. INDEXEDDB & BROADCAST SETUP ---
const DB_NAME = 'StatsDB';
const STORE_NAME = 'stats_data';
const CHANNEL_NAME = 'stats_sync_channel';

let db;
const channel = new BroadcastChannel(CHANNEL_NAME);

// --- 2. STATE ---
let appData = {
stats: {
    score:    { home: 0, away: 0 },
    shots:    { home: 0, away: 0 },
    onTarget: { home: 0, away: 0 },
    corners:  { home: 0, away: 0 },
    freekicks:{ home: 0, away: 0 },
    penalties:{ home: 0, away: 0 },
    fouls:    { home: 0, away: 0 },
    yellows:  { home: 0, away: 0 },
    reds:     { home: 0, away: 0 },
    offsides: { home: 0, away: 0 }
},
possession: {
    home: 0,
    away: 0,
    active: null
}
};

// --- 3. DATABASE FUNCTIONS ---
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
    loadData();
};
request.onerror = (event) => {
    console.error("Database error:", event.target.errorCode);
};
}

function saveData() {
if (!db) return;
const transaction = db.transaction([STORE_NAME], 'readwrite');
const store = transaction.objectStore(STORE_NAME);
const data = {
    id: 'current_match_stats',
    payload: appData,
    timestamp: Date.now()
};
store.put(data);
// Broadcast update ke display
channel.postMessage({ type: 'UPDATE' });
}

function loadData() {
const transaction = db.transaction([STORE_NAME], 'readonly');
const store = transaction.objectStore(STORE_NAME);
const request = store.get('current_match_stats');
request.onsuccess = () => {
    if (request.result) {
    appData = request.result.payload;
    // Restore Timer State
    if (appData.possession.active) {
            startTimerLogic(appData.possession.active);
    }
    }
    renderUI();
};
}

// --- 4. INPUT LOGIC ---
function updateCounter(type, delta, side) {
const data = appData.stats[type];
let newValue = data[side] + delta;
if (newValue < 0) newValue = 0;
data[side] = newValue;

saveData();
renderUI();
}

function renderUI() {
// Render Counters
Object.keys(appData.stats).forEach(type => {
    const data = appData.stats[type];
    
    const elHome = document.getElementById(`val-${type}-home`);
    const elAway = document.getElementById(`val-${type}-away`);
    if (elHome) elHome.textContent = data.home;
    if (elAway) elAway.textContent = data.away;

    if (type === 'score') {
    document.getElementById('header-score-home').textContent = data.home;
    document.getElementById('header-score-away').textContent = data.away;
    }

    const group = document.querySelector(`.stat-group[data-type="${type}"]`);
    if(group) {
    const btnMinusHome = group.querySelector('.control-group:first-child .btn-minus');
    const btnMinusAway = group.querySelector('.control-group:last-child .btn-minus');
    if (btnMinusHome) btnMinusHome.disabled = (data.home === 0);
    if (btnMinusAway) btnMinusAway.disabled = (data.away === 0);
    }

    const barHome = document.getElementById(`bar-${type}-home`);
    const barAway = document.getElementById(`bar-${type}-away`);
    if (barHome && barAway) {
    const total = data.home + data.away;
    let homePct = 50, awayPct = 50;
    if (total > 0) {
        homePct = (data.home / total) * 100;
        awayPct = (data.away / total) * 100;
    }
    barHome.style.width = homePct + '%';
    barAway.style.width = awayPct + '%';
    }
});

// Render Possession
const { home, away } = appData.possession;
const totalSeconds = home + away;
let homePct = 50, awayPct = 50;
if (totalSeconds > 0) {
    homePct = Math.round((home / totalSeconds) * 100);
    awayPct = 100 - homePct; 
}

document.getElementById('val-possession-home').textContent = homePct + '%';
document.getElementById('val-possession-away').textContent = awayPct + '%';
document.getElementById('time-home').textContent = formatTime(home);
document.getElementById('time-away').textContent = formatTime(away);
document.getElementById('match-time').textContent = formatTime(totalSeconds);
document.getElementById('bar-possession-home').style.width = homePct + '%';
document.getElementById('bar-possession-away').style.width = awayPct + '%';
}

// --- TIMER ---
let timerId = null;

function formatTime(seconds) {
const m = Math.floor(seconds / 60);
const s = seconds % 60;
return `${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
}

function startTimerLogic(side) {
if (timerId) clearInterval(timerId);
appData.possession.active = side;

timerId = setInterval(() => {
    appData.possession[side]++;
    // Kita broadcast hanya setiap 1 detik agar tidak spam DB
    saveData(); 
    renderUI();
}, 1000);
}

function toggleTimer(side) {
if (appData.possession.active === side) {
    stopTimer();
} else {
    startTimerLogic(side);
    const isHome = (side === 'home');
    document.getElementById('btn-home-play').innerHTML = isHome ? '❚❚<span class="key-badge">Q</span>' : '▶<span class="key-badge">Q</span>';
    document.getElementById('btn-away-play').innerHTML = !isHome ? '❚❚<span class="key-badge">W</span>' : '▶<span class="key-badge">W</span>';
    
    document.getElementById('btn-home-play').classList.toggle('timer-active', isHome);
    document.getElementById('btn-away-play').classList.toggle('timer-active', !isHome);
    
    renderUI();
}
}

function stopTimer() {
if (timerId) {
    clearInterval(timerId);
    timerId = null;
    appData.possession.active = null;
    saveData();
}
document.getElementById('btn-home-play').innerHTML = '▶<span class="key-badge">Q</span>';
document.getElementById('btn-away-play').innerHTML = '▶<span class="key-badge">W</span>';
document.getElementById('btn-home-play').classList.remove('timer-active');
document.getElementById('btn-away-play').classList.remove('timer-active');
renderUI();
}

// --- RESET FUNCTION ---
document.getElementById('btnReset').addEventListener('click', () => {
stopTimer(); // Matikan timer dulu

// Reset Statistik ke 0
Object.keys(appData.stats).forEach(key => {
    appData.stats[key].home = 0;
    appData.stats[key].away = 0;
});

// Reset Penguasaan Bola
appData.possession.home = 0;
appData.possession.away = 0;
appData.possession.active = null;

saveData(); // Simpan ke DB & Broadcast
renderUI(); // Update tampilan config
});

// --- KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', function(event) {
if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
const key = event.key.toLowerCase();
if (key === 'q') toggleTimer('home');
else if (key === 'w') toggleTimer('away');
else if (key === 'e') stopTimer();
});

// --- INIT ---
openDB();