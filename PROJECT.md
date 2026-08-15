# KOLDA — Паспорт проекту (Counter-Strike 1.6 Web)

> Версія: 1.0.0 (реліз)
> Стек: Vite + Three.js (r169) + Rapier3D (r0.19) + Firebase
> Ціль: повноцінний шутер CS-типу в браузері: соло з ботами, мультиплеєр до 10 гравців
> Репозиторій: https://github.com/lozko1991-blip/CONTRA
> GitHub Pages: https://lozko1991-blip.github.io/CONTRA/ — ✅ ЗАДЕПЛОЄНО І ПРАЦЮЄ

---

## 0. Швидка довідка (якщо нема часу читати все)

```
Гра запускається:  npm run dev  → http://localhost:5173
Збірка для релізу: npm run build → dist/

Головний файл:      src/main.js            (запуск + зв'язки всіх систем)
Мережа:             src/net/               (LobbyService → NetworkManager → NetworkBots)
Боти:               src/net/NetworkBots.js (HostBot — повний AI)
Карти:              src/maps/cs_mansion.js, cs_assault.js
Зброя:              src/weapons/defs/*.js  (характеристики)
Раунди:             src/game/RoundManager.js
Економіка:          src/game/EconomyManager.js (ціни → SHOP_PRICES)

Тест мультиплеєра локально: відкрий гру у 2+ вкладках (LocalAdapter).
F1 у грі — debug overlay. Tab — скорборд. B — покупка.
```

---

## 1. Швидкий старт

```bash
npm install        # встановити залежності (один раз)
npm run dev        # dev-сервер (Vite, HMR) → http://localhost:5173
npm run build      # продакшн-збірка → dist/
npm run preview    # перегляд збірки локально
npm run deploy     # build + публікація на GitHub Pages
```

**Порада:** якщо порт 5173 зайнятий, Vite сам обере інший (5174, 5175...) — дивись вивід у терміналі.

---

## 2. Архітектура (загальна схема)

```
index.html
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

---

## 3. Життєвий цикл гри

### 3.1. Запуск
1. `main.js → init() → initLobby()` — створюється адаптер (Local/Firebase) і `LobbyService`
2. `LobbyUI` показує екран лобі: ім'я, вибір карти, список гравців, START
3. Натискання START → `onLobbyStart(mapId)` → `startEngine()`

### 3.2. Старт движка (`startEngine()`)
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

### 3.3. Ігровий цикл (`animate()`)
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
├── renderer.render
└── FPS у заголовку вкладки
```

---

## 4. Мережева модель

### 4.1. Ролі
- **Хост** — гравець з найменшим id (лексикографічно, `sortedIds[0]`). На хості:
  - живуть `hostBots` з повним AI;
  - рахується кінець раунду (`checkEndCondition`);
  - розсилається `round:state` (кожні 0.5с) і `game:bot_state` (кожні 0.12с);
  - застосовується шкода від гранат/ботів (авторитет).
- **Клієнт** — отримує стан, показує `clientBots` (візуал без AI), відправляє свої дії (постріл, damage) хосту.

### 4.2. Повідомлення лобі (LobbyService)
| Тип | Напрямок | Призначення |
|-----|----------|-------------|
| `hello` | всі → всі | приєднання нового гравця |
| `presence` | всі (кожні 2с) | підтвердження життя |
| `map` | всі | зміна карти |
| `vote` / `votes` | всі | голосування за карту |
| `start` | будь-хто | старт гри (з mapId) |
| `bye` | всі | вихід гравця |

### 4.3. Ігрові повідомлення
| Тип | Опис |
|-----|------|
| `game:join` / `game:presence` | приєднання до матчу (хост призначає команду через `game:assign_team`) |
| `game:state` | позиція/поворот/HP/зброя гравця (періодично) |
| `game:shot` | постріл (для звуку/трасера у інших) |
| `game:damage` | шкода гравцю (хост → клієнт) |
| `game:kill` | вбивство (для killfeed, статистики, грошей) |
| `game:stats` | K/D гравця для скорборда (періодично) |
| `game:chat` | повідомлення чату |
| `game:bot_state` | снапшот ботів (хост → клієнти) |
| `game:bot_damage` | шкода боту (клієнт → хост) |
| `game:matchover` | кінець матчу |
| `round:state` | фаза раунду, таймер, рахунок, команди, winner |

