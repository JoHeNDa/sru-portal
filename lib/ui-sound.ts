export type UiSound = 'success' | 'delete' | 'attention';

const SOUND_SETTING = 'sru-ui-sounds';
const VOLUME_SETTING = 'sru-ui-volume';
const ATTENTION_SETTING = 'sru-last-attention-sound';
const DEFAULT_VOLUME = 0.4;

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (!window.AudioContext) return null;
  if (!audioContext || audioContext.state === 'closed') audioContext = new window.AudioContext();
  return audioContext;
}

function getVolume(): number {
  const stored = window.localStorage.getItem(VOLUME_SETTING);
  const v = stored === null ? DEFAULT_VOLUME : parseFloat(stored);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VOLUME;
}

export function setUiVolume(v: number) {
  window.localStorage.setItem(VOLUME_SETTING, String(Math.max(0, Math.min(1, v))));
}

export function getUiVolume(): number {
  return getVolume();
}

export function primeUiSounds() {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(SOUND_SETTING) === 'off') return;
  const context = getAudioContext();
  if (context?.state === 'suspended') {
    void context.resume().catch(error => console.debug('UI audio could not be enabled:', error));
  }
}

function playTone(context: AudioContext, sound: UiSound) {
  const masterGain = context.createGain();
  masterGain.connect(context.destination);
  masterGain.gain.value = getVolume();

  const now = context.currentTime;

  if (sound === 'delete') {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(1, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.23);
    return;
  }

  if (sound === 'attention') {
    const notes = [660, 880, 660];
    notes.forEach((freq, i) => {
      const t0 = now + i * 0.1;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(1, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      osc.connect(gain).connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.1);
    });
    return;
  }

  // success: two-note chime, ascending
  [523.25, 783.99].forEach((freq, i) => {
    const t0 = now + i * 0.08;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(1, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    osc.connect(gain).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.15);
  });
}

export function playUiSound(sound: UiSound) {
  if (typeof window === 'undefined' || window.localStorage.getItem(SOUND_SETTING) === 'off') return;
  if (sound === 'attention') {
    const lastPlayed = Number(window.localStorage.getItem(ATTENTION_SETTING) ?? 0);
    if (Date.now() - lastPlayed < 24 * 60 * 60 * 1000) return;
    window.localStorage.setItem(ATTENTION_SETTING, String(Date.now()));
  }
  const context = getAudioContext();
  if (!context) return;
  if (context.state === 'suspended') {
    void context.resume().then(() => playTone(context, sound)).catch(error => console.debug('UI sound could not be played:', error));
    return;
  }
  playTone(context, sound);
}

export function setUiSoundsEnabled(enabled: boolean) {
  window.localStorage.setItem(SOUND_SETTING, enabled ? 'on' : 'off');
}

export function getUiSoundsEnabled(): boolean {
  return window.localStorage.getItem(SOUND_SETTING) !== 'off';
}