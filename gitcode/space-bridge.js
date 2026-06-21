// space-bridge.js — embeds the spaceprogress Three.js solar system
// into the FocusOS drawer panel, wired to the gamification system.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

import { PLANET_DATA, TEX, QUALITY } from '../spaceprogress/data.js';
import { loadBatch }                  from '../spaceprogress/loaders.js';
import { buildStarfield, buildSun, buildPlanets, buildBelt, updateBelt, buildComets, updateComets } from '../spaceprogress/bodies.js';
import { ExplosionSystem }            from '../spaceprogress/explosion.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;

// Custom progression: Earth → Mars → Venus → Mercury → Jupiter → Saturn → Uranus → Neptune
const PROGRESSION = [2, 3, 1, 0, 4, 5, 6, 7];

const SPACE_KEY = 'focusos_space_progress';
function loadState() {
  try {
    const raw = localStorage.getItem(SPACE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { currentStep: 0, explodedPlanets: [] };
}
function saveState(s) { localStorage.setItem(SPACE_KEY, JSON.stringify(s)); }

// ---- Bridge singleton ----
let initialized = false;
let animating = false;

let renderer, scene, camera, composer, bloomPass, sunLight;
let planets = [], sunObj = null, belt = null, kuiper = null, comets = [];
let explosions;
let loaded = {};
const q = QUALITY.balanced;

// camera state
let mode = 'surface';
let currentIndex = PROGRESSION[0];
let travel = null;

let yaw = 0, pitch = 0.12, surfDist = 1.4;
let targetYaw = 0, targetPitch = 0.12;
let orbitYaw = 0.6, orbitPitch = 0.55, orbitDist = 1200;
let tOrbitYaw = 0.6, tOrbitPitch = 0.55, tOrbitDist = 1200;
// 'surface' | 'orbit' | 'galaxy'
let viewMode = 'surface';

let last = 0;
let container = null;
let advanceQueue = [];

// ---- Init ----
function init() {
  if (initialized) return;
  initialized = true;

  container = $('space-viewport');
  const canvas = $('space-scene');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatioCap));
  resizeRenderer();

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.05, 400000);

  sunLight = new THREE.PointLight(0xfff4e0, 4.2, 0, 1.5);
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x4a4658, 1.7));
  const fillLight = new THREE.PointLight(0xbcd2ff, 1.4, 0, 1.2);
  fillLight.position.set(-400, 250, -300);
  scene.add(fillLight);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    q.bloomStrength, q.bloomRadius, q.bloomThreshold
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  explosions = new ExplosionSystem(scene, q);

  const ro = new ResizeObserver(resizeRenderer);
  ro.observe(container);

  setupInput();
  loadTextures();
}

function resizeRenderer() {
  if (!container || !renderer) return;
  const w = container.clientWidth, h = container.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h);
  if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  if (composer) composer.setSize(w, h);
}

function loadTextures() {
  const entries = Object.entries(TEX).map(([key, url]) => ({ key, url }));
  loadBatch(entries, renderer, () => {})
    .then(tex => {
      loaded = tex;
      buildWorld();
      restoreState();
      updateLabel();
      buildDots();
    });
}

function buildWorld() {
  buildStarfield(scene, loaded, q);
  sunObj = buildSun(scene, loaded, q, sunLight);
  planets = buildPlanets(scene, loaded, q);
  belt   = buildBelt(scene, q.asteroids, 300, 350, 0.4, 2.2, 0x8a7c6a, 6);
  kuiper = buildBelt(scene, q.kuiper, 820, 1050, 0.4, 1.8, 0x6f7d96, 22);
  comets = buildComets(scene, q.comets);
}

function restoreState() {
  const state = loadState();
  const step = Math.min(state.currentStep, PROGRESSION.length - 1);
  currentIndex = PROGRESSION[step];

  state.explodedPlanets.forEach(idx => {
    const p = planets[idx];
    if (p) {
      p.mesh.visible = false;
      if (p.clouds) p.clouds.visible = false;
      p.orbitLine.visible = false;
      p.moonMeshes.forEach(m => m.mesh.visible = false);
      p.exploded = true;
    }
  });
}

// ---- Input (scoped to drawer) ----
function setupInput() {
  let dragging = false, lastX = 0, lastY = 0;

  container.addEventListener('pointerdown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    e.stopPropagation();
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', e => {
    if (!dragging || !animating) return;
    const dx = (e.clientX - lastX) * 0.005, dy = (e.clientY - lastY) * 0.005;
    lastX = e.clientX; lastY = e.clientY;
    if (viewMode === 'orbit' || viewMode === 'galaxy') { tOrbitYaw -= dx; tOrbitPitch = clamp(tOrbitPitch - dy, -1.4, 1.4); }
    else { targetYaw -= dx; targetPitch = clamp(targetPitch - dy, -1.2, 1.3); }
  });
  container.addEventListener('wheel', e => {
    e.preventDefault(); e.stopPropagation();
    if (viewMode === 'galaxy') tOrbitDist = clamp(tOrbitDist + e.deltaY * 3, 2000, 60000);
    else if (viewMode === 'orbit') tOrbitDist = clamp(tOrbitDist + e.deltaY * 0.8, 200, 6000);
    else surfDist = clamp(surfDist + e.deltaY * 0.0025, 0.5, 8);
  }, { passive: false });
}

