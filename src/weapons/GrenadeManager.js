import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const GRENADE_CONFIG = {
  he: {
    fuse: 1.7,
    color: 0x4a6b35,
    radius: 7.5,
    maxDamage: 92
  },
  flash: {
    fuse: 1.3,
    color: 0xd9d9cf,
    radius: 22,
    maxDamage: 0
  },
  smoke: {
    fuse: 1.4,
    color: 0x8a8a8a,
    radius: 4.2,
    duration: 13
  }
};

/**
 * GrenadeManager:
 * - інвентар гранат;
 * - кидок з фізикою (гравітація + відскоки);
 * - HE: вибух, шкода по радіусу з LOS;
 * - Flash: засліплення за кутом огляду;
 * - Smoke: дим, що блокує постріли та зір ботів;
 * - синхронізація кидків між клієнтами.
 */
export class GrenadeManager {
  constructor({
    scene,
    physics,
    player,
    camera,
    input,
    network = null,
    networkBots = null,
    audio = null,
    decals = null,
    hud = null
  }) {
    this.scene = scene;
    this.physics = physics;
    this.player = player;
    this.camera = camera;
    this.input = input;
    this.network = network;
    this.networkBots = networkBots;
    this.audio = audio;
    this.decals = decals;
    this.hud = hud;

    this.inventory = {
      he: 0,
      flash: 0,
      smoke: 0
    };

    this.selected = null;

    this.grenades = [];
    this.smokes = [];
    this.effects = [];

    this.smokeTexture = this.createSmokeTexture();

    this._onKeyDown = this.onKeyDown.bind(this);
    this._onMouseDown = this.onMouseDown.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('mousedown', this._onMouseDown);
  }

  canBuy(type) {
    const max = type === 'flash' ? 2 : 1;

    return (this.inventory[type] ?? 0) < max;
  }

  buy(type) {
    if (!this.canBuy(type)) {
      return false;
    }

    this.inventory[type]++;

    if (!this.selected) {
      this.selected = type;
    }

    return true;
  }

  cycle() {
    const order = ['he', 'flash', 'smoke'];

    const available = order.filter(
      (type) => (this.inventory[type] ?? 0) > 0
    );

    if (!available.length) {
      this.selected = null;
      return;
    }

    const currentIndex = available.indexOf(this.selected);

    this.selected =
      available[(currentIndex + 1) % available.length];
  }

  onKeyDown(event) {
    if (!this.input?.pointerLocked) {
      return;
    }

    if (event.code === 'KeyG') {
      this.cycle();
    }
  }

  onMouseDown(event) {
    if (event.button !== 0) {
      return;
    }

    if (!this.input?.pointerLocked) {
      return;
    }

    if (!this.selected) {
      return;
    }

    if ((this.inventory[this.selected] ?? 0) <= 0) {
      this.selected = null;
      return;
    }

    this.throwGrenade(this.selected);
  }

  throwGrenade(type) {
    const config = GRENADE_CONFIG[type];

    if (!config) {
      return;
    }

    if ((this.inventory[type] ?? 0) <= 0) {
      return;
    }

    this.inventory[type]--;

    const direction = this.player.getDirection();

    const origin = this.camera.position
      .clone()
      .addScaledVector(direction, 0.45);

    origin.y -= 0.12;

    const velocity = direction
      .clone()
      .multiplyScalar(15.5)
      .add(new THREE.Vector3(0, 2.7, 0));

    velocity.addScaledVector(this.player.velocity, 0.55);

    this.spawnGrenade(
      type,
      origin,
      velocity,
      true,
      this.network?.localId ?? 'local'
    );

    this.audio?.playThrow?.();

    if (this.inventory[type] <= 0) {
      this.cycle();
    }

    this.network?.send?.({
      type: 'game:grenade',
      id: this.network?.localId,
      grenadeType: type,
      origin: {
        x: origin.x,
        y: origin.y,
        z: origin.z
      },
      velocity: {
        x: velocity.x,
        y: velocity.y,
        z: velocity.z
      }
    });
  }

