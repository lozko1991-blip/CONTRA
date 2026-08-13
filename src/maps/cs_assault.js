function wallX(
  builder,
  material,
  x,
  z,
  length,
  height = 6,
  y = null,
  options = {}
) {
  const yy = y ?? height * 0.5;

  builder.addBox(material, [x, yy, z], [length, height, 0.6], options);
}

function wallZ(
  builder,
  material,
  x,
  z,
  length,
  height = 6,
  y = null,
  options = {}
) {
  const yy = y ?? height * 0.5;

  builder.addBox(material, [x, yy, z], [0.6, height, length], options);
}

export const csAssault = {
  id: 'cs_assault',
  name: 'cs_assault',

  skyColor: 0x5c6670,
  fogColor: 0x5c6670,

  navGridBounds: [-85, 85, -85, 85],

  /**
   * Тактичні зони для ботів:
   * CT — оборона складу (галерея, входи),
   * T — штурм (двір, фланги, вентиляція).
   */
  botZones: {
    CT: [
      { x: 0, z: -20 },    // галерея (2-й ярус)
      { x: 0, z: 0 },      // центр складу
      { x: -20, z: 12 },   // лівий кут
      { x: 20, z: 12 },    // правий кут
      { x: 0, z: 30 }      // перед воротами
    ],
    T: [
      { x: 0, z: -16 },    // південний підхід
      { x: -24, z: -8 },   // західний фланг
      { x: 24, z: -8 },    // східний фланг (бічний вхід)
      { x: -20, z: -2 },   // вентиляція
      { x: 0, z: 38 }      // вулиця/надземний перехід
    ]
  },

  playerSpawn: {
    x: 0,
    y: 2.2,
    z: 38
  },

  playerSpawnsCT: [
    { x: 0, z: 38 },
    { x: -8, z: 38 },
    { x: 8, z: 38 },
    { x: -4, z: 40 },
    { x: 4, z: 40 }
  ],

  playerSpawnsT: [
    { x: -6, z: -20 },
    { x: 6, z: -20 },
    { x: -12, z: -18 },
    { x: 12, z: -18 },
    { x: 0, z: -22 }
  ],

  botSpawns: [
    { x: -18, z: 18, team: 'CT' },
    { x: 18, z: 18, team: 'CT' },
    { x: -12, z: 36, team: 'CT' },
    { x: 12, z: 36, team: 'CT' },
    { x: 0, z: 34, team: 'CT' },
    { x: -24, z: 20, team: 'CT' },
    { x: 24, z: 20, team: 'CT' },
    { x: -16, z: 34, team: 'CT' },
    { x: 16, z: 34, team: 'CT' },
    { x: -8, z: 38, team: 'CT' },
    { x: 8, z: 38, team: 'CT' },
    { x: -10, z: -18, team: 'T' },
    { x: 15, z: -18, team: 'T' },
    { x: -6, z: -20, team: 'T' },
    { x: 6, z: -20, team: 'T' },
    { x: 0, z: -22, team: 'T' },
    { x: -16, z: -24, team: 'T' },
    { x: 16, z: -24, team: 'T' },
    { x: -10, z: -28, team: 'T' },
    { x: 10, z: -28, team: 'T' },
    { x: 0, z: -30, team: 'T' }
  ],

  build(builder) {
    /**
     * Ground
     */
    builder.addBox('asphalt', [0, -0.5, 0], [170, 1, 170], {
      navBlock: false
    });

    builder.addBox('ground', [0, 0.02, 0], [60, 0.04, 50], {
      collider: false,
      navBlock: false
    });

    /**
     * Warehouse outer walls
     */
    wallX(builder, 'concrete', -6.3, -25, 47.4, 6);
    wallX(builder, 'concrete', 24.3, -25, 11.4, 6);
    builder.addBox('concrete', [18, 4.2, -25], [1.2, 3.6, 0.6]);
    wallZ(builder, 'concrete', -30, 0, 50, 6);
    wallZ(builder, 'concrete', 30, -12.5, 15, 6);
    wallZ(builder, 'concrete', 30, 7.5, 15, 6);
    wallZ(builder, 'concrete', 30, -2.5, 5, 2, 5);

    /**
     * Бічний вантажний вхід (схід).
     */
    builder.addDoor({
      position: [30, 0, -2.5],
      rotationY: Math.PI / 2,
      width: 1.8,
      height: 2.6,
      material: 'doorMetal'
    });

    /**
     * Вікна складу (ламаються).
     */
    for (let zz = -16; zz <= 12; zz += 7) {
      builder.addGlass([-30.2, 3.2, zz], [0.08, 2.4, 2.4], {
        navBlock: true,
        navInflate: 0.1
      });

      builder.addGlass([30.2, 3.2, zz], [0.08, 2.4, 2.4], {
        navBlock: true,
        navInflate: 0.1
      });
    }

      /**
       * Вікно в будці охорони.
       */
      builder.addGlass([-36, 1.6, 27], [3.0, 1.2, 0.08], {
        navBlock: true,
        navInflate: 0.1
      });

    /**
     * Front wall with large gate opening
     */
    wallX(builder, 'concrete', -22.3, 25, 15.4, 6);
    wallX(builder, 'concrete', -10.7, 25, 5.4, 6);
    builder.addBox('concrete', [-14, 4.2, 25], [1.2, 3.6, 0.6]);

    builder.addDoor({
      position: [-14.6, 0, 25],
      rotationY: 0,
      width: 1.2,
      height: 2.4,
      material: 'doorMetal'
    });

    wallX(builder, 'concrete', 19, 25, 22, 6);
    wallX(builder, 'concrete', 0, 25, 16, 2, 5, {
      navInflate: 0.2
    });

    /**
     * Iron gate decoration
     */
    builder.addBox('darkMetal', [-11, 2, 25], [1.2, 4, 0.4]);
    builder.addBox('darkMetal', [11, 2, 25], [1.2, 4, 0.4]);

    /**
     * Back metal door
     */
    builder.addDoor({
      position: [17.4, 0, -25],
      rotationY: 0,
      width: 1.2,
      height: 2.4,
      material: 'doorMetal'
    });

    /**
     * Roof beams and roof
     */
    for (let z = -20; z <= 20; z += 10) {
      builder.addBox('metal', [0, 6.1, z], [60, 0.4, 0.6], {
        collider: false,
        navBlock: false
      });
    }

    builder.addBox('roof', [0, 6.4, 0], [60, 0.3, 50], {
      collider: false,
      navBlock: false
    });

    /**
     * Warehouse supports
     */
    const supportsX = [-24, 0, 24];
    const supportsZ = [-15, 15];

    for (const x of supportsX) {
      for (const z of supportsZ) {
        builder.addBox('concrete', [x, 3, z], [1.2, 6, 1.2]);
      }
    }

    /**
     * Внутрішня галерея (2-й ярус) вздовж задньої стіни.
     * З неї видно весь склад — сильна оборонна позиція.
     */
    builder.addBox('metal', [0, 3.6, -20], [54, 0.25, 5], {
      navBlock: false
    });

    wallX(builder, 'metal', 0, -17.5, 54, 1.1, 4.2, {
      navBlock: false
    });

    wallZ(builder, 'metal', -27, -20, 5, 1.1, 4.2, {
      navBlock: false
    });

    wallZ(builder, 'metal', 27, -20, 5, 1.1, 4.2, {
      navBlock: false
    });

    /**
     * Сходи на галерею (ліворуч від задніх дверей).
     */
    for (let i = 0; i < 10; i++) {
      builder.addBox(
        'metal',
        [-19, 0.2 + i * 0.4, -22 + i * 0.8],
        [3, 0.4, 0.8],
        {
          navInflate: 0.1
        }
      );
    }

    /**
     * Containers
     */
    const containers = [
      {
        material: 'containerRed',
        pos: [-12, 1.25, -8],
        size: [6, 2.5, 2.5]
      },
      {
        material: 'containerBlue',
        pos: [10, 1.25, -14],
        size: [6, 2.5, 2.5]
      },
      {
        material: 'containerRed',
        pos: [16, 1.25, 6],
        size: [6, 2.5, 2.5]
      },
      {
        material: 'containerBlue',
        pos: [-16, 1.25, 10],
        size: [6, 2.5, 2.5]
      }
    ];

    for (const container of containers) {
      builder.addBox(container.material, container.pos, container.size);
    }

    /**
     * Crates
     */
    const crates = [
      [-4, 0.45, 8],
      [-2, 0.45, 8],
      [-3, 1.35, 8],
      [6, 0.45, -4],
      [8, 0.45, -4],
      [7, 1.35, -4],
      [-18, 0.45, -2],
      [20, 0.45, -2],
      [0, 0.45, 16],
      [2, 0.45, 16]
    ];

    for (const crate of crates) {
      builder.addBox('crate', crate, [0.9, 0.9, 0.9]);
    }

    /**
     * Укриття на вулиці біля воріт.
     */
    builder.addBox('concrete', [4, 0.6, 28.5], [2.4, 1.2, 0.5]);
    builder.addBox('crate', [-6, 0.45, 30], [0.9, 0.9, 0.9]);
    builder.addBox('crate', [7, 0.45, 32], [0.9, 0.9, 0.9]);
    builder.addBox('containerBlue', [-19, 1.25, 19], [6, 2.5, 2.5]);

    /**
     * Маршрут T → склад: укриття від спавну (південь)
     * до передніх воріт і бічного входу.
     */
    builder.addBox('containerRed', [-6, 1.25, -14], [6, 2.5, 2.5]);
    builder.addBox('containerBlue', [20, 1.25, -16], [6, 2.5, 2.5]);
    builder.addBox('crate', [-24, 0.45, -10], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [24, 0.45, -8], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [-8, 0.45, -4], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [26, 0.45, 2], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [28, 0.45, -14], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [32, 0.45, -6], [1.1, 0.9, 1.1]);

    /**
     * Street outside warehouse
     */
    builder.addBox('asphalt', [0, 0.03, 34], [30, 0.04, 14], {
      collider: false,
      navBlock: false
    });

    /**
     * Overpass
     */
    builder.addBox('concrete', [0, 5, 36], [34, 0.6, 6], {
      navBlock: false
    });

    const pillars = [-12, 0, 12];

    for (const x of pillars) {
      builder.addBox('concrete', [x, 2.5, 36], [1.2, 5, 1.2]);
    }

    /**
     * Додаткове укриття: бочки, мішки.
     */
    builder.addBox('crate', [-14, 0.45, 34], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [14, 0.45, 34], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [-8, 0.45, 38], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [8, 0.45, 38], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [-4, 0.45, 40], [1.1, 0.9, 1.1]);
    builder.addBox('crate', [4, 0.45, 40], [1.1, 0.9, 1.1]);

    /**
     * Ліхтарі біля входу в склад та на вулиці.
     */
    builder.addPointLight(0xffe8c0, 5, [0, 5.5, 26], 24, 1.5);
    builder.addPointLight(0xffe8c0, 3, [0, 3.5, 38], 18, 1.5);
    builder.addPointLight(0xffe8c0, 2.5, [-18, 3.0, 36], 14, 1.5);
    builder.addPointLight(0xffe8c0, 2.5, [18, 3.0, 36], 14, 1.5);

    /**
     * Ventilation tunnel under roof.
     * Потрібен присід, щоб пройти.
     */
    builder.addBox('vent', [-20, 3.5, -2.5], [3, 0.2, 25], {
      navBlock: false
    });

    builder.addBox('vent', [-21.4, 4.1, -2.5], [0.2, 1.2, 25], {
      navBlock: false
    });

    builder.addBox('vent', [-18.6, 4.1, -2.5], [0.2, 1.2, 25], {
      navBlock: false
    });

    builder.addBox('vent', [-20, 4.8, -2.5], [3, 0.2, 25], {
      navBlock: false
    });

    /**
     * Entry steps into vent
     */
    for (let i = 0; i < 9; i++) {
      builder.addBox(
        'metal',
        [-20, 0.2 + i * 0.4, 10 - i * 0.8],
        [3, 0.4, 0.8],
        {
          navInflate: 0.1
        }
      );
    }

    /**
     * Транспорт на вулиці: вантажівка + 3 легковики.
     * На дахи можна застрибнути, за кузовами — сховатись,
     * кулі пробивають тонкий метал.
     */
    builder.addVehicle('truck', [18, 0, 12], 0);
    builder.addVehicle('car', [-16, 0, 34], Math.PI * 0.5, { color: 'carBodyBlue' });
    builder.addVehicle('car', [-4, 0, 38], Math.PI * 0.5, { color: 'carBodyGreen' });
    builder.addVehicle('car', [8, 0, 30], Math.PI * 0.15);

    /**
     * Warehouse lights
     */
    builder.addPointLight(0xbfd4e2, 6, [0, 5, 0], 26, 2);
    builder.addPointLight(0xbfd4e2, 4, [0, 4, 20], 20, 2);

    /**
     * Траншея / окоп для укриття (зовні складу, у новій зоні).
     */
    const trenchZ = -24;
    const trenchLen = 22;

    /**
     * Дно траншеї трохи нижче землі.
     */
    builder.addBox('basement', [0, -0.35, trenchZ], [trenchLen + 2, 0.3, 4], {
      navBlock: true,
      navInflate: 0.3
    });

    builder.addBox('asphalt', [0, -0.55, trenchZ], [trenchLen + 4, 0.4, 5], {
      collider: false,
      navBlock: false
    });

    wallX(builder, 'concrete', 0, trenchZ - 2.5, trenchLen + 2, 1.4, 0.7);
    wallX(builder, 'concrete', 0, trenchZ + 2.5, trenchLen + 2, 1.4, 0.7);
    wallZ(builder, 'concrete', -trenchLen / 2 - 1, trenchZ, 5, 1.4, 0.7);
    wallZ(builder, 'concrete', trenchLen / 2 + 1, trenchZ, 5, 1.4, 0.7);

    /**
     * Додаткові авто на розширеній території.
     */
    builder.addVehicle('car', [-30, 0, 42], Math.PI * 0.5, { color: 'carBody' });
    builder.addVehicle('car', [-24, 0, -26], Math.PI * 0.8, { color: 'carBodyBlue' });

    /**
     * Невелика будка охорони біля складу.
     */
    wallX(builder, 'brick', -36, 30, 8, 3.0);
    wallZ(builder, 'brick', -40, 30, 6, 3.0);
    wallZ(builder, 'brick', -32, 30, 6, 3.0);
    wallX(builder, 'brick', -36, 27, 8, 3.0);
    builder.addBox('roof', [-36, 1.7, 30], [8, 0.15, 6], { collider: false, navBlock: false });
    builder.addBox('darkMetal', [-34, 1.0, 27], [0.8, 2.0, 0.1]);
    builder.addBox('darkMetal', [-40, 1.0, 32], [0.1, 2.0, 0.8]);

    /**
     * Дерева навколо складу — укриття й атмосфера.
     */
    const trees = [
      [-20, 36], [20, 36], [-26, 28], [26, 28],
      [-28, 8], [28, 10], [-22, -16], [22, -18],
      [-26, -26], [26, -24], [0, 38], [-10, 38],
      [10, 38], [-34, 16], [34, 14], [-18, -30],
      [18, -32], [-32, -10], [32, -8],
      [-40, 40], [40, 42], [-42, -30], [42, -32],
      [-38, -36], [38, 38], [-44, 6], [44, 4],
      [-34, 36], [34, 38]
    ];

    for (const [tx, tz] of trees) {
      builder.addTree(tx, tz, 0.7 + Math.random() * 0.6);
    }
  }
};
