import * as THREE from 'three';
import { loadPuppy } from './puppy.js';
import { bark, yawnSound } from './sound.js';

const canvas = document.getElementById('scene');
const bubbleEl = document.getElementById('bubble');
const hudEl = document.getElementById('hud');
const menuEl = document.getElementById('menu');

// Left-click anywhere in the window = pet.
canvas.addEventListener('click', (e) => {
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
if (menuEl) {
  menuEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (window.woofy) window.woofy.action(action);
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

function renderHud(s) {
  if (!hudEl || !s) return;
  const emoji = MOOD_EMOJI[s.mood] || '🐾';
  const fullness = Math.round(100 - (s.hunger || 0));
  hudEl.textContent = `${emoji}  ${s.name || 'Mochi'}   ♥${Math.round(s.happiness || 0)}  🍗${fullness}  ⚡${Math.round(s.energy || 0)}  🤝${Math.round(s.bond || 0)}`;
}

let bubbleHideTimer = null;
function showBubble(text) {
  if (!bubbleEl) return;
  bubbleEl.textContent = text;
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
  premultipliedAlpha: false
});
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(2, 4, 2);
scene.add(dir);
const rim = new THREE.DirectionalLight(0xffe0aa, 0.35);
rim.position.set(-2, 1, -2);
scene.add(rim);

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
    if (puppyCtrl) {
      switch (kind) {
        case 'hi':          puppyCtrl.greet(); break;
        case 'done':        puppyCtrl.bark(); bark('done'); break;
        case 'alert':       puppyCtrl.alert(); bark('alert'); break;
        case 'prompt':      puppyCtrl.playActive(); break;
        case 'tool':        puppyCtrl.playActive(); break;
        case 'bored':       puppyCtrl.setMode('bored'); break;
        case 'dormant':     puppyCtrl.setMode('dormant'); break;
        case 'idle':        puppyCtrl.setMode('idle'); break;
        case 'overwhelmed': puppyCtrl.overwhelmed(); bark('alert'); break;
        case 'walk-start':  puppyCtrl.walk(direction ?? 1); break;
        case 'walk-stop':   puppyCtrl.stopWalk(); break;
        case 'pet':         puppyCtrl.greet(); break;
        case 'feed':        puppyCtrl.eat(); break;
        case 'play':        puppyCtrl.playActive(); puppyCtrl.bark(); bark('done'); break;
        case 'rest':        puppyCtrl.setMode('dormant'); break;
        case 'test':        puppyCtrl.bark(); bark('done'); break;
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
