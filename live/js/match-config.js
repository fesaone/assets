/**
 * KONFIGURASI API
 */
const API_BASE_URL = 'https://app.rmedia.id/wp-json/api/live-data';
const SECRET_KEY = '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';
const channel = new BroadcastChannel('match_sync_channel');

// State Global
let currentMatchId = null;
let currentEventData = null;

const EVENT_CACHE_KEY = 'cached_events_data';
const LAST_SELECTED_EVENT_KEY = 'last_selected_event_id'; 
const LAST_SELECTED_MATCH_KEY = 'last_selected_match_key'; 
const PREVIEW_FALLBACK_LOGO = 'https://placehold.co/80';

/**
 * FUNGSI UTILITAS
 */
async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

function broadcastData(payload) {
  channel.postMessage({ type: 'UPDATE_MATCH', payload });
  console.log("Broadcasted:", payload.match.id);
}

function saveLastEventId(eventId) {
  if (eventId) localStorage.setItem(LAST_SELECTED_EVENT_KEY, eventId); 
}

function saveLastMatchId(matchId) {
  if (matchId) localStorage.setItem(LAST_SELECTED_MATCH_KEY, matchId);
}

function getLastMatchId() {
  return localStorage.getItem(LAST_SELECTED_MATCH_KEY);
}

/**
 * FUNGSI UI: Tambah/Kurang Skor
 */
function adjustScore(team, change) {
  const inputId = team === 'home' ? 'disp_home_score' : 'disp_away_score';
  const input = document.getElementById(inputId);
  let currentVal = parseInt(input.value) || 0;
  let newVal = currentVal + change;
  
  if (newVal < 0) newVal = 0;
  input.value = newVal;
}

/**
 * FUNGSI HELPER: TAMPILKAN TOAST
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'loading') icon = '⏳';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  if (type !== 'loading') {
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      });
    }, 3000);
  }
  
  return toast;
}

/**
 * FUNGSI UTAMA: SIMPAN SKOR KE API (PUT)
 */
