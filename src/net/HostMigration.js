/**
 * HostMigration:
 * хостом стає перший гравець у відсортованому списку ID.
 * Якщо хост зникає, роль автоматично переходить наступному.
 */
export class HostMigration {
  constructor({ lobby, onBecomeHost = null }) {
    this.lobby = lobby;
    this.onBecomeHost = onBecomeHost;

    this.isHost = false;
    this.checkAccumulator = 0;
  }

  setHost(isHost) {
    this.isHost = isHost;
  }

  update(dt) {
    this.checkAccumulator += dt;

    /**
     * Перший старт — штраф швидше (0.3с), щоб не гаяти час
     * в очікуванні хоста. Потім — кожні 2с.
     */
    const interval = this.isHost ? 2 : 0.3;

    if (this.checkAccumulator < interval) {
      return;
    }

    this.checkAccumulator = 0;

    if (this.isHost) {
      return;
    }

    const ids = Array.from(
      this.lobby?.players?.keys?.() ?? []
    );

    if (!ids.length) {
      return;
    }

    ids.sort();

    if (ids[0] === this.lobby.id) {
      this.isHost = true;
      this.onBecomeHost?.();
    }
  }
}
