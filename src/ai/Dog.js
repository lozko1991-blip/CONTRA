import * as THREE from 'three';

let DOG_ID = 1;

export class Dog {
  constructor({ scene, physics, navGrid, position }) {
    this.scene = scene;
    this.physics = physics;
    this.navGrid = navGrid;

    this.id = DOG_ID++;
    this.alive = true;

    this.position = new THREE.Vector3(
      position.x ?? 0,
      position.y ?? 0.5,
      position.z ?? 0
    );

    this.velocity = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;

    this.state = 'idle';
    this.stateTimer = 0.8 + Math.random() * 1.5;

    this.patrolTarget = null;
    this.patrolRadius = 10;

    this.fleeTimer = 0;
    this.fleeDirection = new THREE.Vector3();

    this.speed = 2.6 + Math.random() * 1.4;
    this.fleeSpeed = 5.8;

    this.wallTimer = 0;

    this._moveDir = new THREE.Vector3();
    this._nextPos = new THREE.Vector3();

    this.createMesh();
  }

  createMesh() {
    this.group = new THREE.Group();

    const hue = 0.07 + Math.random() * 0.06;
    const sat = 0.25 + Math.random() * 0.2;
    const lit = 0.2 + Math.random() * 0.18;

    const fur = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue, sat, lit),
      roughness: 0.88,
      metalness: 0
    });

    const darkFur = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue, sat, lit * 0.6),
      roughness: 0.85,
      metalness: 0
    });

    const paw = new THREE.MeshStandardMaterial({
      color: 0x1a1614,
      roughness: 0.7,
      metalness: 0
    });

    this.body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 0.44, 4, 8),
      fur
    );
    this.body.rotation.x = Math.PI / 2;
    this.body.position.set(0, 0.28, 0);
    this.group.add(this.body);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.15, 6),
      darkFur
    );
    neck.position.set(0, 0.39, 0.29);
    this.group.add(neck);

    this.head = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.18, 0.2),
      fur
    );
    this.head.position.set(0, 0.49, 0.38);
    this.group.add(this.head);

    const snout = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.14, 5, 4),
      darkFur
    );
    snout.rotation.x = -Math.PI / 2;
    snout.position.set(0, 0.44, 0.5);
    this.group.add(snout);

    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 4, 3),
      paw
    );
    nose.position.set(0, 0.43, 0.57);
    this.group.add(nose);

    for (let side = -1; side <= 1; side += 2) {
      const ear = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.12, 4, 3),
        darkFur
      );
      ear.position.set(side * 0.07, 0.58, 0.35);
      ear.rotation.z = side * 0.3;
      ear.rotation.x = -0.2;
      this.group.add(ear);
    }

    this.legs = [];
    for (let side = -1; side <= 1; side += 2) {
      for (let fwd = -1; fwd <= 1; fwd += 2) {
        const upper = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.06, 0.15, 5),
          darkFur
        );
        upper.position.set(side * 0.13, 0.18, fwd * 0.18);
        this.group.add(upper);

        const lower = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.05, 0.14, 5),
          paw
        );
        lower.position.set(side * 0.13, 0.07, fwd * 0.18);
        this.group.add(lower);

        this.legs.push({ upper, lower, side, fwd });
      }
    }

    this.tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, 0.18, 4, 4),
      fur
    );
    this.tail.rotation.x = Math.PI / 2 + 0.7;
    this.tail.position.set(0, 0.42, -0.5);
    this.group.add(this.tail);

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.group.castShadow = true;
    this.scene.add(this.group);
  }

  pickPatrolTarget() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 3 + Math.random() * this.patrolRadius;

    const tx = this.position.x + Math.cos(angle) * dist;
    const tz = this.position.z + Math.sin(angle) * dist;

    const walkable = this.navGrid?.findNearestWalkable?.(tx, tz, 6);
    if (walkable) {
      this.patrolTarget = new THREE.Vector3(walkable.x, this.position.y, walkable.z);
    } else {
      this.patrolTarget = new THREE.Vector3(tx, this.position.y, tz);
    }
  }

  fleeFrom(point) {
    const dx = this.position.x - point.x;
    const dz = this.position.z - point.z;
    const len = Math.hypot(dx, dz);

    if (len < 0.01) {
      this.fleeDirection.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    } else {
      this.fleeDirection.set(dx / len, 0, dz / len);
    }

    this.state = 'flee';
    this.fleeTimer = 1.5 + Math.random() * 2;

    try {
      window.dispatchEvent(new CustomEvent('sfx:bark', { detail: { position: this.position } }));
    } catch {
      // ignore
    }
  }

  update(dt, threats = []) {
    if (!this.alive) return;

    let closestThreat = null;
    let closestDist = 7;

    for (const threat of threats) {
      if (!threat.alive && !threat.isLocal) continue;

      const dx = this.position.x - (threat.position?.x ?? threat.x ?? 0);
      const dz = this.position.z - (threat.position?.z ?? threat.z ?? 0);
      const dist = Math.hypot(dx, dz);

      if (dist < closestDist) {
        closestDist = dist;
        closestThreat = threat;
      }
    }

    if (closestThreat && this.state !== 'flee') {
      const pos = closestThreat.position ?? closestThreat;
      this.fleeFrom({ x: pos.x, y: pos.y, z: pos.z });
    }

    this.stateTimer -= dt;

    switch (this.state) {
      case 'idle': {
        if (this.stateTimer <= 0) {
          this.state = 'patrol';
          this.pickPatrolTarget();
          this.stateTimer = 2 + Math.random() * 3;
        }
        break;
      }

      case 'patrol': {
        if (!this.patrolTarget || this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 1 + Math.random() * 2;
          break;
        }

        const dx = this.patrolTarget.x - this.position.x;
        const dz = this.patrolTarget.z - this.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.5) {
          this.state = 'idle';
          this.stateTimer = 1 + Math.random() * 2;
          break;
        }

        this._moveDir.set(dx / dist, 0, dz / dist);
        this.moveInDirection(this._moveDir, this.speed, dt);
        break;
      }

      case 'flee': {
        this.fleeTimer -= dt;

        if (this.fleeTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 1 + Math.random() * 1.5;
          break;
        }

        this.moveInDirection(this.fleeDirection, this.fleeSpeed, dt);
        break;
      }
    }

    this.wallTimer -= dt;

    const walkX = this.position.x + this.velocity.x * 0.3;
    const walkZ = this.position.z + this.velocity.z * 0.3;

    if (
      this.wallTimer <= 0 &&
      this.navGrid &&
      !this.navGrid.isWalkableWorld(walkX, walkZ)
    ) {
      this.wallTimer = 0.4;
      this.fleeDirection.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      if (this.state === 'patrol') {
        this.state = 'idle';
        this.stateTimer = 1;
      }
    }

    this.animateLegs(dt);

    this.tail.rotation.z = Math.sin(Date.now() * 0.012 + this.id) * 0.35;

    this.group.position.copy(this.position);
    this.group.position.y -= 0.02;
    this.group.rotation.y = this.yaw;
  }

  animateLegs(dt) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const cycle = Date.now() * 0.008;

    for (const leg of this.legs) {
      const phase = leg.side * leg.fwd;
      const swing = Math.sin(cycle + phase * 1.8) * 0.06 * Math.min(speed / 3, 1);

      if (leg.upper) leg.upper.position.y = 0.18 + Math.abs(swing) * 0.5;
      if (leg.lower) leg.lower.position.y = 0.07 + swing;
    }
  }

  moveInDirection(dir, speed, dt) {
    const wishX = dir.x * speed;
    const wishZ = dir.z * speed;

    this.velocity.x += (wishX - this.velocity.x) * Math.min(1, dt * 7);
    this.velocity.z += (wishZ - this.velocity.z) * Math.min(1, dt * 7);

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    const speedMag = Math.hypot(this.velocity.x, this.velocity.z);
    if (speedMag > 0.04) {
      const targetYaw = Math.atan2(-this.velocity.x, -this.velocity.z);
      let diff = targetYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 7);
    }
  }

  dispose() {
    if (this.group) {
      this.scene.remove(this.group);
    }
  }
}
