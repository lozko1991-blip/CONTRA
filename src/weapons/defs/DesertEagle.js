import { Weapon } from '../Weapon.js';

const DEAGLE_PATTERN = [
  [0.035, 0.0],
  [0.04, 0.001],
  [0.038, -0.0015],
  [0.042, 0.002],
  [0.04, -0.002],
  [0.036, 0.001]
];

export function createDesertEagle() {
  return new Weapon({
    id: 'deagle',
    name: 'Desert Eagle',

    automatic: false,

    damage: 54,
    headshotMultiplier: 4,

    magazineSize: 7,
    reserveAmmo: 35,

    fireRate: 3.6,
    reloadTime: 2.2,
    range: 200,

    baseSpread: 0.0022,
    moveSpread: 0.035,
    airSpread: 0.14,

    crouchSpreadMultiplier: 0.6,
    firstShotMultiplier: 0.12,
    firstShotThreshold: 0.35,

    penetrationPower: 2.5,

    recoilPattern: DEAGLE_PATTERN,
    recoilPitchScale: 1.15,
    recoilYawScale: 0.85,

    patternResetTime: 0.48
  });
}
