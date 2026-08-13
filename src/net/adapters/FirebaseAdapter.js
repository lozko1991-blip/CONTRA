import { initializeApp } from 'firebase/app';

import {
  getDatabase,
  ref,
  push,
  set,
  remove,
  onChildAdded,
  onDisconnect,
  query,
  limitToLast,
  serverTimestamp
} from 'firebase/database';

/**
 * FirebaseAdapter — онлайн-транспорт для лобі.
 *
 * Працює через Firebase Realtime Database.
 *
 * Особливості:
 * - без кімнатних кодів;
 * - всі клієнти можуть заходити в один глобальний lobby-room;
 * - повідомлення живуть короткий час;
 * - presence видаляється через onDisconnect.
 */
export class FirebaseAdapter {
  constructor({ config, room = 'global' }) {
    if (!config) {
      throw new Error('FirebaseAdapter: config is required.');
    }

    if (!config.databaseURL) {
      throw new Error('FirebaseAdapter: config.databaseURL is required.');
    }

    this.config = config;
    this.room = room;

    this.id = this.createId();

    this.app = null;
    this.db = null;

    this.messagesRef = null;
    this.presenceRef = null;

    this.unsubscribe = null;

    this.onMessage = null;

    this.ready = false;
    this.queue = [];
  }

  createId() {
    const random = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36);

    return `player-${random}-${time}`;
  }

  connect(profile = {}) {
    this.profile = profile;

    const appName = `cs16-web-${this.id}`;

    this.app = initializeApp(this.config, appName);
    this.db = getDatabase(this.app);

    const basePath = `lobbies/${this.room}`;

    this.messagesRef = ref(this.db, `${basePath}/messages`);
    this.presenceRef = ref(this.db, `${basePath}/presence/${this.id}`);

    /**
     * Presence.
     */
    const presencePayload = {
      id: this.id,
      name: profile?.name ?? 'Player',
      lastSeen: serverTimestamp()
    };

    set(this.presenceRef, presencePayload).catch((error) => {
      console.warn('[FirebaseAdapter] presence set error:', error);
    });

    onDisconnect(this.presenceRef).remove().catch((error) => {
      console.warn('[FirebaseAdapter] onDisconnect error:', error);
    });

    /**
     * Слухаємо нові повідомлення.
     * limitToLast потрібен, щоб не тягнути всю історію.
     */
    const messagesQuery = query(this.messagesRef, limitToLast(50));

    this.unsubscribe = onChildAdded(
      messagesQuery,
      (snapshot) => {
        const message = snapshot.val();

        if (!message) {
          return;
        }

        if (message.senderId === this.id) {
          return;
        }

        const age = Date.now() - (message.sentAt || 0);

        /**
         * Старі повідомлення ігноруємо і чистимо.
         */
        if (age > 15000) {
          remove(snapshot.ref).catch(() => {
            // ignore
          });
          return;
        }

        this.onMessage?.(message);
      },
      (error) => {
        console.warn('[FirebaseAdapter] onChildAdded error:', error);
      }
    );

    this.ready = true;

    this.flush();

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
      sentAt: Date.now(),
      nonce: Math.random().toString(36).slice(2)
    };

    if (!this.ready || !this.messagesRef) {
      this.queue.push(payload);
      return;
    }

    this.publishPayload(payload);
  }

  publishPayload(payload) {
    if (!this.messagesRef) {
      return;
    }

    const messageRef = push(this.messagesRef);

    set(messageRef, payload)
      .then(() => {
        /**
         * Прибираємо повідомлення через 20 секунд.
         * Це не обов'язково, але тримає базу чистою.
         */
        setTimeout(() => {
          remove(messageRef).catch(() => {
            // ignore
          });
        }, 20000);
      })
      .catch((error) => {
        console.warn('[FirebaseAdapter] publish error:', error);
      });
  }

  flush() {
    if (!this.queue.length) {
      return;
    }

    const queued = this.queue.splice(0, this.queue.length);

    for (const payload of queued) {
      this.publishPayload(payload);
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

    if (this.presenceRef) {
      remove(this.presenceRef).catch(() => {
        // ignore
      });
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.ready = false;
  }
}
