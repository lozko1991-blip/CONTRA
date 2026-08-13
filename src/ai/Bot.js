import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

let BOT_ID = 1;

export class Bot {
  constructor({
    scene,
    physics,
    navGrid,
    player,
    weaponManager = null,
    spawn = { x: 0, z: 0 },
    team = 'enemy',
    onPlayerDamage = null
  }) {
    this.scene = scene;
    this.physics = physics;
    this.navGrid = navGrid;
    this.player = player;
    this.weaponManager = weaponManager;
    this.team = team;
    this.onPlayerDamage = onPlayerDamage;

    this.id = BOT_ID++;

    this.health = 100;
    this.alive = false;

    this.noisy = false;
    this.noiseTimer = 0;

    this.yaw = 0;

    this.state = 'patrol';

    this.playerVisible = false;
    this.reactTimer = 0.3;

    this.distanceToPlayer = 999;

    this.lastSeenTime = 999;
    this.lastHeardTime = 999;

    this.hasLastKnown = false;
    this.hasLastHeard = false;
    this.hasPatrolTarget = false;
    this.hasStrafeTarget = false;

    this.fireCooldown = 0;

    this.stateTimer = 0;
    this.coverWait = 0;
    this.coverCooldown = 0;

    this.deathTimer = 0;

    this.path = null;
    this.pathIndex = 0;

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();

    this.lastKnownPlayerPos = new THREE.Vector3();
    this.lastHeardPos = new THREE.Vector3();

    this.patrolTarget = new THREE.Vector3();
    this.strafeTarget = new THREE.Vector3();
    this.moveTarget = new THREE.Vector3();
    this.currentMoveTarget = new THREE.Vector3();

    this._toPlayer = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._eye = new THREE.Vector3();
    this._muzzle = new THREE.Vector3();
    this._moveDir = new THREE.Vector3();
    this._tmp = new THREE.Vector3();

    this.body = null;
    this.mesh = null;

    this.respawn(spawn);
  }

  respawn(spawn) {
    this.remove();

    this.health = 100;
    this.alive = true;

    this.state = 'patrol';

    this.playerVisible = false;
    this.reactTimer = 0.3;

    this.lastSeenTime = 999;
    this.lastHeardTime = 999;

    this.hasLastKnown = false;
    this.hasLastHeard = false;
    this.hasPatrolTarget = false;
    this.hasStrafeTarget = false;

    this.fireCooldown = 0.5;
    this.stateTimer = 0;
    this.coverWait = 0;
    this.coverCooldown = 0;

    this.path = null;
    this.pathIndex = 0;

    this.velocity.set(0, 0, 0);

    this.create(spawn);
  }

  create(spawn) {
    const x = spawn.x ?? 0;
    const z = spawn.z ?? 0;

    this.position.set(x, 0.9, z);
    this.yaw = Math.random() * Math.PI * 2;

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(x, 0.9, z);

    this.body = this.physics.world.createRigidBody(bodyDesc);

    this.createHitboxes();
    this.createMesh();
  }

  createHitboxes() {
    const zones = [
      {
        name: 'head',
        half: [0.16, 0.16, 0.16],
        y: 0.68
      },
      {
        name: 'chest',
        half: [0.3, 0.28, 0.2],
        y: 0.22
      },
      {
        name: 'stomach',
        half: [0.27, 0.2, 0.18],
        y: -0.18
      },
      {
        name: 'legs',
        half: [0.25, 0.38, 0.18],
        y: -0.6
      }
    ];

    for (const zone of zones) {
      const colliderDesc = RAPIER.ColliderDesc.cuboid(
        zone.half[0],
        zone.half[1],
        zone.half[2]
      )
        .setTranslation(0, zone.y, 0)
        .setFriction(0)
        .setRestitution(0);

      const collider = this.physics.world.createCollider(
        colliderDesc,
        this.body
      );

      this.physics.colliderMeta.set(collider.handle, {
        bot: this,
        botId: this.id,
        team: this.team,
        material: 'flesh',
        hitZone: zone.name,
        stopsBullet: true,
        applyDamage: (damage, hit) => {
          this.applyDamage(damage, hit);
        }
      });
    }
  }