### 4.4. Команди (teams.js)
`computeTeams(ids)` — сортує id, чергує CT/T. При соло-грі гравець → CT.

### 4.5. HostMigration
- Кожен гравець перевіряє раз на 0.3-2с: чи він тепер хост (найменший id).
- `onBecomeHost()`: спавнить ботів, очищає clientBots, синхронізує стан.

### 4.6. Хто що рахує (авторитетність) — ВАЖЛИВО для розуміння

| Подія | Хто вирішує | Як синхронізується |
|-------|-------------|---------------------|
| Кінець раунду / переможець | **тільки хост** | `round:state` → всі клієнти |
| Шкода гравцю від гравця | клієнт-стрілець | `game:damage` → ціль |
| Шкода гравцю від бота | хост (бот живе на хості) | `game:damage` → ціль |
| Шкода боту від гравця | клієнт → хост | `game:bot_damage` → хост застосовує |
| Шкода боту від бота | хост | напряму через `applyDamage` |
| Вибух HE / засліплення | хост (для всіх гранат), клієнт (свої) | damage-повідомлення |
| K/D, економіка | кожен клієнт локально | `game:kill` + `round:state` (детерміновані) |
| Позиції гравців | кожен транслює свою | `game:state` (періодично) |
| Позиції ботів | хост | `game:bot_state` (0.12с) |
| Смерть/респавн гравця | кожен сам | стан гравця в `game:state` |

**Правило:** хост = авторитет для всього, що стосується ботів і кінця раунду.
Клієнти ніколи не викликають `checkEndCondition` — лише застосовують `round:state`.

### 4.7. Команди (додатково до teams.js)
- `computeTeams(ids)`: сортує id лексикографічно → чергує `CT/T` (парний = CT, непарний = T).
- Колір команди: CT = синій `0x4a6fb0`, T = червоний `0xb04a4a` (SoldierModel + NamePlates).
- При соло-грі: 1 гравець → CT.
- `swapTeams()` на 15-му раунді міняє команди **всіх** (гравці + боти) і оновлює колайдери (без friendly fire).
- Mid-game join: хост призначає команду (менша команда) через `game:assign_team`.

---

## 5. Боти (NetworkBots.js)

### 5.1. Типи ботів
- **HostBot** (на хості) — повний AI: сприйняття, рішення, стрільба, фізика.
- **ClientBot** (на клієнті) — лише візуал + колайдери, позиція з `game:bot_state`.

### 5.2. Формат матчу
- **5v5**: кожна команда має 5 гравців; реальні гравці займають слоти, решту заповнюють боти.
- `spawnHostBots()` рахує реальних гравців у командах і додає ботів до 5.

### 5.3. Складність (difficulty)
| Рівень | Доля | Реакція | Spread | Агресія |
|--------|------|---------|--------|---------|
| hard | 35% | 80-180ms | ×0.30-0.50 | 0.75-0.95 |
| medium | 40% | 150-260ms | ×0.55-0.80 | 0.50-0.75 |
| easy | 25% | 280-420ms | ×0.90-1.30 | 0.25-0.50 |

### 5.4. Ролі
Чергування `rusher` (тиск) / `camper` (позиція) / `support` (підтримка).

### 5.5. Поведінка (що вміють)
- **Прицілювання**: перший постріл точний, віддача наростає, рух псує точність, crouch допомагає; `leadTarget` враховує рух цілі; хедшоти за рівнем (hard 18% / med 9% / easy 3%).
- **Слух**: постріли/кроки/гранати з дальністю; стіни приглушують (LOS); hard чують краще.
- **Тактика**: ухиляння від гранат, дим не заходять, wallbang (hard), фланкування коли союзник стріляє, прикриття поранених союзників, відхід за укриття при HP<35-60.
- **Економіка ботів**: $800 старт, +$300 за вбивство, +$2500 перемога / +$1400 поразка; на раунді "купують" AK/M4/Deagle залежно від грошей.
- **Радіо**: звукові команди при виявленні ворога / вбивстві / пораненні (слухають союзники).
- **Зони**: `botZones` з карти — тактичні позиції; ротація кожні 8-16с.
- **Двері**: `doorAhead()` — знає про двері на шляху, йде до них (авто-відкриття), не застрягає.
- **Анти-застрягання**: якщо не рухається 2с — телепорт на walkable точку.

