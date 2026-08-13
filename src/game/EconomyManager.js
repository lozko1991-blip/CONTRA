export const SHOP_PRICES = Object.freeze({
  ak47: 2500,
  m4a1: 3100,
  deagle: 700,
  armor: 650,
  he: 300,
  flash: 200,
  smoke: 300
});

const KILL_REWARDS = Object.freeze({
  ak47: 300,
  m4a1: 300,
  deagle: 300,
  default: 300
});

/**
 * EconomyManager — гроші гравця.
 *
 * Кожен клієнт веде свої гроші сам
 * (так само, як health у поточній моделі).
 */
export class EconomyManager {
  constructor({ startMoney = 800, maxMoney = 16000 } = {}) {
    this.money = startMoney;
    this.maxMoney = maxMoney;
    this.lossStreak = 0;
  }

  canAfford(price) {
    return this.money >= price;
  }

  spend(price) {
    if (!this.canAfford(price)) {
      return false;
    }

    this.money -= price;

    return true;
  }

  add(amount) {
    this.money = Math.min(this.maxMoney, this.money + amount);
  }

  rewardKill(weaponId) {
    const reward = KILL_REWARDS[weaponId] ?? KILL_REWARDS.default;
    this.add(reward);
  }

  roundEnd(won) {
    if (won) {
      this.lossStreak = 0;
      this.add(3250);
    } else {
      this.lossStreak = Math.min(this.lossStreak + 1, 5);

      const lossBonus = [
        1400, 1900, 2400, 2900, 3400
      ][this.lossStreak - 1] ?? 3400;

      this.add(lossBonus);
    }
  }

  reset() {
    this.money = 800;
    this.lossStreak = 0;
  }
}
