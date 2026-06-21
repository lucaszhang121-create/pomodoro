# SOL — Photoreal Solar System (Stand & Detonate)

An interactive, GPU-accelerated solar system built with **Three.js** (ES modules, no build step).
You stand on a planet, read its real data, detonate it with a nuclear-style blast, and get flung
outward to the next world — through an asteroid belt, Kuiper belt, and comets, all under real-time
bloom and GLSL atmospheric scattering.

## Run it in VS Code (30 seconds)

1. Open this folder in VS Code (`File → Open Folder`).
2. Install the **Live Server** extension if prompted (VS Code will recommend it automatically).
3. Right-click `index.html` → **"Open with Live Server"**.
4. Your browser opens at `http://127.0.0.1:5500/` and the system loads.

> It must be served over `http://` (Live Server), **not** opened as a `file://` path —
> ES modules and cross-origin textures require a real server.

## Controls

- **Drag** — look around the planet you're standing on
- **Scroll** — zoom in / out
- **☢ DETONATE THIS WORLD** — nuke the current planet, then sweep to the next
- **🛰 ORBIT VIEW** — pull back to a free-flying view of the whole system
- **BALANCED / ULTRA** — live quality toggle (bottom-right)

## Quality tiers

- **ULTRA** — uncapped: 2600-rock asteroid belt, 1400 Kuiper objects, full bloom,
  160-segment spheres, 8K hero textures, dense particles. For a strong GPU.
- **BALANCED** — smooth on most laptops: lighter belts, capped pixel ratio, still bloomed.

Switch any time — it rebuilds the belts/comets live.

## Project structure

```
index.html         # entry + import map (pins three@0.160.0) + HUD
style.css          # HUD / loader / toggle styling
src/
  main.js          # renderer, bloom composer, camera modes, flow, loop
  data.js          # planet table, texture URLs (2K base + 8K upgrades), quality presets
  bodies.js        # sun, planets, moons, rings, asteroid belt, kuiper belt, comets
  shaders.js       # GLSL: atmosphere scattering, animated sun, corona
  explosion.js     # nuclear detonation system (flash, fireball, mushroom cloud, ejecta)
  loaders.js       # bulletproof texture loading (timeout + procedural fallback)
```

## Textures / credits

Planet & star imagery: **Solar System Scope** texture pack, licensed **CC BY 4.0**,
derived from NASA elevation/imagery data (Messenger, Viking, Cassini, Hubble, Blue Marble).
Loaded at runtime from Wikimedia Commons mirrors. An internet connection is required on first load;
if any texture is blocked, that body falls back to a generated stand-in so the scene never breaks.

## Notes on realism limits

- Distances between planets are **compressed** for playability. True 1:1 spacing is not renderable
  in a single view — floating-point precision collapses and the outer planets become invisibly far.
  Radii, axial tilts, and relative rotation/orbit rates use real values.
- Texture resolution tops out at **8K** — that is the highest published for these bodies, and also
  near the practical WebGL ceiling (GPUs cap textures at 16384px). "32K" is not possible in a browser.
