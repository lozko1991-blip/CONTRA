import * as THREE from 'three';
import { getMaterial } from '../engine/TextureFactory.js';

const DOOR_CSS = `
.door-prompt {
  position: fixed;
  left: 50%;
  bottom: 24%;
  transform: translateX(-50%);
  z-index: 1400;
  padding: 7px 16px;
  border: 1px solid rgba(255, 210, 138, 0.55);
  background: rgba(8, 10, 12, 0.72);
  color: #ffd28a;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}
`;

/**
 * Door — одні двері.
 *
 * - візуал: панель на петлях, ручка, рама;
 * - фізика: collider у закритому стані, відсутній у відкритому;
 * - анімація: пружина з легким перельотом;
 * - руйнування: падіння панелі + зникнення.
 */
class Door {
  constructor({
    id,
    scene,
    physics,
    audio,
    position,
    rotationY = 0,
    width = 1.2,
    height = 2.2,
    material = 'doorWood',
    flip = false,
    openDir = 1
  }) {
    this.id = id;
    this.scene = scene;
    this.physics = physics;
    this.audio = audio;
    this.system = null;

    this.position = new THREE.Vector3(
      position[0] ?? 0,
      position[1] ?? 0,
      position[2] ?? 0
    );

    this.rotationY = rotationY;
    this.width = width;
    this.height = height;
    this.matKey = material;
    this.flip = flip;
    this.openDir = openDir;

    this.state = 'closed';
    this.angle = 0;
    this.angleVel = 0;

    this.hp = material === 'doorMetal' ? 160 : 90;

    this.autoHoldTimer = 0;
    this.destroyTime = 0;
    this.removed = false;

    this.colliderBody = null;

    const sign = this.flip ? -1 : 1;
    const center = this.localToWorldXZ((sign * this.width) / 2);

    this.center = new THREE.Vector3(
      center.x,
      this.height / 2,
      center.z
    );

    this.buildMesh();
    this.spawnCollider();
  }

  localToWorldXZ(lx, lz = 0) {
    const cos = Math.cos(this.rotationY);
    const sin = Math.sin(this.rotationY);

    return {
      x: this.position.x + lx * cos + lz * sin,
      z: this.position.z - lx * sin + lz * cos
    };
  }

