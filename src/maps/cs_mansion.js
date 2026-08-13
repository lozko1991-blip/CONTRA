function wallX(
  builder,
  material,
  x,
  z,
  length,
  height = 4.5,
  y = null,
  options = {}
) {
  const yy = y ?? height * 0.5;

  builder.addBox(material, [x, yy, z], [length, height, 0.4], options);
}

function wallZ(
  builder,
  material,
  x,
  z,
  length,
  height = 4.5,
  y = null,
  options = {}
) {
  const yy = y ?? height * 0.5;

  builder.addBox(material, [x, yy, z], [0.4, height, length], options);
}

export const csMansion = {
  id: 'cs_mansion',
  name: 'cs_mansion',

  skyColor: 0x8fa3ad,
  fogColor: 0x8fa3ad,

  navGridBounds: [-90, 90, -90, 90],

  /**
   * Тактичні зони для ботів (позиції контролю):
   * CT — оборона будинку (балкон, дах, входи),
   * T — просування до цілі (двір, фланги).
   */
  botZones: {
    CT: [
      { x: 8, z: 8.5 },    // балкон над входом
      { x: 15.5, z: 6 },   // верх сходів
      { x: 0, z: 2 },      // хола будинку
      { x: -4, z: -6 },    // задня кімната
      { x: 0, z: 16 }      // двір перед входом
    ],
    T: [
      { x: -10, z: -14 },  // північний підхід (задній вхід)
      { x: 10, z: -16 },   // східний фланг
      { x: -14, z: -2 },   // західний фланг (бічний вхід)
      { x: -34, z: -26 },  // гараж (маршрут B)
      { x: 36, z: -20 }    // басейн (маршрут C)
    ]
  },

  playerSpawn: {
    x: 0,
    y: 2.2,
    z: 28
  },

  playerSpawnsCT: [
    { x: 0, z: 28 },
    { x: -8, z: 26 },
    { x: 8, z: 26 },
    { x: -4, z: 30 },
    { x: 4, z: 30 }
  ],

  playerSpawnsT: [
    { x: -4, z: 2 },
    { x: 4, z: 2 },
    { x: -10, z: -2 },
    { x: 10, z: -2 },
    { x: 0, z: -4 }
  ],

  botSpawns: [
    { x: 0, z: 26, team: 'CT' },
    { x: -14, z: 20, team: 'CT' },
    { x: 14, z: 20, team: 'CT' },
    { x: -8, z: 24, team: 'CT' },
    { x: 8, z: 24, team: 'CT' },
    { x: -20, z: 30, team: 'CT' },
    { x: 20, z: 30, team: 'CT' },
    { x: -16, z: 26, team: 'CT' },
    { x: 16, z: 26, team: 'CT' },
    { x: -4, z: 32, team: 'CT' },
    { x: 4, z: 32, team: 'CT' },
    { x: -4, z: 2, team: 'T' },
    { x: 8, z: -4, team: 'T' },
    { x: -10, z: -2, team: 'T' },
    { x: 10, z: -2, team: 'T' },
    { x: 0, z: -6, team: 'T' },
    { x: -12, z: -10, team: 'T' },
    { x: 12, z: -10, team: 'T' },
    { x: -6, z: -14, team: 'T' },
    { x: 6, z: -14, team: 'T' },
    { x: 0, z: -16, team: 'T' }
  ],

  build(builder) {
    /**
     * Ground / courtyard (розширений двір)
     */
    builder.addBox('grass', [0, -0.5, 0], [180, 1, 180], {
      navBlock: false
    });

    builder.addBox('ground', [0, 0.02, 20], [34, 0.04, 24], {
      collider: false,
      navBlock: false
    });

    /**
     * Дорога навколо двору (асфальт)
     */
    builder.addBox('asphalt', [0, 0.015, 0], [56, 0.03, 110], {
      collider: false,
      navBlock: false
    });

    /**
     * Fence around courtyard (розширений)
     */
    wallX(builder, 'darkMetal', 0, -54, 108, 3.5);
    wallZ(builder, 'darkMetal', -54, 0, 108, 3.5);
    wallZ(builder, 'darkMetal', 54, 0, 108, 3.5);

    wallX(builder, 'darkMetal', -27, 54, 54, 3.5);
    wallX(builder, 'darkMetal', 27, 54, 54, 3.5);

    builder.addBox('darkMetal', [-4, 1.75, 54], [0.6, 3.5, 0.6]);
    builder.addBox('darkMetal', [4, 1.75, 54], [0.6, 3.5, 0.6]);

    /**
     * House base (floor of first floor) — рівно в межах стін (x -12..12, z -10..6),
     * щоб край підлоги не виступав і не блокував вхід.
     */
    builder.addBox('concrete', [0, 0.05, -2], [24, 0.1, 16], {
      navBlock: false
    });

    /**
     * Поріг/порожній ґанок перед дверима — плавний вхід з землі (y=0) на підлогу (y=0.1).
     */
    builder.addBox('concrete', [0, 0.08, 6.4], [3.2, 0.16, 0.9], {
      navBlock: false
    });

    /**
     * First floor front wall with door and windows (height 4.5)
     */
    wallX(builder, 'brick', -10, 6, 4, 4.5);
    wallX(builder, 'brick', -6.5, 6, 3, 1.2, 0.6);
    wallX(builder, 'brick', -6.5, 6, 3, 0.8, 4.1);
    wallX(builder, 'brick', -3.25, 6, 3.5, 4.5);

    wallX(builder, 'brick', 0, 6, 3, 0.8, 4.1);

    wallX(builder, 'brick', 3.25, 6, 3.5, 4.5);
    wallX(builder, 'brick', 6.5, 6, 3, 1.2, 0.6);
    wallX(builder, 'brick', 6.5, 6, 3, 0.8, 4.1);
    wallX(builder, 'brick', 10, 6, 4, 4.5);

    builder.addGlass([-6.5, 1.8, 6], [2.8, 1.1, 0.08], {
      navBlock: true,
      navInflate: 0.1
    });

    builder.addGlass([6.5, 1.8, 6], [2.8, 1.1, 0.08], {
      navBlock: true,
      navInflate: 0.1
    });

    /**
     * Бічні вікна будинку (ламаються при пострілі).
     */
    builder.addGlass([12.2, 1.8, 2], [2.8, 1.1, 0.08], {
      navBlock: true,
      navInflate: 0.1
    });

    builder.addGlass([12.2, 1.8, -6], [2.8, 1.1, 0.08], {
      navBlock: true,
      navInflate: 0.1
    });

    builder.addGlass([-12.2, 1.8, 2], [2.8, 1.1, 0.08], {
      navBlock: true,
      navInflate: 0.1
    });

    builder.addGlass([-12.2, 1.8, -6], [2.8, 1.1, 0.08], {
      navBlock: true,
      navInflate: 0.1
    });

    /**
     * Вікно в сараї.
     */
    builder.addGlass([-34, 1.6, -27], [2.0, 1.2, 0.08], {
      navBlock: true,
      navInflate: 0.1
    });

    /**
     * Front double doors (tall: 3.2m)
     */
    builder.addDoor({
      position: [-1.5, 0, 6],
      rotationY: 0,
      width: 1.5,
      height: 3.2,
      material: 'doorWood',
      flip: false,
      openDir: -1
    });

    builder.addDoor({
      position: [1.5, 0, 6],
      rotationY: 0,
      width: 1.5,
      height: 3.2,
      material: 'doorWood',
      flip: true,
      openDir: 1
    });

    /**
     * Outer house walls (height 4.5)
     */
    wallZ(builder, 'brick', -12, -5.375, 9.25, 4.5);
    wallZ(builder, 'brick', -12, 4.375, 7.25, 4.5);
    wallZ(builder, 'brick', -12, 0, 1.5, 1.2, 3.3);
    wallZ(builder, 'brick', 12, -2, 16, 4.5);

    /**
     * Бічний вхід (захід).
     */
    builder.addDoor({
      position: [-12, 0, 0],
      rotationY: Math.PI / 2,
      width: 1.5,
      height: 3.2,
      material: 'doorWood'
    });

    /**
     * Back wall (z=-10) з дверним прорізом у центрі — задній вхід.
     */
    wallX(builder, 'brick', -7.25, -10, 9.5, 4.5);
    wallX(builder, 'brick', 7.25, -10, 9.5, 4.5);
    wallX(builder, 'brick', 0, -10, 3, 1.2, 3.3);

    /**
     * Задні двері.
     */
    builder.addDoor({
      position: [0, 0, -10],
      rotationY: 0,
      width: 1.5,
      height: 3.2,
      material: 'doorWood'
    });

    /**
     * Interior walls with doorways (height 4.5)
     */
    wallZ(builder, 'plaster', -4, -6.3, 3.4, 4.5);
    wallZ(builder, 'plaster', -4, -2.7, 1.4, 4.5);
    builder.addBox('plaster', [-4, 3.85, -4], [0.4, 1.2, 1.2]);

    wallX(builder, 'plaster', -9.3, -2, 5.4, 4.5);
    wallX(builder, 'plaster', -4.7, -2, 1.4, 4.5);
    builder.addBox('plaster', [-6, 3.85, -2], [1.2, 1.2, 0.4]);

    wallZ(builder, 'plaster', 5, -8.3, 3.4, 4.5);
    wallZ(builder, 'plaster', 5, -3.7, 3.4, 4.5);
    builder.addBox('plaster', [5, 3.85, -6], [0.4, 1.2, 1.2]);

    /**
     * Interior doors (3.2m)
     */
    builder.addDoor({
      position: [-4, 0, -4.6],
      rotationY: -Math.PI / 2,
      width: 1.2,
      height: 3.2,
      material: 'doorWood'
    });

    builder.addDoor({
      position: [-6.6, 0, -2],
      rotationY: 0,
      width: 1.2,
      height: 3.2,
      material: 'doorWood'
    });

    builder.addDoor({
      position: [5, 0, -6.6],
      rotationY: -Math.PI / 2,
      width: 1.2,
      height: 3.2,
      material: 'doorWood'
    });

    /**
     * Basement-like dark room
     */
    builder.addBox('basement', [-7, 0.03, -6], [8, 0.02, 6], {
      collider: false,
      navBlock: false
    });

    builder.addPointLight(0xffa04a, 8, [-7, 2.2, -6], 14, 2);

    /**
     * Second floor platform (roof level, y=5.05, top ~5.2 — clear above stairs,
     * lower edge 4.9 > top step 3.9 so stairs are not blocked by the ceiling)
     */
    builder.addBox('concrete', [2, 5.05, -2], [30, 0.3, 16], {
      navBlock: false
    });

    /**
     * Second floor railings
     */
    wallX(builder, 'metal', 2, 6, 30, 1.1, 5.7, {
      navBlock: false
    });

    wallX(builder, 'metal', 2, -10, 30, 1.1, 5.7, {
      navBlock: false
    });

    wallZ(builder, 'metal', -13, -2, 16, 1.1, 5.7, {
      navBlock: false
    });

    wallZ(builder, 'metal', 17, -2, 16, 1.1, 5.7, {
      navBlock: false
    });

    /**
     * Балкон над головним входом — вертикальна позиція
     * для оборони двору. Вхід з 2-го поверху (x=2..14).
     */
    builder.addBox('concrete', [8, 5.05, 8.5], [12, 0.25, 4], {
      navBlock: false
    });

    wallX(builder, 'metal', 8, 10.5, 12, 1.1, 5.7, {
      navBlock: false
    });

    wallZ(builder, 'metal', 2, 8.5, 4, 1.1, 5.7, {
      navBlock: false
    });

    wallZ(builder, 'metal', 14, 8.5, 4, 1.1, 5.7, {
      navBlock: false
    });

    /**
     * Stairs to second floor: 12 thick steps (0.3 rise, 0.6 thick, 1.5 deep)
     * reaching the roof (3.8). Thick steps resist tunneling during jumps.
     */
    for (let i = 0; i < 12; i++) {
      builder.addBox(
        'concrete',
        [15.5, 0.3 + i * 0.3, 7.4 - i * 1.5],
        [6.5, 0.6, 1.5],
        {
          navInflate: 0.1
        }
      );
    }

    /**
     * Другі сходи на дах з півночі (симетричний доступ).
     */
    for (let i = 0; i < 12; i++) {
      builder.addBox(
        'concrete',
        [-13, 0.3 + i * 0.3, 7.4 - i * 1.5],
        [6.5, 0.6, 1.5],
        {
          navInflate: 0.1
        }
      );
    }

    /**
     * Roof over the whole house (visual ceiling)
     */
    builder.addBox('roof', [2, 6.1, -2], [31, 0.15, 17], {
      collider: false,
      navBlock: false
    });

    /**
     * Транспорт у дворі: вантажівка + 3 легковики.
     * На дахи можна застрибнути, за кузовами — сховатись,
     * кулі пробивають тонкий метал.
     */
    builder.addVehicle('truck', [-14, 0, 18], 0);
    builder.addVehicle('car', [14, 0, 20], 0, { color: 'carBodyBlue' });
    builder.addVehicle('car', [-18, 0, -16], Math.PI * 0.5, { color: 'carBodyGreen' });
    builder.addVehicle('car', [20, 0, -18], Math.PI * 0.25);
    builder.addVehicle('car', [-42, 0, -30], Math.PI * 0.7, { color: 'carBodyBlue' });
    builder.addVehicle('car', [40, 0, 34], Math.PI * 0.4, { color: 'carBodyGreen' });

    /**
     * Crates and cover
     */
    const crates = [
      [-8, 0.45, 14],
      [8, 0.45, 16],
      [-16, 0.45, 4],
      [16, 0.45, 2],
      [-6, 0.45, 2],
      [4, 0.45, -4],
      [-18, 0.45, -12],
      [18, 0.45, -14]
    ];

    for (const crate of crates) {
      builder.addBox('crate', crate, [0.9, 0.9, 0.9]);
    }

    /**
     * Бочки / мішки з піском — додаткове укриття.
     */
    builder.addBox('crate', [-12, 0.45, 26], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [12, 0.45, 28], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [-20, 0.45, 10], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [20, 0.45, 8], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [0, 0.45, 34], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [-24, 0.45, -6], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [24, 0.45, -8], [1.1, 0.9, 1.1]);

    /**
     * Маршрут А (центр): ящики в два ряди по дорозі
     * від воріт до будинку — укриття для просування.
     */
    builder.addBox('crate', [-3, 0.45, 40], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [3, 0.45, 40], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [-4, 0.45, 32], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [4, 0.45, 32], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [-2, 0.45, 24], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [2, 0.45, 24], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [0, 0.45, 14], [1.1, 0.9, 1.1]);
    builder.addBox('containerBlue', [0, 1.25, 38], [3, 2.5, 2.5]);

    /**
     * Маршрут B (захід, повз гараж): контейнери + ящики
     * вздовж західної стіни.
     */
    builder.addBox('containerRed', [-34, 1.25, 18], [6, 2.5, 2.5]);
    builder.addBox('containerRed', [-42, 1.25, 12], [6, 2.5, 2.5]);
    builder.addBox('crate', [-28, 0.45, 24], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [-36, 0.45, 6], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [-40, 0.45, -4], [1.1, 0.9, 1.1]);

    /**
     * Маршрут C (схід, через басейн): контейнер + ящики
     * вздовж східної стіни.
     */
    builder.addBox('containerBlue', [34, 1.25, 16], [6, 2.5, 2.5]);
    builder.addBox('crate', [28, 0.45, 24], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [36, 0.45, 6], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [40, 0.45, -4], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [30, 0.45, -10], [1.1, 0.9, 1.1]);

    /**
     * Ліхтарі біля входу в будинок та біля воріт.
     */
    builder.addPointLight(0xffe8c0, 4, [0, 3.5, 44], 20, 1.5);
    builder.addPointLight(0xffe8c0, 3, [0, 3.5, 20], 16, 1.5);
    builder.addPointLight(0xffe8c0, 2.5, [-14, 3.0, 30], 14, 1.5);
    builder.addPointLight(0xffe8c0, 2.5, [14, 3.0, 30], 14, 1.5);

    /**
     * Невелике бокове приміщення (сарай / гараж).
     */
    wallX(builder, 'plaster', -34, -34, 14, 3.2);
    wallZ(builder, 'plaster', -41, -34, 8, 3.2);
    wallZ(builder, 'plaster', -27, -34, 8, 3.2);
    wallX(builder, 'plaster', -34, -26, 14, 2.2);
    builder.addBox('roof', [-34, 1.8, -30], [14, 0.2, 8], { collider: false, navBlock: false });
    builder.addBox('darkMetal', [-31, 1.0, -34], [0.8, 2.0, 0.1]);
    builder.addBox('darkMetal', [-31, 0.9, -26], [0.8, 2.0, 0.1]);

    /**
     * Басейн (зниження рівня + вода).
     * Стіни басейну, дно трохи нижче землі.
     */
    const poolX = 36;
    const poolZ = -20;
    const poolW = 12;
    const poolD = 8;

    wallX(builder, 'concrete', poolX, poolZ - poolD / 2, poolW + 1, 1.2, 0.7);
    wallX(builder, 'concrete', poolX, poolZ + poolD / 2, poolW + 1, 1.2, 0.7);
    wallZ(builder, 'concrete', poolX - poolW / 2, poolZ, poolD + 1, 1.2, 0.7);
    wallZ(builder, 'concrete', poolX + poolW / 2, poolZ, poolD + 1, 1.2, 0.7);

    builder.addBox('basement', [poolX, -0.15, poolZ], [poolW, 0.3, poolD], {
      navBlock: true,
      navInflate: 0.5
    });

    /**
     * Вода — блакитне напівпрозоре скло на поверхні.
     */
    builder.addGlass([poolX, 0.0, poolZ], [poolW, 0.06, poolD], {
      collider: false,
      navBlock: false
    });

    /**
     * Дерева навколо двору — живі укриття та атмосферність.
     * За стовбурами можна сховатись, листя не блокує кулі.
     */
    const trees = [
      [-30, -28], [-28, 34], [30, -30], [34, 28],
      [-34, 10], [34, -10], [-10, -36], [10, 36],
      [-22, -20], [22, -24], [-26, 16], [26, 14],
      [-18, -32], [18, 34], [-36, -6], [36, 8],
      [-44, -40], [44, 42], [-42, 40], [40, -42],
      [-48, -24], [48, 26], [-24, -44], [24, 46],
      [-40, -50], [40, -50], [-50, 20], [50, -20]
    ];

    for (const [tx, tz] of trees) {
      builder.addTree(tx, tz, 0.7 + Math.random() * 0.6);
    }
  }
};
