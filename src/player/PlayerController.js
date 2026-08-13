import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { SurfaceMaterial } from '../physics.js';
import { detectSurface } from '../engine/SurfaceDetector.js';

/**
 * Базовые параметры движения.
 *
 * Это не финальный баланс CS 1.6, но уже близкий по ощущению каркас:
 * - runSpeed ~ 6.4 m/s (примерно 250 units/s);
 * - walkSpeed — тихий шаг;
 * - crouchSpeed — присед;
 * - airAcceleration — для air strafing;
 * - friction — для остановки на земле.
 */
const MOVE = Object.freeze({
  radius: 0.3,

  heightStand: 1.8,
  heightCrouch: 1.05,

  eyeHeightStand: 1.62,
  eyeHeightCrouch: 0.95,

  runSpeed: 7.0,
  walkSpeed: 2.4,
  crouchSpeed: 1.7,

  groundAcceleration: 6.2,
  airAcceleration: 100,

  /**
   * airWishSpeed — кеп air wishspeed для addspeed.
   * У GoldSrc / CS 1.6 це 30 ups, що дає блискавичний
   * air acceleration і характерний стрейф.
   */
  airWishSpeed: 30,

  friction: 4.5,
  stopSpeed: 1.0,

  gravity: 19.62,
  jumpSpeed: 7.7,

  /**
   * groundStick слегка тянет игрока вниз, когда он на земле,
   * чтобы character controller стабильно считал grounded.
   */
  groundStick: 0.45,

  maxFallSpeed: 55,

  /**
   * Ограничение максимальной скорости в воздухе,
   * чтобы bhop не уходил в бесконечный разгон.
   * ~14 m/s ≈ 551 ups, дозволяє bhop вище runSpeed, але не безмежно.
   */
  maxAirSpeed: 14,

  mouseSensitivity: 0.0022,

  bobRun: 0.035,
  bobWalk: 0.02,
  bobCrouch: 0.014
});

export class PlayerController {
  constructor({
    physics,
    input,
    camera,
    audio = null,
    spawn = {
      x: 0,
      y: 2.2,
      z: 8
    }
  }) {
    if (!physics?.world) {
      throw new Error('PlayerController: physics.world is not ready.');
    }

    this.physics = physics;
    this.input = input;
    this.camera = camera;
    this.audio = audio;
    this.stepAccumulator = 0;
    this.surfaceMaterial = 'concrete';
    this.surfaceCheckTimer = 0;

    this.velocity = new THREE.Vector3(0, 0, 0);

    this.position = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.prevPosition = this.position.clone();

    this._renderPosition = new THREE.Vector3();
    this._direction = new THREE.Vector3();

    this.yaw = 0;
    this.pitch = 0;

    this.recoilPitch = 0;
    this.recoilYaw = 0;

    this.grounded = false;
    this.crouched = false;

    this.currentHeight = MOVE.heightStand;
    this.halfHeight = this.totalToHalf(this.currentHeight);

    this.currentEyeHeight = MOVE.eyeHeightStand;

    this.bobPhase = 0;
    this.bobAmp = 0;

    this.wasGrounded = false;
    this.landDip = 0;

    this.camera.rotation.order = 'YXZ';

    this.createBody(spawn);
    this.createController();
  }

  createBody(spawn) {
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      spawn.x,
      spawn.y,
      spawn.z
    );

    this.body = this.physics.world.createRigidBody(bodyDesc);

    if (typeof this.body.setCcdEnabled === 'function') {
      this.body.setCcdEnabled(true);
    }

    this.collider = this.createCollider(this.halfHeight);

