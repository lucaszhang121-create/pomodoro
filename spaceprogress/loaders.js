// =====================================================================
// loaders.js — bulletproof texture loading with timeout + fallback
// =====================================================================
import * as THREE from 'three';
import { FALLBACK } from './data.js';

const texLoader = new THREE.TextureLoader();
texLoader.crossOrigin = 'anonymous';

export function proceduralTex(base, accent, bands, blobs) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < bands; i++) {
    const y = (i / bands) * 512, h = (512 / bands) * (0.5 + Math.random());
    x.globalAlpha = 0.15 + Math.random() * 0.2; x.fillStyle = i % 2 ? accent : base;
    x.fillRect(0, y, 1024, h);
  }
  x.globalAlpha = 0.5;
  for (let i = 0; i < blobs; i++) {
    x.fillStyle = Math.random() > 0.5 ? accent : base;
    x.beginPath(); x.arc(Math.random() * 1024, Math.random() * 512, 4 + Math.random() * 40, 0, 6.28); x.fill();
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Loads a batch; resolves once ALL settle (success/fail/timeout). Never hangs.
export function loadBatch(entries, renderer, onProgress) {
  // entries: [{key, url}]
  const loaded = {};
  let done = 0;
  const total = entries.length;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  return new Promise((resolve) => {
    if (total === 0) { resolve(loaded); return; }
    entries.forEach(({ key, url }) => {
      let settled = false;
      const finish = (tex, isFallback) => {
        if (settled) return; settled = true;
        if (isFallback) tex._fallback = true;
        loaded[key] = tex;
        done++;
        if (onProgress) onProgress(done / total, key, isFallback);
        if (done >= total) resolve(loaded);
      };
      const fb = () => {
        const f = FALLBACK[key] || ['#888', '#555', 5, 60];
        finish(proceduralTex(f[0], f[1], f[2], f[3]), true);
      };
      const timer = setTimeout(fb, 12000);
      texLoader.load(url,
        (t) => { clearTimeout(timer); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; finish(t, false); },
        undefined,
        () => { clearTimeout(timer); fb(); });
    });
  });
}

// Background single-texture upgrade (silent on failure).
export function upgradeTexture(url, renderer, onLoad) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  texLoader.load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; onLoad(t);
  });
}
