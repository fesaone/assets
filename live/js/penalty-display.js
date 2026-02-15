// --- KONFIGURASI DB & BROADCAST ---
const DB_NAME = 'PenaltyDB';
const STORE_NAME = 'penalty_data';
const CHANNEL_NAME = 'penalty_sync_channel';

let db;
const channel = new BroadcastChannel(CHANNEL_NAME);

// --- DOM ELEMENTS ---
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
        loadState();
    };

    request.onerror = (event) => {
        console.error("Gagal membuka database:", event.target.errorCode);
    };
}

function loadState() {
    if (!db) return;
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('current_penalty_match');

    request.onsuccess = () => {
        if (request.result) {
            const data = request.result;
            renderBalls(data.homeData, ballsHome, scoreHome);
            renderBalls(data.awayData, ballsAway, scoreAway);
        }
    };
}

// --- LISTENER UPDATE ---
channel.onmessage = (event) => {
    if (event.data.type === 'UPDATE') {
        loadState();
    }
};

// --- FUNGSI RENDER (SAMA DENGAN CONFIG) ---
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

// --- INIT ---
openDB();