    this.physics.bodyMeta.set(this.body.handle, {
      player: true,
      material: SurfaceMaterial.FLESH
    });
  }

  createCollider(halfHeight) {
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, MOVE.radius)
      .setFriction(0)
      .setRestitution(0)
      .setTranslation(0, 0, 0);

    const collider = this.physics.world.createCollider(colliderDesc, this.body);

    this.physics.colliderMeta.set(collider.handle, {
      player: true,
      material: SurfaceMaterial.FLESH
    });

    return collider;
  }

  createController() {
    this.controller = this.physics.createCharacterController(0.06);

    if (!this.controller) {
      console.warn('[PlayerController] Character controller was not created.');
      return;
    }

    if (typeof this.controller.setUp === 'function') {
      this.controller.setUp({
        x: 0,
        y: 1,
        z: 0
      });
    }

    if (typeof this.controller.setSlideEnabled === 'function') {
      this.controller.setSlideEnabled(true);
    }

    /**
     * Autostep: у цій версії Rapier autostep спричиняє NaN у фізиці
     * (перевірено в Node), тому НЕ вмикаємо його. Сходи долаються стрибками.
     */
    if ('autostepMaxHeight' in this.controller) {
      this.controller.autostepMaxHeight = 0.5;
    }

    if ('autostepMinWidth' in this.controller) {
      this.controller.autostepMinWidth = 0.1;
    }

    if (typeof this.controller.disableAutostep === 'function') {
      this.controller.disableAutostep();
    }

    if ('snapToGroundDistance' in this.controller) {
      this.controller.snapToGroundDistance = 0.25;
    }

    if (typeof this.controller.enableSnapToGround === 'function') {
      this.controller.enableSnapToGround();
    }

    if (typeof this.controller.setMaxSlopeClimbAngle === 'function') {
      this.controller.setMaxSlopeClimbAngle(0.785);
    }

    if (typeof this.controller.setMinSlopeSlideAngle === 'function') {
      this.controller.setMinSlopeSlideAngle(0.785);
    }

    if (typeof this.controller.setApplyImpulsesToDynamicBodies === 'function') {
      this.controller.setApplyImpulsesToDynamicBodies(true);
    }

    if (typeof this.controller.setCharacterMass === 'function') {
      this.controller.setCharacterMass(80);
    }
  }

  totalToHalf(totalHeight) {
    return Math.max(0.0001, totalHeight * 0.5 - MOVE.radius);
  }

  /**
   * Смена высоты капсулы.
   *
   * keepFeet = true:
   *   используется на земле, чтобы ноги оставались на полу.
   *
   * keepFeet = false:
   *   используется в воздухе для crouch-jump.
   *   Центр остаётся примерно тем же, а "ноги" поджимаются вверх.
   */
  setHeight(totalHeight, keepFeet) {
    if (!this.body || !this.collider) return;

    if (Math.abs(totalHeight - this.currentHeight) < 0.001) {
      return;
    }

    const oldHeight = this.currentHeight;
    const oldPos = this.body.translation();

    let newY = oldPos.y;

    if (keepFeet) {
      newY -= (oldHeight - totalHeight) * 0.5;
    }

    const oldCollider = this.collider;

    this.physics.colliderMeta.delete(oldCollider.handle);

    try {
      if (typeof this.physics.world.removeCollider === 'function') {
        this.physics.world.removeCollider(oldCollider, true);
      }
    } catch (error) {
      console.warn('[PlayerController] Failed to remove old collider:', error);
    }

    this.currentHeight = totalHeight;
    this.halfHeight = this.totalToHalf(this.currentHeight);

    this.collider = this.createCollider(this.halfHeight);

    const newPos = {
      x: oldPos.x,
      y: newY,
      z: oldPos.z
    };

    if (typeof this.body.setTranslation === 'function') {
      this.body.setTranslation(newPos, true);
    }

    this.position.set(newPos.x, newPos.y, newPos.z);
    this.prevPosition.copy(this.position);
  }

  canStand() {
    if (!this.collider) return true;

    const distance = MOVE.heightStand - this.currentHeight + 0.1;

    if (distance <= 0.05) {
      return true;
    }

    const pos = this.body.translation();

    const origin = {
      x: pos.x,
      y: pos.y + this.currentHeight * 0.5 - 0.05,
      z: pos.z
    };

    const hit = this.physics.raycast(
      origin,
      {
        x: 0,
        y: 1,
        z: 0
      },
      distance,
      this.collider
    );

    return !hit;
  }

  updateCrouch() {
    const wantCrouch =
      this.input.isDown('ControlLeft') ||
      this.input.isDown('ControlRight') ||
      this.input.isDown('KeyC');

    if (wantCrouch && !this.crouched) {
      this.crouched = true;

      /**
       * На земле сохраняем положение ног.
       * В воздухе сохраняем центр, чтобы получить crouch-jump tuck.
       */
      this.setHeight(MOVE.heightCrouch, this.grounded);
    } else if (!wantCrouch && this.crouched) {
      if (this.canStand()) {
        this.crouched = false;
        this.setHeight(MOVE.heightStand, this.grounded);
      }
    }
  }

  getWishdir() {
    let forward = 0;
    let right = 0;

    if (this.input.isDown('KeyW') || this.input.isDown('ArrowUp')) {
      forward += 1;
    }

    if (this.input.isDown('KeyS') || this.input.isDown('ArrowDown')) {
      forward -= 1;
    }

    if (this.input.isDown('KeyD') || this.input.isDown('ArrowRight')) {
      right += 1;
    }

    if (this.input.isDown('KeyA') || this.input.isDown('ArrowLeft')) {
      right -= 1;
    }

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    /**
     * Three.js camera при yaw = 0 смотрит в -Z.
     */
    const forwardX = -sin;
    const forwardZ = -cos;

    const rightX = cos;
    const rightZ = -sin;

    let x = forwardX * forward + rightX * right;
    let z = forwardZ * forward + rightZ * right;

    const len = Math.hypot(x, z);

    if (len > 1) {
      x /= len;
      z /= len;
    }

    return {
      x,
      z,
      len: Math.min(len, 1)
    };
  }

  getMaxWishSpeed() {
    if (this.crouched) {
      return MOVE.crouchSpeed;
    }

    const walking =
      this.input.isDown('ShiftLeft') ||
      this.input.isDown('ShiftRight');

    if (walking) {
      return MOVE.walkSpeed;
    }

    /**
     * Швидкість руху залежить від поточної зброї: knife/crowbar
     * дозволяють бігати швидше (CS 1.6: ~250 units/s з ножем,
     * ~210 з AK). Якщо multiplier не встановлено — базова швидкість.
     */
    const multiplier = this.speedMultiplier ?? 1;

    return MOVE.runSpeed * multiplier;
  }

  applyFriction(dt) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);

    if (speed < 0.05) {
      this.velocity.x = 0;
      this.velocity.z = 0;
      return;
    }

    const control = speed < MOVE.stopSpeed ? MOVE.stopSpeed : speed;
    const drop = control * MOVE.friction * dt;

    let newSpeed = Math.max(speed - drop, 0) / speed;

    this.velocity.x *= newSpeed;
    this.velocity.z *= newSpeed;
  }

  accelerate(wishdir, wishspeed, accel, dt) {
    if (wishspeed <= 0) return;

    const currentSpeed =
      this.velocity.x * wishdir.x +
      this.velocity.z * wishdir.z;

    const addSpeed = wishspeed - currentSpeed;

    if (addSpeed <= 0) return;

    let accelSpeed = accel * wishspeed * dt;

    if (accelSpeed > addSpeed) {
      accelSpeed = addSpeed;
    }

    this.velocity.x += accelSpeed * wishdir.x;
    this.velocity.z += accelSpeed * wishdir.z;
  }

  clampHorizontal(maxSpeed) {
    if (maxSpeed <= 0) return;

    const speed = Math.hypot(this.velocity.x, this.velocity.z);

    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    }
  }

  /**
   * fixedUpdate вызывается на каждый фиксированный шаг физики.
   */
  fixedUpdate(dt) {
    if (!this.body || !this.collider || !this.controller) return;

    if (typeof this.controller.computeColliderMovement !== 'function') {
      return;
    }

    this.updateCrouch();

    const wishdir = this.getWishdir();
    const maxWishSpeed = this.getMaxWishSpeed();

    const jumpPressed = this.input.isDown('Space');

    let jumped = false;

    /**
     * Bunny hop:
     * если Space зажат и игрок на земле — сразу прыгаем.
     */
    if (jumpPressed && this.grounded) {
      this.velocity.y = MOVE.jumpSpeed;
      this.grounded = false;
      jumped = true;

      this.audio?.playJump?.();
    }

    const groundedForMovement = this.grounded && !jumped;

    if (groundedForMovement) {
      this.applyFriction(dt);
    }

    if (wishdir.len > 0.001 && maxWishSpeed > 0.001) {
      if (groundedForMovement) {
        this.accelerate(
          wishdir,
          maxWishSpeed,
          MOVE.groundAcceleration,
          dt
        );

        this.clampHorizontal(maxWishSpeed * 1.15);
      } else {
        const airWishSpeed = Math.min(maxWishSpeed, MOVE.airWishSpeed);

        this.accelerate(
          wishdir,
          airWishSpeed,
          MOVE.airAcceleration,
          dt
        );

        this.clampHorizontal(MOVE.maxAirSpeed);
      }
    }

    if (groundedForMovement) {
      this.velocity.y = -MOVE.groundStick;
    } else {
      this.velocity.y -= MOVE.gravity * dt;

      if (this.velocity.y < -MOVE.maxFallSpeed) {
        this.velocity.y = -MOVE.maxFallSpeed;
      }
    }

    const fallSpeed = this.velocity.y;

    const desiredMove = {
      x: this.velocity.x * dt,
      y: this.velocity.y * dt,
      z: this.velocity.z * dt
    };

    let corrected = this.computeMovementWithStep(desiredMove, dt);

    this.prevPosition.copy(this.position);

    const oldPos = this.body.translation();

    const newPos = {
      x: oldPos.x + corrected.x,
      y: oldPos.y + corrected.y,
      z: oldPos.z + corrected.z
    };

    if (typeof this.body.setNextKinematicTranslation === 'function') {
      this.body.setNextKinematicTranslation(newPos);
    } else if (typeof this.body.setTranslation === 'function') {
      this.body.setTranslation(newPos, true);
    }

    this.position.set(newPos.x, newPos.y, newPos.z);

    const computedGrounded =
      typeof this.controller.computedGrounded === 'function'
        ? this.controller.computedGrounded()
        : false;

    this.grounded = computedGrounded && this.velocity.y <= 0.01;

    if (!this.wasGrounded && this.grounded && fallSpeed < -5) {
      const impact = Math.min(1, Math.abs(fallSpeed) / 18);

      this.audio?.playLand?.(impact);
      this.landDip = Math.min(0.14, Math.abs(fallSpeed) * 0.012);
    }

    this.wasGrounded = this.grounded;

    if (this.grounded && this.velocity.y < 0) {
      this.velocity.y = -MOVE.groundStick;
    }
  }

  /**
   * Рух з ручним step-up: Rapier autostep у цій версії не працює (NaN),
   * тому коли капсула впирається в низьку перешкоду (сходинку),
   * піднімаємо її на STEP_HEIGHT і повторюємо рух.
   */
  computeMovementWithStep(desiredMove, dt) {
    const STEP_HEIGHT = 0.55;
    const stepCheck = (move) => {
      this.controller.computeColliderMovement(this.collider, move);
      return typeof this.controller.computedMovement === 'function'
        ? this.controller.computedMovement()
        : move;
    };

    let corrected = stepCheck(desiredMove);

    const wantX = Math.abs(desiredMove.x);
    const wantZ = Math.abs(desiredMove.z);
    const gotX = Math.abs(corrected.x);
    const gotZ = Math.abs(corrected.z);

    const blockedHoriz =
      (wantX > 0.0005 && gotX < wantX * 0.5) ||
      (wantZ > 0.0005 && gotZ < wantZ * 0.5);

    const wantY = desiredMove.y;
    const falling = wantY < -0.08;

    if (!blockedHoriz || falling) {
      return corrected;
    }

    /**
     * Спробувати «крок»: підняти капсулу, зробити рух, опустити.
     */
    const up = { x: 0, y: STEP_HEIGHT, z: 0 };
    const upCorrected = stepCheck(up);

    if (Math.abs(upCorrected.y) < STEP_HEIGHT * 0.6) {
      return corrected;
    }

    const lifted = { ...desiredMove, y: 0 };
    const moveCorrected = stepCheck(lifted);

    const down = { x: 0, y: -STEP_HEIGHT * 1.2, z: 0 };
    const downCorrected = stepCheck(down);

    const result = {
      x: upCorrected.x + moveCorrected.x + downCorrected.x,
      y: upCorrected.y + moveCorrected.y + downCorrected.y,
      z: upCorrected.z + moveCorrected.z + downCorrected.z
    };

    if (
      Math.abs(result.x) < gotX - 0.0001 ||
      Math.abs(result.z) < gotZ - 0.0001
    ) {
      return corrected;
    }

    return result;
  }

  /**
   * update вызывается каждый рендер-кадр.
   * Здесь: мышь, отдача, интерполяция позиции, view bobbing.
   */
  update(dt, alpha = 1) {
    const mouse = this.input.consumeMouseDelta();

    const sens =
      MOVE.mouseSensitivity * (this.sensitivityMultiplier ?? 1);

    this.yaw -= mouse.x * sens;
    this.pitch -= mouse.y * sens;

    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.55, 1.55);

    /**
     * Recovery отдачи.
     * Позже оружие будет управлять этим точнее.
     */
    this.recoilPitch = THREE.MathUtils.lerp(
      this.recoilPitch,
      0,
      Math.min(1, dt * 7)
    );

    this.recoilYaw = THREE.MathUtils.lerp(
      this.recoilYaw,
      0,
      Math.min(1, dt * 7)
    );

    this._renderPosition
      .copy(this.prevPosition)
      .lerp(this.position, alpha);

    const targetEyeHeight = this.crouched
      ? MOVE.eyeHeightCrouch
      : MOVE.eyeHeightStand;

    this.currentEyeHeight = THREE.MathUtils.lerp(
      this.currentEyeHeight,
      targetEyeHeight,
      Math.min(1, dt * 12)
    );

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);

    let targetBobAmp = 0;

    if (this.grounded && horizontalSpeed > 0.4) {
      const ratio = Math.min(horizontalSpeed / MOVE.runSpeed, 1);

      if (this.crouched) {
        targetBobAmp = MOVE.bobCrouch * ratio;
      } else if (
        this.input.isDown('ShiftLeft') ||
        this.input.isDown('ShiftRight')
      ) {
        targetBobAmp = MOVE.bobWalk * ratio;
      } else {
        targetBobAmp = MOVE.bobRun * ratio;
      }
    }

    this.bobAmp = THREE.MathUtils.lerp(
      this.bobAmp,
      targetBobAmp,
      Math.min(1, dt * 10)
    );

    this.bobPhase += dt * (5 + horizontalSpeed * 1.35);

    if (this.audio && this.grounded && horizontalSpeed > 0.5) {
      this.stepAccumulator += dt * horizontalSpeed;

      if (this.stepAccumulator >= 2.3) {
        this.stepAccumulator = 0;

        const walking =
          this.input.isDown('ShiftLeft') ||
          this.input.isDown('ShiftRight');

        /**
         * Перевіряємо матеріал під ногами не щокроку,
         * а раз на 4 кроки — це дешево.
         */
        this.surfaceCheckTimer -= 1;

        if (this.surfaceCheckTimer <= 0) {
          this.surfaceCheckTimer = 4;

          this.surfaceMaterial = detectSurface(
            this.physics,
            this.position,
            this.currentHeight
          );
        }

        this.audio.playFootstep({
          surface: this.surfaceMaterial,
          crouched: this.crouched,
          walking
        });
      }
    }

    const bobY = Math.sin(this.bobPhase * 2) * this.bobAmp;
    const bobX = Math.cos(this.bobPhase) * this.bobAmp * 0.55;

    this.landDip = Math.max(0, this.landDip - dt * 0.55);

    this.camera.position.copy(this._renderPosition);
    this.camera.position.y += this.currentEyeHeight + bobY - this.landDip;

    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    this.camera.position.x += rightX * bobX;
    this.camera.position.z += rightZ * bobX;

    this.camera.rotation.set(
      this.pitch + this.recoilPitch,
      this.yaw + this.recoilYaw,
      0,
      'YXZ'
    );
  }

  addRecoil(pitch, yaw = 0) {
    this.recoilPitch = THREE.MathUtils.clamp(
      this.recoilPitch + pitch,
      -0.7,
      0.7
    );

    this.recoilYaw = THREE.MathUtils.clamp(
      this.recoilYaw + yaw,
      -0.45,
      0.45
    );
  }

  getEyePosition() {
    return this.camera.position.clone();
  }

  getDirection() {
    this.camera.getWorldDirection(this._direction);
    return this._direction.clone();
  }

  getState() {
    return {
      grounded: this.grounded,
      crouched: this.crouched,
      speed: Math.hypot(this.velocity.x, this.velocity.z),
      velocity: this.velocity.clone(),
      position: this.position.clone()
    };
  }

  dispose() {
    if (this.body && this.physics?.world) {
      this.physics.removeBody(this.body);
    }

    this.body = null;
    this.collider = null;
    this.controller = null;
  }
}
