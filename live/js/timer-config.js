// --- FILE: timer-config.js
const DB_NAME = 'MatchTimerDB';
const STORE_NAME = 'timer_data';
const CHANNEL_NAME = 'timer_sync_channel';
let db;
const channel = new BroadcastChannel(CHANNEL_NAME);

const timerDisplay = document.getElementById('timer');
const additionalTimeDisplay = document.getElementById('additionalTime');
const inputBabak = document.getElementById('babak');
const inputExtraTime = document.getElementById('extra-time');
const infoNormal = document.getElementById('info-normal');
const infoExtra = document.getElementById('info-extra');
const dbStatus = document.getElementById('dbStatus');

const btnStartH1 = document.getElementById('btnStartH1');
const btnHalfTime = document.getElementById('btnHalfTime');
const btnStartH2 = document.getElementById('btnStartH2');
const btnFullTime = document.getElementById('btnFullTime');
const btnStartET1 = document.getElementById('btnStartET1');
const btnStartET2 = document.getElementById('btnStartET2');
const btnReset = document.getElementById('btnReset');

let timerInterval = null;
let currentTimeMs = 0; 
let halfLimit = 0;     
let currentState = 'IDLE';

const STATE = { IDLE: 'IDLE', H1: 'H1', HT: 'HT', H2: 'H2', FT: 'FT', ET1: 'ET1', ET2: 'ET2' };

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
        dbStatus.textContent = "Database Terhubung";
        loadState();
    };
    request.onerror = (event) => {
        console.error("Database error:", event.target.errorCode);
        dbStatus.textContent = "Database Error";
    };
}

function saveStateToDB() {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const data = {
        id: 'current_match',
        currentTimeMs: currentTimeMs,
        halfLimit: halfLimit,
        state: currentState,
        configNormal: parseInt(inputBabak.value) || 90,
        configExtra: parseInt(inputExtraTime.value) || 30,
        timestamp: Date.now()
    };
    store.put(data);
}

function loadState() {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('current_match');
    request.onsuccess = () => {
        if (request.result) {
            const data = request.result;
            currentTimeMs = data.currentTimeMs;
            halfLimit = data.halfLimit;
            currentState = data.state;
            inputBabak.value = data.configNormal;
            inputExtraTime.value = data.configExtra;
            updateInfoText();
            updateUI();
            if (currentState !== 'IDLE' && currentState !== 'HT' && currentState !== 'FT') {
                startTimer();
            }
        }
    };
}

function broadcastUpdate() {
    saveStateToDB();
    channel.postMessage({ type: 'UPDATE' });
}

function updateInfoText() {
    const totalNormal = parseInt(inputBabak.value) || 0;
    const totalExtra = parseInt(inputExtraTime.value) || 0;
    infoNormal.textContent = `1/2 = ${totalNormal / 2} menit`;
    infoExtra.textContent = `1/2 = ${totalExtra / 2} menit`;
}

inputBabak.addEventListener('input', () => { updateInfoText(); broadcastUpdate(); });
inputExtraTime.addEventListener('input', () => { updateInfoText(); broadcastUpdate(); });

function getValues() {
    return {
        normalTotal: parseInt(inputBabak.value) || 0,
        normalHalf: (parseInt(inputBabak.value) || 0) / 2,
        extraTotal: parseInt(inputExtraTime.value) || 0,
        extraHalf: (parseInt(inputExtraTime.value) || 0) / 2
    };
}

function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        currentTimeMs += 100; 
        updateUI();
        broadcastUpdate(); 
    }, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateUI() {
    // Logika Update UI
    if (currentState === STATE.IDLE) {
        // Jika IDLE (terutama setelah Reset), tampilkan "LIVE"
        timerDisplay.textContent = "LIVE";
        additionalTimeDisplay.textContent = "";
    } 
    else if (currentState === STATE.HT) {
        timerDisplay.textContent = "Half Time";
        additionalTimeDisplay.textContent = "";
    } 
    else if (currentState === STATE.FT) {
        timerDisplay.textContent = "Full Time";
        additionalTimeDisplay.textContent = "";
    } 
    else {
        // Untuk H1, H2, ET1, ET2 tampilkan waktu
        timerDisplay.textContent = formatTime(currentTimeMs);
        const currentMinutes = Math.floor(currentTimeMs / 60000);
        if (currentMinutes > halfLimit) {
            const injuryTime = currentMinutes - halfLimit;
            additionalTimeDisplay.textContent = `${injuryTime}+`;
        } else {
            additionalTimeDisplay.textContent = "";
        }
    }
}

btnStartH1.addEventListener('click', () => {
    stopTimer(); currentState = STATE.H1;
    const v = getValues(); currentTimeMs = 0; halfLimit = v.normalHalf;
    startTimer(); broadcastUpdate();
});

btnHalfTime.addEventListener('click', () => {
    stopTimer(); currentState = STATE.HT;
    updateUI(); broadcastUpdate();
});

btnStartH2.addEventListener('click', () => {
    stopTimer(); currentState = STATE.H2;
    const v = getValues(); currentTimeMs = v.normalHalf * 60 * 1000; halfLimit = v.normalTotal;
    startTimer(); broadcastUpdate();
});

btnFullTime.addEventListener('click', () => {
    stopTimer(); currentState = STATE.FT;
    updateUI(); broadcastUpdate();
});

btnStartET1.addEventListener('click', () => {
    stopTimer(); currentState = STATE.ET1;
    const v = getValues(); currentTimeMs = v.normalTotal * 60 * 1000; halfLimit = v.normalTotal + v.extraHalf;
    startTimer(); broadcastUpdate();
});

btnStartET2.addEventListener('click', () => {
    stopTimer(); currentState = STATE.ET2;
    const v = getValues(); currentTimeMs = (v.normalTotal + v.extraHalf) * 60 * 1000; halfLimit = v.normalTotal + v.extraTotal;
    startTimer(); broadcastUpdate();
});

btnReset.addEventListener('click', () => {
    stopTimer();
    currentState = STATE.IDLE; 
    currentTimeMs = 0;        
    halfLimit = 0;            
    updateUI();               
    broadcastUpdate();        
});

openDB();
updateInfoText();



// --- STYLE BUTTON
document.addEventListener('DOMContentLoaded', () => {

    const STORAGE_KEY = 'timerConfig-button';

    const buttons = document.querySelectorAll(
        '#btnStartH1, #btnHalfTime, #btnStartH2, #btnFullTime, #btnStartET1, #btnStartET2, #btnReset'
    );

    /* ===============================
       RESTORE STATE
    =============================== */
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
        const savedBtn = document.getElementById(savedId);
        if (savedBtn) {
            savedBtn.classList.add('active');
        }
    }

    /* ===============================
       CLICK HANDLER
    =============================== */
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {

            // clear active
            buttons.forEach(b => b.classList.remove('active'));

            // set active
            btn.classList.add('active');

            // save to localStorage
            localStorage.setItem(STORAGE_KEY, btn.id);
        });
    });

});