  /**
   * Кидок гранати ботом: точка кидка + напрямок до цілі.
   * Не використовує інвентар гравця.
   */
  throwGrenadeFrom(position, direction, type, throwerId) {
    const config = GRENADE_CONFIG[type];

    if (!config) {
      return;
    }

    const origin = new THREE.Vector3(
      position.x,
      position.y + 1.5,
      position.z
    );

    const dir = direction.clone().normalize();

    const velocity = dir
      .multiplyScalar(15.5)
      .add(new THREE.Vector3(0, 2.7, 0));

    this.spawnGrenade(
      type,
      origin,
      velocity,
      false,
      throwerId ?? 'bot'
    );

    this.audio?.playThrow?.({ position: origin });

    this.network?.send?.({
      type: 'game:grenade',
      id: this.network?.localId,
      grenadeType: type,
      origin: {
        x: origin.x,
        y: origin.y,
        z: origin.z
      },
      velocity: {
        x: velocity.x,
        y: velocity.y,
        z: velocity.z
      },
      thrownByLocal: false,
      throwerId: throwerId ?? 'bot'
    });
  }

  handleMessage(message) {
    if (message?.type !== 'game:grenade') {
      return;
    }

    const senderId = message.id ?? message.senderId;

    if (!senderId || senderId === this.network?.localId) {
      return;
    }

    this.spawnGrenade(
      message.grenadeType,
      message.origin,
      message.velocity,
      false,
      senderId
    );
  }

