import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { teamColor } from './teams.js';
import { createSoldierMesh, animateSoldierWalk } from '../engine/SoldierModel.js';
import { detectSurface } from '../engine/SurfaceDetector.js';

/**
 * RemotePlayer — мережевий гравець.
 *
 * Має:
 * - візуальну модель;
 * - kinematic body;
 * - hitbox-коллайдери;
 * - інтерполяцію позиції.
 */
class RemotePlayer {
  constructor({
    id,
    name,
    scene,
    physics,
    network,
    spawn,
    spawnPoints = [],
    audio = null,
    economy = null
  }) {
    this.id = id;
    this.name = name || 'Player';

    this.scene = scene;
    this.physics = physics;
    this.network = network;

    this.position = new THREE.Vector3(
      spawn?.x ?? 0,
      spawn?.y ?? 0.9,
      spawn?.z ?? 0
    );

    this.targetPosition = this.position.clone();

    this.yaw = 0;
    this.targetYaw = 0;

    this.velocity = new THREE.Vector3();

    this.health = 100;
    this.alive = true;

    this.lastSeen = Date.now();

    this.body = null;
    this.mesh = null;

    this.createBody();
  }

  setName(name) {
    if (name) {
      this.name = name;
    }
  }

  getColorFromId() {
    let hash = 0;

    for (let i = 0; i < this.id.length; i++) {
      hash = (hash * 31 + this.id.charCodeAt(i)) >>> 0;
    }

    const hue = (hash % 360) / 360;

    return new THREE.Color().setHSL(hue, 0.7, 0.5);
  }

  createBody() {
    if (this.body) {
      return;
    }

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(
        this.position.x,
        this.position.y,
        this.position.z
      );

    this.body = this.physics.world.createRigidBody(bodyDesc);

    this.createHitboxes();
    this.createMesh();
  }

  createHitboxes() {
    /**
     * Зберігаємо всі коллайдери гравця для setTeam (оновлення meta).
     */
    this.colliders = [];

    const zones = [
      {
        name: 'head',
        half: [0.16, 0.18, 0.16],
        y: 1.45
      },
      {
        name: 'chest',
        half: [0.26, 0.2, 0.18],
        y: 0.85
      },
      {
        name: 'stomach',
        half: [0.2, 0.12, 0.15],
        y: 0.5
      },
      {
        name: 'legs',
        half: [0.16, 0.32, 0.16],
        y: -0.1
      }
    ];

    for (const zone of zones) {
      const colliderDesc = RAPIER.ColliderDesc.cuboid(
        zone.half[0],
        zone.half[1],
        zone.half[2]
      )
        .setTranslation(0, zone.y, 0)
        .setFriction(0)
        .setRestitution(0);

      const collider = this.physics.world.createCollider(
        colliderDesc,
        this.body
      );

      this.colliders.push(collider);

      this.physics.colliderMeta.set(collider.handle, {
        remotePlayer: true,
        player: true,
        playerId: this.id,
        playerName: this.name,
        team: this.team,
        material: 'flesh',
        hitZone: zone.name,
        stopsBullet: true,
        applyDamage: (damage, hit) => {
          this.network.onLocalHitRemotePlayer(
            this.id,
            damage,
            hit?.userData?.hitZone ?? zone.name,
            this.name
          );
        }
      });
    }
  }

  createMesh() {
    if (this.mesh) {
      return;
    }

    this.mesh = createSoldierMesh(this.team ?? 'T');

    /**
     * Зберігаємо посилання на всі коллайдери цього гравця,
     * щоб setTeam міг оновлювати colliderMeta.team (Friendly Fire).
     */
    if (this.colliders && this.colliders.length) {
      for (const collider of this.colliders) {
        const meta = this.physics.colliderMeta.get(collider.handle);

        if (meta) {
          meta.team = this.team;
          meta.playerId = this.id;
        }
      }
    }

    this.bodyMaterial = this.mesh.userData.materials.bodyMat;

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;

    this.scene.add(this.mesh);
  }

