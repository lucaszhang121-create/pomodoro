// =====================================================================
// bodies.js — builds sun, planets, moons, rings, asteroid belt,
// kuiper belt, and comets. Quality-aware instancing.
// =====================================================================
import * as THREE from 'three';
import { PLANET_DATA } from './data.js';
import { makeAtmosphere, makeSunMaterial, makeCoronaMaterial } from './shaders.js';

const rand = (a, b) => Math.random() * (b - a) + a;

export function buildStarfield(scene, loaded, q) {
  // Milky-way photo sphere
  const geo = new THREE.SphereGeometry(120000, 64, 64);
  const mat = new THREE.MeshBasicMaterial({ map: loaded.stars, side: THREE.BackSide, toneMapped: false });
  scene.add(new THREE.Mesh(geo, mat));

  // Extra sparse point stars for depth/parallax
  const n = q.starCount;
  const pg = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = rand(8000, 60000);
    const th = rand(0, Math.PI * 2), ph = Math.acos(rand(-1, 1));
    pos[i*3] = r*Math.sin(ph)*Math.cos(th);
    pos[i*3+1] = r*Math.sin(ph)*Math.sin(th);
    pos[i*3+2] = r*Math.cos(ph);
  }
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ color: 0xcfe2ff, size: 26, sizeAttenuation: true, transparent: true, opacity: 0.85, toneMapped: false });
  scene.add(new THREE.Points(pg, pm));
}

export function buildSun(scene, loaded, q, sunLight) {
  const group = new THREE.Object3D(); scene.add(group);
  const geo = new THREE.SphereGeometry(34, q.sunSeg, q.sunSeg);
  const mat = makeSunMaterial(loaded.sun);
  const sun = new THREE.Mesh(geo, mat); group.add(sun);

  const corona = new THREE.Mesh(new THREE.SphereGeometry(50, 64, 64), makeCoronaMaterial(0xffa030));
  group.add(corona);
  const corona2 = new THREE.Mesh(new THREE.SphereGeometry(72, 48, 48), makeCoronaMaterial(0xff7a14));
  corona2.material.uniforms.uColor.value = new THREE.Color(0xff7a14);
  group.add(corona2);

  return { group, sun, mat, coronaMats: [corona.material, corona2.material] };
}

function planetTexture(loaded, key, fallbackKey) {
  return loaded[key] || loaded[fallbackKey];
}

export function buildPlanets(scene, loaded, q) {
  const planets = [];
  PLANET_DATA.forEach((d) => {
    const pivot = new THREE.Object3D(); scene.add(pivot);
    const tiltNode = new THREE.Object3D();
    tiltNode.rotation.z = THREE.MathUtils.degToRad(d.tilt);
    tiltNode.position.x = d.dist;
    pivot.add(tiltNode);

    const geo = new THREE.SphereGeometry(d.radius, q.sphereSeg, q.sphereSeg);
    const matOpts = { map: loaded[d.tex], roughness: 0.92, metalness: 0.0 };
    if (d.rocky && loaded[d.tex] && !loaded[d.tex]._fallback) {
      matOpts.bumpMap = loaded[d.tex];
      matOpts.bumpScale = d.tex === 'mars' ? 0.35 : d.tex === 'mercury' ? 0.4 : 0.15;
    }
    // Earth night-side city lights as emissive
    if (d.night && loaded[d.night]) {
      matOpts.emissiveMap = loaded[d.night];
      matOpts.emissive = new THREE.Color(0xffd27a);
      matOpts.emissiveIntensity = 1.1;
    }
    const mat = new THREE.MeshStandardMaterial(matOpts);
    const mesh = new THREE.Mesh(geo, mat);
    tiltNode.add(mesh);

    // clouds
    let clouds = null;
    if (d.clouds && loaded[d.clouds]) {
      const cGeo = new THREE.SphereGeometry(d.radius * 1.013, 64, 64);
      const cMat = new THREE.MeshStandardMaterial({ map: loaded[d.clouds], alphaMap: loaded[d.clouds], transparent: true, opacity: 0.9, depthWrite: false });
      clouds = new THREE.Mesh(cGeo, cMat); mesh.add(clouds);
    }

    // shader atmosphere
    if (d.atmStrength > 0) {
      const atm = makeAtmosphere(d.radius, d.atmColor, d.atmStrength);
      mesh.add(atm);
    }

    // Saturn ring (real texture, radial UVs)
    if (d.ring && loaded[d.ring]) {
      const inner = d.radius * 1.25, outer = d.radius * 2.35;
      const rGeo = new THREE.RingGeometry(inner, outer, 256);
      const p = rGeo.attributes.position, uv = rGeo.attributes.uv, v3 = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v3.fromBufferAttribute(p, i); const rr = v3.length(); uv.setXY(i, (rr-inner)/(outer-inner), 0.5); }
      const rMat = new THREE.MeshBasicMaterial({ map: loaded[d.ring], side: THREE.DoubleSide, transparent: true });
      const ring = new THREE.Mesh(rGeo, rMat); ring.rotation.x = Math.PI/2; mesh.add(ring);
    }

    // moons
    const moonMeshes = [];
    const mc = Math.min(d.moons, d.name === 'EARTH' ? 1 : 2);
    for (let m = 0; m < mc; m++) {
      const mGeo = new THREE.SphereGeometry(d.radius * 0.27, 32, 32);
      const mMat = new THREE.MeshStandardMaterial({ map: loaded[d.moonTex || 'moon'], roughness: 1 });
      const moon = new THREE.Mesh(mGeo, mMat); pivot.add(moon);
      moonMeshes.push({ mesh: moon, dist: d.radius*2.4 + m*d.radius*1.2, ang: rand(0, 6.28), speed: 0.02 + m*0.012, host: mesh });
    }

    // orbit line
    const pts = [];
    for (let a = 0; a <= 160; a++) { const th = a/160*6.283; pts.push(new THREE.Vector3(Math.cos(th)*d.dist, 0, Math.sin(th)*d.dist)); }
    const oGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const oMat = new THREE.LineBasicMaterial({ color: 0x2a4a8a, transparent: true, opacity: 0.28 });
    const orbitLine = new THREE.LineLoop(oGeo, oMat); scene.add(orbitLine);

    pivot.rotation.y = rand(0, 6.283);
    planets.push({ data: d, pivot, tiltNode, mesh, clouds, moonMeshes, orbitLine, exploded: false });
  });
  return planets;
}

