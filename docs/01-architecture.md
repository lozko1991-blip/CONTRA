# 01. Архітектура

> Повернутись: [PROJECT.md](../PROJECT.md) | [02-networking.md](02-networking.md)

## 1.1. Дерево файлів

```
index.html                    ← ЗБІРКА (для Pages); dev-джерело: index.src.html
└── src/
    ├── main.js                  ← ГОЛОВНИЙ ФАЙЛ: запуск, цикл, зв'язки всіх систем
    ├── config.js                ← Firebase конфіг (порожній = локальний режим)
    ├── physics.js               ← обгортка над Rapier (світ, колайдери, raycast)
    │
    ├── engine/                  ← низькорівневі системи
    │   ├── InputManager.js      ← клавіатура/миша/Pointer Lock
    │   ├── AudioManager.js      ← процедурний звук (Web Audio API)
    │   ├── DecalSystem.js       ← сліди від куль на стінах
    │   ├── Skybox.js            ← процедурне небо (градієнт + сонце)
    │   ├── SoldierModel.js      ← процедурна модель солдата
    │   ├── SurfaceDetector.js   ← визначення матеріалу під ногами
    │   └── TextureFactory.js    ← процедурні текстури (цегла, дерево...)
    │
    ├── player/
    │   └── PlayerController.js  ← рух гравця (GoldSrc-стиль: airaccel, bhop)
    │
    ├── weapons/
    │   ├── WeaponManager.js     ← стрільба, перезарядка, hitmarker, трасери
    │   ├── Weapon.js            ← база зброї (damage, spread, recoil)
    │   ├── HitScan.js           ← raycast-черга з пробиванням стін
    │   ├── GrenadeManager.js    ← HE/Flash/Smoke (фізика, вибухи, синк)
    │   ├── ViewModel.js         ← зброя від 1-ї особи (анімації)
    │   └── defs/                ← AK47, M4A1, DesertEagle, Knife, Crowbar
    │
    ├── ai/
    │   ├── NavMesh/GridNavMesh.js ← A* сітка для ботів
    │   ├── Dog.js               ← декоративні собаки (бігають, тікають)
    │   ├── Bot.js / BotManager.js ← СТАРИЙ локальний AI (мертвий код, не імпортується)
    │
    ├── net/
    │   ├── LobbyService.js      ← лобі: гравці, карта, голосування, старт
    │   ├── NetworkManager.js    ← хост/клієнт, peers, damage, kill, shot
    │   ├── NetworkBots.js       ← боти (HostBot — повний AI, ClientBot — візуал)
    │   ├── HostMigration.js     ← міграція хоста при виході
    │   ├── teams.js             ← розподіл команд CT/T
    │   ├── createLobbyAdapter.js← вибір адаптера (Local/Firebase/PeerJS)
    │   └── adapters/
    │       ├── LocalAdapter.js      ← BroadcastChannel (вкладки одного браузера)
    │       ├── FirebaseAdapter.js   ← інтернет через Firebase RTDB
    │       └── PeerJSAdapter.js     ← P2P (потребує налаштування)
    │
    ├── game/
    │   ├── RoundManager.js      ← фази раунду, рахунок, економіка, стан
    │   ├── EconomyManager.js    ← гроші гравця
    │   └── DoorSystem.js        ← двері (відкриття, руйнування, синк)
    │
    ├── maps/
    │   ├── MapLoader.js         ← MapBuilder: instanced-бокси, скло, двері, дерева
    │   ├── cs_mansion.js        ← карта 1 (садиба: 3 маршрути, балкон)
    │   └── cs_assault.js        ← карта 2 (склад: галерея, вентиляція)
    │
    └── ui/
        ├── HUD.js               ← приціл, HP, патрони, радар, таймер
        ├── KillFeed.js          ← стрічка вбивств
        ├── ScoreBoard.js        ← табло (Tab)
        ├── BuyMenu.js           ← меню покупки зброї (B)
        ├── NamePlates.js        ← нікнейми над гравцями/ботами
        ├── SettingsMenu.js      ← налаштування (ESC)
        ├── ChatUI.js            ← чат (Y — усім, U — команді)
        ├── MatchOverScreen.js   ← кінець матчу
        └── lobby/LobbyUI.js     ← екран лобі
```

## 1.2. Життєвий цикл гри

### Запуск
1. `main.js → init() → initLobby()` — створюється адаптер (Local/Firebase) і `LobbyService`
2. `LobbyUI` показує екран лобі: ім'я, вибір карти, список гравців, START
3. Натискання START → `onLobbyStart(mapId)` → `startEngine()`

### Старт движка (`startEngine()`)
Порядок створення систем (важливо не переплутати):
```
renderer → scene → lights → physics (Rapier WASM) → audio → decals
→ loadSelectedMap() (карта + navGrid) → applyMapTheme (небо/туман)
→ spawnDogs → input → settingsMenu → chatUI → player → weaponManager
→ viewModel → hud → killFeed → economy
→ computeTeams(playerIds) → NetworkManager → GrenadeManager → NetworkBots
→ DoorSystem → scoreboard → buyMenu → namePlates → RoundManager
→ matchOverScreen → HostMigration → animate()
```

**Ключове:** `networkBots` отримує `spawnPoints`, `botZones`, `doorSystem` ПІСЛЯ створення (посилання встановлюються постфіксно).

### Ігровий цикл (`animate()`)
```
requestAnimationFrame
├── fixed timestep 1/60: physics.step + player.fixedUpdate (акумулятор)
├── player.update(dt, alpha)        — миша, бобінг, камера
├── zoom FOV (ПКМ)
├── weaponManager.update            — стрільба, перезарядка, трасери
├── viewModel.update                — анімація зброї
├── networkManager.update           — відправка стану гравця
├── roundManager.update             — фази раунду (на хості — updateHost)
├── hostMigration.update            — перевірка зміни хоста
├── networkBots.update              — AI ботів (на хості)
├── updateDogs                      — собаки
├── hud.update + scoreboard.update  — UI
├── grenadeManager.update           — фізика гранат
├── doorSystem.update               — двері + актори (авто-відкриття)
├── decals.update                   — сліди
├── audio.setListener + updateAmbient
├── updateDeathCam / updateNamePlates
├── relockPointer (якщо треба)      — відновлення миші після ESC/fullscreen
├── renderer.render
└── FPS у заголовку вкладки
```

## 1.3. Ключові зв'язки між системами

```
Input ──► PlayerController (GoldSrc) ──► Rapier (WASM)
               │
WeaponManager ─┼─► HitScan ──► physics.raycast ──► DecalSystem
               │        │
ViewModel ◄────┘        └─► game:damage ──► NetworkManager
                                                   │
Lobby (Firebase / BroadcastChannel)              ▼
      │                              HUD · KillFeed · Stats
      └─► RoundManager (MR15) ──► HostBots ──► bot_state
```

## 1.4. Мережева маршрутизація повідомлень (main.js)

`lobby.onAnyMessage` — єдина точка входу всіх повідомлень:
```js
this.lobby.onAnyMessage = (message) => {
  originalLobbyMessageHandler?.(message);      // LobbyService
  if (message.type.startsWith('game:')) {
    networkBotsMessageHandler?.(message);       // NetworkManager
    this.grenadeManager?.handleMessage?.(message);
    this.doorSystem?.handleMessage?.(message);
  }
  if (message.type.startsWith('round:') || message.type.startsWith('game:')) {
    this.roundManager.handleMessage(message);
  }
};
```
**Нову систему** з мережевими повідомленнями додавай сюди (див. docs/07-development.md).
