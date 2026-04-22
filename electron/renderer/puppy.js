// State-machine animator. Modes are long-running poses (idle / alert / bored / dormant)
// with proper start → loop → end transitions. Transient triggers (bark, greet, active,
// overwhelmed) interrupt for one-shots and return to the current mode's loop.
// Supports .fbx and .glb/.gltf. Missing clips are skipped safely.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Clip candidates — first match in the model wins.
const DEFAULT_CLIPS = {
  // Mode loops.
  idleLoop:      ['Arm_Puppy|Idle_1', 'Idle_1', 'Idle'],
  alertLoop:     ['Arm_Puppy|Sitting_loop_1', 'Sitting_loop_1'],
  boredLoop:     ['Arm_Puppy|Lie_loop_1', 'Lie_loop_1'],
  dormantLoop:   ['Arm_Puppy|Lie_Sleep_loop', 'Lie_Sleep_loop'],

  // Mode transitions.
  alertEnter:    ['Arm_Puppy|Sitting_start', 'Sitting_start'],
  alertExit:     ['Arm_Puppy|Sitting_end', 'Sitting_end'],
  boredEnter:    ['Arm_Puppy|Lie_start', 'Lie_start'],
  boredExit:     ['Arm_Puppy|Lie_end', 'Lie_end'],
  dormantEnter:  ['Arm_Puppy|Lie_Sleep_start', 'Lie_Sleep_start'],
  dormantExit:   ['Arm_Puppy|Lie_Sleep_end', 'Lie_Sleep_end'],

  // Transient gestures. Attack_Bite is the only clip with actual jaw motion — reads as a bark.
  bark:          ['Arm_Puppy|Bark', 'Bark', 'Arm_Puppy|Attack_Bite', 'Attack_Bite', 'Arm_Puppy|Jump_Inplace_Full'],
  greet:         ['Arm_Puppy|Idle_3', 'Idle_3', 'Arm_Puppy|Idle_6'],

  // Walk cycle used by the wander system.
  walk:          ['Arm_Puppy|Walk_F_IP', 'Walk_F_IP', 'Arm_Puppy|Trot_F_IP'],

  // Eat_loop gets looped for the feed action's duration.
  eat:           ['Arm_Puppy|Eat_loop', 'Eat_loop'],

  // Random-active pool — curated in-place clips that read as "doing something."
  activePool: [
    'Arm_Puppy|Idle_2',
    'Arm_Puppy|Idle_3',
    'Arm_Puppy|Idle_4',
    'Arm_Puppy|Idle_6',
    'Arm_Puppy|Turn_L_IP',
    'Arm_Puppy|Turn_R_IP'
  ]
};

const DEFAULT_CONFIG = {
  fitSize: 1.0,
  facingAxis: '+z',
  fadeSec: 0.2,
  alertHoldMs: 5000,
  barkSpeed: 1.4,        // timeScale for the bark clip — snappier than realtime
  faceRightY: Math.PI / 2,
  faceLeftY:  -Math.PI / 2,
  textures: { baseColor: null, flipY: false },
  clips: DEFAULT_CLIPS
};

function deepMerge(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b || {})) {
    const v = b[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = deepMerge(a[k] || {}, v);
    else out[k] = v;
  }
  return out;
}

