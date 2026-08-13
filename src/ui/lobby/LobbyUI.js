const LOBBY_STYLE_ID = 'cs16-lobby-style';

const LOBBY_CSS = `
.lobby-root {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 30% 20%, rgba(70, 110, 90, 0.35), transparent 35%),
    radial-gradient(circle at 80% 80%, rgba(50, 80, 120, 0.35), transparent 30%),
    linear-gradient(135deg, #10151a, #1b232b 55%, #10151a);
  font-family: "Segoe UI", Arial, sans-serif;
  color: #f2f2f2;
}

.lobby-panel {
  width: 760px;
  max-width: 94vw;
  padding: 26px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(10, 14, 18, 0.82);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
}

.lobby-title {
  margin: 0 0 18px;
  font-size: 30px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #9dff9d;
}

.lobby-section {
  margin-bottom: 18px;
}

.lobby-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  letter-spacing: 1px;
  opacity: 0.75;
}

.lobby-name {
  width: 100%;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  outline: none;
  font-size: 15px;
}

.lobby-name:focus {
  border-color: rgba(120, 255, 140, 0.6);
}

.lobby-maps {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.lobby-map-btn {
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  cursor: pointer;
  font-weight: 700;
  letter-spacing: 1px;
}

.lobby-map-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.lobby-map-btn.active {
  border-color: rgba(120, 255, 140, 0.75);
  background: rgba(70, 180, 90, 0.22);
  color: #d7ffd7;
}

.lobby-players {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.lobby-player {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
}

.lobby-player-name {
  font-weight: 700;
}

.lobby-player-badge {
  font-size: 11px;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(120, 255, 140, 0.18);
  color: #c9ffc9;
  letter-spacing: 1px;
}

.lobby-start {
  width: 100%;
  padding: 14px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(90deg, #3fae5a, #2c8644);
  color: #fff;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 2px;
  cursor: pointer;
}

.lobby-votes {
  margin-left: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(120, 255, 140, 0.16);
  color: #c9ffc9;
  font-size: 12px;
}

.lobby-map-btn.voted {
  outline: 2px solid rgba(255, 210, 138, 0.8);
  outline-offset: 1px;
}

.lobby-start:hover {
  filter: brightness(1.08);
}

.lobby-start:disabled {
  opacity: 0.6;
  cursor: default;
}

.lobby-status {
  margin-top: 12px;
  font-size: 13px;
  opacity: 0.75;
}
`;

export class LobbyUI {
  constructor({ lobby, onStart = null }) {
    this.lobby = lobby;
    this.onStart = onStart;

    this.maps = lobby.maps;

    this.injectStyle();
    this.build();
    this.bind();

    this.lobby.onPlayersChange = (players) => {
      this.renderPlayers(players);
    };

    this.lobby.onMapChange = (mapId) => {
      this.renderMap(mapId);
    };

    this.lobby.onVotesChange = (votes) => {
      this.renderVotes(votes);
    };

    this.lobby.onStart = (mapId) => {
      this.onStart?.(mapId);
    };

    this.renderMap(this.lobby.currentMap);
    this.renderPlayers([]);
  }

