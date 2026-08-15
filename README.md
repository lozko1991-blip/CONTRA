<pre>
 ██████╗███████╗  ██╗ ██████╗
██╔════╝██╔════╝ ███║ ╚════██╗
██║     ███████╗ ╚██║  █████╔╝
██║     ╚════██║  ██║ ██╔═══╝
╚██████╗███████║  ██║ ███████╗
 ╚═════╝╚══════╝  ╚═╝ ╚══════╝
        BROWSER EDITION
</pre>

**Counter-Strike 1.6, відтворена в браузері.** GoldSrc-рух із розпрыжкою,
hitscan-балістика з прострілами, тактичні боти, гранати з фізикою,
економіка, MR15-матчі та онлайн-лобі без кодів кімнат.

![Deploy](https://github.com/lozko1991-blip/CONTRA/actions/workflows/deploy.yml/badge.svg)
![Three.js](https://img.shields.io/badge/three.js-r169-045786)
![Physics](https://img.shields.io/badge/physics-rapier%20wasm-blue)
![Audio](https://img.shields.io/badge/audio-web%20audio%20api-orange)
![Pages](https://img.shields.io/badge/host-github%20pages-222)

## ▶️ Грати

**https://lozko1991-blip.github.io/CONTRA/**

---

## 01 // ОПЕРАЦІЯ

Два гравці заходять у лобі, голосують за карту — і опиняються на
`cs_mansion` або `cs_assault`. 15 раундів за половину, зміна сторін,
перші 16 перемог забирають матч. Між раундами — buy menu: гроші за
вбивства та перемоги, економіка як у класиці.

- **Рух** — air strafing, bunny hop, crouch-jump, тихий крок, view bobbing
- **Балістика** — патерни віддачі, простріли дерева/скла/бетону, зони влучань (голова ×4, живіт ×1.25, ноги ×0.75), точний перший постріл
- **Арсенал** — AK-47, M4A1 зі знімним глушником, Desert Eagle + HE / Flashbang / Smoke
- **Боти** — зір (FOV 90° + LOS), слух (біг і постріли), укриття при низькому HP, host-authoritative синхронізація
- **Матч** — MR15, зміна сторін у половині, економіка $800 → $16000, MVP-екран, host migration
- **Світ** — процедурні текстури, шейдерний skybox, розбиване скло, декалі куль, кров, muzzle flash
- **Звук** — повністю процедурний, 3D-позиціонування (HRTF), кроки залежно від матеріалу під ногами

---

## 02 // КЕРУВАННЯ

| Клавіша | Дія |
|---|---|
| `W A S D` | Рух |
| `Space` | Стрибок (утримуй + стрейф для bhop) |
| `Ctrl` | Присід (у стрибку — підтискання ніг) |
| `Shift` | Тихий крок |
| `ЛКМ` | Вогонь / кидок гранати |
| `ПКМ` | Глушник M4A1 |
| `R` | Перезарядка |
| `1` `2` `3` | AK-47 / M4A1 / Desert Eagle |
| `G` | Вибір гранати (HE → FB → SM) |
| `B` | Buy menu |
| `Esc` | Відпустити мишу |

**Buy menu** (відкривається у buy-фазі):

| Клавіша | Предмет | Ціна |
|---|---|---|
| `1` | AK-47 | $2500 |
| `2` | M4A1 | $3100 |
| `3` | Desert Eagle | $700 |
| `4` | Броня | $650 |
| `5` | HE Grenade | $300 |
| `6` | Flashbang | $200 |
| `7` | Smoke Grenade | $300 |

---

## 03 // АРХІТЕКТУРА

```text
src/
├─ main.js                  # Бутстрап: сцена, loop, зв'язка систем
├─ physics.js               # Rapier-обгортка: тіла, raycast, metadata
├─ config.js                # Firebase-конфіг (не комітити секрети!)
│
├─ engine/
│  ├─ InputManager.js       # Клавіатура, миша, Pointer Lock
│  ├─ AudioManager.js       # Процедурний звук: постріли, кроки, вибухи
│  ├─ TextureFactory.js     # Canvas-текстури: цегла, бетон, метал…
│  ├─ Skybox.js             # Шейдерне небо з сонцем
│  ├─ DecalSystem.js        # Сліди куль, кров
│  └─ SurfaceDetector.js    # Матеріал поверхні під гравцем
│
├─ player/                  # GoldSrc-рух: тертя, air accel, duck
├─ weapons/                 # Weapon, HitScan, GrenadeManager, ViewModel
├─ ai/                      # NavGrid + A*, тактичні боти
├─ maps/                    # MapLoader, cs_mansion, cs_assault
│
├─ net/
│  ├─ LobbyService.js       # Лобі + голосування за карту
│  ├─ NetworkManager.js     # Позиції, damage, статистика
│  ├─ NetworkBots.js        # Host-authoritative боти
│  ├─ HostMigration.js      # Передача ролі хоста
│  └─ adapters/             # FirebaseAdapter / LocalAdapter
│
├─ game/                    # RoundManager (MR15), EconomyManager
└─ ui/                      # HUD, радар, buy menu, killfeed, MVP
```

**Потік даних:**

```text
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

---

## 04 // ШВИДКИЙ СТАРТ

```bash
git clone https://github.com/lozko1991-blip/CONTRA.git
cd CONTRA
npm install
npm run dev
```

Відкрий `http://localhost:5173`, зайди в лобі та стартуй.

> **Важливо для розробників:** у корені `index.html` — це ЗБІРКА
> (для GitHub Pages). Вихідний dev-варіант — `index.src.html`.
> Команда `npm run dev` сама підміняє потрібний файл.

---

## 05 // ДЕПЛОЙ НА GITHUB PAGES

### Спосіб A — GitHub Actions (рекомендовано)

1. Запуш у `main`:
   ```bash
   git add .
   git commit -m "cs16-web"
   git push origin main
   ```
2. У репозиторії: **Settings → Pages → Source: GitHub Actions**.
3. Workflow збере проєкт і викотить його автоматично.
   Гра буде за адресою `https://USERNAME.github.io/cs16-web/`.

### Спосіб B — gh-pages CLI

```bash
npm run deploy
```

`vite.config.js` уже містить `base: './'`, тому relative-шляхи
працюють на Pages без додаткових налаштувань.

---

## 06 // ONLINE-ЛОБІ

За замовчуванням лобі працює **в межах одного браузера**
(BroadcastChannel) — зручно для розробки: дві вкладки бачать одна одну.

Щоб грати **з різних комп'ютерів**, підключи Firebase:

1. [console.firebase.google.com](https://console.firebase.google.com) → новий проєкт.
2. **Build → Realtime Database → Create Database**.
3. **Project settings → Your apps → Web** → скопіюй конфіг.
4. Встав його у `src/config.js`:
   ```js
   export const firebaseConfig = {
     apiKey: 'AIza...',
     authDomain: 'your-app.firebaseapp.com',
     databaseURL: 'https://your-app-default-rtdb.firebaseio.com',
     projectId: 'your-app',
     appId: '1:...'
   };
   ```
5. Правила для демо (Realtime Database → Rules):
   ```json
   {
     "rules": {
       "lobbies": {
         "global": {
           "messages": { ".read": true, ".write": true },
           "presence": { ".read": true, ".write": true }
         }
       }
     }
   }
   ```

Кодів кімнат немає: усі заходять в одну глобальну кімнату,
бачать одне одного, голосують за карту і стартують.

---

## 07 // ПРАВИЛА МАТЧУ

- **MR15**: половина — 15 раундів, потім зміна сторін CT ↔ T.
- Перемога — **16 виграних раундів**. Після 30 раундів можлива нічия 15:15.
- Раунд закінчується, коли одна з команд повністю знищена,
  або коли спливає таймер (2:00) — тоді перемагають CT.

**Економіка:**

| Подія | Гроші |
|---|---|
| Старт матчу | $800 |
| Вбивство | +$300 |
| Перемога в раунді | +$3000 |
| Поразка в раунді | +$1400 |
| Ліміт | $16000 |

---

## 08 // ВІДОМІ ОБМЕЖЕННЯ

- Hit detection клієнтський — без серверного античиту.
- Боти в соло-грі — локальні тактичні; у мультиплеєрі — спрощені host-authoritative.
- Позиції синхронізуються з інтерполяцією, без повного client prediction.
- Карти — процедурний blockout, не фінальний арт.

---

## 09 // СТЕК

| Шар | Технологія |
|---|---|
| Рендер | Three.js (InstancedMesh, Shadow Maps) |
| Фізика | Rapier (WebAssembly) |
| Звук | Web Audio API — процедурний синтез, HRTF |
| Мережа | Firebase Realtime Database / BroadcastChannel |
| UI | Vanilla DOM поверх canvas |
| Збірка | Vite · деплой через GitHub Actions |

---

*Жодного зовнішнього ассета: текстури, звук, моделі та карти
генеруються кодом. Уся гра — це ~20 модулів чистого ES-коду.*
