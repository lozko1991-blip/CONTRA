import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Базовые материалы поверхностей.
 * Позже используется для:
 * - звуков попадания;
 * - декалей;
 * - прострелов;
 * - модификаторов урона.
 */
export const SurfaceMaterial = Object.freeze({
  CONCRETE: 'concrete',
  BRICK: 'brick',
  WOOD: 'wood',
  METAL: 'metal',
  GLASS: 'glass',
  FLESH: 'flesh'
});

/**
 * PhysicsWorld — обёртка над Rapier.
 *
 * Сейчас:
 * - создаёт физический мир;
 * - добавляет статичные и динамичные тела;
 * - хранит metadata для коллайдеров;
 * - даёт базовый raycast.
 *
 * Позже:
 * - character controller;
 * - слои коллизий;
 * - wallbang raycast chain;
 * - hit validation.
 */
export class PhysicsWorld {
  constructor() {
    this.world = null;

    this.dynamicBodies = new Set();
    this.staticBodies = new Set();

    /**
     * Rapier не всегда удобно использовать как хранилище игровых данных,
     * поэтому metadata коллайдеров храним отдельно по handle.
     */
    this.colliderMeta = new Map();
    this.bodyMeta = new Map();
  }

  async init() {
    // Rapier WASM должен быть инициализирован до создания мира.
    await RAPIER.init();

    /**
     * Gravity:
     * -9.81 * 2 = -19.62.
     *
     * Для аркадно-точного FPS-ощущения в браузере часто используют
     * удвоенную гравитацию, чтобы прыжки были короче и контролируемее.
     *
     * Позже в GoldSrcMovement можно будет настроить точнее под CS 1.6.
     */
    this.world = new RAPIER.World({
      x: 0,
      y: -19.62,
      z: 0
    });

    this.world.timestep = 1 / 60;
  }

  step(dt) {
    if (!this.world) return;

    this.world.timestep = dt;
    this.world.step();
  }

  /**
   * Создать статичный box-collider.
   *
   * @param {Object} params
   * @param {[number, number, number]} params.position
   * @param {[number, number, number]} params.size
   * @param {number} [params.friction]
   * @param {number} [params.restitution]
   * @param {Object} [params.userData]
   */
  createStaticBox({
    position = [0, 0, 0],
    size = [1, 1, 1],
    rotation = null,
    friction = 0.8,
    restitution = 0,
    userData = null
  }) {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      position[0],
      position[1],
      position[2]
    );