### 5.6. Стрільба ботів
- `shootAt()` → `raycastShot()` — те саме пробивання що у гравця (матеріали стін).
- Боти **бачать і стріляють один одного** (getBotTargets включає ботів), friendly fire виключено (куля проходить крізь союзників).

---

## 6. Карти (maps/)

### 6.1. MapBuilder (MapLoader.js)
API для побудови карти (викликається з `build(builder)`):
```js
builder.addBox(material, [x,y,z], [sx,sy,sz], options)
  // options: { collider:false, navBlock:false, navInflate:0.35,
  //            rotation:{x,y,z}, friction, userData }
builder.addGlass(pos, size, options)   // скло (ламається)
builder.addDoor(config)                // двері: position, rotationY, width, height, material, flip, openDir
builder.addVehicle(type, pos, rotY, {color})  // car|truck (масштаб ×1.7/×1.4)
builder.addTree(x, z, scale)           // дерево (стовбур з колізією)
builder.addPointLight(color, intensity, pos, distance, decay)
```

### 6.2. Структура мап-конфіга
```js
{
  id, name,
  skyColor, fogColor,            // колір неба/туману
  navGridBounds: [minX,maxX,minZ,maxZ],  // розмір A* сітки
  playerSpawn: {x,y,z},          // стартова точка гравця
  playerSpawnsCT: [...],         // спавни гравців CT (5)
  playerSpawnsT: [...],          // спавни гравців T (5)
  botSpawns: [{x,z,team}...],    // спавни ботів (по 10-11 на команду)
  botZones: { CT: [{x,z}...], T: [...] },  // тактичні позиції ботів
  build(builder) {...}           // побудова геометрії
}
```

### 6.3. Логіка карт
**cs_mansion** — садиба:
- Будинок: 3 входи (головний, бічний захід, задній північ), 2 поверхи, сходи з обох боків на дах, балкон над входом.
- 3 маршрути атаки: A центр (ящики), B захід (гараж/контейнери), C схід (басейн).
- Додатково: сарай, басейн з водою, паркан з воротами.

**cs_assault** — склад:
- Склад: передні ворота + бічний вантажний вхід + задні металеві двері.
- Внутрішня галерея (2-й ярус) зі сходами — оборонна позиція.
- Вентиляційний тунель (потрібен присід), траншея, будка охорони.
- Укриття по шляху T → склад.

### 6.4. Матеріали і пробивання (HitScan.js)

**Механіка пробивання** (до 3 пробиттів за постріл):
1. `trace()` кидає raycast; при попаданні в матеріал перевіряє `penetrationPower` зброї проти `resistance` матеріалу.
2. Якщо `power >= resistance` — куля пробиває: шкода множиться на `PenetrationDamageMultiplier`, `power *= 0.72`, точка продовжує рух (+0.08м).
3. Якщо `power < resistance` — куля зупиняється.
4. Flesh (тіло) завжди зупиняє кулю (`stopsBullet`).

| Матеріал | Resistance | Множитель шкоди при пробитті |
|----------|-----------|------------------------------|
| glass | 0.15 | 0.85 |
| wood | 1.0 | 0.75 |
| carBody / carBodyBlue / carBodyGreen | 1.2 | 0.55 |
| wheel | 1.4 | 0.5 |
| truckBody / truckCab | 1.5 | 0.5 |
| brick | 2.2 | 0.55 |
| concrete | 2.4 | 0.55 |
| metal | 3.0 | 0.4 |
| flesh | 0.0 (стоп) | — |

