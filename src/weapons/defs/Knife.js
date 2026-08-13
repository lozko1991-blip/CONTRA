import { Weapon } from '../Weapon.js';

/**
 * Ніж — melee-зброя:
 * - нескінченні «патрони» (magazine 999);
 * - висока швидкість руху (runSpeed 8);
 * - швидкий удар (fireRate 2.5);
 * - велика шкода ззаду (backstab ×2);
 * - без recoil, без трасера.
 */
export function createKnife() {
  return new Weapon({
    id: 'knife',
    name: 'Knife',

    automatic: false,
    knife: true,

    damage: 55,
    headshotMultiplier: 1.5,

    magazineSize: 999,
    reserveAmmo: 999,

    fireRate: 2.5,
    reloadTime: 0.3,
    range: 2.2,

    baseSpread: 0,
    moveSpread: 0,
    airSpread: 0,

    runSpeed: 8.0,

    penetrationPower: 0,

    recoilPattern: [[0, 0]],
    recoilPitchScale: 0,
    recoilYawScale: 0,

    patternResetTime: 0.2
  });
}
