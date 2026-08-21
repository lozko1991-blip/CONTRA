import * as THREE from 'three';

const BOMB_STYLE_ID = 'cs16-bomb-ui';

const PLANT_TIME = 3;
const DEFUSE_TIME = 10;
const BOMB_TIMER = 40;
const EXPLODE_RADIUS = 18;
const EXPLODE_MAX_DAMAGE = 260;
const PICKUP_RADIUS = 1.5;

const CSS = `
#${BOMB_STYLE_ID} {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 940;
  font-family: "Segoe UI", Arial, sans-serif;
}

.bomb-timer {
  position: absolute;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 26px;
  font-weight: 900;
  color: #ff3020;
  text-shadow: 0 0 12px rgba(255,40,20,0.8), 0 2px 4px rgba(0,0,0,0.8);
  display: none;
}

.bomb-prompt {
  position: absolute;
  bottom: 22%;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  color: #ffd070;
  font-size: 15px;
  font-weight: 700;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  display: none;
}

.bomb-prompt .bar {
  width: 220px;
  height: 8px;
  margin: 8px auto 0;
  background: rgba(0,0,0,0.55);
  border: 1px solid rgba(255,208,112,0.5);
  border-radius: 4px;
  overflow: hidden;
}

.bomb-prompt .bar i {
  display: block;
  height: 100%;
  width: 0%;
  background: #ffb020;
}

.bomb-carrier-tag {
  position: absolute;
  top: 96px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #ff9040;
  text-shadow: 0 1px 3px rgba(0,0,0,0.9);
  display: none;
}
`;

export class BombSystem {
  /**
   * @param {object} deps
   * @param deps.scene       THREE.Scene
   * @param deps.physics     PhysicsWorld
   * @param deps.network     NetworkManager | null
   * @param deps.networkBots NetworkBots | null
   * @param deps.hud         HUD
   * @param deps.audio       AudioManager
   */
  constructor({ scene, physics, network = null, networkBots = null, hud = null, audio = null }) {
    this.scene = scene;
    this.physics = physics;
    this.network = network;
    this.networkBots = networkBots;
    this.hud = hud;
    this.audio = audio;

    this.sites = [];
    this.roundManager = null;

    this.state = 'idle';
    this.carrierId = null;
    this.droppedPos = null;
    this.plantedPos = null;
    this.timeLeft = 0;
    this.progress = 0;
    this.beepTimer = 0;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this.eHeld = false;

    this.injectStyle();
    this.buildUI();

    window.addEventListener('keydown', this._onKeyDown, true);
    window.addEventListener('keyup', this._onKeyUp, true);
  }

