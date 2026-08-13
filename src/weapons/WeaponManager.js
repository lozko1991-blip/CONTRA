import * as THREE from 'three';
import { HitScan } from './HitScan.js';
import { createAK47 } from './defs/AK47.js';
import { createM4A1 } from './defs/M4A1.js';
import { createDesertEagle } from './defs/DesertEagle.js';
import { createKnife } from './defs/Knife.js';
import { createCrowbar } from './defs/Crowbar.js';

/**
 * Базова швидкість бігу (units/s), від якої рахуємо множник
 * для різної зброї: knife/crowbar — швидше, важка зброя — повільніше.
 */
const MOVE_BASE_RUN_SPEED = 6.4;

/**
 * WeaponManager:
 * - хранит оружие;
 * - переключает оружие;
 * - обрабатывает стрельбу;
 * - считает spread;
 * - применяет recoil pattern;
 * - создаёт трассеры;
 * - отправляет событие weapon:hit.
 */
export class WeaponManager {
  constructor({
    physics,
    player,
    input,
    camera,
    scene,
    audio = null,
    decals = null
  }) {
    this.physics = physics;
    this.player = player;
    this.input = input;
    this.camera = camera;
    this.scene = scene;

    this.audio = audio;
    this.decals = decals;

    this.flashIntensity = 0;
    this.flashLight = new THREE.PointLight(0xffc86b, 0, 10, 2);
    this.flashLight.castShadow = false;
    this.scene.add(this.flashLight);

    /**
     * Muzzle flash — круглий м'який спалах (Sprite + радіальний градієнт),
     * щоб не було квадратів від площини.
     */
    const flashCanvas = document.createElement('canvas');
    flashCanvas.width = 64;
    flashCanvas.height = 64;
    const fctx = flashCanvas.getContext('2d');
    const fgrad = fctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    fgrad.addColorStop(0, 'rgba(255, 245, 200, 1)');
    fgrad.addColorStop(0.35, 'rgba(255, 210, 120, 0.9)');
    fgrad.addColorStop(0.7, 'rgba(255, 150, 50, 0.35)');
    fgrad.addColorStop(1, 'rgba(255, 120, 30, 0)');
    fctx.fillStyle = fgrad;
    fctx.fillRect(0, 0, 64, 64);

    const flashTexture = new THREE.CanvasTexture(flashCanvas);

    this.flashSpriteMat = new THREE.SpriteMaterial({
      map: flashTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.flashSprite = new THREE.Sprite(this.flashSpriteMat);

    this.flashSprite.scale.set(0.5, 0.5, 1);
    this.flashSprite.frustumCulled = false;
    this.flashSprite.renderOrder = 998;
    this.flashSprite.visible = false;
    this.scene.add(this.flashSprite);

    this.flashSpriteTime = 0;

    this.hitScan = new HitScan(this.physics);

    this.weapons = {
      ak47: createAK47(),
      m4a1: createM4A1(),
      deagle: createDesertEagle(),
      knife: createKnife(),
      crowbar: createCrowbar()
    };

    this.current = this.weapons.ak47;

    this.enabled = true;

    this.tracers = [];

    this.semiReleased = true;
    this.rmbHeld = false;
    this.zoomActive = false;

    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.recoilDelay = 0;

    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._spreadDir = new THREE.Vector3();

    this._start = new THREE.Vector3();
    this._end = new THREE.Vector3();
  }

  update(dt) {
    if (!this.current) return;

    this.current.update(dt);

    this.updateWeaponSwitch();
    this.updateSuppressor();

    const wasReloading = this.current.reloading;

    this.updateFiring();

    /**
     * Оновлюємо швидкість щокадру: сповільнення під час
     * стрільби працює динамічно (cooldown змінюється).
     */
    this.updatePlayerSpeed();

    if (!wasReloading && this.current.reloading) {
      this.audio?.playReload();
      this.viewModel?.startReload?.(this.current.reloadTime);
    }

    this.dryFireCooldown = (this.dryFireCooldown ?? 0) - dt;

    if (
      this.enabled &&
      this.input.pointerLocked &&
      this.input.isMouseDown(0) &&
      !this.current.reloading &&
      this.current.magazine === 0 &&
      this.dryFireCooldown <= 0
    ) {
      this.audio?.playDryFire();
      this.dryFireCooldown = 0.25;
    }

    if (this.flashLight) {
      this.flashIntensity = Math.max(
        0,
        this.flashIntensity - dt * 30
      );

      this.flashLight.intensity = this.flashIntensity;
    }

    if (this.flashSprite) {
      this.flashSpriteTime = Math.max(0, this.flashSpriteTime - dt);

      if (this.flashSpriteTime <= 0) {
        this.flashSprite.visible = false;
        this.flashSpriteMat.opacity = 0;
      }
    }

    this.updateRecoil(dt);
    this.updateTracers(dt);

    this.applyRecoilToCamera();
  }

  updateWeaponSwitch() {
    if (this.input.isDown('Digit1')) {
      this.selectWeapon('ak47');
    } else if (this.input.isDown('Digit2')) {
      this.selectWeapon('m4a1');
    } else if (this.input.isDown('Digit3')) {
      this.selectWeapon('deagle');
    } else if (this.input.isDown('Digit4')) {
      this.selectWeapon('knife');
    } else if (this.input.isDown('Digit5')) {
      this.selectWeapon('crowbar');
    }
  }

  /**
   * Mouse wheel: cycle through all weapons + grenades.
   * direction: 1 = scroll up (previous), -1 = scroll down (next)
   */
  cycleWeapon(direction = -1) {
    const order = ['ak47', 'm4a1', 'deagle', 'knife', 'crowbar'];

    const grenades = [];

    if (this.grenadeManager) {
      for (const type of ['he', 'flash', 'smoke']) {
        if ((this.grenadeManager.inventory[type] ?? 0) > 0) {
          grenades.push(type);
        }
      }
    }

    const all = [...order, ...grenades];

    if (all.length === 0) return;

    const currentGrenade = this.grenadeManager?.selected;
    const currentId = currentGrenade || this.current?.id;
    let idx = all.indexOf(currentId);

    if (idx === -1) idx = 0;

    let newIdx = (idx + (direction > 0 ? 1 : -1) + all.length) % all.length;
    const next = all[newIdx];

    if (next === 'he' || next === 'flash' || next === 'smoke') {
      this.grenadeManager.selected = next;
    } else {
      this.grenadeManager.selected = null;
      this.selectWeapon(next);
    }
  }

  selectWeapon(id) {
    const next = this.weapons[id];

    if (!next) return;
    if (this.current === next) return;

    /**
     * При смені зброї скидаємо progress перезарядки і квотаєм
     * віддачу.
     */
    if (this.current) {
      this.current.reloading = false;
      this.current.reloadTimer = 0;
    }

    this.current = next;

    this.current.cooldown = Math.max(this.current.cooldown, 0.08);
    this.current.shotsFired = 0;

    this.semiReleased = true;

    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.recoilDelay = 0;

    /**
     * Швидкість руху залежить від зброї (knife/crowbar швидше,
     * важка зброя — повільніше). multiplier = runSpeed / 6.4,
     * де runSpeed зберігається в дефініції зброї.
     */
    this.updatePlayerSpeed();

    this.viewModel?.setWeapon?.(id);

    if (this.grenadeManager) {
      this.grenadeManager.selected = null;
    }
  }

  /**
   * Швидкість руху залежить від поточної зброї:
   * - knife: 8.0 / 6.4 ≈ 1.25x
   * - crowbar: 7.4 / 6.4 ≈ 1.16x
   * - deagle/m4/ak: 6.4 / 6.4 = 1.0x
   * Під час стрільби трохи сповільнюємось.
   */
  updatePlayerSpeed() {
    if (!this.player) return;

    const weaponRunSpeed = this.current?.runSpeed ?? 6.4;
    let multiplier = weaponRunSpeed / MOVE_BASE_RUN_SPEED;

    /**
     * Під час стрільби швидкість знижується на ~15%,
     * як у CS 1.6.
     */
    if (this.current?.cooldown > 0 && this.current?.automatic) {
      multiplier *= 0.85;
    }

    this.player.speedMultiplier = multiplier;
  }

  /**
   * Авто-перемикання на запасну зброю, коли в поточній
   * закінчились і магазин, і резерв (як у CS 1.6).
   */
  autoSwitchOnEmpty() {
    const candidates = ['deagle', 'm4a1', 'ak47'];

    for (const id of candidates) {
      const weapon = this.weapons[id];

      if (!weapon || weapon === this.current) continue;
      if (weapon.magazine > 0 || weapon.reserve > 0) {
        this.selectWeapon(id);
        return;
      }
    }
  }

  /**
   * Удар мілі-зброєю (ніж / ломик).
   * Близький raycast, backstab ×2 для ножа,
   * ломик — просто важкий удар.
   */
  meleeStrike() {
    const origin = this.player.getEyePosition();
    const direction = this.player.getDirection();
    const range = this.current.range;

    this._start.copy(origin);
    this._end
      .copy(origin)
      .addScaledVector(direction, range);

    const hits = this.hitScan.trace(origin, direction, range, this.player.collider, 0);

    if (hits.length > 0) {
      this._end.set(
        hits[0].point.x,
        hits[0].point.y,
        hits[0].point.z
      );
    }

    if (this.flashSprite) {
      this.flashSprite.visible = false;
    }

    this.viewModel?.kickShot?.();

    for (const hit of hits) {
      const ud = hit.userData ?? {};

      if (ud.player || ud.remotePlayer || ud.hostBot || ud.clientBot) {
        const target =
          ud.player || ud.remotePlayer || ud.hostBot || ud.clientBot;
        const targetPos = target.position ?? hit.point;

        const toTarget = {
          x: targetPos.x - origin.x,
          z: targetPos.z - origin.z
        };

        const facing =
          toTarget.x * direction.x + toTarget.z * direction.z;

        const isKnife = this.current.id === 'knife';
        const backstab = isKnife && facing < -0.35;

        let damage = this.current.damage * (backstab ? 2 : 1);

        if (ud.hitZone === 'head') {
          damage *= this.current.headshotMultiplier;
        }

        this.emitHit(hit, Math.round(damage));

        this.audio?.playHitMarker?.(ud.hitZone === 'head');

        return;
      }
    }
  }

  updateSuppressor() {
    const rmb =
      this.input.pointerLocked &&
      this.input.isMouseDown(2);

    this.zoomActive = !!rmb;

    if (rmb && !this.rmbHeld) {
      this.current.toggleSuppressor?.();
      this.viewModel?.setSuppressed?.(this.current.suppressed);
      this.rmbHeld = true;
    } else if (!rmb) {
      this.rmbHeld = false;
    }
  }

  updateFiring() {
    if (this.input.pointerLocked && this.input.isDown('KeyR')) {
      this.current.startReload();
    }

    const lmb =
      this.input.pointerLocked &&
      this.input.isMouseDown(0);

    if (this.grenadeManager?.selected) {
      return;
    }

    if (!lmb) {
      this.semiReleased = true;
      return;
    }

    if (this.current.automatic) {
      if (this.current.canFire()) {
        this.fire();
      } else if (this.current.magazine === 0 && this.current.reserve > 0) {
        this.current.startReload();
      } else if (this.current.magazine === 0 && this.current.reserve <= 0) {
        this.autoSwitchOnEmpty();
      }
    } else {
      if (this.semiReleased && this.current.canFire()) {
        this.fire();
        this.semiReleased = false;
      } else if (this.current.magazine === 0 && this.current.reserve > 0) {
        this.current.startReload();
      } else if (this.current.magazine === 0 && this.current.reserve <= 0) {
        this.autoSwitchOnEmpty();
      }
    }
  }

  fire() {
    if (this.current.knife || this.current.melee) {
      this.meleeStrike();
      return;
    }

    const playerState = this.player.getState();
    const baseDirection = this.player.getDirection();

    const spread = this.current.getCurrentSpread(playerState);
    const direction = this.applySpread(baseDirection, spread);

    const origin = this.player.getEyePosition();

    let maxRange = this.current.range;

    const smokeDistance = this.grenadeManager?.isBlockedBySmoke?.(
      origin,
      direction,
      maxRange
    );

    if (smokeDistance != null) {
      maxRange = Math.max(0.1, smokeDistance);
    }

    const hits = this.hitScan.trace(
      origin,
      direction,
      maxRange,
      this.player.collider,
      this.current.penetrationPower
    );

    if (hits.length > 0) {
      this._end.set(
        hits[0].point.x,
        hits[0].point.y,
        hits[0].point.z
      );
    } else {
      this._end
        .copy(origin)
        .addScaledVector(direction, this.current.range);
    }

    const distance = this._end.distanceTo(origin);

    this._start
      .copy(origin)
      .addScaledVector(direction, Math.min(0.35, distance * 0.5));

    this.spawnTracer(this._start, this._end, this.current.id);

    this.audio?.playShot({
      weaponId: this.current.id,
      suppressed: this.current.suppressed
    });

    try {
      window.dispatchEvent(
        new CustomEvent('weapon:shot', {
          detail: {
            weaponId: this.current.id,
            origin: {
              x: this._start.x,
              y: this._start.y,
              z: this._start.z
            },
            end: {
              x: this._end.x,
              y: this._end.y,
              z: this._end.z
            }
          }
        })
      );
    } catch {
      // CustomEvent может быть недоступен в очень странных окружениях.
    }

    this.viewModel?.kickShot?.();

    if (this.flashLight) {
      this.flashLight.position.copy(this._start);
      this.flashIntensity = this.current.suppressed ? 1.4 : 3.6;
    }

    if (this.flashSprite) {
      this.flashSprite.position.copy(this._start);

      const flashScale = 0.5 + Math.random() * 0.7;

      this.flashSprite.scale.set(flashScale, flashScale, 1);
      this.flashSprite.visible = true;
      this.flashSpriteMat.opacity = this.current.suppressed ? 0.35 : 0.9;
      this.flashSpriteTime = 0.05;
    }

    this.recoilYaw += (Math.random() - 0.5) * 0.0035;

    for (const hit of hits) {
      const damage = this.calculateDamage(hit);

      this.emitHit(hit, damage);

      if (hit.userData?.isDoor) {
        this.doorSystem?.damageDoor?.(hit.userData.doorId, damage);
      }

      /**
       * Якщо влучили у тіло (гравець / бот / flesh) — пуля зупиняється.
       * hitmarker відіграється лише раз.
       */
      const isFlesh =
        hit.userData?.material === 'flesh' ||
        hit.userData?.player ||
        hit.userData?.remotePlayer ||
        hit.userData?.hostBot ||
        hit.userData?.clientBot;

      if (isFlesh) {
        this.audio?.playHitMarker(hit.userData?.hitZone === 'head');
        break;
      }
    }

    const firstHit = hits[0];

    if (firstHit && this.decals && !firstHit.userData?.isDoor) {
      const isFlesh =
        firstHit.userData?.material === 'flesh';

      this.decals.add(
        firstHit.point,
        direction,
        isFlesh ? 'blood' : 'hole'
      );
    }

    for (const hit of hits) {
      const material = hit.userData?.material;

      if (material && material !== 'flesh') {
        this.audio?.playImpact?.({
          material,
          position: hit.point
        });
        break;
      }
    }

    const recoil = this.current.getRecoil();

    this.addRecoil(recoil.pitch, recoil.yaw);

    this.current.consumeAmmo();
  }

  applySpread(baseDirection, spread) {
    const dir = this._spreadDir.copy(baseDirection).normalize();

    this._right.crossVectors(dir, this.camera.up).normalize();
    this._up.crossVectors(this._right, dir).normalize();

    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * spread;

    dir.addScaledVector(this._right, Math.cos(angle) * radius);
    dir.addScaledVector(this._up, Math.sin(angle) * radius);

    return dir.normalize();
  }

  calculateDamage(hit) {
    let damage = this.current.damage;

    const zone = hit.userData?.hitZone;

    if (zone === 'head') {
      damage *= this.current.headshotMultiplier;
    } else if (zone && this.current.zoneMultipliers[zone]) {
      damage *= this.current.zoneMultipliers[zone];
    }

    /**
     * Дальність: куля втрачає енергію.
     */
    const distance = hit.distance ?? 0;
    const falloffFloor = this.current.id === 'deagle' ? 0.72 : 0.85;
    const rangeFalloff =
      1 - (1 - falloffFloor) * Math.min(distance / 60, 1);

    damage *= rangeFalloff;
    damage *= hit.damageMultiplier ?? 1;

    return Math.max(1, Math.round(damage));
  }

  emitHit(hit, damage) {
    if (typeof hit.userData?.applyDamage === 'function') {
      hit.userData.applyDamage(damage, hit);
    }

    try {
      window.dispatchEvent(
        new CustomEvent('weapon:hit', {
          detail: {
            weaponId: this.current.id,
            damage,
            point: hit.point,
            distance: hit.distance,
            userData: hit.userData
          }
        })
      );
    } catch {
      // CustomEvent может быть недоступен в очень странных окружениях.
    }
  }

  addRecoil(pitch, yaw) {
    this.recoilPitch = THREE.MathUtils.clamp(
      this.recoilPitch + pitch,
      -0.75,
      0.75
    );

    this.recoilYaw = THREE.MathUtils.clamp(
      this.recoilYaw + yaw,
      -0.5,
      0.5
    );

    this.recoilDelay = 0.12;
  }

  updateRecoil(dt) {
    if (this.recoilDelay > 0) {
      this.recoilDelay -= dt;
      return;
    }

    const recover = Math.min(1, dt * 8);

    this.recoilPitch = THREE.MathUtils.lerp(
      this.recoilPitch,
      0,
      recover
    );

    this.recoilYaw = THREE.MathUtils.lerp(
      this.recoilYaw,
      0,
      recover
    );

    if (Math.abs(this.recoilPitch) < 0.0001) {
      this.recoilPitch = 0;
    }

    if (Math.abs(this.recoilYaw) < 0.0001) {
      this.recoilYaw = 0;
    }
  }

  applyRecoilToCamera() {
    if (!this.player?.camera) return;

    const extraPitch = (this.player.recoilPitch ?? 0) - this.recoilPitch;
    const extraYaw = (this.player.recoilYaw ?? 0) - this.recoilYaw;

    this.player.recoilPitch = this.recoilPitch + extraPitch;
    this.player.recoilYaw = this.recoilYaw + extraYaw;

    const finalPitch = THREE.MathUtils.clamp(
      this.player.pitch + this.recoilPitch + extraPitch,
      -1.55,
      1.55
    );

    const finalYaw = this.player.yaw + this.recoilYaw + extraYaw;

    this.player.camera.rotation.set(
      finalPitch,
      finalYaw,
      0,
      'YXZ'
    );
  }

  spawnTracer(start, end, weaponId = 'ak47') {
    const tracerColors = {
      ak47: { core: 0xfff3c4, glow: 0xffa04a },
      m4a1: { core: 0xeaffd0, glow: 0x88e06a },
      deagle: { core: 0xfff0d8, glow: 0xffc36a }
    };

    const colors = tracerColors[weaponId] ?? tracerColors.ak47;

    const coreGeo = new THREE.BufferGeometry().setFromPoints([
      start.clone(),
      end.clone()
    ]);

    const coreMat = new THREE.LineBasicMaterial({
      color: colors.core,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: true
    });

    const core = new THREE.Line(coreGeo, coreMat);

    core.frustumCulled = false;
    core.renderOrder = 999;

    this.scene.add(core);

    /**
     * Друга, ширша лінія — світіння.
     */
    const glowGeo = new THREE.BufferGeometry().setFromPoints([
      start.clone(),
      end.clone()
    ]);

    const glowMat = new THREE.LineBasicMaterial({
      color: colors.glow,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      depthTest: true
    });

    const glow = new THREE.Line(glowGeo, glowMat);

    glow.frustumCulled = false;
    glow.renderOrder = 998;

    this.scene.add(glow);

    const tracer = {
      line: core,
      geometry: coreGeo,
      material: coreMat,
      glow,
      glowGeometry: glowGeo,
      glowMaterial: glowMat,
      life: 0.09,
      maxLife: 0.09,
      drift: Math.random() * 0.4
    };

    this.tracers.push(tracer);

    if (this.tracers.length > 60) {
      const old = this.tracers.shift();
      this.removeTracer(old);
    }
  }

  updateTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i];

      tracer.life -= dt;

      const alpha = Math.max(0, tracer.life / tracer.maxLife);

      const flicker = 0.75 + Math.sin(tracer.drift * 40) * 0.2;

      tracer.material.opacity = alpha * 0.95 * flicker;

      if (tracer.glowMaterial) {
        tracer.glowMaterial.opacity = alpha * 0.35 * flicker;
      }

      if (tracer.life <= 0) {
        this.removeTracer(tracer);
        this.tracers.splice(i, 1);
      }
    }
  }

  removeTracer(tracer) {
    if (!tracer) return;

    this.scene.remove(tracer.line);

    tracer.geometry.dispose();
    tracer.material.dispose();

    if (tracer.glow) {
      this.scene.remove(tracer.glow);
      tracer.glowGeometry.dispose();
      tracer.glowMaterial.dispose();
    }
  }

  getHUDState() {
    if (!this.current) return null;

    return {
      weaponId: this.current.id,
      weaponName: this.current.name,
      automatic: this.current.automatic,
      magazine: this.current.magazine,
      reserve: this.current.reserve,
      reloading: this.current.reloading,
      suppressed: this.current.suppressed,
      spread: this.current.getCurrentSpread(
        this.player?.getState?.() ?? {}
      )
    };
  }

  dispose() {
    for (const tracer of this.tracers) {
      this.removeTracer(tracer);
    }

    this.tracers = [];
  }
}