  createMesh() {
    this.mesh = new THREE.Group();

    const bodyColor = this.team === 'enemy' ? 0xb04a4a : 0x4a6fb0;

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.7,
      metalness: 0.05
    });

    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8a06b,
      roughness: 0.65,
      metalness: 0.0
    });

    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.75, 4, 8),
      bodyMaterial
    );

    torso.position.y = 0.1;
    torso.castShadow = true;

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.32, 0.32),
      headMaterial
    );

    head.position.y = 0.68;
    head.castShadow = true;

    this.mesh.add(torso);
    this.mesh.add(head);

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;

    this.scene.add(this.mesh);
  }

  remove() {
    if (this.body && this.physics?.world) {
      this.physics.removeBody(this.body);
    }

    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
    }

    this.body = null;
    this.mesh = null;
  }

  dispose() {
    this.remove();
  }

  applyDamage(damage) {
    if (!this.alive) return;

    this.health -= damage;

    this.makeNoise(1.5);

    if (this.player) {
      this.lastKnownPlayerPos.copy(this.player.getEyePosition());
      this.hasLastKnown = true;
      this.lastSeenTime = 0;
    }

    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
  }

  die() {
    this.alive = false;
    this.deathTimer = 3;

    this.remove();
  }

  makeNoise(time = 1) {
    this.noisy = true;
    this.noiseTimer = Math.max(this.noiseTimer, time);
  }

  getEyePosition() {
    return this._eye.set(
      this.position.x,
      this.position.y + 0.68,
      this.position.z
    );
  }

  getMuzzlePosition() {
    this._muzzle.copy(this.getEyePosition());
    this._muzzle.y = this.position.y + 0.45;
    this._muzzle.addScaledVector(this.getForward(), 0.35);

    return this._muzzle;
  }

  getForward() {
    return this._forward.set(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    );
  }

  facePoint(point) {
    if (!point) return;

    const dx = point.x - this.position.x;
    const dz = point.z - this.position.z;

    if (dx * dx + dz * dz < 0.0001) {
      return;
    }

    this.yaw = Math.atan2(-dx, -dz);
  }

  update(dt) {
    if (!this.alive) return;

    this.noiseTimer = Math.max(0, this.noiseTimer - dt);

    if (this.noiseTimer <= 0) {
      this.noisy = false;
    }

    this.updateSenses(dt);
    this.updateBehavior(dt);
    this.updatePhysics(dt);
    this.syncMesh();
  }

  updateSenses(dt) {
    if (!this.player) return;

    const playerEye = this.player.getEyePosition();
    const eye = this.getEyePosition();

    this._toPlayer.copy(playerEye).sub(eye);

    const dist = this._toPlayer.length();
    this.distanceToPlayer = dist;

    if (dist > 0.0001) {
      this._toPlayer.divideScalar(dist);
    }

    const dot = this.getForward().dot(this._toPlayer);

    const inFov = dot > 0.707 || dist < 3.5;

    let visible = false;

    if (dist < 65 && inFov) {
      visible = this.canSeePoint(playerEye);
    }

    if (visible) {
      this.lastKnownPlayerPos.copy(playerEye);
      this.hasLastKnown = true;
      this.lastSeenTime = 0;

      if (!this.playerVisible) {
        this.reactTimer = 0.2 + Math.random() * 0.2;
      } else {
        this.reactTimer = Math.max(0, this.reactTimer - dt);
      }

      this.playerVisible = true;
    } else {
      this.playerVisible = false;
      this.lastSeenTime += dt;
      this.reactTimer = 0.25;
    }

    this.lastHeardTime += dt;

    const playerState = this.player.getState?.();

    const playerRunning =
      playerState &&
      playerState.speed > 3.2 &&
      !playerState.crouched;

    const timeSincePlayerShot =
      this.weaponManager?.current?.timeSinceLastShot ?? 999;

    const playerShooting = timeSincePlayerShot < 0.12;

    if (dist < 28 && playerRunning) {
      this.lastHeardPos.copy(this.player.position);
      this.hasLastHeard = true;
      this.lastHeardTime = 0;
    }

    if (dist < 70 && playerShooting) {
      this.lastHeardPos.copy(this.player.position);
      this.hasLastHeard = true;
      this.lastHeardTime = 0;
    }
  }

  canSeePoint(target) {
    const origin = this.getEyePosition().clone();

    const dir = target.clone().sub(origin);
    let remaining = dir.length();

    if (remaining < 0.001) {
      return true;
    }

    dir.normalize();

    let currentOrigin = origin;
    let exclude = null;

    for (let i = 0; i < 4; i++) {
      const hit = this.physics.raycast(
        currentOrigin,
        dir,
        remaining,
        exclude
      );

      if (!hit) {
        return true;
      }

      if (hit.userData?.player) {
        return true;
      }

      if (hit.distance >= remaining - 0.15) {
        return true;
      }

      if (hit.userData?.bot === this) {
        const advance = Math.max(hit.distance ?? 0, 0.001) + 0.05;

        currentOrigin = currentOrigin
          .clone()
          .addScaledVector(dir, advance);

        remaining -= advance;
        exclude = hit.collider;

        if (remaining <= 0.1) {
          return true;
        }

        continue;
      }

      return false;
    }

    return true;
  }

  canSeePointFrom(origin, target) {
    const dir = target.clone().sub(origin);
    let dist = dir.length();

    if (dist < 0.001) {
      return true;
    }

    dir.normalize();

    const start = origin.clone().addScaledVector(dir, 0.35);
    dist -= 0.35;

    if (dist <= 0.1) {
      return true;
    }

    const hit = this.physics.raycast(start, dir, dist, null);

    if (!hit) {
      return true;
    }

    return hit.distance >= dist - 0.5;
  }

  raycastToPlayer(origin, dir, maxDistance) {
    let currentOrigin = origin.clone();
    let remaining = maxDistance;
    let exclude = null;

    for (let i = 0; i < 4; i++) {
      const hit = this.physics.raycast(
        currentOrigin,
        dir,
        remaining,
        exclude
      );

      if (!hit) {
        return {
          hitPlayer: false,
          end: origin
            .clone()
            .addScaledVector(dir, maxDistance)
        };
      }

      if (hit.userData?.player) {
        return {
          hitPlayer: true,
          end: new THREE.Vector3(
            hit.point.x,
            hit.point.y,
            hit.point.z
          )
        };
      }

      if (hit.userData?.bot === this) {
        const advance = Math.max(hit.distance ?? 0, 0.001) + 0.05;

        currentOrigin = currentOrigin
          .clone()
          .addScaledVector(dir, advance);

        remaining -= advance;
        exclude = hit.collider;

        if (remaining <= 0.1) {
          break;
        }

        continue;
      }

      return {
        hitPlayer: false,
        end: new THREE.Vector3(
          hit.point.x,
          hit.point.y,
          hit.point.z
        )
      };
    }

    return {
      hitPlayer: false,
      end: origin.clone().addScaledVector(dir, maxDistance)
    };
  }

  updateBehavior(dt) {
    this.fireCooldown -= dt;
    this.stateTimer -= dt;
    this.coverCooldown -= dt;

    /**
     * Low HP cover behavior.
     */
    if (
      this.health < 35 &&
      this.playerVisible &&
      this.state !== 'cover' &&
      this.coverCooldown <= 0
    ) {
      const cover = this.findCoverPoint(this.player.position);

      if (cover) {
        this.state = 'cover';
        this.moveTarget.copy(cover);
        this.currentMoveTarget.set(0, 0, 0);
        this.coverWait = 2.5;
        this.coverCooldown = 6;
        this.path = null;
      }
    }

    if (this.state === 'cover') {
      this.moveToTarget(this.moveTarget, 5.2, false);
      this.facePoint(this.lastKnownPlayerPos);

      if (this.distanceToTarget < 0.8) {
        this.coverWait -= dt;

        if (this.coverWait <= 0) {
          this.state = 'combat';
        }
      }

      if (
        this.playerVisible &&
        this.reactTimer <= 0 &&
        this.coverWait < 1.5
      ) {
        this.tryShoot();
      }

      return;
    }

    if (this.playerVisible && this.reactTimer <= 0) {
      this.state = 'combat';
      this.combatUpdate(dt);
      return;
    }

    if (this.hasLastKnown && this.lastSeenTime < 2.5) {
      this.state = 'chase';
      this.moveToTarget(this.lastKnownPlayerPos, 5.0, false);
      this.facePoint(this.lastKnownPlayerPos);
      return;
    }

    if (this.hasLastHeard && this.lastHeardTime < 4) {
      this.state = 'chase';
      this.moveToTarget(this.lastHeardPos, 4.2, false);
      this.facePoint(this.lastHeardPos);
      return;
    }

    this.state = 'patrol';
    this.patrolUpdate(dt);
  }

  combatUpdate(dt) {
    this.facePoint(this.player.position);

    const dist = this.distanceToPlayer;

    if (dist < 11) {
      if (
        !this.hasStrafeTarget ||
        this.stateTimer <= 0 ||
        this.distanceToTarget < 0.5
      ) {
        this.chooseStrafeTarget();
        this.stateTimer = 0.7 + Math.random() * 0.8;
      }

      this.moveToTarget(this.strafeTarget, 3.6, false);
    } else if (dist > 18) {
      this.moveToTarget(this.player.position, 4.8, false);
    } else {
      if (
        !this.hasStrafeTarget ||
        this.stateTimer <= 0 ||
        this.distanceToTarget < 0.5
      ) {
        this.chooseStrafeTarget();
        this.stateTimer = 1.0 + Math.random() * 1.2;
      }

      this.moveToTarget(this.strafeTarget, 2.6, true);
    }

    if (this.playerVisible) {
      this.tryShoot();
    }

    this.makeNoise(1.2);
  }

  patrolUpdate(dt) {
    if (
      !this.hasPatrolTarget ||
      this.distanceToTarget < 0.8 ||
      this.stateTimer <= 0
    ) {
      this.patrolTarget.copy(this.randomPatrolTarget());
      this.hasPatrolTarget = true;
      this.stateTimer = 5 + Math.random() * 4;
      this.currentMoveTarget.set(0, 0, 0);
    }

    this.moveToTarget(this.patrolTarget, 2.4, true);
    this.facePoint(this.patrolTarget);
  }

  chooseStrafeTarget() {
    const dx = this.player.position.x - this.position.x;
    const dz = this.player.position.z - this.position.z;

    const len = Math.hypot(dx, dz) || 1;

    let px = -dz / len;
    let pz = dx / len;

    let side = Math.random() < 0.5 ? 1 : -1;
    let radius = 3 + Math.random() * 2.5;

    for (let i = 0; i < 3; i++) {
      const x = this.position.x + px * side * radius;
      const z = this.position.z + pz * side * radius;

      if (this.navGrid.isWalkableWorld(x, z)) {
        this.strafeTarget.set(x, 0.9, z);
        this.hasStrafeTarget = true;
        return;
      }

      side *= -1;
      radius *= 0.7;
    }

    this.strafeTarget.copy(this.position);
    this.hasStrafeTarget = true;
  }

  randomPatrolTarget() {
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 14;

      const x = this.position.x + Math.cos(angle) * radius;
      const z = this.position.z + Math.sin(angle) * radius;

      if (this.navGrid.isWalkableWorld(x, z)) {
        return this._tmp.set(x, 0.9, z);
      }
    }

    return this._tmp.copy(this.position);
  }

  findCoverPoint(threatPos) {
    const threatEye = new THREE.Vector3(
      threatPos.x,
      threatPos.y + 0.72,
      threatPos.z
    );

    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 6 + Math.random() * 10;

      const x = this.position.x + Math.cos(angle) * radius;
      const z = this.position.z + Math.sin(angle) * radius;

      if (!this.navGrid.isWalkableWorld(x, z)) {
        continue;
      }

      const candidateEye = new THREE.Vector3(x, 1.2, z);

      if (!this.canSeePointFrom(threatEye, candidateEye)) {
        return new THREE.Vector3(x, 0.9, z);
      }
    }

    return null;
  }

  moveToTarget(target, speed, walk) {
    if (!target) {
      this.velocity.set(0, 0, 0);
      return;
    }

    if (
      !this.path ||
      this.currentMoveTarget.distanceTo(target) > 0.75
    ) {
      this.currentMoveTarget.copy(target);
      this.path = this.navGrid.findPath(this.position, target);
      this.pathIndex = 0;
    }

    if (!this.path || this.path.length === 0) {
      this._moveDir.copy(target).sub(this.position).setY(0);

      if (this._moveDir.lengthSq() > 0.04) {
        this._moveDir.normalize();

        this.velocity.x = this._moveDir.x * speed;
        this.velocity.z = this._moveDir.z * speed;
      } else {
        this.velocity.set(0, 0, 0);
      }

      return;
    }

    if (this.pathIndex >= this.path.length) {
      this.velocity.set(0, 0, 0);
      return;
    }

    const next = this.path[this.pathIndex];

    this._tmp.set(next.x, this.position.y, next.z);

    const dist = this._tmp.distanceTo(this.position);

    if (dist < 0.35) {
      this.pathIndex++;

      if (this.pathIndex >= this.path.length) {
        this.velocity.set(0, 0, 0);
        return;
      }

      const nextAfter = this.path[this.pathIndex];
      this._tmp.set(nextAfter.x, this.position.y, nextAfter.z);
    }

    this._moveDir.copy(this._tmp).sub(this.position).setY(0);

    if (this._moveDir.lengthSq() < 0.0001) {
      this.velocity.set(0, 0, 0);
      return;
    }

    this._moveDir.normalize();

    this.velocity.x = this._moveDir.x * speed;
    this.velocity.z = this._moveDir.z * speed;

    if (!walk && speed > 3.2) {
      this.makeNoise(0.5);
    }
  }

  tryShoot() {
    if (!this.playerVisible) return;
    if (this.reactTimer > 0) return;
    if (this.fireCooldown > 0) return;

    const dist = this.distanceToPlayer;

    this.fireCooldown =
      dist < 10
        ? 0.12 + Math.random() * 0.08
        : 0.22 + Math.random() * 0.18;

    const origin = this.getMuzzlePosition().clone();
    const target = this.player.getEyePosition().clone();

    const spread =
      dist < 8 ? 0.06 : dist < 20 ? 0.035 : 0.02;

    target.x += (Math.random() - 0.5) * spread * dist;
    target.y += (Math.random() - 0.5) * spread * dist * 0.6;
    target.z += (Math.random() - 0.5) * spread * dist;

    const dir = target.clone().sub(origin);
    const maxDist = dir.length();

    if (maxDist < 0.001) return;

    dir.normalize();

    const result = this.raycastToPlayer(origin, dir, maxDist);

    if (result.hitPlayer) {
      let damage = 12;

      if (dist < 10) {
        damage = 20;
      } else if (dist < 25) {
        damage = 16;
      }

      this.onPlayerDamage?.(damage);
    }

    if (this.weaponManager?.spawnTracer) {
      this.weaponManager.spawnTracer(origin, result.end);
    }

    this.makeNoise(1.5);
  }

  updatePhysics(dt) {
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y = 0.9;

    if (this.navGrid && !this.navGrid.isWalkableWorld(this.position.x, this.position.z)) {
      const nearest = this.navGrid.findNearestWalkable(
        this.position.x,
        this.position.z,
        4
      );

      if (nearest) {
        this.position.x = nearest.x;
        this.position.z = nearest.z;
      }
    }

    if (this.body?.setNextKinematicTranslation) {
      this.body.setNextKinematicTranslation({
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      });
    }
  }

  syncMesh() {
    if (!this.mesh) return;

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;
  }

  get distanceToTarget() {
    if (!this.currentMoveTarget) {
      return Infinity;
    }

    return this.currentMoveTarget.distanceTo(this.position);
  }
}