  spawnGrenade(type, origin, velocity, thrownByLocal, throwerId) {
    const config = GRENADE_CONFIG[type];

    if (!config || !origin || !velocity) {
      return;
    }

    const startPosition = new THREE.Vector3(
      origin.x,
      origin.y,
      origin.z
    );

    const startVelocity = new THREE.Vector3(
      velocity.x,
      velocity.y,
      velocity.z
    );

    const geometry = new THREE.SphereGeometry(0.09, 10, 10);

    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.5,
      metalness: 0.2
    });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.copy(startPosition);
    mesh.castShadow = true;

    this.scene.add(mesh);

    this.grenades.push({
      type,
      position: startPosition,
      prev: startPosition.clone(),
      velocity: startVelocity,
      fuse: config.fuse,
      mesh,
      geometry,
      material,
      thrownByLocal,
      throwerId
    });
  }

  update(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const grenade = this.grenades[i];

      grenade.fuse -= dt;

      this.simulate(grenade, dt);

      if (grenade.fuse <= 0) {
        this.grenades.splice(i, 1);
        this.explode(grenade);
      }
    }

    this.updateSmokes(dt);
    this.updateEffects(dt);
  }

  simulate(grenade, dt) {
    const substeps = 2;
    const step = dt / substeps;

    for (let s = 0; s < substeps; s++) {
      grenade.prev.copy(grenade.position);

      grenade.velocity.y -= 19.6 * step;

      grenade.position.addScaledVector(grenade.velocity, step);

      const moveX = grenade.position.x - grenade.prev.x;
      const moveY = grenade.position.y - grenade.prev.y;
      const moveZ = grenade.position.z - grenade.prev.z;

      const distance = Math.hypot(moveX, moveY, moveZ);

      if (distance < 0.0001) {
        continue;
      }

      const dirX = moveX / distance;
      const dirY = moveY / distance;
      const dirZ = moveZ / distance;

      try {
        const ray = new RAPIER.Ray(
          {
            x: grenade.prev.x,
            y: grenade.prev.y,
            z: grenade.prev.z
          },
          {
            x: dirX,
            y: dirY,
            z: dirZ
          }
        );

        const hit = this.physics.world.castRayAndGetNormal(
          ray,
          distance + 0.05,
          true
        );

        if (hit && hit.timeOfImpact <= distance) {
          const normal = hit.normal ?? { x: 0, y: 1, z: 0 };

          grenade.position.set(
            grenade.prev.x + dirX * hit.timeOfImpact + normal.x * 0.1,
            grenade.prev.y + dirY * hit.timeOfImpact + normal.y * 0.1,
            grenade.prev.z + dirZ * hit.timeOfImpact + normal.z * 0.1
          );

          const v = grenade.velocity;

          const dot =
            v.x * normal.x +
            v.y * normal.y +
            v.z * normal.z;

          v.x = (v.x - 2 * dot * normal.x) * 0.42;
          v.y = (v.y - 2 * dot * normal.y) * 0.42;
          v.z = (v.z - 2 * dot * normal.z) * 0.42;

          if (v.lengthSq() < 0.5) {
            v.set(0, 0, 0);
          }
        }
      } catch {
        // ignore physics errors
      }
    }

    grenade.mesh.position.copy(grenade.position);
    grenade.mesh.rotation.x += dt * 6;
    grenade.mesh.rotation.z += dt * 4;
  }

  explode(grenade) {
    this.scene.remove(grenade.mesh);
    grenade.geometry.dispose();
    grenade.material.dispose();

    const config = GRENADE_CONFIG[grenade.type];

    if (grenade.type === 'he') {
      this.explodeHE(grenade, config);
    } else if (grenade.type === 'flash') {
      this.explodeFlash(grenade, config);
    } else if (grenade.type === 'smoke') {
      this.explodeSmoke(grenade, config);
    }
  }

  explodeHE(grenade, config) {
    const position = grenade.position;

    this.spawnExplosionEffect(position, config.radius);

    this.audio?.playExplosion?.(position);

    this.decals?.add?.(position, { x: 0, y: -1, z: 0 }, 'hole');

    const cameraDistance = this.camera.position.distanceTo(position);

    if (cameraDistance < 14) {
      const intensity = (1 - cameraDistance / 14) * 0.035;

      if (this.player) {
        this.player.recoilPitch += (Math.random() - 0.5) * intensity * 2;
        this.player.recoilYaw += (Math.random() - 0.5) * intensity * 2;
      }
    }

    /**
     * Хост обраховує шкоду для всіх гранат (своїх і ботів).
     * Клієнти — тільки для власних гранат (решта через network damage).
     */
    const isHost = this.networkBots?.isHost === true;

    if (!grenade.thrownByLocal && !isHost) {
      return;
    }

    /**
     * Самошкода від власної HE.
     */
    if (cameraDistance < config.radius) {
      const damage = Math.round(
        config.maxDamage * (1 - cameraDistance / config.radius)
      );

      if (damage > 0 && this.network?.handleDamage) {
        this.network.handleDamage({
          targetId: this.network.localId,
          attackerId: this.network.localId,
          attackerName: this.network.localName,
          damage,
          weaponId: 'he',
          hitZone: 'legs',
          headshot: false
        });
      }
    }

    this.applyThrowerDamage(grenade, config);
  }

  applyThrowerDamage(grenade, config) {
    if (!this.network) {
      return;
    }

    /**
     * Команда КИДАЧА (не гравця!): якщо HE кинув бот,
     * його вороги — протилежна команда бота.
     */
    const throwerId = grenade.throwerId;
    const isBotGrenade =
      throwerId &&
      typeof throwerId === 'string' &&
      throwerId.startsWith('host-bot-');

    let throwerTeam = null;

    if (isBotGrenade && this.networkBots?.hostBots) {
      const bot = this.networkBots.hostBots.get(throwerId);
      throwerTeam = bot?.team ?? null;
    }

    const localTeam = this.network.getLocalTeam?.() ?? 'CT';
    const damageTeam = throwerTeam ?? localTeam;

    const position = grenade.position;

    /**
     * Гравці.
     */
    const targets = this.network.getPlayerTargets?.() ?? [];

    for (const target of targets) {
      if (!target.alive || target.isLocal) {
        continue;
      }

      if (target.team === damageTeam) {
        continue;
      }

      const distance = target.position.distanceTo(position);

      if (distance > config.radius) {
        continue;
      }

      if (!this.hasLOS(position, target.getEyePosition())) {
        continue;
      }

      const damage = Math.round(
        config.maxDamage * (1 - distance / config.radius)
      );

      if (damage <= 0) {
        continue;
      }

      this.network.send({
        type: 'game:damage',
        id: this.network.localId,
        targetId: target.playerId,
        attackerId: this.network.localId,
        attackerName: this.network.localName,
        damage,
        weaponId: 'he',
        hitZone: 'chest',
        headshot: false
      });
    }

    /**
     * Боти: хост застосовує шкоду сам,
     * клієнт відправляє bot_damage хосту.
     */
    const isHost = this.networkBots?.isHost === true;

    const bots = isHost
      ? this.networkBots.hostBots.values()
      : this.networkBots?.clientBots?.values?.() ?? [];

    for (const bot of bots) {
      if (!bot.alive) {
        continue;
      }

      if (bot.team === damageTeam) {
        continue;
      }

      const distance = bot.position.distanceTo(position);

      if (distance > config.radius) {
        continue;
      }

      const eye = {
        x: bot.position.x,
        y: bot.position.y + 1.55,
        z: bot.position.z
      };

      if (!this.hasLOS(position, eye)) {
        continue;
      }

      const damage = Math.round(
        config.maxDamage * (1 - distance / config.radius)
      );

      if (damage <= 0) {
        continue;
      }

      if (isHost) {
        bot.applyDamage(
          damage,
          isBotGrenade
            ? this.networkBots.hostBots.get(throwerId)?.name ?? 'Bot'
            : this.network.localName,
          'he',
          'chest',
          grenade.position,
          throwerId ?? this.network.localId
        );
      } else {
        this.network.send({
          type: 'game:bot_damage',
          botId: bot.id,
          attackerId: this.network.localId,
          attackerName: this.network.localName,
          attackerTeam: localTeam,
          damage,
          weaponId: 'he',
          hitZone: 'chest',
          headshot: false
        });
      }
    }
  }

  hasLOS(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;

    const distance = Math.hypot(dx, dy, dz);

    if (distance < 0.001) {
      return true;
    }

    const hit = this.physics.raycast(
      from,
      {
        x: dx / distance,
        y: dy / distance,
        z: dz / distance
      },
      distance,
      null
    );

    return !hit || hit.distance >= distance - 0.25;
  }

  explodeFlash(grenade, config) {
    const position = grenade.position;

    this.audio?.playFlash?.(position);

    const light = new THREE.PointLight(0xffffff, 12, 30, 2);
    light.position.copy(position);
    this.scene.add(light);

    this.effects.push({
      mesh: null,
      geometry: null,
      material: null,
      light,
      life: 0.25,
      maxLife: 0.25,
      maxScale: 1
    });

    /**
     * Засліплення локального гравця.
     */
    const cameraPosition = this.camera.position;
    const distance = cameraPosition.distanceTo(position);

    if (distance < config.radius) {
      const dirTo = new THREE.Vector3()
        .copy(position)
        .sub(cameraPosition);

      if (dirTo.lengthSq() > 0.0001) {
        dirTo.normalize();
      }

      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);

      const facing = forward.dot(dirTo);

      const los = this.hasLOS(position, cameraPosition);

      let intensity = 1 - distance / config.radius;

      intensity *= Math.max(0.12, (facing + 1) / 2);

      if (!los) {
        intensity *= 0.12;
      }

      this.hud?.flashFlash?.(Math.min(1, intensity * 1.35));
    }

    /**
     * Боти: засліплення за тими ж правилами (дистанція + кут огляду + LOS).
     * Сліплять лише хост-ботів — на клієнтах вони не приймають рішень.
     */
    if (this.networkBots?.isHost) {
      for (const bot of this.networkBots.hostBots.values()) {
        if (!bot.alive) {
          continue;
        }

        const botEye = {
          x: bot.position.x,
          y: bot.position.y + 1.55,
          z: bot.position.z
        };

        const dirTo = {
          x: position.x - botEye.x,
          y: position.y - botEye.y,
          z: position.z - botEye.z
        };

        const botDistance = Math.hypot(
          dirTo.x,
          dirTo.y,
          dirTo.z
        );

        if (botDistance > config.radius || botDistance < 0.001) {
          continue;
        }

        const nx = dirTo.x / botDistance;
        const nz = dirTo.z / botDistance;

        const forward = bot.getForward?.();

        const facing = forward ? forward.x * nx + forward.z * nz : 0;

        if (facing < 0.15) {
          continue;
        }

        const los = this.hasLOS(position, botEye);

        let intensity = 1 - botDistance / config.radius;

        intensity *= Math.max(0.12, (facing + 1) / 2);

        if (!los) {
          intensity *= 0.12;
        }

        bot.applyFlash?.(Math.min(1, intensity * 1.35));
      }
    }
  }

  explodeSmoke(grenade, config) {
    const position = grenade.position;

    this.audio?.playSmoke?.(position);

    if (this.smokes.length >= 4) {
      const oldest = this.smokes.shift();

      for (const sprite of oldest.particles) {
        sprite.material.dispose();
      }

      this.scene.remove(oldest.group);
    }

    const group = new THREE.Group();
    group.position.copy(position);

    const particles = [];

    for (let i = 0; i < 26; i++) {
      const material = new THREE.SpriteMaterial({
        map: this.smokeTexture,
        color: 0x9aa2a6,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });

      const sprite = new THREE.Sprite(material);

      sprite.position.set(
        (Math.random() - 0.5) * 2.4,
        Math.random() * 1.6,
        (Math.random() - 0.5) * 2.4
      );

      sprite.scale.setScalar(1.9 + Math.random() * 1.7);

      sprite.userData.growRate = 0.5 + Math.random() * 0.5;
      sprite.userData.targetOpacity = 0.55 + Math.random() * 0.25;
      sprite.userData.driftX = (Math.random() - 0.5) * 0.3;
      sprite.userData.driftY = 0.08 + Math.random() * 0.18;
      sprite.userData.driftZ = (Math.random() - 0.5) * 0.3;

      group.add(sprite);
      particles.push(sprite);
    }

    this.scene.add(group);

    this.smokes.push({
      position: position.clone(),
      radius: config.radius,
      life: config.duration,
      maxLife: config.duration,
      group,
      particles
    });
  }

  /**
   * Перетин променя зі сферою диму.
   * Повертає дистанцію до поверхні диму або null.
   */
  isBlockedBySmoke(origin, direction, maxDistance) {
    let nearest = null;

    for (const smoke of this.smokes) {
      const radius = smoke.radius;

      const ox = origin.x - smoke.position.x;
      const oy = origin.y - smoke.position.y;
      const oz = origin.z - smoke.position.z;

      const dx = direction.x;
      const dy = direction.y;
      const dz = direction.z;

      const b = ox * dx + oy * dy + oz * dz;
      const c = ox * ox + oy * oy + oz * oz - radius * radius;

      const discriminant = b * b - c;

      if (discriminant < 0) {
        continue;
      }

      let t = -b - Math.sqrt(discriminant);

      if (t < 0) {
        t = -b + Math.sqrt(discriminant);
      }

      if (t < 0) {
        t = 0.01;
      }

      if (t <= maxDistance && (nearest === null || t < nearest)) {
        nearest = t;
      }
    }

    return nearest;
  }

  spawnExplosionEffect(position, radius) {
    const geometry = new THREE.SphereGeometry(1, 12, 12);

    const material = new THREE.MeshBasicMaterial({
      color: 0xffa040,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);

    const light = new THREE.PointLight(0xffa040, 9, 24, 2);
    light.position.copy(position);

    this.scene.add(mesh);
    this.scene.add(light);

    this.effects.push({
      mesh,
      geometry,
      material,
      light,
      life: 0.32,
      maxLife: 0.32,
      maxScale: Math.max(1.5, radius * 0.75)
    });
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];

      effect.life -= dt;

      const t = 1 - Math.max(0, effect.life) / effect.maxLife;
      const eased = 1 - Math.pow(1 - t, 3);

      if (effect.mesh) {
        effect.mesh.scale.setScalar(0.3 + effect.maxScale * eased);
        effect.material.opacity = (1 - t) * 0.9;
      }

      if (effect.light) {
        effect.light.intensity = (1 - t) * 9;
      }

      if (effect.life <= 0) {
        if (effect.mesh) {
          this.scene.remove(effect.mesh);
          effect.geometry.dispose();
          effect.material.dispose();
        }

        if (effect.light) {
          this.scene.remove(effect.light);
        }

        this.effects.splice(i, 1);
      }
    }
  }

  updateSmokes(dt) {
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const smoke = this.smokes[i];

      smoke.life -= dt;

      const elapsed = smoke.maxLife - smoke.life;
      const fadeIn = Math.min(1, elapsed / 0.9);
      const fadeOut = Math.min(1, smoke.life / 2.5);

      for (const sprite of smoke.particles) {
        if (sprite.scale.x < smoke.radius * 1.7) {
          sprite.scale.addScalar(sprite.userData.growRate * dt);
        }

        sprite.position.x += sprite.userData.driftX * dt;
        sprite.position.y += sprite.userData.driftY * dt;
        sprite.position.z += sprite.userData.driftZ * dt;

        sprite.material.opacity =
          sprite.userData.targetOpacity * fadeIn * fadeOut;
      }

      if (smoke.life <= 0) {
        for (const sprite of smoke.particles) {
          sprite.material.dispose();
        }

        this.scene.remove(smoke.group);
        this.smokes.splice(i, 1);
      }
    }
  }

  createSmokeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;

    const context = canvas.getContext('2d');

    const gradient = context.createRadialGradient(
      64,
      64,
      8,
      64,
      64,
      64
    );

    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);

    return new THREE.CanvasTexture(canvas);
  }
}
