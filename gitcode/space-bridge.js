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

// UFO animation
let ufoAnim = null;
let ufoTexNormal = null;
let ufoTexLaser = null;
let ufoGlowTex = null;

function makeGlowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(100,220,255,1)');
  g.addColorStop(0.3, 'rgba(0,160,255,0.6)');
  g.addColorStop(1, 'rgba(0,40,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

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
      const tl = new THREE.TextureLoader();
      ufoTexNormal = tl.load('WIthoutLaser.png');
      ufoTexLaser = tl.load('WithLaser.png');
      ufoGlowTex = makeGlowTex();
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
  updateUfoAnimation(dt);
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

  viewMode = 'surface';
  const btn = $('btnSpaceOrbit');
  if (btn) btn.textContent = 'ORBIT VIEW';
  mode = 'watching';

  if (p && !p.exploded && ufoTexNormal) {
    const center = planetWorldPos(p);
    const r = p.data.radius;
    const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const hoverOffset = new THREE.Vector3().addScaledVector(camRight, -r * 3).addScaledVector(camUp, r * 2.5);
    const startPos = center.clone().addScaledVector(camRight, -r * 6).addScaledVector(camUp, r * 4);
    const hoverPos = center.clone().add(hoverOffset);
    const endPos = center.clone().addScaledVector(camRight, r * 6).addScaledVector(camUp, r * 3);

    const mat = new THREE.SpriteMaterial({ map: ufoTexNormal, transparent: true, depthWrite: false, opacity: 0 });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(startPos);
    sprite.scale.set(r * 1.5, r * 2.0, 1);
    scene.add(sprite);

    ufoAnim = {
      phase: 'fly_in', time: 0,
      sprite, startPos, hoverPos, hoverOffset, endPos,
      center: center.clone(), r, planet: p,
      laserLine: null, laserGlow: null, impactGlow: null,
      origSurfDist: surfDist, origPitch: targetPitch,
      onExplode: () => {
        const hit = new THREE.Vector3();
        p.mesh.getWorldPosition(hit);
        explosions.detonate(hit, r, p.data.col, p.mesh.material);
        flashScreen();
        p.mesh.visible = false;
        if (p.clouds) p.clouds.visible = false;
        p.orbitLine.visible = false;
        p.moonMeshes.forEach(m => m.mesh.visible = false);
        p.exploded = true;
        if (!state.explodedPlanets.includes(fromIndex)) state.explodedPlanets.push(fromIndex);
        state.currentStep = toStep;
        saveState(state);
      },
      onComplete: () => {
        mode = 'travel';
        travel = { t: 0, dur: 3.0, fromPos: camera.position.clone(), fromTarget: center.clone(), toIndex };
      },
    };
  } else if (p && !p.exploded) {
    const center = planetWorldPos(p);
    explosions.detonate(center, p.data.radius, p.data.col, p.mesh.material);
    flashScreen();
    p.mesh.visible = false;
    if (p.clouds) p.clouds.visible = false;
    p.orbitLine.visible = false;
    p.moonMeshes.forEach(m => m.mesh.visible = false);
    p.exploded = true;
    if (!state.explodedPlanets.includes(fromIndex)) state.explodedPlanets.push(fromIndex);
    state.currentStep = toStep;
    saveState(state);
    const fromTarget = planetWorldPos(p);
    setTimeout(() => {
      if (mode !== 'watching') return;
      mode = 'travel';
      travel = { t: 0, dur: 3.0, fromPos: camera.position.clone(), fromTarget, toIndex };
    }, 4000);
  } else {
    state.currentStep = toStep;
    saveState(state);
    const fromTarget = p ? planetWorldPos(p) : camera.position.clone();
    setTimeout(() => {
      if (mode !== 'watching') return;
      mode = 'travel';
      travel = { t: 0, dur: 3.0, fromPos: camera.position.clone(), fromTarget, toIndex };
    }, 1000);
  }

  buildDots();
}

function processAdvanceQueue() {
  if (advanceQueue.length === 0) return;
  const nextStep = advanceQueue.shift();
  detonateAndTravel(nextStep);
}

