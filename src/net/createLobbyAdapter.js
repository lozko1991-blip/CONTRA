import { LocalAdapter } from './adapters/LocalAdapter.js';
import { firebaseConfig } from '../config.js';

/**
 * Вибирає адаптер лобі.
 *
 * Якщо Firebase налаштований — використовується онлайн-лобі.
 * Якщо ні — локальний лобі-адаптер.
 */
export async function createLobbyAdapter({ room = 'global' } = {}) {
  const hasFirebaseConfig = Boolean(
    firebaseConfig &&
      firebaseConfig.apiKey &&
      firebaseConfig.databaseURL
  );

  if (hasFirebaseConfig) {
    try {
      const { FirebaseAdapter } = await import(
        './adapters/FirebaseAdapter.js'
      );

      return new FirebaseAdapter({
        config: firebaseConfig,
        room
      });
    } catch (error) {
      console.warn(
        '[Lobby] Firebase adapter failed, falling back to LocalAdapter.',
        error
      );
    }
  } else {
    console.info(
      '[Lobby] Firebase is not configured. Using LocalAdapter (same browser only).'
    );
  }

  return new LocalAdapter({ room });
}
