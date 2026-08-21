/**
 * Web Audio API synthesizer for ambient study background sounds & audio cues.
 * Pure procedural audio - works 100% offline with zero external audio assets!
 */

class StudyAudioManager {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private currentAmbientType: 'none' | 'rain' | 'cafe' | 'whitenoise' | 'binaural' = 'none';
  private ambientNodes: Array<AudioNode | number> = [];
  private isMuted: boolean = false;
  private volume: number = 0.4;

  public resumeContext() {
    this.initContext();
  }

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.ambientGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play a pleasant chime when matchmaking finds a partner
  public playMatchSound() {
    try {
      this.initContext();
      if (!this.ctx || this.isMuted) return;

      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (Major chord arpeggio)

      notes.forEach((freq, index) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);

        gain.gain.setValueAtTime(0, now + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.15, now + index * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.7);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.75);
      });
    } catch {
      // Audio context might require user interaction first
    }
  }

  // Play Pomodoro completed bell chime
  public playPomodoroChime() {
    try {
      this.initContext();
      if (!this.ctx || this.isMuted) return;

      const now = this.ctx.currentTime;
      const fundamental = 880; // A5

      [fundamental, fundamental * 1.5, fundamental * 2].forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.2 / (i + 1), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 2.5);
      });
    } catch {
      // ignore
    }
  }

  // Play pop on reaction / chat message
  public playMessagePop() {
    try {
      this.initContext();
      if (!this.ctx || this.isMuted) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // ignore
    }
  }

  // Ambient sound synthesizer
  public setAmbient(type: 'none' | 'rain' | 'cafe' | 'whitenoise' | 'binaural') {
    this.stopAmbient();
    if (type === 'none') return;

    this.currentAmbientType = type;
    this.initContext();

    if (!this.ctx || !this.ambientGain) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (type === 'rain') {
      this.startRainSynth();
    } else if (type === 'cafe') {
      this.startCafeSynth();
    } else if (type === 'whitenoise') {
      this.startWhiteNoiseSynth();
    } else if (type === 'binaural') {
      this.startBinauralSynth();
    }
  }

  public getAmbient(): 'none' | 'rain' | 'cafe' | 'whitenoise' | 'binaural' {
    return this.currentAmbientType;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  private stopAmbient() {
    this.ambientNodes.forEach((node) => {
      if (typeof node === 'number') {
        clearInterval(node);
      } else {
        try {
          if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
          // ignore
        }
      }
    });
    this.ambientNodes = [];
    this.currentAmbientType = 'none';
  }

  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private startRainSynth() {
    if (!this.ctx || !this.ambientGain) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Filter to simulate soft raindrops and steady rainfall
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1100;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 200;

    const boostGain = this.ctx.createGain();
    boostGain.gain.value = 1.5;

    noise.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(boostGain);
    boostGain.connect(this.ambientGain);

    noise.start();
    this.ambientNodes.push(noise, lowpass, highpass, boostGain);
  }

  private startCafeSynth() {
    if (!this.ctx || !this.ambientGain) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 500;
    bandpass.Q.value = 1.5;

    const cafeGain = this.ctx.createGain();
    cafeGain.gain.value = 3.5; // Boost bandpassed noise so cafe sound is clearly audible

    noise.connect(bandpass);
    bandpass.connect(cafeGain);
    cafeGain.connect(this.ambientGain);

    noise.start();
    this.ambientNodes.push(noise, bandpass, cafeGain);
  }

  private startWhiteNoiseSynth() {
    if (!this.ctx || !this.ambientGain) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 1.2;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ambientGain);

    noise.start();
    this.ambientNodes.push(noise, filter, noiseGain);
  }

  private startBinauralSynth() {
    if (!this.ctx || !this.ambientGain) return;

    // 210Hz left, 216Hz right => 6Hz Theta waves for deep focus & study
    const leftOsc = this.ctx.createOscillator();
    const rightOsc = this.ctx.createOscillator();

    leftOsc.type = 'sine';
    rightOsc.type = 'sine';

    leftOsc.frequency.value = 210;
    rightOsc.frequency.value = 216;

    const merger = this.ctx.createChannelMerger(2);
    leftOsc.connect(merger, 0, 0);
    rightOsc.connect(merger, 0, 1);

    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.65; // Pleasant audible volume

    merger.connect(subGain);
    subGain.connect(this.ambientGain);

    leftOsc.start();
    rightOsc.start();

    this.ambientNodes.push(leftOsc, rightOsc, merger, subGain);
  }
}

export const studyAudio = new StudyAudioManager();