// ---- Camera ----
const _wp = new THREE.Vector3();
function planetWorldPos(p) { p.mesh.getWorldPosition(_wp); return _wp.clone(); }

function surfaceCamPos(p, yawA, pitchA, distMul) {
  const pc = planetWorldPos(p), r = p.data.radius, standoff = r * (1.7 + distMul);
  const sunwardYaw = Math.atan2(-pc.z, -pc.x);
  const y = yawA + sunwardYaw;
  return new THREE.Vector3(
    pc.x + Math.cos(pitchA) * Math.cos(y) * standoff,
    pc.y + Math.sin(pitchA) * standoff,
    pc.z + Math.cos(pitchA) * Math.sin(y) * standoff
  );
}

const _t = new THREE.Vector3();
function updateCamera(dt) {
  if (mode === 'travel' && travel) {
    travel.t += dt;
    let k = travel.t / travel.dur;
    if (k >= 1) {
      currentIndex = travel.toIndex;
      mode = 'surface';
      travel = null;
      targetYaw = yaw = 0;
      targetPitch = pitch = 0.12;
      updateLabel();
      buildDots();
      processAdvanceQueue();
      return;
    }
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const target = planets[travel.toIndex], tp = planetWorldPos(target);
    camera.position.lerpVectors(travel.fromPos, surfaceCamPos(target, 0, 0.2, 1.6), e);
    _t.lerpVectors(travel.fromTarget, tp, e);
    camera.lookAt(_t);
    return;
  }
  if (viewMode === 'orbit' || viewMode === 'galaxy') {
    orbitYaw = lerp(orbitYaw, tOrbitYaw, 0.1);
    orbitPitch = lerp(orbitPitch, tOrbitPitch, 0.1);
    orbitDist = lerp(orbitDist, tOrbitDist, 0.1);
    camera.position.set(
      Math.cos(orbitPitch) * Math.cos(orbitYaw) * orbitDist,
      Math.sin(orbitPitch) * orbitDist,
      Math.cos(orbitPitch) * Math.sin(orbitYaw) * orbitDist
    );
    camera.lookAt(0, 0, 0);
    return;
  }
  const p = planets[currentIndex];
  if (!p) return;
  yaw = lerp(yaw, targetYaw, 0.12);
  pitch = lerp(pitch, targetPitch, 0.12);
  camera.position.copy(surfaceCamPos(p, yaw, pitch, surfDist));
  camera.lookAt(planetWorldPos(p));
}

// ---- Render loop ----
function start() {
  if (animating) return;
  animating = true;
  last = performance.now();
  requestAnimationFrame(loop);
}
function stop() { animating = false; }

function loop(now) {
  if (!animating) return;
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  planets.forEach(p => {
    if (!p.exploded) {
      p.pivot.rotation.y += p.data.orbit * dt * 12;
      p.mesh.rotation.y += p.data.spin;
      if (p.clouds) p.clouds.rotation.y += p.data.spin * 0.4;
      p.moonMeshes.forEach(m => {
        m.ang += m.speed * dt * 8;
        const hp = new THREE.Vector3();
        m.host.getWorldPosition(hp);
        m.mesh.position.set(hp.x + Math.cos(m.ang) * m.dist, hp.y, hp.z + Math.sin(m.ang) * m.dist);
      });
    }
  });

  if (sunObj) {
    sunObj.mat.uniforms.uTime.value = now * 0.001;
    sunObj.coronaMats.forEach(m => m.uniforms.uTime.value = now * 0.001);
    sunObj.group.rotation.y += 0.0008;
  }

  if (belt) updateBelt(belt, dt);
  if (kuiper) updateBelt(kuiper, dt);
  if (comets.length) updateComets(comets, dt);
  explosions.update(dt);
  updateCamera(dt);
  composer.render();

  requestAnimationFrame(loop);
}

// ---- Detonate & advance ----
function flashScreen() {
  const el = $('space-flash');
  if (!el) return;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 240);
}

