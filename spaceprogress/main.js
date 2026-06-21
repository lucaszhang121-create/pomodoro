// =====================================================================
// main.js — orchestrates everything: renderer, bloom, camera modes,
// loading, quality switching, detonation flow, render loop.
// =====================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { PLANET_DATA, TEX, TEX_HI, QUALITY } from './data.js';
import { loadBatch, upgradeTexture } from './loaders.js';
import { buildStarfield, buildSun, buildPlanets, buildBelt, updateBelt, buildComets, updateComets } from './bodies.js';
import { ExplosionSystem } from './explosion.js';

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const lerp = (a,b,t) => a + (b-a)*t;
const rand = (a,b) => Math.random()*(b-a)+a;

// ---------- Renderer ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
// Tone mapping + color-space conversion are handled by OutputPass at the end
// of the bloom chain, so we leave the renderer in its default linear state.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 0.05, 400000);

const sunLight = new THREE.PointLight(0xfff4e0, 4.2, 0, 1.5);
scene.add(sunLight);
// Generous fill lighting: we want the WHOLE planet to read clearly —
// bright on the sun-facing side, still clearly visible (not black) on the
// far side — rather than a harsh, realistic day/night terminator.
scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x4a4658, 1.7));
// A second soft light from roughly "behind" the camera's default orbit
// fakes a little bounce/fill so no face of any planet goes flat dark.
const fillLight = new THREE.PointLight(0xbcd2ff, 1.4, 0, 1.2);
fillLight.position.set(-400, 250, -300);
scene.add(fillLight);

// ---------- Quality ----------
let q = QUALITY.ultra;
function applyPixelRatio() { renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatioCap)); }
applyPixelRatio();

// ---------- Post-processing (bloom) ----------
let composer, renderPass, bloomPass, outputPass;
function buildComposer() {
  composer = new EffectComposer(renderer);
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), q.bloomStrength, q.bloomRadius, q.bloomThreshold);
  composer.addPass(bloomPass);
  outputPass = new OutputPass();
  composer.addPass(outputPass);
}
buildComposer();

// ---------- State ----------
let planets = [], sunObj = null, belt = null, kuiper = null, comets = [];
let explosions = new ExplosionSystem(scene, q);
let loaded = {};
let sceneBuilt = false;
let mode = 'surface';       // surface | watching | travel | orbit
let currentIndex = 2;       // start on Earth
let orbitView = false;
let travel = null;

// camera params
let yaw = 0, pitch = 0.12, surfDist = 1.4, targetYaw = 0, targetPitch = 0.12;
let orbitYaw = 0.6, orbitPitch = 0.55, orbitDist = 1200, tOrbitYaw = 0.6, tOrbitPitch = 0.55, tOrbitDist = 1200;

// ---------- Load flow ----------
const baseEntries = Object.entries(TEX).map(([key, url]) => ({ key, url }));
$('loadStatus').textContent = 'Fetching NASA surface imagery…';
loadBatch(baseEntries, renderer, (frac) => { $('loadFill').style.width = Math.round(frac*100)+'%'; })
  .then((tex) => { loaded = tex; onLoaded(); });

// global safety net
setTimeout(() => { if (!sceneBuilt) onLoaded(); }, 16000);

function onLoaded() {
  if (sceneBuilt) return; sceneBuilt = true;
  const anyFallback = Object.values(loaded).some(t => t && t._fallback);
  $('loadStatus').textContent = anyFallback ? 'Some imagery blocked — fallback in use' : 'Surface imagery ready';
  buildWorld();
  buildDots(); updateInfo();
  setTimeout(() => { $('loader').classList.add('hide'); $('hud').classList.add('show'); }, 500);
  requestAnimationFrame(loop);
  setTimeout(upgradeHiRes, 1200);
}

function buildWorld() {
  buildStarfield(scene, loaded, q);
  sunObj = buildSun(scene, loaded, q, sunLight);
  planets = buildPlanets(scene, loaded, q);
  // asteroid belt (Mars↔Jupiter) and kuiper belt (beyond Neptune)
  belt   = buildBelt(scene, q.asteroids, 300, 350, 0.4, 2.2, 0x8a7c6a, 6);
  kuiper = buildBelt(scene, q.kuiper, 820, 1050, 0.4, 1.8, 0x6f7d96, 22);
  comets = buildComets(scene, q.comets);
}

