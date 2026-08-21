import * as THREE from 'three';

import { PhysicsWorld, SurfaceMaterial } from './physics.js';

import { InputManager } from './engine/InputManager.js';
import { AudioManager } from './engine/AudioManager.js';
import { DecalSystem } from './engine/DecalSystem.js';
import { PlayerController } from './player/PlayerController.js';

import { WeaponManager } from './weapons/WeaponManager.js';
import { ViewModel } from './weapons/ViewModel.js';

import { HUD } from './ui/HUD.js';
import { KillFeed } from './ui/KillFeed.js';
import { ScoreBoard } from './ui/ScoreBoard.js';
import { SettingsMenu } from './ui/SettingsMenu.js';
import { ChatUI } from './ui/ChatUI.js';
import { BuyMenu } from './ui/BuyMenu.js';
import { LobbyUI } from './ui/lobby/LobbyUI.js';

import { GridNavMesh } from './ai/NavMesh/GridNavMesh.js';

import { MapBuilder, getMapDefinition } from './maps/MapLoader.js';

import { LobbyService } from './net/LobbyService.js';
import { createLobbyAdapter } from './net/createLobbyAdapter.js';
import { NetworkManager } from './net/NetworkManager.js';
import { NetworkBots } from './net/NetworkBots.js';
import { computeTeams } from './net/teams.js';

import { RoundManager } from './game/RoundManager.js';
import { EconomyManager, SHOP_PRICES } from './game/EconomyManager.js';
import { GrenadeManager } from './weapons/GrenadeManager.js';
import { DoorSystem } from './game/DoorSystem.js';

import { MatchOverScreen } from './ui/MatchOverScreen.js';
import { HostMigration } from './net/HostMigration.js';
import { Dog } from './ai/Dog.js';
import { NamePlates } from './ui/NamePlates.js';
import { createSkybox, SKY_PRESETS } from './engine/Skybox.js';
import { BombSystem } from './game/BombSystem.js';

class Game {
  constructor() {
    this.clock = new THREE.Clock();
    this.accumulator = 0;

    this.syncList = [];
    this.dummy = new THREE.Object3D();

    this.fpsAccum = 0;
    this.fpsFrames = 0;

    this.input = null;
    this.player = null;
    this.weaponManager = null;

    this.hud = null;
    this.killFeed = null;
    this.scoreboard = null;
    this.buyMenu = null;

    this.navGrid = null;
    this.dogs = [];

    this.lobby = null;
    this.lobbyUI = null;

    this.networkManager = null;
    this.networkBots = null;
    this.roundManager = null;

    this.started = false;
    this.selectedMap = 'cs_mansion';

    this.gameState = {
      health: 100,
      armor: 0
    };

    this.matchTeams = {};

    this.audio = null;
    this.decals = null;
    this.audioForward = new THREE.Vector3();

    this.doorSystem = null;
    this.mapDoors = [];

    this.economy = null;
    this.grenadeManager = null;
    this.matchOverScreen = null;
    this.hostMigration = null;

    this.animate = this.animate.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onWeaponHit = this.onWeaponHit.bind(this);

    this._dbgVisible = false;
    this._dbgPre = null;
  }

