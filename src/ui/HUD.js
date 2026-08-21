/**
 * HUD:
 * - динамічний приціл;
 * - HP / Armor;
 * - ammo;
 * - round timer;
 * - radar;
 * - hitmarker.
 */

const HUD_STYLE_ID = 'cs16-hud-style';

const HUD_CSS = `
.hud-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
  font-family: "Segoe UI", Arial, sans-serif;
  color: #f5f5f5;
  user-select: none;
}

.hud-crosshair {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
}

.ch-line {
  position: absolute;
  background: #32ff64;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.85);
}

.hud-crosshair.hit .ch-line {
  background: #ff4d4d;
}

.ch-top {
  width: 2px;
  height: 8px;
  left: -1px;
  top: 0;
}

.ch-bottom {
  width: 2px;
  height: 8px;
  left: -1px;
  top: 0;
}

.ch-left {
  width: 8px;
  height: 2px;
  left: 0;
  top: -1px;
}

.ch-right {
  width: 8px;
  height: 2px;
  left: 0;
  top: -1px;
}

.hud-damage {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 42%,
    rgba(205, 25, 25, 0.55) 100%
  );
  opacity: 0;
  pointer-events: none;
}

.hud-damage-dir {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  pointer-events: none;
  opacity: 0;
}

.hud-damage-dir::after {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-bottom: 14px solid rgba(255, 40, 40, 0.8);
  filter: drop-shadow(0 0 6px rgba(255, 0, 0, 0.6));
}

.hud-timer {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 14px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 1px;
}

.hud-timer.danger {
  color: #ff5555;
  border-color: rgba(255, 80, 80, 0.55);
}

.hud-round-result {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  font-size: 48px;
  font-weight: 900;
  letter-spacing: 6px;
  text-transform: uppercase;
  text-shadow: 0 0 20px rgba(255,255,255,0.4), 0 2px 8px rgba(0,0,0,0.8);
  pointer-events: none;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  opacity: 0;
}

.hud-round-result.show {
  transform: translate(-50%, -50%) scale(1);
  opacity: 1;
}

.hud-round-result.win {
  color: #4cff4c;
}

.hud-round-result.lose {
  color: #ff4040;
}

.hud-round-result.draw {
  color: #cccccc;
}

.hud-radar {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 180px;
  height: 180px;
  opacity: 0.94;
}

.hud-bottom-left {
  position: absolute;
  left: 20px;
  bottom: 18px;
  display: flex;
  gap: 18px;
  align-items: flex-end;
}

.hud-stat {
  display: flex;
  flex-direction: column;
  min-width: 78px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
}

.hud-label {
  font-size: 11px;
  opacity: 0.72;
  letter-spacing: 1px;
  margin-bottom: 3px;
}

.hud-value {
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
}

.hud-value.low {
  color: #ff5555;
}

.hud-bottom-right {
  position: absolute;
  right: 20px;
  bottom: 18px;
  text-align: right;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  min-width: 150px;
}

.hud-weapon {
  font-size: 14px;
  letter-spacing: 1px;
  opacity: 0.86;
  margin-bottom: 4px;
}

.hud-ammo {
  font-size: 30px;
  font-weight: 900;
}

.hud-reload {
  display: none;
  margin-top: 4px;
  font-size: 12px;
  color: #ffcc44;
  letter-spacing: 1px;
}

.hud-bottom-right.reloading .hud-reload {
  display: block;
}

.hud-bottom-right.reloading .hud-ammo {
  opacity: 0.55;
}

.hud-money {
  color: #7dff8a;
}

.hud-flash {
  position: absolute;
  inset: 0;
  background: #ffffff;
  opacity: 0;
  pointer-events: none;
}

.hud-grenades {
  margin-top: 6px;
  font-size: 13px;
  letter-spacing: 1px;
}

.hud-grenade-item {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.hud-grenade-item.selected {
  border-color: rgba(125, 255, 138, 0.8);
  color: #7dff8a;
}

.hud-grenade-item.empty {
  opacity: 0.35;
}
`;