  buildMesh() {
    const sign = this.flip ? -1 : 1;
    const isMetal = this.matKey === 'doorMetal';

    this.hinge = new THREE.Group();
    this.hinge.position.copy(this.position);
    this.hinge.rotation.y = this.rotationY;

    /**
     * Панель (матеріал клонується, щоб руйнування
     * могло фейдити конкретні двері).
     */
    this.panelMaterial = getMaterial(this.matKey).clone();

    this.panel = new THREE.Mesh(
      new THREE.BoxGeometry(this.width, this.height, 0.08),
      this.panelMaterial
    );

    this.panel.position.set(
      (sign * this.width) / 2,
      this.height / 2,
      0
    );

    this.panel.castShadow = true;
    this.panel.receiveShadow = true;

    this.hinge.add(this.panel);

    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.035, 0.05),
      getMaterial(isMetal ? 'metal' : 'darkMetal')
    );

    handle.position.set(
      sign * (this.width - 0.18),
      this.height * 0.47,
      0.07
    );

    this.hinge.add(handle);

    this.scene.add(this.hinge);

    /**
     * Статична рама: стійка на петлях і на защіпці.
     */
    const frameMaterial = getMaterial(isMetal ? 'darkMetal' : 'wood');

    const postGeo = new THREE.BoxGeometry(
      0.14,
      this.height + 0.12,
      0.16
    );

    this.framePostA = new THREE.Mesh(postGeo, frameMaterial);
    this.framePostA.position.set(
      this.position.x,
      (this.height + 0.12) / 2 - 0.06,
      this.position.z
    );
    this.framePostA.castShadow = true;
    this.scene.add(this.framePostA);

    const latch = this.localToWorldXZ(sign * this.width);

    this.framePostB = new THREE.Mesh(postGeo, frameMaterial);
    this.framePostB.position.set(
      latch.x,
      (this.height + 0.12) / 2 - 0.06,
      latch.z
    );
    this.framePostB.castShadow = true;
    this.scene.add(this.framePostB);
  }

  spawnCollider() {
    if (this.colliderBody) {
      return;
    }

    const sign = this.flip ? -1 : 1;
    const center = this.localToWorldXZ((sign * this.width) / 2);

    const cos = Math.abs(Math.cos(this.rotationY));
    const sin = Math.abs(Math.sin(this.rotationY));

    const size =
      cos > sin
        ? [this.width, this.height, 0.12]
        : [0.12, this.height, this.width];

    const { body } = this.physics.createStaticBox({
      position: [center.x, this.height / 2, center.z],
      size,
      friction: 0.6,
      userData: {
        isDoor: true,
        doorId: this.id,
        material: this.matKey === 'doorMetal' ? 'metal' : 'wood',
        mesh: this.panel
      }
    });

    this.colliderBody = body;
  }

  removeCollider() {
    if (!this.colliderBody) {
      return;
    }

    this.physics.removeBody(this.colliderBody);
    this.colliderBody = null;
  }

  open(fromNetwork = false) {
    if (
      this.state === 'destroyed' ||
      this.state === 'open' ||
      this.state === 'opening'
    ) {
      return;
    }

    this.state = 'opening';

    this.audio?.playDoorCreak?.(this.position);

    if (!fromNetwork) {
      this.system?.broadcast(this, 'open');
    }
  }

  close(fromNetwork = false) {
    if (
      this.state === 'destroyed' ||
      this.state === 'closed' ||
      this.state === 'closing'
    ) {
      return;
    }

    this.state = 'closing';
    this.autoHoldTimer = 1.6;

    if (!fromNetwork) {
      this.system?.broadcast(this, 'closed');
    }
  }

  toggle() {
    if (this.state === 'closed') {
      this.open();
    } else if (this.state === 'open' || this.state === 'opening') {
      this.close();
    }
  }

  damage(amount) {
    if (this.state === 'destroyed') {
      return;
    }

    this.hp -= amount;

    this.audio?.playDoorHit?.(this.position);

    /**
     * Двері трясуться від влучання.
     */
    this.angleVel += (Math.random() - 0.5) * 1.6;

    if (this.hp <= 0) {
      this.destroy();
    }
  }

  destroy(fromNetwork = false) {
    if (this.state === 'destroyed') {
      return;
    }

    this.state = 'destroyed';
    this.destroyTime = 0;

    this.removeCollider();

    this.audio?.playDoorBreak?.(this.position);

    if (!fromNetwork) {
      this.system?.broadcast(this, 'destroyed');
    }
  }

  applyNetworkState(state) {
    if (state === 'destroyed') {
      this.destroy(true);
    } else if (state === 'open') {
      this.open(true);
    } else if (state === 'closed') {
      this.close(true);
    }
  }

  update(dt) {
    this.autoHoldTimer = Math.max(0, this.autoHoldTimer - dt);

    if (this.state === 'destroyed') {
      if (this.removed) {
        return;
      }

      this.destroyTime += dt;

      const t = Math.min(1, this.destroyTime / 0.45);

      this.panel.rotation.x = -t * 1.35 * (this.flip ? -1 : 1);
      this.panel.position.y = this.height / 2 - t * 0.55;

      this.panelMaterial.transparent = true;
      this.panelMaterial.opacity = 1 - t;

      if (t >= 1) {
        this.removed = true;

        this.scene.remove(this.hinge);
        this.panel.geometry.dispose();
        this.panelMaterial.dispose();
      }

      return;
    }

    const target =
      this.state === 'opening' || this.state === 'open'
        ? 1.85 * this.openDir
        : 0;

    /**
     * Пружина з легким перельотом — двері "доживають" рух.
     */
    this.angleVel += (target - this.angle) * 16 * dt;
    this.angleVel *= Math.exp(-7 * dt);
    this.angle += this.angleVel * dt;

    this.hinge.rotation.y = this.rotationY + this.angle;

    const openEnough = Math.abs(this.angle) > 0.45;

    if (openEnough) {
      this.removeCollider();
    } else {
      this.spawnCollider();
    }

    if (
      this.state === 'opening' &&
      Math.abs(this.angle - target) < 0.03
    ) {
      this.state = 'open';
    }

    if (this.state === 'closing' && Math.abs(this.angle) < 0.03) {
      this.state = 'closed';
      this.audio?.playDoorClose?.(this.position);
    }
  }
}

