import { Weapon } from '../Weapon.js';

export function createMP5() {
  return new Weapon({
    id: 'mp5',
    name: 'MP5',

    automatic: true,

    damage: 26,
    headshotMultiplier: 4,

    magazineSize: 30,
    reserveAmmo: 120,

    fireRate: 13,
    reloadTime: 2.2,
    range: 160,

    baseSpread: 0.006,
    moveSpread: 0.022,
    airSpread: 0.09,

    crouchSpreadMultiplier: 0.6,
    firstShotMultiplier: 0.3,
    firstShotThreshold: 0.28,

    penetrationPower: 1.5,

    runSpeed: 7.0,

    recoilPattern: [
      [0.008, 0.0],
      [0.009, 0.001],
      [0.01, 0.002],
      [0.01, -0.001],
      [0.009, -0.002],
      [0.009, 0.001],
      [0.008, 0.002]
    ],
    recoilPitchScale: 0.7,
    recoilYawScale: 0.7,

    patternResetTime: 0.3
  });
}
