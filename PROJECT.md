# KOLDA — Паспорт проекту (Counter-Strike 1.6 Web)

> Версія: 1.1.0
> Стек: Vite + Three.js (r169) + Rapier3D (r0.19) + Firebase
> Ціль: повноцінний шутер CS-типу в браузері: соло з ботами, мультиплеєр до 10 гравців
> Репозиторій: https://github.com/lozko1991-blip/CONTRA
> GitHub Pages: https://lozko1991-blip.github.io/CONTRA/ — ✅ ЗАДЕПЛОЄНО І ПРАЦЮЄ
> Процес розробки: GSD (планування) + Superpowers (код) — див. docs/07-development.md

---

## 📚 Навігація по паспорту

| Файл | Що містить |
|------|-----------|
| [docs/01-architecture.md](docs/01-architecture.md) | Дерево файлів, життєвий цикл, ігровий цикл |
| [docs/02-networking.md](docs/02-networking.md) | Мережа: ролі, повідомлення, авторитетність, команди |
| [docs/03-bots.md](docs/03-bots.md) | Боти: типи, 5v5, складність, поведінка, стрільба |
| [docs/04-maps.md](docs/04-maps.md) | Карти: MapBuilder API, конфіг, матеріали, пробивання |
| [docs/05-weapons.md](docs/05-weapons.md) | Зброя: таблиці, гранати, рух гравця |
| [docs/06-gameplay.md](docs/06-gameplay.md) | Раунди, економіка, двері, звук, UI |
| [docs/07-development.md](docs/07-development.md) | Правила додавання контенту, процес (GSD + Superpowers) |
| [docs/08-deployment.md](docs/08-deployment.md) | GitHub Pages, деплой, FAQ, чекліст релізу |

---

## ⚡ Швидка довідка

```
Гра запускається:  npm run dev  → http://localhost:5173
Збірка для релізу: npm run build → dist/
Деплой:            git push     → CI автоматично задеплоїть на Pages

Головний файл:      src/main.js            (запуск + зв'язки всіх систем)
Мережа:             src/net/               (LobbyService → NetworkManager → NetworkBots)
Боти:               src/net/NetworkBots.js (HostBot — повний AI)
Карти:              src/maps/cs_mansion.js, cs_assault.js
Зброя:              src/weapons/defs/*.js  (характеристики)
Раунди:             src/game/RoundManager.js
Економіка:          src/game/EconomyManager.js (ціни → SHOP_PRICES)

Тест мультиплеєра локально: відкрий гру у 2+ вкладках (LocalAdapter).
F1 у грі — debug overlay. Tab — скорборд. B — покупка. ESC — меню.
```

---

## 🚀 Швидкий старт

```bash
npm install        # встановити залежності (один раз)
npm run dev        # dev-сервер (Vite, HMR) → http://localhost:5173
npm run build      # продакшн-збірка → dist/
npm run preview    # перегляд збірки локально
```

**Поради:**
- Порт 5173 зайнятий? Vite сам обере вільний (5174, 5175...) — дивись вивід терміналу.
- `npm run dev` і `npm run build` самі підміняють index.html (збірка ↔ dev-джерело) — див. docs/08-deployment.md, розділ про index.html.
- Після `git push` гра оновиться на Pages автоматично через ~2 хв.

---

## 🔑 Ключові факти (щоб не ламати)

1. **`vite.config.js` має `base: './'`** — НЕ змінюй (відносні шляхи для Pages).
2. **`index.html` у корені — це ЗБІРКА** (для Pages). Вихідний dev-варіант — `index.src.html`. Скрипти `dev`/`build` підміняють їх автоматично.
3. **Хост = авторитет** для ботів і кінця раунду. Клієнти лише застосовують `round:state`.
4. **`assets/` у корені — збірка для Pages**, не чіпати вручну.
5. **Боти**: броня 0 (3 постріли AK у тіло), `rayFilter()` виключає власні hitbox-зони з raycast.
6. **`npm run build` має проходити без помилок** перед кожним коммітом.

---

## 📁 Де що лежить (коротко)

```
src/
├── main.js          # ГОЛОВНИЙ: запуск, цикл, зв'язки всіх систем
├── config.js        # Firebase конфіг (порожній = локальний режим)
├── physics.js       # Обгортка над Rapier (світ, колайдери, raycast)
├── engine/          # InputManager, AudioManager, Skybox, SoldierModel...
├── player/          # PlayerController (GoldSrc-рух)
├── weapons/         # WeaponManager, HitScan, GrenadeManager, defs/
├── ai/              # NavMesh, Dog.js (Bot.js — мертвий код)
├── net/             # LobbyService, NetworkManager, NetworkBots, adapters/
├── game/            # RoundManager, EconomyManager, DoorSystem
├── maps/            # MapLoader, cs_mansion, cs_assault
└── ui/              # HUD, KillFeed, ScoreBoard, BuyMenu, NamePlates...
```

Деталі кожного модуля — у відповідних файлах docs/. Починай з docs/01-architecture.md.
