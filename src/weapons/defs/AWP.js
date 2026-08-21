import { Weapon } from '../Weapon.js';

export function createAWP() {
  return new Weapon({
    id: 'awp',
    name: 'AWP',

    automatic: false,

    damage: 115,
    headshotMultiplier: 4,

    magazineSize: 10,
    reserveAmmo: 30,

    fireRate: 0.75,
    reloadTime: 3.6,
    range: 300,

    baseSpread: 0.0006,
    moveSpread: 0.14,
    airSpread: 0.2,

    crouchSpreadMultiplier: 0.5,
    firstShotMultiplier: 1.0,

    penetrationPower: 3.5,

    runSpeed: 5.2,

    recoilPattern: [
      [0.05, 0.0],
      [0.055, 0.002]
    ],
    recoilPitchScale: 2.4,
    recoilYawScale: 0.6,

    patternResetTime: 0.8
  });
}
