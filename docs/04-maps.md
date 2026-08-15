# 04. Карти (maps/)

> Повернутись: [PROJECT.md](../PROJECT.md) | [03-bots.md](03-bots.md) | [05-weapons.md](05-weapons.md)

## 4.1. MapBuilder (MapLoader.js)

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

## 4.2. Структура мап-конфіга

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

**Вимоги до спавнів:** ботів має бути ≥ 5 на команду (для 5v5), з унікальними team полями.

## 4.3. Логіка карт

### cs_mansion — садиба
- Будинок: 3 входи (головний, бічний захід, задній північ), 2 поверхи, сходи з обох боків на дах, балкон над входом.
- 3 маршрути атаки: A центр (ящики), B захід (гараж/контейнери), C схід (басейн).
- Додатково: сарай, басейн з водою, паркан з воротами.
- CT зони: балкон, верх сходів, хола, задня кімната, двір. T зони: підходи і фланги.

### cs_assault — склад
- Склад: передні ворота + бічний вантажний вхід + задні металеві двері.
- Внутрішня галерея (2-й ярус) зі сходами — оборонна позиція.
- Вентиляційний тунель (потрібен присід), траншея, будка охорони.
- Укриття по шляху T → склад.
- CT зони: галерея, центр, кути, перед воротами. T зони: підходи і фланги.

## 4.4. Матеріали і пробивання (HitScan.js)

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

## 4.5. NavGrid (GridNavMesh.js)

- A* сітка з `navGridBounds` карти (cs_mansion: ±90, cs_assault: ±85).
- Клітини блокуються стінами через `navBlock` (з inflate 0.35).
- `findNearestWalkable(x, z, radius)` — для спавнів і анти-застрягання.
- `isWalkableWorld(x, z)` — перевірка клітини.