/**
 * DoorSystem:
 * - створює двері з конфігів карти;
 * - взаємодія через E;
 * - авто-відчинення при наближенні (гравці та боти);
 * - шкода від куль;
 * - синхронізація станів між клієнтами.
 */
export class DoorSystem {
  constructor({ scene, physics, audio = null, network = null }) {
    this.scene = scene;
    this.physics = physics;
    this.audio = audio;
    this.network = network;

    this.doors = new Map();
    this.counter = 0;

    this.useKeyWasDown = false;

    this.buildPrompt();
  }

  setNetwork(network) {
    this.network = network;
  }

  addDoor(config) {
    const id = `door-${this.counter++}`;

    const door = new Door({
      id,
      scene: this.scene,
      physics: this.physics,
      audio: this.audio,
      ...config
    });

    door.system = this;

    this.doors.set(id, door);

    return door;
  }

  broadcast(door, state) {
    this.network?.send?.({
      type: 'game:door',
      doorId: door.id,
      state
    });
  }

  handleMessage(message) {
    if (message?.type !== 'game:door') {
      return;
    }

    const door = this.doors.get(message.doorId);

    if (door) {
      door.applyNetworkState(message.state);
    }
  }

  damageDoor(doorId, damage) {
    const door = this.doors.get(doorId);

    door?.damage(damage);
  }

  nearestDoor(position, maxDistance = 2.6) {
    let best = null;
    let bestDistance = maxDistance;

    for (const door of this.doors.values()) {
      if (door.state === 'destroyed') {
        continue;
      }

      const dx = position.x - door.center.x;
      const dy = position.y - door.center.y;
      const dz = position.z - door.center.z;

      const distance = Math.hypot(dx, dy, dz);

      if (distance < bestDistance) {
        best = door;
        bestDistance = distance;
      }
    }

    return best;
  }

  update(dt, actors = [], input = null, playerPosition = null) {
    let promptDoor = null;

    /**
     * Взаємодія через E.
     */
    if (input && playerPosition) {
      const useDown = input.isDown('KeyE');

      promptDoor = this.nearestDoor(playerPosition, 2.8);

      if (useDown && !this.useKeyWasDown && promptDoor) {
        promptDoor.toggle();
      }

      this.useKeyWasDown = useDown;
    }

    /**
     * Авто-відчинення: двері відчувають присутність.
     */
    for (const actor of actors) {
      const door = this.nearestDoor(actor, 1.6);

      if (door && door.autoHoldTimer <= 0) {
        door.open();
      }
    }

    for (const door of this.doors.values()) {
      door.update(dt);
    }

    this.updatePrompt(promptDoor);
  }

  buildPrompt() {
    if (!document.getElementById('cs16-door-style')) {
      const style = document.createElement('style');
      style.id = 'cs16-door-style';
      style.textContent = DOOR_CSS;

      document.head.appendChild(style);
    }

    this.promptEl = document.createElement('div');
    this.promptEl.className = 'door-prompt';
    this.promptEl.textContent = '[E] ДВЕРІ';

    document.body.appendChild(this.promptEl);
  }

  updatePrompt(door) {
    if (!this.promptEl) {
      return;
    }

    this.promptEl.style.opacity = door ? '1' : '0';
  }

  dispose() {
    if (this.promptEl?.parentNode) {
      this.promptEl.parentNode.removeChild(this.promptEl);
    }
  }
}
