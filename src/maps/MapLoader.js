import * as THREE from 'three';
import { csMansion } from './cs_mansion.js';
import { csAssault } from './cs_assault.js';
import { getMaterial } from '../engine/TextureFactory.js';

const MATERIAL_DEFS = {
  ground: {
    color: 0x54574f,
    roughness: 1,
    metalness: 0
  },
  grass: {
    color: 0x49663c,
    roughness: 1,
    metalness: 0
  },
  asphalt: {
    color: 0x3c3f42,
    roughness: 1,
    metalness: 0
  },
  concrete: {
    color: 0x8b8d84,
    roughness: 0.95,
    metalness: 0
  },
  brick: {
    color: 0x8f5e4e,
    roughness: 0.9,
    metalness: 0
  },
  plaster: {
    color: 0xb7a98a,
    roughness: 0.9,
    metalness: 0
  },
  wood: {
    color: 0x8a5a2b,
    roughness: 0.8,
    metalness: 0
  },
  crate: {
    color: 0xb0793f,
    roughness: 0.75,
    metalness: 0.05
  },
  metal: {
    color: 0x7d8388,
    roughness: 0.38,
    metalness: 0.65
  },
  darkMetal: {
    color: 0x3d4246,
    roughness: 0.45,
    metalness: 0.7
  },
  roof: {
    color: 0x4c5257,
    roughness: 0.85,
    metalness: 0.1
  },
  vent: {
    color: 0x9aa3a8,
    roughness: 0.4,
    metalness: 0.7
  },
  basement: {
    color: 0x2e2e2c,
    roughness: 1,
    metalness: 0
  },
  containerRed: {
    color: 0x8d4a3a,
    roughness: 0.6,
    metalness: 0.4
  },
  containerBlue: {
    color: 0x3f5f86,
    roughness: 0.6,
    metalness: 0.4
  },
  carBody: {
    color: 0x8a3a2f,
    roughness: 0.35,
    metalness: 0.55
  },
  carBodyBlue: {
    color: 0x2f4f7a,
    roughness: 0.35,
    metalness: 0.55
  },
  carBodyGreen: {
    color: 0x3f6f3f,
    roughness: 0.35,
    metalness: 0.55
  },
  carGlass: {
    color: 0x9fc8e8,
    roughness: 0.08,
    metalness: 0.3,
    transparent: true,
    opacity: 0.45
  },
  wheel: {
    color: 0x1c1c1e,
    roughness: 0.9,
    metalness: 0
  },
  truckBody: {
    color: 0x4a6a3a,
    roughness: 0.5,
    metalness: 0.45
  },
  truckCab: {
    color: 0x3a4a5a,
    roughness: 0.5,
    metalness: 0.45
  }
};

export function getMapDefinition(id) {
  if (id === 'cs_assault') {
    return csAssault;
  }

  return csMansion;
}

/**
 * MapBuilder:
 * - будує instanced-геометрію;
 * - створює статичні колізії;
 * - додає перешкоди в navgrid;
 * - підтримує скло як окремий breakable-об'єкт.
 */
export class MapBuilder {
  constructor({ scene, physics, navGrid }) {
    this.scene = scene;
    this.physics = physics;
    this.navGrid = navGrid;

    this.groups = new Map();
    this.glassPanes = [];
    this.treePositions = [];
    this.lights = [];

    this.dummy = new THREE.Object3D();
this.doors = [];

  }

  v3(value) {
    if (Array.isArray(value)) {
      return {
        x: value[0] ?? 0,
        y: value[1] ?? 0,
        z: value[2] ?? 0
      };
    }

    return {
      x: value?.x ?? 0,
      y: value?.y ?? 0,
      z: value?.z ?? 0
    };
  }

  addBox(material, position, size, options = {}) {
    const key = material || 'concrete';

    if (!this.groups.has(key)) {
      this.groups.set(key, []);
    }

    this.groups.get(key).push({
      position: this.v3(position),
      size: this.v3(size),
      options
    });
  }

  addGlass(position, size, options = {}) {
    this.glassPanes.push({
      position: this.v3(position),
      size: this.v3(size),
      options
    });
  }

  addPointLight(color, intensity, position, distance = 18, decay = 2) {
    this.lights.push({
      color,
      intensity,
      position: this.v3(position),
      distance,
      decay
    });
  }

