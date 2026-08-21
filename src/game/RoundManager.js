/**
 * RoundManager:
 * - керує фазами раунду: buy / live / ended;
 * - веде рахунок CT / T;
 * - скидає HP, броню, набої на початку раунду;
 * - забороняє респаун під час live-фази;
 * - хост є авторитетом для стану раунду.
 */
export class RoundManager {
  constructor({
    isHost,
    network,
    networkBots = null,
    teams = {},
    weaponManager = null,
    gameState = null,
    scoreboard = null,
    buyMenu = null,
    audio = null,
    economy = null
  }) {
    this.isHost = isHost;

    this.network = network;
    this.networkBots = networkBots;
    this.teams = teams;
    this.weaponManager = weaponManager;
    this.gameState = gameState;
    this.scoreboard = scoreboard;
    this.buyMenu = buyMenu;
    this.audio = audio;
    this.economy = economy;

    this.phase = 'buy';
    this.timeLeft = 12;
    this.round = 1;

    this.maxWins = 16;
    this.halfLength = 15;
    this.roundsCompleted = 0;
    this.matchWinner = null;
    this.onMatchOver = null;

    this.scores = {
      CT: 0,
      T: 0
    };

    this.sendAccumulator = 0;

    this.handleMessage = this.handleMessage.bind(this);

    if (this.isHost) {
      this.startBuy(false);
    } else {
      this.phase = 'waiting';
      this.timeLeft = 0;
    }
  }

  handleMessage(message) {
    if (this.isHost) {
      return;
    }

    if (message?.type !== 'round:state') {
      return;
    }

    this.applyState(message);
  }

  applyState(message) {
    const previousPhase = this.phase;
    const previousRound = this.round;

    this.phase = message.phase ?? this.phase;
    this.timeLeft = message.timeLeft ?? this.timeLeft;
    this.scores = message.scores ?? this.scores;
    this.round = message.round ?? this.round;

    this.roundsCompleted =
      message.roundsCompleted ?? this.roundsCompleted;

    if (message.teams) {
      for (const [id, team] of Object.entries(message.teams)) {
        this.teams[id] = team;
      }

      this.network?.refreshTeams?.();
    }

    this.matchWinner = message.matchWinner ?? null;

    if (message.round === 1 && previousRound > 1) {
      this.network?.resetStats?.();
    }

    this.lastWinner = message.winner ?? this.lastWinner ?? null;

    if (this.phase === 'buy' && previousPhase !== 'buy') {
      this.resetLocalPlayer();
    }

    if (this.phase === 'ended' && previousPhase !== 'ended') {
      const localTeam = this.network?.getLocalTeam?.() ?? 'CT';

      const won =
        message.winner != null &&
        message.winner === localTeam;

      this.economy?.roundEnd?.(won);
    }

    if (this.phase === 'matchover' && previousPhase !== 'matchover') {
      this.onMatchOver?.(this.matchWinner, this.scores);
    }
  }

  update(dt) {
    if (this.isHost) {
      this.updateHost(dt);
    } else {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
    }

    /**
     * Заборона авто-респауну гравця під час live.
     */
    if (this.phase === 'live' && this.network?.respawnTimeout) {
      clearTimeout(this.network.respawnTimeout);
      this.network.respawnTimeout = null;
    }

    /**
     * Заборона авто-респауну ботів поза фазою buy.
     */
    if (
      this.isHost &&
      this.phase !== 'buy' &&
      this.networkBots?.hostBots
    ) {
      for (const bot of this.networkBots.hostBots.values()) {
        if (!bot.alive) {
          bot.deathTimer = 3;
        }
      }
    }

    this.updateUI();
  }

  updateHost(dt) {
    if (this.phase === 'matchover') {
      return;
    }

    this.timeLeft -= dt;

    if (this.phase === 'buy' && this.timeLeft <= 0) {
      this.startLive();
    } else if (this.phase === 'live') {
      /**
       * Бомба: якщо поставлена — таймер раунду не завершує
       * раунд (вирішує бомба: вибух = T, деф'юз = CT).
       */
      const planted = this.bomb?.isPlanted?.() === true;

      if (!planted) {
        this.checkEndCondition();

        if (this.timeLeft <= 0) {
          this.endRound('CT');
        }
      }
    } else if (this.phase === 'ended' && this.timeLeft <= 0) {
      this.startBuy(true);
    }

    this.sendAccumulator += dt;

    if (this.sendAccumulator >= 0.5) {
      this.sendState();
      this.sendAccumulator = 0;
    }
  }


