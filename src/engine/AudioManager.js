/**
 * AudioManager — повністю процедурний звук на Web Audio API.
 *
 * Жодних зовнішніх аудіофайлів:
 * всі звуки синтезуються з шуму та осциляторів.
 *
 * Підтримка:
 * - 3D позиціонування через PannerNode (HRTF);
 * - слухач слідує за камерою;
 * - різні профілі пострілів для кожної зброї;
 * - глушник.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.enabled = true;
  }

  /**
   * Створюємо AudioContext.
   * Виклик відбувається в межах user gesture (клік по START),
   * тому браузер дозволить звук.
   */
  unlock() {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      this.ctx = new AudioContextClass();

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.15;

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;

      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer();

      this.startAmbient();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // ignore
      });
    }
  }

  /**
   * Фоновий ambient: легкий вітер.
   */
  startAmbient() {
    if (!this.ctx || this._ambientOn) return;
    this._ambientOn = true;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    noise.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 180;
    bandpass.Q.value = 0.4;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 60;

    const envelope = this.ctx.createGain();
    envelope.gain.value = 0.03;

    noise.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(envelope);
    envelope.connect(this.master);

    noise.start();
    this._ambientNoise = noise;

    /**
     * Періодичні пташині звуки у фоновому режимі.
     */
    this._nextBirdTime = 4 + Math.random() * 8;
  }

  /**
   * Рідкісний пташиний спів.
   */
  updateAmbient(dt) {
    if (!this.ctx || !this._ambientOn) return;

    this._nextBirdTime -= dt;

    if (this._nextBirdTime <= 0) {
      this._nextBirdTime = 5 + Math.random() * 15;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';

      const baseFreq = 1800 + Math.random() * 1200;

      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
        const start = t + i * (0.1 + Math.random() * 0.15);
        osc.frequency.setValueAtTime(baseFreq * (0.8 + Math.random() * 0.4), start);
        osc.frequency.setValueAtTime(baseFreq * (0.7 + Math.random() * 0.5), start + 0.05);
        osc.frequency.setValueAtTime(baseFreq * (0.9 + Math.random() * 0.3), start + 0.09);
      }

      const envelope = this.ctx.createGain();
      envelope.gain.setValueAtTime(0, t);
      envelope.gain.linearRampToValueAtTime(0.025, t + 0.02);
      envelope.gain.linearRampToValueAtTime(0.025, t + 0.3);
      envelope.gain.linearRampToValueAtTime(0, t + 0.55);

      osc.connect(envelope);
      envelope.connect(this.master);

      osc.start(t);
      osc.stop(t + 0.6);
    }
  }

  setVolume(volume = 0.8) {
    this._volume = volume;

    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volume)) * 0.85,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  createNoiseBuffer() {
    const length = this.ctx.sampleRate;

    const buffer = this.ctx.createBuffer(
      1,
      length,
      this.ctx.sampleRate
    );

    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  setListener(position, forward, up) {
    if (!this.ctx) {
      return;
    }

    const listener = this.ctx.listener;

    if (listener.positionX) {
      listener.positionX.value = position.x;
      listener.positionY.value = position.y;
      listener.positionZ.value = position.z;

      listener.forwardX.value = forward.x;
      listener.forwardY.value = forward.y;
      listener.forwardZ.value = forward.z;

      listener.upX.value = up.x;
      listener.upY.value = up.y;
      listener.upZ.value = up.z;
    } else if (listener.setPosition) {
      listener.setPosition(
        position.x,
        position.y,
        position.z
      );

      listener.setOrientation(
        forward.x,
        forward.y,
        forward.z,
        up.x,
        up.y,
        up.z
      );
    }
  }

  createPanner(position) {
    const panner = this.ctx.createPanner();

    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.5;
    panner.maxDistance = 90;
    panner.rolloffFactor = 1.1;

    const x = position?.x ?? 0;
    const y = position?.y ?? 0;
    const z = position?.z ?? 0;

    if (panner.positionX) {
      panner.positionX.value = x;
      panner.positionY.value = y;
      panner.positionZ.value = z;
    } else if (panner.setPosition) {
      panner.setPosition(x, y, z);
    }

    panner.connect(this.master);

    return panner;
  }

  destination(position) {
    if (position) {
      return this.createPanner(position);
    }

    return this.master;
  }

  noiseBurst(
    dest,
    {
      duration = 0.1,
      gain = 0.3,
      filterType = 'lowpass',
      freq = 1000,
      delay = 0,
      rate = 1
    } = {}
  ) {
    const t = this.ctx.currentTime + delay;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = rate;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;

    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(gain, t);
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      t + duration
    );

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(dest);

    source.start(t);
    source.stop(t + duration + 0.02);
  }

  tone(
    dest,
    {
      type = 'sine',
      from = 440,
      to = null,
      duration = 0.1,
      gain = 0.2,
      delay = 0
    } = {}
  ) {
    const t = this.ctx.currentTime + delay;

    const oscillator = this.ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, t);

    if (to) {
      oscillator.frequency.exponentialRampToValueAtTime(
        to,
        t + duration
      );
    }

    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(gain, t);
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      t + duration
    );

    oscillator.connect(envelope);
    envelope.connect(dest);

    oscillator.start(t);
    oscillator.stop(t + duration + 0.02);
  }

  playShot({
    weaponId = 'ak47',
    position = null,
    suppressed = false
  } = {}) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const t = this.ctx.currentTime;
    const dest = this.destination(position);

    const profiles = {
      ak47: {
        cutoff: 900,
        gain: 1.0,
        boom: 110,
        length: 0.16,
        crack: 0.9,
        crackFreq: 2400
      },
      m4a1: {
        cutoff: 1300,
        gain: 0.85,
        boom: 140,
        length: 0.13,
        crack: 0.7,
        crackFreq: 3000
      },
      deagle: {
        cutoff: 700,
        gain: 1.25,
        boom: 75,
        length: 0.22,
        crack: 1.1,
        crackFreq: 1800
      },
      bot_rifle: {
        cutoff: 1000,
        gain: 0.8,
        boom: 120,
        length: 0.14,
        crack: 0.8,
        crackFreq: 2600
      }
    };

    let profile = profiles[weaponId] ?? profiles.ak47;

    if (suppressed) {
      profile = {
        ...profile,
        cutoff: Math.min(profile.cutoff, 600),
        gain: profile.gain * 0.4,
        length: profile.length * 0.7,
        crack: profile.crack * 0.3
      };
    }

    /**
     * Випадкова варіація висоти — кожен постріл звучить трохи інакше.
     */
    const pitchVar = 0.94 + Math.random() * 0.12;

    /**
     * Пороховий тріск — шум через lowpass,
     * що швидко закривається.
     */
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    noise.playbackRate.value = pitchVar;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(
      profile.cutoff * 3,
      t
    );
    lowpass.frequency.exponentialRampToValueAtTime(
      profile.cutoff,
      t + profile.length
    );

    const noiseEnvelope = this.ctx.createGain();
    noiseEnvelope.gain.setValueAtTime(profile.gain, t);
    noiseEnvelope.gain.exponentialRampToValueAtTime(
      0.0001,
      t + profile.length
    );

    noise.connect(lowpass);
    lowpass.connect(noiseEnvelope);
    noiseEnvelope.connect(dest);

    noise.start(t);
    noise.stop(t + profile.length + 0.02);

    /**
     * Низький удар — основа "тіла" пострілу.
     */
    const oscillator = this.ctx.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(
      profile.boom * 2.2 * pitchVar,
      t
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      profile.boom * pitchVar,
      t + profile.length * 0.8
    );

    const boomEnvelope = this.ctx.createGain();
    boomEnvelope.gain.setValueAtTime(
      profile.gain * 0.9,
      t
    );
    boomEnvelope.gain.exponentialRampToValueAtTime(
      0.0001,
      t + profile.length * 1.1
    );

    oscillator.connect(boomEnvelope);
    boomEnvelope.connect(dest);

    oscillator.start(t);
    oscillator.stop(t + profile.length * 1.2);

    /**
     * Різкий верхній клац (crack) — характерний для
     * AK/M4 "снайперський тріск", слабший у Deagle.
     */
    if (profile.crack > 0) {
      const crackNoise = this.ctx.createBufferSource();
      crackNoise.buffer = this.noiseBuffer;
      crackNoise.loop = true;
      crackNoise.playbackRate.value = pitchVar;

      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = profile.crackFreq;

      const crackGain = this.ctx.createGain();
      crackGain.gain.setValueAtTime(profile.gain * profile.crack * 0.5, t);
      crackGain.gain.exponentialRampToValueAtTime(
        0.0001,
        t + 0.045
      );

      crackNoise.connect(highpass);
      highpass.connect(crackGain);
      crackGain.connect(dest);

      crackNoise.start(t);
      crackNoise.stop(t + 0.06);
    }
  }

  playFootstep({
    position = null,
    surface = 'concrete',
    crouched = false,
    walking = false
  } = {}) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    /**
     * Присід — беззвучний, як у CS.
     */
    if (crouched) {
      return;
    }

    const dest = this.destination(position);

    const surfaceFrequency = {
      concrete: 420,
      wood: 540,
      metal: 720,
      grass: 300
    }[surface] ?? 420;

    const volume = walking ? 0.1 : 0.22;

    this.noiseBurst(dest, {
      duration: 0.09,
      gain: volume * (0.85 + Math.random() * 0.3),
      filterType: 'lowpass',
      freq: surfaceFrequency,
      rate: 0.7 + Math.random() * 0.25
    });
  }

  playReload() {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const dest = this.master;

    this.noiseBurst(dest, {
      duration: 0.035,
      gain: 0.25,
      filterType: 'highpass',
      freq: 1600
    });

    this.noiseBurst(dest, {
      duration: 0.04,
      gain: 0.3,
      filterType: 'highpass',
      freq: 1200,
      delay: 0.4
    });

    this.noiseBurst(dest, {
      duration: 0.03,
      gain: 0.28,
      filterType: 'highpass',
      freq: 2000,
      delay: 0.85
    });
  }

  playDryFire() {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    this.noiseBurst(this.master, {
      duration: 0.025,
      gain: 0.12,
      filterType: 'highpass',
      freq: 2600
    });
  }

  playImpact({ material = 'concrete', position = null } = {}) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const dest = this.destination(position);

    const freq = {
      concrete: 900,
      wood: 620,
      metal: 1800,
      glass: 2600,
      brick: 1000
    }[material] ?? 900;

    this.noiseBurst(dest, {
      duration: 0.05,
      gain: 0.16,
      filterType: 'highpass',
      freq,
      rate: 0.8 + Math.random() * 0.4
    });
  }

  playHitMarker(headshot = false) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    this.tone(this.master, {
      type: 'square',
      from: 1300,
      duration: 0.035,
      gain: 0.14
    });

    if (headshot) {
      this.tone(this.master, {
        type: 'square',
        from: 1750,
        duration: 0.05,
        gain: 0.16,
        delay: 0.045
      });
    }
  }

  playKill() {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    this.tone(this.master, {
      from: 880,
      duration: 0.09,
      gain: 0.18
    });

    this.tone(this.master, {
      from: 1320,
      duration: 0.14,
      gain: 0.2,
      delay: 0.1
    });
  }

  playDamage() {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    this.tone(this.master, {
      type: 'triangle',
      from: 130,
      to: 55,
      duration: 0.16,
      gain: 0.5
    });

    this.noiseBurst(this.master, {
      duration: 0.12,
      gain: 0.3,
      filterType: 'lowpass',
      freq: 400
    });
  }

  playDeath() {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    this.tone(this.master, {
      type: 'sawtooth',
      from: 280,
      to: 70,
      duration: 0.5,
      gain: 0.3
    });

    this.noiseBurst(this.master, {
      duration: 0.3,
      gain: 0.4,
      filterType: 'lowpass',
      freq: 250
    });
  }

  playGlassBreak(position = null) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const dest = this.destination(position);

    this.noiseBurst(dest, {
      duration: 0.22,
      gain: 0.4,
      filterType: 'highpass',
      freq: 2800
    });

    for (let i = 0; i < 6; i++) {
      this.tone(dest, {
        from: 2400 + Math.random() * 2600,
        duration: 0.05 + Math.random() * 0.06,
        gain: 0.08,
        delay: i * 0.03
      });
    }
  }

  playBuy() {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    this.tone(this.master, {
      from: 520,
      duration: 0.08,
      gain: 0.12
    });
  }

  playThrow() {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    this.noiseBurst(this.master, {
      duration: 0.12,
      gain: 0.14,
      filterType: 'bandpass',
      freq: 1400,
      rate: 1.3
    });
  }

  playBark(position = null) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const dest = position ? this.createPanner(position) : this.master;
    if (!dest) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.linearRampToValueAtTime(160, t + 0.08);
    osc.frequency.linearRampToValueAtTime(280, t + 0.16);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 2.5;

    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0.18, t);
    envelope.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(filter);
    filter.connect(envelope);
    envelope.connect(dest);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  /**
   * Радіо-команда бота: короткий двотональний сигнал
   * (як radio-біп в CS). kind змінює висоту тону.
   */
  playRadio(position = null, kind = 'spot') {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const dest = position ? this.createPanner(position) : this.master;
    if (!dest) return;

    const baseFreq = {
      spot: 900,
      kill: 1200,
      cover: 650,
      hurt: 500,
      clear: 1000
    }[kind] ?? 900;

    const t = this.ctx.currentTime;

    for (let i = 0; i < 2; i++) {
      const start = t + i * 0.16;

      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(baseFreq * (i === 0 ? 1 : 1.25), start);
      osc.frequency.exponentialRampToValueAtTime(
        baseFreq * (i === 0 ? 1.15 : 1.4),
        start + 0.1
      );

      const envelope = this.ctx.createGain();
      envelope.gain.setValueAtTime(0.07, start);
      envelope.gain.exponentialRampToValueAtTime(0.01, start + 0.13);

      osc.connect(envelope);
      envelope.connect(dest);

      osc.start(start);
      osc.stop(start + 0.14);
    }
  }

  playExplosion(position = null) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const dest = this.destination(position);

    this.tone(dest, {
      type: 'triangle',
      from: 100,
      to: 28,
      duration: 0.55,
      gain: 0.95
    });

    this.noiseBurst(dest, {
      duration: 0.45,
      gain: 0.75,
      filterType: 'lowpass',
      freq: 420
    });

    this.noiseBurst(dest, {
      duration: 0.08,
      gain: 0.35,
      filterType: 'highpass',
      freq: 2200
    });
  }

  playFlash(position = null) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const dest = this.destination(position);

    this.noiseBurst(dest, {
      duration: 0.3,
      gain: 0.85,
      filterType: 'lowpass',
      freq: 900
    });

    this.tone(dest, {
      from: 3200,
      duration: 0.9,
      gain: 0.1
    });
  }

  playSmoke(position = null) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const dest = this.destination(position);

    this.noiseBurst(dest, {
      duration: 1.6,
      gain: 0.22,
      filterType: 'lowpass',
      freq: 950,
      rate: 0.8
    });
  }

  playDoorCreak(position = null) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const dest = this.destination(position);
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.linearRampToValueAtTime(190, t + 0.28);
    osc.frequency.linearRampToValueAtTime(240, t + 0.5);

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 9;

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 24;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2.5;

    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.linearRampToValueAtTime(0.05, t + 0.08);
    envelope.gain.linearRampToValueAtTime(0.0001, t + 0.55);

    osc.connect(filter);
    filter.connect(envelope);
    envelope.connect(dest);

    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.6);
    lfo.stop(t + 0.6);
  }

  playDoorClose(position = null) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const dest = this.destination(position);

    this.tone(dest, {
      type: 'triangle',
      from: 140,
      to: 60,
      duration: 0.12,
      gain: 0.4
    });

    this.noiseBurst(dest, {
      duration: 0.08,
      gain: 0.3,
      filterType: 'lowpass',
      freq: 500
    });
  }

  playDoorHit(position = null) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const dest = this.destination(position);

    this.tone(dest, {
      type: 'triangle',
      from: 200,
      to: 90,
      duration: 0.09,
      gain: 0.25
    });

    this.noiseBurst(dest, {
      duration: 0.06,
      gain: 0.2,
      filterType: 'lowpass',
      freq: 600
    });
  }

  playDoorBreak(position = null) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const dest = this.destination(position);

    this.noiseBurst(dest, {
      duration: 0.3,
      gain: 0.6,
      filterType: 'lowpass',
      freq: 900
    });

    this.tone(dest, {
      type: 'triangle',
      from: 160,
      to: 45,
      duration: 0.35,
      gain: 0.5
    });

    for (let i = 0; i < 5; i++) {
      this.tone(dest, {
        from: 1600 + Math.random() * 1800,
        duration: 0.05 + Math.random() * 0.05,
        gain: 0.07,
        delay: i * 0.04
      });
    }
  }

  playRoundStart() {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    this.tone(this.master, {
      type: 'square',
      from: 660,
      duration: 0.09,
      gain: 0.16
    });

    this.tone(this.master, {
      type: 'square',
      from: 880,
      duration: 0.12,
      gain: 0.18,
      delay: 0.12
    });
  }

  playRoundEnd(won = false) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const notes = won
      ? [660, 880, 1180]
      : [520, 390, 260];

    notes.forEach((note, index) => {
      this.tone(this.master, {
        type: 'square',
        from: note,
        duration: 0.11,
        gain: 0.15,
        delay: index * 0.11
      });
    });
  }

  playJump() {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    this.noiseBurst(this.master, {
      duration: 0.14,
      gain: 0.1,
      filterType: 'bandpass',
      freq: 900,
      rate: 1.4
    });
  }

  playLand(intensity = 0.5) {
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.enabled) return;

    const gain = 0.15 + intensity * 0.35;

    this.tone(this.master, {
      type: 'triangle',
      from: 120,
      to: 50,
      duration: 0.12,
      gain
    });

    this.noiseBurst(this.master, {
      duration: 0.09,
      gain: gain * 0.8,
      filterType: 'lowpass',
      freq: 450
    });
  }
}