  setTeam(team) {
    this.team = team;

    if (this.bodyMaterial) {
      this.bodyMaterial.color.setHex(teamColor(team));
    }

    /**
     * Синхронізуємо colliderMeta всіх hitbox-коллайдерів,
     * щоб hitscan / бот правильно розпізнавали команду
     * (неможливість friendly fire).
     */
    if (this.colliders) {
      for (const collider of this.colliders) {
        const meta = this.physics.colliderMeta.get(collider.handle);

        if (meta) {
          meta.team = team;
        }
      }
    }
  }

  removeBody() {
    if (this.body && this.physics?.world) {
      this.physics.removeBody(this.body);
    }

    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
    }

    this.body = null;
    this.mesh = null;
  }

  setAlive(alive) {
    this.alive = alive;

    if (alive) {
      if (!this.body) {
        this.position.copy(this.targetPosition);
        this.createBody();
      }
    } else {
      this.removeBody();
    }
  }

  updateFromState(state) {
    if (state.pos) {
      this.targetPosition.set(
        state.pos.x ?? this.targetPosition.x,
        state.pos.y ?? this.targetPosition.y,
        state.pos.z ?? this.targetPosition.z
      );
    }

    if (typeof state.yaw === 'number') {
      this.targetYaw = state.yaw;
    }

    if (state.name) {
      this.setName(state.name);
    }

    if (typeof state.health === 'number') {
      this.health = state.health;
    }

    const alive = state.alive !== false;

    if (alive && !this.alive) {
      this.setAlive(true);
    }

    if (!alive && this.alive) {
      this.setAlive(false);
    }

    this.alive = alive;
  }

  lerpAngle(a, b, t) {
    let diff = b - a;

    while (diff > Math.PI) {
      diff -= Math.PI * 2;
    }

    while (diff < -Math.PI) {
      diff += Math.PI * 2;
    }

    return a + diff * t;
  }

  update(dt) {
    if (!this.alive || !this.body || !this.mesh) {
      return;
    }

    const lerpFactor = 1 - Math.exp(-12 * dt);

    const prevX = this.position.x;
    const prevZ = this.position.z;

    this.position.lerp(this.targetPosition, lerpFactor);
    this.yaw = this.lerpAngle(this.yaw, this.targetYaw, lerpFactor);

    this.velocity?.set(
      (this.position.x - prevX) / Math.max(dt, 0.001),
      0,
      (this.position.z - prevZ) / Math.max(dt, 0.001)
    );

    const movedDistance = Math.hypot(
      this.position.x - prevX,
      this.position.z - prevZ
    );

    this.stepDistance = (this.stepDistance ?? 0) + movedDistance;

    if (movedDistance > 0.001 && this.stepDistance >= 2.3) {
      this.stepDistance = 0;

      this.network?.audio?.playFootstep({
        position: this.position,
        surface: detectSurface(
          this.network?.physics,
          this.position
        )
      });
    }

    /**
     * Коллайдери мають збігатися з візуалом точно,
     * інакше hitscan б'є "крізь" модель, що біжить.
     */
    if (this.body.setTranslation) {
      this.body.setTranslation(
        {
          x: this.position.x,
          y: this.position.y,
          z: this.position.z
        },
        true
      );
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;

    const speed = Math.hypot(this.velocity?.x ?? 0, this.velocity?.z ?? 0);
    animateSoldierWalk(this.mesh, 0.016, speed);
  }

  dispose() {
    this.removeBody();
  }
}

/**
 * NetworkManager:
 * - синхронізує гравців;
 * - відправляє позиції;
 * - відправляє постріли;
 * - обробляє damage;
 * - обробляє kill;
 * - керує респауном.
 */