// Instanced asteroid belt between Mars (270) and Jupiter (380)
export function buildBelt(scene, count, rInner, rOuter, sizeMin, sizeMax, color, thickness) {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  const data = [];
  for (let i = 0; i < count; i++) {
    const r = rand(rInner, rOuter);
    const ang = rand(0, Math.PI * 2);
    const y = rand(-thickness, thickness);
    const s = rand(sizeMin, sizeMax);
    data.push({ r, ang, y, s, spin: rand(0.2, 1.2), speed: rand(0.04, 0.12) / Math.sqrt(r) });
    dummy.position.set(Math.cos(ang)*r, y, Math.sin(ang)*r);
    dummy.scale.setScalar(s);
    dummy.rotation.set(rand(0,6.28), rand(0,6.28), rand(0,6.28));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  return { mesh, data, dummy };
}

export function updateBelt(belt, dt) {
  for (let i = 0; i < belt.data.length; i++) {
    const a = belt.data[i];
    a.ang += a.speed * dt * 8;
    belt.dummy.position.set(Math.cos(a.ang)*a.r, a.y, Math.sin(a.ang)*a.r);
    belt.dummy.scale.setScalar(a.s);
    belt.dummy.rotation.x += a.spin*dt; belt.dummy.rotation.y += a.spin*dt*0.7;
    belt.dummy.updateMatrix();
    belt.mesh.setMatrixAt(i, belt.dummy.matrix);
  }
  belt.mesh.instanceMatrix.needsUpdate = true;
}

// Comets: glowing head + stretched tail that points away from the sun
export function buildComets(scene, count) {
  const comets = [];
  for (let i = 0; i < count; i++) {
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xbfe9ff, toneMapped: false })
    );
    // tail as a cone of points
    const n = 220; const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n*3); const off = [];
    for (let j = 0; j < n; j++) { off.push({ d: rand(0, 1), spread: rand(0, 1) }); pos[j*3]=0;pos[j*3+1]=0;pos[j*3+2]=0; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tailMat = new THREE.PointsMaterial({ color: 0x9fd8ff, size: 1.6, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const tail = new THREE.Points(geo, tailMat);
    const group = new THREE.Object3D(); group.add(head); group.add(tail); scene.add(group);
    comets.push({
      group, head, tail, geo, off,
      a: rand(700, 1600), b: rand(420, 900),
      ang: rand(0, 6.28), speed: rand(0.06, 0.13), tilt: rand(-0.5, 0.5), n,
    });
  }
  return comets;
}

export function updateComets(comets, dt) {
  comets.forEach(c => {
    c.ang += c.speed * dt;
    const x = Math.cos(c.ang) * c.a;
    const z = Math.sin(c.ang) * c.b;
    const y = Math.sin(c.ang) * c.tilt * 120;
    c.group.position.set(x, y, z);
    // tail points away from origin (sun)
    const toSun = new THREE.Vector3(-x, -y, -z).normalize();
    const arr = c.geo.attributes.position.array;
    for (let j = 0; j < c.n; j++) {
      const o = c.off[j];
      const len = o.d * 90;
      arr[j*3] = toSun.x * len + (Math.random()-0.5)*o.spread*14;
      arr[j*3+1] = toSun.y * len + (Math.random()-0.5)*o.spread*14;
      arr[j*3+2] = toSun.z * len + (Math.random()-0.5)*o.spread*14;
    }
    c.geo.attributes.position.needsUpdate = true;
  });
}
