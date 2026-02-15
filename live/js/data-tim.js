/* ===============================
   DATA TIM
================================ */
const teams = {
    maniak_fc: {
        name: "Home",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/2025_Indonesia_National_Football_Team_Badge.png/250px-2025_Indonesia_National_Football_Team_Badge.png"
    },
    lawson_fc: {
        name: "Away",
        logo: "https://upload.wikimedia.org/wikipedia/en/8/84/Japan_national_football_team_crest.svg"
    },
    garuda_fc: {
        name: "MNWMN",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/2025_Indonesia_National_Football_Team_Badge.png/250px-2025_Indonesia_National_Football_Team_Badge.png"
    }
};

/* ===============================
   DATA GAME
================================ */
const games = {
    game1: {
        home: "maniak_fc",
        away: "lawson_fc"
    },
    game2: {
        home: "garuda_fc",
        away: "maniak_fc"
    }
};

/* ===============================
   RENDER LOGIC
================================ */
function renderTeam(teamKey, nameId, logoId) {
    const team = teams[teamKey];
    if (!team) return;

    const nameEl = document.getElementById(nameId);
    const logoEl = document.getElementById(logoId);

    if (nameEl) nameEl.textContent = team.name;
    if (logoEl) {
        logoEl.src = team.logo;
        logoEl.loading = "lazy";
        logoEl.onerror = () => logoEl.src = "assets/logo/default.png";
    }
}

function renderGame(gameKey) {
    const game = games[gameKey];
    if (!game) return;

    renderTeam(game.home, "home-name", "home-logo");
    renderTeam(game.away, "away-name", "away-logo");

    document.querySelectorAll('.game-switch button')
        .forEach(btn => btn.classList.remove('active'));

    document.getElementById(`btn-${gameKey}`).classList.add('active');
}

/* ===============================
   EVENT
================================ */
document.getElementById('btn-game-1').addEventListener('click', () => {
    renderGame('game1');
});

document.getElementById('btn-game-2').addEventListener('click', () => {
    renderGame('game2');
});

/* ===============================
   INIT
================================ */
document.addEventListener('DOMContentLoaded', () => {
    renderGame('game1');
});