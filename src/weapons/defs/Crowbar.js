import { Weapon } from '../Weapon.js';

/**
 * Ломик — melee-зброя:
 * - довший за ніж (range 2.6 vs 2.2);
 * - важчий удар (damage 75 vs 55);
 * - повільніший (fireRate 1.8 vs 2.5);
 * - не такий швидкий рух (runSpeed 7.4 vs 8.0).
 */
export function createCrowbar() {
  return new Weapon({
    id: 'crowbar',
    name: 'Crowbar',

    automatic: false,
    melee: true,

    damage: 75,
    headshotMultiplier: 1.5,

    magazineSize: 999,
    reserveAmmo: 999,

    fireRate: 1.8,
    reloadTime: 0.4,
    range: 2.6,

    baseSpread: 0,
    moveSpread: 0,
    airSpread: 0,

    runSpeed: 7.4,

    penetrationPower: 0,

    recoilPattern: [[0, 0]],
    recoilPitchScale: 0,
    recoilYawScale: 0,

    patternResetTime: 0.25
  });
}