export class NetworkManager {
  constructor({
    lobby,
    scene,
    physics,
    player,
    weaponManager,
    hud = null,
    gameState,
    killFeed = null,
    spawnPoints = [],
    audio = null,
    economy = null,
    isHost = false
  }) {
    this.lobby = lobby;
    this.scene = scene;
    this.physics = physics;
    this.player = player;
    this.weaponManager = weaponManager;
    this.hud = hud;
    this.gameState = gameState;
    this.killFeed = killFeed;
    this.spawnPoints = spawnPoints;
    this.audio = audio;
    this.economy = economy;
    this.isHost = isHost;

    this.stats = { kills: 0, deaths: 0 };
    this.playerStats = new Map();
    this.statsAccumulator = 0;
    this.onMatchOverRemote = null;

    this.peers = new Map();

    this.alive = true;

    this.sendAccumulator = 0;
    this.cleanupAccumulator = 0;

    this.respawnTimeout = null;

    this._onMessage = this.handleMessage.bind(this);
    this._onLocalShot = this.onLocalShot.bind(this);
    this._beforeUnload = this.beforeUnload.bind(this);

    this.start();
  }

  get localId() {
    return this.lobby?.id ?? 'local';
  }

  get localName() {
    return this.lobby?.name ?? 'Player';
  }

  start() {
    if (this.lobby) {
      this.lobby.onAnyMessage = this._onMessage;

      for (const player of this.lobby.players.values()) {
        if (player.id !== this.localId) {
          this.ensurePeer(player.id, player.name);
        }
      }
    }

    window.addEventListener('weapon:shot', this._onLocalShot);
    window.addEventListener('beforeunload', this._beforeUnload);

    this.sendJoin();
  }

  send(message) {
    this.lobby?.adapter?.send?.(message);
  }

  sendJoin() {
    this.send({
      type: 'game:join',
      id: this.localId,
      name: this.localName
    });
  }

  sendPresence() {
    this.send({
      type: 'game:presence',
      id: this.localId,
      name: this.localName
    });
  }

  /**
   * Надіслати повідомлення в чат.
   * team: 'all' — усім, інакше тільки своїй команді.
   */
  sendChat(text, team = 'all') {
    if (!text || !text.trim()) {
      return;
    }

    this.send({
      type: 'game:chat',
      id: this.localId,
      senderName: this.localName,
      text: String(text).slice(0, 200),
      team
    });
  }

  sendLeave() {
    this.send({
      type: 'game:leave',
      id: this.localId
    });
  }

  randomSpawn(team = null) {
    let list =
      this.spawnPoints && this.spawnPoints.length
        ? this.spawnPoints
        : [{ x: 0, y: 0.9, z: 0 }];

    /**
     * Якщо вказано команду — фільтруємо спавни цієї команди.
     * Якщо спавнів з team немає — використовуємо всі.
     */
    if (team) {
      const teamList = list.filter((p) => p.team === team);
      if (teamList.length > 0) {
        list = teamList;
      }
    }

    /**
     * Виключаємо спавни, зайняті ботами (щоб гравець
     * не народжувався всередині бота).
     */
    const occupied = new Set();

    const bots = this.networkBots?.isHost
      ? this.networkBots.hostBots
      : this.networkBots?.clientBots;

    if (bots) {
      for (const bot of bots.values()) {
        if (!bot.alive || !bot.position) continue;

        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          if (Math.hypot(p.x - bot.position.x, p.z - bot.position.z) < 2.2) {
            occupied.add(i);
          }
        }
      }
    }

    let candidates = [];
    for (let i = 0; i < list.length; i++) {
      if (!occupied.has(i)) {
        candidates.push(list[i]);
      }
    }

    if (candidates.length === 0) {
      candidates = list;
    }

    const spawn =
      candidates[Math.floor(Math.random() * candidates.length)] ??
      candidates[0] ??
      list[0];