// ---- UFO animation ----
function updateUfoAnimation(dt) {
  if (!ufoAnim) return;
  const a = ufoAnim;
  a.time += dt;
  const ease = k => k < 0.5 ? 2*k*k : 1 - Math.pow(-2*k+2,2)/2;

  // Track planet's live position
  if (a.planet && a.planet.mesh.visible) {
    a.planet.mesh.getWorldPosition(a.center);
    a.hoverPos.copy(a.center).add(a.hoverOffset);
  }

  if (a.phase === 'fly_in') {
    const k = Math.min(a.time / 2.0, 1);
    a.sprite.position.lerpVectors(a.startPos, a.hoverPos, ease(k));
    a.sprite.material.opacity = Math.min(1, a.time / 0.5);
    surfDist = lerp(a.origSurfDist, 5.0, ease(k));
    targetPitch = lerp(a.origPitch, 0.35, ease(k));
    if (k >= 1) {
      a.phase = 'laser'; a.time = 0;
      createBeam(a);
    }
  }
  else if (a.phase === 'laser') {
    const k = Math.min(a.time / 1.5, 1);
    // Keep UFO at hover, tracking planet
    a.sprite.position.copy(a.hoverPos);
    // Update beam to track planet
    updateBeam(a);
    surfDist = 5.0;
    targetPitch = 0.35;
    if (k >= 1) {
      a.phase = 'explode'; a.time = 0;
      removeBeam(a);
      a.onExplode();
    }
  }
  else if (a.phase === 'explode') {
    surfDist = 5.0;
    if (a.time >= 1.0) { a.phase = 'fly_out'; a.time = 0; }
  }
  else if (a.phase === 'fly_out') {
    const k = Math.min(a.time / 2.0, 1);
    a.sprite.position.lerpVectors(a.hoverPos, a.endPos, ease(k));
    if (k > 0.4) a.sprite.material.opacity = Math.max(0, 1 - (k - 0.4) / 0.6);
    surfDist = lerp(5.0, a.origSurfDist, ease(k));
    targetPitch = lerp(0.35, a.origPitch, ease(k));
    if (k >= 1) {
      surfDist = a.origSurfDist;
      targetPitch = a.origPitch;
      scene.remove(a.sprite); a.sprite.material.dispose();
      const cb = a.onComplete;
      ufoAnim = null;
      cb();
    }
  }
}

function createBeam(a) {
  const from = a.hoverPos;
  const to = a.center;
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const dirN = dir.clone().normalize();
  const yAxis = new THREE.Vector3(0, 1, 0);

  const geo = new THREE.CylinderGeometry(a.r * 0.05, a.r * 0.08, len, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(yAxis, dirN);
  scene.add(mesh);
  a.laserLine = mesh;

  const gGeo = new THREE.CylinderGeometry(a.r * 0.15, a.r * 0.2, len, 6);
  const gMat = new THREE.MeshBasicMaterial({ color: 0x0066ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const gMesh = new THREE.Mesh(gGeo, gMat);
  gMesh.position.copy(mid);
  gMesh.quaternion.copy(mesh.quaternion);
  scene.add(gMesh);
  a.laserGlow = gMesh;

  if (ufoGlowTex) {
    const iMat = new THREE.SpriteMaterial({ map: ufoGlowTex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const iSpr = new THREE.Sprite(iMat);
    iSpr.position.copy(to);
    iSpr.scale.setScalar(a.r * 1.5);
    scene.add(iSpr);
    a.impactGlow = iSpr;
  }
}

function updateBeam(a) {
  const from = a.hoverPos;
  const to = a.center;
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const dirN = dir.clone().normalize();
  const yAxis = new THREE.Vector3(0, 1, 0);

  if (a.laserLine) {
    a.laserLine.position.copy(mid);
    a.laserLine.quaternion.setFromUnitVectors(yAxis, dirN);
    a.laserLine.scale.y = len / (a.laserLine.geometry.parameters.height || 1);
    a.laserLine.material.opacity = 0.6 + Math.sin(a.time * 25) * 0.3;
  }
  if (a.laserGlow) {
    a.laserGlow.position.copy(mid);
    a.laserGlow.quaternion.setFromUnitVectors(yAxis, dirN);
    a.laserGlow.scale.y = len / (a.laserGlow.geometry.parameters.height || 1);
    a.laserGlow.material.opacity = 0.2 + Math.sin(a.time * 20) * 0.1;
  }
  if (a.impactGlow) {
    a.impactGlow.position.copy(to);
    a.impactGlow.material.opacity = 0.7 + Math.sin(a.time * 18) * 0.25;
    a.impactGlow.scale.setScalar(a.r * (1.5 + Math.sin(a.time * 15) * 0.4));
  }
}

function removeBeam(a) {
  if (a.laserLine) { scene.remove(a.laserLine); a.laserLine.geometry.dispose(); a.laserLine.material.dispose(); a.laserLine = null; }
  if (a.laserGlow) { scene.remove(a.laserGlow); a.laserGlow.geometry.dispose(); a.laserGlow.material.dispose(); a.laserGlow = null; }
  if (a.impactGlow) { scene.remove(a.impactGlow); a.impactGlow.material.dispose(); a.impactGlow = null; }
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