**Зброя** (`penetrationPower`): AK-47 2.5, Deagle 2.5 (пробивають бетон), M4A1 2.3 (бетон ні, цеглу так), ніж/ломик 0.
*Приклад: AK стріляє в дерево → пробиває (2.5 ≥ 1.0), шкода ×0.75, далі в бетон → зупиняється (2.5×0.72=1.8 < 2.4).*

---

## 7. Зброя (weapons/)

| id | Зброя | Damage | Headshot | Магазин/резерв | Скорострільність | Примітки |
|----|-------|--------|----------|----------------|------------------|----------|
| ak47 | AK-47 | 36 | ×4 | 30/90 | 10/с | penetration 2.5 |
| m4a1 | M4A1 | 33 | ×4 | 30/90 | 11/с | з глушником (ПКМ), penetration 2.3 |
| deagle | Desert Eagle | 54 | ×4 | 7/35 | 3.6/с | penetration 2.5 |
| knife | Ніж | 55 | ×4 | — | 2.5/с | backstab ×2 зі спини, range 2.2 |
| crowbar | Ломик | 75 | ×4 | — | 1.8/с | важкий удар, range 2.6 |

**Правила:**
- **Team-specific**: CT не може купити AK, T не може купити M4 (BuyMenu блокує).
- **Швидкість руху** залежить від зброї (knife ×1.25, crowbar ×1.16, гвинтівки ×1.0), при стрільбі −15%.
- **Магазини**: зброя зберігається між раундами (не скидається при смерті).
- Зони пошкодження: head ×4, stomach ×1.25, legs ×0.75 (через колайдери hitbox).

### 7.1. Гранати
| Тип | Fuse | Радіус | Дія |
|-----|------|--------|-----|
| HE | 1.7с | 7.5м | до 92 шкоди, з LOS-перевіркою |
| Flash | 1.3с | 22м | засліплення за кутом огляду + LOS |
| Smoke | 1.4с | 4.2м | дим 13с, блокує постріли і зір ботів |

**Купівля**: HE ×1, Flash ×2, Smoke ×1 максимум. Кидок: ЛКМ (обрана G), цикл — G.

---

## 8. Рух гравця (PlayerController.js)

Реалізація в стилі GoldSrc (CS 1.6):
- **Рух**: WASD + стрілки; Shift — тихий крок; Ctrl/C — присідання.
- **Стрибки**: Space; bhop підтримується (air accelerate + wishspeed 30).
- **Фіксований крок**: 1/60с фізика + інтерполяція рендеру (alpha).
- **Крок через перешкоди**: ручний step-up 0.55м (Rapier autostep вимкнено — NaN).
- **Камера**: sensitivity налаштовується; recoil пружинний.
- **Звуки**: кроки (матеріал під ногами), стрибок, приземлення (залежить від падіння).

---

## 9. UI (ui/)

| Компонент | Клавіша | Опис |
|-----------|---------|------|
| HUD | — | приціл (розходиться з spread), HP, броня, гроші, патрони, гранати, радар, таймер раунду, індикатор шкоди (стрілка), ROUND WON/LOST |
| BuyMenu | B | купівля зброї/броні/гранат (цифри 1-7) |
| ScoreBoard | Tab | гравці обох команд з K/D (утримувати) |
| SettingsMenu | ESC | чутливість, FOV, гучність |
| ChatUI | Y / U | чат усім / команді; Enter — відправити |
| NamePlates | — | імена + HP над гравцями/ботами (червоний — ворог) |
| KillFeed | — | стрічка вбивств справа вгорі |
| MatchOverScreen | — | кінець матчу + Rematch |
| LobbyUI | — | лобі: ім'я, карта, гравці, START |

**Інше:** F1 — debug overlay (боти/двері/позиції). ⛶ — повний екран.

---

## 10. Раунди (RoundManager.js)

Фази: `waiting → buy (12с) → live (120с) → ended (6с) → buy → ...`

- **buy**: можна купувати (B), всі живі, боти респавняться.
- **live**: бій; кінець коли всі CT або всі T мертві; час вийшов → виграє CT.
- **ended**: пауза, показ ROUND WON/LOST, економіка нараховується.
- Після 30 раундів (15+15 зі зміною команд) — **matchover**, екран з результатом + Rematch.

