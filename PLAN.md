# План реалізації — CS 1.6 Web (перенос з Qwen)

Мета: перенести весь код з `qwen chat-export-1785682127496.json` у робочий проєкт у `G:\Open code\KOLDA`, зібрати та запустити.

## Крок 1 — Структура проєкту

```
G:\Open code\KOLDA\
├─ package.json / package-lock.json
├─ vite.config.js            (base: './')
├─ index.html
├─ .gitignore
├─ .github/workflows/deploy.yml
├─ README.md
└─ src/
   ├─ main.js                (бутстрап — фінальна версія + всі патчі)
   ├─ physics.js             (Rapier-обгортка)
   ├─ config.js              (Firebase config)
   ├─ engine/  InputManager, AudioManager, TextureFactory, Skybox, DecalSystem, SurfaceDetector
   ├─ player/  PlayerController
   ├─ weapons/ Weapon, HitScan, WeaponManager, GrenadeManager, ViewModel, defs/AK47, M4A1, DesertEagle
   ├─ ai/      GridNavMesh, Bot, BotManager
   ├─ maps/    MapLoader, cs_mansion, cs_assault
   ├─ net/     LobbyService, NetworkManager, NetworkBots, HostMigration, teams, createLobbyAdapter,
   │           adapters/LocalAdapter, adapters/FirebaseAdapter
   ├─ game/    RoundManager, EconomyManager, DoorSystem
   └─ ui/      HUD, BuyMenu, KillFeed, ScoreBoard, MatchOverScreen, lobby/LobbyUI
```

## Крок 2 — Перенос коду (порядок, з урахуванням патчів)

1. **msg_1**: package.json, vite.config.js, index.html → створити.
2. **msg_3**: engine/InputManager.js, player/PlayerController.js (база).
3. **msg_5**: weapons/HitScan.js, weapons/Weapon.js, weapons/defs/{AK47,M4A1,DesertEagle}.js, weapons/WeaponManager.js (база).
4. **msg_7**: ui/HUD.js (база).
5. **msg_9**: ai/GridNavMesh.js, ai/Bot.js, ai/BotManager.js.
6. **msg_11**: net/adapters/LocalAdapter.js, net/LobbyService.js, ui/lobby/LobbyUI.js (бази).
7. **msg_13**: maps/MapLoader.js, maps/cs_mansion.js, maps/cs_assault.js (бази).
8. **msg_15**: config.js, net/adapters/FirebaseAdapter.js, net/createLobbyAdapter.js.
9. **msg_17**: ui/KillFeed.js, net/NetworkManager.js (база).
10. **msg_19**: net/teams.js, net/NetworkBots.js (база) + патчі NetworkManager (host-authoritative боти, T/CT).
11. **msg_21**: game/RoundManager.js, ui/BuyMenu.js (стара), ui/ScoreBoard.js, **фінальний main.js**, package.json (оновлений).
12. **msg_23**: engine/AudioManager.js, engine/DecalSystem.js + патчі (muzzle flash, vignette, PlayerController, HUD).
13. **msg_25**: game/EconomyManager.js, weapons/GrenadeManager.js, **нова ui/BuyMenu.js** + патчі (AudioManager, KillFeed, HUD, WeaponManager, NetworkManager, NetworkBots, RoundManager, main.js).
14. **msg_27**: ui/MatchOverScreen.js, net/HostMigration.js + патчі (LobbyService — голосування, LobbyUI, RoundManager MR15, NetworkManager — статистика, NetworkBots — swapBotTeams, ScoreBoard, main.js).
15. **msg_29**: engine/TextureFactory.js, engine/Skybox.js, weapons/ViewModel.js + патчі (MapLoader, WeaponManager, main.js).
16. **msg_31**: .gitignore, deploy.yml, README.md, engine/SurfaceDetector.js + патчі (PlayerController — кроки, AudioManager — playFootstep, NetworkManager, NetworkBots).
17. **msg_33**: game/DoorSystem.js + патчі (TextureFactory — двері, AudioManager — звуки дверей, MapLoader, cs_mansion, cs_assault, WeaponManager, main.js).
18. **msg_35**: патчі AI 2.0 (NetworkBots — HostBot/ClientBot, NetworkManager — RemotePlayer), GrenadeManager (ліміт диму), WeaponManager (falloff), PlayerController (стрибок/приземлення), AudioManager (playJump/playLand), main.js (networkBots.grenadeManager), cs_assault (укриття).

## Крок 3 — Збірка та виправлення

- `npm install` (three, @dimforge/rapier3d-compat, firebase, vite).
- `npm run build` → усунути помилки синтаксису/імпортів (зокрема: шляхи імпортів, `.js`-суфікси, `RAPIER.init()`).
- Логічні фікси (найімовірніші):
  - `networkBots.grenadeManager` присвоєння (msg_35 B.5);
  - взаємодія BuyMenu ↔ economy ↔ buy phase (RoundManager.enabledBuyPhase);
  - порядок ініціалізації systems у main.js.

## Крок 4 — Перевірка

- `npm run dev` → лобі (дві вкладки) → старт матчу на cs_mansion → стрільба, боти, гранати (G), buy menu (B), двері (E).
- Перевірка консолі на помилки.
- README + GitHub Actions на вимогу користувача.

## Критерії готовності

1. `npm run build` — без помилок.
2. Гра запускається з лобі до бою.
3. Мінімум 1 вкладка: боти рухаються, стріляють, отримують шкоду; killfeed працює.
4. HUD показує HP/броню/патрони/гроші.