export class HUD {
  constructor({ player, weaponManager, gameState = null }) {
    this.player = player;
    this.weaponManager = weaponManager;

    this.gameState = gameState ?? {
      health: 100,
      armor: 100
    };

    this.radarEntities = new Map();
    this.nextRadarId = 1;
    this.mapRects = [];

    this.radarSize = 180;
    this.radarRange = 55;

    this.roundEndTime = null;

    this.hitMarkerTime = 0;

    this.onWeaponHit = this.onWeaponHit.bind(this);

    this.injectStyle();
    this.build();

    window.addEventListener('weapon:hit', this.onWeaponHit);
  }

  injectStyle() {
    if (document.getElementById(HUD_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = HUD_STYLE_ID;
    style.textContent = HUD_CSS;

    document.head.appendChild(style);
  }

  build() {
    this.root = document.createElement('div');
    this.root.className = 'hud-root';

    /**
     * Crosshair
     */
    this.crosshair = document.createElement('div');
    this.crosshair.className = 'hud-crosshair';

    this.lines = {};

    const lineNames = ['top', 'bottom', 'left', 'right'];

    for (const name of lineNames) {
      const line = document.createElement('div');
      line.className = `ch-line ch-${name}`;

      this.crosshair.appendChild(line);
      this.lines[name] = line;
    }

    this.root.appendChild(this.crosshair);

    this.damageOverlay = document.createElement('div');
    this.damageOverlay.className = 'hud-damage';
    this.root.appendChild(this.damageOverlay);

    this.damageDir = document.createElement('div');
    this.damageDir.className = 'hud-damage-dir';
    this.root.appendChild(this.damageDir);

    this.flashOverlay = document.createElement('div');
    this.flashOverlay.className = 'hud-flash';
    this.root.appendChild(this.flashOverlay);

    this.roundResult = document.createElement('div');
    this.roundResult.className = 'hud-round-result';
    this.root.appendChild(this.roundResult);

    /**
     * Round timer
     */
    this.timer = document.createElement('div');
    this.timer.className = 'hud-timer';
    this.timer.textContent = '2:00';

    this.root.appendChild(this.timer);

    /**
     * Radar
     */
    this.radarCanvas = document.createElement('canvas');
    this.radarCanvas.className = 'hud-radar';

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.radarCanvas.width = this.radarSize * dpr;
    this.radarCanvas.height = this.radarSize * dpr;

    this.radarCanvas.style.width = `${this.radarSize}px`;
    this.radarCanvas.style.height = `${this.radarSize}px`;

    this.radarCtx = this.radarCanvas.getContext('2d');
    this.radarCtx.scale(dpr, dpr);

    this.root.appendChild(this.radarCanvas);

    /**
     * Health / Armor
     */
    this.bottomLeft = document.createElement('div');
    this.bottomLeft.className = 'hud-bottom-left';

    this.bottomLeft.innerHTML = `
      <div class="hud-stat">
        <span class="hud-label">MONEY</span>
        <span class="hud-value hud-money" data-money>$800</span>
      </div>
      <div class="hud-stat">
        <span class="hud-label">HP</span>
        <span class="hud-value" data-health>100</span>
      </div>
      <div class="hud-stat">
        <span class="hud-label">ARMOR</span>
        <span class="hud-value" data-armor>100</span>
      </div>
    `;

    this.moneyEl = this.bottomLeft.querySelector('[data-money]');
    this.healthValue = this.bottomLeft.querySelector('[data-health]');
    this.armorValue = this.bottomLeft.querySelector('[data-armor]');

    this.root.appendChild(this.bottomLeft);

    /**
     * Weapon / Ammo
     */
    this.bottomRight = document.createElement('div');
    this.bottomRight.className = 'hud-bottom-right';

    this.bottomRight.innerHTML = `
      <div class="hud-weapon" data-weapon>—</div>
      <div class="hud-ammo">
        <span data-mag>00</span> / <span data-reserve>00</span>
      </div>
      <div class="hud-reload">RELOADING</div>
      <div class="hud-grenades" data-grenades></div>
    `;

    this.weaponValue = this.bottomRight.querySelector('[data-weapon]');
    this.magValue = this.bottomRight.querySelector('[data-mag]');
    this.reserveValue = this.bottomRight.querySelector('[data-reserve]');
    this.grenadesEl = this.bottomRight.querySelector('[data-grenades]');

    this.root.appendChild(this.bottomRight);

    document.body.appendChild(this.root);
  }

  startRound(seconds = 120) {
    this.roundEndTime = performance.now() + seconds * 1000;
  }

  setRoundTimeLeft(seconds = 120) {
    this.roundEndTime = performance.now() + seconds * 1000;
  }

  setHealth(value) {
    this.gameState.health = value;
  }

  setArmor(value) {
    this.gameState.armor = value;
  }

  addRadarEntity(entity) {
    const id = entity.id ?? `radar-${this.nextRadarId++}`;

    this.radarEntities.set(id, {
      ...entity,
      id
    });

    return id;
  }

  removeRadarEntity(id) {
    this.radarEntities.delete(id);
  }

  clearRadarEntities() {
    this.radarEntities.clear();
  }

  onWeaponHit(event) {
    const userData = event.detail?.userData;

    if (
      userData?.bot ||
      userData?.player ||
      userData?.material === 'flesh'
    ) {
      this.hitMarkerTime = 0.12;
    }
  }

  update(dt) {
    this.hitMarkerTime = Math.max(0, this.hitMarkerTime - dt);

    this.updateCrosshair();
    this.updateStatus();
    this.updateTimer();
    this.drawRadar();
  }

  updateCrosshair() {
    const weaponState = this.weaponManager?.getHUDState?.();
    const playerState = this.player?.getState?.();

    if (!weaponState || !playerState) {
      this.crosshair.style.display = 'none';
      return;
    }

    this.crosshair.style.display = 'block';

    const spread = weaponState.spread ?? 0;
    const speed = playerState.speed ?? 0;

    const recoil =
      Math.abs(this.player.recoilPitch ?? 0) +
      Math.abs(this.player.recoilYaw ?? 0);

    let gap =
      5 +
      spread * 1100 +
      speed * 1.8 +
      recoil * 140;

    gap = Math.max(4, Math.min(48, gap));

    this.lines.top.style.transform = `translateY(${-(gap + 8)}px)`;
    this.lines.bottom.style.transform = `translateY(${gap}px)`;
    this.lines.left.style.transform = `translateX(${-(gap + 8)}px)`;
    this.lines.right.style.transform = `translateX(${gap}px)`;

    this.crosshair.classList.toggle(
      'hit',
      this.hitMarkerTime > 0
    );
  }

  updateStatus() {
    const weaponState = this.weaponManager?.getHUDState?.();

    if (weaponState) {
      this.weaponValue.textContent = weaponState.suppressed
        ? `${weaponState.weaponName} [SUPPRESSED]`
        : weaponState.weaponName;

      const isMelee = weaponState.weaponId === 'knife' || weaponState.weaponId === 'crowbar';

      this.magValue.textContent = isMelee
        ? '--'
        : String(Math.max(0, weaponState.magazine)).padStart(2, '0');

      this.reserveValue.textContent = isMelee
        ? '--'
        : String(Math.max(0, weaponState.reserve)).padStart(2, '0');

      this.bottomRight.classList.toggle(
        'reloading',
        weaponState.reloading
      );
    }

    const health = this.gameState?.health ?? 100;
    const armor = this.gameState?.armor ?? 100;

    this.healthValue.textContent = String(
      Math.max(0, Math.round(health))
    );

    this.armorValue.textContent = String(
      Math.max(0, Math.round(armor))
    );

    this.healthValue.classList.toggle('low', health <= 25);
  }

  updateTimer() {
    if (this.roundEndTime == null) {
      this.timer.textContent = '2:00';
      this.timer.classList.remove('danger');
      return;
    }

    const remainingMs = this.roundEndTime - performance.now();
    const remaining = Math.max(0, remainingMs / 1000);

    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);

    this.timer.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;

    this.timer.classList.toggle('danger', remaining <= 10);
  }

  damageFlash() {
    if (!this.damageOverlay) {
      return;
    }

    this.damageOverlay.style.transition = 'none';
    this.damageOverlay.style.opacity = '1';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.damageOverlay.style.transition =
          'opacity 0.6s ease-out';
        this.damageOverlay.style.opacity = '0';
      });
    });
  }

  showDamageDirection(angleRad) {
    if (!this.damageDir) return;

    /**
     * Нормалізуємо кут до 0..2*PI
     */
    let angle = angleRad;
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;

    const deg = (angle * 180) / Math.PI;

    this.damageDir.style.transition = 'none';
    this.damageDir.style.transform = `rotate(${deg}deg)`;
    this.damageDir.style.opacity = '1';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.damageDir.style.transition = 'opacity 0.7s ease-out';
        this.damageDir.style.opacity = '0';
      });
    });
  }

  /**
   * Цифра шкоди біля прицілу: гравець бачить СКІЛЬКИ HP
   * у нього забрали (червона, зникає за 0.6с).
   */
  showDamageTaken(damage) {
    if (!this.root || !damage) return;

    const el = document.createElement('div');
    el.className = 'hud-damage-taken';
    el.textContent = `-${Math.round(damage)}`;
    el.style.cssText =
      'position:absolute;left:50%;top:50%;transform:translate(28px,-50%);' +
      'font-family:monospace;font-size:17px;font-weight:700;color:#ff4040;' +
      'text-shadow:0 1px 3px rgba(0,0,0,0.9);pointer-events:none;';

    this.root.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transition = 'transform 0.6s ease-out, opacity 0.6s ease-out';
      el.style.transform = 'translate(28px,-140%)';
      el.style.opacity = '0';
    });

    setTimeout(() => el.remove(), 700);
  }

  showRoundResult(won) {
    if (!this.roundResult) return;

    this.roundResult.className = 'hud-round-result';
    this.roundResult.textContent = won == null ? 'DRAW' : won ? 'ROUND WON' : 'ROUND LOST';
    this.roundResult.classList.add(won == null ? 'draw' : won ? 'win' : 'lose');
    this.roundResult.classList.add('show');

    setTimeout(() => {
      this.roundResult.classList.remove('show', 'win', 'lose', 'draw');
    }, 2500);
  }

  flashFlash(intensity = 1) {
    if (!this.flashOverlay) {
      return;
    }

    const value = Math.max(0, Math.min(1, intensity));

    this.flashOverlay.style.transition = 'none';
    this.flashOverlay.style.opacity = String(value);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const duration = 0.6 + value * 2.2;

        this.flashOverlay.style.transition =
          `opacity ${duration}s ease-out`;
        this.flashOverlay.style.opacity = '0';
      });
    });
  }

  setMoney(value) {
    if (!this.moneyEl) {
      return;
    }

    const rounded = Math.max(0, Math.round(value));

    if (this.lastMoney === rounded) {
      return;
    }

    this.lastMoney = rounded;

    this.moneyEl.textContent = `$${rounded}`;
  }

  setGrenades(inventory, selected) {
    if (!this.grenadesEl) {
      return;
    }

    const key = `${inventory.he}|${inventory.flash}|${inventory.smoke}|${selected ?? ''}`;

    if (this.lastGrenadesKey === key) {
      return;
    }

    this.lastGrenadesKey = key;

    const items = [
      { id: 'he', label: 'HE' },
      { id: 'flash', label: 'FB' },
      { id: 'smoke', label: 'SM' }
    ];

    this.grenadesEl.innerHTML = '';

    for (const item of items) {
      const count = inventory[item.id] ?? 0;

      const span = document.createElement('span');
      span.className = 'hud-grenade-item';

      if (count === 0) {
        span.classList.add('empty');
      }

      if (selected === item.id) {
        span.classList.add('selected');
      }

      span.textContent = `${item.label} ×${count}`;

      this.grenadesEl.appendChild(span);
    }
  }

  setMapRects(rects = []) {
    this.mapRects = rects;
  }

  drawRadar() {
    const ctx = this.radarCtx;

    if (!ctx || !this.player) {
      return;
    }

    const size = this.radarSize;
    const center = size / 2;
    const radius = center - 6;

    ctx.clearRect(0, 0, size, size);

    ctx.save();

    /**
     * Circular clip.
     */
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    /**
     * Background.
     */
    ctx.fillStyle = 'rgba(8, 16, 12, 0.74)';
    ctx.fillRect(0, 0, size, size);

    const playerPos = this.player.position;
    const yaw = this.player.yaw;

    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);

    /**
     * Three.js camera:
     * forward = (-sin, -cos)
     * right = (cos, -sin)
     */
    const forwardX = -sin;
    const forwardZ = -cos;

    const rightX = cos;
    const rightZ = -sin;

    const scale = radius / this.radarRange;

    /**
     * Стіни карти (міні-карта).
     */
    for (const rect of this.mapRects) {
      const dx = rect.x - playerPos.x;
      const dz = rect.z - playerPos.z;

      if (Math.abs(dx) > this.radarRange || Math.abs(dz) > this.radarRange) {
        continue;
      }

      const rx = dx * rightX + dz * rightZ;
      const rz = dx * forwardX + dz * forwardZ;

      const cx = center + rx * scale;
      const cy = center + rz * scale;

      const w = rect.w * scale;
      const d = rect.d * scale;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-yaw);
      ctx.fillStyle = rect.tall
        ? 'rgba(110, 210, 150, 0.85)'
        : 'rgba(110, 210, 150, 0.45)';
      ctx.fillRect(-w / 2, -d / 2, w, d);
      ctx.restore();
    }

    /**
     * Grid.
     */
    ctx.strokeStyle = 'rgba(90, 255, 140, 0.18)';
    ctx.lineWidth = 1;

    for (let r = radius / 3; r < radius; r += radius / 3) {
      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(center, center - radius);
    ctx.lineTo(center, center + radius);
    ctx.moveTo(center - radius, center);
    ctx.lineTo(center + radius, center);
    ctx.stroke();

    for (const entity of this.radarEntities.values()) {
      const pos =
        typeof entity.getPosition === 'function'
          ? entity.getPosition()
          : entity.position;

      if (!pos) continue;

      const relX = pos.x - playerPos.x;
      const relZ = pos.z - playerPos.z;

      const localX = relX * rightX + relZ * rightZ;
      const localY = relX * forwardX + relZ * forwardZ;

      const distance = Math.hypot(localX, localY);

      if (distance > this.radarRange) {
        continue;
      }

      const visible =
        typeof entity.isVisible === 'function'
          ? entity.isVisible()
          : true;

      if (!visible) {
        continue;
      }

      const noisy =
  typeof entity.isNoisy === 'function'
    ? entity.isNoisy()
    : (entity.noisy ?? true);
      const alwaysVisible = entity.alwaysVisible ?? false;

      /**
       * Для ворогів показуємо точку, якщо вони шумлять.
       * Пізніше боти будуть вмикати noisy під час бігу/стрільби.
       */
      if (entity.team === 'enemy' && !noisy && !alwaysVisible) {
        continue;
      }

      const x = center + localX * scale;
      const y = center - localY * scale;

      ctx.fillStyle =
        entity.team === 'enemy'
          ? 'rgba(255, 70, 70, 0.95)'
          : 'rgba(80, 180, 255, 0.95)';

      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    /**
     * Player arrow.
     */
    ctx.fillStyle = 'rgba(120, 255, 120, 0.96)';

    ctx.beginPath();
    ctx.moveTo(center, center - 7);
    ctx.lineTo(center - 5, center + 5);
    ctx.lineTo(center + 5, center + 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    /**
     * Border.
     */
    ctx.strokeStyle = 'rgba(120, 255, 120, 0.42)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  dispose() {
    window.removeEventListener('weapon:hit', this.onWeaponHit);

    if (this.root?.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }

    this.radarEntities.clear();
  }
}