**Захист:** якщо на старті live одна команда порожня — повернення у buy (не застрягає).

---

## 11. Економіка (EconomyManager.js)

- Старт: $800. Максимум $16000.
- Вбивство: +$300.
- Перемога раунду: +$3250. Поразка: $1400 + $500 за кожну поразку поспіль (до 5).
- Ціни: AK $2500, M4 $3100, Deagle $700, броня $650, HE $300, Flash $200, Smoke $300.

---

## 12. Двері (DoorSystem.js)

- **Авто-відкриття**: будь-який актор (гравець, бот, собака) ближче 1.6м — двері відчиняються.
- **E** — ручне відкриття/закриття.
- **Пошкодження**: стрільба ламає двері (doorWood).
- **Синхронізація**: стан дверей розсилається мережею.

---

## 13. Звук (AudioManager.js)

**Повністю процедурний** (Web Audio API, без файлів):
- постріли (за зброєю), влучання, вибухи, гранати;
- кроки (по матеріалу), стрибок, приземлення;
- hitmarker, dry fire, перезарядка;
- покупка, старт/кінець раунду;
- **radio-біпи ботів** (різні тони: spot/kill/cover/hurt);
- **ambient**: вітер + рідкісний пташиний спів;
- **гавкіт собак**;
- позиційний звук (PannerNode) + HRTF.

---

## 14. Правила додавання нового контенту

### Додати нову зброю
1. Створи `src/weapons/defs/MyWeapon.js` за зразком AK47.js (class Weapon).
2. Зареєструй у `WeaponManager` constructor (`this.weapons.myweapon = createMyWeapon()`).
3. Додай клавішу в `updateWeaponSwitch()` та в `cycleWeapon()` порядок.
4. Додай label у `KillFeed.weaponLabel()`.
5. Додай ціну в `SHOP_PRICES` і рядок у `BuyMenu.BUY_ITEMS`.

**Приклад — додати нову зброю `tmp` (ускладнено для ілюстрації):**
```js
// 1. weapons/defs/MP5.js
import { Weapon } from '../Weapon.js';
export function createMP5() {
  return new Weapon({
    id: 'mp5', name: 'MP5',
    automatic: true,
    damage: 22, headshotMultiplier: 4,
    magazineSize: 30, reserveAmmo: 120,
    fireRate: 13, reloadTime: 2.2,
    penetrationPower: 1.0,
    runSpeed: 6.9,          // швидше за AK — легка
    baseSpread: 0.014, moveSpread: 0.028,
    recoilPattern: [[0.008,0],[0.009,0.002],[0.008,-0.002]]
  });
}

// 2. WeaponManager constructor:
import { createMP5 } from './defs/MP5.js';
this.weapons.mp5 = createMP5();

// 3. updateWeaponSwitch():
} else if (this.input.isDown('Digit6')) { this.selectWeapon('mp5'); }

// 4. KillFeed.weaponLabel():
mp5: 'MP5',

// 5. SHOP_PRICES (EconomyManager.js) + BUY_ITEMS (BuyMenu.js):
mp5: 1500,
{ key: '6', id: 'mp5', name: 'MP5' },
```

### Додати нову карту
1. Створи `src/maps/cs_mynew.js` — експорт конфіга за зразком cs_mansion.js.
2. Зареєструй у `MapLoader.getMapDefinition()`.
3. Додай у `LobbyService.maps` і `LobbyUI` (якщо список жорсткий).
4. Додай preset у `Skybox.SKY_PRESETS`.
5. Додай `botSpawns` (10+/команду) і `botZones` (5 на команду).