function detonateAndTravel(toStep) {
  if (mode === 'travel' || mode === 'watching') {
    advanceQueue.push(toStep);
    return;
  }

  const state = loadState();
  const fromIndex = currentIndex;
  const toIndex = PROGRESSION[toStep];
  const p = planets[fromIndex];

  if (p && !p.exploded) {
    const center = planetWorldPos(p);
    explosions.detonate(center, p.data.radius, p.data.col, p.mesh.material);
    flashScreen();
    p.mesh.visible = false;
    if (p.clouds) p.clouds.visible = false;
    p.orbitLine.visible = false;
    p.moonMeshes.forEach(m => m.mesh.visible = false);
    p.exploded = true;

    if (!state.explodedPlanets.includes(fromIndex)) {
      state.explodedPlanets.push(fromIndex);
    }
  }

  state.currentStep = toStep;
  saveState(state);

  viewMode = 'surface';
  const btn = $('btnSpaceOrbit');
  if (btn) btn.textContent = 'ORBIT VIEW';
  mode = 'watching';
  const fromTarget = p ? planetWorldPos(p) : camera.position.clone();

  setTimeout(() => {
    if (mode !== 'watching') return;
    mode = 'travel';
    travel = {
      t: 0, dur: 3.0,
      fromPos: camera.position.clone(),
      fromTarget,
      toIndex,
    };
  }, 4000);

  buildDots();
}

function processAdvanceQueue() {
  if (advanceQueue.length === 0) return;
  const nextStep = advanceQueue.shift();
  detonateAndTravel(nextStep);
}

function advanceTo(step) {
  if (!initialized) init();
  if (planets.length === 0) return;
  detonateAndTravel(step);
}

// ---- HUD ----
function updateLabel() {
  const el = $('space-planet-label');
  if (!el || !planets[currentIndex]) return;
  el.textContent = planets[currentIndex].data.name;
}

function buildDots() {
  const el = $('space-dots');
  if (!el) return;
  el.innerHTML = '';
  const state = loadState();
  PROGRESSION.forEach((pIdx, step) => {
    const dot = document.createElement('div');
    dot.className = 'space-dot';
    dot.style.borderColor = planets[pIdx] ? planets[pIdx].data.col : '';
    if (planets[pIdx] && planets[pIdx].exploded) dot.classList.add('gone');
    else if (pIdx === currentIndex) {
      dot.classList.add('active');
      dot.style.background = planets[pIdx].data.col;
      dot.style.borderColor = planets[pIdx].data.col;
    }
    el.appendChild(dot);
  });
}

// ---- View mode cycling: surface → orbit → galaxy → surface ----
function cycleView() {
  if (mode === 'travel' || mode === 'watching') return;
  const btn = $('btnSpaceOrbit');
  if (viewMode === 'surface') {
    viewMode = 'orbit';
    tOrbitDist = 1200;
    if (btn) btn.textContent = 'GALAXY VIEW';
  } else if (viewMode === 'orbit') {
    viewMode = 'galaxy';
    tOrbitDist = 12000;
    tOrbitPitch = 1.2;
    if (btn) btn.textContent = 'LAND ON PLANET';
  } else {
    viewMode = 'surface';
    targetYaw = yaw = 0;
    targetPitch = pitch = 0.12;
    surfDist = 1.4;
    if (btn) btn.textContent = 'ORBIT VIEW';
  }
}

// ---- Drawer toggle ----
const drawer = $('space-drawer');
const toggleBtn = $('space-drawer-toggle');

function openDrawer() {
  if (!initialized) init();
  drawer.classList.add('open');
  setTimeout(() => {
    resizeRenderer();
    start();
  }, 50);
}

function closeDrawer() {
  drawer.classList.remove('open');
  stop();
}

function isDrawerOpen() {
  return drawer.classList.contains('open');
}

if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    if (isDrawerOpen()) closeDrawer();
    else openDrawer();
  });
}

const btnClose = $('btnSpaceClose');
if (btnClose) btnClose.addEventListener('click', closeDrawer);

const btnOrbit = $('btnSpaceOrbit');
if (btnOrbit) btnOrbit.addEventListener('click', cycleView);

// ---- Listen for shop planet purchases ----
window.addEventListener('focusos:planet-purchased', (e) => {
  const step = e.detail.step;
  if (!isDrawerOpen()) openDrawer();
  setTimeout(() => advanceTo(step), 600);
});

// Debug: give free points and trigger progression
function debugGivePoints(amount) {
  const raw = localStorage.getItem('focusos_player');
  const player = raw ? JSON.parse(raw) : {};
  player.points = (player.points || 0) + amount;
  player.totalPointsEarned = (player.totalPointsEarned || 0) + amount;
  localStorage.setItem('focusos_player', JSON.stringify(player));
  if (typeof updatePlayerHUD === 'function') updatePlayerHUD();
  checkProgression();
  if (!isDrawerOpen()) openDrawer();
}

function debugReset() {
  localStorage.removeItem('focusos_player');
  localStorage.removeItem(SPACE_KEY);
  location.reload();
}

// Expose for external use
window.spaceBridge = { init, start, stop, openDrawer, closeDrawer, advanceTo, debugGivePoints, debugReset };