  injectStyle() {
    if (document.getElementById(BOMB_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = BOMB_STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  buildUI() {
    this.root = document.createElement('div');
    this.root.id = BOMB_STYLE_ID;

    this.timerEl = document.createElement('div');
    this.timerEl.className = 'bomb-timer';
    this.root.appendChild(this.timerEl);

    this.carrierEl = document.createElement('div');
    this.carrierEl.className = 'bomb-carrier-tag';
    this.carrierEl.textContent = '💣 У ТЕБЕ БОМБА';
    this.root.appendChild(this.carrierEl);

    this.promptEl = document.createElement('div');
    this.promptEl.className = 'bomb-prompt';
    this.promptText = document.createElement('span');
    this.promptBar = document.createElement('div');
    this.promptBar.className = 'bar';
    this.promptFill = document.createElement('i');
    this.promptBar.appendChild(this.promptFill);
    this.promptEl.appendChild(this.promptText);
    this.promptEl.appendChild(this.promptBar);
    this.root.appendChild(this.promptEl);

    document.body.appendChild(this.root);

    /**
     * Кільця сайтів на карті.
     */
    this.markers = [];
  }

  setup(sites = []) {
    this.sites = sites.map((site) => ({ ... site }));

    for (const marker of this.markers) {
      this.scene.remove(marker);
    }
    this.markers = [];

    for (const site of this.sites) {
      const geo = new THREE.RingGeometry(site.r - 0.25, site.r, 40);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff8020,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(site.x, 0.03, site.z);
      this.scene.add(ring);
      this.markers.push(ring);
    }
  }

  attachRoundManager(roundManager) {
    this.roundManager = roundManager;
  }

  isPlanted() {
    return this.state === 'planted';
  }

  getLocalPlayer() {
    return this.network?.player ?? null;
  }

  getLocalTeam() {
    return this.network?.getLocalTeam?.() ?? 'CT';
  }

  getLocalAlive() {
    return this.network?.alive === true;
  }

  getLocalId() {
    return this.network?.localId ?? 'local';
  }

  nearestSite(pos) {
    let best = null;
    let bestDist = Infinity;

    for (const site of this.sites) {
      const dist = Math.hypot(pos.x - site.x, pos.z - site.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = { site, dist };
      }
    }

    return best;
  }

  inSite(pos) {
    for (const site of this.sites) {
      if (Math.hypot(pos.x - site.x, pos.z - site.z) <= site.r) {
        return site;
      }
    }
    return null;
  }

  /**
   * Початок раунду: скидаємо стан і призначаємо носія.
   */
  startRound() {
    this.state = 'carried';
    this.progress = 0;
    this.timeLeft = BOMB_TIMER;
    this.plantedPos = null;
    this.droppedPos = null;
    this.carrierId = this.pickCarrier();

    if (this.carrierId === this.getLocalId()) {
      this.carrierEl.style.display = 'block';
    } else {
      this.carrierEl.style.display = 'none';
    }

    this.broadcast();
  }

  pickCarrier() {
    const team = this.network?.getLocalTeam?.() ?? 'CT';

    if (team === 'T') {
      return this.getLocalId();
    }

    const bots = [...(this.networkBots?.hostBots?.values() ?? [])].filter(
      (b) => b.team === 'T' && b.alive
    );

    if (!bots.length) return null;

    return bots[Math.floor(Math.random() * bots.length)].id;
  }

  reset() {
    this.state = 'idle';
    this.carrierId = null;
    this.plantedPos = null;
    this.droppedPos = null;
    this.progress = 0;
    this.botDefuseProgress = 0;
    this.hidePrompt();
    this.timerEl.style.display = 'none';
    this.carrierEl.style.display = 'none';

    /**
     * Чистимо бомбові задачі ботів (інакше після раунду
     * боти продовжать йти до старого сайту).
     */
    for (const bot of this.networkBots?.hostBots?.values() ?? []) {
      bot.siteObjective = null;
    }
  }

  _onKeyDown(event) {
    if (event.code === 'KeyE' && !this.eHeld) {
      this.eHeld = true;
    }
  }

  _onKeyUp(event) {
    if (event.code === 'KeyE') {
      this.eHeld = false;

      /**
       * Скидання прогресу при відпусканні E.
       */
      if (this.progress > 0 && this.progress < 1) {
        this.progress = 0;
      }
    }
  }

  hidePrompt() {
    this.promptEl.style.display = 'none';
  }

  showPrompt(text, progress = 0) {
    this.promptEl.style.display = 'block';
    this.promptText.textContent = text;
    this.promptFill.style.width = `${Math.min(100, progress * 100)}%`;
  }

  update(dt) {
    if (this.state === 'carried') {
      this.updateCarried(dt);
    } else if (this.state === 'dropped') {
      this.updateDropped(dt);
    } else if (this.state === 'planted') {
      this.updatePlanted(dt);
    }
  }

  getCarrierBot() {
    if (!this.carrierId || typeof this.carrierId !== 'string') return null;
    return this.networkBots?.hostBots?.get(this.carrierId) ?? null;
  }

  updateCarried(dt) {
    if (!this.carrierId) return;

    const playerCarrier =
      this.carrierId === this.getLocalId();

    const bot = playerCarrier ? null : this.getCarrierBot();

    /**
     * Носій загинув — бомба випадає.
     */
    if (playerCarrier && !this.getLocalAlive()) {
      this.dropAt(this.getLocalPlayer().position);
      return;
    }

    if (bot && !bot.alive) {
      this.dropAt(bot.position);
      return;
    }

    if (playerCarrier) {
      this.playerCarryLogic(dt);
    } else if (bot) {
      this.botCarryLogic(bot, dt);
    }
  }

  playerCarryLogic(dt) {
    const player = this.getLocalPlayer();

    if (!player) return;

    const site = this.inSite(player.position);

    if (site && this.eHeld) {
      this.progress += dt / PLANT_TIME;

      this.showPrompt('ВСТАНОВЛЕННЯ БОМБИ...', this.progress);

      if (this.progress >= 1) {
        this.plant(player.position);
      }
    } else if (site) {
      this.showPrompt('ТРИМАЙ [E] — ВСТАНОВИТИ БОМБУ', 0);
    } else {
      this.hidePrompt();
    }
  }

  botCarryLogic(bot, dt) {
    const target = this.nearestSite(bot.position);

    if (!target) return;

    /**
     * Даємо боту ціль — він йде до сайту замість патруля
     * (HostBot.update читає bot.siteObjective).
     */
    bot.siteObjective = {
      x: target.site.x,
      z: target.site.z
    };

    const standing = (bot.moveSpeed ?? 99) < 1.2;
    const safe = !bot.currentTargetId;

    if (target.dist < target.site.r * 0.6 && standing && safe) {
      this.progress += dt / PLANT_TIME;

      if (this.progress >= 1) {
        this.plant(bot.position);
        bot.siteObjective = null;
      }
    } else {
      this.progress = Math.max(0, this.progress - dt * 0.5);
    }
  }

  dropAt(position) {
    this.state = 'dropped';
    this.droppedPos = position.clone();
    this.progress = 0;
    this.carrierEl.style.display = 'none';

    const bot = this.getCarrierBot();
    if (bot) {
      bot.siteObjective = null;
    }

    this.broadcast();
  }

  updateDropped(dt) {
    if (!this.droppedPos) return;

    /**
     * Підбір: живий T поруч автоматично бере бомбу.
     */
    if (
      this.getLocalTeam() === 'T' &&
      this.getLocalAlive()
    ) {
      const player = this.getLocalPlayer();

      if (
        player &&
        Math.hypot(
          player.position.x - this.droppedPos.x,
          player.position.z - this.droppedPos.z
        ) < PICKUP_RADIUS
      ) {
        this.state = 'carried';
        this.carrierId = this.getLocalId();
        this.carrierEl.style.display = 'block';
        this.broadcast();
        return;
      }
    }

    for (const bot of this.networkBots?.hostBots?.values() ?? []) {
      if (bot.team !== 'T' || !bot.alive) continue;

      if (
        Math.hypot(
          bot.position.x - this.droppedPos.x,
          bot.position.z - this.droppedPos.z
        ) < PICKUP_RADIUS
      ) {
        this.state = 'carried';
        this.carrierId = bot.id;
        this.broadcast();
        return;
      }
    }
  }

  updatePlanted(dt) {
    this.timeLeft -= dt;

    /**
     * Періодичний синк для клієнтів (раз на 1с),
     * інакше їхній таймер бомби застигне.
     */
    this.syncAccumulator = (this.syncAccumulator ?? 0) + dt;
    if (this.syncAccumulator >= 1) {
      this.syncAccumulator = 0;
      this.broadcast();
    }

    /**
     * Біпси з прискоренням: від 1с до 0.14с.
     */
    const fraction = Math.max(0, this.timeLeft / BOMB_TIMER);
    const interval = 0.14 + fraction * 0.86;

    this.beepTimer -= dt;

    if (this.beepTimer <= 0) {
      this.beepTimer = interval;
      this.audio?.playBombBeep?.();
    }

    const mm = Math.floor(Math.max(0, this.timeLeft) / 60);
    const ss = Math.floor(Math.max(0, this.timeLeft) % 60);
    this.timerEl.textContent = `💣 ${mm}:${String(ss).padStart(2, '0')}`;
    this.timerEl.style.display = 'block';

    this.defuseLogic(dt);

    if (this.timeLeft <= 0) {
      this.explode();
    }
  }

  defuseLogic(dt) {
    if (!this.plantedPos) return;

    const playerCanDefuse =
      this.getLocalTeam() === 'CT' && this.getLocalAlive();

    if (playerCanDefuse) {
      const player = this.getLocalPlayer();
      const near =
        player &&
        Math.hypot(
          player.position.x - this.plantedPos.x,
          player.position.z - this.plantedPos.z
        ) < 1.8;

      if (near && this.eHeld) {
        this.progress += dt / DEFUSE_TIME;
        this.showPrompt('РОЗМИНУВАННЯ...', this.progress);

        if (this.progress >= 1) {
          this.defuse();
          return;
        }
      } else if (near) {
        this.showPrompt('ТРИМАЙ [E] — РОЗМИНУВАТИ БОМБУ', 0);
      } else {
        this.hidePrompt();
      }
    }

    /**
     * CT-боти: без видимого ворога йдуть до бомби,
     * стоять поруч — деф'юзнуть.
     */
    for (const bot of this.networkBots?.hostBots?.values() ?? []) {
      if (bot.team !== 'CT' || !bot.alive) continue;

      const distToBomb = Math.hypot(
        bot.position.x - this.plantedPos.x,
        bot.position.z - this.plantedPos.z
      );

      if (distToBomb < 12 && !bot.currentTargetId) {
        bot.siteObjective = {
          x: this.plantedPos.x,
          z: this.plantedPos.z
        };
      }

      if (distToBomb < 1.6 && !bot.currentTargetId && (bot.moveSpeed ?? 9) < 1) {
        this.botDefuseProgress = (this.botDefuseProgress ?? 0) + dt / DEFUSE_TIME;

        if (this.botDefuseProgress >= 1) {
          this.defuse();
          return;
        }
      }
    }
  }

  plant(position) {
    this.state = 'planted';
    this.plantedPos = new THREE.Vector3(position.x, 0.1, position.z);
    this.timeLeft = BOMB_TIMER;
    this.progress = 0;
    this.beepTimer = 0;
    this.botDefuseProgress = 0;

    this.carrierEl.style.display = 'none';
    this.hidePrompt();

    /**
     * Носій-бот більше не йде до сайту.
     */
    const bot = this.getCarrierBot();
    if (bot) {
      bot.siteObjective = null;
    }

    /**
     * Гроші за установку.
     */
    if (this.carrierId === this.getLocalId()) {
      this.network?.economy?.add?.(300);
    }

    this.broadcast();
  }

  explode() {
    this.state = 'exploded';
    this.timerEl.style.display = 'none';
    this.hidePrompt();

    this.audio?.playBombExplosion?.();

    /**
     * Радіусна шкода всім живим (гравець + боти).
     */
    const center = this.plantedPos;

    const player = this.getLocalPlayer();

    if (player && this.getLocalAlive()) {
      const dist = Math.hypot(
        player.position.x - center.x,
        player.position.z - center.z
      );

      if (dist < EXPLODE_RADIUS) {
        const damage = Math.round(
          EXPLODE_MAX_DAMAGE * (1 - dist / EXPLODE_RADIUS)
        );

        if (damage > 0) {
          this.network.handleDamage({
            targetId: this.getLocalId(),
            attackerId: 'bomb',
            attackerName: 'C4',
            damage,
            weaponId: 'c4',
            hitZone: 'chest'
          });
        }
      }
    }

    for (const bot of this.networkBots?.hostBots?.values() ?? []) {
      if (!bot.alive) continue;

      const dist = Math.hypot(
        bot.position.x - center.x,
        bot.position.z - center.z
      );

      if (dist < EXPLODE_RADIUS) {
        const damage = Math.round(
          EXPLODE_MAX_DAMAGE * (1 - dist / EXPLODE_RADIUS)
        );

        if (damage > 0) {
          bot.applyDamage(damage, 'C4', 'c4', 'chest', center, 'bomb');
        }
      }
    }

    /**
     * Віддалені гравці: хост надсилає їм шкоду від вибуху.
     */
    for (const peer of this.network?.peers?.values() ?? []) {
      if (!peer.alive || !peer.position) continue;

      const dist = Math.hypot(
        peer.position.x - center.x,
        peer.position.z - center.z
      );

      if (dist < EXPLODE_RADIUS) {
        const damage = Math.round(
          EXPLODE_MAX_DAMAGE * (1 - dist / EXPLODE_RADIUS)
        );

        if (damage > 0) {
          this.network.send({
            type: 'game:damage',
            id: this.getLocalId(),
            targetId: peer.id,
            attackerId: 'bomb',
            attackerName: 'C4',
            damage,
            weaponId: 'c4',
            hitZone: 'chest'
          });
        }
      }
    }

    this.broadcast();

    this.onRoundEnd?.('T');
  }

  defuse() {
    this.state = 'defused';
    this.timerEl.style.display = 'none';
    this.hidePrompt();

    /**
     * Гроші за деф'юз.
     */
    if (this.getLocalTeam() === 'CT') {
      this.network?.economy?.add?.(300);
    }

    this.broadcast();

    this.onRoundEnd?.('CT');
  }

  broadcast() {
    if (!this.network) return;

    this.network.send({
      type: 'game:bomb',
      id: this.getLocalId(),
      state: this.state,
      x: this.plantedPos?.x ?? this.droppedPos?.x ?? 0,
      z: this.plantedPos?.z ?? this.droppedPos?.z ?? 0,
      timeLeft: Math.round(this.timeLeft)
    });
  }

  handleMessage(message) {
    if (message.type !== 'game:bomb') return;

    /**
     * Свої повідомлення ігноруємо (хост уже знає стан).
     */
    if (message.id === this.getLocalId()) return;

    const prevState = this.state;
    this.state = message.state;

    if (message.state === 'dropped') {
      this.droppedPos = new THREE.Vector3(message.x, 0.2, message.z);
      this.carrierEl.style.display = 'none';
    } else if (message.state === 'planted') {
      this.plantedPos = new THREE.Vector3(message.x, 0.1, message.z);
      this.timeLeft = message.timeLeft ?? BOMB_TIMER;
      this.carrierEl.style.display = 'none';
    } else if (message.state === 'exploded' || message.state === 'defused') {
      this.timerEl.style.display = 'none';
      this.hidePrompt();
    }

    if (prevState !== message.state && this.onStateSync) {
      this.onStateSync(message.state);
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown, true);
    window.removeEventListener('keyup', this._onKeyUp, true);
    this.root.remove();
  }
}