async function fetchJsonOrNull(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function loadModel(url) {
  const lower = url.toLowerCase();
  if (lower.endsWith('.fbx')) {
    const loader = new FBXLoader();
    const obj = await new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
    return { scene: obj, animations: obj.animations || [] };
  }
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
  return { scene: gltf.scene, animations: gltf.animations || [] };
}

function findClip(candidates, clips) {
  if (!Array.isArray(candidates)) return null;
  for (const name of candidates) {
    const c = clips.find((cl) => cl.name === name);
    if (c) return c;
  }
  return null;
}

export async function loadPuppy(modelUrl, configUrl) {
  const { scene: model, animations } = await loadModel(modelUrl);
  const userConfig = await fetchJsonOrNull(configUrl) || {};
  const config = deepMerge(DEFAULT_CONFIG, userConfig);

  const root = new THREE.Group();
  if (config.facingAxis === '+x') model.rotation.y = -Math.PI / 2;
  root.add(model);

  // Optional baseColor texture for FBX meshes that ship without materials.
  if (config.textures && config.textures.baseColor) {
    try {
      const texLoader = new THREE.TextureLoader();
      const baseColor = await new Promise((resolve, reject) =>
        texLoader.load(config.textures.baseColor, resolve, undefined, reject)
      );
      baseColor.colorSpace = THREE.SRGBColorSpace;
      baseColor.flipY = !!config.textures.flipY;
      let applied = 0;
      model.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          m.map = baseColor;
          m.color = new THREE.Color(0xffffff);
          m.needsUpdate = true;
          applied++;
        }
      });
      console.log('[woofy] applied baseColor to ' + applied + ' material(s)');
    } catch (err) {
      console.warn('[woofy] baseColor load failed: ' + err.message);
    }
  }

  // Autofit: feet on ground, centered, scale so max dim = fitSize.
  const rawBox = new THREE.Box3().setFromObject(model);
  const rawSize = new THREE.Vector3(); rawBox.getSize(rawSize);
  const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
  if (maxDim > 0) model.scale.multiplyScalar(config.fitSize / maxDim);
  const fitBox = new THREE.Box3().setFromObject(model);
  const fitCenter = new THREE.Vector3(); fitBox.getCenter(fitCenter);
  model.position.x -= fitCenter.x;
  model.position.z -= fitCenter.z;
  model.position.y -= fitBox.min.y;

  const clips = animations;
  const mixer = new THREE.AnimationMixer(model);
  const FADE = config.fadeSec;

  // Resolve clip candidates once.
  const R = {};
  for (const key of Object.keys(config.clips)) {
    if (Array.isArray(config.clips[key]) && typeof config.clips[key][0] === 'string') {
      R[key] = findClip(config.clips[key], clips);
    }
  }
  // Active pool → array of clips (filtered to what exists).
  const activePool = (config.clips.activePool || [])
    .map((name) => clips.find((c) => c.name === name))
    .filter(Boolean);

  console.log('[woofy] resolved clips: ' + JSON.stringify(
    Object.fromEntries(Object.entries(R).map(([k, v]) => [k, v ? v.name : '<missing>']))
  ));
  console.log('[woofy] active pool: ' + activePool.length + ' clip(s)');

  // Sequencer -------------------------------------------------------
  const queue = [];
  let currentAction = null;
  let currentStartedAt = 0;
  let currentDurMs = 0;
  let currentIsLoop = false;
  let pendingAlertTimer = null;

  function playItem(item) {
    if (!item || !item.clip) { _advance(); return; }
    const action = mixer.clipAction(item.clip);
    action.reset();
    action.setLoop(item.loop ? THREE.LoopRepeat : THREE.LoopOnce, item.loop ? Infinity : 1);
    action.clampWhenFinished = !item.loop;
    // Per-clip timeScale — speed up the bark so it snaps instead of dragging.
    action.timeScale = (R.bark && item.clip === R.bark) ? config.barkSpeed : 1;
    if (currentAction && currentAction !== action) currentAction.fadeOut(FADE);
    action.fadeIn(FADE).play();
    currentAction = action;
    currentStartedAt = performance.now();
    currentDurMs = (item.clip.duration * 1000) / action.timeScale;
    currentIsLoop = !!item.loop;
  }

  function _advance() {
    const next = queue.shift();
    if (next) playItem(next);
  }

  function enqueueSequence(items, { replace = true } = {}) {
    const cleaned = items.filter((i) => i && i.clip);
    if (replace) {
      queue.length = 0;
      if (pendingAlertTimer) { clearTimeout(pendingAlertTimer); pendingAlertTimer = null; }
    }
    queue.push(...cleaned);
    if (!currentAction || currentIsLoop || replace) _advance();
  }

  // Mode state ------------------------------------------------------
  // mode = 'idle' | 'alert' | 'bored' | 'dormant'
  let currentMode = 'idle';
  const MODES = {
    idle:    { loop: R.idleLoop,    enter: null,         exit: null         },
    alert:   { loop: R.alertLoop,   enter: R.alertEnter, exit: R.alertExit  },
    bored:   { loop: R.boredLoop,   enter: R.boredEnter, exit: R.boredExit  },
    dormant: { loop: R.dormantLoop, enter: R.dormantEnter, exit: R.dormantExit }
  };

  function modeLoopItem(m) {
    const cfg = MODES[m];
    return cfg && cfg.loop ? { clip: cfg.loop, loop: true } : null;
  }

  function setMode(newMode, opts = {}) {
    if (!MODES[newMode]) return;
    if (newMode === currentMode) return;
    const oldCfg = MODES[currentMode];
    const newCfg = MODES[newMode];
    const seq = [];
    if (oldCfg && oldCfg.exit) seq.push({ clip: oldCfg.exit, loop: false });
    if (newCfg.enter) seq.push({ clip: newCfg.enter, loop: false });
    if (newCfg.loop)  seq.push({ clip: newCfg.loop, loop: true });
    enqueueSequence(seq);
    currentMode = newMode;
  }

  // Transient triggers ----------------------------------------------
  // Interrupt current playback, play one-shot(s), return to current mode's loop.

  function transient(clipItems) {
    const items = Array.isArray(clipItems) ? clipItems : [clipItems];
    const cleaned = items.filter(Boolean).map((x) => x.clip ? x : { clip: x, loop: false });
    const tail = modeLoopItem(currentMode);
    if (tail) cleaned.push(tail);
    enqueueSequence(cleaned);
  }

  function bark() {
    // If currently dormant, wake into idle then bark.
    if (currentMode === 'dormant') {
      const seq = [];
      if (MODES.dormant.exit) seq.push({ clip: MODES.dormant.exit, loop: false });
      if (R.bark) seq.push({ clip: R.bark, loop: false });
      if (MODES.idle.loop) seq.push({ clip: MODES.idle.loop, loop: true });
      currentMode = 'idle';
      enqueueSequence(seq);
      return R.bark ? R.bark.name : null;
    }
    if (!R.bark) return null;
    transient(R.bark);
    return R.bark.name;
  }

  function greet() {
    // Come up to idle first if we were in a lying/sleeping mode.
    if (currentMode === 'dormant' || currentMode === 'bored') setMode('idle');
    if (R.greet) transient(R.greet);
  }

  function playActive() {
    if (activePool.length === 0) return null;
    if (currentMode !== 'idle') return null; // only fidget while idle
    const pick = activePool[Math.floor(Math.random() * activePool.length)];
    transient(pick);
    return pick.name;
  }

  function overwhelmed() {
    if (!R.bark) return;
    // Double-jump reaction.
    const seq = [{ clip: R.bark, loop: false }, { clip: R.bark, loop: false }];
    const tail = modeLoopItem(currentMode);
    if (tail) seq.push(tail);
    enqueueSequence(seq);
  }

  function alert() {
    if (currentMode === 'alert') return;
    setMode('alert');
    if (pendingAlertTimer) clearTimeout(pendingAlertTimer);
    pendingAlertTimer = setTimeout(() => {
      pendingAlertTimer = null;
      // Bark once, close alert, return to idle.
      const seq = [];
      if (R.bark) seq.push({ clip: R.bark, loop: false });
      if (MODES.alert.exit) seq.push({ clip: MODES.alert.exit, loop: false });
      if (MODES.idle.loop) seq.push({ clip: MODES.idle.loop, loop: true });
      currentMode = 'idle';
      enqueueSequence(seq);
    }, config.alertHoldMs);
  }

  // Feed → play Eat_loop for a fixed duration, then return to current mode's loop.
  let eatEndTimer = null;
  function eat(durationMs = 3000) {
    if (!R.eat) return;
    enqueueSequence([{ clip: R.eat, loop: true }]);
    if (eatEndTimer) clearTimeout(eatEndTimer);
    eatEndTimer = setTimeout(() => {
      eatEndTimer = null;
      const tail = modeLoopItem(currentMode);
      if (tail) enqueueSequence([tail]);
    }, durationMs);
  }

  // Walk (for screen wander) — rotates to face the direction of travel, loops walk clip.
  function walk(direction) {
    if (!R.walk) return;
    root.rotation.y = direction >= 0 ? config.faceRightY : config.faceLeftY;
    enqueueSequence([{ clip: R.walk, loop: true }]);
  }

  function stopWalk() {
    // Reset facing and return to current mode's loop.
    root.rotation.y = 0;
    const tail = modeLoopItem(currentMode);
    if (tail) enqueueSequence([tail]);
  }

  // Test harness — play any clip by exact name or case-insensitive substring.
  function playClip(query) {
    if (!query) return null;
    let clip = clips.find((c) => c.name === query);
    if (!clip) {
      const q = query.toLowerCase();
      clip = clips.find((c) => c.name.toLowerCase().includes(q));
    }
    if (!clip) {
      console.warn('[woofy] no clip matching "' + query + '"');
      return null;
    }
    console.log('[woofy] playing clip: ' + clip.name);
    transient(clip);
    return clip.name;
  }

  function update(dt) {
    mixer.update(dt / 1000);
    if (!currentIsLoop && currentAction && (performance.now() - currentStartedAt) >= currentDurMs - 20) {
      _advance();
    }
  }

  // Start in idle — awake, ready.
  if (MODES.idle.loop) enqueueSequence([{ clip: MODES.idle.loop, loop: true }]);

  return {
    root,
    clipNames: clips.map((c) => c.name),
    puppy: { bark, alert, greet, playActive, overwhelmed, setMode, walk, stopWalk, eat, playClip, update }
  };
}