function upgradeHiRes() {
  if (!q.hiRes) return;
  Object.entries(TEX_HI).forEach(([key, url]) => {
    upgradeTexture(url, renderer, (t) => {
      // map hero textures onto the right planet / cloud / moon
      if (key === 'clouds') {
        const earth = planets.find(p => p.data.tex === 'earth');
        if (earth && earth.clouds) { earth.clouds.material.map = t; earth.clouds.material.alphaMap = t; earth.clouds.material.needsUpdate = true; }
        return;
      }
      if (key === 'earthNight') {
        const earth = planets.find(p => p.data.tex === 'earth');
        if (earth) { earth.mesh.material.emissiveMap = t; earth.mesh.material.needsUpdate = true; }
        return;
      }
      if (key === 'moon') {
        planets.forEach(p => p.moonMeshes.forEach(m => { m.mesh.material.map = t; m.mesh.material.needsUpdate = true; }));
        return;
      }
      const planet = planets.find(p => p.data.tex === key);
      if (planet) {
        planet.mesh.material.map = t;
        if (planet.data.rocky) planet.mesh.material.bumpMap = t;
        planet.mesh.material.needsUpdate = true;
      }
    });
  });
}

// ---------- Quality switching (live) ----------
function setQuality(name) {
  q = QUALITY[name];
  explosions.setQuality(q);
  applyPixelRatio();
  bloomPass.strength = q.bloomStrength;
  bloomPass.radius = q.bloomRadius;
  bloomPass.threshold = q.bloomThreshold;
  // rebuild belts/comets/stars at new density (cheap enough; clears old)
  if (sceneBuilt) {
    if (belt) { scene.remove(belt.mesh); belt.mesh.geometry.dispose(); }
    if (kuiper) { scene.remove(kuiper.mesh); kuiper.mesh.geometry.dispose(); }
    comets.forEach(c => scene.remove(c.group));
    belt   = buildBelt(scene, q.asteroids, 300, 350, 0.4, 2.2, 0x8a7c6a, 6);
    kuiper = buildBelt(scene, q.kuiper, 820, 1050, 0.4, 1.8, 0x6f7d96, 22);
    comets = buildComets(scene, q.comets);
  }
  $('qUltra').classList.toggle('active', name === 'ultra');
  $('qBalanced').classList.toggle('active', name === 'balanced');
}
$('qUltra').addEventListener('click', () => setQuality('ultra'));
$('qBalanced').addEventListener('click', () => setQuality('balanced'));

// ---------- Input ----------
let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
addEventListener('pointerup', () => dragging = false);
addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = (e.clientX-lastX)*0.005, dy = (e.clientY-lastY)*0.005;
  lastX = e.clientX; lastY = e.clientY;
  if (orbitView) { tOrbitYaw -= dx; tOrbitPitch = clamp(tOrbitPitch - dy, -1.4, 1.4); }
  else { targetYaw -= dx; targetPitch = clamp(targetPitch - dy, -1.2, 1.3); }
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (orbitView) tOrbitDist = clamp(tOrbitDist + e.deltaY*0.8, 200, 6000);
  else surfDist = clamp(surfDist + e.deltaY*0.0025, 0.5, 8);
}, { passive: false });

// ---------- Camera helpers ----------
const _wp = new THREE.Vector3();
function planetWorldPos(p) { p.mesh.getWorldPosition(_wp); return _wp.clone(); }
function surfaceCamPos(p, yawA, pitchA, distMul) {
  const pc = planetWorldPos(p), r = p.data.radius, standoff = r*(1.7+distMul);
  // Anchor yaw=0 to the direction facing the Sun (origin), so landing on a
  // planet — or arriving via travel — defaults to the sunlit hemisphere
  // instead of a random side. Player drag still rotates relative to this.
  const sunwardYaw = Math.atan2(-pc.z, -pc.x);
  const yaw = yawA + sunwardYaw;
  return new THREE.Vector3(
    pc.x + Math.cos(pitchA)*Math.cos(yaw)*standoff,
    pc.y + Math.sin(pitchA)*standoff,
    pc.z + Math.cos(pitchA)*Math.sin(yaw)*standoff
  );
}

// ---------- Detonate flow ----------
const btnExplode = $('btnExplode'), btnOrbit = $('btnOrbit');
function detonate() {
  if (mode === 'travel' || mode === 'watching') return;
  const p = planets[currentIndex]; if (!p || p.exploded) return;
  const center = planetWorldPos(p);
  explosions.detonate(center, p.data.radius, p.data.col, p.mesh.material);
  flashScreen();
  p.mesh.visible = false; if (p.clouds) p.clouds.visible = false; p.orbitLine.visible = false;
  p.moonMeshes.forEach(m => m.mesh.visible = false);
  p.exploded = true;
  btnExplode.disabled = true;

  let next = -1;
  for (let i = currentIndex+1; i < planets.length; i++) if (!planets[i].exploded) { next = i; break; }
  if (next === -1) for (let i = 0; i < planets.length; i++) if (!planets[i].exploded) { next = i; break; }
  if (next === -1) { setTimeout(showEnd, 4200); updateDots(); return; }

  orbitView = false; mode = 'watching';
  const fromTarget = center.clone();
  setTimeout(() => {
    if (mode !== 'watching') return;
    mode = 'travel';
    travel = { t: 0, dur: 3.0, fromPos: camera.position.clone(), fromTarget, toIndex: next };
  }, 4000);
  updateDots();
}
btnExplode.addEventListener('click', detonate);
btnOrbit.addEventListener('click', () => {
  if (mode === 'travel') return;
  orbitView = !orbitView;
  btnOrbit.textContent = orbitView ? '🪐 LAND ON PLANET' : '🛰 ORBIT VIEW';
});

