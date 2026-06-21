// =====================================================================
// shaders.js — GLSL for atmospheric scattering rims and the animated sun
// =====================================================================
import * as THREE from 'three';

// ---- Atmosphere: Fresnel rim glow that fakes Rayleigh scattering ----
export function makeAtmosphere(radius, color, strength) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor:    { value: new THREE.Color(color) },
      uStrength: { value: strength },
      uPower:    { value: 3.2 },
    },
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uStrength;
      uniform float uPower;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
        rim = pow(rim, uPower);
        gl_FragColor = vec4(uColor, rim * uStrength);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const geo = new THREE.SphereGeometry(radius * 1.12, 64, 64);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}

// ---- Animated sun surface: layered noise turbulence + limb darkening ----
export function makeSunMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap:  { value: map },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;

      // hash + value noise
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float a = hash(i), b = hash(i+vec2(1.,0.));
        float c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
        vec2 u = f*f*(3.-2.*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){
        float v=0., a=0.5;
        for(int i=0;i<5;i++){ v += a*noise(p); p*=2.0; a*=0.5; }
        return v;
      }
      void main() {
        // drifting turbulence over the photosphere texture
        vec2 uv = vUv;
        float t = uTime * 0.03;
        float turb = fbm(uv*8.0 + vec2(t, -t*0.6));
        float gran = fbm(uv*22.0 - vec2(t*1.7, t));
        vec3 base = texture2D(uMap, uv + 0.012*vec2(turb-0.5, gran-0.5)).rgb;
        // brighten hot granules, darken sunspun lanes
        base *= 0.75 + 0.9*turb;
        base += vec3(1.0,0.55,0.12) * pow(gran, 3.0) * 0.6;
        // limb darkening toward the edge
        float limb = pow(max(dot(vNormal, vView), 0.0), 0.45);
        base *= mix(0.55, 1.25, limb);
        gl_FragColor = vec4(base, 1.0);
      }
    `,
    toneMapped: false,
  });
}

// ---- Sun corona: soft additive halo that breathes ----
export function makeCoronaMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime:  { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec3 vView;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uTime;
      varying vec3 vNormal; varying vec3 vView;
      void main(){
        float rim = 1.0 - max(dot(vNormal, vView), 0.0);
        rim = pow(rim, 2.0);
        float pulse = 0.85 + 0.15*sin(uTime*1.5);
        gl_FragColor = vec4(uColor, rim * 0.7 * pulse);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}
