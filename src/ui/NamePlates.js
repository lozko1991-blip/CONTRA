/**
 * NamePlates — нікнейми над гравцями та ботами (2D overlay).
 * Показує ім'я + здоров'я, колір залежить від команди.
 * Оновлюється через проекцію 3D → екран.
 */

import * as THREE from 'three';

const NAMEPLATE_STYLE_ID = 'cs16-nameplates-style';

const NAMEPLATE_CSS = `
.nameplate-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 900;
  overflow: hidden;
}

.nameplate {
  position: absolute;
  transform: translate(-50%, -100%);
  text-align: center;
  font-family: "Segoe UI", Arial, sans-serif;
  line-height: 1.1;
  white-space: nowrap;
  user-select: none;
}

.nameplate-name {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 0 4px rgba(0, 0, 0, 0.8);
  letter-spacing: 0.3px;
}

.nameplate-hp {
  display: block;
  font-size: 9px;
  font-weight: 600;
  color: #7cf07c;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}

.nameplate.enemy .nameplate-name {
  color: #ff8f8f;
}

.nameplate.enemy .nameplate-hp {
  color: #ff8f8f;
}
`;

export class NamePlates {
  constructor() {
    this.injectStyle();

    this.root = document.createElement('div');
    this.root.className = 'nameplate-root';
    document.body.appendChild(this.root);

    this.items = [];
    this.visible = true;
  }

  injectStyle() {
    if (document.getElementById(NAMEPLATE_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = NAMEPLATE_STYLE_ID;
    style.textContent = NAMEPLATE_CSS;
    document.head.appendChild(style);
  }

  /**
   * Оновлення всіх nameplate-ів.
   *
   * @param {Array<{name:string, team:string, alive:boolean, position:THREE.Vector3, localTeam:string, health?:number}>} entities
   * @param {THREE.Camera} camera
   */
  update(entities, camera) {
    if (!this.visible || !entities || !camera) {
      this.clear();
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    let i = 0;

    for (const entity of entities) {
      if (!entity.alive || !entity.position) {
        continue;
      }

      /**
       * Позиція над головою.
       */
      const worldPos = {
        x: entity.position.x,
        y: entity.position.y + 2.1,
        z: entity.position.z
      };

      const vector = new THREE.Vector3(
        worldPos.x,
        worldPos.y,
        worldPos.z
      );

      vector.project(camera);

      /**
       * Поза екраном / за камерою — ховаємо.
       */
      if (vector.z > 1 || vector.z < -1) {
        continue;
      }

      const screenX = (vector.x * 0.5 + 0.5) * width;
      const screenY = (-vector.y * 0.5 + 0.5) * height;

      let item = this.items[i];

      if (!item) {
        item = document.createElement('div');
        item.className = 'nameplate';

        const nameEl = document.createElement('span');
        nameEl.className = 'nameplate-name';
        item.appendChild(nameEl);

        const hpEl = document.createElement('span');
        hpEl.className = 'nameplate-hp';
        item.appendChild(hpEl);

        this.root.appendChild(item);
        this.items.push(item);
      }

      const isEnemy = entity.team !== entity.localTeam;

      item.classList.toggle('enemy', isEnemy);
      item.style.left = `${screenX}px`;
      item.style.top = `${screenY}px`;

      item.firstChild.textContent = entity.name;
      item.lastChild.textContent =
        entity.health != null ? `${entity.health}` : '';

      i++;
    }

    /**
     * Прибираємо зайві.
     */
    while (this.items.length > i) {
      const extra = this.items.pop();
      extra.remove();
    }
  }

  clear() {
    for (const item of this.items) {
      item.remove();
    }
    this.items = [];
  }

  setVisible(visible) {
    this.visible = visible;
    if (!visible) {
      this.clear();
    }
  }

  dispose() {
    this.clear();
    this.root.remove();
  }
}
