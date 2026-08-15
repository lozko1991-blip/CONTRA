const SETTINGS_STYLE_ID = 'cs16-settings-style';

const SETTINGS_CSS = `
.settings-root {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  font-family: "Segoe UI", Arial, sans-serif;
  user-select: none;
}

.settings-root.open {
  display: flex;
}

.settings-panel {
  width: 360px;
  padding: 18px 22px;
  border-radius: 10px;
  background: rgba(18, 22, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
}

.settings-title {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 1px;
  margin-bottom: 16px;
  text-align: center;
  color: #e8e8e8;
}

.settings-row {
  margin-bottom: 14px;
}

.settings-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #c8c8c8;
  margin-bottom: 5px;
}

.settings-value {
  color: #9dd4ff;
  font-weight: 700;
}

.settings-row input[type="range"] {
  width: 100%;
  accent-color: #4a8fd0;
  cursor: pointer;
}

.settings-hint {
  font-size: 11px;
  color: #8a8a8a;
  text-align: center;
  margin-top: 12px;
  opacity: 0.8;
}
`;

export class SettingsMenu {
  constructor({ onChange = null, onClose = null } = {}) {
    this.onChange = onChange;
    this.onClose = onClose;
    this.open = false;

    this.settings = {
      sensitivity: 1.0,
      fov: 90,
      volume: 0.8
    };

    this.load();

    this.injectStyle();
    this.build();

    this._onKeyDown = this._onKeyDown.bind(this);
    window.addEventListener('keydown', this._onKeyDown, true);
  }

  load() {
    try {
      const raw = localStorage.getItem('cs16-settings');

      if (raw) {
        this.settings = { ...this.settings, ...JSON.parse(raw) };
      }
    } catch {
      // ignore
    }
  }

  save() {
    try {
      localStorage.setItem('cs16-settings', JSON.stringify(this.settings));
    } catch {
      // ignore
    }

    this.onChange?.(this.settings);
  }

  _onKeyDown(event) {
    if (event.code === 'Escape') {
      this.toggle();
    }
  }

  toggle() {
    this.open ? this.close() : this.openPanel();
  }

  openPanel() {
    this.open = true;
    this.root.classList.add('open');
    this.syncInputs();
  }

  close() {
    this.open = false;
    this.root.classList.remove('open');

    /**
     * Після закриття меню повертаємо Pointer Lock
     * (якщо гра активна і не відкриті інші меню).
     */
    this.onClose?.();
  }

  injectStyle() {
    const old = document.getElementById(SETTINGS_STYLE_ID);
    if (old) {
      old.textContent = SETTINGS_CSS;
      return;
    }

    const style = document.createElement('style');
    style.id = SETTINGS_STYLE_ID;
    style.textContent = SETTINGS_CSS;

    document.head.appendChild(style);
  }

  build() {
    this.root = document.createElement('div');
    this.root.className = 'settings-root';

    this.root.innerHTML = `
      <div class="settings-panel">
        <div class="settings-title">НАЛАШТУВАННЯ</div>

        <div class="settings-row">
          <div class="settings-label">
            <span>Чутливість миші</span>
            <span class="settings-value" data-val-sens>1.0</span>
          </div>
          <input type="range" min="0.2" max="3" step="0.1" value="1" data-slider-sens>
        </div>

        <div class="settings-row">
          <div class="settings-label">
            <span>FOV</span>
            <span class="settings-value" data-val-fov>90</span>
          </div>
          <input type="range" min="70" max="110" step="1" value="90" data-slider-fov>
        </div>

        <div class="settings-row">
          <div class="settings-label">
            <span>Гучність</span>
            <span class="settings-value" data-val-vol>80%</span>
          </div>
          <input type="range" min="0" max="100" step="5" value="80" data-slider-vol>
        </div>

        <div class="settings-hint">ESC — закрити меню</div>
      </div>
    `;

    document.body.appendChild(this.root);

    this.sensEl = this.root.querySelector('[data-slider-sens]');
    this.fovEl = this.root.querySelector('[data-slider-fov]');
    this.volEl = this.root.querySelector('[data-slider-vol]');
    this.sensVal = this.root.querySelector('[data-val-sens]');
    this.fovVal = this.root.querySelector('[data-val-fov]');
    this.volVal = this.root.querySelector('[data-val-vol]');

    this.sensEl.addEventListener('input', () => {
      this.settings.sensitivity = parseFloat(this.sensEl.value);
      this.syncInputs();
      this.save();
    });

    this.fovEl.addEventListener('input', () => {
      this.settings.fov = parseInt(this.fovEl.value, 10);
      this.syncInputs();
      this.save();
    });

    this.volEl.addEventListener('input', () => {
      this.settings.volume = parseInt(this.volEl.value, 10) / 100;
      this.syncInputs();
      this.save();
    });
  }

  syncInputs() {
    this.sensEl.value = this.settings.sensitivity;
    this.fovEl.value = this.settings.fov;
    this.volEl.value = Math.round(this.settings.volume * 100);

    this.sensVal.textContent = this.settings.sensitivity.toFixed(1);
    this.fovVal.textContent = String(this.settings.fov);
    this.volVal.textContent = Math.round(this.settings.volume * 100) + '%';
  }
}
