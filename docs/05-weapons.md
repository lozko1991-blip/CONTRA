# 05. Зброя (weapons/)

> Повернутись: [PROJECT.md](../PROJECT.md) | [04-maps.md](04-maps.md) | [06-gameplay.md](06-gameplay.md)

## 5.1. Таблиця зброї

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
- Пробивання: AK/Deagle 2.5, M4 2.3 (див. docs/04-maps.md розділ 4.4).

## 5.2. Гранати (GrenadeManager.js)

| Тип | Fuse | Радіус | Дія |
|-----|------|--------|-----|
| HE | 1.7с | 7.5м | до 92 шкоди, з LOS-перевіркою |
| Flash | 1.3с | 22м | засліплення за кутом огляду + LOS |
| Smoke | 1.4с | 4.2м | дим 13с, блокує постріли і зір ботів |

**Купівля**: HE ×1, Flash ×2, Smoke ×1 максимум. Кидок: ЛКМ (обрана G), цикл — G.

**Важливо (виправлений баг):** HE-граната бота рахує ворогів **за командою кидача** (не гравця!). Якщо бот-T кидає HE — шкодить CT (гравцям і ботам), не чіпає T. Це в `applyThrowerDamage()` → `throwerTeam`.

## 5.3. Рух гравця (PlayerController.js)

Реалізація в стилі GoldSrc (CS 1.6):
- **Рух**: WASD + стрілки; Shift — тихий крок; Ctrl/C — присідання.
- **Стрибки**: Space; bhop підтримується (air accelerate + wishspeed 30).
- **Фіксований крок**: 1/60с фізика + інтерполяція рендеру (alpha).
- **Крок через перешкоди**: ручний step-up 0.55м (Rapier autostep вимкнено — NaN).
- **Камера**: sensitivity налаштовується; recoil пружинний.
- **Звуки**: кроки (матеріал під ногами), стрибок, приземлення (залежить від падіння).

## 5.4. Структура Weapon (defs/)

Кожна зброя — `new Weapon({...})`:
```js
{
  id, name,
  automatic: true,           // чи автоматична
  damage, headshotMultiplier,
  magazineSize, reserveAmmo,
  fireRate,                  // пострілів/с
  reloadTime,
  penetrationPower,          // пробивання
  runSpeed,                  // швидкість бігу (6.4 = базова)
  baseSpread, moveSpread, airSpread,
  crouchSpreadMultiplier, firstShotMultiplier,
  recoilPattern, recoilPitchScale, recoilYawScale,
  zoneMultipliers: { head: 4, stomach: 1.25, legs: 0.75 }
}
```

**Важливо про швидкість:** `MOVE_BASE_RUN_SPEED = 6.4` (у WeaponManager.js).
`updatePlayerSpeed()` викликається **щокадру** в `WeaponManager.update()` — сповільнення при стрільбі динамічне.
