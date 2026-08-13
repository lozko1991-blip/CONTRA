const CHAT_STYLE_ID = 'cs16-chat-style';

const CHAT_CSS = `
.chat-root {
  position: fixed;
  left: 12px;
  bottom: 90px;
  z-index: 2500;
  width: 420px;
  pointer-events: none;
  font-family: "Segoe UI", Arial, sans-serif;
}

.chat-log {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 220px;
  overflow: hidden;
}

.chat-msg {
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.4);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-msg .chat-name {
  font-weight: 700;
}

.chat-msg.team .chat-name {
  color: #ffd27a;
}

.chat-msg.all .chat-name {
  color: #9dd4ff;
}

.chat-msg.self {
  opacity: 0.95;
}

.chat-input-wrap {
  display: none;
  margin-top: 6px;
  pointer-events: auto;
}

.chat-input-wrap.open {
  display: block;
}

.chat-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 10px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.7);
  color: #eee;
  font-size: 14px;
  outline: none;
}

.chat-input::placeholder {
  color: #999;
}
`;

export class ChatUI {
  constructor({ onSend = null, localName = 'Player' } = {}) {
    this.onSend = onSend;
    this.localName = localName;
    this.messages = [];
    this.mode = 'all';
    this.open = false;

    this.injectStyle();
    this.build();

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown, true);
    window.addEventListener('keyup', this._onKeyUp, true);
  }

  injectStyle() {
    const old = document.getElementById(CHAT_STYLE_ID);
    if (old) {
      old.textContent = CHAT_CSS;
      return;
    }

    const style = document.createElement('style');
    style.id = CHAT_STYLE_ID;
    style.textContent = CHAT_CSS;

    document.head.appendChild(style);
  }

  build() {
    this.root = document.createElement('div');
    this.root.className = 'chat-root';

    this.logEl = document.createElement('div');
    this.logEl.className = 'chat-log';

    this.inputWrap = document.createElement('div');
    this.inputWrap.className = 'chat-input-wrap';

    this.input = document.createElement('input');
    this.input.className = 'chat-input';
    this.input.placeholder = 'Напиши повідомлення... (Enter — надіслати, Esc — вийти)';

    this.inputWrap.appendChild(this.input);
    this.root.appendChild(this.logEl);
    this.root.appendChild(this.inputWrap);

    document.body.appendChild(this.root);

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.submit();
      }
    });
  }

  _onKeyDown(event) {
    if (event.code === 'KeyY' && !this.open && !event.repeat) {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.openInput('all');
    } else if (event.code === 'KeyU' && !this.open && !event.repeat) {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.openInput('team');
    } else if (event.code === 'Escape' && this.open) {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.closeInput();
    }
  }

  _onKeyUp(event) {
    if (event.code === 'KeyY' && this.open && this.mode === 'all' && !this.input.value) {
      this.closeInput();
    } else if (event.code === 'KeyU' && this.open && this.mode === 'team' && !this.input.value) {
      this.closeInput();
    }
  }

  openInput(mode) {
    this.mode = mode;
    this.open = true;
    this.inputWrap.classList.add('open');
    this.input.placeholder =
      mode === 'all' ? 'Всі: ...' : 'Команда: ...';
    this.input.value = '';
    this.input.focus();
  }

  closeInput() {
    this.open = false;
    this.inputWrap.classList.remove('open');
    this.input.value = '';
    this.input.blur();
  }

  submit() {
    const text = this.input.value.trim();

    if (text) {
      this.onSend?.(text, this.mode);
      this.addMessage({
        senderName: this.localName,
        text,
        team: this.mode,
        self: true
      });
    }

    this.closeInput();
  }

  addMessage({ senderName = 'Player', text = '', team = 'all', self = false } = {}) {
    const el = document.createElement('div');
    el.className = 'chat-msg ' + team + (self ? ' self' : '');

    const name = document.createElement('span');
    name.className = 'chat-name';
    name.textContent = senderName + ': ';

    el.appendChild(name);
    el.appendChild(document.createTextNode(text));

    this.logEl.appendChild(el);

    while (this.logEl.children.length > 8) {
      this.logEl.removeChild(this.logEl.firstChild);
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown, true);
    window.removeEventListener('keyup', this._onKeyUp, true);

    if (this.root?.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}
