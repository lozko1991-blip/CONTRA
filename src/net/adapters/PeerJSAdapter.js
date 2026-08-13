/**
 * PeerJSAdapter — stub.
 *
 * Цей адаптер підключається через PeerJS для P2P-гри.
 * Потребує `peerjs` npm-пакет і PeerJS сервер.
 *
 * Інтерфейс ідентичний LocalAdapter.
 */
import { LocalAdapter } from './LocalAdapter.js';

export class PeerJSAdapter extends LocalAdapter {
  constructor(opts = {}) {
    super(opts);
  }
}
