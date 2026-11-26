// Procedural Web Audio Engine: Model-authentic supercar synth (Flat-6 / Quad-Turbo W16 /
// Twin-Turbo V8 / NA V12), turbo spool whistle, gear-shift exhaust crackle & blow-off chirp,
// tire drift screech, high-speed aerodynamic wind + nitro afterburner roar, impacts & chimes.

import { CarModelId } from './types';

interface EngineProfile {
  baseHz: number;
  rpmSpanHz: number;
  harmonic2Ratio: number;
  osc1Type: OscillatorType;
  osc2Type: OscillatorType;
  filterBaseHz: number;
  filterSpanHz: number;
  hasTurboWhine: boolean;
}

const ENGINE_PROFILES: Record<CarModelId, EngineProfile> = {
  gt3rs: {
    // 9,000 RPM Naturally Aspirated Flat-6 motorsport howl
    baseHz: 68,
    rpmSpanHz: 195,
    harmonic2Ratio: 1.5,
    osc1Type: 'sawtooth',
    osc2Type: 'triangle',
    filterBaseHz: 320,
    filterSpanHz: 1550,
    hasTurboWhine: false,
  },
  chiron: {
    // Deep Quad-Turbo 8.0L W16 thunder + high-pitched turbo spool
    baseHz: 46,
    rpmSpanHz: 128,
    harmonic2Ratio: 2.0,
    osc1Type: 'sawtooth',
    osc2Type: 'sawtooth',
    filterBaseHz: 210,
    filterSpanHz: 1120,
    hasTurboWhine: true,
  },
  f40: {
    // Raw Twin-Turbo V8 bark + aggressive turbo flutter/chirp
    baseHz: 56,
    rpmSpanHz: 162,
    harmonic2Ratio: 1.995,
    osc1Type: 'sawtooth',
    osc2Type: 'square',
    filterBaseHz: 260,
    filterSpanHz: 1320,
    hasTurboWhine: true,
  },
  svj: {
    // Screaming Naturally Aspirated 6.5L V12 shriek
    baseHz: 72,
    rpmSpanHz: 215,
    harmonic2Ratio: 1.498,
    osc1Type: 'sawtooth',
    osc2Type: 'sawtooth',
    filterBaseHz: 360,
    filterSpanHz: 1750,
    hasTurboWhine: false,
  },
};

export class RaceAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private screechGain: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private modelId: CarModelId = 'gt3rs';
  private muted = false;
  private active = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setCarModel(modelId: CarModelId): void {
    this.modelId = modelId;
    const profile = ENGINE_PROFILES[modelId];
    if (this.engineOsc1 && this.engineOsc2) {
      this.engineOsc1.type = profile.osc1Type;
      this.engineOsc2.type = profile.osc2Type;
    }
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
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.32;
      this.masterGain.connect(this.ctx.destination);

      const profile = ENGINE_PROFILES[this.modelId];

      // Engine harmonic synth
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = profile.filterBaseHz;
      this.engineFilter.Q.value = 2.6;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;

      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = profile.osc1Type;
      this.engineOsc1.frequency.value = profile.baseHz;

      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = profile.osc2Type;
      this.engineOsc2.frequency.value = profile.baseHz * profile.harmonic2Ratio;

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc1.start();
      this.engineOsc2.start();

      // Turbocharger spool whistle oscillator (Chiron W16 / F40 Twin-Turbo / Nitro)
      this.turboOsc = this.ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.value = 1400;
      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.value = 0;
      this.turboOsc.connect(this.turboGain);
      this.turboGain.connect(this.masterGain);
      this.turboOsc.start();

      // Shared white-noise buffer for tire screech, wind rush, afterburner & exhaust pops
      const bufSize = this.ctx.sampleRate * 2;
      const noiseBuf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = noiseBuf;

      // Tire screech loop
      const screechSrc = this.ctx.createBufferSource();
      screechSrc.buffer = noiseBuf;
      screechSrc.loop = true;

      this.screechFilter = this.ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 1480;
      this.screechFilter.Q.value = 5.5;

      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0;

      screechSrc.connect(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.masterGain);
      screechSrc.start();

      // High-speed aerodynamic wind + Nitro afterburner jet rush loop
      const windSrc = this.ctx.createBufferSource();
      windSrc.buffer = noiseBuf;
      windSrc.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 420;
      this.windFilter.Q.value = 0.9;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;

      windSrc.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      windSrc.start();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.active = true;
  }

  public updateContinuous(
    rpm: number,
    isDrifting: boolean,
    isBoosting: boolean,
    playing: boolean,
    speedNorm = 0
  ): void {
    if (
      !this.ctx ||
      !this.active ||
      !this.engineOsc1 ||
      !this.engineOsc2 ||
      !this.engineGain ||
      !this.engineFilter ||
      !this.screechGain ||
      !this.turboOsc ||
      !this.turboGain ||
      !this.windGain ||
      !this.windFilter
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!playing || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.screechGain.gain.setTargetAtTime(0, now, 0.05);
      this.turboGain.gain.setTargetAtTime(0, now, 0.05);
      this.windGain.gain.setTargetAtTime(0, now, 0.06);
      return;
    }

    const profile = ENGINE_PROFILES[this.modelId];
    const baseFreq = profile.baseHz + rpm * profile.rpmSpanHz + (isBoosting ? 38 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.035);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * profile.harmonic2Ratio, now, 0.035);
    this.engineFilter.frequency.setTargetAtTime(
      profile.filterBaseHz + rpm * profile.filterSpanHz + (isBoosting ? 650 : 0),
      now,
      0.045
    );
    this.engineGain.gain.setTargetAtTime(0.11 + rpm * 0.08 + (isBoosting ? 0.05 : 0), now, 0.05);

    // Turbo spool whine on turbocharged models or while boosting
    const turboVol =
      profile.hasTurboWhine || isBoosting
        ? Math.max(0, (rpm - 0.35) * 0.032) + (isBoosting ? 0.025 : 0)
        : 0;
    this.turboOsc.frequency.setTargetAtTime(1150 + rpm * 1950 + (isBoosting ? 650 : 0), now, 0.05);
    this.turboGain.gain.setTargetAtTime(turboVol, now, 0.05);

    // Tire screech pitch slightly scales with speed
    this.screechGain.gain.setTargetAtTime(isDrifting ? 0.095 : 0, now, 0.045);

    // Aerodynamic wind & Nitro jet rush
    const clampedSpeed = Math.max(0, Math.min(1.2, speedNorm));
    const windVol = Math.max(0, (clampedSpeed - 0.32) * 0.09) + (isBoosting ? 0.11 : 0);
    this.windFilter.frequency.setTargetAtTime(
      340 + clampedSpeed * 680 + (isBoosting ? 420 : 0),
      now,
      0.06
    );
    this.windGain.gain.setTargetAtTime(windVol, now, 0.06);
  }

  public playGearShift(upshift: boolean): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // Short motorsport exhaust crackle / pop burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(upshift ? 320 : 520, now);
    filter.Q.value = 1.4;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(upshift ? 0.22 : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (upshift ? 0.09 : 0.13));

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now, Math.random() * 1.2, 0.15);

    // Subtle turbo blow-off valve chirp on turbocharged cars
    if (ENGINE_PROFILES[this.modelId].hasTurboWhine && upshift) {
      this.playTone(2600, 0.075, 'sine', 0.055, 1350);
    }
  }

  public playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    vol = 0.24,
    slideTo?: number
  ): void {
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