async function saveScoreToAPI() {
  if (!currentMatchId) {
    showToast("Pilih pertandingan terlebih dahulu!", "error");
    return;
  }

  const homeScore = document.getElementById('disp_home_score').value;
  const awayScore = document.getElementById('disp_away_score').value;
  const btn = document.getElementById('btnSaveGoal');

  const matchIndex = currentEventData.matches.findIndex(m => m.match_id == currentMatchId);
  
  if (matchIndex !== -1) {
      currentEventData.matches[matchIndex].home_score = parseInt(homeScore);
      currentEventData.matches[matchIndex].away_score = parseInt(awayScore);
  }

  const loadingToast = showToast("Sedang menyimpan skor...", "loading");
  const originalText = btn.textContent;
  btn.textContent = "⏳...";
  btn.disabled = true;

  try {
    const targetEventId = currentEventData.event_id || currentEventData.id;
    console.log(`Mengirim PUT ke: ${API_BASE_URL}/${targetEventId}`);

    const response = await fetch(`${API_BASE_URL}/${targetEventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Secret-Key': SECRET_KEY
      },
      body: JSON.stringify(currentEventData) 
    });

    const result = await response.json();

    if (response.ok) {
      console.log("API Response:", result);
      
      try {
        const cachedRaw = sessionStorage.getItem(EVENT_CACHE_KEY);
        if (cachedRaw) {
          const allCached = JSON.parse(cachedRaw);
          delete allCached[targetEventId];
          sessionStorage.setItem(EVENT_CACHE_KEY, JSON.stringify(allCached));
          console.log("Cache dibersihkan, memuat data terbaru...");
        }
      } catch (e) {
        console.warn("Gagal membersihkan cache", e);
      }

      await loadEventDetail(targetEventId, true);
      
      if (loadingToast) {
        loadingToast.classList.remove('show');
        loadingToast.addEventListener('transitionend', () => loadingToast.remove());
      }
      showToast("Skor berhasil diperbarui & Data disinkronkan!", "success");
      
    } else {
      throw new Error(result.message || `Server Error (${response.status})`);
    }

  } catch (error) {
    console.error("Error saving score:", error);
    
    if (loadingToast) {
        loadingToast.classList.remove('show');
        loadingToast.addEventListener('transitionend', () => loadingToast.remove());
    }
    showToast(`Gagal Update: ${error.message}`, "error");
    
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

/**
 * 1. Load List Event
 */
async function loadEventList() {
  try {
    const events = await fetchJSON(API_BASE_URL);
    const select = document.getElementById('eventList');
    const currentVal = select.value;
    
    select.innerHTML = '<option value="" disabled selected>Pilih Event...</option>';

    events.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.event_id;
      opt.textContent = e.event_name || `Event ${e.event_id}`;
      select.appendChild(opt);
    });

    const lastSelectedId = localStorage.getItem(LAST_SELECTED_EVENT_KEY);
    const targetId = lastSelectedId || currentVal;

    if (targetId && select.querySelector(`option[value="${targetId}"]`)) {
        select.value = targetId;
        loadEventDetail(targetId);
    }

  } catch (err) {
    console.error(err);
    showToast("Gagal mengambil daftar event", "error");
  }
}

/**
 * 2. Load Detail Event
 */
async function loadEventDetail(eventId, forceRefresh = false) {
  saveLastEventId(eventId);

  const ul = document.getElementById('matchSchedule');
  if (!forceRefresh) {
    ul.innerHTML = '<li>Loading data...</li>';
  } else {
    console.log("Refreshing data..."); 
  }

  let eventData;

  if (!forceRefresh) {
    try {
      const cachedRaw = sessionStorage.getItem(EVENT_CACHE_KEY);
      if (cachedRaw) {
        const allCached = JSON.parse(cachedRaw);
        if (allCached[eventId]) {
          console.log("Menggunakan data dari Cache");
          eventData = allCached[eventId];
        }
      }
    } catch (e) { console.warn("Cache read error", e); }
  }

  if (!eventData) {
    try {
      console.log("Fetching fresh data from API...");
      const apiData = await fetchJSON(`${API_BASE_URL}/${eventId}`);
      eventData = Array.isArray(apiData) ? apiData[0] : apiData;

      const cacheUpdate = JSON.parse(sessionStorage.getItem(EVENT_CACHE_KEY) || '{}');
      cacheUpdate[eventId] = eventData;
      sessionStorage.setItem(EVENT_CACHE_KEY, JSON.stringify(cacheUpdate));

    } catch (err) {
      ul.innerHTML = '<li>Gagal memuat data dari API.</li>';
      console.error(err);
      return;
    }
  }

  currentEventData = eventData;
  renderSchedule(eventData);
  
  if (forceRefresh && currentMatchId) {
      const activeLi = document.querySelector(`#matchSchedule li[data-match_id="${currentMatchId}"]`);
      if (activeLi) {
          document.querySelectorAll('#matchSchedule li').forEach(el => el.classList.remove('active'));
          activeLi.classList.add('active');
          updateLocalPreview(eventData, currentMatchId); 
      }
  }
}

/**
 * 3. Render List & Restore Selection
 */
function renderSchedule(eventData) {
  const ul = document.getElementById('matchSchedule');
  ul.innerHTML = '';
  
  if (!eventData || !eventData.matches) {
    ul.innerHTML = '<li>Tidak ada pertandingan.</li>';
    return;
  }

  document.getElementById('list_event_name').textContent = eventData.event_name || 'Unknown Event';
  document.getElementById('list_event_logo').src = eventData.event_logo || PREVIEW_FALLBACK_LOGO;

  const clubMap = {};
  (eventData.clubs || []).forEach(c => clubMap[c.club_id] = c);

  const lastMatchId = getLastMatchId();
  let matchToAutoSelect = null;

  eventData.matches.forEach((m, i) => {
    const home = clubMap[m.home_club_id] || {};
    const away = clubMap[m.away_club_id] || {};

    const li = document.createElement('li');
    li.dataset.match_id = m.match_id;
    
    li.innerHTML = `
      <div class="no">G${i + 1}</div>
      <img src="${home.logo_url || PREVIEW_FALLBACK_LOGO}" class="logo">
      <div class="club_name">${home.club_name || 'Unknown'}</div>
      <div class="skor">
        <span class="home_score">${m.home_score}</span> vs <span class="away_score">${m.away_score}</span>
      </div>
      <div class="club_name">${away.club_name || 'Unknown'}</div>
      <img src="${away.logo_url || PREVIEW_FALLBACK_LOGO}" class="logo">
      <div class="group_stage">${m.group_stage || ''}</div>
      <div class="age_group">${m.age_group || ''}</div>
    `;

    li.addEventListener('click', () => {
      document.querySelectorAll('#matchSchedule li').forEach(el => el.classList.remove('active'));
      li.classList.add('active');
      
      saveLastMatchId(m.match_id);
      handleMatchSelection(eventData, m.match_id);
    });

    ul.appendChild(li);

    if (String(m.match_id) === String(lastMatchId)) {
      matchToAutoSelect = li;
    }
  });

  if (matchToAutoSelect) {
    console.log("Restoring last selected match:", lastMatchId);
    matchToAutoSelect.click(); 
  } else if (eventData.matches.length > 0 && !lastMatchId) {
    const firstLi = ul.querySelector('li');
    if(firstLi) firstLi.click();
  }
}

/**
 * 4. Handle Pilihan Match & Broadcast
 */
function handleMatchSelection(eventData, matchId) {
  currentEventData = eventData;
  currentMatchId = matchId;

  updateLocalPreview(eventData, matchId);

  const matchData = eventData.matches.find(m => m.match_id == matchId);
  if (!matchData) return;

  const clubMap = {};
  (eventData.clubs || []).forEach(c => clubMap[c.club_id] = c);

  const payload = {
    event: {
      name: eventData.event_name,
      logo: eventData.event_logo
    },
    match: {
      id: matchData.match_id,
      group: matchData.group_stage,
      age: matchData.age_group,
      home_score: matchData.home_score,
      away_score: matchData.away_score
    },
    home: {
      name: clubMap[matchData.home_club_id]?.club_name,
      short: clubMap[matchData.home_club_id]?.short_name,
      logo: clubMap[matchData.home_club_id]?.logo_url
    },
    away: {
      name: clubMap[matchData.away_club_id]?.club_name,
      short: clubMap[matchData.away_club_id]?.short_name,
      logo: clubMap[matchData.away_club_id]?.logo_url
    }
  };

  broadcastData(payload);
}

/**
 * Update Tampilan Preview Lokal
 */
function updateLocalPreview(eventData, matchId) {
  const matchData = eventData.matches.find(m => m.match_id == matchId);
  if (!matchData) return;

  const clubMap = {};
  (eventData.clubs || []).forEach(c => clubMap[c.club_id] = c);
  const home = clubMap[matchData.home_club_id] || {};
  const away = clubMap[matchData.away_club_id] || {};

  document.getElementById('event_name').textContent = eventData.event_name;
  
  const eventLogoUrl = eventData.event_logo ? eventData.event_logo : PREVIEW_FALLBACK_LOGO;
  document.getElementById('event_logo').src = eventLogoUrl;

  document.getElementById('group_stage').textContent = matchData.group_stage;
  document.getElementById('age_group').textContent = matchData.age_group;
  document.getElementById('match_id').textContent = 'GAME ' + matchData.match_id;
  
  document.getElementById('home_club_name').textContent = home.club_name;
  document.getElementById('home_short_name').textContent = home.short_name;
  document.getElementById('home_logo').src = home.logo_url ? home.logo_url : PREVIEW_FALLBACK_LOGO;
  
  document.getElementById('away_club_name').textContent = away.club_name;
  document.getElementById('away_short_name').textContent = away.short_name;
  document.getElementById('away_logo').src = away.logo_url ? away.logo_url : PREVIEW_FALLBACK_LOGO;

  document.getElementById('disp_home_score').value = matchData.home_score || 0;
  document.getElementById('disp_away_score').value = matchData.away_score || 0;
}

/**
 * Event Listeners Global
 */
document.addEventListener('DOMContentLoaded', () => {
  loadEventList();

  // --- BAGIAN TAMBAHAN: EVENT LISTENER UNTUK TOMBOL ID ---
  const btnHomePlus = document.getElementById('ctrlHomePlus');
  const btnHomeMinus = document.getElementById('ctrlHomeMinus');
  const btnAwayPlus = document.getElementById('ctrlAwayPlus');
  const btnAwayMinus = document.getElementById('ctrlAwayMinus');

  if (btnHomePlus) btnHomePlus.addEventListener('click', () => adjustScore('home', 1));
  if (btnHomeMinus) btnHomeMinus.addEventListener('click', () => adjustScore('home', -1));
  if (btnAwayPlus) btnAwayPlus.addEventListener('click', () => adjustScore('away', 1));
  if (btnAwayMinus) btnAwayMinus.addEventListener('click', () => adjustScore('away', -1));

  // --- BAGIAN TAMBAHAN: EVENT LISTENER UNTUK TOMBOL ID ---
  const btnHomePlus2 = document.getElementById('ctrlHomePlus2');
  const btnHomeMinus2 = document.getElementById('ctrlHomeMinus2');
  const btnAwayPlus2 = document.getElementById('ctrlAwayPlus2');
  const btnAwayMinus2 = document.getElementById('ctrlAwayMinus2');

  if (btnHomePlus2) btnHomePlus2.addEventListener('click', () => adjustScore('home', 1));
  if (btnHomeMinus2) btnHomeMinus2.addEventListener('click', () => adjustScore('home', -1));
  if (btnAwayPlus2) btnAwayPlus2.addEventListener('click', () => adjustScore('away', 1));
  if (btnAwayMinus2) btnAwayMinus2.addEventListener('click', () => adjustScore('away', -1));
  
  // --- AKHIR BAGIAN TAMBAHAN ---
});

document.getElementById('eventList').addEventListener('change', (e) => {
  if (e.target.value) loadEventDetail(e.target.value);
});

document.getElementById('refreshEvents').addEventListener('click', () => {
  sessionStorage.removeItem(EVENT_CACHE_KEY);
  loadEventList();
});

document.getElementById('btnSaveGoal').addEventListener('click', saveScoreToAPI);