**Мінімальний каркас нової карти:**
```js
// maps/cs_mynew.js
export const cs_mynew = {
  id: 'cs_mynew',
  name: 'cs_mynew',
  skyColor: 0x8fa3ad,
  fogColor: 0x8fa3ad,
  navGridBounds: [-40, 40, -40, 40],
  playerSpawn: { x: 0, y: 2.2, z: 20 },
  playerSpawnsCT: [{ x: 0, z: 20 }, { x: -5, z: 20 }, { x: 5, z: 20 }, { x: -2, z: 22 }, { x: 2, z: 22 }],
  playerSpawnsT: [{ x: 0, z: -20 }, { x: -5, z: -20 }, { x: 5, z: -20 }, { x: -2, z: -22 }, { x: 2, z: -22 }],
  botSpawns: [ /* 11 CT + 10 T з team: 'CT'/'T' */ ],
  botZones: { CT: [...5 точок], T: [...5 точок] },
  build(builder) {
    builder.addBox('grass', [0, -0.5, 0], [80, 1, 80], { navBlock: false });
    // ... стіни, ящики, двері, дерева
  }
};
```

### Додати нову поведінку ботів
- Все в `NetworkBots.js`: клас HostBot (індивідуальна поведінка), NetworkBots (командна координація).
- Зони карти: `botZones` в мапі.
- Радіо: новий kind у `sayRadio()` + `playRadio()` в AudioManager.

### Додати нове повідомлення мережі
1. Відправка: `this.network.send({ type: 'game:my_event', ... })`.
2. Обробка на іншій стороні: case в `NetworkManager.handleMessage()` (або handleMessage інших систем).
3. Маршрутизація: якщо треба щоб повідомлення дійшло до інших систем — додай у `lobby.onAnyMessage` в main.js.

**Приклад — власна подія (наприклад "збір предмета"):**
```js
// Відправка (у гравця):
this.network.send({
  type: 'game:pickup',
  id: this.network.localId,
  item: 'armor_vest',
  x: 12, z: -4
});

// Обробка в NetworkManager.handleMessage():
case 'game:pickup': {
  // додати предмет для peer
  break;
}

// Якщо треба щоб бачили й інші системи — у main.js ланцюжок onAnyMessage:
if (message.type.startsWith('game:')) {
  networkBotsMessageHandler?.(message);
  this.grenadeManager?.handleMessage?.(message);
  this.doorSystem?.handleMessage?.(message);
  this.myNewSystem?.handleMessage?.(message);   // ← додай сюди
}
```

### Додати новий звук
- Метод у AudioManager (зразок: playBark, playRadio) + виклик з потрібного місця.

---

## 15. Відомі обмеження / нотатки

1. **FirebaseAdapter** потребує заповнити `config.js` даними проєкту. Порожній → локальний режим.
2. **PeerJSAdapter** — P2P, потребує додаткового налаштування (не основний шлях).
3. `BotManager.js`/`Bot.js` — мертвий код (замінений NetworkBots), не видалявся.
4. Гранатний fuse може десинхронізуватись ~100мс між клієнтами (косметично; шкода рахує хост).
5. Зброя не скидається при смерті (свідомо — зберігається між раундами).
6. Економіка частково локальна (spend не перевіряється хостом) — для кежуал-гри ок.
7. Публікація: `npm run deploy` → GitHub Pages; або будь-який статичний хостинг (dist/).

---

## 16. Налагодження

- **F1** — debug overlay (кількість ботів, дверей, позиції, FPS).
- **Консоль браузера** — всі помилки з префіксами `[Game]`, `[PlayerController]`, `[InputManager]`.
- **Скорборд (Tab)** — перевірка балансу команд.
- **KillFeed** — перевірка бою ботів між собою.
- Тест мультиплеєра локально: відкрий гру у 2+ вкладках браузера (LocalAdapter).

---

## 17. Часті операції

