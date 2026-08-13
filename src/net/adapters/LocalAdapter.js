/**
 * LocalAdapter — простий транспорт для лобі.
 *
 * Працює через BroadcastChannel.
 * Це означає, що кілька вкладок одного браузера можуть:
 * - бачити одне одного;
 * - змінювати карту;
 * - стартувати гру синхронно.
 *
 * Для інтернет-гри пізніше буде додано:
 * - FirebaseAdapter;
 * - PeerJSAdapter;
 * - WebSocketAdapter.
 */
export class LocalAdapter {
  constructor({ room = 'default' } = {}) {
    this.room = room;
    this.channelName = `cs16-web-lobby:${room}`;

    this.id = this.createId();

    this.channel = null;
    this.useStorage = false;

    this.onMessage = null;

    this._onStorage = this._onStorage.bind(this);
  }

  createId() {
    const random = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36);

    return `player-${random}-${time}`;
  }

  connect(profile = {}) {
    this.profile = profile;

    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(this.channelName);

      this.channel.onmessage = (event) => {
        this.onMessage?.(event.data);
      };
    } else {
      /**
       * Fallback для браузерів без BroadcastChannel.
       */
      this.useStorage = true;
      window.addEventListener('storage', this._onStorage);
    }

    this.send({
      type: 'hello',
      id: this.id,
      name: profile?.name ?? 'Player'
    });
  }

  send(message) {
    const payload = {
      ...message,
      senderId: this.id,
      sentAt: Date.now()
    };

    try {
      if (this.channel) {
        this.channel.postMessage(payload);
      } else if (this.useStorage) {
        localStorage.setItem(
          this.channelName,
          JSON.stringify({
            ...payload,
            _nonce: Math.random()
          })
        );
      }
    } catch (error) {
      console.warn('[LocalAdapter] send error:', error);
    }
  }

  disconnect() {
    try {
      this.send({
        type: 'bye',
        id: this.id
      });
    } catch {
      // ignore
    }

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    if (this.useStorage) {
      window.removeEventListener('storage', this._onStorage);
      this.useStorage = false;
    }
  }

  _onStorage(event) {
    if (event.key !== this.channelName) {
      return;
    }

    if (!event.newValue) {
      return;
    }

    try {
      const data = JSON.parse(event.newValue);
      this.onMessage?.(data);
    } catch {
      // ignore malformed storage events
    }
  }
}
