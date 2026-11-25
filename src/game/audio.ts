// Procedural Web Audio Engine: V8/W16/V12 engine synth, tire drift screech,
// nitro boost whoosh, spark collision impact, boost pad chime, countdown & fanfare.

export class RaceAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private screechGain: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;
  private muted = false;
  private active = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : 0.32, this.ctx.currentTime, 0.04);
    }
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.32;
      this.masterGain.connect(this.ctx.destination);

      // Engine harmonic synth
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineFilter.Q.value = 2.4;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;

      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.value = 65;

      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.value = 130;

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc1.start();
      this.engineOsc2.start();

      // Continuous filtered noise buffer for drift tire screech
      const bufSize = this.ctx.sampleRate * 2;
      const noiseBuf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

      this.screechFilter = this.ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 1450;
      this.screechFilter.Q.value = 5.5;

      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0;

      noiseSrc.connect(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.masterGain);
      noiseSrc.start();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.active = true;
  }

  public updateContinuous(rpm: number, isDrifting: boolean, isBoosting: boolean, playing: boolean): void {
    if (!this.ctx || !this.active || !this.engineOsc1 || !this.engineOsc2 || !this.engineGain || !this.engineFilter || !this.screechGain) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!playing || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.screechGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    const baseFreq = 58 + rpm * 155 + (isBoosting ? 36 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.995, now, 0.04);
    this.engineFilter.frequency.setTargetAtTime(240 + rpm * 1200 + (isBoosting ? 600 : 0), now, 0.05);
    this.engineGain.gain.setTargetAtTime(0.11 + rpm * 0.08 + (isBoosting ? 0.05 : 0), now, 0.06);

    this.screechGain.gain.setTargetAtTime(isDrifting ? 0.095 : 0, now, 0.05);
  }

  public playTone(freq: number, duration: number, type: OscillatorType = 'triangle', vol = 0.24, slideTo?: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + duration);
    }
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playCollision(intensity: number): void {
    const pitch = 110 + (Math.random() - 0.5) * 20;
    this.playTone(pitch, 0.16, 'sawtooth', 0.16 + intensity * 0.18, 42);
  }

  public playBoostSurge(tier = 2): void {
    this.playTone(220 + tier * 55, 0.28, 'sawtooth', 0.18, 620 + tier * 90);
    this.playTone(440 + tier * 70, 0.22, 'triangle', 0.14, 880);
  }

  public playCountdownBeep(isGo: boolean): void {
    this.playTone(isGo ? 880 : 440, isGo ? 0.34 : 0.14, 'triangle', isGo ? 0.28 : 0.22);
  }

  public playLapChime(isFinal: boolean): void {
    const notes = isFinal ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 739.99, 880];
    notes.forEach((n, idx) => {
      window.setTimeout(() => {
        this.playTone(n, isFinal ? 0.38 : 0.18, 'triangle', 0.22);
      }, idx * 85);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