| Операція | Де |
|----------|-----|
| Змінити баланс зброї (шкода/швидкість) | `weapons/defs/*.js` |
| Змінити ціни | `game/EconomyManager.js` (SHOP_PRICES) |
| Змінити швидкість руху | `player/PlayerController.js` (MOVE) |
| Змінити формат матчу (5v5 → 7v7) | `NetworkBots.spawnHostBots` (TEAM_SIZE) |
| Змінити тривалість раунду | `RoundManager` (buy 12с, live 120с) |
| Змінити складність ботів | `NetworkBots.spawnHostBot` (skillPresets) |
| Змінити зони ботів | `botZones` у файлі карти |
| Змінити матеріали/пробивання | `weapons/HitScan.js` |
| Змінити меню покупки | `ui/BuyMenu.js` |
| Налаштувати інтернет-гру | `config.js` (Firebase) |
| Змінити кількість ботів | `NetworkBots.spawnHostBots` (TEAM_SIZE = 5) |
| Змінити стартові гроші | `EconomyManager` constructor (`startMoney`) |
| Змінити гучність/тональність звуків | `engine/AudioManager.js` |
| Додати дерева/машини на карту | `addTree()` / `addVehicle()` в build карти |
| Додати нові матеріали (стіни) | `MapLoader.MATERIALS` + `TextureFactory` |
| Додати скло/двері | `addGlass()` / `addDoor()` в build карти |

---

## 18. FAQ (поширені питання при правках)

**Q: Гра не стартує — порт зайнятий?**
Vite сам обере вільний порт (5174, 5175...). Дивись адресу у виводі терміналу.

**Q: Змінив код, але нічого не змінилось?**
Dev-сервер має HMR — збережи файл і онови сторінку (F5). Якщо правка в WASM-фізиці — повний рестарт dev.

**Q: Ботів замало / забагато?**
`TEAM_SIZE` у `NetworkBots.spawnHostBots()` — кількість слотів на команду (зараз 5).

**Q: Де змінити, скільки життя забирає зброя?**
`weapons/defs/*.js` → поле `damage`. Зони: head ×4 (headshotMultiplier), stomach ×1.25, legs ×0.75 (zoneMultipliers).

**Q: Боти не вмирають від пострілу — чому?**
Перевір: (1) ти стріляєш в бота з команди ворога? friendly fire виключено; (2) куля пробила стіну і втратила шкоду? (3) бот живий? (деаd-боти не мають hitbox).

**Q: Як додати третю карту?**
Розділ 14 "Додати нову карту" — 5 кроків + каркас.

**Q: Мультиплеєр між комп'ютерами не працює?**
LocalAdapter працює тільки в межах одного браузера (вкладки). Для інтернету заповни `config.js` Firebase-даними (RTDB) — тоді підключиться FirebaseAdapter.

**Q: Що означає помилка в консолі `[InputManager] Pointer Lock error`?**
Це не помилка — браузер відхилив запит Pointer Lock (не було user gesture). Клікни в гру.

**Q: Як перевірити чи боти воюють між собою?**
Відкрий скорборд (Tab) під час live — K/D ботів мають рости. Або F1 → debug.

**Q: Гра повільна (FPS < 30)?**
Подивись F1-оверлей. Знизь pixelRatio (main.js initRenderer — зараз 1.75) або вимкни тіні (shadowMap).

---

## 19. Чекліст перед релізом

### Збірка та запуск
- [ ] `npm run build` — 0 помилок
- [ ] `npm run preview` — гра відкривається з dist/
- [ ] FPS ≥ 45 на середньому ПК
- [ ] Жодних помилок у консолі браузера (крім favicon 404 — некритично)

### Соло-гра (боти)
- [ ] Старт матчу: лобі → гра (buy → live)
- [ ] 5v5 баланс (1 гравець + 9 ботів)
- [ ] Боти воюють між собою (K/D ростуть)
- [ ] Боти ходять по карті, використовують двері, не застрягають
- [ ] Економіка: гроші нараховуються, покупки працюють
- [ ] Раунди: 30 раундів → swap команд → matchover → rematch
- [ ] Гранати: HE шкодить, Flash сліпить, Smoke блокує

### Мультиплеєр (2 вкладки)
- [ ] Друга вкладка бачить першу в лобі
- [ ] Старт гри для обох
- [ ] Гравці бачать один одного (NamePlates)
- [ ] Постріли/вбивства синхронізовані
- [ ] Кінець раунду однаковий для обох
- [ ] Вихід гравця → HostMigration → гра триває

### Карти
- [ ] cs_mansion: всі 3 маршрути, балкон, задній вхід
- [ ] cs_assault: галерея, бічний вхід, вентиляція
- [ ] Жодних провалів крізь текстури (можна пройти всю карту пішки)

