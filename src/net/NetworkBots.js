import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { teamColor } from './teams.js';
import { detectSurface } from '../engine/SurfaceDetector.js';
import { createSoldierMesh, animateSoldierWalk } from '../engine/SoldierModel.js';
import { createAK47 } from '../weapons/defs/AK47.js';
import { createM4A1 } from '../weapons/defs/M4A1.js';
import { createDesertEagle } from '../weapons/defs/DesertEagle.js';
import { createKnife } from '../weapons/defs/Knife.js';
import { createCrowbar } from '../weapons/defs/Crowbar.js';
import { HitScan } from '../weapons/HitScan.js';


const BOT_ZONES = [
  {
    name: 'head',
    half: [0.16, 0.18, 0.16],
    y: 1.45
  },
  {
    name: 'chest',
    half: [0.26, 0.2, 0.18],
    y: 0.85
  },
  {
    name: 'stomach',
    half: [0.2, 0.12, 0.15],
    y: 0.5
  },
  {
    name: 'legs',
    half: [0.16, 0.32, 0.16],
    y: -0.1
  }
];

function zoneMultiplier(zone) {
  if (zone === 'head') return 4;
  if (zone === 'stomach') return 1.25;
  if (zone === 'legs') return 0.75;

  return 1;
}

/**
 * HostBot — бот, який живе на хості.
 * Хост вважається авторитетом для його health / alive.
 */
class HostBot {
  constructor({
    id,
    name,
    team,
    spawn,
    scene,
    physics,
    navGrid,
    localPlayerId,
    getEnemies,
    getBotAllies,
    onHitPlayer,
    onKill,
    onDamage,
    onShot,
    onStep,
    onThrowGrenade,
    smokeBlock,
    onRadio = null
  }) {
    this.id = id;
    this.name = name;
    this.team = team;

    this.scene = scene;
    this.physics = physics;
    this.navGrid = navGrid;

    this.localPlayerId = localPlayerId;

    this.getEnemies = getEnemies;
    this.onHitPlayer = onHitPlayer;
    this.onKill = onKill;
    this.onDamage = onDamage;
    this.onShot = onShot;
    this.onStep = onStep;
    this.smokeBlock = smokeBlock;
    this.getBotAllies = getBotAllies ?? (() => []);
    this.onThrowGrenade = onThrowGrenade ?? (() => {});
    this.onRadio = onRadio ?? (() => {});
    this.getDoors = null;

    this.position = new THREE.Vector3(
      spawn?.x ?? 0,
      spawn?.y ?? 0.9,
      spawn?.z ?? 0
    );

    this.yaw = Math.random() * Math.PI * 2;

    this.health = 100;
    this.armor = 0;
    this.alive = true;
    this.deathTimer = 0;
    this._dying = 0;

    this.kills = 0;
    this.deaths = 0;

    this.hitFlashTime = 0;

    this.fireCooldown = 1;
    this.stateTimer = 0;
this.reactTimer = 0;
this.previousTargetId = null;
this.currentTargetId = null;
this.lastThreat = new THREE.Vector3();
this.threatTimer = 0;

/**
 * Бот використовує ТАКУ Ж зброю, як гравець:
 * AK47 / M4A1 / Deagle з тими самими damage, патронами,
 * перезарядкою, spread і penetration.
 */
this.weapon = this.pickWeapon();
this.hitScan = new HitScan(this.physics);

/**
 * Мілі-зброя завжди при боті (ніж або ломик).
 */
this.meleeWeapon = Math.random() < 0.6 ? createKnife() : createCrowbar();

this.burstShots = 0;
this.burstPause = 0;

this.coverTimer = 0;
this.grenadeTimer = 0;
this.strafeSign = 1;

this.moveSpeed = 0;
this.prevBodyPos = this.position.clone();

this.flashed = 0;
this.path = [];
this.navTarget = null;
this.pathTimer = 0;

  this.skill = {
    reaction: 0.25,
    spread: 1,
    aggression: 0.7
  };

  /**
   * Складність: easy/medium/hard — глобально впливає
   * на reaction, spread, damage, тактику.
   * Hard = CS-профі, Medium = досвідчений, Easy = новачок.
   */
  this.difficulty = 'medium';
  this.lastKnownEnemy = null;
  this.lastSeenTime = 0;
  this.peekTimer = 0;
  this.peekSide = 1;
  this.holdAngleTimer = 0;
  this.shotsFired = 0;
  this.airborne = false;
  this.money = 800;
  this.aggressorId = null;
  this.aggressorTimer = 0;

/**
 * Роль бота: rusher / camper / support.
 * Впливає на те, як бот поводиться в бою і поза ним.
 */
this.role = 'support';
this.holdPosition = null;
this.lastHeardPos = new THREE.Vector3();
this.heardTimer = 0;
this.zoneIndex = 0;
this.zoneCenter = null;
this.allyHelpTimer = 0;
this.turnSpeed = 5 + Math.random() * 3;
this.grenadeUseTimer = 0;
this.grenadeThrowCooldown = 8 + Math.random() * 10;

    this.body = null;
    this.mesh = null;
    this.colliders = [];

    this.moveTarget = new THREE.Vector3();
    this.strafeTarget = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._next = new THREE.Vector3();
    this._eye = new THREE.Vector3();
    this._muzzle = new THREE.Vector3();
    this._forward = new THREE.Vector3();

    this.createBody();

    this.muzzleFlashTime = 0;
    this.crouching = false;
  }

  pickWeapon() {
    /**
     * Економіка: бідний бот купує Deagle, багатий — AK/M4.
     * Це додає динаміки як у CS — на початку всі з пістолетами,
     * потім докуповують гвинтівки.
     */
    const money = this.money ?? 800;

    if (money < 1600) {
      return createDesertEagle();
    }

    const roll = Math.random();

    if (this.team === 'CT') {
      return roll < 0.6 ? createM4A1() : createAK47();
    }

    return roll < 0.6 ? createAK47() : createM4A1();
  }

  createBody() {
    if (this.body) return;

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(
        this.position.x,
        this.position.y,
        this.position.z
      );

    this.body = this.physics.world.createRigidBody(bodyDesc);

    this.createHitboxes();
    this.createMesh();
  }

  createHitboxes() {
    for (const zone of BOT_ZONES) {
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

      this.colliders.push(collider);

      this.physics.colliderMeta.set(collider.handle, {
        hostBot: this,
        botId: this.id,
        team: this.team,
        material: 'flesh',
        hitZone: zone.name,
        stopsBullet: true,
        applyDamage: (damage, hit) => {
          this.onDamage(
            this,
            damage,
            hit?.userData?.hitZone ?? zone.name
          );
        }
      });
    }
  }

  createMesh() {
    if (this.mesh) return;

    this.mesh = createSoldierMesh(this.team);

    this.bodyMaterial = this.mesh.userData.materials.bodyMat;

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;

    /**
     * Muzzle flash: сфера + point light.
     */
    const flashGeo = new THREE.SphereGeometry(0.1, 4, 3);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    this._flashMesh = new THREE.Mesh(flashGeo, flashMat);
    this._flashMesh.renderOrder = 999;
    this.mesh.add(this._flashMesh);

    this.scene.add(this.mesh);
  }

  setTeam(team) {
    this.team = team;

    if (this.bodyMaterial) {
      this.bodyMaterial.color.setHex(teamColor(team));
    }

    for (const collider of this.colliders) {
      const meta = this.physics.colliderMeta.get(collider.handle);

      if (meta) {
        meta.team = team;
      }
    }
  }

  leadTarget(target) {
    const eye = target.getEyePosition();
    const velocity = target.velocity;

    if (!velocity) {
      return eye.clone();
    }

    const distance = this.position.distanceTo(target.position);
    const leadTime = Math.min(distance / 55, 0.35);

    return new THREE.Vector3(
      eye.x + velocity.x * leadTime,
      eye.y,
      eye.z + velocity.z * leadTime
    );
  }
  nearestGrenade() {
    const grenades = this.getGrenades?.() ?? [];

    let best = null;
    let bestDistance = 7;

    for (const grenade of grenades) {
      if (grenade.type === 'smoke') {
        continue;
      }

      const distance = this.position.distanceTo(grenade.position);

      if (distance < bestDistance) {
        best = grenade;
        bestDistance = distance;
      }
    }

    return best;
  }

  /**
   * Чи стоїть бот у димовій гранаті (або поруч).
   */
  isInSmoke() {
    const grenades = this.getGrenades?.() ?? [];

    for (const grenade of grenades) {
      if (grenade.type !== 'smoke') continue;

      const dist = this.position.distanceTo(grenade.position);

      if (dist < 4.5) {
        return true;
      }
    }

    return false;
  }

  /**
   * Найближча димова граната (для обходу).
   */
  nearestSmoke() {
    const grenades = this.getGrenades?.() ?? [];

    let best = null;
    let bestDistance = 8;

    for (const grenade of grenades) {
      if (grenade.type !== 'smoke') continue;

      const distance = this.position.distanceTo(grenade.position);

      if (distance < bestDistance) {
        best = grenade;
        bestDistance = distance;
      }
    }

    return best;
  }

  findCoverPoint(threatPos) {
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 9;

      const x = this.position.x + Math.cos(angle) * radius;
      const z = this.position.z + Math.sin(angle) * radius;

      if (!this.navGrid.isWalkableWorld(x, z)) {
        continue;
      }

      const eye = {
        x,
        y: this.position.y + 1.55,
        z
      };

      if (!this.canSeeFrom(threatPos, eye)) {
        return new THREE.Vector3(x, this.position.y, z);
      }
    }

