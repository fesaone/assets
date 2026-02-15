/**
 * INDEXEDDB HELPER
 */
const DB_NAME = 'LiveMatchDB';
const DB_VERSION = 1;
const STORE_CURRENT = 'current_match';
// Gunakan fallback logo yang sama dengan script admin agar konsisten
const FALLBACK_LOGO = 'https://placehold.co/80'; 

const db = {
  instance: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_CURRENT)) {
          db.createObjectStore(STORE_CURRENT, { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.instance = e.target.result;
        resolve(this.instance);
      };

      request.onerror = (e) => reject(e);
    });
  },

  async saveData(data) {
    if (!this.instance) return;
    const payload = { id: 'active', data: data, timestamp: Date.now() };
    const tx = this.instance.transaction(STORE_CURRENT, 'readwrite');
    tx.objectStore(STORE_CURRENT).put(payload);
  },

  async getData() {
    return new Promise((resolve, reject) => {
      if (!this.instance) return reject('DB not initialized');
      const tx = this.instance.transaction(STORE_CURRENT, 'readonly');
      const store = tx.objectStore(STORE_CURRENT);
      const request = store.get('active');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
};

/**
 * FUNGSI UPDATE GAMBAR (OPTIMASI AGAR TIDAK KEDIP)
 */
function updateImage(imgEl, newUrl) {
  // 1. Siapkan URL final
  let finalUrl = newUrl;
  if (!newUrl || newUrl.trim() === '') {
    finalUrl = FALLBACK_LOGO;
  }

  // 2. Logika Anti-Cache yang Cerdas
  // Jika URL saat ini SAMA dengan URL yang baru (dan bukan fallback),
  // JANGAN ganti src-nya. Ini mencegah gambar berkedip (flickering)
  // setiap kali admin menekan tombol save meskipun logonya tidak berubah.
  const currentSrc = imgEl.getAttribute('src');
  
  // Kita abaikan parameter query (?t=...) saat membandingkan
  const cleanCurrentSrc = currentSrc ? currentSrc.split('?')[0] : '';
  const cleanFinalUrl = finalUrl.split('?')[0];

  // Jika URL berbeda (dan bukan placeholder), tambahkan timestamp untuk force refresh
  if (cleanCurrentSrc !== cleanFinalUrl && finalUrl !== FALLBACK_LOGO) {
      finalUrl = finalUrl + '?t=' + Date.now();
  } else if (cleanCurrentSrc === cleanFinalUrl) {
      // URL sama, tidak perlu update DOM, return saja.
      return;
  }

  // 3. Update DOM dengan teknik swapping untuk transisi halus
  // Set src ke transparent 1x1 gif dulu
  imgEl.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  
  // Gunakan requestAnimationFrame agar browser bisa render blank sebelum gambar baru load
  requestAnimationFrame(() => {
    imgEl.src = finalUrl;
  });
}

/**
 * FUNGSI UPDATE UI UTAMA
 * SINKRON DENGAN SCRIPT ADMIN (Payload UPDATE_MATCH)
 */
function updateDisplay(data) {
  if (!data) return;

  // Update Event Info
  if(data.event?.name) document.getElementById('event_name').textContent = data.event.name;
  // Update Logo Event (jika ada)
  if(data.event?.logo) updateImage(document.getElementById('event_logo'), data.event.logo);

  // Update Match Info
  document.getElementById('match_id').textContent = 'GAME ' + (data.match?.id || '-');
  document.getElementById('group_stage').textContent = data.match?.group || '';
  document.getElementById('age_group').textContent = data.match?.age || '';

  // Update Skor
  document.getElementById('score_home').textContent = data.match?.home_score || 0;
  document.getElementById('score_away').textContent = data.match?.away_score || 0;

  // Update Home Team
  if(data.home?.name) document.getElementById('home_club_name').textContent = data.home.name;
  if(data.home?.short) document.getElementById('home_short_name').textContent = data.home.short;
  if(data.home?.logo) updateImage(document.getElementById('home_logo'), data.home.logo);
  else updateImage(document.getElementById('home_logo'), ''); // Trigger fallback jika null

  // Update Away Team
  if(data.away?.name) document.getElementById('away_club_name').textContent = data.away.name;
  if(data.away?.short) document.getElementById('away_short_name').textContent = data.away.short;
  if(data.away?.logo) updateImage(document.getElementById('away_logo'), data.away.logo);
  else updateImage(document.getElementById('away_logo'), ''); // Trigger fallback jika null

  // Update Status Indikator
  const statusEl = document.getElementById('status');
  if(statusEl) {
      statusEl.textContent = "Live Synced";
      statusEl.className = "connected";
  }
}

/**
 * INISIALISASI
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Buka Database IndexedDB
    await db.init();
    console.log("Display Database initialized.");

    // 2. Load data terakhir dari DB (Restore saat refresh halaman)
    try {
      const savedRecord = await db.getData();
      if (savedRecord && savedRecord.data) {
        console.log("Restoring last known state from DB...");
        updateDisplay(savedRecord.data);
      }
    } catch (err) {
      console.log("No saved data found in DB (Fresh Start).");
    }

    // 3. Setup Broadcast Channel Listener
    // Pastikan nama channel SAMA PERSIS dengan script admin
    const channel = new BroadcastChannel('match_sync_channel');
    
    channel.onmessage = async (event) => {
      console.log("Data diterima dari Admin:", event.data);
      if (event.data && event.data.type === 'UPDATE_MATCH') {
        const newData = event.data.payload;
        
        // Update Tampilan Layar
        updateDisplay(newData);
        
        // Simpan Snapshot ke Database (Offline fallback)
        await db.saveData(newData);
      }
    };

    channel.onerror = (err) => console.error("BroadcastChannel Error:", err);

  } catch (err) {
    console.error("Init Error:", err);
    const statusEl = document.getElementById('status');
    if(statusEl) {
        statusEl.textContent = "System Error";
        statusEl.className = "error";
    }
  }
});