  startBuy(incrementRound) {
    if (incrementRound) {
      this.round++;
    }

    this.phase = 'buy';
    this.timeLeft = 12;

    this.resetLocalPlayer();

    /**
     * На хості обов'язково садимо боти перед раундом:
     * якщо hostBots порожній (міграція хоста / race condition),
     * спавнимо нових, інакше раунд стартує без команд.
     */
    if (this.isHost && this.networkBots?.hostBots?.size === 0) {
      this.networkBots?.spawnHostBots?.();
    }

    if (this.networkBots?.hostBots) {
      for (const bot of this.networkBots.hostBots.values()) {
        bot.respawn(this.networkBots.randomSpawn());
      }
    }

    this.audio?.playBuy();

    this.sendState();
  }

  startLive() {
    /**
     * Перевірка готовності команд: якщо одна з команд порожня
     * (боти не заспавнились, міграція в processі), рестарт buy-фази.
     */
    const alive = this.countAlive();

    if (alive.CT === 0 || alive.T === 0) {
      this.phase = 'buy';
      this.timeLeft = 8;

      this.sendState();
      return;
    }

    this.phase = 'live';
    this.timeLeft = 120;

    this.audio?.playRoundStart();

    this.network?.hud?.startRound?.(this.timeLeft);

    /**
     * Бомба: призначаємо носія (випадковий T) на початку live.
     */
    this.bomb?.startRound?.();

    this.sendState();
  }

  endRound(winnerTeam) {
    if (this.phase === 'ended' || this.phase === 'matchover') {
      return;
    }

    this.bomb?.reset?.();

    if (winnerTeam && this.scores[winnerTeam] != null) {
      this.scores[winnerTeam]++;
    }

    this.roundsCompleted++;
    this.lastWinner = winnerTeam;

    const localWon =
      winnerTeam != null &&
      winnerTeam === (this.network?.getLocalTeam?.() ?? 'CT');

    this.audio?.playRoundEnd(localWon);
    this.economy?.roundEnd?.(localWon);
    this.networkBots?.roundEnd?.(winnerTeam);

    if (
      winnerTeam != null &&
      this.network?.hud
    ) {
      this.network.hud.showRoundResult(localWon);
    } else if (winnerTeam == null && this.network?.hud) {
      this.network.hud.showRoundResult(null);
    }

    /**
     * Кінець матчу: MR15 — перші 16 перемог,
     * або нічия після 30 раундів.
     */
    if (
      this.scores.CT >= this.maxWins ||
      this.scores.T >= this.maxWins ||
      this.roundsCompleted >= this.halfLength * 2
    ) {
      this.matchWinner =
        this.scores.CT > this.scores.T
          ? 'CT'
          : this.scores.T > this.scores.CT
            ? 'T'
            : null;

      this.phase = 'matchover';
      this.timeLeft = 0;

      this.sendState();
      this.onMatchOver?.(this.matchWinner, this.scores);

      return;
    }

    /**
     * Зміна сторін у половині матчу.
     */
    if (this.roundsCompleted === this.halfLength) {
      this.swapTeams();
    }

    this.phase = 'ended';
    this.timeLeft = 6;

    this.sendState();
  }

  swapTeams() {
    for (const id of Object.keys(this.teams)) {
      this.teams[id] = this.teams[id] === 'CT' ? 'T' : 'CT';
    }

    this.network?.refreshTeams?.();
    this.networkBots?.swapBotTeams?.();
  }

  restartMatch() {
    this.scores.CT = 0;
    this.scores.T = 0;
    this.roundsCompleted = 0;
    this.matchWinner = null;
    this.lastWinner = null;
    this.round = 1;

    this.network?.resetStats?.();
    this.economy?.reset?.();
    this.gameState.health = 100;
    this.gameState.armor = 0;

    /**
     * Повний рестарт матчу — перевикликаємо респавн
     * незалежно від alive стану, щоб гравець з'явився
     * на точці спавну.
     */
    if (this.network) {
      this.network.alive = false;
    }

    this.startBuy(false);
  }

