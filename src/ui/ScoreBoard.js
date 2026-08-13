const SCOREBOARD_STYLE_ID = 'cs16-scoreboard-style';

const SCOREBOARD_CSS = `
.scoreboard-root {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1600;
  pointer-events: none;
  display: none;
  flex-direction: column;
  gap: 10px;
  font-family: "Segoe UI", Arial, sans-serif;
  min-width: 520px;
}

.scoreboard-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.scoreboard-team {
  min-width: 86px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.52);
  border: 1px solid rgba(255, 255, 255, 0.14);
  text-align: center;
}

.scoreboard-team.ct {
  border-color: rgba(90, 170, 255, 0.65);
}

.scoreboard-team.t {
  border-color: rgba(255, 100, 100, 0.65);
}

.scoreboard-team-label {
  font-size: 12px;
  letter-spacing: 1px;
  opacity: 0.8;
}

.scoreboard-team-score {
  font-size: 26px;
  font-weight: 900;
}

.scoreboard-center {
  min-width: 150px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.16);
  text-align: center;
}

.scoreboard-phase {
  font-size: 12px;
  letter-spacing: 1px;
  opacity: 0.8;
}

.scoreboard-time {
  font-size: 24px;
  font-weight: 900;
}

.scoreboard-round {
  font-size: 11px;
  opacity: 0.65;
}

.scoreboard-lists {
  display: flex;
  gap: 12px;
}

.scoreboard-col {
  flex: 1;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px;
}

.scoreboard-col.ct-col {
  border-color: rgba(90, 170, 255, 0.4);
}

.scoreboard-col.t-col {
  border-color: rgba(255, 100, 100, 0.4);
}

.scoreboard-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
  align-items: center;
}

.scoreboard-row:nth-child(odd) {
  background: rgba(255, 255, 255, 0.04);
}

.scoreboard-row.self {
  outline: 1px solid rgba(255, 210, 138, 0.6);
}

.scoreboard-row .sb-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scoreboard-row .sb-kd {
  margin-left: 10px;
  font-weight: 700;
  color: #ddd;
  min-width: 70px;
  text-align: right;
}

.scoreboard-row.dead .sb-name {
  opacity: 0.45;
  text-decoration: line-through;
}
`;

