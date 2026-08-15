# 07. Розробка: правила додавання контенту + процес

> Повернутись: [PROJECT.md](../PROJECT.md) | [06-gameplay.md](06-gameplay.md) | [08-deployment.md](08-deployment.md)

## 7.1. Процес розробки (GSD + Superpowers)

### Ролі скилів

| Скил | Коли використовувати |
|-------|----------------------|
| **GSD** (gsd-plan-phase, gsd-execute-phase, gsd-verify-work) | Планування і виконання фаз/мілстоунів проекту |
| **Superpowers: brainstorming** | Нова фіча/функція: спершу з'ясувати вимоги і дизайн |
| **Superpowers: systematic-debugging** | Будь-який баг: СПЕРШУ root-cause аналіз, ПОТІМ фікс |
| **Superpowers: test-driven-development** | Нова фіча: спершу тест, потім код |
| **Superpowers: verification-before-completion** | Перед заявкою 'зроблено' — запусти build/тести |
| **Superpowers: requesting-code-review** | Після великої зміни — перевірка коду |

### Як скили працюють разом

```
Нова фіча:      brainstorming → writing-plans → TDD → verification → review
Баг:            systematic-debugging (4 фази) → фікс → verification
Велика зміна:   GSD phase plan → execute (по одному) → verify
```

### Правила роботи (заборонено порушувати)

1. **Ніколи не редагуй по пам'яті** — спершу прочитай файл (grep/read), знайди точні рядки.
2. **Хірургічні правки** — міняй тільки те, що стосується задачі. Не переписуй файл цілком.
3. **Дизайн сторінок не чіпай** без запиту.
4. **Без 'покращень' поза задачею** — зробив задачу, зупинись.
5. **Без галюцинацій** — перевір API/шляхи/файли перед використанням (grep/package.json).
6. **Build перед коммітом** — `npm run build` має проходити без помилок (61 модуль).
7. **Після деплою** — перевір що гра онлайн (200 OK, новий бандл).
8. **Кожна зміна — окремий комміт** з описом що і чому.

### Патерн виправлення бага (обов'язковий)

```text
1. PHASE 1 — Root Cause: прочитай код, знайди причину (не симптом)
2. PHASE 2 — Pattern: знайди аналогічний робочий код
3. PHASE 3 — Hypothesis: сформулюй 'я думаю X бо Y'
4. PHASE 4 — Fix + build + тест
5. Commit + push (CI задеплоїть автоматично)
```

---

## 7.2. Правила додавання нового контенту

### Додати нову зброю

1. Створи `src/weapons/defs/MyWeapon.js` за зразком AK47.js (class Weapon).
2. Зареєструй у `WeaponManager` constructor (`this.weapons.myweapon = createMyWeapon()`).
3. Додай клавішу в `updateWeaponSwitch()` та в `cycleWeapon()` порядок.
4. Додай label у `KillFeed.weaponLabel()`.
5. Додай ціну в `SHOP_PRICES` (EconomyManager.js) і рядок у `BuyMenu.BUY_ITEMS`.

**Приклад — додати MP5:**
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

**Приклад — власна подія ("збір предмета"):**
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

## 7.3. Часті операції

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
| Змінити HP/броню ботів | `NetworkBots.js` — `this.health/armor` (зараз 100/0) |
