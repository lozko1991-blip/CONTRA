import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/**
 * DecalSystem — сліди від куль на поверхнях.
 *
 * - нормаль поверхні дістається через castRayAndGetNormal;
 * - декаль орієнтується по нормалі;
 * - кров тримається коротше, сліди довше;
 * - старі декалі видаляються (пул).
 */
export class DecalSystem {
  constructor(scene, physics, maxDecals = 90) {
    this.scene = scene;
    this.physics = physics;
    this.maxDecals = maxDecals;

    this.decals = [];

    this.geometry = new THREE.PlaneGeometry(0.14, 0.14);

    this.holeMaterial = new THREE.MeshBasicMaterial({
      color: 0x141414,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4
    });

    this.bloodMaterial = new THREE.MeshBasicMaterial({
      color: 0x6b1010,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4
    });

    this._dir = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._zAxis = new THREE.Vector3(0, 0, 1);
  }

  add(point, direction, type = 'hole') {
    if (!this.physics?.world) {
      return;
    }

    const dir = this._dir.set(
      direction.x,
      direction.y,
      direction.z
    );

    const length = dir.length();

    if (length < 0.0001) {
      return;
    }

    dir.divideScalar(length);

    /**
     * Шукаємо нормаль поверхні коротким raycast.
     */
    let normal = {
      x: -dir.x,
      y: -dir.y,
      z: -dir.z
    };

    try {
      const ray = new RAPIER.Ray(
        {
          x: point.x - dir.x * 0.25,
          y: point.y - dir.y * 0.25,
          z: point.z - dir.z * 0.25
        },
        {
          x: dir.x,
          y: dir.y,
          z: dir.z
        }
      );

      const hit = this.physics.world.castRayAndGetNormal(
        ray,
        0.5,
        true
      );

      if (hit?.normal) {
        normal = hit.normal;
      }
    } catch {
      // ignore
    }

    this._normal.set(normal.x, normal.y, normal.z);

    if (this._normal.lengthSq() < 0.0001) {
      this._normal.copy(dir).negate();
    }

    this._normal.normalize();

    const baseMaterial =
      type === 'blood'
        ? this.bloodMaterial
        : this.holeMaterial;

    const material = baseMaterial.clone();

    const mesh = new THREE.Mesh(this.geometry, material);

    mesh.position.set(
      point.x + this._normal.x * 0.012,
      point.y + this._normal.y * 0.012,
      point.z + this._normal.z * 0.012
    );

    this._quaternion.setFromUnitVectors(
      this._zAxis,
      this._normal
    );

    mesh.quaternion.copy(this._quaternion);
    mesh.rotateZ(Math.random() * Math.PI * 2);

    const scale =
      type === 'blood'
        ? 0.9 + Math.random() * 0.7
        : 0.7 + Math.random() * 0.6;

    mesh.scale.setScalar(scale);

    mesh.renderOrder = 2;

    this.scene.add(mesh);

    this.decals.push({
      mesh,
      material,
      life: type === 'blood' ? 14 : 22,
      baseOpacity: material.opacity
    });

    while (this.decals.length > this.maxDecals) {
      const oldest = this.decals.shift();
      this.removeDecal(oldest);
    }
  }

  update(dt) {
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const decal = this.decals[i];

      decal.life -= dt;

      if (decal.life < 3) {
        decal.material.opacity =
          Math.max(0, decal.life / 3) * decal.baseOpacity;
      }

      if (decal.life <= 0) {
        this.removeDecal(decal);
        this.decals.splice(i, 1);
      }
    }
  }

  removeDecal(decal) {
    this.scene.remove(decal.mesh);
    decal.material.dispose();
  }
}
