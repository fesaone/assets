// --- KONFIGURASI DB & BROADCAST ---
const DB_NAME = 'PenaltyDB';
const STORE_NAME = 'penalty_data';
const CHANNEL_NAME = 'penalty_sync_channel';

let db;
const channel = new BroadcastChannel(CHANNEL_NAME);

// --- KONFIGURASI STATE & DOM ---
const state = {
    home: [],
    away: []
};

const scoreHome = document.getElementById('teamHome-score');
const scoreAway = document.getElementById('teamAway-score');
const ballsHome = document.getElementById('teamHome-balls');
const ballsAway = document.getElementById('teamAway-balls');

// --- INDEXEDDB FUNCTIONS ---

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
        loadState(); // Muat data saat dibuka
    };

    request.onerror = (event) => {
        console.error("Database error:", event.target.errorCode);
    };
}

function saveStateToDB() {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const data = {
        id: 'current_penalty_match',
        homeData: state.home,
        awayData: state.away,
        timestamp: Date.now()
    };

    store.put(data);
}

function loadState() {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('current_penalty_match');

    request.onsuccess = () => {
        if (request.result) {
            const data = request.result;
            state.home = data.homeData || [];
            state.away = data.awayData || [];
            renderBalls(state.home, ballsHome, scoreHome);
            renderBalls(state.away, ballsAway, scoreAway);
        }
    };
}

// --- BROADCAST & SYNC ---
function broadcastUpdate() {
    saveStateToDB(); 
    channel.postMessage({ type: 'UPDATE' });
}

// --- FUNGSI UTAMA ---

function renderBalls(teamData, containerElement, scoreElement) {
    containerElement.innerHTML = '';
    let totalScore = 0;
    teamData.forEach(result => {
        if (result === 'G') totalScore++;
    });

    const count = teamData.length;
    let start = 1;
    let end = 5;

    if (count > 5) {
        start = (Math.ceil(count / 5) * 5) - 4;
        end = start + 4;
    }

    for (let i = start; i <= end; i++) {
        const result = teamData[i - 1];
        const span = document.createElement('span');
        span.textContent = i;

        if (result) {
            if (result === 'G') span.classList.add('gol');
            else if (result === 'M') span.classList.add('miss');
        } 
        containerElement.appendChild(span);
    }
    scoreElement.textContent = totalScore;
}

function addKick(team, type) {
    if (team === 'home') {
        state.home.push(type);
        renderBalls(state.home, ballsHome, scoreHome);
    } else {
        state.away.push(type);
        renderBalls(state.away, ballsAway, scoreAway);
    }
    broadcastUpdate();
}

function undoKick(team) {
    if (team === 'home') {
        if (state.home.length > 0) {
            state.home.pop();
            renderBalls(state.home, ballsHome, scoreHome);
        }
    } else {
        if (state.away.length > 0) {
            state.away.pop();
            renderBalls(state.away, ballsAway, scoreAway);
        }
    }
    broadcastUpdate();
}

// --- EVENT LISTENERS ---
document.getElementById('btnHomeGol').addEventListener('click', () => addKick('home', 'G'));
document.getElementById('btnHomeMiss').addEventListener('click', () => addKick('home', 'M'));
document.getElementById('btnHomeUndo').addEventListener('click', () => undoKick('home'));

document.getElementById('btnAwayGol').addEventListener('click', () => addKick('away', 'G'));
document.getElementById('btnAwayMiss').addEventListener('click', () => addKick('away', 'M'));
document.getElementById('btnAwayUndo').addEventListener('click', () => undoKick('away'));

document.getElementById('btnReset').addEventListener('click', () => {
    state.home = [];
    state.away = [];
    renderBalls(state.home, ballsHome, scoreHome);
    renderBalls(state.away, ballsAway, scoreAway);
    broadcastUpdate();
});

// --- INIT ---
openDB();