const flashEl = $('flash');
function flashScreen() { flashEl.style.opacity = '1'; setTimeout(() => flashEl.style.opacity = '0', 240); }

// ---------- End ----------
const endcard = $('endcard');
function showEnd() { mode = 'orbit'; orbitView = true; tOrbitDist = 1800; endcard.classList.add('show'); }
$('btnRestart').addEventListener('click', () => location.reload());

// ---------- HUD ----------
function updateInfo() {
  const d = planets[currentIndex].data;
  $('planetName').textContent = d.name; $('planetSub').textContent = d.sub;
  $('dDia').textContent = d.dia; $('dMass').textContent = d.mass; $('dGrav').textContent = d.grav;
  $('dDay').textContent = d.day; $('dYear').textContent = d.year; $('dTilt').textContent = d.tiltTxt;
  $('dMoons').textContent = d.moons; $('dTemp').textContent = d.temp; $('dDist').textContent = d.distTxt;
}
const progressEl = $('progress');
function buildDots() {
  progressEl.innerHTML = '';
  planets.forEach(p => { const dot = document.createElement('div'); dot.className = 'dot'; dot.style.color = p.data.col; progressEl.appendChild(dot); });
  updateDots();
}
function updateDots() {
  [...progressEl.children].forEach((dot, i) => {
    dot.classList.remove('active', 'gone');
    if (planets[i].exploded) dot.classList.add('gone');
    else if (i === currentIndex) { dot.classList.add('active'); dot.style.color = planets[i].data.col; }
  });
}

// ---------- Resize ----------
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---------- Camera update ----------
const _t = new THREE.Vector3();
function updateCamera(dt) {
  if (mode === 'travel' && travel) {
    travel.t += dt; let k = travel.t/travel.dur;
    if (k >= 1) { currentIndex = travel.toIndex; mode = 'surface'; travel = null; btnExplode.disabled = false; updateInfo(); targetYaw = yaw; targetPitch = 0.12; return; }
    const e = k<0.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2;
    const target = planets[travel.toIndex], tp = planetWorldPos(target);
    camera.position.lerpVectors(travel.fromPos, surfaceCamPos(target, 0, 0.2, 1.6), e);
    _t.lerpVectors(travel.fromTarget, tp, e); camera.lookAt(_t); return;
  }
  if (orbitView) {
    orbitYaw = lerp(orbitYaw, tOrbitYaw, 0.1); orbitPitch = lerp(orbitPitch, tOrbitPitch, 0.1); orbitDist = lerp(orbitDist, tOrbitDist, 0.1);
    camera.position.set(
      Math.cos(orbitPitch)*Math.cos(orbitYaw)*orbitDist,
      Math.sin(orbitPitch)*orbitDist,
      Math.cos(orbitPitch)*Math.sin(orbitYaw)*orbitDist);
    camera.lookAt(0, 0, 0); return;
  }
  const p = planets[currentIndex]; if (!p) return;
  yaw = lerp(yaw, targetYaw, 0.12); pitch = lerp(pitch, targetPitch, 0.12);
  camera.position.copy(surfaceCamPos(p, yaw, pitch, surfDist));
  camera.lookAt(planetWorldPos(p));
}

// ---------- Loop ----------
let last = performance.now(), fpsT = 0, fpsN = 0;
function loop(now) {
  const dt = Math.min((now-last)/1000, 0.05); last = now;

  // animate planets / moons
  planets.forEach(p => {
    if (!p.exploded) {
      p.pivot.rotation.y += p.data.orbit * dt * 12;
      p.mesh.rotation.y += p.data.spin;
      if (p.clouds) p.clouds.rotation.y += p.data.spin * 0.4;
      p.moonMeshes.forEach(m => {
        m.ang += m.speed * dt * 8;
        const hp = new THREE.Vector3(); m.host.getWorldPosition(hp);
        m.mesh.position.set(hp.x + Math.cos(m.ang)*m.dist, hp.y, hp.z + Math.sin(m.ang)*m.dist);
      });
    }
  });

  // sun shader time + corona pulse
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

  // fps
  fpsT += dt; fpsN++;
  if (fpsT >= 0.5) { $('fps').textContent = Math.round(fpsN/fpsT) + ' fps'; fpsT = 0; fpsN = 0; }

  requestAnimationFrame(loop);
}
