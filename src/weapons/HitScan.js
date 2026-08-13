/**
 * HitScan отвечает за:
 * - raycast выстрела;
 * - повторный raycast после пробития;
 * - расчёт прохождения через материалы;
 * - возврат цепочки попаданий.
 */

export const MaterialResistance = Object.freeze({
  glass: 0.15,
  wood: 1.0,
  metal: 3.0,
  concrete: 2.4,
  brick: 2.2,
  flesh: 0.0,
  carBody: 1.2,
  carBodyBlue: 1.2,
  carBodyGreen: 1.2,
  wheel: 1.4,
  truckBody: 1.5,
  truckCab: 1.5
});

export const PenetrationDamageMultiplier = Object.freeze({
  glass: 0.85,
  wood: 0.75,
  metal: 0.4,
  concrete: 0.55,
  brick: 0.55,
  carBody: 0.55,
  carBodyBlue: 0.55,
  carBodyGreen: 0.55,
  wheel: 0.5,
  truckBody: 0.5,
  truckCab: 0.5
});

export class HitScan {
  constructor(physics) {
    this.physics = physics;
  }

  /**
   * @param {THREE.Vector3|{x:number,y:number,z:number}} origin
   * @param {THREE.Vector3|{x:number,y:number,z:number}} direction
   * @param {number} maxDistance
   * @param {Object|null} excludeCollider
   * @param {number} penetrationPower
   * @returns {Array}
   */
  trace(
    origin,
    direction,
    maxDistance = 200,
    excludeCollider = null,
    penetrationPower = 0
  ) {
    const hits = [];

    const dx = direction.x;
    const dy = direction.y;
    const dz = direction.z;

    const len = Math.hypot(dx, dy, dz);

    if (len === 0) {
      return hits;
    }

    const dir = {
      x: dx / len,
      y: dy / len,
      z: dz / len
    };

    let currentOrigin = {
      x: origin.x,
      y: origin.y,
      z: origin.z
    };

    let remaining = maxDistance;
    let currentExclude = excludeCollider;
    let damageMultiplier = 1;
    let power = penetrationPower;

    /**
     * Максимальное число пробитий.
     * 3 достаточно для стекла, дерева и тонкой стены.
     */
    const maxPenetrations = 3;

    for (let i = 0; i < maxPenetrations; i++) {
      const hit = this.physics.raycast(
        currentOrigin,
        dir,
        remaining,
        currentExclude
      );

      if (!hit) {
        break;
      }

      hits.push({
        ...hit,
        damageMultiplier
      });

      const material = hit.userData?.material ?? 'concrete';

      /**
       * Пуля останавливается в теле.
       */
      if (material === 'flesh' || hit.userData?.stopsBullet) {
        break;
      }

      const resistance = MaterialResistance[material] ?? Infinity;

      if (power < resistance) {
        break;
      }

      const penetrationDamage =
        PenetrationDamageMultiplier[material] ?? 0.5;

      damageMultiplier *= penetrationDamage;

      /**
       * После каждого пробития пуля теряет энергию.
       */
      power *= 0.72;

      const advance = Math.max(hit.distance ?? 0.001, 0.001) + 0.08;

      remaining -= advance;

      if (remaining <= 0.1) {
        break;
      }

      currentOrigin = {
        x: hit.point.x + dir.x * 0.08,
        y: hit.point.y + dir.y * 0.08,
        z: hit.point.z + dir.z * 0.08
      };

      currentExclude = hit.collider;
    }

    return hits;
  }
}
