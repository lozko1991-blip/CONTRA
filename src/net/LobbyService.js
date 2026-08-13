/**
 * LobbyService:
 * - зберігає список гравців;
 * - синхронізує вибір карти;
 * - обробляє старт гри;
 * - видаляє гравців, які відвалилися.
 */
export class LobbyService {
  constructor(adapter) {
    this.adapter = adapter;
    this.id = adapter.id;

    this.name = 'Player';

    this.players = new Map();

    this.currentMap = 'cs_mansion';

    this.maps = [
      {
        id: 'cs_mansion',
        name: 'cs_mansion'
      },
      {
        id: 'cs_assault',
        name: 'cs_assault'
      }
    ];

    this.onPlayersChange = null;
    this.onMapChange = null;
    this.onStart = null;
    this.onAnyMessage = null;
    this.votes = new Map();
    this.onVotesChange = null;


    this.presenceTimer = null;
    this.cleanupTimer = null;

    this._onMessage = this.handleMessage.bind(this);
    this._beforeUnload = this._beforeUnload.bind(this);
  }

  connect(name) {
    this.name = name || this.name;

    this.adapter.onMessage = this._onMessage;

    this.players.set(this.id, {
      id: this.id,
      name: this.name,
      lastSeen: Date.now(),
      self: true
    });

    this.adapter.connect({
      id: this.id,
      name: this.name
    });

    this.emitPlayers();

    this.presenceTimer = setInterval(() => {
      this.sendPresence();
    }, 2000);

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 3000);

    window.addEventListener('beforeunload', this._beforeUnload);
  }

  sendPresence() {
    this.adapter.send({
      type: 'presence',
      id: this.id,
      name: this.name
    });
  }

  setName(name) {
    const cleanName = (name || 'Player').trim().slice(0, 18);

    this.name = cleanName || 'Player';

    const self = this.players.get(this.id);

    if (self) {
      self.name = this.name;
    }

    this.sendPresence();
    this.emitPlayers();
  }

  setMap(mapId) {
    this.currentMap = mapId;

    this.adapter.send({
      type: 'map',
      id: this.id,
      map: mapId
    });

    this.emitMap();
  }

  voteFor(mapId) {
    this.votes.set(this.id, mapId);

    this.adapter.send({
      type: 'vote',
      id: this.id,
      map: mapId
    });

    this.emitVotes();
  }

  emitVotes() {
    this.onVotesChange?.(Object.fromEntries(this.votes));
  }

  getWinnerMap() {
    const counts = new Map();

    for (const mapId of this.votes.values()) {
      counts.set(mapId, (counts.get(mapId) ?? 0) + 1);
    }

    let best = null;
    let bestCount = 0;

    for (const [mapId, count] of counts) {
      if (count > bestCount) {
        best = mapId;
        bestCount = count;
      }
    }

    return best;
  }

  startGame() {
    const mapId = this.getWinnerMap() ?? this.currentMap;

    this.currentMap = mapId;

    this.adapter.send({
      type: 'start',
      id: this.id,
      map: mapId
    });

    this.onStart?.(mapId);
  }

  handleMessage(message) {
    if (!message) return;
this.onAnyMessage?.(message);


    const playerId = message.id ?? message.senderId;

    if (!playerId || playerId === this.id) {
      return;
    }

    switch (message.type) {
      case 'hello': {
        this.upsertPlayer(playerId, message.name);

        /**
         * Новий гравець зайшов — відповідаємо йому своїм presence
         * і поточним станом карти.
         */
        this.sendPresence();

        this.adapter.send({
          type: 'map',
          id: this.id,
          map: this.currentMap
        });

        /**
         * Синхронізуємо поточні голоси з новим гравцем.
         */
        if (this.votes.size > 0) {
          this.adapter.send({
            type: 'votes',
            id: this.id,
            votes: Object.fromEntries(this.votes)
          });
        }

        break;
      }

      case 'presence': {
        this.upsertPlayer(playerId, message.name);
        break;
      }

      case 'map': {
        if (message.map && message.map !== this.currentMap) {
          this.currentMap = message.map;
          this.emitMap();
        }
        break;
      }

      case 'votes': {
        if (message.votes) {
          for (const [pid, map] of Object.entries(message.votes)) {
            this.votes.set(pid, map);
          }
          this.emitVotes();
        }
        break;
      }

      case 'vote': {
        this.upsertPlayer(playerId, message.name);

        if (message.map) {
          this.votes.set(playerId, message.map);
          this.emitVotes();
        }

        break;
      }

      case 'start': {
        if (message.map) {
          this.currentMap = message.map;
        }

        this.onStart?.(this.currentMap);
        break;
      }

      case 'bye': {
        if (this.players.has(playerId)) {
          this.players.delete(playerId);
          this.emitPlayers();
        }

        this.votes.delete(playerId);
        this.emitVotes();

        break;
      }

      default:
        break;
    }
  }

  upsertPlayer(id, name) {
    const existing = this.players.get(id);

    this.players.set(id, {
      id,
      name: name ?? existing?.name ?? 'Player',
      lastSeen: Date.now(),
      self: false
    });

    this.emitPlayers();
  }

  cleanup() {
    const now = Date.now();

    let changed = false;

    for (const [id, player] of this.players) {
      if (!player.self && now - player.lastSeen > 7000) {
        this.players.delete(id);
        this.votes.delete(id);
        changed = true;
      }
    }

    if (changed) {
      this.emitPlayers();
      this.emitVotes();
    }
  }

  emitPlayers() {
    const list = Array.from(this.players.values());
    this.onPlayersChange?.(list);
  }

  emitMap() {
    this.onMapChange?.(this.currentMap);
  }

  _beforeUnload() {
    this.adapter.disconnect();
  }

  dispose() {
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    window.removeEventListener('beforeunload', this._beforeUnload);

    this.adapter.disconnect();
  }
}
