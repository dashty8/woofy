// Synthesized bark — short noise burst with a pitch envelope. No mp3 required.

let ctx = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function noiseBuffer(ac, durationS) {
  const sr = ac.sampleRate;
  const len = Math.floor(sr * durationS);
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function oneBark(ac, t, opts) {
  const dur = opts.dur || 0.14;
  const basePitch = opts.pitch || 620;

  // Noise component (body of the bark)
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

  // Tonal component (voice of the bark)
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

export function bark(kind = 'done') {
  const ac = getCtx();
  if (ac.state === 'suspended') ac.resume();
  const t = ac.currentTime;
  if (kind === 'alert') {
    // Sharper, higher, two quick yips.
    oneBark(ac, t + 0.00, { pitch: 780, dur: 0.11 });
    oneBark(ac, t + 0.16, { pitch: 820, dur: 0.11 });
  } else {
    // Friendly single woof, lower pitch.
    oneBark(ac, t, { pitch: 540, dur: 0.18 });
    oneBark(ac, t + 0.26, { pitch: 560, dur: 0.14 });
  }
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