    return null;
  }

  /**
   * Camper: точка утримання — walkable місце поруч,
   * звідки видно найбільший «відкритий» простір.
   */
  findHoldPoint() {    let best = null;
    let bestClearance = -1;

    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2 + Math.random() * 6;

      const x = this.position.x + Math.cos(angle) * radius;
      const z = this.position.z + Math.sin(angle) * radius;

      if (!this.navGrid.isWalkableWorld(x, z)) {
        continue;
      }

      let clearance = 0;

      for (let k = 0; k < 8; k++) {
        const lookAngle = (k / 8) * Math.PI * 2;

        const lx = x + Math.cos(lookAngle) * 8;
        const lz = z + Math.sin(lookAngle) * 8;

        if (this.navGrid.isWalkableWorld(lx, lz)) {
          clearance++;
        }
      }

      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = new THREE.Vector3(x, this.position.y, z);
      }
    }

    return best ?? this.position.clone();
  }

  canSeeFrom(from, to) {
    const origin = {
      x: from.x,
      y: from.y + 0.6,
      z: from.z
    };

    const dx = to.x - origin.x;
    const dy = to.y - origin.y;
    const dz = to.z - origin.z;

    const distance = Math.hypot(dx, dy, dz);

    if (distance < 0.01) {
      return true;
    }

    const hit = this.physics.raycast(
      origin,
      {
        x: dx / distance,
        y: dy / distance,
        z: dz / distance
      },
      distance,
      null
    );

    return !hit || hit.distance >= distance - 0.3;
  }

  applyFlash(intensity) {
    if (!this.alive) {
      return;
    }

    /**
     * Hard боти швидше відвертаються від flashbang —
     * їх засліплення коротше.
     */
    let resist = 1;
    if (this.difficulty === 'hard') resist = 0.55;
    else if (this.difficulty === 'medium') resist = 0.8;
    else resist = 1.05;

    this.flashed = Math.max(
      this.flashed,
      Math.min(4, intensity * 3.5 * resist)
    );
  }

  /**
   * Бот почув звук (постріл, кроки, гранату).
   * Дистанція чутності залежить від типу.
   */
  hearSound(soundPos, type = 'shot') {
    if (!this.alive) {
      return;
    }

    /**
     * Дальність слуху залежить від типу звуку.
     * Стіни приглушують: звук за стіною чути гірше.
     */
    const ranges = {
      shot: 45,
      step: 14,
      grenade: 28,
      explosion: 40,
      plant: 20
    };

    const range = ranges[type] ?? 30;
    const distance = this.position.distanceTo(soundPos);

    if (distance > range) {
      return;
    }

    /**
     * Обчислюємо "гучність" звуку:
     * - ближче → голосніше
     * - стіни (LOS) приглушують на ~40%
     * - hard боти чують краще
     */
    let loudness = 1 - distance / range;

    if (this.physics) {
      const blocked = this.physics.raycast(
        this.position.clone().setY(this.position.y + 1.3),
        soundPos.clone().setY(soundPos.y + 1.3)
      );

      if (blocked) {
        loudness *= 0.55;
      }
    }

    if (this.difficulty === 'easy') {
      loudness *= 0.7;
    }

    if (loudness <= 0.15) {
      return;
    }

    this.lastHeardPos.copy(soundPos);
    this.heardTimer = 3 + loudness * 3;

    if (!this.currentTargetId && this.threatTimer <= 0) {
      this.lastThreat.copy(soundPos);
      this.threatTimer = 1.5;
    }

    /**
     * Спринт до останнього почутого звуку (не лише загроза).
     */
    if (!this.currentTargetId && this.lastKnownEnemy) {
      this.lastKnownEnemy.copy(soundPos);
      this.lastSeenTime = Math.max(this.lastSeenTime, this.heardTimer);
    }
  }

  /**
   * Радіо-команда: бот сповіщає команду (звук + можливий HUD-текст).
   * Кулдаун запобігає спаму.
   */
  sayRadio(kind, position = null) {
    const now = performance.now();

    if (this.radioCooldownUntil > now) {
      return;
    }

    this.radioCooldownUntil = now + 3500 + Math.random() * 1500;

    this.onRadio?.(this, kind, position ?? this.position);
  }

  startBotReload() {
    if (this.weapon.reloading) {
      return;
    }

    this.weapon.startReload();
    this.burstShots = 0;

    if (this.lastThreat.lengthSq() > 0.01) {
      const away = this.position.clone().sub(this.lastThreat).setY(0);

      if (away.lengthSq() > 0.01) {
        away.normalize();

        const retreat = this.position.clone().addScaledVector(away, 6);

        if (this.navGrid.isWalkableWorld(retreat.x, retreat.z)) {
          this.moveTarget.copy(retreat);
        }
      }
    }
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

  respawn(spawn) {
    this.remove();

    this.position.set(
      spawn?.x ?? 0,
      spawn?.y ?? 0.9,
      spawn?.z ?? 0
    );

    this.health = 100;
    this.armor = 0;
    this.alive = true;
    this.deathTimer = 0;
    this._dying = 0;

    this.hitFlashTime = 0;

    this.fireCooldown = 1;
    this.stateTimer = 0;

    this.burstShots = 0;
    this.burstPause = 0;

    this.flashed = 0;
    this.path = [];

    /**
     * На початку раунду бот "купує" зброю за накопичені гроші:
     * бідний — Deagle, багатий — AK/M4. Як у CS.
     */
    if (this.team) {
      const hadRifle =
        this.weapon?.id === 'ak47' ||
        this.weapon?.id === 'm4a1';

      if (!hadRifle || (this.money ?? 0) >= 3100) {
        this.weapon = this.pickWeapon();
        this.weapon.magazine = this.weapon.magazineSize;
        this.weapon.reserve = this.weapon.reserveAmmo;
        this.weapon.cooldown = 0;
        this.weapon.reloading = false;
      } else {
        this.weapon.magazine = this.weapon.magazineSize;
        this.weapon.reserve = this.weapon.reserveAmmo;
        this.weapon.reloading = false;
        this.weapon.cooldown = 0;
      }
    }
    this.navTarget = null;
    this.pathTimer = 0;

    /**
     * «Купівля»: бот обирає зброю залежно від успіху в попередньому раунді.
     * 0 вбивств — частіше eco (Deagle), 1+ — повна купівля (AK/M4).
     */
    const killBonus = Math.min(this.kills ?? 0, 3) * 0.15;
    const buyRoll = Math.random() + killBonus;

    if (buyRoll < 0.2) {
      this.weapon = createDesertEagle();
    } else if (this.team === 'CT') {
      this.weapon = Math.random() < 0.55 ? createM4A1() : createAK47();
    } else {
      this.weapon = Math.random() < 0.6 ? createAK47() : createM4A1();
    }

    this.weapon.magazine = this.weapon.magazineSize;
    this.weapon.reserve = this.weapon.reserveAmmo;
    this.weapon.reloading = false;
    this.weapon.reloadTimer = 0;
    this.weapon.shotsFired = 0;
    this.weapon.timeSinceLastShot = 999;

    this.meleeWeapon.cooldown = 0;

    this.createBody();
  }

  getEyePosition() {
    return this._eye.set(
      this.position.x,
      this.position.y + 1.55,
      this.position.z
    );
  }

  getMuzzlePosition() {
    this._muzzle.copy(this.getEyePosition());
    this._muzzle.y = this.position.y + 1.35;
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

  facePoint(point, dt = null) {
    const dx = point.x - this.position.x;
    const dz = point.z - this.position.z;

    if (dx * dx + dz * dz < 0.0001) {
      return;
    }

    const targetYaw = Math.atan2(-dx, -dz);

    if (dt == null) {
      this.yaw = targetYaw;
      return;
    }

    let diff = targetYaw - this.yaw;

    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const maxTurn = this.turnSpeed * dt;
    const step = Math.max(-maxTurn, Math.min(maxTurn, diff));

    this.yaw += step;
  }

  canSee(targetEye) {
    const origin = this.getEyePosition().clone();

    const dir = targetEye.clone().sub(origin);
    let remaining = dir.length();

    if (remaining < 0.001) {
      return false;
    }

    dir.normalize();

    const smokeDistance = this.smokeBlock?.(origin, dir, remaining);

    if (smokeDistance != null && smokeDistance < remaining) {
      return false;
    }

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

      if (
        hit.userData?.player ||
        hit.userData?.remotePlayer
      ) {
        return true;
      }

      /**
       * Інші боти НЕ блокують огляд — в CS можна бачити
       * крізь союзників (і крізь ворожих ботів теж,
       * хтось стоїть на шляху не приховує ціль).
       */
      if (
        hit.userData?.hostBot ||
        hit.userData?.clientBot
      ) {
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

  raycastShot(targetEye) {
    const origin = this.getMuzzlePosition().clone();

    const dir = targetEye.clone().sub(origin);
    let remaining = dir.length();

    if (remaining < 0.001) {
      return {
        hitTargetId: null,
        hitZone: 'chest',
        damageMultiplier: 1,
        end: origin
      };
    }

    dir.normalize();

    const smokeDistance = this.smokeBlock?.(origin, dir, remaining);

    if (smokeDistance != null && smokeDistance < remaining) {
      return {
        hitTargetId: null,
        hitZone: 'chest',
        damageMultiplier: 1,
        end: origin.clone().addScaledVector(dir, smokeDistance)
      };
    }

    const weapon = this.weapon;

    let currentOrigin = origin;
    let exclude = null;
    let damageMultiplier = 1;
    let power = weapon.penetrationPower;

    for (let i = 0; i < 4; i++) {
      const hit = this.physics.raycast(
        currentOrigin,
        dir,
        remaining,
        exclude
      );

      if (!hit) {
        return {
          hitTargetId: null,
          hitZone: 'chest',
          damageMultiplier,
          end: origin.clone().addScaledVector(dir, remaining)
        };
      }

      if (hit.userData?.player) {
        return {
          hitTargetId: this.localPlayerId,
          hitZone: hit.userData.hitZone ?? 'chest',
          damageMultiplier,
          end: new THREE.Vector3(
            hit.point.x,
            hit.point.y,
            hit.point.z
          )
        };
      }

      if (hit.userData?.remotePlayer) {
        return {
          hitTargetId: hit.userData.playerId,
          hitZone: hit.userData.hitZone ?? 'chest',
          damageMultiplier,
          end: new THREE.Vector3(
            hit.point.x,
            hit.point.y,
            hit.point.z
          )
        };
      }

      if (hit.userData?.hostBot === this) {
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

      /**
       * Влучання в іншого бота (hostBot / clientBot):
       * якщо союзник — куля проходить крізь (як self),
       * якщо ворог — повертаємо як ціль.
       */
      if (hit.userData?.hostBot || hit.userData?.clientBot) {
        const hitBot = hit.userData?.hostBot ?? hit.userData?.clientBot;

        if (hitBot.team === this.team) {
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
          hitTargetId: hitBot.id ?? hit.userData?.botId,
          hitZone: hit.userData?.hitZone ?? 'chest',
          damageMultiplier,
          end: new THREE.Vector3(
            hit.point.x,
            hit.point.y,
            hit.point.z
          )
        };
      }

      /**
       * Простріл стіни: як у гравця, з material resistance.
       */
      const material = hit.userData?.material ?? 'concrete';
      const resistance = {
        glass: 0.15,
        wood: 1.0,
        metal: 3.0,
        concrete: 2.4,
        brick: 2.2,
        carBody: 1.2,
        carBodyBlue: 1.2,
        carBodyGreen: 1.2,
        wheel: 1.4,
        truckBody: 1.5,
        truckCab: 1.5
      }[material] ?? Infinity;

      if (power < resistance || hit.userData?.stopsBullet) {
        return {
          hitTargetId: null,
          hitZone: 'chest',
          damageMultiplier,
          end: new THREE.Vector3(
            hit.point.x,
            hit.point.y,
            hit.point.z
          )
        };
      }

      const penMultiplier = {
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
      }[material] ?? 0.5;

      damageMultiplier *= penMultiplier;
      power *= 0.72;

      const advance = Math.max(hit.distance ?? 0, 0.001) + 0.08;

      remaining -= advance;

      if (remaining <= 0.1) {
        break;
      }

      currentOrigin = currentOrigin
        .clone()
        .addScaledVector(dir, 0.08);

      exclude = hit.collider;
    }

    return {
      hitTargetId: null,
      hitZone: 'chest',
      damageMultiplier,
      end: origin.clone().addScaledVector(dir, remaining)
    };
  }

  chooseStrafeTarget(target) {
    const dx = target.position.x - this.position.x;
    const dz = target.position.z - this.position.z;

    const len = Math.hypot(dx, dz) || 1;

    const px = -dz / len;
    const pz = dx / len;

    /**
     * Непередбачуваність: зміна напрямку зі 40% шансом,
     * щоб не ходити одним маршрутом.
     */
    let side = Math.random() < 0.6 ? this.strafeSign : -this.strafeSign;
    this.strafeSign = side;

    const dist = this.position.distanceTo(target.position);
    let radius = 2.5 + Math.random() * 3;

    /**
     * Агресивні боти підходять ближче, camper тримає дистанцію.
     */
    const aggressive = this.skill.aggression > 0.7;
    if (aggressive && dist < 12) {
      radius *= 0.6;
    } else if (this.role === 'camper' && dist < 20) {
      radius *= 1.2;
    }

    /**
     * Hard боти частіше змінюють напрямок — важче підстрелити.
     */
    if (this.difficulty === 'hard' && Math.random() < 0.3) {
      radius *= 1.4;
    }

    for (let i = 0; i < 4; i++) {
      const x = this.position.x + px * side * radius;
      const z = this.position.z + pz * side * radius;

      if (this.navGrid.isWalkableWorld(x, z)) {
        this.strafeTarget.set(x, this.position.y, z);
        return;
      }

      side *= -1;
      radius *= 0.7;
    }

    this.strafeTarget.copy(this.position);
  }

  randomPatrolTarget() {
    /**
     * Патрулювання навколо своєї зони (якщо призначена),
     * щоб команда не купчилась.
     */
    const anchor = this.zoneCenter ?? this.position;

    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 10;

      const x = anchor.x + Math.cos(angle) * radius;
      const z = anchor.z + Math.sin(angle) * radius;

      if (this.navGrid.isWalkableWorld(x, z)) {
        this.moveTarget.set(x, this.position.y, z);
        return;
      }
    }

    if (anchor !== this.position && this.navGrid.isWalkableWorld(anchor.x, anchor.z)) {
      this.moveTarget.set(anchor.x, this.position.y, anchor.z);
      return;
    }

    this.moveTarget.copy(this.position);
  }

  setNavTarget(point) {
    const dx = point.x - this.position.x;
    const dz = point.z - this.position.z;

    if (dx * dx + dz * dz < 0.25 * 0.25) {
      this.navTarget = null;
      this.path = [];
      return;
    }

    const sameTarget =
      this.navTarget &&
      Math.hypot(point.x - this.navTarget.x, point.z - this.navTarget.z) < 2;

    if (sameTarget && (this.path.length > 0 || this.pathTimer > 0)) {
      return;
    }

    this.navTarget = point;
    this.path = this.navGrid.findPath(this.position, point) ?? [];
    this.pathTimer = 0.35;

    if (this.path.length > 0) {
      const first = this.path[0];

      if (
        Math.hypot(first.x - this.position.x, first.z - this.position.z) < 0.6
      ) {
        this.path.shift();
      }
    }
  }

  moveTo(point, speed, dt) {
    this.pathTimer = Math.max(0, this.pathTimer - dt);

    this.setNavTarget(point);

    if (this.path.length === 0) {
      return this.walkToward(point, speed, dt);
    }

    const waypoint = this.path[0];

    const reached = this.walkToward(waypoint, speed, dt);

    if (
      reached ||
      Math.hypot(waypoint.x - this.position.x, waypoint.z - this.position.z) < 0.7
    ) {
      this.path.shift();
    }

    return this.path.length === 0;
  }

  /**
   * Чи є закриті/зачинені двері попереду на шляху.
   * Якщо так — бот знає що треба підійти ближче
   * (двері відчиняться автоматично).
   */
  doorAhead() {
    const doors = this.getDoors?.() ?? [];

    if (!doors.length) {
      return null;
    }

    const forward = this.getForward();
    const origin = this.position;

    let bestDoor = null;
    let bestDist = 6;

    for (const door of doors) {
      if (door.state === 'destroyed') {
        continue;
      }

      const dx = door.center.x - origin.x;
      const dz = door.center.z - origin.z;
      const dist = Math.hypot(dx, dz);

      if (dist > bestDist) {
        continue;
      }

      /**
       * Двері попереду (кут до напрямку руху < 45°).
       */
      const dot =
        (dx / (dist || 1)) * forward.x +
        (dz / (dist || 1)) * forward.z;

      if (dot > 0.7) {
        bestDoor = door;
        bestDist = dist;
      }
    }

    return bestDoor;
  }

  walkToward(point, speed, dt) {
    const dirX = point.x - this.position.x;
    const dirZ = point.z - this.position.z;
    const len = Math.hypot(dirX, dirZ);

    if (len < 0.25) {
      return true;
    }

    const nx = dirX / len;
    const nz = dirZ / len;

    /**
     * Дим: не ліземо в димову завісу наосліп.
     * Просуваємося повільно, якщо вже всередині — виходимо.
     */
    const smoke = this.nearestSmoke();
    if (smoke) {
      const smokeDist = this.position.distanceTo(smoke.position);

      const movingTowardSmoke =
        (this.position.x - smoke.position.x) * nx +
        (this.position.z - smoke.position.z) * nz > 0;

      if (movingTowardSmoke && smokeDist < 3.5) {
        if (this.isInSmoke()) {
          this.stateTimer = 0.5;
        }
        return false;
      }
    }

    this._next.copy(this.position);
    this._next.x += nx * speed * dt;
    this._next.z += nz * speed * dt;

    if (this.navGrid.isWalkableWorld(this._next.x, this._next.z)) {
      this.position.copy(this._next);
      this.addStep(speed, dt);
      return true;
    }

    /**
     * Двері: якщо клітина заблокована, але попереду двері
     * (на відстані <4м) — бот продовжує йти до них,
     * бо двері відчиняться автоматично при наближенні.
     */
    const door = this.doorAhead?.();

    if (door && door.state === 'closed') {
      const distToDoor = Math.hypot(
        door.center.x - this.position.x,
        door.center.z - this.position.z
      );

      if (distToDoor < 4.5) {
        const toDoorX = (door.center.x - this.position.x) / (distToDoor || 1);
        const toDoorZ = (door.center.z - this.position.z) / (distToDoor || 1);

        this._next.copy(this.position);
        this._next.x += toDoorX * speed * dt;
        this._next.z += toDoorZ * speed * dt;

        this.position.copy(this._next);
        this.addStep(speed * 0.7, dt);
        return true;
      }
    }

    /**
     * Стіна: пробує обійти боком, чергує сторону.
     */
    const side = this.strafeSign;
    const sx = -nz * side;
    const sz = nx * side;

    this._next.copy(this.position);
    this._next.x += sx * speed * dt;
    this._next.z += sz * speed * dt;

    if (this.navGrid.isWalkableWorld(this._next.x, this._next.z)) {
      this.position.copy(this._next);
      this.addStep(speed, dt);
      return true;
    }

    this.strafeSign = -side;

    return false;
  }

  addStep(speed, dt) {
    this.stepDistance = (this.stepDistance ?? 0) + speed * dt;

    if (this.stepDistance >= 2.3) {
      this.stepDistance = 0;
      this.onStep?.(this.position);
    }
  }

  engage(target, enemies, distance) {
    if (this.reactTimer > 0 || this.weapon.reloading) {
      return;
    }

    /**
     * Відступ до укриття: бот НЕ стріляє, поки тікає
     * (повертає увагу на бій після досягнення укриття).
     */
    if (this.coverTimer > 4.5 && this.stateTimer > 0) {
      return;
    }

    /**
     * Ближній бій: мілі-зброя на дистанції < 3.2м.
     * Бот перемикається на ніж/ломик і б'є зблизька.
     */
    if (distance < 3.2 && this.meleeWeapon.cooldown <= 0) {
      this.meleeWeapon.update(0.016);
      this.meleeWeapon.consumeAmmo();

      const dir = target.position
        .clone()
        .sub(this.position)
        .normalize();

      const eye = this.getEyePosition();
      const aim = new THREE.Vector3(
        eye.x + dir.x * 2,
        eye.y + dir.y * 2,
        eye.z + dir.z * 2
      );

      const result = this.raycastShot(aim);

      if (result.hitTargetId) {
        const hitEnemy = enemies.find(
          (e) => e.playerId === result.hitTargetId
        );

        if (hitEnemy) {
          const damage = this.meleeWeapon.damage *
            (result.hitZone === 'head' ? this.meleeWeapon.headshotMultiplier : 1);

          this.onHitPlayer(this, hitEnemy, Math.round(damage), result.hitZone);
        }
      }

      this.fireCooldown = Math.max(this.fireCooldown, 0.4);
      return;
    }

    if (this.weapon.magazine <= 0 && this.weapon.reserve <= 0) {
      /**
       * Патрони закінчились повністю — бот бере іншу зброю
       * (той самий принцип, що в гравця).
       */
      this.weapon = this.pickWeapon();
      this.weapon.magazine = this.weapon.magazineSize;
      this.weapon.reserve = this.weapon.reserveAmmo;
      this.burstShots = 0;
      return;
    }

    if (this.weapon.magazine <= 0) {
      this.startBotReload();
      return;
    }

    if (this.burstPause > 0 || this.fireCooldown > 0) {
      return;
    }

    /**
     * Дисципліна вогню: далеко — тапи, близько — черги.
     * Rusher — довші черги, camper — коротші, точніші.
     *
     * Далеко (>22м): camper/ranged crouch для точності.
     */
    if (distance > 22 && (this.role === 'camper' || Math.random() < 0.4)) {
      this.crouching = true;
    } else if (this.crouching && distance < 14) {
      this.crouching = false;
    }

    if (this.burstShots <= 0) {
      const burstMod =
        this.role === 'rusher' ? 3 : this.role === 'camper' ? -1 : 0;

      if (distance > 16) {
        this.burstShots = 1 + Math.floor(Math.random() * 2) + Math.max(0, burstMod);
      } else {
        this.burstShots = 4 + Math.floor(Math.random() * 5) + burstMod;
      }

      this.burstShots = Math.max(1, this.burstShots);
    }

    this.shootAt(target, enemies);

    this.burstShots--;
    this.weapon.consumeAmmo();
    this.shotsFired = (this.shotsFired ?? 0) + 1;

    this.fireCooldown = distance > 16 ? 0.22 : 0.11;

    if (this.burstShots <= 0) {
      this.burstPause =
        distance > 16
          ? 0.4 + Math.random() * 0.45
          : 0.7 + Math.random() * 0.6;
      this.shotsFired = 0;
    }
  }

  shootAt(target, enemies) {
    const aimPoint = this.leadTarget(target);

    const origin = this.getMuzzlePosition().clone();

    const dir = aimPoint.clone().sub(origin);
    const distance = dir.length();

    if (distance < 0.001) {
      return;
    }

    dir.normalize();

    /**
     * Точність у стилі CS 1.6:
     * - перший постріл з нерухомості дуже точний;
     * - віддача наростає з кожним пострілом (shotsFired);
     * - рух та стрибки псують точність;
     * - crouch + нерухомість = максимальна точність.
     */
    const movePenalty = 1 + Math.min(this.moveSpeed / 4, 1) * 0.9;
    const jumpPenalty = this.airborne ? 2.2 : 1;
    const crouchBonus = this.crouching ? 0.5 : 1;

    const recoil = Math.min(this.shotsFired ?? 0, 12) * 0.035;
    const fireInaccuracy = 1 + recoil;

    const firstShotBonus =
      (this.shotsFired ?? 0) === 0 && this.moveSpeed < 0.5
        ? 0.45
        : 1;

    const sigma = Math.min(
      0.075,
      0.02 * this.skill.spread *
        movePenalty *
        jumpPenalty *
        crouchBonus *
        fireInaccuracy *
        firstShotBonus
    );

    let u = 0;
    let v = 0;

    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();

    const gaussian =
      Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);

    const radius = Math.abs(gaussian) * sigma;
    const angle = Math.random() * Math.PI * 2;

    aimPoint.x += Math.cos(angle) * radius * distance;
    aimPoint.y += Math.sin(angle) * radius * distance * 0.6;
    aimPoint.z += Math.cos(angle) * radius * distance;

    const result = this.raycastShot(aimPoint);

    this.onShot(this, origin, result.end);

    /**
     * Muzzle flash: спалах на ~40мс.
     */
    if (this._flashMesh) {
      this._flashMesh.position.copy(origin).sub(this.position);
      this._flashMesh.material.opacity = 0.9;
      this.muzzleFlashTime = 0.04;
    }

    if (!result.hitTargetId) {
      return;
    }

    const hitEnemy = enemies.find(
      (enemy) => enemy.playerId === result.hitTargetId
    );

    if (!hitEnemy) {
      return;
    }

    const weapon = this.weapon;
    let zone = result.hitZone ?? 'chest';

    let damage = weapon.damage;

    if (zone === 'head') {
      damage *= weapon.headshotMultiplier;
    } else if (weapon.zoneMultipliers[zone]) {
      damage *= weapon.zoneMultipliers[zone];
    }

    /**
     * Розподіл зон залежно від рівня складності:
     * hard частіше стріляє в голову.
     */
    const zoneRoll = Math.random();
    const headChance =
      this.difficulty === 'hard' ? 0.18 :
      this.difficulty === 'medium' ? 0.09 : 0.03;

    if (zone === 'chest' && zoneRoll < headChance && distance < 30) {
      zone = 'head';
      damage *= weapon.headshotMultiplier;
    }

    const rangeFalloff =
      1 - (1 - (weapon.id === 'deagle' ? 0.72 : 0.85)) *
        Math.min(distance / 60, 1);

    damage = Math.max(
      1,
      Math.round(damage * rangeFalloff * (result.damageMultiplier ?? 1))
    );

    this.onHitPlayer(this, hitEnemy, damage, zone);
  }

  update(dt) {
    if (!this.alive) {
      if (this._dying > 0) {
        this._dying += dt;

        const t = Math.min(1, this._dying / 0.7);

        if (this.mesh) {
          this.mesh.rotation.x = -t * 1.4;
          this.mesh.position.y = this.position.y - t * 0.6;

          if (this.mesh.traverse) {
            this.mesh.traverse((child) => {
              if (child.material && child.material.opacity !== undefined) {
                child.material.transparent = true;
                child.material.opacity = 1 - t;
              }
            });
          }
        }

        if (t >= 1) {
          this.remove();
          this._dying = -1;
        }
      }
      return;
    }

    this.fireCooldown -= dt;

    /**
     * Muzzle flash decay.
     */
    if (this.muzzleFlashTime > 0) {
      this.muzzleFlashTime -= dt;

      if (this._flashMesh) {
        this._flashMesh.material.opacity = Math.max(0, this.muzzleFlashTime / 0.04 * 0.9);
      }
    }
    this.stateTimer -= dt;
    this.reactTimer -= dt;
    this.burstPause -= dt;
    this.threatTimer -= dt;
    this.coverTimer -= dt;
    this.grenadeTimer -= dt;
    this.heardTimer = Math.max(0, this.heardTimer - dt);
    this.allyHelpTimer = Math.max(0, this.allyHelpTimer - dt);
    this.grenadeUseTimer = Math.max(0, this.grenadeUseTimer - dt);
    this.pathTimer = Math.max(0, this.pathTimer - dt);

    this.weapon.update(dt);

    const wasFlashed = this.flashed > 0;

    this.flashed = Math.max(0, this.flashed - dt);

    if (!wasFlashed && this.flashed > 0) {
      this.currentTargetId = null;
      this.previousTargetId = null;
    }

    if (this.aggressorTimer > 0) {
      this.aggressorTimer -= dt;
      if (this.aggressorTimer <= 0) {
        this.aggressorId = null;
      }
    }

    /**
     * Скидання спалаху крові після влучання.
     */
    if (this.hitFlashTime > 0) {
      this.hitFlashTime -= dt;

      if (this.hitFlashTime <= 0 && this.mesh?.userData?.materials?.bodyMat) {
        this.mesh.userData.materials.bodyMat.emissive.setHex(0x000000);
        this.mesh.userData.materials.bodyMat.emissiveIntensity = 0;
      }
    }

    this.moveSpeed =
      this.position.distanceTo(this.prevBodyPos) /
      Math.max(dt, 0.001);

    this.prevBodyPos.copy(this.position);

    /**
     * Анти-застрягання: якщо бот намагається йти,
     * але не рухається 2+ секунди — телепортуємо
     * на найближчу walkable клітину.
     * Двері попереду не вважаємо застряганням —
     * бот чекає поки вони відчиняться.
     */
    const doorAhead = this.doorAhead?.();

    if (this.moveSpeed < 0.15) {
      if (!doorAhead) {
        this.stuckTimer = (this.stuckTimer ?? 0) + dt;
      } else {
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }

    if (this.stuckTimer > 2) {
      this.stuckTimer = 0;

      const nearest = this.navGrid?.findNearestWalkable?.(
        this.position.x,
        this.position.z,
        8
      );

      if (nearest) {
        this.position.set(nearest.x, this.position.y, nearest.z);
        this.path = [];
        this.navTarget = null;
      }
    }

    /**
     * Перезарядка: відхід, без вогню.
     */
    if (this.weapon.reloading) {
      this.moveTo(this.moveTarget, 4.2, dt);
      this.updateBody();
      return;
    }

    /**
     * Засліплений: не бачить ворогів, бігає наосліп.
     */
    if (this.flashed > 0) {
      if (this.stateTimer <= 0) {
        this.randomPatrolTarget();
        this.stateTimer = 0.5 + Math.random() * 0.7;
      }

      this.facePoint(this.moveTarget, dt);
      this.moveTo(this.moveTarget, 3.2, dt);
      this.updateBody();
      return;
    }

    const enemies = this.getEnemies().filter(
      (enemy) => enemy.alive && enemy.team !== this.team
    );

    /**
     * Прикриття союзника: якщо він поранений і видимий,
     * підійти до нього (вогнева підтримка).
     */
    if (this.allyHelpTimer <= 0 && this.role !== 'camper') {
      const allies = this.getBotAllies(this);

      let hurtAlly = null;
      let hurtDist = Infinity;

      for (const ally of allies) {
        if (!ally.alive || ally.health == null || ally.health > 50) {
          continue;
        }

        const dist = this.position.distanceTo(ally.position);

        if (dist < 18 && dist < hurtDist && this.canSee(ally.getEyePosition())) {
          hurtDist = dist;
          hurtAlly = ally;
        }
      }

      if (hurtAlly) {
        this.allyHelpTimer = 1.2;
        this.currentTargetId = null;
        this.previousTargetId = null;

        if (this.position.distanceTo(hurtAlly.position) > 6) {
          this.moveTo(hurtAlly.position, 4.6, dt);
        } else if (enemies.length > 0) {
          const threat = enemies[0];

          this.facePoint(threat.position, dt);
          this.moveTo(this.position, 2.2, dt);
          this.engage(threat, enemies, this.position.distanceTo(threat.position));
        }

        this.updateBody();
        return;
      }
    }

    /**
     * Вибір цілі: видима, близька, і та, на яку
     * вже не "націлилася" половина команди.
     */
    let target = null;
    let bestScore = Infinity;

    const counts = this.getTargetCounts?.() ?? new Map();

    for (const enemy of enemies) {
      const distance = this.position.distanceTo(enemy.position);

      if (distance > 65) {
        continue;
      }

      if (!this.canSee(enemy.getEyePosition())) {
        continue;
      }

      const pressure = counts.get(enemy.playerId) ?? 0;
      let score = distance + pressure * 18;

      /**
       * Пріоритет: ворог, який стріляє в МЕНЕ (загроза).
       * Бот повинен відповідати тим, хто атакує його,
       * а не просто гнатися за найближчим.
       */
      if (enemy.playerId === this.aggressorId && this.aggressorTimer > 0) {
        score -= 40;
      }

      /**
       * Ціль, по якій вже стріляємо, зберігається
       * (щоб не стрибати між цілями).
       */
      if (this.currentTargetId === enemy.playerId) {
        score -= 15;
      }

      if (score < bestScore) {
        bestScore = score;
        target = enemy;
      }
    }

    /**
     * Запам'ятовуємо останню відому позицію ворога.
     */
    if (target) {
      this.lastKnownEnemy = target.position.clone();
      this.lastKnownEnemyId = target.playerId;
      this.lastSeenTime = 4;
    }

    /**
     * Переслідування: якщо ворог був видимий нещодавно
     * але зараз сховався — рухаємось до останньої позиції,
     * перевіряючи кути (peek).
     */
    if (!target && this.lastKnownEnemy && this.lastSeenTime > 0) {
      this.lastSeenTime -= dt;
      this.currentTargetId = null;
      this.previousTargetId = null;

      const dist = this.position.distanceTo(this.lastKnownEnemy);

      if (dist > 2.5) {
        /**
         * Wallbang: якщо ворог щойно зник за стіною (lastSeenTime > 2),
         * hard боти стріляють крізь тонкі стіни.
         */
        if (
          this.lastSeenTime > 2 &&
          this.difficulty === 'hard' &&
          this.weapon.magazine > 0 &&
          this.fireCooldown <= 0 &&
          dist < 30 &&
          Math.random() < 0.25
        ) {
          const fakeTarget = {
            getEyePosition: () =>
              this.lastKnownEnemy.clone().setY(this.position.y + 1.5),
            position: this.lastKnownEnemy,
            playerId: this.lastKnownEnemyId ?? 'last-known'
          };
          const fakeEnemies = this.getEnemies().filter(
            (e) => e.alive && e.team !== this.team
          );
          this.shootAt(fakeTarget, fakeEnemies);
          this.weapon.consumeAmmo();
          this.fireCooldown = 0.25;
        }

        /**
         * Обережне входження: на дистанції <6м від останньої
         * позиції бот сповільнюється і перевіряє огляд (peek).
         */
        if (dist < 6 && this.role !== 'rusher') {
          this.moveTo(this.lastKnownEnemy, 2.6, dt);
          this.facePoint(this.lastKnownEnemy, dt);

          const peekPoint = this.lastKnownEnemy.clone();

          if (this.canSee(peekPoint.setY(this.position.y + 1.55))) {
            this.currentTargetId = this.lastKnownEnemyId ?? null;
          }
        } else {
          this.moveTo(this.lastKnownEnemy, 4.4, dt);
          this.facePoint(this.lastKnownEnemy, dt);
        }

        this.updateBody();
        return;
      }
    }

    /**
     * Ухиляння від гранат.
     */
    if (this.grenadeTimer <= 0) {
      const grenade = this.nearestGrenade();

      if (grenade) {
        this.grenadeTimer = 0.5;

        const away = this.position
          .clone()
          .sub(grenade.position)
          .setY(0);

        if (away.lengthSq() > 0.01) {
          away.normalize();

          const dodge = this.position.clone().addScaledVector(away, 5);

          dodge.x += (Math.random() - 0.5) * 3;
          dodge.z += (Math.random() - 0.5) * 3;

          if (this.navGrid.isWalkableWorld(dodge.x, dodge.z)) {
            this.strafeTarget.copy(dodge);
            this.stateTimer = Math.max(this.stateTimer, 0.5);
          }
        }
      }
    }

    if (target) {
      /**
       * Реакція на перший контакт — не миттєвий вогонь.
       */
      if (this.previousTargetId !== target.playerId) {
        this.previousTargetId = target.playerId;
        this.reactTimer = Math.max(this.reactTimer, this.skill.reaction);

        /**
         * Радіо: "Ворог! Ворог!" при першому контакті.
         */
        if (Math.random() < 0.5) {
          this.sayRadio('spot', target.position);
        }
      }

      this.currentTargetId = target.playerId;
      this.lastThreat.copy(target.position);
      this.threatTimer = 5;

      const distance = this.position.distanceTo(target.position);

      /**
       * Командна перевага: якщо більше союзників, ніж ворогів —
       * агресія зростає (push), менше — обережність.
       */
      let teamPush = 1;
      const allies = this.getBotAllies(this);
      const aliveAllies = allies.filter((a) => a.alive).length;
      const aliveEnemies = enemies.filter((e) => e.alive).length;

      if (aliveAllies >= aliveEnemies + 1) {
        teamPush = 1 + (aliveAllies - aliveEnemies) * 0.25;
      } else if (aliveEnemies > aliveAllies) {
        teamPush = Math.max(0.55, 1 - (aliveEnemies - aliveAllies) * 0.2);
      }

      this.facePoint(this.leadTarget(target), dt);

      /**
       * Укриття під час бою:
       * - під обстрілом (в нас стріляють) — шукаємо укриття ЗАВЖДИ
       *   (навіть якщо ворог не видимий — агрессор за стіною);
       * - HP < 50 — завжди шукає укриття;
       * - HP < 75 — 40% шанс відступити;
       * - перезарядка — ховається за укриття;
       * - ворог далеко і стріляє — camper ховається.
       */
      if (this.coverTimer <= 0) {
        let wantCover = false;
        let coverFrom = target?.position ?? null;

        if (this.aggressorTimer > 0 && this.threatTimer > 2) {
          wantCover = true;

          if (!coverFrom && this.lastThreat) {
            coverFrom = this.lastThreat.clone();
          }
        } else if (this.health < 50) {
          wantCover = true;
        } else if (this.health < 75) {
          wantCover = Math.random() < 0.4 * this.skill.aggression;
        } else if (this.weapon.magazine <= 3 && this.role !== 'rusher') {
          wantCover = Math.random() < 0.5;
        } else if (this.role === 'camper' && distance > 18 && Math.random() < 0.2) {
          wantCover = true;
        }

        if (wantCover && coverFrom) {
          const cover = this.findCoverPoint(coverFrom);

          if (cover) {
            this.moveTarget.copy(cover);
            this.coverTimer = 5;
            this.stateTimer = 2;
          }
        }
      }

      /**
       * Синхронний заход: якщо союзник вже стріляє по цілі,
       * бот фланкує — заходить збоку (не по прямій).
       */
      const allyEngaging = allies.some(
        (a) =>
          a.alive &&
          a.currentTargetId === target.playerId &&
          a !== this
      );

      this.flanking =
        allyEngaging && this.role !== 'camper' && distance > 12;

      if (this.stateTimer > 0 && this.coverTimer > 4.5) {
        this.moveTo(this.moveTarget, 4.8, dt);
      } else if (this.flanking) {
        if (this.stateTimer <= 0) {
          const side = Math.random() < 0.5 ? 1 : -1;
          const dir = target.position
            .clone()
            .sub(this.position)
            .setY(0)
            .normalize();

          const flankPoint = this.position
            .clone()
            .addScaledVector(dir, 4)
            .add(
              new THREE.Vector3(
                -dir.z * side * 5,
                0,
                dir.x * side * 5
              )
            );

          if (this.navGrid.isWalkableWorld(flankPoint.x, flankPoint.z)) {
            this.strafeTarget.copy(flankPoint);
          }

          this.stateTimer = 1.2 + Math.random() * 0.8;
        }

        this.moveTo(this.strafeTarget, 3.8, dt);
      } else if (distance < 9) {
        if (this.stateTimer <= 0) {
          this.chooseStrafeTarget(target);
          this.stateTimer = 0.55 + Math.random() * 0.9;
        }

        this.moveTo(this.strafeTarget, 3.4, dt);
      } else if (distance > 22 && this.role !== 'camper') {
        this.moveTo(
          target.position,
          (3 + this.skill.aggression * 2.2) * teamPush,
          dt
        );
      } else if (this.role === 'camper') {
        if (this.stateTimer <= 0) {
          this.strafeTarget.copy(this.position);
          this.stateTimer = 0.7 + Math.random() * 0.8;
        }

        this.moveTo(this.strafeTarget, 1.6, dt);
      } else {
        /**
         * Середня дистанція (9-22м): бот зупиняється
         * і стріляє з місця (як гравець в CS),
         * зрідка роблячи крок убік.
         */
        if (this.stateTimer <= 0) {
          if (Math.random() < 0.35) {
            this.chooseStrafeTarget(target);
          } else {
            this.strafeTarget.copy(this.position);
          }

          this.stateTimer = 0.9 + Math.random() * 0.8;
        }

        this.moveTo(this.strafeTarget, 1.4, dt);
      }

      /**
       * Кидок гранати: ціль на 8-20м, не близько (щоб не зачепити себе),
       * з кулдауном. Camper кидає частіше (тримає позицію).
       */
      if (
        this.grenadeUseTimer <= 0 &&
        distance >= 8 &&
        distance <= 20 &&
        !this.weapon.reloading
      ) {
        const throwChance =
          (this.role === 'camper' ? 0.5 : 0.3) * this.skill.aggression;

        if (Math.random() < throwChance) {
          const dir = target.position
            .clone()
            .sub(this.position)
            .setY(0)
            .normalize();

          /**
           * Тактичний вибір гранати:
           * - rusher: smoke — прикрити просування;
           * - camper: flash — засліпити атакуючих;
           * - інакше: HE — пошкодити ворога.
           */
          let type = 'he';

          if (this.role === 'rusher' && Math.random() < 0.5) {
            type = 'smoke';
          } else if (this.role === 'camper' && Math.random() < 0.5) {
            type = 'flash';
          } else if (Math.random() < 0.2) {
            type = 'flash';
          }

          this.onThrowGrenade?.(
            this.position,
            dir,
            type,
            this.id
          );

          this.grenadeUseTimer = this.grenadeThrowCooldown;
        }
      }

      this.engage(target, enemies, distance);
    } else {
      this.currentTargetId = null;
      this.previousTargetId = null;

      /**
       * Camper: тримає позицію (перший раз займає точку біля спавна),
       * не патрулює безцільно.
       */
      if (this.role === 'camper') {
        if (!this.holdPosition) {
          this.holdPosition = this.position.clone();

          const hold = this.findHoldPoint();

          if (hold) {
            this.holdPosition.copy(hold);
          }
        }

        this.facePoint(this.holdPosition, dt);

        if (this.position.distanceTo(this.holdPosition) > 3) {
          this.moveTo(this.holdPosition, 2.8, dt);
        } else if (this.stateTimer <= 0) {
          this.stateTimer = 2 + Math.random() * 2;
        }
      } else if (this.heardTimer > 0 && this.lastHeardPos.lengthSq() > 0.01) {
        /**
         * Почут звук (постріл/кроки) — йти перевірити.
         */
        this.heardTimer -= dt;

        if (this.position.distanceTo(this.lastHeardPos) > 2.5) {
          this.moveTo(this.lastHeardPos, 4.2, dt);
        }

        this.facePoint(this.lastHeardPos, dt);
      } else if (this.threatTimer > 0 && this.lastThreat.lengthSq() > 0.01) {
        /**
         * Пам'ять про загрозу — підійти до останньої позиції ворога.
         */
        this.moveTo(this.lastThreat, 4.2, dt);
        this.facePoint(this.lastThreat, dt);
      } else {
        if (this.stateTimer <= 0) {
          /**
           * Ротація зон: кожні ~12-20с бот переходить
           * на наступну тактичну позицію (жива гра).
           */
          const zones = this.getZones?.();

          if (zones && zones.length > 1 && this.role !== 'camper') {
            this.zoneIndex = ((this.zoneIndex ?? 0) + 1) % zones.length;
            const nextZone = zones[this.zoneIndex];

            if (nextZone) {
              this.zoneCenter = new THREE.Vector3(
                nextZone.x + (Math.random() - 0.5) * 2,
                nextZone.y ?? 0.9,
                nextZone.z + (Math.random() - 0.5) * 2
              );
            }
          }

          this.randomPatrolTarget();
          this.stateTimer = 8 + Math.random() * 8;
        }

        this.facePoint(this.moveTarget, dt);
        this.moveTo(this.moveTarget, 2.4, dt);
      }
    }

    this.updateBody();
  }

  updateBody() {
    if (!this.body || !this.mesh) {
      return;
    }

    if (this.body.setTranslation) {
      this.body.setTranslation(
        {
          x: this.position.x,
          y: this.position.y,
          z: this.position.z
        },
        true
      );
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;

    const speed = Math.hypot(this.velocity?.x ?? 0, this.velocity?.z ?? 0);
    animateSoldierWalk(this.mesh, 0.016, speed);
  }

  applyDamage(damage, attackerName, weaponId, hitZone, attackerPosition = null, attackerId = null) {
    if (!this.alive) {
      return;
    }

    /**
     * Броня: поглинає 50% шкоди, поки не вичерпається.
     */
    let finalDamage = damage;

    if (this.armor > 0) {
      const absorb = Math.min(this.armor, damage * 0.5);

      this.armor -= absorb;
      finalDamage = Math.max(1, Math.round(damage - absorb));
    }

    this.health -= finalDamage;

    /**
     * Кров/спалах на моделі при влучанні.
     */
    this.hitFlashTime = 0.12;

    if (this.mesh?.userData?.materials?.bodyMat) {
      this.mesh.userData.materials.bodyMat.emissive.setHex(0x880000);
      this.mesh.userData.materials.bodyMat.emissiveIntensity = 0.6;
    }

    /**
     * Біль: миттєва реакція, джук убік, запам'ятовує загрозу.
     */
    this.reactTimer = Math.min(this.reactTimer, 0.1);
    this.threatTimer = 5;

    if (attackerPosition) {
      this.lastThreat.copy(attackerPosition);

      if (!this.currentTargetId) {
        this.facePoint(attackerPosition);
      }
    }

    /**
     * Запам'ятовуємо хто атакує нас (пріоритетна ціль).
     */
    if (attackerId) {
      this.aggressorId = attackerId;
      this.aggressorTimer = 3;
    }

    /**
     * Радіо: "Я під обстрілом! Потрібна підтримка!"
     * Тільки якщо HP впало суттєво.
     */
    if (this.health < 70 && Math.random() < 0.12) {
      this.sayRadio('hurt', attackerPosition);
    }

    const away = attackerPosition
      ? this.position.clone().sub(attackerPosition).setY(0)
      : new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();

    if (away.lengthSq() > 0.01) {
      away.normalize();

      this.strafeTarget.copy(this.position).addScaledVector(away, 5 + Math.random() * 3);

      if (this.health < 30) {
        this.strafeTarget.addScaledVector(away, 8 + Math.random() * 7);
        this.coverTimer = Math.max(this.coverTimer, 1.5);
        this.currentTargetId = null;
      }
    }

    this.stateTimer = Math.max(this.stateTimer, 0.35);

    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.deathTimer = 3;
      this._dying = 0.01;

      /**
       * Радіо: "Ворог знешкоджений!"
       */
      if (attackerName && attackerName !== this.name) {
        this.sayRadio('kill');
      }

      this.onKill(
        this,
        attackerName,
        weaponId,
        hitZone === 'head',
        attackerId
      );
    }
  }

  dispose() {
    this.remove();
  }
}

/**
 * ClientBot — візуальне представлення бота на клієнті.
 * Клієнт не рахує його health, тільки відправляє влучання хосту.
 */
class ClientBot {
  constructor({
    id,
    team,
    scene,
    physics,
    onDamage
  }) {
    this.id = id;
    this.team = team;

    this.scene = scene;
    this.physics = physics;
    this.onDamage = onDamage;

    this.position = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();

    this.yaw = 0;
    this.targetYaw = 0;

    this.health = 100;
    this.alive = true;

    this.body = null;
    this.mesh = null;
    this.colliders = [];
  }

  createBody() {
    if (this.body) return;

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(
        this.position.x,
        this.position.y,
        this.position.z
      );

    this.body = this.physics.world.createRigidBody(bodyDesc);

    this.createHitboxes();
    this.createMesh();
  }

  createHitboxes() {
    for (const zone of BOT_ZONES) {
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

      this.colliders.push(collider);

      this.physics.colliderMeta.set(collider.handle, {
        clientBot: true,
        botId: this.id,
        team: this.team,
        material: 'flesh',
        hitZone: zone.name,
        stopsBullet: true,
        applyDamage: (damage, hit) => {
          this.onDamage(
            this.id,
            this.team,
            damage,
            hit?.userData?.hitZone ?? zone.name
          );
        }
      });
    }
  }

  createMesh() {
    if (this.mesh) return;

    this.mesh = createSoldierMesh(this.team);

    this.bodyMaterial = this.mesh.userData.materials.bodyMat;

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;

    /**
     * Muzzle flash: сфера + point light.
     */
    const flashGeo = new THREE.SphereGeometry(0.1, 4, 3);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    this._flashMesh = new THREE.Mesh(flashGeo, flashMat);
    this._flashMesh.renderOrder = 999;
    this.mesh.add(this._flashMesh);

    this.scene.add(this.mesh);
  }

  setTeam(team) {
    this.team = team;

    if (this.bodyMaterial) {
      this.bodyMaterial.color.setHex(teamColor(team));
    }

    for (const collider of this.colliders) {
      const meta = this.physics.colliderMeta.get(collider.handle);

      if (meta) {
        meta.team = team;
      }
    }
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

  updateFromSnapshot(snapshot) {
    if (snapshot.team && snapshot.team !== this.team) {
      this.setTeam(snapshot.team);
    }

    if (snapshot.name) {
      this.name = snapshot.name;
    }

    this.kills = snapshot.kills ?? (this.kills ?? 0);
    this.deaths = snapshot.deaths ?? (this.deaths ?? 0);

    this.targetPosition.set(
      snapshot.x ?? this.targetPosition.x,
      snapshot.y ?? this.targetPosition.y,
      snapshot.z ?? this.targetPosition.z
    );

    this.targetYaw = snapshot.yaw ?? this.targetYaw;

    this.health = snapshot.health ?? this.health;

    const alive = snapshot.alive !== false;

    if (alive && !this.alive) {
      this.position.copy(this.targetPosition);
    this.createBody();
  }

    if (!alive && this.alive) {
      this.remove();
    }

    this.alive = alive;
  }

  lerpAngle(a, b, t) {
    let diff = b - a;

    while (diff > Math.PI) {
      diff -= Math.PI * 2;
    }

    while (diff < -Math.PI) {
      diff += Math.PI * 2;
    }

    return a + diff * t;
  }

  update(dt) {
    if (!this.alive || !this.body || !this.mesh) {
      return;
    }

    const lerpFactor = 1 - Math.exp(-10 * dt);

    this.position.lerp(this.targetPosition, lerpFactor);
    this.yaw = this.lerpAngle(this.yaw, this.targetYaw, lerpFactor);

    if (this.body.setTranslation) {
      this.body.setTranslation(
        {
          x: this.position.x,
          y: this.position.y,
          z: this.position.z
        },
        true
      );
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;

    const speed = Math.hypot(this.velocity?.x ?? 0, this.velocity?.z ?? 0);
    animateSoldierWalk(this.mesh, 0.016, speed);
  }

  dispose() {
    this.remove();
  }
}

/**
 * NetworkBots:
 * - на хості створює HostBot;
 * - на клієнтах створює ClientBot;
 * - синхронізує стани ботів;
 * - приймає bot_damage на хості.
 */
export class NetworkBots {
  constructor({
    enabled,
    isHost,
    network,
    scene,
    physics,
    navGrid,
    spawnPoints = [],
    weaponManager = null,
    killFeed = null,
    localTeam = 'CT',
    audio = null,
    botZones = null
  }) {
    this.enabled = enabled;
    this.isHost = isHost;

    this.network = network;
    this.scene = scene;
    this.physics = physics;
    this.navGrid = navGrid;
    this.spawnPoints = spawnPoints;
    this.botZones = botZones;
    this.weaponManager = weaponManager;
    this.killFeed = killFeed;
    this._localTeam = localTeam;
    this.audio = audio;
    this.grenadeManager = null;
    this.doorSystem = null;

    this.hostBots = new Map();
    this.clientBots = new Map();

    this.sendAccumulator = 0;
    this.botCounter = 0;

    if (!this.enabled) {
      return;
    }

    this.network.onGameMessage = (message) => {
      this.handleMessage(message);
    };

    if (this.isHost) {
      this.spawnHostBots();
    }
  }

  /**
   * ComVisible localTeam: якщо RoundManager.swapTeams змінить команду гравця,
   * автоматично враховує нову команду (дозволяє бити ботів колишніх союзників
   * — попереджає friendly fire після зміни сторін).
   */
  get localTeam() {
    const team = this.network?.getLocalTeam?.();

    if (team) {
      this._localTeam = team;
    }

    return this._localTeam;
  }

  /**
   * Усі цілі для ботів: реальні гравці (локальний + peers)
   * + інші боти. Кожна ціль має getEyePosition та velocity,
   * щоб HostBot міг наводитись і враховувати рух.
   */
  getBotTargets() {
    const targets = [];

    if (this.network?.getPlayerTargets) {
      targets.push(...this.network.getPlayerTargets());
    }

    const bots =
      this.isHost ? this.hostBots : this.clientBots;

    if (bots) {
      for (const bot of bots.values()) {
        if (!bot.alive || !bot.position) continue;

        targets.push({
          playerId: bot.id,
          name: bot.name ?? 'Bot',
          team: bot.team,
          isLocal: false,
          isBot: true,
          alive: bot.alive,
          position: bot.position,
          getEyePosition: () => {
            const eye = bot.getEyePosition?.();
            return eye ? eye.clone() : bot.position.clone().setY(bot.position.y + 1.5);
          },
          getState: () => ({ position: bot.position }),
          velocity: bot.velocity ?? { x: 0, y: 0, z: 0 }
        });
      }
    }

    return targets;
  }

  randomSpawn(team = null, avoidId = null) {
    let list =
      this.spawnPoints && this.spawnPoints.length
        ? this.spawnPoints
        : [{ x: 0, y: 0.9, z: 0 }];

    /**
     * Якщо вказано команду — фільтруємо спавни цієї команди.
     */
    if (team) {
      const teamList = list.filter((p) => p.team === team);
      if (teamList.length > 0) {
        list = teamList;
      }
    }

    /**
     * Виключаємо спавни, які зайняті іншими живими ботами
     * (щоб боти не народжувались один на одному).
     */
    const occupied = new Set();

    if (this.hostBots) {
      for (const bot of this.hostBots.values()) {
        if (!bot.alive || (avoidId && bot.id === avoidId)) continue;

        const dist = Math.hypot(
          bot.position.x - (list[0]?.x ?? 0),
          bot.position.z - (list[0]?.z ?? 0)
        );

        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          if (Math.hypot(p.x - bot.position.x, p.z - bot.position.z) < 2.2) {
            occupied.add(i);
          }
        }
      }
    }

    let candidates = [];
    for (let i = 0; i < list.length; i++) {
      if (!occupied.has(i)) {
        candidates.push(list[i]);
      }
    }

    if (candidates.length === 0) {
      candidates = list;
    }

    const spawn =
      candidates[Math.floor(Math.random() * candidates.length)] ??
      candidates[0] ??
      list[0];

    return {
      x: spawn.x ?? 0,
      y: spawn.y ?? 0.9,
      z: spawn.z ?? 0
    };
  }

  spawnHostBots() {
    /**
     * Формат 5v5 (як у CS): кожна команда має 5 гравців.
     * Реальні гравці займають слоти, решту заповнюють боти.
     * Мінімум 1 бот на команду (щоб було з ким грати),
     * максимум — до заповнення 5 слотів.
     */
    const TEAM_SIZE = 5;

    const teams = this.network?.teams ?? {};
    let ctPlayers = 0;
    let tPlayers = 0;

    for (const team of Object.values(teams)) {
      if (team === 'CT') ctPlayers++;
      else if (team === 'T') tPlayers++;
    }

    const ctNeeded = Math.max(1, TEAM_SIZE - ctPlayers);
    const tNeeded = Math.max(1, TEAM_SIZE - tPlayers);

    const botNamesCT = ['Alpha', 'Charlie', 'Echo', 'Golf', 'India'];
    const botNamesT = ['Bravo', 'Delta', 'Foxtrot', 'Hotel', 'Juliet'];

    for (let i = 0; i < ctNeeded; i++) {
      this.spawnHostBot(`Bot ${botNamesCT[i] ?? `CT-${i}`}`, 'CT');
    }

    for (let i = 0; i < tNeeded; i++) {
      this.spawnHostBot(`Bot ${botNamesT[i] ?? `T-${i}`}`, 'T');
    }

    this.assignZones();
  }

  swapBotTeams() {
    if (!this.isHost) {
      return;
    }

    for (const bot of this.hostBots.values()) {
      bot.setTeam(bot.team === 'CT' ? 'T' : 'CT');
    }
  }

  /**
   * Економіка ботів після раунду:
   * перемога = +2500, поразка = +1400, бонус за виживання.
   */
  roundEnd(wonTeam, aliveBots) {
    if (!this.isHost) {
      return;
    }

    for (const bot of this.hostBots.values()) {
      const won = bot.team === wonTeam;
      let gain = won ? 2500 : 1400;

      if (bot.alive) {
        gain += 800;
      }

      bot.money = Math.min((bot.money ?? 800) + gain, 16000);
    }
  }

  spawnHostBot(name, team) {
    this.botCounter++;

    const id = `host-bot-${this.botCounter}`;
    const spawn = this.randomSpawn(team);

    const bot = new HostBot({
      id,
      name,
      team,
      spawn,
      scene: this.scene,
      physics: this.physics,
      navGrid: this.navGrid,
      localPlayerId: this.network.localId,
      getEnemies: () => this.getBotTargets(),
      getBotAllies: (bot) => {
        const result = [];

        for (const b of this.hostBots.values()) {
          if (b !== bot && b.alive && b.team === bot.team) {
            result.push(b);
          }
        }

        return result;
      },
      onHitPlayer: (bot, target, damage, hitZone) => {
        this.onBotHitPlayer(bot, target, damage, hitZone);
      },
      onKill: (bot, attackerName, weaponId, headshot, attackerId) => {
        this.onBotKill(bot, attackerName, weaponId, headshot, attackerId);
      },
      onDamage: (bot, damage, hitZone) => {
        this.onLocalHitHostBot(bot, damage, hitZone);
      },
      onShot: (bot, origin, end) => {
        this.onBotShot(bot, origin, end);
      },
      onStep: (position) => {
        this.audio?.playFootstep({
          position,
          surface: detectSurface(this.physics, position)
        });
      },
      onThrowGrenade: (position, dir, type, throwerId) => {
        this.grenadeManager?.throwGrenadeFrom?.(position, dir, type, throwerId);
      },
      smokeBlock: (origin, dir, dist) => {
        return this.grenadeManager?.isBlockedBySmoke?.(
          origin,
          dir,
          dist
        ) ?? null;
      },
      onRadio: (bot, kind, position) => {
        this.handleBotRadio(bot, kind, position);
      }
    });

    /**
     * Рівні складності (впливають на реакцію, точність, тактику):
     *   hard   — профі: 120-220ms реакція, spread ×0.4, агресивні
     *   medium — досвід: 180-320ms, spread ×0.7, збалансовані
     *   easy   — новач: 300-550ms, spread ×1.2, обережні
     *
     * Кожен бот випадково отримує рівень з розподілом:
     *   40% medium, 35% hard, 25% easy.
     */
    const roll = Math.random();
    let diff;
    if (roll < 0.35) diff = 'hard';
    else if (roll < 0.75) diff = 'medium';
    else diff = 'easy';

    bot.difficulty = diff;

    const skillPresets = {
      hard:   { reaction: [0.08, 0.18], spread: [0.30, 0.50], aggression: [0.75, 0.95], aimSnap: 0.85, moveAccuracy: 0.6 },
      medium: { reaction: [0.15, 0.26], spread: [0.55, 0.80], aggression: [0.50, 0.75], aimSnap: 0.70, moveAccuracy: 0.75 },
      easy:   { reaction: [0.28, 0.42], spread: [0.90, 1.30], aggression: [0.25, 0.50], aimSnap: 0.50, moveAccuracy: 0.90 }
    };

    const p = skillPresets[diff];
    const rnd = (a, b) => a + Math.random() * (b - a);

    bot.skill = {
      reaction: rnd(...p.reaction),
      spread: rnd(...p.spread),
      aggression: rnd(...p.aggression),
      aimSnap: p.aimSnap,
      moveAccuracy: p.moveAccuracy
    };

    /**
     * Ролі: чергування rusher/camper/support у кожній команді,
     * щоб команда діяла різноманітно.
     */
    this.roleCounter = (this.roleCounter ?? 0) + 1;

    const roleIndex = this.roleCounter % 3;
    bot.role = roleIndex === 0 ? 'rusher' : roleIndex === 1 ? 'camper' : 'support';

    if (bot.role === 'rusher') {
      bot.skill.aggression = Math.max(bot.skill.aggression, 0.85);
    } else if (bot.role === 'camper') {
      bot.skill.aggression = Math.min(bot.skill.aggression, 0.45);
    }

    bot.getTargetCounts = () => this.botTargetCounts();
    bot.getGrenades = () => this.grenadeManager?.grenades ?? [];
    bot.getDoors = () => this.doorSystem?.doors?.values
      ? [...this.doorSystem.doors.values()]
      : [];
    bot.getZones = () => this.botZones?.[bot.team] ?? [];
    bot.zoneIndex = 0;

    this.hostBots.set(id, bot);
  }

  botTargetCounts() {
    const counts = new Map();

    for (const bot of this.hostBots.values()) {
      if (!bot.alive || !bot.currentTargetId) {
        continue;
      }

      counts.set(
        bot.currentTargetId,
        (counts.get(bot.currentTargetId) ?? 0) + 1
      );
    }

    return counts;
  }

  /**
   * Розподілити ботів по зонах карти, щоб команда
   * не купчилася в одному місці.
   * Якщо карта має botZones — боти займають тактичні
   * позиції (балкони, входи, фланги), інакше — коло
   * навколо центру спавнів.
   */
  assignZones() {
    const alive = [...this.hostBots.values()].filter((b) => b.alive);
    const teams = { CT: [], T: [] };

    for (const bot of alive) {
      teams[bot.team]?.push(bot);
    }

    for (const team of ['CT', 'T']) {
      const bots = teams[team];

      if (!bots || bots.length <= 1) {
        continue;
      }

      const zones = this.botZones?.[team];

      if (zones && zones.length > 0) {
        bots.forEach((bot, index) => {
          const zone = zones[index % zones.length];

          bot.zoneCenter = new THREE.Vector3(
            zone.x + (Math.random() - 0.5) * 2,
            zone.y ?? 0.9,
            zone.z + (Math.random() - 0.5) * 2
          );
        });

        continue;
      }

      const center = this.teamSpawnCenter(team);

      bots.forEach((bot, index) => {
        bot.zoneIndex = index % 4;

        const angle = (bot.zoneIndex / 4) * Math.PI * 2 + Math.random() * 0.4;
        const radius = 8 + Math.random() * 8;

        bot.zoneCenter = new THREE.Vector3(
          center.x + Math.cos(angle) * radius,
          center.y,
          center.z + Math.sin(angle) * radius
        );
      });
    }
  }

  teamSpawnCenter(team) {
    const pts = (this.spawnPoints ?? [])
      .filter((p) => p.team === team)
      .map((p) => ({ x: p.x, z: p.z }));

    if (pts.length === 0) {
      return { x: 0, y: 0.9, z: 0 };
    }

    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;

    return { x: cx, y: 0.9, z: cz };
  }

  onBotHitPlayer(bot, target, damage, hitZone) {
    /**
     * Бот влучив у іншого бота — застосовуємо шкоду напряму
     * (хост — авторитет для bot-vs-bot бою).
     */
    if (target.isBot) {
      const victim = this.hostBots.get(target.playerId);

      if (victim && victim.alive) {
        victim.applyDamage(
          damage,
          bot.name,
          'bot_rifle',
          hitZone,
          bot.position,
          bot.id
        );
      }
      return;
    }

    const message = {
      id: bot.id,
      targetId: target.playerId,
      attackerId: bot.id,
      attackerName: bot.name,
      damage,
      weaponId: 'bot_rifle',
      hitZone,
      headshot: hitZone === 'head'
    };

    if (target.isLocal) {
      this.network.handleDamage(message);

      if (!this.network.alive) {
        bot.kills = (bot.kills ?? 0) + 1;
      }
    } else {
      /**
       * Віддалений гравець — також зараховуємо kill боту
       * (хост — авторитет). Death гравця підтвердить
       * kill через game:kill назад.
       */
      bot.kills = (bot.kills ?? 0) + 1;

      this.network.send({
        type: 'game:damage',
        ...message
      });
    }
  }

  /**
   * Поширити звук серед ботів-хоста (крім джерела).
   */
  reportSoundToBots(position, type = 'shot', excludeId = null) {
    if (!this.hostBots) {
      return;
    }

    for (const bot of this.hostBots.values()) {
      if (excludeId && bot.id === excludeId) {
        continue;
      }

      bot.hearSound?.(position, type);
    }
  }

  /**
   * Радіо-команда бота: програємо звук для гравця
   * (якщо поруч) і сповіщаємо союзників-ботів
   * (вони "чують" позицію ворога через радіо).
   */
  handleBotRadio(bot, kind, position) {
    const pos = new THREE.Vector3(
      position?.x ?? bot.position.x,
      position?.y ?? bot.position.y,
      position?.z ?? bot.position.z
    );

    /**
     * Звук для локального гравця (гучність залежить від відстані).
     */
    if (this.network?.player) {
      const dist = this.network.player.position.distanceTo(pos);

      if (dist < 60) {
        this.audio?.playRadio?.(pos, kind);
      }
    }

    /**
     * Сповіщення союзників: radio передає позицію ворога.
     * Тільки для 'spot' (виявлення) і 'kill'.
     */
    if (kind === 'spot' || kind === 'kill') {
      this.reportSoundToBots(pos, 'shot', bot.id);
    }
  }

  onBotKill(bot, attackerName, weaponId, headshot, attackerId) {
    bot.deaths = (bot.deaths ?? 0) + 1;
    if (attackerId && attackerId !== bot.id) {
      const killer = this.hostBots?.get(attackerId);

      if (killer) {
        killer.kills = (killer.kills ?? 0) + 1;
        killer.money = Math.min(killer.money + 300, 16000);
      }
    }

    this.killFeed?.add({
      killerName: attackerName,
      victimName: bot.name,
      weaponId,
      headshot
    });

    this.network.send({
      type: 'game:kill',
      id: bot.id,
      killerId: attackerId ?? bot.id,
      killerName: attackerName,
      victimId: bot.id,
      victimName: bot.name,
      weaponId,
      headshot
    });
  }

  onBotShot(bot, origin, end) {
    const weaponId = bot?.weapon?.id ?? 'bot_rifle';

    this.weaponManager?.spawnTracer?.(origin, end, weaponId);

    this.audio?.playShot({
      weaponId,
      position: origin
    });

    this.reportSoundToBots(origin, 'shot', bot.id);

    this.network.send({
      type: 'game:shot',
      id: this.network.localId,
      weaponId,
      origin: {
        x: origin.x,
        y: origin.y,
        z: origin.z
      },
      end: {
        x: end.x,
        y: end.y,
        z: end.z
      }
    });
  }

  onLocalHitHostBot(bot, damage, hitZone) {
    if (!this.isHost) {
      return;
    }

    if (bot.team === this.localTeam) {
      return;
    }

    bot.applyDamage(
      damage,
      this.network.localName,
      this.weaponManager?.current?.id ?? 'weapon',
      hitZone,
      this.network.player?.position ?? null,
      this.network.localId
    );
  }

  onLocalHitClientBot(botId, botTeam, damage, hitZone) {
    if (!this.enabled || this.isHost) {
      return;
    }

    if (botTeam === this.localTeam) {
      return;
    }

    this.network.send({
      type: 'game:bot_damage',
      id: this.network.localId,
      botId,
      attackerId: this.network.localId,
      attackerName: this.network.localName,
      attackerTeam: this.localTeam,
      damage,
      weaponId: this.weaponManager?.current?.id ?? 'weapon',
      hitZone,
      headshot: hitZone === 'head'
    });
  }

  handleMessage(message) {
    if (!message?.type) {
      return;
    }

    if (message.type === 'game:bot_state' && !this.isHost) {
      this.updateClientBots(message.bots ?? []);
    }

    if (message.type === 'game:bot_damage' && this.isHost) {
      this.applyBotDamageFromNetwork(message);
    }
  }

  applyBotDamageFromNetwork(message) {
    const bot = this.hostBots.get(message.botId);

    if (!bot) {
      return;
    }

    if (message.attackerTeam === bot.team) {
      return;
    }

    const attacker = this.network.peers.get(message.attackerId);

    bot.applyDamage(
      message.damage ?? 0,
      message.attackerName ?? 'Player',
      message.weaponId ?? 'weapon',
      message.hitZone ?? 'chest',
      attacker?.position ?? null,
      message.attackerId ?? null
    );
  }

  ensureClientBot(snapshot) {
    if (!this.clientBots.has(snapshot.id)) {
      const bot = new ClientBot({
        id: snapshot.id,
        team: snapshot.team ?? 'T',
        scene: this.scene,
        physics: this.physics,
        onDamage: (botId, botTeam, damage, hitZone) => {
          this.onLocalHitClientBot(botId, botTeam, damage, hitZone);
        }
      });

      this.clientBots.set(snapshot.id, bot);
    }

    return this.clientBots.get(snapshot.id);
  }

  separateBots() {
    const bots = [];

    for (const bot of this.hostBots.values()) {
      if (bot.alive) {
        bots.push(bot);
      }
    }

    const targets = this.network.getPlayerTargets?.() ?? [];

    const players = targets.filter((target) => target.alive);

    for (let i = 0; i < bots.length; i++) {
      for (let j = i + 1; j < bots.length; j++) {
        this.separatePair(bots[i], bots[j], true);
      }
    }

    for (const bot of bots) {
      for (const player of players) {
        this.separatePair(bot, player, false);
      }
    }
  }

  separatePair(a, b, pushBoth) {
    const dx = b.position.x - a.position.x;
    const dz = b.position.z - a.position.z;

    const minDist = 0.65;
    const d2 = dx * dx + dz * dz;

    if (d2 >= minDist * minDist) {
      return;
    }

    const d = Math.sqrt(d2);

    if (d < 0.001) {
      a.position.x -= 0.4;
      b.position.x += 0.4;
      return;
    }

    const nx = dx / d;
    const nz = dz / d;

    const push = (minDist - d) * (pushBoth ? 0.5 : 1);

    a.position.x -= nx * push;
    a.position.z -= nz * push;

    if (pushBoth) {
      b.position.x += nx * push;
      b.position.z += nz * push;
    }
  }

  updateClientBots(snapshots) {
    const aliveIds = new Set();

    for (const snapshot of snapshots) {
      aliveIds.add(snapshot.id);

      const bot = this.ensureClientBot(snapshot);
      bot.updateFromSnapshot(snapshot);
    }

    for (const [id, bot] of this.clientBots) {
      if (!aliveIds.has(id)) {
        bot.dispose();
        this.clientBots.delete(id);
      }
    }
  }

  broadcastHostBots() {
    const bots = [];

    for (const bot of this.hostBots.values()) {
      bots.push({
        id: bot.id,
        team: bot.team,
        name: bot.name,
        x: bot.position.x,
        y: bot.position.y,
        z: bot.position.z,
        yaw: bot.yaw,
        health: bot.health,
        alive: bot.alive,
        kills: bot.kills ?? 0,
        deaths: bot.deaths ?? 0
      });
    }

    this.network.send({
      type: 'game:bot_state',
      id: this.network.localId,
      bots
    });
  }

  update(dt) {
    if (!this.enabled) {
      return;
    }

    if (this.isHost) {
      for (const bot of this.hostBots.values()) {
        if (!bot.alive) {
          bot.deathTimer -= dt;

          if (bot.deathTimer <= 0) {
            bot.respawn(this.randomSpawn(bot.team));
          }
        } else {
          bot.update(dt);
        }
      }

      this.separateBots();

      this.sendAccumulator += dt;

      if (this.sendAccumulator >= 0.12) {
        this.broadcastHostBots();
        this.sendAccumulator = 0;
      }
    } else {
      for (const bot of this.clientBots.values()) {
        bot.update(dt);
      }
    }
  }

  dispose() {
    for (const bot of this.hostBots.values()) {
      bot.dispose();
    }

    for (const bot of this.clientBots.values()) {
      bot.dispose();
    }

    this.hostBots.clear();
    this.clientBots.clear();
  }
}
