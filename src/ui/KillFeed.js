const KILLFEED_STYLE_ID = 'cs16-killfeed-style';

const KILLFEED_CSS = `
.killfeed-root {
  position: fixed;
  top: 70px;
  right: 20px;
  z-index: 2100;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
  font-family: "Segoe UI", Arial, sans-serif;
}

.killfeed-entry {
  padding: 6px 10px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f2f2f2;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.4px;
  opacity: 1;
  transition: opacity 0.45s ease;
}

.killfeed-entry.fade {
  opacity: 0;
}

.killfeed-killer {
  color: #8fd6ff;
}

.killfeed-victim {
  color: #ff9d9d;
}

.killfeed-weapon {
  color: #ffd28a;
  margin: 0 6px;
}

.killfeed-headshot {
  color: #ff5d5d;
  margin-left: 6px;
}
`;

export class KillFeed {
  constructor() {
    this.injectStyle();

    this.root = document.createElement('div');
    this.root.className = 'killfeed-root';

    document.body.appendChild(this.root);
  }

  injectStyle() {
    if (document.getElementById(KILLFEED_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = KILLFEED_STYLE_ID;
    style.textContent = KILLFEED_CSS;

    document.head.appendChild(style);
  }

  weaponLabel(weaponId) {
    const labels = {
      ak47: 'AK-47',
      m4a1: 'M4A1',
      deagle: 'Desert Eagle',
      knife: 'Knife',
      crowbar: 'Crowbar',
      bot_rifle: 'Bot Rifle',
      he: 'HE Grenade',
      flash: 'Flashbang',
      smoke: 'Smoke'
    };

    return labels[weaponId] ?? weaponId ?? 'weapon';
  }

  add({ killerName, victimName, weaponId, headshot }) {
    const entry = document.createElement('div');
    entry.className = 'killfeed-entry';

    const killer = document.createElement('span');
    killer.className = 'killfeed-killer';
    killer.textContent = killerName || 'Player';

    const weapon = document.createElement('span');
    weapon.className = 'killfeed-weapon';
    weapon.textContent = `[${this.weaponLabel(weaponId)}]`;

    const victim = document.createElement('span');
    victim.className = 'killfeed-victim';
    victim.textContent = victimName || 'Player';

    entry.appendChild(killer);
    entry.appendChild(weapon);
    entry.appendChild(victim);

    if (headshot) {
      const hs = document.createElement('span');
      hs.className = 'killfeed-headshot';
      hs.textContent = 'HEADSHOT';

      entry.appendChild(hs);
    }

    this.root.prepend(entry);

    while (this.root.children.length > 6) {
      this.root.removeChild(this.root.lastChild);
    }

    setTimeout(() => {
      entry.classList.add('fade');
    }, 4200);

    setTimeout(() => {
      if (entry.parentNode) {
        entry.parentNode.removeChild(entry);
      }
    }, 4800);
  }

  dispose() {
    if (this.root?.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}