  _initDebugOverlay() {
    if (this._dbgPre) return;

    this._initFullscreenBtn();

    this._dbgPre = document.createElement('pre');
    Object.assign(this._dbgPre.style, {
      position: 'fixed',
      left: '8px',
      top: '8px',
      zIndex: '9999',
      color: '#0f0',
      background: 'rgba(0, 0, 0, 0.65)',
      padding: '8px 10px',
      margin: '0',
      fontFamily: 'monospace',
      fontSize: '12px',
      lineHeight: '1.4',
      pointerEvents: 'none',
      whiteSpace: 'pre',
      display: 'none'
    });
    document.body.appendChild(this._dbgPre);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1') {
        e.preventDefault();
        this._dbgVisible = !this._dbgVisible;
        this._dbgPre.style.display = this._dbgVisible ? 'block' : 'none';
      }
    });
  }

  _initFullscreenBtn() {
    const btn = document.createElement('span');
    Object.assign(btn.style, {
      position: 'fixed', top: '10px', right: '10px', zIndex: '9995',
      width: '32px', height: '28px', lineHeight: '28px',
      background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '4px', color: '#ccc', cursor: 'pointer',
      fontSize: '16px', textAlign: 'center', fontFamily: 'monospace',
      userSelect: 'none', pointerEvents: 'auto'
    });
    btn.textContent = '⛶';
    btn.title = 'Fullscreen';
    btn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.();
      }
    });
    document.body.appendChild(btn);

    /**
     * Повноекранний режим часто скидає Pointer Lock.
     * Після входу у fullscreen відновлюємо lock з невеликою
     * затримкою (браузер переініціалізує canvas).
     */
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        setTimeout(() => {
          this.relockPointer();
        }, 150);
      } else {
        setTimeout(() => {
          this.relockPointer();
        }, 100);
      }
    });
  }

  applySettings(settings = {}) {
    if (this.player && settings.sensitivity != null) {
      this.player.sensitivityMultiplier = settings.sensitivity;
    }

    if (this.camera && settings.fov != null) {
      this.camera.fov = settings.fov;
      this.camera.updateProjectionMatrix();
    }

    if (this.audio && settings.volume != null) {
      this.audio.setVolume?.(settings.volume);
    }
  }

  async init() {
    await this.initLobby();
  }

  async initLobby() {
    const adapter = await createLobbyAdapter({
      room: 'global'
    });

    this.lobby = new LobbyService(adapter);

    this.lobbyUI = new LobbyUI({
      lobby: this.lobby,
      onStart: (mapId) => {
        this.onLobbyStart(mapId);
      }
    });

    const name = `Player-${Math.floor(1000 + Math.random() * 9000)}`;

    this.lobby.connect(name);

    if (this.lobbyUI.nameInput) {
      this.lobbyUI.nameInput.value = name;
    }
  }

  async onLobbyStart(mapId) {
    if (this.started) {
      return;
    }

    this.started = true;
    this.selectedMap = mapId;

    this._initDebugOverlay();

    this.lobbyUI?.hide();

    try {
      await this.startEngine();
    } catch (error) {
      console.error('[Game] Failed to start engine:', error);

      this.started = false;
      this.lobbyUI?.show();
    }
  }

  async startEngine() {
    this.initRenderer();
    this.initScene();
    this.initLights();

    this.physics = new PhysicsWorld();
    await this.physics.init();

    this.audio = new AudioManager();
    this.audio.unlock();

    this.decals = new DecalSystem(this.scene, this.physics);

    const mapDefinition = this.loadSelectedMap();

    this.applyMapTheme(mapDefinition);

    this.spawnDogs(mapDefinition);

    this.input = new InputManager(this.renderer.domElement);
    this.input.attach();

    /**
     * Перший клік після старту — захоплення миші.
     * Використовуємо постійний обробник (не once), щоб
     * передчасний клік під час завантаження WASM не "з'їв" gesture:
     * InputManager._onClick сам лочить при кліку по canvas,
     * а _armRelockOnNextGesture підхопить відхилення.
     */
    this.renderer.domElement.addEventListener('click', () => {
      this.audio?.unlock();
    });

    this.settingsMenu = new SettingsMenu({
      onChange: (settings) => this.applySettings(settings),
      onClose: () => this.relockPointer()
    });

    this.applySettings(this.settingsMenu.settings);

    this.chatUI = new ChatUI({
      localName: this.lobby?.name ?? 'Player',
      onSend: (text, mode) => {
        this.networkManager?.sendChat?.(text, mode);
      }
    });

    this.player = new PlayerController({
      physics: this.physics,
      input: this.input,
      camera: this.camera,
      audio: this.audio,
      spawn: mapDefinition.playerSpawn ?? {
        x: 0,
        y: 2.2,
        z: 8
      }
    });

    this.weaponManager = new WeaponManager({
      physics: this.physics,
      player: this.player,
      input: this.input,
      camera: this.camera,
      scene: this.scene,
      audio: this.audio,
      decals: this.decals
    });

    this.viewModel = new ViewModel(this.camera);
    this.weaponManager.viewModel = this.viewModel;

    /**
     * Колесо миші: перемикання зброї + гранат.
     */
    this.renderer.domElement.addEventListener('wheel', (e) => {
      if (this.input?.pointerLocked && this.weaponManager) {
        e.preventDefault();
        this.weaponManager.cycleWeapon(e.deltaY > 0 ? -1 : 1);
      }
    }, { passive: false });

    window.removeEventListener('weapon:hit', this.onWeaponHit);
    window.addEventListener('weapon:hit', this.onWeaponHit);

    window.addEventListener('sfx:bark', (event) => {
      this.audio?.playBark?.(event.detail?.position ?? null);
    });

    this.hud = new HUD({
      player: this.player,
      weaponManager: this.weaponManager,
      gameState: this.gameState
    });

    this.killFeed = new KillFeed();

    this.economy = new EconomyManager();

    /**
     * Команди та хост.
     */
    const playerIds = Array.from(
      this.lobby?.players?.keys?.() ?? []
    );

    if (!playerIds.length && this.lobby?.id) {
      playerIds.push(this.lobby.id);
    }

    this.matchTeams = computeTeams(playerIds);

    const sortedIds = [...playerIds].sort();

    const isHost = sortedIds.length
      ? sortedIds[0] === this.lobby?.id
      : true;

    /**
     * Network manager.
     */
    this.networkManager = new NetworkManager({
      lobby: this.lobby,
      scene: this.scene,
      physics: this.physics,
      player: this.player,
      weaponManager: this.weaponManager,
      hud: this.hud,
      gameState: this.gameState,
      killFeed: this.killFeed,
      spawnPoints: mapDefinition.botSpawns ?? [],
      audio: this.audio,
      economy: this.economy,
      teams: this.matchTeams,
      isHost: isHost
    });

    /**
     * Runtime-патч NetworkManager для команд і цілей.
     */
    const nm = this.networkManager;

    nm.teams = this.matchTeams;

    /**
     * Прийом чату — показати повідомлення.
     */
    nm.onChat = (chat) => {
      this.chatUI?.addMessage({
        senderName: chat.senderName,
        text: chat.text,
        team: chat.team
      });
    };

    nm.getLocalTeam = () => {
      return nm.teams[nm.localId] ?? 'CT';
    };

    nm.getPlayerTargets = () => {
      const targets = [];

      if (nm.player && nm.alive) {
        targets.push({
          playerId: nm.localId,
          name: nm.localName,
          team: nm.getLocalTeam(),
          isLocal: true,
          alive: nm.alive,
          position: nm.player.position,
          getEyePosition: () => nm.player.getEyePosition(),
          getState: () => nm.player.getState?.() ?? {},
          velocity: nm.player.velocity
        });
      }

      for (const peer of nm.peers.values()) {
        if (!peer.alive) {
          continue;
        }

        targets.push({
          playerId: peer.id,
          name: peer.name,
          team: peer.team ?? nm.teams[peer.id] ?? 'T',
          isLocal: false,
          alive: peer.alive,
          position: peer.position,
          getEyePosition: () =>
            new THREE.Vector3(
              peer.position.x,
              peer.position.y + 0.81,
              peer.position.z
            ),
          getState: () => ({
            speed: 0,
            crouched: false
          }),
          velocity: peer.velocity ?? null
        });
      }

      return targets;
    };

    const originalEnsurePeer = nm.ensurePeer.bind(nm);

    nm.ensurePeer = (id, name) => {
      const peer = originalEnsurePeer(id, name);
      const team = nm.teams[id] ?? peer.team ?? 'T';

      /**
       * Викликаємо setTeam, щоб оновити colliderMeta + колір моделі,
       * а не лише поле. Запобігає friendly fire після зміни сторін.
       */
      peer.setTeam?.(team);
      peer.team = team;

      return peer;
    };

    for (const [id, peer] of nm.peers) {
      const team = nm.teams[id] ?? peer.team ?? 'T';

      peer.setTeam?.(team);
      peer.team = team;
    }

    const originalOnLocalHitRemotePlayer =
      nm.onLocalHitRemotePlayer.bind(nm);

    nm.onLocalHitRemotePlayer = (
      targetId,
      damage,
      hitZone,
      victimName
    ) => {
      const targetTeam =
        nm.teams[targetId] ?? nm.peers.get(targetId)?.team;

      if (targetTeam && targetTeam === nm.getLocalTeam()) {
        return;
      }

      originalOnLocalHitRemotePlayer(
        targetId,
        damage,
        hitZone,
        victimName
      );
    };

    /**
     * Гранати.
     */
    this.grenadeManager = new GrenadeManager({
      scene: this.scene,
      physics: this.physics,
      player: this.player,
      camera: this.camera,
      input: this.input,
      network: this.networkManager,
      audio: this.audio,
      decals: this.decals,
      hud: this.hud
    });

    this.weaponManager.grenadeManager = this.grenadeManager;

    /**
     * Мережеві боти.
     */
    this.networkBots = new NetworkBots({
      enabled: true,
      isHost,
      network: this.networkManager,
      scene: this.scene,
      physics: this.physics,
      navGrid: this.navGrid,
      spawnPoints: mapDefinition.botSpawns ?? [],
      botZones: mapDefinition.botZones ?? null,
      weaponManager: this.weaponManager,
      killFeed: this.killFeed,
      audio: this.audio,
      localTeam: this.matchTeams[this.lobby?.id] ?? 'CT'
    });

    this.grenadeManager.networkBots = this.networkBots;
    this.networkBots.grenadeManager = this.grenadeManager;
    this.networkManager.networkBots = this.networkBots;

    /**
     * Боти чують постріли локального гравця.
     */
    this.networkManager.onPlayerShot = (position, type) => {
      this.networkBots?.reportSoundToBots?.(position, type);
    };

    /**
     * Двері.
     */
    this.doorSystem = new DoorSystem({
      scene: this.scene,
      physics: this.physics,
      audio: this.audio,
      network: this.networkManager
    });

    for (const doorConfig of this.mapDoors) {
      this.doorSystem.addDoor(doorConfig);
    }

    this.weaponManager.doorSystem = this.doorSystem;
    this.networkBots.doorSystem = this.doorSystem;

    /**
     * Scoreboard + buy menu.
     */
    this.scoreboard = new ScoreBoard();

    if (this.hud?.timer) {
      this.hud.timer.style.display = 'none';
    }

    this.buyMenu = new BuyMenu({
      economy: this.economy,
      onBuy: (itemId) => this.onBuyItem(itemId),
      onClose: () => this.relockPointer()
    });

    this.namePlates = new NamePlates();

    /**
     * Round manager.
     */
    this.roundManager = new RoundManager({
      isHost,
      network: this.networkManager,
      networkBots: this.networkBots,
      teams: this.matchTeams,
      weaponManager: this.weaponManager,
      gameState: this.gameState,
      scoreboard: this.scoreboard,
      buyMenu: this.buyMenu,
      audio: this.audio,
      economy: this.economy
    });

    /**
     * Бомба (C4): plant / defuse / explosion.
     */
    this.bombSystem = new BombSystem({
      scene: this.scene,
      physics: this.physics,
      network: this.networkManager,
      networkBots: this.networkBots,
      hud: this.hud,
      audio: this.audio
    });

    this.bombSystem.setup(mapDefinition.bombSites ?? []);
    this.bombSystem.attachRoundManager(this.roundManager);
    this.bombSystem.onRoundEnd = (winner) => {
      if (this.roundManager.phase === 'live') {
        this.roundManager.endRound(winner);
      }
    };
    this.roundManager.bomb = this.bombSystem;

    /**
     * Розводимо мережеві повідомлення без дублювання.
     */
    const originalLobbyMessageHandler = this.lobby.onAnyMessage;
    const networkBotsMessageHandler = this.networkManager.onGameMessage;

    this.networkManager.onGameMessage = null;

    this.lobby.onAnyMessage = (message) => {
      originalLobbyMessageHandler?.(message);

      if (!message?.type) {
        return;
      }

      const senderId = message.id ?? message.senderId;

      if (!senderId || senderId === this.networkManager.localId) {
        return;
      }

      if (message.type.startsWith('game:')) {
        networkBotsMessageHandler?.(message);
        this.grenadeManager?.handleMessage?.(message);
        this.doorSystem?.handleMessage?.(message);
        this.bombSystem?.handleMessage?.(message);
      }

      if (
        message.type.startsWith('round:') ||
        message.type.startsWith('game:')
      ) {
        this.roundManager.handleMessage(message);
      }
    };

    /**
     * Екран завершення матчу.
     */
    this.matchOverScreen = new MatchOverScreen({
      isHost,
      onRematch: () => this.onRematch()
    });

    this.roundManager.onMatchOver = (winner, scores) => {
      this.onMatchOverLocal(winner, scores);
    };

    this.networkManager.onMatchOverRemote = (message) => {
      this.onMatchOverRemoteMessage(message);
    };

    /**
     * Host migration.
     */
    this.hostMigration = new HostMigration({
      lobby: this.lobby,
      onBecomeHost: () => this.onBecomeHost()
    });

    this.hostMigration.setHost(isHost);

    this.syncPhysicsToGraphics();

    window.addEventListener('resize', this.onResize);

    this.animate();

    /**
     * Автоматичне захоплення миші на старті:
     * натискання START GAME — це user gesture, тож lock
     * має спрацювати. Якщо браузер відхилить — клік по
     * canvas або _armRelockOnNextGesture підхопить.
     */
    setTimeout(() => {
      this.relockPointer();
    }, 100);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });

    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1.75)
    );

    this.renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.renderer.domElement.style.display = 'block';

    const container =
      document.querySelector('#app') ?? document.body;

    container.appendChild(this.renderer.domElement);

    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
      loadingEl.remove?.();
    }
  }

  initScene() {
    this.scene = new THREE.Scene();

    this.scene.background = new THREE.Color(0x8fa3ad);
    this.scene.fog = new THREE.Fog(0x8fa3ad, 70, 220);

    this.camera = new THREE.PerspectiveCamera(
      90,
      window.innerWidth / window.innerHeight,
      0.05,
      500
    );

    this.camera.position.set(0, 2.2, 8);

    this.scene.add(this.camera);
  }

  initLights() {
    const hemi = new THREE.HemisphereLight(
      0xbfd4e2,
      0x4a4438,
      0.85
    );

    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);

    sun.position.set(28, 42, 18);
    sun.castShadow = true;

    sun.shadow.mapSize.set(2048, 2048);

    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 140;

    const shadowSize = 45;

    sun.shadow.camera.left = -shadowSize;
    sun.shadow.camera.right = shadowSize;
    sun.shadow.camera.top = shadowSize;
    sun.shadow.camera.bottom = -shadowSize;

    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.02;

    sun.shadow.camera.updateProjectionMatrix();

    sun.target.position.set(0, 0, 0);

    this.scene.add(sun);
    this.scene.add(sun.target);

    this.sun = sun;
  }

  loadSelectedMap() {
    const mapDefinition =
      getMapDefinition(this.selectedMap) ??
      getMapDefinition('cs_mansion');

    this.navGrid = new GridNavMesh({
      minX: mapDefinition.navGridBounds?.[0] ?? -40,
      maxX: mapDefinition.navGridBounds?.[1] ?? 40,
      minZ: mapDefinition.navGridBounds?.[2] ?? -40,
      maxZ: mapDefinition.navGridBounds?.[3] ?? 40,
      cellSize: 1
    });

    const builder = new MapBuilder({
      scene: this.scene,
      physics: this.physics,
      navGrid: this.navGrid
    });

    mapDefinition.build(builder);
    builder.build();

    this.mapDoors = builder.doors ?? [];

    this.hud?.setMapRects?.(builder.getWallRects?.() ?? []);

    return mapDefinition;
  }

  applyMapTheme(mapDefinition) {
    const sky = mapDefinition.skyColor ?? 0x8fa3ad;
    const fog = mapDefinition.fogColor ?? sky;

    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(fog, 70, 220);

    /**
     * Процедурний скайбокс (градієнт + сонце) —
     * підміняє flat-колір на більш реалістичне небо.
     */
    if (this.skyboxMesh) {
      this.scene.remove(this.skyboxMesh);
      this.skyboxMesh = null;
    }

    const preset = SKY_PRESETS[mapDefinition.id] ?? SKY_PRESETS.cs_mansion;

    this.skyboxMesh = createSkybox(preset);
    this.skyboxMesh.position.copy(this.camera?.position ?? new THREE.Vector3(0, 0, 0));
    this.scene.add(this.skyboxMesh);
  }

  spawnDogs(mapDefinition) {
    for (const dog of this.dogs) {
      dog.dispose();
    }
    this.dogs = [];

    const count = 4 + Math.floor(Math.random() * 4);
    const bounds = mapDefinition.navGridBounds ?? [-40, 40, -40, 40];
    const minX = bounds[0] + 6;
    const maxX = bounds[1] - 6;
    const minZ = bounds[2] + 6;
    const maxZ = bounds[3] - 6;

    for (let i = 0; i < count; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const z = minZ + Math.random() * (maxZ - minZ);

      const dog = new Dog({
        scene: this.scene,
        physics: this.physics,
        navGrid: this.navGrid,
        position: { x, y: 0.5, z }
      });

      this.dogs.push(dog);
    }
  }

  updateDogs(dt) {
    if (!this.dogs.length) return;

    const threats = [];

    if (this.player && this.networkManager?.alive) {
      threats.push({
        position: this.player.position,
        alive: true,
        isLocal: true
      });
    }

    if (this.networkManager?.peers) {
      for (const peer of this.networkManager.peers.values()) {
        if (peer.alive) {
          threats.push({ position: peer.position, alive: true });
        }
      }
    }

    const botMap = this.networkBots?.isHost
      ? this.networkBots?.hostBots
      : this.networkBots?.clientBots;

    if (botMap) {
      for (const bot of botMap.values()) {
        if (bot.alive) {
          threats.push({ position: bot.position, alive: true });
        }
      }
    }

    for (const dog of this.dogs) {
      dog.update(dt, threats);
    }
  }

  syncPhysicsToGraphics() {
    for (const item of this.syncList) {
      if (item.type === 'instanced') {
        for (let i = 0; i < item.bodies.length; i++) {
          const body = item.bodies[i];

          const t = body.translation();
          const r = body.rotation();

          this.dummy.position.set(t.x, t.y, t.z);
          this.dummy.quaternion.set(r.x, r.y, r.z, r.w);
          this.dummy.updateMatrix();

          item.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        item.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  onWeaponHit(event) {
    const userData = event.detail?.userData;

    if (!userData) {
      return;
    }

    if (userData.breakable && userData.body && !userData.broken) {
      userData.broken = true;

      if (userData.mesh) {
        userData.mesh.visible = false;
      }

      if (this.physics) {
        this.physics.removeBody(userData.body);
      }

      this.audio?.playGlassBreak?.(
        userData.mesh?.position ?? null
      );

      return;
    }

    const mesh = userData.mesh;

    if (!mesh) {
      return;
    }

    if (mesh.isInstancedMesh) {
      return;
    }

    if (!mesh.material?.emissive) {
      return;
    }

    mesh.material.emissive.setHex(0x551111);

    clearTimeout(mesh.userData.flashTimeout);

    mesh.userData.flashTimeout = setTimeout(() => {
      mesh.material.emissive.setHex(0x000000);
    }, 70);
  }

  onBuyItem(itemId) {
    const price = SHOP_PRICES[itemId];

    if (price == null) {
      return;
    }

    /**
     * Team-specific: CT не купує AK-47, T не купує M4A1.
     */
    const team = this.networkManager?.getLocalTeam?.() ?? 'CT';

    if (itemId === 'ak47' && team === 'CT') {
      this.buyMenu.setStatus('CT ONLY: M4A1');
      return;
    }

    if (itemId === 'm4a1' && team === 'T') {
      this.buyMenu.setStatus('T ONLY: AK-47');
      return;
    }

    if (!this.economy.canAfford(price)) {
      this.buyMenu.setStatus('NOT ENOUGH MONEY');
      return;
    }

    if (itemId === 'he' || itemId === 'flash' || itemId === 'smoke') {
      if (!this.grenadeManager.canBuy(itemId)) {
        this.buyMenu.setStatus('MAX GRENADES');
        return;
      }
    }

    this.economy.spend(price);

    switch (itemId) {
      case 'ak47':
      case 'm4a1':
      case 'deagle':
        this.weaponManager.selectWeapon(itemId);
        this.buyMenu.setStatus(`BOUGHT ${itemId.toUpperCase()}`);
        break;

      case 'armor':
        this.gameState.armor = 100;
        this.buyMenu.setStatus('BOUGHT KEVLAR');
        break;

      case 'he':
      case 'flash':
      case 'smoke':
        this.grenadeManager.buy(itemId);
        this.buyMenu.setStatus(`BOUGHT ${itemId.toUpperCase()}`);
        break;
    }

    this.buyMenu.refresh();
  }

  onMatchOverLocal(winner, scores) {
    const stats = this.networkManager.getStatsSnapshot();

    document.exitPointerLock?.();

    this.matchOverScreen.show({
      winner,
      scores,
      stats
    });

    /**
     * Хост розсилає фінальну статистику всім.
     */
    if (this.roundManager.isHost) {
      this.networkManager.send({
        type: 'game:matchover',
        id: this.networkManager.localId,
        winner,
        scores,
        stats
      });
    }
  }

  onMatchOverRemoteMessage(message) {
    document.exitPointerLock?.();

    this.matchOverScreen.show({
      winner: message.winner,
      scores: message.scores,
      stats: message.stats ?? []
    });
  }

  onRematch() {
    this.matchOverScreen.hide();

    if (this.roundManager.isHost) {
      this.roundManager.restartMatch();
    }
  }

  onBecomeHost() {
    this.roundManager.isHost = true;
    this.networkBots.isHost = true;
    this.networkManager.isHost = true;

    if (this.networkBots.hostBots.size === 0) {
      this.networkBots.spawnHostBots();
    }

    for (const bot of this.networkBots.clientBots.values()) {
      bot.dispose();
    }

    this.networkBots.clientBots.clear();

    if (this.roundManager.phase === 'waiting') {
      this.roundManager.startBuy(false);
    } else {
      /**
       * Якщо фаза не waiting (live/ended/buy), новий хост
       * повинен негайно синхронізувати стан, щоб клієнти
       * не чекали наступного sendAccumulator (0.5с).
       */
      this.roundManager.sendState?.();
    }

    this.matchOverScreen?.setIsHost(true);
  }

  onResize() {
    if (!this.renderer || !this.camera) {
      return;
    }

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Відновлення Pointer Lock після закриття меню/ESC.
   * Якщо гра активна (started, не matchover) і жодне меню
   * не відкрите — повертаємо захоплення миші.
   */
  relockPointer() {
    if (!this.started || !this.input) {
      return;
    }

    if (this.matchOverScreen?.isVisible?.()) {
      return;
    }

    if (this.buyMenu?.open) {
      return;
    }

    if (this.settingsMenu?.open) {
      return;
    }

    /**
     * Pointer Lock можна відновити тільки після user gesture
     * (клік/клавіша). ESC-натискання не є таким у деяких браузерах,
     * тому пробуємо відновити при найближчому кліку/клавіші.
     */
    if (!this.input.pointerLocked) {
      this.input.lock();
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.1);

    this.accumulator += dt;

    const FIXED_DT = 1 / 60;

    while (this.accumulator >= FIXED_DT) {
      this.physics.step(FIXED_DT);

      if (this.player) {
        this.player.fixedUpdate(FIXED_DT);
      }

      this.accumulator -= FIXED_DT;
    }

    this.syncPhysicsToGraphics();

    const alpha = this.accumulator / FIXED_DT;

    if (this.player) {
      this.player.update(dt, alpha);
    }

    /**
     * ПКМ (zoom): зменшення FOV для «прицілювання».
     * AWP: снайперський скоуп FOV 20.
     */
    const awpScoped =
      this.weaponManager?.current?.id === 'awp' &&
      this.weaponManager?.zoomActive;

    if (this.weaponManager?.zoomActive) {
      const zoomFov = awpScoped ? 20 : 55;
      this.camera.fov += (zoomFov - this.camera.fov) * Math.min(1, dt * 12);
    } else {
      const targetFov = this.settingsMenu?.settings?.fov ?? 90;
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 10);
    }
    this.camera.updateProjectionMatrix();

    if (this.deathCamActive === true && this.networkManager?.alive) {
      this.deathCamActive = false;
    }

    if (this.weaponManager) {
      this.weaponManager.update(dt);
    }

    if (this.viewModel && this.player) {
      /**
       * AWP у скоупі: модель зброї ховається (як у CS,
       * тільки приціл-круг).
       */
      const awpScoped =
        this.weaponManager?.current?.id === 'awp' &&
        this.weaponManager?.zoomActive;

      this.viewModel.root.visible =
        this.weaponManager?.enabled !== false && !awpScoped;

      this.viewModel.update(dt, {
        speed: Math.hypot(
          this.player.velocity?.x ?? 0,
          this.player.velocity?.z ?? 0
        ),
        grounded: this.player.grounded,
        crouched: this.player.crouched,
        bobPhase: this.player.bobPhase ?? 0
      });
    }

    if (this.networkManager) {
      this.networkManager.update(dt);
    }

    if (this.roundManager) {
      this.roundManager.update(dt);
    }

    if (this.hostMigration) {
      this.hostMigration.update(dt);
    }

    if (
      this.matchOverScreen &&
      this.roundManager &&
      this.roundManager.phase !== 'matchover'
    ) {
      this.matchOverScreen.hide();
    }

    if (this.networkBots) {
      this.networkBots.update(dt);
    }

    this.updateDogs(dt);

    if (this.hud) {
      this.hud.update(dt);
    }

    if (this.scoreboard) {
      this.scoreboard.update(dt);
    }

    if (this.grenadeManager) {
      this.grenadeManager.update(dt);
    }

    if (this.bombSystem && this.roundManager?.phase === 'live') {
      this.bombSystem.update(dt);
    }

    if (this.hud && this.economy) {
      this.hud.setMoney(this.economy.money);
    }

    if (this.hud && this.grenadeManager) {
      this.hud.setGrenades(
        this.grenadeManager.inventory,
        this.grenadeManager.selected
      );
    }

    if (this.buyMenu) {
      this.buyMenu.refresh();
    }

    if (this.doorSystem) {
      const actors = [];

      if (this.player) {
        actors.push(this.player.position);
      }

      if (this.networkManager?.peers) {
        for (const peer of this.networkManager.peers.values()) {
          if (peer.alive) {
            actors.push(peer.position);
          }
        }
      }

      const botMap = this.networkBots?.isHost
        ? this.networkBots.hostBots
        : this.networkBots?.clientBots;

      if (botMap) {
        for (const bot of botMap.values()) {
          if (bot.alive) {
            actors.push(bot.position);
          }
        }
      }

      this.doorSystem.update(
        dt,
        actors,
        this.input,
        this.player?.position ?? null
      );
    }

    if (this.decals) {
      this.decals.update(dt);
    }

    if (this.audio?.ctx) {
      this.camera.getWorldDirection(this.audioForward);

      this.audio.setListener(
        this.camera.position,
        this.audioForward,
        this.camera.up
      );

      this.audio.updateAmbient?.(dt);
    }

    if (
      !this.networkManager?.alive &&
      this.roundManager?.phase === 'live' &&
      this.player
    ) {
      this.updateDeathCam(dt);
    }

    this.updateNamePlates();

    if (this.skyboxMesh && this.camera) {
      this.skyboxMesh.position.copy(this.camera.position);
    }

    this.renderer.render(this.scene, this.camera);

    this._updateDebugOverlay();

    this.fpsAccum += dt;
    this.fpsFrames++;

    if (this.fpsAccum >= 1) {
      const fps = Math.round(this.fpsFrames / this.fpsAccum);

      document.title = `CS16 Web — FPS: ${fps}`;

      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }
  }

  _updateDebugOverlay() {
    if (!this._dbgVisible || !this._dbgPre) return;

    const rm = this.roundManager;
    const pl = this.player;
    const doors = this.doorSystem?.doors;
    const hostBots = this.networkBots?.hostBots;
    const clientBots = this.networkBots?.clientBots;

    let openDoors = 0;
    let blockedDoors = 0;
    if (doors) {
      for (const d of doors.values()) {
        if (d.state === 'open') openDoors++;
        if (d.colliderBody) blockedDoors++;
      }
    }

    const botCount = (hostBots?.size ?? 0) + (clientBots?.size ?? 0);
    const peerCount = this.networkManager?.peers?.size ?? 0;

    let botPositions = '';
    if (hostBots) {
      const list = [];
      for (const bot of hostBots.values()) {
        list.push(`${bot.team}:${bot.position.x.toFixed(0)},${bot.position.z.toFixed(0)}`);
      }
      botPositions = list.join(' ');
    }

    /**
     * Діагностика найближчого живого бота: чому він не вмирає /
     * не реагує. Показує HP, Y, дистанцію, зір у обидва боки.
     */
    let nearestBotInfo = 'none';
    if (hostBots && pl && this.physics && this.networkManager?.alive) {
      let best = null;
      let bestDist = Infinity;

      for (const bot of hostBots.values()) {
        if (!bot.alive) continue;
        const d = pl.position.distanceTo(bot.position);
        if (d < bestDist) {
          bestDist = d;
          best = bot;
        }
      }

      if (best) {
        const botEye = best.getEyePosition();
        const playerEye = pl.getEyePosition();

        const botSeesPlayer = best.canSee
          ? best.canSee(playerEye)
          : '?';

        const toChest = new THREE.Vector3(
          best.position.x - playerEye.x,
          best.position.y + 0.45 - playerEye.y,
          best.position.z - playerEye.z
        );
        const chestDist = toChest.length();
        toChest.normalize();

        let hitTag = 'clear';
        let firstHitInfo = '';

        for (let i = 0; i < 4; i++) {
          const hit = this.physics.raycast(
            playerEye,
            toChest,
            chestDist,
            i === 0 ? pl.collider : null
          );

          if (!hit) {
            hitTag = i === 0 ? 'REACHES BOT' : hitTag;
            break;
          }

          if (
            hit.userData?.hostBot === best ||
            hit.userData?.playerId === best.id ||
            hit.userData?.botId === best.id
          ) {
            hitTag = `HIT ${hit.userData?.hitZone ?? '?'}@${hit.distance.toFixed(2)}`;
            break;
          }

          firstHitInfo +=
            `>${hit.userData?.material ?? '?'}@${hit.distance.toFixed(2)}m`;

          const adv = Math.max(hit.distance ?? 0, 0.001) + 0.08;
          playerEye.addScaledVector(toChest, adv);
        }

        nearestBotInfo =
          `${best.name} hp=${best.health} y=${best.position.y.toFixed(2)} ` +
          `dist=${bestDist.toFixed(1)}m seesYou=${botSeesPlayer ? 'Y' : 'N'} ` +
          `rayToChest: ${hitTag}${firstHitInfo} tgt=${best.currentTargetId ?? '-'} ` +
          `diff=${best.difficulty}`;
      }
    }

    const pos = pl?.position;

    let meshCount = '?';
    if (this.scene) {
      let instanced = 0;
      let regular = 0;
      this.scene.traverse((obj) => {
        if (obj.isInstancedMesh) instanced++;
        else if (obj.isMesh) regular++;
      });
      meshCount = `inst=${instanced} reg=${regular}`;
    }

    let ahead = '?';
    let aheadLow = '?';
    let rampProbe = '?';
    if (pl && this.physics) {
      const dir = pl.getDirection?.();
      const eye = pl.getEyePosition?.() ?? pos;

      if (dir) {
        const hit = this.physics.raycast(eye, dir, 2.5);

        if (hit) {
          const ud = hit.userData ?? {};
          const tag = ud.isDoor
            ? `door(${ud.doorId})`
            : ud.hostBot
              ? 'bot'
              : ud.player
                ? 'player'
                : ud.remotePlayer
                  ? 'remote'
                  : ud.material ?? '?';

          ahead = `${tag}@${hit.distance.toFixed(2)}m`;
        } else {
          ahead = 'clear';
        }

        const lowOrigin = {
          x: eye.x,
          y: (pos?.y ?? 0) + 0.5,
          z: eye.z
        };

        const lowHit = this.physics.raycast(lowOrigin, dir, 2.5);

        if (lowHit) {
          const ud = lowHit.userData ?? {};
          const tag = ud.isDoor
            ? `door(${ud.doorId})`
            : ud.material ?? '?';

          aheadLow = `${tag}@${lowHit.distance.toFixed(2)}m`;
        } else {
          aheadLow = 'clear';
        }
      }

      const rampDown = this.physics.raycast(
        { x: 15, y: 6, z: 0 },
        { x: 0, y: -1, z: 0 },
        8
      );

      rampProbe = rampDown
        ? `${rampDown.userData?.material ?? '?'}@${rampDown.distance.toFixed(2)}m`
        : 'none';
    }

    const lines = [
      `phase=${rm?.phase ?? '?'} round=${rm?.round ?? '?'} time=${rm?.timeLeft?.toFixed?.(1) ?? '?'}`,
      `pointerLock=${this.input?.pointerLocked ? 'ON' : 'OFF'}`,
      `player: grounded=${pl?.grounded ? 'Y' : 'N'} pos=${pos ? `${pos.x.toFixed(1)},${pos.y.toFixed(2)},${pos.z.toFixed(1)}` : '?'}`,
      `camera: pitch=${pl?.pitch?.toFixed(1) ?? '?'} yaw=${pl?.yaw?.toFixed(1) ?? '?'}`,
      `ahead(eye): ${ahead} | ahead(low): ${aheadLow}`,
      `rampProbe(15,6,0 down): ${rampProbe}`,
      `mouseDelta: x=${this.input?.mouseDelta?.x?.toFixed(1) ?? 0} y=${this.input?.mouseDelta?.y?.toFixed(1) ?? 0}`,
      `doors: total=${doors?.size ?? 0} open=${openDoors} blocked=${blockedDoors}`,
      `bots: ${botCount} (host=${hostBots?.size ?? 0} client=${clientBots?.size ?? 0}) peers=${peerCount}`,
      `nearest: ${nearestBotInfo}`,
      `botPos: ${botPositions || 'none'}`,
      `meshes: ${meshCount}`,
      `money=${this.economy?.money ?? '?'} health=${this.gameState?.health ?? '?'}`,
      `[F1] to toggle`
    ];

    this._dbgPre.textContent = lines.join('\n');
  }

  /**
   * Death cam: після смерті камера слідкує за союзником
   * (або вбивцею), поки не настане респаун.
   */
  updateDeathCam(dt) {
    if (!this.player || !this.networkManager || !this.roundManager) {
      return;
    }

    const targets = [];
    const localTeam = this.networkManager.getLocalTeam?.() ?? 'CT';

    /**
     * Боти-союзники (hostBots на хості, clientBots на клієнті).
     */
    const botMap = this.networkBots?.isHost
      ? this.networkBots?.hostBots
      : this.networkBots?.clientBots;

    if (botMap) {
      for (const bot of botMap.values()) {
        if (bot.alive && bot.team === localTeam) {
          targets.push(bot.position);
        }
      }
    }

    /**
     * Реальні гравці-союзники.
     */
    if (this.networkManager?.peers) {
      for (const peer of this.networkManager.peers.values()) {
        if (
          peer.alive &&
          (peer.team === localTeam || this.networkManager.teams?.[peer.id] === localTeam)
        ) {
          targets.push(peer.position);
        }
      }
    }

    if (targets.length === 0) {
      return;
    }

    const myPos = this.player.position;

    let nearest = targets[0];
    let bestDist = Infinity;

    for (const pos of targets) {
      const dist = myPos.distanceTo(pos);

      if (dist < bestDist) {
        bestDist = dist;
        nearest = pos;
      }
    }

    const targetPos = new THREE.Vector3(
      nearest.x,
      nearest.y + 1.4,
      nearest.z
    );

    this.camera.position.lerp(targetPos, Math.min(1, dt * 4));
    this.camera.lookAt(
      nearest.x,
      nearest.y + 0.9,
      nearest.z - 3
    );

    this.deathCamActive = true;
  }

  updateNamePlates() {
    if (!this.namePlates || !this.networkManager || !this.camera) {
      return;
    }

    const localTeam = this.networkManager.getLocalTeam?.() ?? 'CT';
    const entities = [];

    /**
     * Віддалені гравці.
     */
    if (this.networkManager.peers) {
      for (const peer of this.networkManager.peers.values()) {
        if (!peer.alive || !peer.position) continue;

        entities.push({
          name: peer.name,
          team: peer.team ?? this.networkManager.teams?.[peer.id] ?? 'T',
          alive: true,
          position: peer.position,
          health: peer.health,
          localTeam
        });
      }
    }

    /**
     * Боти.
     */
    const botMap = this.networkBots?.isHost
      ? this.networkBots?.hostBots
      : this.networkBots?.clientBots;

    if (botMap) {
      for (const bot of botMap.values()) {
        if (!bot.alive || !bot.position) continue;

        entities.push({
          name: bot.name ?? 'Bot',
          team: bot.team ?? 'T',
          alive: true,
          position: bot.position,
          health: bot.health,
          localTeam
        });
      }
    }

    this.namePlates.update(entities, this.camera);
  }
}

const game = new Game();

game.init().catch((error) => {
  console.error('[Game] Failed to start:', error);

  const overlay = document.createElement('pre');

  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'margin:0',
    'padding:16px',
    'background:#111',
    'color:#ff6b6b',
    'overflow:auto',
    'z-index:9999',
    'font-family:monospace',
    'font-size:13px'
  ].join(';');

  overlay.textContent = error?.stack || String(error);

  document.body.appendChild(overlay);
});
