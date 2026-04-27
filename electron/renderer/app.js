import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadPuppy } from './puppy.js';
import { bark, yawnSound } from './sound.js';

const canvas = document.getElementById('scene');
const bubbleEl = document.getElementById('bubble');
const hudEl = document.getElementById('hud');
const menuEl = document.getElementById('menu');

// Left-click = pet. Press-and-drag = move the window. Threshold separates the two so
// brief drift on a click doesn't trigger movement.
const DRAG_THRESHOLD = 5;
let dragState = null;        // { startScreenX, startScreenY, pointerId, moved }
let suppressNextClick = false;

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (menuEl && menuEl.contains(e.target)) return;
  dragState = {
    startScreenX: e.screenX,
    startScreenY: e.screenY,
    pointerId: e.pointerId,
    moved: false
  };
  try { canvas.setPointerCapture(e.pointerId); } catch {}
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const dx = e.screenX - dragState.startScreenX;
  const dy = e.screenY - dragState.startScreenY;
  if (!dragState.moved) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragState.moved = true;
    if (window.woofy) window.woofy.dragStart();
  }
  if (window.woofy) window.woofy.dragMove(dx, dy);
});
function endDrag(e) {
  if (!dragState) return;
  if (e && e.pointerId !== dragState.pointerId) return;
  const moved = dragState.moved;
  try { if (e) canvas.releasePointerCapture(e.pointerId); } catch {}
  dragState = null;
  if (moved) {
    if (window.woofy) window.woofy.dragEnd();
    suppressNextClick = true;  // browser still fires click after a drag
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('click', (e) => {
  if (suppressNextClick) { suppressNextClick = false; return; }
  if (menuEl && menuEl.contains(e.target)) return;
  if (window.woofy) window.woofy.action('pet');
});

// Right-click opens the radial menu.
let menuHideTimer = null;
function showMenu() {
  if (!menuEl) return;
  menuEl.classList.add('show');
  if (menuHideTimer) clearTimeout(menuHideTimer);
  menuHideTimer = setTimeout(() => menuEl.classList.remove('show'), 5000);
}
function hideMenu() {
  if (menuEl) menuEl.classList.remove('show');
  if (menuHideTimer) { clearTimeout(menuHideTimer); menuHideTimer = null; }
}
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showMenu();
});
function goodbyeAndQuit() {
  if (!window.woofy) return;
  showBubble('bye!');
  const energy = latestState && latestState.energy;
  if (puppyCtrl) {
    puppyCtrl.greet();
    puppyCtrl.bark();
  }
  bark('done', energy);
  setTimeout(() => window.woofy.quit(), 850);
}

if (menuEl) {
  menuEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (window.woofy) {
      if (action === 'walk-to') window.woofy.walkToStart();
      else if (action === 'quit') goodbyeAndQuit();
      else window.woofy.action(action);
    }
    hideMenu();
  });
}
window.addEventListener('mousedown', (e) => {
  if (menuEl && !menuEl.contains(e.target) && menuEl.classList.contains('show')) hideMenu();
}, true);

const MOOD_EMOJI = {
  content:  '🐾',
  playful:  '✨',
  hungry:   '🦴',
  tired:    '💤',
  lonely:   '🥀',
  wary:     '🤨'
};

// Latest companion state — updated by onState. Lets bubble/sound code read mood/energy
// without main.js having to thread them through every event payload.
let latestState = null;

function renderHud(s) {
  if (!hudEl || !s) return;
  const emoji = MOOD_EMOJI[s.mood] || '🐾';
  const fullness = Math.round(100 - (s.hunger || 0));
  hudEl.textContent = `${emoji}  ${s.name || 'Mochi'}   ♥${Math.round(s.happiness || 0)}  🍗${fullness}  ⚡${Math.round(s.energy || 0)}  🤝${Math.round(s.bond || 0)}`;
}

let bubbleHideTimer = null;
function decorateWithMood(text) {
  if (!text) return text;
  const mood = latestState && latestState.mood;
  if (!mood || mood === 'content') return text;
  const emoji = MOOD_EMOJI[mood];
  if (!emoji) return text;
  // Skip if the bubble already starts with an emoji-ish glyph (avoid double emoji).
  if (/^[^\w\s]/.test(text)) return text;
  if (Math.random() < 0.18) return emoji + ' ' + text;
  return text;
}

function showBubble(text) {
  if (!bubbleEl) return;
  bubbleEl.textContent = decorateWithMood(text);
  bubbleEl.classList.add('show');
  if (bubbleHideTimer) clearTimeout(bubbleHideTimer);
  bubbleHideTimer = setTimeout(() => bubbleEl.classList.remove('show'), 2400);
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(1.2, 0.9, 1.8);
camera.lookAt(0, 0.25, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  premultipliedAlpha: false,
  powerPreference: 'high-performance'
});
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// ACES Filmic + neutral exposure gives PBR materials cinematic falloff and prevents the
// clipped, plastic look you get with no tone mapping at all.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// Image-based lighting via a tiny baked room env. Without this, MeshStandardMaterial
// reads as flat plastic — even with strong direct lights. PMREMGenerator compiles the
// RoomEnvironment scene into a prefiltered cubemap for IBL.
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envScene = new RoomEnvironment(renderer);
const envTex = pmrem.fromScene(envScene, 0.04).texture;
// scene.environment lights all MeshStandardMaterials in the scene; scene.background
// stays unset so the window keeps its transparency.

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// Apply IBL — must come after `scene` is created.
scene.environment = envTex;