    return {
      x: spawn.x ?? 0,
      y: spawn.y ?? 0.9,
      z: spawn.z ?? 0
    };
  }

  ensurePeer(id, name) {
    if (!this.peers.has(id)) {
      const spawn = this.randomSpawn();

      const peer = new RemotePlayer({
        id,
        name,
        scene: this.scene,
        physics: this.physics,
        network: this,
        spawn
      });

      this.peers.set(id, peer);
    }

    const peer = this.peers.get(id);

    if (name) {
      peer.setName(name);
    }

    peer.lastSeen = Date.now();

    return peer;
  }

  removePeer(id) {
    const peer = this.peers.get(id);

    if (peer) {
      peer.dispose();
      this.peers.delete(id);
    }

    this.playerStats.delete(id);
  }

  handleMessage(message) {
    if (!message?.type?.startsWith('game:')) {
      return;
    }

    const senderId = message.id ?? message.senderId;

    if (!senderId || senderId === this.localId) {
      return;
    }

    switch (message.type) {
      case 'game:join': {
        const peer = this.ensurePeer(senderId, message.name);

        /**
         * Mid-game join: хост призначає команду новому гравцю.
         */
        if (this.isHost) {
          let reusedTeam = null;

          for (const [id, team] of Object.entries(this.teams ?? {})) {
            const existingPeer = this.peers.get(id);
            if (id === senderId) continue;
            if (existingPeer) continue;
            if (message.name && existingPeer?.name === message.name) {
              reusedTeam = team;
              break;
            }
          }

          if (reusedTeam) {
            this.teams[senderId] = reusedTeam;
          } else {
            let ct = 0;
            let t = 0;
            for (const team of Object.values(this.teams ?? {})) {
              if (team === 'CT') ct++;
              else if (team === 'T') t++;
            }
            this.teams[senderId] = ct <= t ? 'CT' : 'T';
          }

          peer.setTeam?.(this.teams[senderId]);

          this.send({
            type: 'game:assign_team',
            id: this.localId,
            targetId: senderId,
            team: this.teams[senderId],
            teams: { ...this.teams }
          });

          this.refreshTeams();
        }

        this.sendPresence();
        break;
      }

      case 'game:assign_team': {
        if (message.targetId === this.localId && message.team) {
          this._assignedTeam = message.team;
          if (this.teams) {
            this.teams[this.localId] = message.team;
          }
        }
        if (message.teams) {
          for (const [id, team] of Object.entries(message.teams)) {
            this.teams[id] = team;
            const peer = this.peers.get(id);
            if (peer) {
              peer.setTeam?.(team);
            }
          }
          this.refreshTeams?.();
        }
        break;
      }

      case 'game:presence': {
        this.ensurePeer(senderId, message.name);
        break;
      }

      case 'game:state': {
        const peer = this.ensurePeer(senderId, message.name);
        peer.updateFromState(message);
        peer.lastSeen = Date.now();
        break;
      }

      case 'game:damage': {
        this.handleDamage(message);
        break;
      }

      case 'game:kill': {
        this.handleKill(message);
        break;
      }

      case 'game:chat': {
        this.onChat?.({
          senderId,
          senderName: message.senderName ?? 'Player',
          text: message.text ?? '',
          team: message.team ?? 'all'
        });
        break;
      }

      case 'game:shot': {
        this.handleShot(message);
        break;
      }

      case 'game:leave': {
        this.removePeer(senderId);
        break;
      }

      case 'game:stats': {
        this.playerStats.set(senderId, {
          id: senderId,
          name: message.name ?? 'Player',
          team: message.team ?? 'T',
          kills: message.kills ?? 0,
          deaths: message.deaths ?? 0,
          alive: message.alive !== false
        });

        break;
      }

      case 'game:matchover': {
        this.onMatchOverRemote?.(message);
        break;
      }

      default:
        break;
    }
  }

  broadcastState() {
    if (!this.player) {
      return;
    }

    this.send({
      type: 'game:state',
      id: this.localId,
      name: this.localName,
      health: this.gameState?.health ?? 100,
      armor: this.gameState?.armor ?? 0,
      alive: this.alive,
      weapon: this.weaponManager?.current?.id ?? 'ak47',
      crouch: this.player.crouched ?? false,
      yaw: this.player.yaw ?? 0,
      pitch: this.player.pitch ?? 0,
      pos: {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z
      }
    });
  }

  onLocalShot(event) {
    const detail = event.detail;

    if (!detail?.origin || !detail?.end) {
      return;
    }

    if (!this.alive) {
      return;
    }

    this.send({
      type: 'game:shot',
      id: this.localId,
      weaponId: detail.weaponId ?? 'weapon',
      origin: {
        x: detail.origin.x,
        y: detail.origin.y,
        z: detail.origin.z
      },
      end: {
        x: detail.end.x,
        y: detail.end.y,
        z: detail.end.z
      }
    });
  }

  handleShot(message) {
    if (!message?.origin || !message?.end) {
      return;
    }

    if (!this.weaponManager?.spawnTracer) {
      return;
    }

    const start = new THREE.Vector3(
      message.origin.x,
      message.origin.y,
      message.origin.z
    );

    const end = new THREE.Vector3(
      message.end.x,
      message.end.y,
      message.end.z
    );

    this.weaponManager.spawnTracer(start, end, message.weaponId);

    this.audio?.playShot({
      weaponId: message.weaponId,
      position: start
    });

    /**
     * Постріл чують боти-хоста (тільки постріли локального гравця —
     * постріли інших клієнтів боти чують через сетеву подію нижче).
     */
    if (this.isHost && message.id === this.localId) {
      this.onPlayerShot?.(start, 'shot');
    }
  }

  /**
   * Викликається локальним hitscan, коли ми влучили
   * у мережевого гравця.
   */
  onLocalHitRemotePlayer(targetId, damage, hitZone, victimName) {
    this.send({
      type: 'game:damage',
      targetId,
      attackerId: this.localId,
      attackerName: this.localName,
      victimName: victimName ?? 'Player',
      damage,
      weaponId: this.weaponManager?.current?.id ?? 'weapon',
      hitZone: hitZone ?? 'chest',
      headshot: hitZone === 'head'
    });
  }

  handleDamage(message) {
    if (message.targetId !== this.localId) {
      return;
    }

    if (!this.alive) {
      return;
    }

    let remaining = message.damage ?? 0;

    if (this.gameState.armor > 0) {
      const absorb = Math.min(
        this.gameState.armor,
        remaining * 0.5
      );

      this.gameState.armor -= absorb;
      remaining -= absorb;
    }

    this.audio?.playDamage();
    this.hud?.damageFlash?.();

    /**
     * Напрямок атаки для індикатора на HUD.
     */
    if (message.attackerId && this.player) {
      let attX = 0;
      let attZ = 0;
      let found = false;

      const peer = this.peers.get(message.attackerId);
      if (peer && peer.position) {
        attX = peer.position.x;
        attZ = peer.position.z;
        found = true;
      }

      if (!found && this.networkBots) {
        const bots = this.networkBots.isHost
          ? this.networkBots.hostBots
          : this.networkBots.clientBots;
        const bot = bots?.get(message.attackerId);
        if (bot?.position) {
          attX = bot.position.x;
          attZ = bot.position.z;
          found = true;
        }
      }

      if (found) {
        const dx = attX - this.player.position.x;
        const dz = attZ - this.player.position.z;
        const worldAngle = Math.atan2(dx, dz);
        const viewAngle = worldAngle - (this.player.yaw ?? 0);
        this.hud?.showDamageDirection?.(viewAngle);
      }
    }

    this.gameState.health = Math.max(
      0,
      this.gameState.health - remaining
    );

    if (this.gameState.health <= 0) {
      this.dieLocal(message);
    }
  }

  dieLocal(message) {
    if (!this.alive) {
      return;
    }

    this.alive = false;

    this.audio?.playDeath();
    this.stats.deaths++;

    if (this.weaponManager) {
      this.weaponManager.enabled = false;
    }

    this.broadcastState();

    this.send({
      type: 'game:kill',
      id: this.localId,
      killerId: message.attackerId ?? 'unknown',
      killerName: message.attackerName ?? 'Player',
      victimId: this.localId,
      victimName: this.localName,
      weaponId: message.weaponId ?? 'weapon',
      headshot: !!message.headshot
    });

    this.killFeed?.add({
      killerName: message.attackerName ?? 'Player',
      victimName: this.localName,
      weaponId: message.weaponId ?? 'weapon',
      headshot: !!message.headshot
    });

    if (this.respawnTimeout) {
      clearTimeout(this.respawnTimeout);
    }

    this.respawnTimeout = setTimeout(() => {
      this.respawnLocal();
    }, 3000);
  }

  respawnLocal() {
    this.alive = true;

    this.gameState.health = 100;

    if (this.weaponManager) {
      this.weaponManager.enabled = true;

      if (this.weaponManager.current) {
        this.weaponManager.current.magazine =
          this.weaponManager.current.magazineSize;

        this.weaponManager.current.reloading = false;
        this.weaponManager.current.cooldown = 0;
      }
    }

    const spawn = this.randomSpawn(this.getLocalTeam());

    this.player.position.set(spawn.x, 2.2, spawn.z);
    this.player.prevPosition.copy(this.player.position);
    this.player.velocity.set(0, 0, 0);

    if (this.player.body?.setTranslation) {
      this.player.body.setTranslation(
        {
          x: spawn.x,
          y: 2.2,
          z: spawn.z
        },
        true
      );
    }

    this.broadcastState();
  }

  handleKill(message) {
    this.killFeed?.add({
      killerName: message.killerName ?? 'Player',
      victimName: message.victimName ?? 'Player',
      weaponId: message.weaponId ?? 'weapon',
      headshot: !!message.headshot
    });

    if (message.killerId === this.localId) {
      this.stats.kills++;
      this.audio?.playKill();
      this.economy?.rewardKill?.(message.weaponId);
    }
  }

  refreshTeams() {
    for (const [id, peer] of this.peers) {
      const team = this.teams?.[id] ?? peer.team ?? 'T';

      peer.team = team;
      peer.setTeam?.(team);
    }
  }

  getStatsSnapshot() {
    const list = [];

    for (const entry of this.playerStats.values()) {
      list.push({ ...entry });
    }

    let hasSelf = false;

    for (const entry of list) {
      if (entry.id === this.localId) {
        hasSelf = true;
        entry.kills = this.stats.kills;
        entry.deaths = this.stats.deaths;
        entry.team = this.getLocalTeam();
      }
    }

    if (!hasSelf) {
      list.push({
        id: this.localId,
        name: this.localName,
        team: this.getLocalTeam(),
        kills: this.stats.kills,
        deaths: this.stats.deaths
      });
    }

    list.sort((a, b) => b.kills - a.kills);

    return list;
  }

  resetStats() {
    this.stats.kills = 0;
    this.stats.deaths = 0;
    this.playerStats.clear();
  }

  update(dt) {
    this.statsAccumulator += dt;

    if (this.statsAccumulator >= 3) {
      this.statsAccumulator = 0;

      this.send({
        type: 'game:stats',
        id: this.localId,
        name: this.localName,
        team: this.getLocalTeam(),
        kills: this.stats.kills,
        deaths: this.stats.deaths,
        alive: this.alive
      });
    }

    this.sendAccumulator += dt;

    /**
     * 12-13 Hz state sync.
     */
    if (this.sendAccumulator >= 0.08) {
      this.broadcastState();
      this.sendAccumulator = 0;
    }

    this.cleanupAccumulator += dt;

    if (this.cleanupAccumulator >= 3) {
      this.cleanupAccumulator = 0;

      const now = Date.now();

      for (const [id, peer] of this.peers) {
        if (now - peer.lastSeen > 10000) {
          peer.dispose();
          this.peers.delete(id);
        }
      }
    }

    for (const peer of this.peers.values()) {
      peer.update(dt);
    }
  }

  beforeUnload() {
    this.sendLeave();
  }

  dispose() {
    this.sendLeave();

    if (this.lobby && this.lobby.onAnyMessage === this._onMessage) {
      this.lobby.onAnyMessage = null;
    }

    window.removeEventListener('weapon:shot', this._onLocalShot);
    window.removeEventListener('beforeunload', this._beforeUnload);

    for (const peer of this.peers.values()) {
      peer.dispose();
    }

    this.peers.clear();

    if (this.respawnTimeout) {
      clearTimeout(this.respawnTimeout);
      this.respawnTimeout = null;
    }

    this.onMatchOverRemote = null;
  }
}