  injectStyle() {
    if (document.getElementById(LOBBY_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = LOBBY_STYLE_ID;
    style.textContent = LOBBY_CSS;

    document.head.appendChild(style);
  }

  build() {
    this.root = document.createElement('div');
    this.root.className = 'lobby-root';

    this.root.innerHTML = `
      <div class="lobby-panel">
        <h1 class="lobby-title">CS16 WEB LOBBY</h1>

        <div class="lobby-section">
          <label class="lobby-label">NAME</label>
          <input class="lobby-name" type="text" maxlength="18" placeholder="Player" />
        </div>

        <div class="lobby-section">
          <label class="lobby-label">MAP</label>
          <div class="lobby-maps"></div>
        </div>

        <div class="lobby-section">
          <label class="lobby-label">
            PLAYERS <span class="lobby-count">0</span>
          </label>
          <ul class="lobby-players"></ul>
        </div>

        <button class="lobby-start">START GAME</button>
        <div class="lobby-status">Map: —</div>
      </div>
    `;

    document.body.appendChild(this.root);

    this.nameInput = this.root.querySelector('.lobby-name');
    this.mapsEl = this.root.querySelector('.lobby-maps');
    this.playersEl = this.root.querySelector('.lobby-players');
    this.countEl = this.root.querySelector('.lobby-count');
    this.startBtn = this.root.querySelector('.lobby-start');
    this.statusEl = this.root.querySelector('.lobby-status');

    this.buildMapButtons();
  }

  buildMapButtons() {
    this.mapsEl.innerHTML = '';

    this.mapButtons = new Map();
    this.voteBadges = new Map();

    for (const map of this.maps) {
      const button = document.createElement('button');

      button.className = 'lobby-map-btn';
      button.textContent = map.name;

      const badge = document.createElement('span');
      badge.className = 'lobby-votes';
      badge.textContent = '0';

      button.addEventListener('click', () => {
        this.lobby.voteFor(map.id);
      });

      button.appendChild(badge);

      this.mapsEl.appendChild(button);
      this.mapButtons.set(map.id, button);
      this.voteBadges.set(map.id, badge);
    }
  }

  bind() {
    this.nameInput.addEventListener('change', () => {
      this.lobby.setName(this.nameInput.value);
    });

    this.nameInput.addEventListener('keydown', (event) => {
      event.stopPropagation();
    });

    this.startBtn.addEventListener('click', () => {
      this.startBtn.disabled = true;

      this.lobby.startGame();

      setTimeout(() => {
        this.startBtn.disabled = false;
      }, 1000);
    });
  }

  renderPlayers(players) {
    this.playersEl.innerHTML = '';

    this.countEl.textContent = String(players.length);

    for (const player of players) {
      const li = document.createElement('li');
      li.className = 'lobby-player';

      const name = document.createElement('span');
      name.className = 'lobby-player-name';
      name.textContent = player.name || 'Player';

      li.appendChild(name);

      if (player.self || player.id === this.lobby.id) {
        const badge = document.createElement('span');
        badge.className = 'lobby-player-badge';
        badge.textContent = 'YOU';

        li.appendChild(badge);
      }

      this.playersEl.appendChild(li);
    }
  }

  renderMap(mapId) {
    for (const [id, button] of this.mapButtons) {
      button.classList.toggle('active', id === mapId);
    }

    const map = this.maps.find((m) => m.id === mapId);

    this.statusEl.textContent = `Map: ${map?.name ?? mapId}`;
  }

  renderVotes(votes) {
    const counts = {};

    for (const mapId of this.mapButtons.keys()) {
      counts[mapId] = 0;
    }

    for (const mapId of Object.values(votes)) {
      counts[mapId] = (counts[mapId] ?? 0) + 1;
    }

    let bestMap = null;
    let bestCount = 0;

    for (const [mapId, count] of Object.entries(counts)) {
      const badge = this.voteBadges.get(mapId);

      if (badge) {
        badge.textContent = String(count);
      }

      if (count > bestCount) {
        bestCount = count;
        bestMap = mapId;
      }
    }

    for (const [mapId, button] of this.mapButtons) {
      button.classList.toggle(
        'active',
        bestCount > 0 && mapId === bestMap
      );

      button.classList.toggle(
        'voted',
        votes[this.lobby.id] === mapId
      );
    }

    const winner = bestCount > 0 ? bestMap : this.lobby.currentMap;

    if (this.statusEl) {
      this.statusEl.textContent = `Map: ${winner}`;
    }
  }

  show() {
    this.root.style.display = 'flex';
  }

  hide() {
    this.root.style.display = 'none';
  }

  dispose() {
    if (this.root?.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}
