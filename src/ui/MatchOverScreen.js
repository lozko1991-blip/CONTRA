const MATCHOVER_STYLE_ID = 'cs16-matchover-style';

const MATCHOVER_CSS = `
.matchover-root {
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: none;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  overflow: auto;
  background:
    repeating-linear-gradient(
      -45deg,
      rgba(255, 255, 255, 0.022) 0px,
      rgba(255, 255, 255, 0.022) 2px,
      transparent 2px,
      transparent 9px
    ),
    radial-gradient(
      ellipse at 50% -10%,
      rgba(90, 120, 140, 0.25),
      transparent 55%
    ),
    linear-gradient(180deg, #0c1116 0%, #131a21 55%, #0c1116 100%);
  font-family: "Segoe UI", Arial, sans-serif;
  color: #eef2f5;
}

.matchover-panel {
  width: 720px;
  max-width: 94vw;
  padding: 38px 34px 30px;
  text-align: center;
  animation: matchover-in 0.45s cubic-bezier(0.2, 0.9, 0.25, 1.2);
}

@keyframes matchover-in {
  from {
    transform: translateY(26px) scale(0.97);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.matchover-label {
  font-size: 13px;
  letter-spacing: 4px;
  opacity: 0.6;
  margin-bottom: 10px;
}

.matchover-title {
  font-family: Impact, "Arial Black", sans-serif;
  font-size: 52px;
  line-height: 1;
  letter-spacing: 3px;
  margin: 0 0 14px;
  text-transform: uppercase;
}

.matchover-title.ct {
  color: #7db4ff;
  text-shadow: 0 0 26px rgba(90, 160, 255, 0.35);
}

.matchover-title.t {
  color: #ff7a6e;
  text-shadow: 0 0 26px rgba(255, 110, 90, 0.35);
}

.matchover-title.draw {
  color: #ffd28a;
}

.matchover-score {
  font-size: 44px;
  font-weight: 900;
  margin-bottom: 26px;
}

.matchover-score .ct { color: #7db4ff; }
.matchover-score .t { color: #ff7a6e; }

.matchover-score .sep {
  opacity: 0.4;
  margin: 0 14px;
}

.matchover-mvp {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 12px 22px;
  margin-bottom: 26px;
  border: 1px solid rgba(255, 210, 138, 0.5);
  background: rgba(255, 210, 138, 0.07);
}

.matchover-mvp-star {
  font-size: 26px;
  color: #ffd28a;
}

.matchover-mvp-name {
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 1px;
}

.matchover-mvp-kd {
  font-size: 14px;
  opacity: 0.75;
}

.matchover-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 28px;
}

.matchover-table th {
  font-size: 11px;
  letter-spacing: 2px;
  opacity: 0.55;
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

.matchover-table .num {
  text-align: right;
}

.matchover-table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 15px;
}

.matchover-table td.num {
  text-align: right;
  font-weight: 800;
}

.matchover-team-badge {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 8px;
}

.matchover-team-badge.ct { background: #7db4ff; }
.matchover-team-badge.t { background: #ff7a6e; }

.matchover-actions {
  display: flex;
  gap: 14px;
  justify-content: center;
}

.matchover-btn {
  padding: 13px 30px;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 2px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  transition: transform 0.12s ease, background 0.12s ease;
}

.matchover-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  transform: translateY(-1px);
}

.matchover-btn.primary {
  background: linear-gradient(90deg, #3fae5a, #2c8644);
  border: none;
}

.matchover-btn.primary:hover {
  filter: brightness(1.1);
}
`;

export class MatchOverScreen {
  constructor({ onRematch = null, isHost = false } = {}) {
    this.onRematch = onRematch;
    this.isHost = isHost;
    this.visible = false;

    this.injectStyle();
    this.build();
  }