    const body = this.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      size[0] * 0.5,
      size[1] * 0.5,
      size[2] * 0.5
    )
      .setFriction(friction)
      .setRestitution(restitution);

    if (rotation) {
      const { x = 0, y = 0, z = 0 } = rotation;
      const quat = new RAPIER.Quaternion(
        Math.sin(x * 0.5) * Math.cos(y * 0.5) * Math.cos(z * 0.5) -
          Math.cos(x * 0.5) * Math.sin(y * 0.5) * Math.sin(z * 0.5),
        Math.cos(x * 0.5) * Math.sin(y * 0.5) * Math.cos(z * 0.5) +
          Math.sin(x * 0.5) * Math.cos(y * 0.5) * Math.sin(z * 0.5),
        Math.cos(x * 0.5) * Math.cos(y * 0.5) * Math.sin(z * 0.5) -
          Math.sin(x * 0.5) * Math.sin(y * 0.5) * Math.cos(z * 0.5),
        Math.cos(x * 0.5) * Math.cos(y * 0.5) * Math.cos(z * 0.5) +
          Math.sin(x * 0.5) * Math.sin(y * 0.5) * Math.sin(z * 0.5)
      );
      colliderDesc.setRotation(quat);
    }

    const collider = this.world.createCollider(colliderDesc, body);

    this.staticBodies.add(body);

    if (userData) {
      this.colliderMeta.set(collider.handle, userData);
      this.bodyMeta.set(body.handle, userData);
    }

    return { body, collider };
  }

  /**
   * Создать динамичный box-collider.
   *
   * @param {Object} params
   * @param {[number, number, number]} params.position
   * @param {[number, number, number]} params.size
   * @param {number} [params.mass]
   * @param {number} [params.friction]
   * @param {number} [params.restitution]
   * @param {number} [params.linearDamping]
   * @param {number} [params.angularDamping]
   * @param {Object} [params.userData]
   */
  createDynamicBox({
    position = [0, 0, 0],
    size = [1, 1, 1],
    mass = 1,
    friction = 0.7,
    restitution = 0.05,
    linearDamping = 0.08,
    angularDamping = 0.12,
    userData = null
  }) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position[0], position[1], position[2])
      .setLinearDamping(linearDamping)
      .setAngularDamping(angularDamping)
      .setCcdEnabled(true);

    const body = this.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      size[0] * 0.5,
      size[1] * 0.5,
      size[2] * 0.5
    )
      .setMass(mass)
      .setFriction(friction)
      .setRestitution(restitution);

    const collider = this.world.createCollider(colliderDesc, body);

    this.dynamicBodies.add(body);

    if (userData) {
      this.colliderMeta.set(collider.handle, userData);
      this.bodyMeta.set(body.handle, userData);
    }

    return { body, collider };
  }

  /**
   * Character controller понадобится в следующем шаге.
   * Вынесен сюда заранее, чтобы PlayerController не работал с Rapier напрямую.
   */
  createCharacterController(offset = 0.02) {
    if (!this.world) return null;
    return this.world.createCharacterController(offset);
  }

  /**
   * Базовый raycast.
   *
   * Позже будет расширен:
   * - filter layers;
   * - exclude player;
   * - wallbang chain raycast;
   * - material penetration.
   *
   * @param {{x:number,y:number,z:number}} origin
   * @param {{x:number,y:number,z:number}} direction
   * @param {number} maxDistance
   * @param {Object|null} excludeCollider
   */
  raycast(origin, direction, maxDistance = 100, excludeCollider = null) {
    if (!this.world) return null;

    const dx = direction.x;
    const dy = direction.y;
    const dz = direction.z;

    const len = Math.hypot(dx, dy, dz);
    if (len === 0) return null;

    const dir = {
      x: dx / len,
      y: dy / len,
      z: dz / len
    };

    const ray = new RAPIER.Ray(
      {
        x: origin.x,
        y: origin.y,
        z: origin.z
      },
      dir
    );

    const hit = excludeCollider
      ? this.world.castRay(
          ray,
          maxDistance,
          true,
          undefined,
          undefined,
          excludeCollider
        )
      : this.world.castRay(ray, maxDistance, true);

    if (!hit) return null;

    const toi = hit.timeOfImpact;

    return {
      collider: hit.collider,
      body:
        typeof hit.collider.parent === 'function'
          ? hit.collider.parent()
          : null,
      distance: toi,
      point: {
        x: origin.x + dir.x * toi,
        y: origin.y + dir.y * toi,
        z: origin.z + dir.z * toi
      },
      userData: this.getColliderUserData(hit.collider)
    };
  }

  getColliderUserData(collider) {
    if (!collider) return null;
    return this.colliderMeta.get(collider.handle) ?? null;
  }

  getBodyUserData(body) {
    if (!body) return null;
    return this.bodyMeta.get(body.handle) ?? null;
  }

  removeBody(body) {
    if (!this.world || !body) return;

    if (typeof body.numColliders === 'function') {
      const count = body.numColliders();

      for (let i = 0; i < count; i++) {
        const collider = body.collider(i);
        this.colliderMeta.delete(collider.handle);
      }
    } else if (typeof body.colliders === 'function') {
      const colliders = body.colliders();

      for (const collider of colliders) {
        this.colliderMeta.delete(collider.handle);
      }
    }

    this.bodyMeta.delete(body.handle);

    this.dynamicBodies.delete(body);
    this.staticBodies.delete(body);

    this.world.removeRigidBody(body);
  }

  dispose() {
    if (this.world && typeof this.world.free === 'function') {
      this.world.free();
    }

    this.world = null;

    this.dynamicBodies.clear();
    this.staticBodies.clear();
    this.colliderMeta.clear();
    this.bodyMeta.clear();
  }
}
