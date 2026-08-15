/**
 * InputManager
 *
 * Отвечает за:
 * - клавиатуру;
 * - кнопки мыши;
 * - Pointer Lock;
 * - накопление mouse delta.
 *
 * Важно:
 * - mouse delta накапливается между кадрами и забирается один раз через consumeMouseDelta();
 * - при потере Pointer Lock очищаем кнопки мыши и клавиши, чтобы не было "залипшего" движения.
 */
export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;

    this.keys = new Set();
    this.mouseButtons = new Set();

    this.mouseDelta = {
      x: 0,
      y: 0
    };

    this.pointerLocked = false;

    /**
     * Предотвращаем скролл/поведение браузера для части клавиш,
     * но только когда игра захватила мышь.
     */
    this.preventCodes = new Set([
      'Space',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight'
    ]);

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onPointerLockError = this._onPointerLockError.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);

    document.addEventListener('visibilitychange', this._onBlur);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('pointerlockerror', this._onPointerLockError);

    this.domElement.addEventListener('click', this._onClick);
    this.domElement.addEventListener('contextmenu', this._onContextMenu);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);

    document.removeEventListener('visibilitychange', this._onBlur);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('pointerlockerror', this._onPointerLockError);

    this.domElement.removeEventListener('click', this._onClick);
    this.domElement.removeEventListener('contextmenu', this._onContextMenu);
  }

  lock() {
    if (!this.domElement) return;

    try {
      const promise = this.domElement.requestPointerLock?.();

      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {
          // Pointer Lock может быть отклонён браузером, например, если клик не был user gesture.
          // Это не критично.
          this._armRelockOnNextGesture();
        });
      }
    } catch {
      // Некоторые браузеры могут бросать синхронную ошибку в отдельных сценариях.
      this._armRelockOnNextGesture();
    }
  }

  /**
   * Якщо браузер відхилив Pointer Lock (немає user gesture),
   * чекаємо найближчий КЛІК і повторюємо спробу.
   * keydown НЕ є валідним gesture для Pointer Lock у Chrome,
   * тому слухаємо тільки pointerdown/click.
   */
  _armRelockOnNextGesture() {
    if (this._relockArmed) return;
    this._relockArmed = true;

    const tryLock = (event) => {
      this._relockArmed = false;
      document.removeEventListener('pointerdown', tryLock);

      /**
       * Не лочимо кліки по інтерактивних UI-елементах
       * (меню, скорборд, чат тощо).
       */
      const target = event.target;
      if (
        target &&
        target.closest &&
        target.closest('.hud-root, .scoreboard-root, .buy-menu, .settings-root, .chat-root, .lobby-root, .matchover-root, .nameplate-root')
      ) {
        return;
      }

      if (!this.pointerLocked) {
        this.lock();
      }
    };

    document.addEventListener('pointerdown', tryLock, { once: true });
  }

  unlock() {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock?.();
    }
  }

  isDown(code) {
    return this.keys.has(code);
  }

  isMouseDown(button = 0) {
    return this.mouseButtons.has(button);
  }

  consumeMouseDelta() {
    const delta = {
      x: this.mouseDelta.x,
      y: this.mouseDelta.y
    };

    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;

    return delta;
  }

  _clearAll() {
    this.keys.clear();
    this.mouseButtons.clear();
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }

  _onKeyDown(event) {
    if (this.pointerLocked && this.preventCodes.has(event.code)) {
      event.preventDefault();
    }

    this.keys.add(event.code);
  }

  _onKeyUp(event) {
    this.keys.delete(event.code);
  }

  _onBlur() {
    this._clearAll();
  }

  _onMouseMove(event) {
    if (!this.pointerLocked) return;

    let dx = event.movementX || event.mozMovementX || 0;
    let dy = event.movementY || event.mozMovementY || 0;

    /**
     * Защита от редких огромных скачков movementX/Y,
     * которые иногда случаются при входе/выходе из Pointer Lock.
     */
    dx = Math.max(-200, Math.min(200, dx));
    dy = Math.max(-200, Math.min(200, dy));

    this.mouseDelta.x += dx;
    this.mouseDelta.y += dy;
  }

  _onMouseDown(event) {
    if (!this.pointerLocked) return;

    this.mouseButtons.add(event.button);

    if (event.button === 2) {
      event.preventDefault();
    }
  }

  _onMouseUp(event) {
    this.mouseButtons.delete(event.button);
  }

  _onClick(event) {
    /**
     * Відновлюємо Pointer Lock при кліку, навіть якщо клік
     * прийшов не по canvas (overlay, fullscreen, меню закрилось).
     * Захист: не перехоплюємо кліки по інтерактивних елементах UI.
     */
    if (this.pointerLocked) return;

    const target = event.target;
    if (target && target.closest && target.closest('.hud-root, .scoreboard-root, .buy-menu, .settings-root, .chat-root, .lobby-root, .matchover-root, .nameplate-root')) {
      return;
    }

    this.lock();
  }

  /**
   * Глобальний клік: якщо Pointer Lock втрачено і гра активна,
   * а клік прийшов по canvas — відновлюємо lock.
   * Використовується для випадків, коли overlay/меню зникло,
   * але click подія не дійшла до canvas (повноекранний режим).
   */
  relock() {
    if (!this.pointerLocked) {
      this.lock();
    }
  }

  _onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.domElement;

    if (!this.pointerLocked) {
      this._clearAll();
    }
  }

  _onPointerLockError() {
    console.warn('[InputManager] Pointer Lock error.');
  }

  _onContextMenu(event) {
    event.preventDefault();
  }
}
