import { SHOP_PRICES } from '../game/EconomyManager.js';

const BUYMENU_STYLE_ID = 'cs16-buymenu-style';

const BUYMENU_CSS = `
.buymenu-root {
  position: fixed;
  inset: 0;
  z-index: 1800;
  display: none;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-family: "Segoe UI", Arial, sans-serif;
}

.buymenu-panel {
  width: 560px;
  max-width: 92vw;
  padding: 22px;
  border-radius: 10px;
  background: rgba(5, 8, 10, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #fff;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
}

.buymenu-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
}

.buymenu-title {
  margin: 0;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #9dff9d;
}

.buymenu-money {
  font-size: 20px;
  font-weight: 900;
  color: #7dff8a;
}

.buymenu-row {
  display: grid;
  grid-template-columns: 56px 1fr 90px;
  gap: 10px;
  align-items: center;
  padding: 8px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 16px;
}

.buymenu-row.disabled {
  opacity: 0.38;
}

.buymenu-key {
  font-weight: 900;
  color: #ffd28a;
}

.buymenu-price {
  text-align: right;
  font-weight: 700;
  color: #7dff8a;
}

.buymenu-status {
  margin-top: 14px;
  font-size: 13px;
  opacity: 0.75;
  letter-spacing: 0.5px;
}
`;

const BUY_ITEMS = [
  { key: '1', id: 'ak47', name: 'AK-47' },
  { key: '2', id: 'm4a1', name: 'M4A1' },
  { key: '3', id: 'deagle', name: 'Desert Eagle' },
  { key: '4', id: 'armor', name: 'Kevlar Armor' },
  { key: '5', id: 'he', name: 'HE Grenade' },
  { key: '6', id: 'flash', name: 'Flashbang' },
  { key: '7', id: 'smoke', name: 'Smoke Grenade' }
];

export class BuyMenu {
  constructor({ economy = null, onBuy = null, onClose = null } = {}) {
    this.economy = economy;
    this.onBuy = onBuy;
    this.onClose = onClose;

    this.enabled = false;
    this.open = false;

    this.rows = [];

    this.injectStyle();
    this.build();

    this.onKeyDown = this.onKeyDown.bind(this);

    window.addEventListener('keydown', this.onKeyDown, true);
  }

  injectStyle() {
    if (document.getElementById(BUYMENU_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = BUYMENU_STYLE_ID;
    style.textContent = BUYMENU_CSS;

    document.head.appendChild(style);
  }

  build() {
    this.root = document.createElement('div');
    this.root.className = 'buymenu-root';

    const panel = document.createElement('div');
    panel.className = 'buymenu-panel';

    const header = document.createElement('div');
    header.className = 'buymenu-header';

    const title = document.createElement('h2');
    title.className = 'buymenu-title';
    title.textContent = 'BUY MENU';

    this.moneyEl = document.createElement('div');
    this.moneyEl.className = 'buymenu-money';
    this.moneyEl.textContent = '$0';

    header.appendChild(title);
    header.appendChild(this.moneyEl);
    panel.appendChild(header);

    for (const item of BUY_ITEMS) {
      const row = document.createElement('div');
      row.className = 'buymenu-row';
      row.dataset.id = item.id;

      const key = document.createElement('span');
      key.className = 'buymenu-key';
      key.textContent = item.key;

      const name = document.createElement('span');
      name.textContent = item.name;

      const price = document.createElement('span');
      price.className = 'buymenu-price';
      price.textContent = `$${SHOP_PRICES[item.id] ?? 0}`;

      row.appendChild(key);
      row.appendChild(name);
      row.appendChild(price);

      panel.appendChild(row);
      this.rows.push(row);
    }

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'buymenu-status';

    panel.appendChild(this.statusEl);

    this.root.appendChild(panel);
    document.body.appendChild(this.root);
  }

  setEnabled(enabled) {
    this.enabled = enabled;

    if (!enabled) {
      this.hide();
    }
  }

  show() {
    if (!this.enabled) {
      return;
    }

    this.open = true;
    this.root.style.display = 'flex';
    this.refresh();
  }

  hide() {
    this.open = false;
    this.root.style.display = 'none';
    this.onClose?.();
  }

  setStatus(text) {
    if (this.statusEl) {
      this.statusEl.textContent = text ?? '';
    }
  }

  refresh() {
    if (!this.enabled) {
      return;
    }

    const money = this.economy?.money ?? 0;

    if (this.moneyEl) {
      this.moneyEl.textContent = `$${money}`;
    }

    for (const row of this.rows) {
      const price = SHOP_PRICES[row.dataset.id] ?? 0;
      row.classList.toggle('disabled', money < price);
    }
  }

  onKeyDown(event) {
    if (!this.enabled) {
      return;
    }

    if (event.code === 'KeyB') {
      event.stopImmediatePropagation();
      event.preventDefault();

      if (this.open) {
        this.hide();
      } else {
        this.show();
      }

      return;
    }

    if (!this.open) {
      return;
    }

    if (event.code === 'Escape') {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.hide();
      return;
    }

    const item = BUY_ITEMS.find(
      (entry) => `Digit${entry.key}` === event.code
    );

    if (item) {
      event.stopImmediatePropagation();
      event.preventDefault();

      this.onBuy?.(item.id);
      this.refresh();
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown, true);

    if (this.root?.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}
