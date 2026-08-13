import { Bot } from './Bot.js';

export class BotManager {
  constructor({
    scene,
    physics,
    navGrid,
    player,
    weaponManager = null,
    hud = null,
    gameState = null
  }) {
    this.scene = scene;
    this.physics = physics;
    this.navGrid = navGrid;
    this.player = player;
    this.weaponManager = weaponManager;
    this.hud = hud;
    this.gameState = gameState;

    this.bots = [];

    this.spawnPoints = [
      { x: 12, z: -12 },
      { x: -14, z: -16 },
      { x: 18, z: 14 },
      { x: -18, z: 10 }
    ];

    this.onPlayerDamage = this.applyDamageToPlayer.bind(this);
  }

  spawnBot(spawn, team = 'enemy') {
    const nearest =
      this.navGrid.findNearestWalkable(spawn.x, spawn.z, 6) ?? spawn;

    const bot = new Bot({
      scene: this.scene,
      physics: this.physics,
      navGrid: this.navGrid,
      player: this.player,
      weaponManager: this.weaponManager,
      spawn: nearest,
      team,
      onPlayerDamage: this.onPlayerDamage
    });

    this.bots.push(bot);

    if (this.hud) {
      this.hud.addRadarEntity({
        id: `bot-${bot.id}`,
        getPosition: () => bot.position,
        team: bot.team,
        isVisible: () => bot.alive,
        isNoisy: () => bot.noisy
      });
    }

    return bot;
  }

  randomSpawn() {
    const point =
      this.spawnPoints[
        Math.floor(Math.random() * this.spawnPoints.length)
      ];

    return (
      this.navGrid.findNearestWalkable(point.x, point.z, 6) ?? point
    );
  }

  applyDamageToPlayer(damage) {
    if (!this.gameState) return;

    let remaining = damage;

    if (this.gameState.armor > 0) {
      const absorb = Math.min(this.gameState.armor, remaining * 0.5);

      this.gameState.armor -= absorb;
      remaining -= absorb;
    }

    this.gameState.health = Math.max(
      0,
      this.gameState.health - remaining
    );

    /**
     * Тимчасовий респаун гравця для тесту.
     * Пізніше це заміниться на повноцінну round/system death logic.
     */
    if (this.gameState.health <= 0) {
      this.gameState.health = 100;
      this.gameState.armor = 100;

      if (this.player) {
        this.player.position.set(0, 2.2, 8);
        this.player.prevPosition.copy(this.player.position);
        this.player.velocity.set(0, 0, 0);

        if (this.player.body?.setTranslation) {
          this.player.body.setTranslation(
            { x: 0, y: 2.2, z: 8 },
            true
          );
        }
      }
    }
  }

  update(dt) {
    for (const bot of this.bots) {
      if (bot.alive) {
        bot.update(dt);
      } else {
        bot.deathTimer -= dt;

        if (bot.deathTimer <= 0) {
          bot.respawn(this.randomSpawn());
        }
      }
    }
  }

  dispose() {
    for (const bot of this.bots) {
      bot.dispose();
    }

    this.bots = [];
  }
}