### UI
- [ ] HUD: HP, гроші, патрони, радар, таймер
- [ ] BuyMenu (B), ScoreBoard (Tab), Settings (ESC), Chat (Y/U)
- [ ] NamePlates: імена + колір команд
- [ ] KillFeed: всі типи вбивств
- [ ] MatchOverScreen: результати + Rematch

### Перед публікацією
- [ ] `npm run deploy` (GitHub Pages) АБО завантажити dist/ на хостинг
- [ ] Якщо треба інтернет-мультиплеєр: заповнити config.js (Firebase RTDB)
- [ ] favicon.ico у public/ (прибрати 404) — опційно

---

## 20. Публікація на GitHub Pages (повний гайд)

### 20.1. Що вже налаштовано в проекті (не чіпати)

| Файл | Що робить |
|------|-----------|
| `vite.config.js` | `base: './'` — відносні шляхи, критично для Pages |
| `.github/workflows/deploy.yml` | CI: автоматичний деплой на кожен push у main/master |
| `public/.nojekyll` | Забороняє Jekyll ламати шляхи на Pages |
| `package.json → deploy` | Ручний деплой: `vite build && gh-pages -d dist` |

### 20.2. Один раз (при першій публікації)

```bash
# 1. Створити репозиторій на GitHub (один раз):
gh repo create kolda-cs16 --public --source=. --remote=origin --push

# 2. Увімкнути Pages у налаштуваннях:
#    GitHub → Repo → Settings → Pages → Source: GitHub Actions
#    (CI-воркфлоу автоматично задеплоїть dist/)

# 3. Перевірити, що deploy.yml відпрацював:
#    GitHub → Repo → Actions → "Deploy to GitHub Pages" → зелений ✓

# 4. Гра доступна за адресою:
#    https://<username>.github.io/kolda-cs16/
```

### 20.3. Подальші оновлення

```bash
git add -A
git commit -m "опис змін"
git push          # CI автоматично перезадеплоїть (1-2 хв)
```

### 20.4. Нюанси та пастки (ВАЖЛИВО)

1. **Без `base: './'`** гра не знайде ассети на Pages — цей параметр вже є, НЕ змінюй.
2. **WASM-модуль Rapier** вантажиться асинхронно — на Pages це працює, але при першому відкритті може бути затримка. Це нормально.
3. **Скріншоти/тимчасові файли** в корені проекту (game-*.png тощо) НЕ треба комітити — вони в `.gitignore`.
4. **Firebase секрети**: якщо додасиш Firebase — `config.js` публікується на GitHub. Для Realtime Database це прийнятно (правила БД захищають дані), але ніколи не клади в репо приватні ключі сервіс-акаунта.
5. **Мультиплеєр на Pages**: LocalAdapter працює ТІЛЬКИ між вкладками одного браузера. Для гри між різними ПК потрібен Firebase (розділ 15, п.1).
6. **Кеш**: після оновлення гри гравці можуть бачити стару версію (браузерний кеш). Рекомендується хард-рефреш (Ctrl+F5) або додати версію в URL.
7. **GitHub Actions квота**: безкоштовні репозиторії мають ліміт хвилин на Actions. Для цього проекту (build ~1 хв) — вистачить.

### 20.5. Мультиплеєр між різними ПК (опційно, ~15 хв)

1. Створи Firebase проєкт → Realtime Database (`us-central1`).
2. Правила БД (у Firebase Console → Rules):
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
3. Заповнити `src/config.js` даними проєкту.
4. `git commit -m "firebase multiplayer"` → `git push` → CI задеплоїть.
5. Гравці з різних ПК бачать одне лобі автоматично (FirebaseAdapter підхоплюється сам, якщо є `apiKey` + `databaseURL`).

### 20.6. Перевірка після публікації

- [ ] Відкрити `https://<username>.github.io/kolda-cs16/`
- [ ] Лобі завантажується, START GAME працює
- [ ] Соло-гра: боти з'являються, раунди йдуть
- [ ] Консоль браузера (F12) — немає 404 на ассети
- [ ] Друга вкладка — видно обох гравців (якщо LocalAdapter)