// With env-map fill, direct lights stop having to do all the work — drop ambient and let
// the env handle ambient + diffuse fill. Key + rim still shape highlights.
scene.add(new THREE.AmbientLight(0xffffff, 0.18));
const dir = new THREE.DirectionalLight(0xffffff, 1.35);
dir.position.set(2, 4, 2);
scene.add(dir);
const rim = new THREE.DirectionalLight(0xffe0aa, 0.55);
rim.position.set(-2, 1.2, -2);
scene.add(rim);
// Subtle hemisphere bounce — sky/ground tint pulls warmth into the underside.
const hemi = new THREE.HemisphereLight(0xfff0e0, 0x402a18, 0.25);
scene.add(hemi);

// Soft ground shadow disc.
const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.55, 24),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.005;
scene.add(shadow);

const puppyRoot = new THREE.Group();
scene.add(puppyRoot);
let puppyCtrl = null;

async function setup() {
  const candidates = [
    'woofy://assets/AnimatedDog_FBX/Shiba_puppy_IP.fbx',
    'woofy://assets/dog.glb',
    'woofy://assets/dog.gltf',
    'woofy://assets/puppy.glb'
  ];
  for (const modelUrl of candidates) {
    try {
      const { root, puppy, clipNames } = await loadPuppy(
        modelUrl,
        'woofy://assets/dog.config.json'
      );
      puppyRoot.add(root);
      puppyCtrl = puppy;
      // Apply any state that arrived before the model finished loading.
      if (latestState && puppyCtrl.setMood) puppyCtrl.setMood(latestState.mood);
      if (window.woofy && window.woofy.sendClips) window.woofy.sendClips(clipNames);
      console.log(
        '[woofy] loaded ' + modelUrl.split('/').pop() +
        ' — ' + clipNames.length + ' clips: ' + clipNames.join(', ')
      );
      return;
    } catch (err) {
      console.warn('[woofy] could not load ' + modelUrl + ' — ' + err.message);
    }
  }
  console.warn('[woofy] no dog.glb in electron/assets — showing placeholder.');
  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.3, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x8b6a3e })
  );
  placeholder.position.y = 0.15;
  puppyRoot.add(placeholder);
}

if (window.woofy) {
  window.woofy.onNotify((data) => {
    const { kind, message, direction } = data || {};
    console.log('[woofy] notify kind=' + kind + ' msg=' + (message || '(none)'));
    const energy = latestState && latestState.energy;
    if (puppyCtrl) {
      switch (kind) {
        case 'hi':          puppyCtrl.greet(); break;
        case 'done':        puppyCtrl.bark(); bark('done', energy); break;
        case 'alert':       puppyCtrl.alert(); bark('alert', energy); break;
        case 'prompt':      puppyCtrl.playActive(); break;
        case 'tool':        puppyCtrl.playActive(); break;
        case 'bored':       puppyCtrl.setMode('bored'); break;
        case 'dormant':     puppyCtrl.setMode('dormant'); break;
        case 'idle':        puppyCtrl.setMode('idle'); break;
        case 'overwhelmed': puppyCtrl.overwhelmed(); bark('alert', energy); break;
        case 'walk-start':  puppyCtrl.walk(direction ?? 1); break;
        case 'walk-stop':   puppyCtrl.stopWalk(); break;
        case 'pet':         puppyCtrl.greet(); break;
        case 'feed':        puppyCtrl.eat(); break;
        case 'play':        puppyCtrl.playActive(); puppyCtrl.bark(); bark('done', energy); break;
        case 'rest':        puppyCtrl.setMode('dormant'); break;
        case 'test':        puppyCtrl.bark(); bark('done', energy); break;
        default: break;
      }
    }
    if (message) showBubble(message);
  });
  window.woofy.onPlayClip((name) => {
    if (!puppyCtrl || !puppyCtrl.playClip) return;
    const played = puppyCtrl.playClip(name);
    if (played) showBubble(played);
  });
  window.woofy.onState((s) => {
    latestState = s;
    if (puppyCtrl && puppyCtrl.setMood) puppyCtrl.setMood(s.mood);
    console.log('[woofy] state ' + s.name + ' mood=' + s.mood + ' h=' + Math.round(s.happiness) + ' f=' + Math.round(100 - s.hunger) + ' e=' + Math.round(s.energy) + ' b=' + Math.round(s.bond));
    renderHud(s);
  });
}

let last = performance.now();
function tick(now) {
  const dt = now - last;
  last = now;
  if (puppyCtrl) puppyCtrl.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

setup().finally(() => requestAnimationFrame(tick));