  checkEndCondition() {
    const alive = this.countAlive();

    /**
     * Бомба поставлена: смерть усіх T НЕ завершує раунд —
     * CT мусять розмінувати (або бомба вибухне).
     */
    if (alive.CT <= 0 && alive.T <= 0) {
      this.endRound(null);
    } else if (alive.CT <= 0) {
      this.endRound('T');
    } else if (alive.T <= 0 && !this.bomb?.isPlanted?.()) {
      this.endRound('CT');
    }
  }

  countAlive() {
    const alive = {
      CT: 0,
      T: 0
    };

    const targets = this.network.getPlayerTargets?.() ?? [];

    for (const target of targets) {
      if (!target.alive) {
        continue;
      }

      const team =
        target.team ??
        this.teams[target.playerId] ??
        'CT';

      if (alive[team] != null) {
        alive[team]++;
      }
    }

    if (this.isHost && this.networkBots?.hostBots) {
      for (const bot of this.networkBots.hostBots.values()) {
        if (!bot.alive) {
          continue;
        }

        if (alive[bot.team] != null) {
          alive[bot.team]++;
        }
      }
    }

    return alive;
  }

  resetLocalPlayer() {
    if (this.gameState) {
      this.gameState.health = 100;
      this.gameState.armor = 0;
    }

    this.resetAllWeapons();

    if (this.weaponManager) {
      this.weaponManager.enabled = true;
    }

    if (this.network && !this.network.alive) {
      this.network.respawnLocal?.();
    }
  }

  resetAllWeapons() {
    const weapons = this.weaponManager?.weapons;

    if (!weapons) {
      return;
    }

    for (const weapon of Object.values(weapons)) {
      weapon.magazine = weapon.magazineSize;
      weapon.reserve = weapon.reserveAmmo;
      weapon.reloading = false;
      weapon.cooldown = 0;
      weapon.shotsFired = 0;
      weapon.timeSinceLastShot = 999;
    }
  }

  updateUI() {
    const players = this.collectPlayers();

    this.scoreboard?.setState({
      phase: this.phase,
      timeLeft: this.timeLeft,
      scores: this.scores,
      round: this.round,
      localTeam: this.network?.getLocalTeam?.() ?? 'CT',
      players
    });

    this.buyMenu?.setEnabled(
      this.phase === 'buy' && Boolean(this.network?.alive)
    );

    /**
     * Таймер раунду в HUD — авторитетний: оновлюється щокадру з timeLeft
     * (хост тикрить локально, клієнт — з синхронізованим timeLeft),
     * незалежно від стану performance.now() у фоновій вкладці.
     */
    if (this.network?.hud) {
      if (this.phase === 'live') {
        this.network.hud.setRoundTimeLeft?.(Math.max(0, this.timeLeft));
      } else {
        this.network.hud.roundEndTime = null;
      }
    }
  }

  collectPlayers() {
    const players = [];
    const nm = this.network;

    if (!nm) {
      return players;
    }

    const localTeam = nm.getLocalTeam?.() ?? 'CT';

    players.push({
      name: nm.localName ?? 'Player',
      team: localTeam,
      kills: nm.stats?.kills ?? 0,
      deaths: nm.stats?.deaths ?? 0,
      self: true,
      alive: nm.alive !== false
    });

    if (nm.playerStats) {
      for (const entry of nm.playerStats.values()) {
        players.push({
          name: entry.name ?? 'Player',
          team: entry.team ?? 'T',
          kills: entry.kills ?? 0,
          deaths: entry.deaths ?? 0,
          self: false,
          alive: entry.alive !== false
        });
      }
    }

    const botList =
      this.networkBots?.isHost
        ? this.networkBots?.hostBots
        : this.networkBots?.clientBots;

    if (botList) {
      for (const bot of botList.values()) {
        players.push({
          name: bot.name ?? 'Bot',
          team: bot.team ?? 'T',
          kills: bot.kills ?? 0,
          deaths: bot.deaths ?? 0,
          self: false,
          alive: bot.alive !== false
        });
      }
    }

    return players;
  }

  sendState() {
    this.network?.send?.({
      type: 'round:state',
      id: this.network?.localId,
      phase: this.phase,
      timeLeft: Math.max(0, this.timeLeft),
      scores: this.scores,
      round: this.round,
      winner: this.lastWinner ?? null,
      matchWinner: this.matchWinner ?? null,
      roundsCompleted: this.roundsCompleted,
      teams: this.teams
    });
  }
}
