import * as THREE from 'three';

/**
 * ViewModel — процедурна модель зброї від першої особи.
 *
 * Анімації:
 * - розгойдування при ходьбі/бігу (синхронно з камерою);
 * - віддача (пружинний kick);
 * - перезарядка (нахил + випадання магазину);
 * - діставання зброї після перемикання;
 * - muzzle flash.
 */
export class ViewModel {
  constructor(camera) {
    this.camera = camera;

    this.root = new THREE.Group();
    this.camera.add(this.root);

    this.basePosition = new THREE.Vector3(0.24, -0.22, -0.5);

    this.gun = null;
    this.parts = {};
    this.flashMesh = null;

    this.currentWeapon = null;
    this.suppressed = false;

    this.kickAmount = 0;
    this.flashTime = 0;

    this.reloading = false;
    this.reloadTime = 0;
    this.reloadDuration = 2.5;

    this.drawTime = 1;

    this.swayPhase = 0;

    this.muzzleZ = -0.72;

    this.setWeapon('ak47');
  }

  mat(color, roughness = 0.55, metalness = 0.35) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness
    });
  }

  addPart(parent, geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);

    parent.add(mesh);

    return mesh;
  }

  ease(x) {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  }

  setWeapon(weaponId) {
    if (this.currentWeapon === weaponId && this.gun) {
      return;
    }

    this.currentWeapon = weaponId;

    this.buildGun(weaponId);

    this.drawTime = 0;
    this.reloading = false;
  }

  setSuppressed(suppressed) {
    this.suppressed = suppressed;

    if (this.parts.suppressor) {
      this.parts.suppressor.visible = suppressed;
    }
  }

  clearGun() {
    if (!this.gun) {
      return;
    }

    this.root.remove(this.gun);

    this.gun.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }

      if (object.material) {
        object.material.dispose();
      }
    });

    this.gun = null;
    this.parts = {};
    this.flashMesh = null;
  }

  buildGun(weaponId) {
    this.clearGun();

    this.gun = new THREE.Group();

    const metalDark = this.mat(0x2e3030, 0.38, 0.75);
    const steel = this.mat(0x9ba1a6, 0.28, 0.9);
    const wood = this.mat(0x7a4a26, 0.72, 0.05);
    const polymer = this.mat(0x24262a, 0.62, 0.2);

    if (weaponId === 'knife') {
      const bladeSteel = this.mat(0xc8ccd0, 0.18, 0.95);

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.02, 0.045, 0.22),
        bladeSteel,
        0, 0.03, -0.15
      );

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.004, 0.05, 0.2),
        steel,
        0, 0.03, -0.13
      );

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.028, 0.055, 0.12),
        polymer,
        0, 0.02, 0.08,
        -0.12, 0, 0
      );

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.032, 0.035, 0.035),
        metalDark,
        0, 0.045, 0.02
      );

      this.muzzleZ = -0.28;
    } else if (weaponId === 'crowbar') {
      const ironMetal = this.mat(0x5a5c60, 0.25, 0.85);
      const ironHandle = this.mat(0x8a2828, 0.7, 0.1);

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.024, 0.04, 0.3),
        ironMetal,
        0, 0.02, -0.2
      );

      const hook = new THREE.Mesh(
        new THREE.BoxGeometry(0.01, 0.05, 0.08),
        ironMetal
      );
      hook.position.set(0, 0.045, -0.34);
      this.gun.add(hook);

      const claw = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.03, 0.06),
        ironMetal
      );
      claw.position.set(0, 0.055, -0.36);
      this.gun.add(claw);

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.024, 0.04, 0.22),
        ironHandle,
        0, 0.02, 0.12
      );

      this.muzzleZ = -0.38;
    } else if (weaponId === 'deagle') {
      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.042, 0.048, 0.24),
        steel,
        0, 0.02, -0.1
      );

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.038, 0.03, 0.16),
        polymer,
        0, -0.012, -0.08
      );

      this.addPart(
        this.gun,
        new THREE.CylinderGeometry(0.013, 0.013, 0.07, 10),
        steel,
        0, 0.02, -0.26,
        Math.PI / 2, 0, 0
      );

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.036, 0.11, 0.05),
        polymer,
        0, -0.075, 0.02,
        -0.32, 0, 0
      );

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.012, 0.035, 0.05),
        metalDark,
        0, -0.045, -0.03
      );

      const magazine = this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.03, 0.06, 0.042),
        metalDark,
        0, -0.1, 0.015,
        -0.32, 0, 0
      );

      this.parts.magazine = magazine;

      this.muzzleZ = -0.31;
    } else {
      const isM4 = weaponId === 'm4a1';

      const bodyMaterial = isM4 ? polymer : metalDark;
      const guardMaterial = isM4 ? polymer : wood;

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.055, 0.075, 0.4),
        bodyMaterial,
        0, 0, -0.08
      );

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.05, 0.06, 0.22),
        guardMaterial,
        0, -0.004, -0.36
      );

      this.addPart(
        this.gun,
        new THREE.CylinderGeometry(0.011, 0.011, isM4 ? 0.34 : 0.3, 10),
        metalDark,
        0, 0.012, isM4 ? -0.6 : -0.55,
        Math.PI / 2, 0, 0
      );

      if (isM4) {
        this.addPart(
          this.gun,
          new THREE.BoxGeometry(0.028, 0.034, 0.18),
          polymer,
          0, 0.056, -0.14
        );

        this.addPart(
          this.gun,
          new THREE.BoxGeometry(0.012, 0.016, 0.03),
          metalDark,
          0, 0.05, -0.3
        );

        const suppressor = this.addPart(
          this.gun,
          new THREE.CylinderGeometry(0.021, 0.021, 0.15, 12),
          this.mat(0x1c1e20, 0.5, 0.6),
          0, 0.012, -0.62,
          Math.PI / 2, 0, 0
        );

        suppressor.visible = this.suppressed;

        this.parts.suppressor = suppressor;
      } else {
        this.addPart(
          this.gun,
          new THREE.CylinderGeometry(0.008, 0.008, 0.2, 8),
          metalDark,
          0, 0.046, -0.4,
          Math.PI / 2, 0, 0
        );

        this.addPart(
          this.gun,
          new THREE.BoxGeometry(0.01, 0.022, 0.02),
          metalDark,
          0, 0.052, 0.02
        );
      }

      const magazine = this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.038, 0.17, 0.07),
        isM4 ? polymer : this.mat(0x5f3d1c, 0.7, 0.1),
        0, -0.115, -0.04,
        isM4 ? 0.12 : 0.5, 0, 0
      );

      this.parts.magazine = magazine;

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.03, 0.09, 0.04),
        isM4 ? polymer : metalDark,
        0, -0.085, 0.08,
        -0.3, 0, 0
      );

      this.addPart(
        this.gun,
        new THREE.BoxGeometry(0.05, 0.065, 0.22),
        isM4 ? polymer : wood,
        0, -0.012, 0.22
      );

      this.muzzleZ = -0.72;
    }

    if (this.parts.magazine) {
      this.parts.magazine.userData.baseY =
        this.parts.magazine.position.y;

      this.parts.magazine.userData.baseRotX =
        this.parts.magazine.rotation.x;
    }

    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffcf7a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.flashMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.16),
      flashMaterial
    );

    this.flashMesh.position.set(0, 0.012, this.muzzleZ);

    this.gun.add(this.flashMesh);

    this.root.add(this.gun);
  }

  kickShot() {
    this.kickAmount = Math.min(1.5, this.kickAmount + 0.5);

    this.flashTime = 0.045;

    if (this.flashMesh) {
      this.flashMesh.material.opacity = this.suppressed ? 0.35 : 0.95;
      this.flashMesh.rotation.z = Math.random() * Math.PI;

      const scale = 0.8 + Math.random() * 0.5;

      this.flashMesh.scale.setScalar(
        this.suppressed ? scale * 0.55 : scale
      );
    }
  }

  startReload(duration = 2.5) {
    this.reloading = true;
    this.reloadTime = 0;
    this.reloadDuration = Math.max(0.4, duration);
  }

  reloadDip(t) {
    if (t < 0.22) {
      return this.ease(t / 0.22);
    }

    if (t < 0.68) {
      return 1;
    }

    return 1 - this.ease((t - 0.68) / 0.32);
  }

  update(dt, state = {}) {
    const speed = state.speed ?? 0;
    const grounded = state.grounded ?? true;
    const crouched = state.crouched ?? false;
    const bobPhase = state.bobPhase ?? this.swayPhase;

    this.swayPhase += dt * (1.6 + speed * 1.5);

    /**
     * Діставання зброї.
     */
    this.drawTime = Math.min(1, this.drawTime + dt * 3.2);

    const draw = this.ease(this.drawTime);
    const drawDrop = (1 - draw) * 0.35;
    const drawRot = (1 - draw) * 0.9;

    /**
     * Пружина віддачі.
     */
    this.kickAmount = Math.max(
      0,
      this.kickAmount - dt * (4.5 + this.kickAmount * 6)
    );

    /**
     * Перезарядка.
     */
    let dip = 0;

    if (this.reloading) {
      this.reloadTime += dt;

      const t = this.reloadTime / this.reloadDuration;

      if (t >= 1) {
        this.reloading = false;
      } else {
        dip = this.reloadDip(t);
      }
    }

    if (this.parts.magazine) {
      this.parts.magazine.position.y =
        this.parts.magazine.userData.baseY - dip * 0.09;

      this.parts.magazine.rotation.x =
        this.parts.magazine.userData.baseRotX + dip * 0.5;
    }

    /**
     * Розгойдування.
     */
    const bobAmp =
      (grounded ? Math.min(speed / 6.4, 1) * 0.012 : 0.004) *
      (crouched ? 0.5 : 1);

    const bobX = Math.cos(bobPhase) * bobAmp * 1.4;
    const bobY = Math.sin(bobPhase * 2) * bobAmp;

    const idleSway = Math.sin(this.swayPhase * 0.5) * 0.0022;

    const kickZ = this.kickAmount * 0.055;
    const kickRotX = this.kickAmount * 0.09;

    this.root.position.set(
      this.basePosition.x + bobX + idleSway,
      this.basePosition.y + bobY - dip * 0.1 - drawDrop,
      this.basePosition.z + kickZ
    );

    this.root.rotation.set(
      -dip * 1.05 + kickRotX + drawRot * 0.6,
      dip * 0.22 + idleSway * 2,
      drawRot * 0.4 + bobX * 1.2
    );

    /**
     * Спалах.
     */
    if (this.flashTime > 0) {
      this.flashTime -= dt;

      if (this.flashTime <= 0 && this.flashMesh) {
        this.flashMesh.material.opacity = 0;
      }
    }
  }

  dispose() {
    this.clearGun();
  }
}
