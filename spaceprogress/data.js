// =====================================================================
// data.js — planet definitions, texture URLs, quality presets
// Textures: Solar System Scope (CC BY 4.0), derived from NASA imagery,
// served from Wikimedia upload mirrors (MD5-prefixed direct URLs).
// =====================================================================

const WM = 'https://upload.wikimedia.org/wikipedia/commons/';

// 2K base (fast, reliable) — planets appear immediately at this tier.
export const TEX = {
  mercury:   WM + '9/92/Solarsystemscope_texture_2k_mercury.jpg',
  venus:     WM + '4/40/Solarsystemscope_texture_2k_venus_surface.jpg',
  venusAtm:  WM + '6/63/Solarsystemscope_texture_2k_venus_atmosphere.jpg',
  earth:     WM + 'c/c3/Solarsystemscope_texture_2k_earth_daymap.jpg',
  earthNight:WM + '2/2f/Solarsystemscope_texture_2k_earth_nightmap.jpg',
  clouds:    WM + 'e/ed/Solarsystemscope_texture_2k_earth_clouds.jpg',
  mars:      WM + '4/46/Solarsystemscope_texture_2k_mars.jpg',
  jupiter:   WM + 'b/be/Solarsystemscope_texture_2k_jupiter.jpg',
  saturn:    WM + 'e/ea/Solarsystemscope_texture_2k_saturn.jpg',
  saturnRing:WM + '7/7d/Solarsystemscope_texture_2k_saturn_ring_alpha.png',
  uranus:    WM + '9/95/Solarsystemscope_texture_2k_uranus.jpg',
  neptune:   WM + '1/1e/Solarsystemscope_texture_2k_neptune.jpg',
  sun:       WM + 'c/cb/Solarsystemscope_texture_2k_sun.jpg',
  moon:      WM + '2/26/Solarsystemscope_texture_2k_moon.jpg',
  stars:     WM + '0/0e/Solarsystemscope_texture_2k_stars_milky_way.jpg',
};

// 8K hero upgrades — fetched in the background after the scene is live.
export const TEX_HI = {
  earth:   WM + '0/04/Solarsystemscope_texture_8k_earth_daymap.jpg',
  earthNight: WM + 'b/b3/Solarsystemscope_texture_8k_earth_nightmap.jpg',
  clouds:  WM + '7/7a/Solarsystemscope_texture_8k_earth_clouds.jpg',
  mars:    WM + '7/70/Solarsystemscope_texture_8k_mars.jpg',
  jupiter: WM + '5/5e/Solarsystemscope_texture_8k_jupiter.jpg',
  mercury: WM + '2/27/Solarsystemscope_texture_8k_mercury.jpg',
  moon:    WM + 'd/d1/Solarsystemscope_texture_8k_moon.jpg',
};

// Procedural fallbacks if a real texture is blocked/slow.
export const FALLBACK = {
  mercury:['#8c7853','#5c4a35',7,120], venus:['#c9a06a','#9c7440',5,60],
  venusAtm:['#d9b27a','#b8884a',4,30],
  earth:['#1f5fa0','#2f8f4a',4,140], earthNight:['#06080f','#15306a',2,40],
  clouds:['#ffffff','#dddddd',2,120],
  mars:['#b5532e','#7a3318',6,140],
  jupiter:['#c9a877','#9c6b3e',13,40], saturn:['#dcc28e','#b3914f',9,30],
  saturnRing:['#d9c08a','#b3914f',3,10],
  uranus:['#9fe3e0','#6fc9c6',5,18], neptune:['#3457c4','#22398f',6,24],
  sun:['#ff9b1e','#ffd84d',0,260], moon:['#9a9a9a','#6a6a6a',0,200],
  stars:['#05060f','#1a2950',0,400],
};