  injectStyle() {
    if (document.getElementById(MATCHOVER_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = MATCHOVER_STYLE_ID;
    style.textContent = MATCHOVER_CSS;

    document.head.appendChild(style);
  }

  build() {
    this.root = document.createElement('div');
    this.root.className = 'matchover-root';

    this.root.innerHTML = `
      <div class="matchover-panel">
        <div class="matchover-label">MATCH OVER — MR15</div>
        <h1 class="matchover-title" data-title>CT WIN</h1>
        <div class="matchover-score" data-score></div>

        <div class="matchover-mvp">
          <span class="matchover-mvp-star">★</span>
          <span>
            <span class="matchover-mvp-name" data-mvp-name>—</span>
            <div class="matchover-mvp-kd" data-mvp-kd></div>
          </span>
        </div>

        <table class="matchover-table">
          <thead>
            <tr>
              <th>PLAYER</th>
              <th>TEAM</th>
              <th class="num">KILLS</th>
              <th class="num">DEATHS</th>
            </tr>
          </thead>
          <tbody data-stats></tbody>
        </table>

        <div class="matchover-actions">
          <button class="matchover-btn primary" data-rematch>REMATCH</button>
          <button class="matchover-btn" data-lobby>RETURN TO LOBBY</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.root);

    this.titleEl = this.root.querySelector('[data-title]');
    this.scoreEl = this.root.querySelector('[data-score]');
    this.mvpNameEl = this.root.querySelector('[data-mvp-name]');
    this.mvpKdEl = this.root.querySelector('[data-mvp-kd]');
    this.statsEl = this.root.querySelector('[data-stats]');
    this.rematchBtn = this.root.querySelector('[data-rematch]');
    this.lobbyBtn = this.root.querySelector('[data-lobby]');

    this.rematchBtn.addEventListener('click', () => {
      this.onRematch?.();
    });

    this.lobbyBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }

  setIsHost(isHost) {
    this.isHost = isHost;

    if (this.rematchBtn) {
      this.rematchBtn.style.display = isHost ? '' : 'none';
    }
  }

  show({ winner, scores, stats = [] }) {
    this.visible = true;
    this.root.style.display = 'flex';

    const cls =
      winner === 'CT' ? 'ct' : winner === 'T' ? 't' : 'draw';

    this.titleEl.className = `matchover-title ${cls}`;

    this.titleEl.textContent =
      winner === 'CT'
        ? 'COUNTER-TERRORISTS WIN'
        : winner === 'T'
          ? 'TERRORISTS WIN'
          : 'DRAW';

    this.scoreEl.innerHTML =
      `<span class="ct">${scores?.CT ?? 0}</span>` +
      `<span class="sep">:</span>` +
      `<span class="t">${scores?.T ?? 0}</span>`;

    const list = (stats ?? [])
      .slice()
      .sort((a, b) => b.kills - a.kills);

    const mvp = list[0];

    if (mvp) {
      this.mvpNameEl.textContent = mvp.name ?? 'Player';
      this.mvpKdEl.textContent = `${mvp.kills} K / ${mvp.deaths} D`;
    } else {
      this.mvpNameEl.textContent = '—';
      this.mvpKdEl.textContent = '';
    }

    this.statsEl.innerHTML = '';

    for (const entry of list) {
      const row = document.createElement('tr');

      const nameCell = document.createElement('td');

      const badge = document.createElement('span');
      badge.className = `matchover-team-badge ${
        entry.team === 'CT' ? 'ct' : 't'
      }`;

      nameCell.appendChild(badge);
      nameCell.appendChild(
        document.createTextNode(entry.name ?? 'Player')
      );

      const teamCell = document.createElement('td');
      teamCell.textContent = entry.team ?? '—';

      const killsCell = document.createElement('td');
      killsCell.className = 'num';
      killsCell.textContent = String(entry.kills ?? 0);

      const deathsCell = document.createElement('td');
      deathsCell.className = 'num';
      deathsCell.textContent = String(entry.deaths ?? 0);

      row.appendChild(nameCell);
      row.appendChild(teamCell);
      row.appendChild(killsCell);
      row.appendChild(deathsCell);

      this.statsEl.appendChild(row);
    }

    this.setIsHost(this.isHost);
  }

  hide() {
    if (!this.visible) {
      return;
    }

    this.visible = false;
    this.root.style.display = 'none';
  }

  dispose() {
    if (this.root?.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}
