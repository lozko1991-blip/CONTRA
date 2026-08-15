# 02. Мережева модель

> Повернутись: [PROJECT.md](../PROJECT.md) | [01-architecture.md](01-architecture.md) | [03-bots.md](03-bots.md)

## 2.1. Ролі

- **Хост** — гравець з найменшим id (лексикографічно, `sortedIds[0]`). На хості:
  - живуть `hostBots` з повним AI;
  - рахується кінець раунду (`checkEndCondition`);
  - розсилається `round:state` (кожні 0.5с) і `game:bot_state` (кожні 0.12с);
  - застосовується шкода від гранат/ботів (авторитет).
- **Клієнт** — отримує стан, показує `clientBots` (візуал без AI), відправляє свої дії (постріл, damage) хосту.

## 2.2. Повідомлення лобі (LobbyService)

| Тип | Напрямок | Призначення |
|-----|----------|-------------|
| `hello` | всі → всі | приєднання нового гравця |
| `presence` | всі (кожні 2с) | підтвердження життя |
| `map` | всі | зміна карти |
| `vote` / `votes` | всі | голосування за карту |
| `start` | будь-хто | старт гри (з mapId) |
| `bye` | всі | вихід гравця |

## 2.3. Ігрові повідомлення

| Тип | Опис |
|-----|------|
| `game:join` / `game:presence` | приєднання до матчу (хост призначає команду через `game:assign_team`) |
| `game:assign_team` | хост → новий гравець: призначена команда |
| `game:state` | позиція/поворот/HP/зброя гравця (періодично) |
| `game:shot` | постріл (для звуку/трасера у інших) |
| `game:damage` | шкода гравцю (хост → клієнт) |
| `game:kill` | вбивство (для killfeed, статистики, грошей) |
| `game:stats` | K/D + alive гравця для скорборда (періодично) |
| `game:chat` | повідомлення чату |
| `game:bot_state` | снапшот ботів (хост → клієнти, 0.12с): id, team, name, pos, yaw, health, alive, kills, deaths |
| `game:bot_damage` | шкода боту (клієнт → хост) |
| `game:matchover` | кінець матчу |
| `round:state` | фаза раунду, таймер, рахунок, команди, winner, roundsCompleted |

## 2.4. Команди (teams.js)

- `computeTeams(ids)`: сортує id лексикографічно → чергує `CT/T` (парний = CT, непарний = T).
- Колір команди: CT = синій `0x4a6fb0`, T = червоний `0xb04a4a` (SoldierModel + NamePlates).
- При соло-грі: 1 гравець → CT.
- `swapTeams()` на 15-му раунді міняє команди **всіх** (гравці + боти) і оновлює колайдери (без friendly fire).
- Mid-game join: хост призначає команду (менша команда) через `game:assign_team`.

## 2.5. HostMigration

- Кожен гравець перевіряє раз на 0.3-2с: чи він тепер хост (найменший id).
- `onBecomeHost()`: спавнить ботів, очищає clientBots, синхронізує стан.

## 2.6. Хто що рахує (авторитетність) — ВАЖЛИВО для розуміння

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

## 2.7. Ланцюжок шкоди (гравці + боти)

### Гравець стріляє в бота (соло = хост):
```
WeaponManager.fire → HitScan.trace → colliderMeta.applyDamage
→ NetworkBots.onDamage → onLocalHitHostBot → bot.applyDamage
→ health -= finalDamage → смерть → onBotKill → game:kill
```

### Гравець стріляє в бота (клієнт):
```
гравець-клієнт → colliderMeta.applyDamage → onLocalHitClientBot
→ game:bot_damage → хост застосовує → game:kill назад
```

### Бот стріляє в гравця:
```
HostBot.shootAt → raycastShot → hit.userData.player → onHitPlayer
→ onBotHitPlayer → target.isLocal → network.handleDamage (гравець отримує)
```

### Бот стріляє в бота:
```
HostBot.shootAt → raycastShot → hit.userData.hostBot (інший)
→ onHitPlayer → onBotHitPlayer → target.isBot → victim.applyDamage (хост)
```

## 2.8. Raycast-фільтри (важливо для ботів)

Кожен бот має **4 hitbox-зони** (head/chest/stomach/legs). Щоб власне тіло
не блокувало промінь бота (зір і стрільба), використовується `rayFilter()`:

```js
// physics.raycast(origin, dir, maxDistance, excludeCollider, filterPredicate)
// 8-й аргумент Rapier castRay = filterPredicate (перевірено в d.ts)

rayFilter(collider) {
  const meta = this.physics.colliderMeta.get(collider.handle);
  return !(meta?.hostBot === this || meta?.clientBot === this);
}
```

- `canSee` і `raycastShot` ботів передають `(c) => this.rayFilter(c)`.
- **Не видаляй це** — інакше боти перестануть бачити/влучати (відомий баг, виправлений).