  createMaterial(key) {
    /**
     * Використовуємо процедурні текстури TextureFactory
     * (цегла / дерево / бетон з деталізацією).
     */
    if (key === 'carGlass') {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x9fc8e8,
        roughness: 0.08,
        metalness: 0.3,
        transparent: true,
        opacity: 0.45,
        depthWrite: false
      });
      return mat;
    }

    try {
      return getMaterial(key);
    } catch {
      // fallback
    }

    const def = MATERIAL_DEFS[key] ?? {
      color: 0x888888,
      roughness: 0.9,
      metalness: 0
    };

    return new THREE.MeshStandardMaterial(def);
  }

  addDoor(config) {
    this.doors.push(config);
  }

  /**
   * Побудувати транспортний засіб з боксів.
   * type: 'car' | 'truck'
   * Зроблено з колайдерами — на дах можна застрибнути,
   * кулі пробивають тонкий метал (carBody resistance 1.2).
   */
  addVehicle(type, position, rotationY = 0, options = {}) {
    const [px, py, pz] = position;

    const car = (material, size, y, z = 0, x = 0) => {
      this.addBox(material, [px + x, y, pz + z], size, {
        navBlock: false,
        ...(options.boxOptions ?? {})
      });
    };

    /**
     * Масштабування: робимо машини ~1.7×, вантажівки ~1.4× більшими.
     */
    const carScale = 1.7;
    const truckScale = 1.4;

    if (type === 'truck') {
      const s = truckScale;

      car('truckCab', [2.2 * s, 1.1 * s, 2.5 * s], 0.95 * s, -1.9 * s);
      car('truckBody', [2.3 * s, 0.65 * s, 5.0 * s], 0.7 * s, 2.2 * s);
      car('truckBody', [2.15 * s, 0.08 * s, 5.6 * s], 1.35 * s, 0.4 * s, 0.25 * s);
      car('wheel', [0.5 * s, 0.75 * s, 0.5 * s], 0.4 * s, -2.1 * s, 1.05 * s);
      car('wheel', [0.5 * s, 0.75 * s, 0.5 * s], 0.4 * s, -2.1 * s, -1.05 * s);
      car('wheel', [0.5 * s, 0.75 * s, 0.5 * s], 0.4 * s, 2.4 * s, 1.05 * s);
      car('wheel', [0.5 * s, 0.75 * s, 0.5 * s], 0.4 * s, 2.4 * s, -1.05 * s);
    } else {
      const s = carScale;
      const bodyColor = options.color ?? 'carBody';

      car(bodyColor, [1.9 * s, 0.55 * s, 4.4 * s], 0.65 * s);
      car(bodyColor, [1.75 * s, 0.55 * s, 2.2 * s], 1.28 * s, 0.5 * s);
      car('carGlass', [1.65 * s, 0.5 * s, 2.1 * s], 1.28 * s, 0.5 * s);
      car('carGlass', [1.75 * s, 0.4 * s, 2.0 * s], 1.1 * s, -0.9 * s);
      car('carGlass', [1.75 * s, 0.4 * s, 2.0 * s], 1.1 * s, 1.9 * s);
      car('wheel', [0.4 * s, 0.6 * s, 0.4 * s], 0.4 * s, -1.6 * s, 1.05 * s);
      car('wheel', [0.4 * s, 0.6 * s, 0.4 * s], 0.4 * s, -1.6 * s, -1.05 * s);
      car('wheel', [0.4 * s, 0.6 * s, 0.4 * s], 0.4 * s, 1.6 * s, 1.05 * s);
      car('wheel', [0.4 * s, 0.6 * s, 0.4 * s], 0.4 * s, 1.6 * s, -1.05 * s);
    }
  }

  /**
   * Дерево: стовбур (коричневий бокс) + крона (темно-зелені сфери).
   * Колізія тільки на стовбурі — листя без колізії.
   */
  addTree(x, z, scale = 1) {
    this.treePositions.push({ x, z, scale });
  }

  buildTrees() {
    if (!this.treePositions.length) return;

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x6b4a2e,
      roughness: 0.85,
      metalness: 0
    });

    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x3d6b35,
      roughness: 0.8,
      metalness: 0
    });

    const trunkGeo = new THREE.CylinderGeometry(1, 1, 1, 6);

    for (const tree of this.treePositions) {
      const s = tree.scale;

      /**
       * Стовбур
       */
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.scale.set(0.18 * s, 1.7 * s, 0.18 * s);
      trunk.position.set(tree.x, 0.85 * s, tree.z);
      trunk.castShadow = true;
      this.scene.add(trunk);

      /**
       * Колізія стовбура
       */
      this.physics.createStaticBox({
        position: [tree.x, 0.85 * s, tree.z],
        size: [0.36 * s, 1.7 * s, 0.36 * s],
        friction: 0.8,
        userData: { material: 'wood' }
      });

      /**
       * Крона з 3 сфер
       */
      const crownY = 1.6 * s;
      const crownR = 0.7 * s;

      for (let i = 0; i < 3; i++) {
        const offsetY = i * crownR * 0.6;
        const shrink = 1 - i * 0.15;

        const foliage = new THREE.Mesh(
          new THREE.SphereGeometry(1, 6, 5),
          foliageMat
        );
        foliage.scale.setScalar(crownR * shrink);
        foliage.position.set(
          tree.x + (i - 1) * crownR * 0.15,
          crownY + offsetY,
          tree.z + (i % 2 - 0.5) * crownR * 0.15
        );
        foliage.castShadow = true;
        this.scene.add(foliage);
      }
    }
  }

  build() {
    this.buildInstancedBoxes();
    this.buildTrees();
    this.buildGlass();
    this.buildLights();
  }

  buildInstancedBoxes() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    for (const [key, boxes] of this.groups) {
      if (!boxes.length) continue;

      const material = this.createMaterial(key);

      const mesh = new THREE.InstancedMesh(
        geometry,
        material,
        boxes.length
      );

      mesh.castShadow =
        key !== 'ground' &&
        key !== 'grass' &&
        key !== 'asphalt';

      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];

        const px = box.position.x;
        const py = box.position.y;
        const pz = box.position.z;

        const sx = Math.max(0.001, box.size.x);
        const sy = Math.max(0.001, box.size.y);
        const sz = Math.max(0.001, box.size.z);

        this.dummy.position.set(px, py, pz);
        this.dummy.scale.set(sx, sy, sz);
        this.dummy.rotation.set(
          box.options.rotation?.x ?? 0,
          box.options.rotation?.y ?? 0,
          box.options.rotation?.z ?? 0
        );
        this.dummy.updateMatrix();

        mesh.setMatrixAt(i, this.dummy.matrix);

        if (box.options.collider !== false) {
          const userData = {
            material: key,
            mesh,
            instanceId: i,
            ...(box.options.userData ?? {})
          };

          this.physics.createStaticBox({
            position: [px, py, pz],
            size: [sx, sy, sz],
            rotation: box.options.rotation,
            friction: box.options.friction ?? 0.8,
            userData
          });
        }

        if (box.options.navBlock !== false) {
          this.navGrid?.addBoxFromCenter(
            [px, py, pz],
            [sx, sy, sz],
            box.options.navInflate ?? 0.35
          );
        }
      }

      mesh.instanceMatrix.needsUpdate = true;

      this.scene.add(mesh);
    }
  }

  buildGlass() {
    if (!this.glassPanes.length) return;

    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x9fd8ff,
      transparent: true,
      opacity: 0.32,
      roughness: 0.05,
      metalness: 0,
      depthWrite: false
    });

    for (const pane of this.glassPanes) {
      const sx = Math.max(0.001, pane.size.x);
      const sy = Math.max(0.001, pane.size.y);
      const sz = Math.max(0.001, pane.size.z);

      const geometry = new THREE.BoxGeometry(sx, sy, sz);

      const mesh = new THREE.Mesh(geometry, glassMaterial);

      mesh.position.set(
        pane.position.x,
        pane.position.y,
        pane.position.z
      );

      mesh.castShadow = false;
      mesh.receiveShadow = false;

      this.scene.add(mesh);

      const { body, collider } = this.physics.createStaticBox({
        position: [pane.position.x, pane.position.y, pane.position.z],
        size: [sx, sy, sz],
        friction: 0.1,
        userData: {
          material: 'glass',
          breakable: true,
          mesh,
          ...(pane.options.userData ?? {})
        }
      });

      const meta = this.physics.colliderMeta.get(collider.handle);

      if (meta) {
        meta.body = body;
        meta.collider = collider;
      }

      if (pane.options.navBlock !== false) {
        this.navGrid?.addBoxFromCenter(
          [pane.position.x, pane.position.y, pane.position.z],
          [sx, sy, sz],
          pane.options.navInflate ?? 0.1
        );
      }
    }
  }

  buildLights() {
    for (const light of this.lights) {
      const pointLight = new THREE.PointLight(
        light.color,
        light.intensity,
        light.distance,
        light.decay
      );

      pointLight.position.set(
        light.position.x,
        light.position.y,
        light.position.z
      );

      pointLight.castShadow = false;

      this.scene.add(pointLight);
    }
  }

  /**
   * Плоскі прямокутники стін (x, z, розмір) для міні-карти.
   * Фільтруємо високі/значимі об'єкти — стіни, ящики, контейнери.
   */
  getWallRects() {
    const rects = [];
    const important = new Set([
      'brick', 'plaster', 'concrete', 'metal', 'darkMetal',
      'crate', 'containerBlue', 'containerRed', 'basement', 'vent'
    ]);

    for (const [key, boxes] of this.groups) {
      if (!important.has(key)) continue;

      for (const box of boxes) {
        const h = box.size.y;

        if (h < 0.5) continue;

        rects.push({
          x: box.position.x,
          z: box.position.z,
          w: box.size.x,
          d: box.size.z,
          tall: h >= 2.2
        });
      }
    }

    return rects;
  }
}
