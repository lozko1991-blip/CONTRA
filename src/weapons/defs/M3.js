import { Weapon } from '../Weapon.js';

export function createM3() {
  return new Weapon({
    id: 'm3',
    name: 'M3 Shotgun',

    automatic: false,

    damage: 50,
    headshotMultiplier: 2,

    magazineSize: 8,
    reserveAmmo: 32,

    fireRate: 1.05,
    reloadTime: 3.0,
    range: 45,

    baseSpread: 0.055,
    moveSpread: 0.07,
    airSpread: 0.1,

    crouchSpreadMultiplier: 0.85,
    firstShotMultiplier: 1.0,

    penetrationPower: 1.0,

    runSpeed: 6.6,

    recoilPattern: [
      [0.045, 0.0],
      [0.05, 0.002]
    ],
    recoilPitchScale: 2.0,
    recoilYawScale: 0.8,

    patternResetTime: 0.6
  });
}