export class ScoreBoard {
  constructor() {
    this.injectStyle();
    this.build();
    this.autoHideTimer = 0;
    this.tabHeld = false;
    this.visible = false;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  _onKeyDown(event) {
    if (event.code === 'Tab') {
      event.preventDefault();
      this.tabHeld = true;
      this.show();
    }
    if (event.code === 'Escape') {
      this.hide();
    }
  }

  _onKeyUp(event) {
    if (event.code === 'Tab') {
      this.tabHeld = false;
    }
  }

  show() {
    if (this.root) {
      this.root.style.display = 'flex';
    }
    this.visible = true;
    this.autoHideTimer = 5;
  }

  hide() {
    if (this.root) {
      this.root.style.display = 'none';
    }
    this.visible = false;
    this.autoHideTimer = 0;
  }

  update(dt) {
    /**
     * Якщо Tab затиснуто — тримаємо таймер на 5,
     * інакше зворотній відлік до авто-приховування.
     */
    if (this.tabHeld) {
      this.autoHideTimer = 5;
    } else if (this.autoHideTimer > 0) {
      this.autoHideTimer -= dt;
      if (this.autoHideTimer <= 0) {
        this.hide();
      }
    }
  }

  injectStyle() {
    const old = document.getElementById(SCOREBOARD_STYLE_ID);
    if (old) {
      old.textContent = SCOREBOARD_CSS;
      return;
    }

    const style = document.createElement('style');
    style.id = SCOREBOARD_STYLE_ID;
    style.textContent = SCOREBOARD_CSS;

    document.head.appendChild(style);
  }

  build() {
    this.root = document.createElement('div');
    this.root.className = 'scoreboard-root';

    this.root.innerHTML = `
      <div class="scoreboard-header">
        <div class="scoreboard-team ct">
          <div class="scoreboard-team-label">CT</div>
          <div class="scoreboard-team-score" data-ct>0</div>
        </div>

        <div class="scoreboard-center">
          <div class="scoreboard-phase" data-phase>—</div>
          <div class="scoreboard-time" data-time>0:00</div>
          <div class="scoreboard-round" data-round>ROUND 1</div>
        </div>

        <div class="scoreboard-team t">
          <div class="scoreboard-team-label">T</div>
          <div class="scoreboard-team-score" data-t>0</div>
        </div>
      </div>

      <div class="scoreboard-lists">
        <div class="scoreboard-col ct-col" data-col-ct></div>
        <div class="scoreboard-col t-col" data-col-t></div>
      </div>
    `;

    document.body.appendChild(this.root);

    this.ctEl = this.root.querySelector('[data-ct]');
    this.tEl = this.root.querySelector('[data-t]');
    this.phaseEl = this.root.querySelector('[data-phase]');
    this.timeEl = this.root.querySelector('[data-time]');
    this.roundEl = this.root.querySelector('[data-round]');
    this.colCt = this.root.querySelector('[data-col-ct]');
    this.colT = this.root.querySelector('[data-col-t]');
  }

  formatTime(value) {
    const seconds = Math.max(0, Math.floor(value));

    const m = Math.floor(seconds / 60);
    const s = seconds % 60;

    return `${m}:${String(s).padStart(2, '0')}`;
  }

  setState({ phase, timeLeft, scores, round, localTeam, players = [] }) {
    if (!this.root) {
      return;
    }

    this.ctEl.textContent = String(scores?.CT ?? 0);
    this.tEl.textContent = String(scores?.T ?? 0);

    const phaseLabels = {
      waiting: 'WAITING',
      buy: 'BUY',
      live: 'LIVE',
      ended: 'ROUND END',
      matchover: 'MATCH OVER'
    };

    this.phaseEl.textContent = phaseLabels[phase] ?? phase;
    this.timeEl.textContent = this.formatTime(timeLeft ?? 0);
    this.roundEl.textContent = `ROUND ${round ?? 1}`;

    this.phaseEl.style.color =
      phase === 'live'
        ? '#ff8f8f'
        : phase === 'buy'
          ? '#9dff9d'
          : '#ffffff';

    this.renderPlayers(players, localTeam);
  }

  renderPlayers(players, localTeam) {
    const ct = [];
    const t = [];

    for (const p of players) {
      const team = p.team ?? (p.self ? localTeam : 'T');
      const row = {
        name: p.name ?? 'Player',
        kills: p.kills ?? 0,
        deaths: p.deaths ?? 0,
        self: !!p.self,
        alive: p.alive !== false
      };

      if (team === 'CT') ct.push(row);
      else t.push(row);
    }

    ct.sort((a, b) => b.kills - a.kills);
    t.sort((a, b) => b.kills - a.kills);

    this.colCt.innerHTML = '';
    this.colT.innerHTML = '';

    for (const row of ct) {
      this.colCt.appendChild(this.buildRow(row));
    }

    for (const row of t) {
      this.colT.appendChild(this.buildRow(row));
    }
  }

  buildRow(row) {
    const el = document.createElement('div');
    el.className = 'scoreboard-row' + (row.self ? ' self' : '') + (row.alive ? '' : ' dead');

    const name = document.createElement('span');
    name.className = 'sb-name';
    name.textContent = row.self ? `${row.name} (YOU)` : row.name;

    const kd = document.createElement('span');
    kd.className = 'sb-kd';
    kd.textContent = `${row.kills} / ${row.deaths}`;

    el.appendChild(name);
    el.appendChild(kd);

    return el;
  }

  dispose() {
    if (this.root?.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}
