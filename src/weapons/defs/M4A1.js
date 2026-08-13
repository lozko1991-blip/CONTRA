import { Weapon } from '../Weapon.js';

const M4_PATTERN = [
  [0.012, 0.0],
  [0.013, 0.0004],
  [0.014, 0.0008],
  [0.015, 0.0014],
  [0.015, 0.002],
  [0.014, 0.0024],
  [0.013, 0.0018],
  [0.013, 0.0008],
  [0.012, -0.0004],
  [0.012, -0.0016],
  [0.011, -0.0028],
  [0.011, -0.0034],
  [0.012, -0.0028],
  [0.013, -0.0016],
  [0.013, -0.0004],
  [0.013, 0.0008],
  [0.012, 0.0016],
  [0.012, 0.002],
  [0.011, 0.0016],
  [0.01, 0.001],
  [0.01, 0.0004],
  [0.009, 0.0],
  [0.009, -0.0004],
  [0.008, -0.0008]
];

export function createM4A1() {
  return new Weapon({
    id: 'm4a1',
    name: 'M4A1',

    automatic: true,

    damage: 33,
    headshotMultiplier: 4,

    magazineSize: 30,
    reserveAmmo: 90,

    fireRate: 11,
    reloadTime: 2.3,
    range: 220,

    baseSpread: 0.0036,
    moveSpread: 0.022,
    airSpread: 0.09,

    crouchSpreadMultiplier: 0.55,
    firstShotMultiplier: 0.2,
    firstShotThreshold: 0.3,

    penetrationPower: 2.3,

    recoilPattern: M4_PATTERN,
    recoilPitchScale: 0.85,
    recoilYawScale: 0.82,

    patternResetTime: 0.32,

    canSuppress: true,
    suppressed: false,
    suppressedSpreadMultiplier: 0.82,
    suppressedRecoilMultiplier: 0.9
  });
}
