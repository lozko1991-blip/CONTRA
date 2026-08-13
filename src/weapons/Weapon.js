/**
 * Weapon — базовый класс оружия.
 *
 * Отвечает за:
 * - патроны;
 * - перезарядку;
 * - cooldown;
 * - spread;
 * - recoil pattern;
 * - suppressor.
 */
export class Weapon {
  constructor(config = {}) {
    this.id = config.id ?? 'weapon';
    this.name = config.name ?? 'Weapon';

    this.automatic = config.automatic ?? false;

    this.damage = config.damage ?? 30;
    this.headshotMultiplier = config.headshotMultiplier ?? 4;

    this.zoneMultipliers = {
      head: 4,
      chest: 1,
      arms: 1,
      stomach: 1.25,
      legs: 0.75,
      ...(config.zoneMultipliers ?? {})
    };

    this.magazineSize = config.magazineSize ?? 30;
    this.reserveAmmo = config.reserveAmmo ?? 90;

    this.magazine = this.magazineSize;
    this.reserve = this.reserveAmmo;

    this.fireRate = config.fireRate ?? 10;
    this.reloadTime = config.reloadTime ?? 2.5;
    this.range = config.range ?? 200;

    this.baseSpread = config.baseSpread ?? 0.005;
    this.moveSpread = config.moveSpread ?? 0.02;
    this.airSpread = config.airSpread ?? 0.08;

    this.crouchSpreadMultiplier = config.crouchSpreadMultiplier ?? 0.6;
    this.firstShotMultiplier = config.firstShotMultiplier ?? 0.25;
    this.firstShotThreshold = config.firstShotThreshold ?? 0.3;

    this.runSpeed = config.runSpeed ?? 6.4;

    this.penetrationPower = config.penetrationPower ?? 1.5;

    this.recoilPattern = config.recoilPattern ?? [
      [0.01, 0],
      [0.012, 0.001],
      [0.011, -0.001]
    ];

    this.recoilPitchScale = config.recoilPitchScale ?? 1;
    this.recoilYawScale = config.recoilYawScale ?? 1;

    this.patternResetTime = config.patternResetTime ?? 0.3;

    this.canSuppress = config.canSuppress ?? false;
    this.suppressed = config.suppressed ?? false;

    this.suppressedSpreadMultiplier =
      config.suppressedSpreadMultiplier ?? 0.88;

    this.suppressedRecoilMultiplier =
      config.suppressedRecoilMultiplier ?? 0.92;

    this.cooldown = 0;

    this.reloading = false;
    this.reloadTimer = 0;

    this.shotsFired = 0;
    this.timeSinceLastShot = 999;
  }

  update(dt) {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
    }

    this.timeSinceLastShot += dt;

    if (this.timeSinceLastShot > this.patternResetTime) {
      this.shotsFired = 0;
    }

    if (this.reloading) {
      this.reloadTimer -= dt;

      if (this.reloadTimer <= 0) {
        this.finishReload();
      }
    }
  }

  canFire() {
    return (
      !this.reloading &&
      this.magazine > 0 &&
      this.cooldown <= 0
    );
  }

  startReload() {
    if (this.reloading) return false;
    if (this.magazine >= this.magazineSize) return false;
    if (this.reserve <= 0) return false;

    this.reloading = true;
    this.reloadTimer = this.reloadTime;

    return true;
  }

  finishReload() {
    const need = this.magazineSize - this.magazine;
    const take = Math.min(need, this.reserve);

    this.magazine += take;
    this.reserve -= take;

    this.reloading = false;
    this.reloadTimer = 0;
  }

  consumeAmmo() {
    if (this.magazine <= 0) {
      return false;
    }

    this.magazine -= 1;
    this.timeSinceLastShot = 0;
    this.shotsFired += 1;

    this.cooldown = this.fireRate > 0 ? 1 / this.fireRate : 0.1;

    return true;
  }

  getRecoil() {
    if (!this.recoilPattern || this.recoilPattern.length === 0) {
      return {
        pitch: 0,
        yaw: 0
      };
    }

    const index = Math.min(
      this.shotsFired,
      this.recoilPattern.length - 1
    );

    const [pitch, yaw] = this.recoilPattern[index];

    const suppressorRecoil = this.suppressed
      ? this.suppressedRecoilMultiplier
      : 1;

    return {
      pitch: pitch * this.recoilPitchScale * suppressorRecoil,
      yaw: yaw * this.recoilYawScale * suppressorRecoil
    };
  }

  getCurrentSpread(state = {}) {
    const speed = state.speed ?? 0;
    const grounded = state.grounded ?? true;
    const crouched = state.crouched ?? false;

    let spread = this.baseSpread;

    const speedRatio = Math.min(speed / this.runSpeed, 1);

    spread += this.moveSpread * speedRatio;

    if (!grounded) {
      spread += this.airSpread;
    }

    if (crouched) {
      spread *= this.crouchSpreadMultiplier;
    }

    /**
     * Первый выстрел стоя — почти идеальный.
     */
    if (
      this.timeSinceLastShot > this.firstShotThreshold &&
      grounded &&
      speed < 1.0
    ) {
      spread *= this.firstShotMultiplier;
    }

    if (this.suppressed) {
      spread *= this.suppressedSpreadMultiplier;
    }

    if (this.reloading) {
      spread *= 2;
    }

    return spread;
  }

  toggleSuppressor() {
    if (!this.canSuppress) {
      return this.suppressed;
    }

    this.suppressed = !this.suppressed;

    return this.suppressed;
  }
}