// Planet table. Radii & distances are scaled for playability; rotation,
// tilt, and relative orbit speed reflect real values.
export const PLANET_DATA = [
  { name:'MERCURY', sub:'Closest to the Sun', tex:'mercury', radius:3.0, dist:90, orbit:0.0090, spin:0.0010, tilt:0.03, moons:0,
    atmColor:0x000000, atmStrength:0.0, rocky:true,
    dia:'4,879 km', mass:'3.30e23 kg', grav:'3.7 m/s²', day:'1,408 h', year:'88 d', tiltTxt:'0.03°', temp:'167 °C', distTxt:'57.9M km', col:'#9c8466' },
  { name:'VENUS', sub:'The veiled inferno', tex:'venus', atm:'venusAtm', atmColor:0xffe7b0, atmStrength:0.77, radius:4.6, dist:140, orbit:0.0066, spin:-0.0004, tilt:177.4, moons:0,
    dia:'12,104 km', mass:'4.87e24 kg', grav:'8.9 m/s²', day:'5,832 h', year:'225 d', tiltTxt:'177.4°', temp:'464 °C', distTxt:'108.2M km', col:'#d9b27a' },
  { name:'EARTH', sub:'Third planet from the Sun', tex:'earth', night:'earthNight', clouds:'clouds', atmColor:0x6ab0ff, atmStrength:0.55, radius:4.8, dist:200, orbit:0.0056, spin:0.0050, tilt:23.4, moons:1, moonTex:'moon', rocky:true,
    dia:'12,742 km', mass:'5.97e24 kg', grav:'9.8 m/s²', day:'24 h', year:'365.25 d', tiltTxt:'23.4°', temp:'15 °C', distTxt:'149.6M km', col:'#2a6db0' },
  { name:'MARS', sub:'The red planet', tex:'mars', atmColor:0xd98a5a, atmStrength:0.28, radius:3.6, dist:270, orbit:0.0045, spin:0.0048, tilt:25.2, moons:2, rocky:true,
    dia:'6,779 km', mass:'6.42e23 kg', grav:'3.7 m/s²', day:'24.6 h', year:'687 d', tiltTxt:'25.2°', temp:'-65 °C', distTxt:'227.9M km', col:'#c1502e' },
  { name:'JUPITER', sub:'King of the planets', tex:'jupiter', atmColor:0xd8b98a, atmStrength:0.33, radius:13, dist:380, orbit:0.0024, spin:0.0120, tilt:3.1, moons:95,
    dia:'139,820 km', mass:'1.90e27 kg', grav:'24.8 m/s²', day:'9.9 h', year:'11.9 y', tiltTxt:'3.1°', temp:'-110 °C', distTxt:'778.5M km', col:'#cda66f' },
  { name:'SATURN', sub:'The ringed jewel', tex:'saturn', ring:'saturnRing', atmColor:0xe8d4a0, atmStrength:0.28, radius:11, dist:520, orbit:0.0018, spin:0.0112, tilt:26.7, moons:146,
    dia:'116,460 km', mass:'5.68e26 kg', grav:'10.4 m/s²', day:'10.7 h', year:'29.5 y', tiltTxt:'26.7°', temp:'-140 °C', distTxt:'1.43B km', col:'#e0c18a' },
  { name:'URANUS', sub:'The tilted ice giant', tex:'uranus', atmColor:0x9fe3e0, atmStrength:0.44, radius:7.6, dist:650, orbit:0.0013, spin:0.0078, tilt:97.8, moons:28,
    dia:'50,724 km', mass:'8.68e25 kg', grav:'8.7 m/s²', day:'17.2 h', year:'84 y', tiltTxt:'97.8°', temp:'-195 °C', distTxt:'2.87B km', col:'#9fe3e0' },
  { name:'NEPTUNE', sub:'The windy blue giant', tex:'neptune', atmColor:0x3b62d6, atmStrength:0.55, radius:7.4, dist:760, orbit:0.0010, spin:0.0084, tilt:28.3, moons:16,
    dia:'49,244 km', mass:'1.02e26 kg', grav:'11.2 m/s²', day:'16.1 h', year:'165 y', tiltTxt:'28.3°', temp:'-200 °C', distTxt:'4.50B km', col:'#3b62d6' },
];

// Quality presets. ULTRA is uncapped; BALANCED keeps it smooth everywhere.
// bloomThreshold matters most: too low (~0) makes ordinary lit surfaces glow
// into a featureless halo. Only the Sun, explosions, and emissive lights
// (which render above 1.0 / toneMapped:false) should cross this threshold.
export const QUALITY = {
  ultra: {
    name:'ultra',
    sphereSeg: 160, sunSeg: 128,
    asteroids: 2600, kuiper: 1400, comets: 4,
    bloom: true, bloomStrength: 1.1, bloomRadius: 0.55, bloomThreshold: 0.82,
    pixelRatioCap: 2.5, anisotropy: true, hiRes: true,
    explosionStem: 30, explosionCap: 48, explosionChunks: 50, explosionEmbers: 220, fireballPuffs: 70,
    starCount: 9000,
  },
  balanced: {
    name:'balanced',
    sphereSeg: 80, sunSeg: 64,
    asteroids: 900, kuiper: 500, comets: 2,
    bloom: true, bloomStrength: 0.85, bloomRadius: 0.45, bloomThreshold: 0.85,
    pixelRatioCap: 1.5, anisotropy: true, hiRes: true,
    explosionStem: 20, explosionCap: 32, explosionChunks: 30, explosionEmbers: 140, fireballPuffs: 46,
    starCount: 4000,
  },
};