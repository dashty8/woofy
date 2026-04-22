// Bark playback — uses a real sample from assets/sounds/dog_bark.mp3.
// Falls back to a synthesized bark if the sample fails to load.

const BARK_URL = 'woofy://assets/sounds/dog_bark.mp3';

let ctx = null;
let barkBuffer = null;
let barkLoadPromise = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function loadBarkBuffer() {
  if (barkBuffer) return Promise.resolve(barkBuffer);
  if (barkLoadPromise) return barkLoadPromise;
  const ac = getCtx();
  barkLoadPromise = fetch(BARK_URL)
    .then((r) => {
      if (!r.ok) throw new Error('fetch ' + r.status);
      return r.arrayBuffer();
    })
    .then((buf) => ac.decodeAudioData(buf))
    .then((decoded) => { barkBuffer = decoded; return decoded; })
    .catch((err) => {
      console.warn('[woofy] bark sample load failed, using fallback:', err.message);
      return null;
    });
  return barkLoadPromise;
}

function playSample(ac, t, { rate = 1.0, gain = 0.9 } = {}) {
  if (!barkBuffer) return;
  const src = ac.createBufferSource();
  src.buffer = barkBuffer;
  src.playbackRate.value = rate;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(g).connect(ac.destination);
  src.start(t);
}

// ---- fallback synthesis (original implementation, used only if sample missing) ----

function noiseBuffer(ac, durationS) {
  const sr = ac.sampleRate;
  const len = Math.floor(sr * durationS);
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function synthBark(ac, t, opts) {
  const dur = opts.dur || 0.14;
  const basePitch = opts.pitch || 620;
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer(ac, dur);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.6;
  bp.frequency.setValueAtTime(basePitch * 1.2, t);
  bp.frequency.exponentialRampToValueAtTime(basePitch * 0.55, t + dur);
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.45, t + 0.012);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  noise.connect(bp).connect(ng).connect(ac.destination);
  noise.start(t);
  noise.stop(t + dur);
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(basePitch, t);
  osc.frequency.exponentialRampToValueAtTime(basePitch * 0.5, t + dur);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(og).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur);
}

// ---- public API ----

// Kick off sample preload as soon as this module is imported.
loadBarkBuffer();

export function bark(kind = 'done') {
  const ac = getCtx();
  if (ac.state === 'suspended') ac.resume();

  loadBarkBuffer().then(() => {
    const t = ac.currentTime;
    if (barkBuffer) {
      if (kind === 'alert') {
        // Sharper, higher, two quick yips — rate bump raises pitch.
        playSample(ac, t + 0.00, { rate: 1.18, gain: 0.95 });
        playSample(ac, t + 0.22, { rate: 1.24, gain: 0.95 });
      } else {
        // Friendly single woof at natural pitch, soft follow-up.
        playSample(ac, t + 0.00, { rate: 1.0,  gain: 0.95 });
        playSample(ac, t + 0.32, { rate: 1.05, gain: 0.75 });
      }
    } else {
      if (kind === 'alert') {
        synthBark(ac, t + 0.00, { pitch: 780, dur: 0.11 });
        synthBark(ac, t + 0.16, { pitch: 820, dur: 0.11 });
      } else {
        synthBark(ac, t,        { pitch: 540, dur: 0.18 });
        synthBark(ac, t + 0.26, { pitch: 560, dur: 0.14 });
      }
    }
  });
}

export function yawnSound() {
  const ac = getCtx();
  if (ac.state === 'suspended') ac.resume();
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(220, t + 0.5);
  osc.frequency.exponentialRampToValueAtTime(120, t + 1.1);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.1, t + 0.18);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 1.15);
}
