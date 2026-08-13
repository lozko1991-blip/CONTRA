import { Weapon } from '../Weapon.js';

const AK_PATTERN = [
  [0.018, 0.0],
  [0.02, 0.0005],
  [0.022, 0.001],
  [0.023, 0.002],
  [0.024, 0.003],
  [0.023, 0.004],
  [0.022, 0.003],
  [0.021, 0.001],
  [0.02, -0.001],
  [0.019, -0.003],
  [0.018, -0.005],
  [0.018, -0.006],
  [0.019, -0.005],
  [0.02, -0.003],
  [0.021, -0.001],
  [0.021, 0.001],
  [0.02, 0.003],
  [0.019, 0.004],
  [0.018, 0.003],
  [0.017, 0.002],
  [0.017, 0.001],
  [0.016, 0.0],
  [0.016, -0.001],
  [0.015, -0.002]
];

export function createAK47() {
  return new Weapon({
    id: 'ak47',
    name: 'AK-47',

    automatic: true,

    damage: 36,
    headshotMultiplier: 4,

    magazineSize: 30,
    reserveAmmo: 90,

    fireRate: 10,
    reloadTime: 2.5,
    range: 220,

    baseSpread: 0.0045,
    moveSpread: 0.028,
    airSpread: 0.1,

    crouchSpreadMultiplier: 0.55,
    firstShotMultiplier: 0.22,
    firstShotThreshold: 0.32,

    penetrationPower: 2.5,

    recoilPattern: AK_PATTERN,
    recoilPitchScale: 1.0,
    recoilYawScale: 1.0,

    patternResetTime: 0.35
  });
}
