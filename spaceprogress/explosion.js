// =====================================================================
// explosion.js — nuclear-style detonation: flash, fireball, mushroom
// cloud (stem + cap + skirt), ejecta chunks, embers, shock ring.
// =====================================================================
import * as THREE from 'three';

const rand = (a, b) => Math.random() * (b - a) + a;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function softSprite(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(s => g.addColorStop(s[0], s[1]));
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
function smokeSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 22; i++) {
    const px = 128 + rand(-70, 70), py = 128 + rand(-70, 70), rad = rand(30, 85);
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    const sh = 40 + Math.floor(Math.random() * 40);
    g.addColorStop(0, `rgba(${sh},${sh-6},${sh-10},0.30)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 6.28); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

const SPRITE_FIRE = softSprite([[0,'rgba(255,255,255,1)'],[0.22,'rgba(255,236,170,0.97)'],[0.5,'rgba(255,130,35,0.6)'],[1,'rgba(120,20,0,0)']]);
const SPRITE_GLOW = softSprite([[0,'rgba(255,255,255,1)'],[0.4,'rgba(255,210,140,0.85)'],[1,'rgba(255,120,30,0)']]);
const SPRITE_SMOKE = smokeSprite();

const cW = new THREE.Color(0xffffff), cY = new THREE.Color(0xffe24d), cO = new THREE.Color(0xff6a1e), cR = new THREE.Color(0x8c1d0a);
function fireColor(t) {
  const c = new THREE.Color();
  if (t < 0.2) c.copy(cW).lerp(cY, t / 0.2);
  else if (t < 0.5) c.copy(cY).lerp(cO, (t - 0.2) / 0.3);
  else c.copy(cO).lerp(cR, (t - 0.5) / 0.5);
  return c;
}
function smokeColor(t) {
  const hot = new THREE.Color(0x9a7a55), cold = new THREE.Color(0x322c28);
  return hot.clone().lerp(cold, t);
}

export class ExplosionSystem {
  constructor(scene, quality) { this.scene = scene; this.q = quality; this.active = []; }
  setQuality(q) { this.q = q; }

  detonate(center, r, planetColor, planetMaterial) {
    const q = this.q;
    const up = center.clone().normalize();
    if (up.lengthSq() < 0.001) up.set(0, 1, 0);
    let side1 = new THREE.Vector3(0, 1, 0).cross(up);
    if (side1.lengthSq() < 0.001) side1.set(1, 0, 0);
    side1.normalize();
    const side2 = up.clone().cross(side1).normalize();

    const sys = {
      center: center.clone(), r, up, side1, side2, life: 0, maxLife: 7.5,
      flash: null, fireball: null, sparkles: [], shock: null,
      stem: [], cap: [], skirt: [], chunks: [], embers: [],
    };
    const S = this.scene;

    // 1) flash
    {
      const m = new THREE.SpriteMaterial({ map: SPRITE_GLOW, color: 0xffffff, transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false });
      const s = new THREE.Sprite(m); s.position.copy(center); s.scale.setScalar(r * 3);
      S.add(s); sys.flash = s;
    }
    // 2) fireball + fire puffs
    {
      const geo = new THREE.SphereGeometry(r * 0.5, 48, 48);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false });
      const ball = new THREE.Mesh(geo, mat); ball.position.copy(center); S.add(ball); sys.fireball = ball;
      for (let i = 0; i < q.fireballPuffs; i++) {
        const dir = new THREE.Vector3(rand(-1,1), rand(-1,1), rand(-1,1)).normalize();
        const m2 = new THREE.SpriteMaterial({ map: SPRITE_FIRE, color: 0xffffff, transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false });
        const s2 = new THREE.Sprite(m2); s2.position.copy(center);
        const scl = r * rand(0.6, 1.7); s2.scale.setScalar(scl); S.add(s2);
        sys.sparkles.push({ s: s2, vel: dir.multiplyScalar(rand(0.3, 1.4) * r), base: scl });
      }
    }
    // 3) shock ring
    {
      const g = new THREE.RingGeometry(r * 0.8, r * 0.95, 128);
      const m = new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.6, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      const ring = new THREE.Mesh(g, m); ring.position.copy(center);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up); S.add(ring); sys.shock = ring;
    }
    // 4) ejecta chunks (real planet texture)
    {
      const cm = planetMaterial;
      for (let i = 0; i < q.explosionChunks; i++) {
        const cr = r * rand(0.05, 0.17);
        const pick = Math.random();
        let g = pick < 0.5 ? new THREE.TetrahedronGeometry(cr, 0)
              : pick < 0.8 ? new THREE.DodecahedronGeometry(cr, 0)
              : new THREE.IcosahedronGeometry(cr, 0);
        const ap = g.attributes.position;
        for (let v = 0; v < ap.count; v++) ap.setXYZ(v, ap.getX(v)*rand(0.7,1.3), ap.getY(v)*rand(0.7,1.3), ap.getZ(v)*rand(0.7,1.3));
        g.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({ map: cm.map, roughness: 0.95, metalness: 0 });
        const mesh = new THREE.Mesh(g, mat);
        const dir = up.clone().multiplyScalar(rand(0.2, 1.0)).addScaledVector(side1, rand(-1,1)).addScaledVector(side2, rand(-1,1)).normalize();
        mesh.position.copy(center).addScaledVector(dir, r * 0.5); S.add(mesh);
        sys.chunks.push({ mesh, vel: dir.multiplyScalar(rand(0.6, 2.6) * r), rot: new THREE.Vector3(rand(-4,4), rand(-4,4), rand(-4,4)) });
      }
    }
    // 5) embers
    {
      const n = q.explosionEmbers; const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(n*3); const vel = [];
      for (let i = 0; i < n; i++) { pos[i*3]=center.x; pos[i*3+1]=center.y; pos[i*3+2]=center.z;
        const dir = new THREE.Vector3(rand(-1,1), rand(-1,1), rand(-1,1)).normalize();
        vel.push(dir.multiplyScalar(rand(1, 4) * r)); }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ map: SPRITE_FIRE, color: 0xffd070, size: r*0.16, transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false });
      const pts = new THREE.Points(geo, mat); S.add(pts);
      sys.embers.push({ pts, geo, vel, n });
    }
    // 6) stem
    for (let i = 0; i < q.explosionStem; i++) {
      const m = new THREE.SpriteMaterial({ map: SPRITE_SMOKE, color: 0x6b5d52, transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(m); s.position.copy(center);
      const h = i / q.explosionStem; s.scale.setScalar(r * (0.8 + h * 0.6)); S.add(s);
      sys.stem.push({ s, h, jitter: new THREE.Vector3(rand(-0.25,0.25), 0, rand(-0.25,0.25)), base: r*(0.8+h*0.6), delay: 0.5 + h*0.9, spin: rand(-0.6,0.6) });
    }
    // 7) cap
    for (let i = 0; i < q.explosionCap; i++) {
      const m = new THREE.SpriteMaterial({ map: SPRITE_SMOKE, color: 0x7a6a5c, transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(m); s.position.copy(center);
      s.scale.setScalar(r * rand(1.0, 2.0)); S.add(s);
      sys.cap.push({ s, ang: rand(0, 6.283), ringR: Math.random(), roll: rand(0.5,1.5), base: r*rand(1.0,2.0), delay: 1.3 + Math.random()*0.5, spin: rand(-0.5,0.5) });
    }
    // 8) skirt
    for (let i = 0; i < Math.round(q.explosionStem*0.9); i++) {
      const m = new THREE.SpriteMaterial({ map: SPRITE_SMOKE, color: 0x5a4f47, transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(m); s.position.copy(center);
      const ang = rand(0, 6.283); s.scale.setScalar(r * rand(0.7, 1.5)); S.add(s);
      sys.skirt.push({ s, dir: side1.clone().multiplyScalar(Math.cos(ang)).addScaledVector(side2, Math.sin(ang)), base: r*rand(0.7,1.5), delay: 0.2 + Math.random()*0.3, speed: rand(0.8,1.8)*r });
    }

    this.active.push(sys);
    return sys;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const sys = this.active[i]; sys.life += dt;
      const L = sys.life, t = L / sys.maxLife, r = sys.r, up = sys.up, S = this.scene;

      if (sys.flash) { const ft = clamp(L/0.4,0,1); sys.flash.material.opacity = Math.max(0,1-ft); sys.flash.scale.setScalar(r*(3+ft*6)); if (ft>=1){S.remove(sys.flash); sys.flash=null;} }

      if (sys.fireball) {
        const ft = clamp(L/1.8,0,1);
        sys.fireball.scale.setScalar(0.5 + ft*3.4);
        sys.fireball.material.color.copy(fireColor(ft));
        sys.fireball.material.opacity = Math.max(0, 1 - ft*1.05);
        sys.fireball.position.copy(sys.center).addScaledVector(up, ft*r*1.2);
        if (ft>=1){ S.remove(sys.fireball); sys.fireball.geometry.dispose(); sys.fireball=null; }
      }
      sys.sparkles.forEach(f => {
        f.s.position.addScaledVector(f.vel, dt); f.vel.multiplyScalar(0.95);
        const ft = clamp(L/1.6,0,1);
        f.s.material.color.copy(fireColor(ft)); f.s.material.opacity = Math.max(0,1-ft);
        f.s.scale.setScalar(f.base*(1+ft*1.6));
      });
      if (sys.shock) { const st = clamp(L/1.2,0,1); sys.shock.scale.setScalar(1+st*11); sys.shock.material.opacity = Math.max(0,0.6*(1-st)); if (st>=1){S.remove(sys.shock); sys.shock.geometry.dispose(); sys.shock=null;} }

      sys.chunks.forEach(c => {
        c.mesh.position.addScaledVector(c.vel, dt); c.vel.multiplyScalar(0.99);
        c.mesh.rotation.x += c.rot.x*dt; c.mesh.rotation.y += c.rot.y*dt; c.mesh.rotation.z += c.rot.z*dt;
        const gl = Math.max(0, 1 - L/1.8);
        c.mesh.material.emissive.copy(fireColor(clamp(L/1.8,0,1))).multiplyScalar(gl);
        if (t>0.7){ c.mesh.material.transparent=true; c.mesh.material.opacity=Math.max(0,1-(t-0.7)/0.3); }
      });
      sys.embers.forEach(e => {
        const arr = e.geo.attributes.position.array;
        for (let j=0;j<e.n;j++){ arr[j*3]+=e.vel[j].x*dt; arr[j*3+1]+=e.vel[j].y*dt; arr[j*3+2]+=e.vel[j].z*dt; e.vel[j].multiplyScalar(0.965); }
        e.geo.attributes.position.needsUpdate = true;
        const ft = clamp(L/2.0,0,1); e.pts.material.color.copy(fireColor(ft));
        e.pts.material.opacity = Math.max(0,1-ft); e.pts.material.size = r*0.16*(1-ft*0.5);
      });

      const stemTopH = clamp((L-0.5)/2.5,0,1)*r*7;
      sys.stem.forEach(st => {
        if (L < st.delay){ st.s.material.opacity=0; return; }
        const age = L - st.delay;
        st.s.position.copy(sys.center).addScaledVector(up, Math.min(age*r*3.0, st.h*stemTopH))
          .addScaledVector(sys.side1, st.jitter.x*r).addScaledVector(sys.side2, st.jitter.z*r);
        const lt = clamp(age/(sys.maxLife-st.delay),0,1);
        st.s.material.color.copy(smokeColor(lt));
        st.s.material.opacity = lt<0.2 ? (lt/0.2)*0.7 : 0.7*(1-(lt-0.2)/0.8);
        st.s.scale.setScalar(st.base*(1+lt*1.6)); st.s.material.rotation += st.spin*dt;
      });
      const capCenterUp = stemTopH + r*1.2;
      sys.cap.forEach(cp => {
        if (L < cp.delay){ cp.s.material.opacity=0; return; }
        const age = L - cp.delay;
        const bloom = clamp(age/2.2,0,1);
        const torusR = (0.4 + cp.ringR*2.4) * r * (0.5+bloom);
        const rollUp = Math.sin(age*cp.roll)*r*0.5;
        cp.s.position.copy(sys.center).addScaledVector(up, capCenterUp + rollUp + cp.ringR*r*0.4)
          .addScaledVector(sys.side1, Math.cos(cp.ang)*torusR).addScaledVector(sys.side2, Math.sin(cp.ang)*torusR);
        const lt = clamp(age/(sys.maxLife-cp.delay),0,1);
        cp.s.material.color.copy(smokeColor(lt*0.8));
        cp.s.material.opacity = lt<0.2 ? (lt/0.2)*0.78 : 0.78*(1-(lt-0.2)/0.8);
        cp.s.scale.setScalar(cp.base*(1+bloom*1.4)); cp.s.material.rotation += cp.spin*dt;
      });
      sys.skirt.forEach(sk => {
        if (L < sk.delay){ sk.s.material.opacity=0; return; }
        const age = L - sk.delay;
        const spread = Math.min(age*sk.speed*1.4, r*5);
        sk.s.position.copy(sys.center).addScaledVector(sk.dir, spread).addScaledVector(up, r*0.15);
        const lt = clamp(age/2.6,0,1);
        sk.s.material.color.copy(smokeColor(lt));
        sk.s.material.opacity = lt<0.2 ? (lt/0.2)*0.55 : 0.55*(1-(lt-0.2)/0.8);
        sk.s.scale.setScalar(sk.base*(1+lt*2.2));
      });

      if (L >= sys.maxLife) {
        const rm = o => { if (o) S.remove(o); };
        sys.stem.forEach(s=>rm(s.s)); sys.cap.forEach(s=>rm(s.s)); sys.skirt.forEach(s=>rm(s.s)); sys.sparkles.forEach(s=>rm(s.s));
        sys.chunks.forEach(c=>{rm(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.dispose();});
        sys.embers.forEach(e=>{rm(e.pts); e.geo.dispose();});
        rm(sys.shock); rm(sys.fireball); rm(sys.flash);
        this.active.splice(i, 1);
      }
    }
  }
}
