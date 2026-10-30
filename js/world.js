// The world engine: one shader paints every world's background and blends them by scroll
// position; a second, transparent layer holds S-01, each world's floating props and spell particles.
import * as THREE from '../vendor/three.module.min.js';
import { createRobot } from './robot.js';

export const WORLDS = ['cosmic', 'clay', 'glass', 'arena', 'fantasy', 'concrete', 'studio', 'editorial', 'void'];

// ------------------------------------------------------------------ background shader
const BG_FRAG = /* glsl */ `
precision highp float;
uniform float uW[9];
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uScroll;
uniform vec3 uSpell;
uniform float uSpellAmt;
uniform float uFlash;
varying vec2 vUv;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
float starField(vec2 p, float density, float size, float seed) {
  vec2 g = p * density; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float h = hash(id + seed);
  if (h < 0.86) return 0.0;
  vec2 off = vec2(hash(id + 1.3 + seed), hash(id + 7.1 + seed)) - 0.5;
  float d = length(f - off * 0.6);
  float tw = 0.55 + 0.45 * sin(uTime * (0.8 + h * 3.0) + h * 40.0);
  return smoothstep(size, 0.0, d) * tw * (h - 0.86) / 0.14;
}
vec3 hex(float r, float g, float b) { return vec3(r, g, b) / 255.0; }

vec3 cosmic(vec2 p) {
  vec3 col = mix(hex(4.0, 5.0, 14.0), hex(14.0, 18.0, 52.0), smoothstep(-0.7, 0.8, p.y));
  float n = fbm(p * 1.4 + vec2(uTime * 0.012, uScroll * 0.04));
  col += hex(80.0, 50.0, 170.0) * pow(n, 3.0) * 1.1;
  col += hex(20.0, 120.0, 170.0) * pow(fbm(p * 2.2 - 3.0 + uScroll * 0.02), 4.0) * 1.6;
  float s = starField(p + vec2(0.0, uScroll * 0.02), 55.0, 0.05, 0.0) + 0.7 * starField(p * 1.6 + vec2(0.0, uScroll * 0.05), 90.0, 0.045, 3.0);
  col += vec3(s) * vec3(0.85, 0.92, 1.0);
  col += hex(110.0, 231.0, 255.0) * 0.06 * smoothstep(0.9, 0.0, length(p - uMouse * vec2(uRes.x / uRes.y, 1.0) * 0.5));
  return col;
}
vec3 clay(vec2 p) {
  vec3 col = mix(hex(255.0, 228.0, 212.0), hex(191.0, 224.0, 255.0), smoothstep(-0.6, 0.7, p.y));
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(fi * 1.9 + 0.4) * 1.05, cos(fi * 2.7) * 0.45 + sin(uTime * 0.25 + fi) * 0.03);
    c.y += -0.15 + fract(fi * 0.37 - uScroll * 0.05) * 0.0;
    float r = 0.12 + 0.08 * fract(fi * 0.61);
    float d = length(p - c) / r;
    if (d < 1.0) {
      vec3 tint = fi < 2.0 ? hex(255.0, 209.0, 102.0) : fi < 4.0 ? hex(255.0, 159.0, 135.0) : hex(142.0, 202.0, 230.0);
      vec2 n2 = (p - c) / r;
      float light = 0.78 + 0.22 * dot(normalize(vec3(n2, sqrt(max(0.0, 1.0 - dot(n2, n2))))), normalize(vec3(-0.5, 0.7, 0.6)));
      float edge = smoothstep(1.0, 0.92, d);
      col = mix(col, tint * light, edge * 0.55);
    }
  }
  col += (noise(p * 220.0) - 0.5) * 0.025;
  return col;
}
vec3 glass(vec2 p) {
  vec3 col = mix(hex(3.0, 15.0, 25.0), hex(9.0, 40.0, 56.0), smoothstep(-0.8, 0.8, p.y));
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float y = sin(p.x * 1.4 + uTime * 0.12 + fk * 2.1) * 0.22 + fk * 0.22 - 0.15 + (fbm(vec2(p.x * 1.1, uTime * 0.04 + fk * 3.0)) - 0.5) * 0.5;
    float band = exp(-abs(p.y - y) * (5.0 + fk * 2.0));
    vec3 c = fk < 0.5 ? hex(40.0, 255.0, 210.0) : fk < 1.5 ? hex(24.0, 86.0, 255.0) : hex(7.0, 202.0, 107.0);
    col += c * band * 0.38;
  }
  col += hex(80.0, 220.0, 255.0) * 0.05 * smoothstep(1.2, 0.0, length(p - vec2(0.6, 0.3)));
  return col;
}
vec3 arena(vec2 p) {
  vec3 col = hex(6.0, 6.0, 7.0);
  col += hex(255.0, 75.0, 31.0) * smoothstep(0.1, -0.9, p.y) * 0.32;
  float beamA = 0.35 * sin(uTime * 0.21);
  vec2 q = p - vec2(beamA, 0.9);
  float beam = smoothstep(0.18, 0.0, abs(q.x + q.y * 0.35)) * smoothstep(-1.2, 0.6, p.y);
  col += hex(255.0, 120.0, 60.0) * beam * 0.08;
  col += (hash(p * uRes.y + uTime) - 0.5) * 0.06;
  col *= 1.0 - 0.45 * dot(p * 0.7, p * 0.7);
  return col;
}
vec3 fantasy(vec2 p) {
  vec3 col = mix(hex(76.0, 30.0, 82.0), hex(20.0, 12.0, 46.0), smoothstep(-0.8, 0.7, p.y));
  float n = fbm(p * 1.8 + vec2(uTime * 0.02, 0.0));
  col += hex(150.0, 110.0, 220.0) * pow(n, 2.5) * 0.45;
  float m = starField(p + vec2(sin(uTime * 0.2) * 0.02, -uTime * 0.025 + uScroll * 0.03), 34.0, 0.07, 9.0);
  col += hex(255.0, 210.0, 110.0) * m * 1.2;
  col += hex(255.0, 200.0, 120.0) * 0.08 * smoothstep(1.1, 0.0, length(p - vec2(-0.5, -0.6)));
  return col;
}
vec3 concrete(vec2 p) {
  vec3 col = hex(205.0, 201.0, 194.0);
  col += (fbm(p * 7.0) - 0.5) * 0.09 + (noise(p * 160.0) - 0.5) * 0.05;
  vec2 panel = p * vec2(1.1, 1.8) + vec2(0.0, uScroll * 0.18);
  vec2 f = fract(panel);
  float seam = smoothstep(0.012, 0.0, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  col -= seam * 0.07;
  vec2 tie = fract(panel * 2.0) - 0.5;
  col -= smoothstep(0.035, 0.02, length(tie)) * 0.12;
  return col;
}
vec3 studio(vec2 p) {
  vec3 col = hex(251.0, 246.0, 234.0);
  col += (noise(p * 300.0) - 0.5) * 0.03 + (fbm(p * 3.0) - 0.5) * 0.03;
  float blot = smoothstep(0.62, 0.66, fbm(p * 1.6 + 11.0));
  col = mix(col, hex(37.0, 71.0, 208.0), blot * 0.12);
  float blot2 = smoothstep(0.66, 0.7, fbm(p * 1.9 - 7.0));
  col = mix(col, hex(245.0, 179.0, 1.0), blot2 * 0.14);
  return col;
}
vec3 editorial(vec2 p) {
  vec3 col = hex(13.0, 13.0, 15.0);
  col += hex(15.0, 70.0, 70.0) * smoothstep(1.0, 0.0, length(p - vec2(-0.7 + sin(uTime * 0.07) * 0.2, 0.4))) * 0.35;
  col += hex(70.0, 45.0, 25.0) * smoothstep(1.1, 0.0, length(p - vec2(0.8, -0.5 + cos(uTime * 0.05) * 0.2))) * 0.3;
  col += (hash(p * uRes.y + floor(uTime * 24.0)) - 0.5) * 0.045;
  return col;
}
vec3 voidW(vec2 p) {
  vec3 col = vec3(0.0);
  col += vec3(starField(p + vec2(0.0, uScroll * 0.01), 40.0, 0.04, 21.0)) * 0.6;
  return col;
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec3 col = vec3(0.0);
  if (uW[0] > 0.002) col += uW[0] * cosmic(p);
  if (uW[1] > 0.002) col += uW[1] * clay(p);
  if (uW[2] > 0.002) col += uW[2] * glass(p);
  if (uW[3] > 0.002) col += uW[3] * arena(p);
  if (uW[4] > 0.002) col += uW[4] * fantasy(p);
  if (uW[5] > 0.002) col += uW[5] * concrete(p);
  if (uW[6] > 0.002) col += uW[6] * studio(p);
  if (uW[7] > 0.002) col += uW[7] * editorial(p);
  if (uW[8] > 0.002) col += uW[8] * voidW(p);
  col += uSpell * uSpellAmt * 0.35 * smoothstep(1.4, 0.0, length(p - vec2(0.45, -0.1)));
  col += vec3(1.0, 0.85, 0.7) * uFlash * 0.5;
  gl_FragColor = vec4(col, 1.0);
}
`;
const BG_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// per-world light rig and prop palette
const LIGHT = {
  cosmic:    { sky: '#9fb8ff', ground: '#1a1030', hemi: 0.9, key: '#ffffff', keyI: 2.0, rim: '#6ee7ff', rimI: 2.2 },
  clay:      { sky: '#ffffff', ground: '#ffd7c2', hemi: 1.8, key: '#fff6e8', keyI: 2.2, rim: '#bfe0ff', rimI: 0.8 },
  glass:     { sky: '#a8f4ff', ground: '#062030', hemi: 1.0, key: '#e8fbff', keyI: 2.0, rim: '#28ffd2', rimI: 2.4 },
  arena:     { sky: '#ffb08a', ground: '#140604', hemi: 0.7, key: '#ffd2b8', keyI: 2.4, rim: '#ff4b1f', rimI: 3.0 },
  fantasy:   { sky: '#d9b8ff', ground: '#2a1030', hemi: 1.0, key: '#ffd99a', keyI: 2.0, rim: '#a77bff', rimI: 2.4 },
  concrete:  { sky: '#ffffff', ground: '#9a958c', hemi: 1.6, key: '#ffffff', keyI: 1.8, rim: '#ffffff', rimI: 0.6 },
  studio:    { sky: '#ffffff', ground: '#f3e3c0', hemi: 1.7, key: '#fffaf0', keyI: 2.0, rim: '#2547d0', rimI: 0.8 },
  editorial: { sky: '#d8e8e8', ground: '#141414', hemi: 0.9, key: '#ffffff', keyI: 1.8, rim: '#6ee7ff', rimI: 1.2 },
  void:      { sky: '#9fb8ff', ground: '#000000', hemi: 0.8, key: '#ffffff', keyI: 1.8, rim: '#6ee7ff', rimI: 2.0 },
};
const SPELLS = {
  fire:    { color: '#ff6a2b', gravity: 1.2, swirl: 0.0, spread: 1.0, rise: 1.6 },
  water:   { color: '#3fa9ff', gravity: -3.5, swirl: 0.0, spread: 1.4, rise: 2.4 },
  wind:    { color: '#c8fff2', gravity: 0.0, swirl: 4.0, spread: 1.2, rise: 0.6 },
  stone:   { color: '#b08d5f', gravity: -6.0, swirl: 0.0, spread: 1.8, rise: 2.8 },
  healing: { color: '#7dff9a', gravity: 0.6, swirl: 1.5, spread: 0.7, rise: 1.0 },
};

export function createWorld({ bgCanvas, fgCanvas, mobile, calm }) {
  // ---------------------------------------------------------------- background
  const bgRenderer = new THREE.WebGLRenderer({ canvas: bgCanvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  const bgScale = mobile ? 0.6 : 0.8;
  bgRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25) * bgScale);
  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uW: { value: new Array(9).fill(0) }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0, 0) }, uScroll: { value: 0 },
    uSpell: { value: new THREE.Color(0, 0, 0) }, uSpellAmt: { value: 0 }, uFlash: { value: 0 },
  };
  uniforms.uW.value[0] = 1;
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms, depthTest: false, depthWrite: false })));

  // ---------------------------------------------------------------- foreground
  const renderer = new THREE.WebGLRenderer({ canvas: fgCanvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  // a soft studio environment so metal and clearcoat have something to reflect
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#5d6573');
  const panel = (c, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m); };
  panel('#ffffff', 0, 6, 2, 8, 3); panel('#9fd8ff', -6, 1, -2, 3, 6); panel('#ffd2b0', 6, 0, 3, 3, 5);
  scene.environment = pm.fromScene(envScene, 0.04).texture;

  const hemi = new THREE.HemisphereLight('#9fb8ff', '#1a1030', 0.9); scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffffff', 2); key.position.set(3, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#6ee7ff', 2); rim.position.set(-5, 3, -4); scene.add(rim);

  const robot = createRobot();
  scene.add(robot.root);

  // ---- props: each world floats a few objects around the robot; they grow in with the world
  const propGroups = {};
  const makeGroup = (name) => { const g = new THREE.Group(); g.name = 'props-' + name; scene.add(g); propGroups[name] = g; return g; };
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  // cosmic: a portal ring and two small planets
  {
    const g = makeGroup('cosmic');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.022, 12, 120), std({ color: '#0a0f1f', emissive: '#6ee7ff', emissiveIntensity: 2.2 }));
    ring.position.set(0, 1.05, -1.2); ring.userData.spin = [0, 0, 0.12]; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.008, 8, 120), std({ color: '#0a0f1f', emissive: '#8b5cf6', emissiveIntensity: 2.4 }));
    ring2.position.set(0, 1.05, -1.25); ring2.userData.spin = [0, 0, -0.08]; g.add(ring2);
    const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), phys({ color: '#8b5cf6', roughness: 0.4, clearcoat: 1 }));
    p1.position.set(-0.95, 2.0, -0.6); p1.userData.bob = 0.7; g.add(p1);
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), phys({ color: '#6ee7ff', roughness: 0.3, clearcoat: 1, emissive: '#1b6f80', emissiveIntensity: 0.6 }));
    p2.position.set(0.95, 0.3, 0.2); p2.userData.bob = 1.3; g.add(p2);
  }
  // clay: puffy pastel shapes
  {
    const g = makeGroup('clay');
    const clayMat = (c) => std({ color: c, roughness: 0.95, metalness: 0 });
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 24), clayMat('#ffd166')); a.position.set(-1.2, 1.8, -0.4); a.userData.bob = 0.9; g.add(a);
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.1, 20, 40), clayMat('#ff9f87')); b.position.set(1.15, 1.55, -0.2); b.userData.spin = [0.3, 0.5, 0]; b.userData.bob = 1.1; g.add(b);
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.28, 8, 20), clayMat('#8ecae6')); c.position.set(-1.0, 0.45, 0.3); c.rotation.z = 0.9; c.userData.bob = 1.5; g.add(c);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.15, 28, 20), clayMat('#b5e48c')); d.position.set(1.05, 2.35, -0.5); d.userData.bob = 1.8; g.add(d);
  }
  // glass: three translucent slabs with lit edges
  {
    const g = makeGroup('glass');
    for (const [x, y, z, rz, w, h] of [[-1.25, 1.45, -0.6, 0.25, 0.8, 1.1], [1.25, 1.9, -0.9, -0.2, 0.6, 0.85], [1.05, 0.5, 0.1, 0.12, 0.45, 0.6]]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), phys({ color: '#bff7ff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, emissive: '#2ad6c4', emissiveIntensity: 0.25, clearcoat: 1 }));
      slab.position.set(x, y, z); slab.rotation.set(0.1, -0.35 * Math.sign(x), rz); slab.userData.bob = 0.6 + Math.abs(x);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), new THREE.LineBasicMaterial({ color: '#6ff7e6', transparent: true, opacity: 0.8 }));
      slab.add(edge); g.add(slab);
    }
  }
  // arena: dark shards with a hot edge
  {
    const g = makeGroup('arena');
    for (const [x, y, z, s] of [[-1.3, 1.9, -0.8, 0.28], [1.25, 1.3, -0.5, 0.2], [-0.95, 0.35, 0.2, 0.14], [1.0, 2.4, -1.0, 0.16]]) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), std({ color: '#141414', roughness: 0.35, metalness: 0.6, emissive: '#ff4b1f', emissiveIntensity: 0.25, flatShading: true }));
      shard.scale.y = 1.7; shard.position.set(x, y, z); shard.userData.spin = [0.2, 0.6, 0.1]; shard.userData.bob = 0.8 + s * 3; g.add(shard);
    }
  }
  // fantasy: floating crystals
  {
    const g = makeGroup('fantasy');
    for (const [x, y, z, s, c] of [[-1.25, 1.7, -0.6, 0.2, '#b18cff'], [1.2, 2.1, -0.8, 0.16, '#ffd36b'], [1.0, 0.6, 0.2, 0.12, '#7dd8ff'], [-0.95, 2.55, -1.1, 0.1, '#ffd36b']]) {
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), phys({ color: c, roughness: 0.1, metalness: 0.1, emissive: c, emissiveIntensity: 0.8, clearcoat: 1, flatShading: true }));
      cr.scale.y = 2.0; cr.position.set(x, y, z); cr.userData.spin = [0, 0.8, 0]; cr.userData.bob = 1 + s * 4; g.add(cr);
    }
  }
  // concrete: heavy blocks
  {
    const g = makeGroup('concrete');
    const conc = std({ color: '#b8b3a9', roughness: 1, metalness: 0 });
    for (const [x, y, z, w, h, d] of [[-1.2, 0.25, -0.3, 0.5, 0.5, 0.5], [1.15, 0.2, -0.5, 0.7, 0.4, 0.4], [1.0, 2.2, -1.0, 0.35, 0.35, 0.35]]) {
      const blk = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), conc); blk.position.set(x, y, z); blk.rotation.y = 0.4 * Math.sign(x); blk.userData.bob = y > 1 ? 0.5 : 0; g.add(blk);
    }
  }
  // studio: squashed paint drops
  {
    const g = makeGroup('studio');
    for (const [x, y, z, s, c] of [[-1.2, 1.9, -0.5, 0.2, '#2547d0'], [1.2, 1.5, -0.4, 0.17, '#f5b301'], [-0.95, 0.5, 0.2, 0.12, '#e63946'], [1.05, 2.4, -0.8, 0.11, '#2a9d8f']]) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(s, 32, 24), phys({ color: c, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
      drop.scale.set(1.2, 0.85, 1); drop.position.set(x, y, z); drop.userData.bob = 1 + s * 3; drop.userData.spin = [0, 0.4, 0]; g.add(drop);
    }
  }
  Object.values(propGroups).forEach((g) => g.children.forEach((c) => { c.userData.home = c.position.clone(); c.userData.phase = Math.random() * 6.28; }));

  // ---- spell particles
  const N = mobile ? 220 : 420;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(N * 3), pVel = new Float32Array(N * 3), pLife = new Float32Array(N), pSize = new Float32Array(N);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('life', new THREE.BufferAttribute(pLife, 1));
  pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ff6a2b') }, uScale: { value: 1 } },
    vertexShader: `attribute float life; attribute float size; varying float vLife; uniform float uScale;
      void main(){ vLife = life; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale * (0.4 + life) * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vLife;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d) * vLife; gl_FragColor = vec4(uColor * (1.2 + vLife), a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
  let spell = null; let spellT = 0;

  // ---------------------------------------------------------------- state
  const st = {
    weights: { cosmic: 1 }, robotTarget: { x: 0.45, y: -0.82, h: 0.62, rot: -0.35, visible: 1 },
    robotNow: { x: 0.45, y: -0.82, h: 0.62, rot: -0.35, visible: 1 },
    mouse: new THREE.Vector2(0, 0), scrollN: 0, flash: 0, spellAmt: 0, running: true, size: [1, 1],
  };
  const tmpC = new THREE.Color();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    st.size = [w, h];
    bgRenderer.setSize(w, h, false);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    uniforms.uRes.value.set(w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  // NDC (x: -1..1, y: -1..1) on the z = 0 plane -> world coordinates
  const halfH = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  let prevX = null, travel = 0, walkPhase = 0;
  function placeRobot(dt) {
    const k = calm ? 1 : Math.min(1, dt * 3.2);
    for (const key of ['x', 'y', 'h', 'rot', 'visible']) st.robotNow[key] += (st.robotTarget[key] - st.robotNow[key]) * k;
    const r = st.robotNow;
    // when the robot travels between worlds it walks there, facing the way it goes
    const vx = prevX === null || dt <= 0 ? 0 : (r.x - prevX) / dt;
    prevX = r.x;
    const moving = calm ? 0 : Math.min(1, Math.abs(vx) * 2.2);
    travel += (moving - travel) * Math.min(1, dt * 5);
    walkPhase += Math.abs(vx) * dt * 26;
    const hh = halfH();
    const scale = Math.max(0.0001, (r.h * hh * 2) / 2.05) * Math.max(0.0001, r.visible);
    robot.root.scale.setScalar(scale);
    robot.root.position.x = r.x * hh * camera.aspect;
    robot.root.userData.baseY = r.y * hh;
    robot.root.rotation.y = r.rot * (1 - travel) + (vx >= 0 ? Math.PI / 2 : -Math.PI / 2) * travel;
    if (travel > 0.05) { robot.state.walkAmount = Math.max(robot.state.walkAmount, travel); robot.state.walk = walkPhase; }
    robot.root.visible = r.visible > 0.02;
    return scale;
  }

  function blendLights() {
    let sky = new THREE.Color(0, 0, 0), ground = new THREE.Color(0, 0, 0), kc = new THREE.Color(0, 0, 0), rc = new THREE.Color(0, 0, 0);
    let hI = 0, kI = 0, rI = 0, total = 0;
    for (const [name, w] of Object.entries(st.weights)) {
      if (w <= 0.0005) continue; const L = LIGHT[name]; total += w;
      sky.add(tmpC.set(L.sky).multiplyScalar(w)); ground.add(tmpC.set(L.ground).multiplyScalar(w));
      kc.add(tmpC.set(L.key).multiplyScalar(w)); rc.add(tmpC.set(L.rim).multiplyScalar(w));
      hI += L.hemi * w; kI += L.keyI * w; rI += L.rimI * w;
    }
    if (!total) return;
    const k = 1 / total;
    hemi.color.copy(sky.multiplyScalar(k)); hemi.groundColor.copy(ground.multiplyScalar(k)); hemi.intensity = hI * k;
    key.color.copy(kc.multiplyScalar(k)); key.intensity = kI * k;
    rim.color.copy(rc.multiplyScalar(k)); rim.intensity = rI * k;
  }

  let last = performance.now();
  function frame(now = performance.now()) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    // background
    WORLDS.forEach((name, i) => { uniforms.uW.value[i] = st.weights[name] || 0; });
    uniforms.uTime.value = calm ? 0 : t;
    uniforms.uScroll.value = st.scrollN;
    uniforms.uMouse.value.lerp(st.mouse, 0.06);
    st.flash *= Math.pow(0.0005, dt); uniforms.uFlash.value = st.flash;
    st.spellAmt *= Math.pow(0.08, dt); uniforms.uSpellAmt.value = st.spellAmt;
    bgRenderer.render(bgScene, bgCam);

    // robot
    robot.applyLook(st.weights);
    robot.state.lookAt.copy(st.mouse);
    const scale = placeRobot(dt);
    robot.update(calm ? 0 : dt);
    blendLights();

    // props follow the robot and grow in with their world
    for (const [name, g] of Object.entries(propGroups)) {
      const w = st.weights[name] || 0;
      const e = w * w * (3 - 2 * w);
      g.visible = e > 0.01 && st.robotNow.visible > 0.05;
      if (!g.visible) continue;
      g.position.set(robot.root.position.x, robot.root.userData.baseY, 0);
      g.scale.setScalar(scale * Math.max(0.0001, e));
      g.rotation.y = st.robotNow.rot * 0.4;
      g.children.forEach((c) => {
        const ud = c.userData;
        if (!calm) {
          if (ud.bob) c.position.y = ud.home.y + Math.sin(t * ud.bob + ud.phase) * 0.06;
          if (ud.spin) { c.rotation.x += ud.spin[0] * dt; c.rotation.y += ud.spin[1] * dt; c.rotation.z += ud.spin[2] * dt; }
        }
      });
    }

    // spell particles
    if (spell) {
      spellT += dt;
      const S = SPELLS[spell];
      for (let i = 0; i < N; i++) {
        if (pLife[i] <= 0) continue;
        const ix = i * 3;
        if (S.swirl) { const x = pVel[ix], z = pVel[ix + 2]; pVel[ix] = x * Math.cos(S.swirl * dt) - z * Math.sin(S.swirl * dt); pVel[ix + 2] = x * Math.sin(S.swirl * dt) + z * Math.cos(S.swirl * dt); }
        pVel[ix + 1] += S.gravity * dt;
        pPos[ix] += pVel[ix] * dt; pPos[ix + 1] += pVel[ix + 1] * dt; pPos[ix + 2] += pVel[ix + 2] * dt;
        pLife[i] = Math.max(0, pLife[i] - dt * (0.55 + (i % 7) * 0.05));
      }
      pGeo.attributes.position.needsUpdate = true; pGeo.attributes.life.needsUpdate = true;
      pMat.uniforms.uScale.value = scale;
      if (spellT > 3.5) spell = null;
    }

    renderer.render(scene, camera);
  }

  return {
    robot, st, frame, resize,
    setWeights(w) { st.weights = w; },
    setRobot(target) { Object.assign(st.robotTarget, target); },
    setMouse(x, y) { st.mouse.set(x, y); },
    setScroll(n) { st.scrollN = n; },
    flash(amount = 1) { st.flash = Math.max(st.flash, amount); },
    castSpell(name) {
      const S = SPELLS[name]; if (!S) return;
      spell = name; spellT = 0;
      pMat.uniforms.uColor.value.set(S.color);
      uniforms.uSpell.value.set(S.color); st.spellAmt = 1;
      const origin = robot.orbWorldPosition(new THREE.Vector3());
      const sc = robot.root.scale.x;
      for (let i = 0; i < N; i++) {
        const ix = i * 3;
        pPos[ix] = origin.x; pPos[ix + 1] = origin.y; pPos[ix + 2] = origin.z;
        const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, sp = (0.5 + Math.random()) * S.spread * sc;
        const r = Math.sqrt(1 - u * u);
        pVel[ix] = Math.cos(a) * r * sp; pVel[ix + 1] = (u * 0.6 + S.rise * 0.5) * sp; pVel[ix + 2] = Math.sin(a) * r * sp;
        pLife[i] = 0.6 + Math.random() * 0.4; pSize[i] = 6 + Math.random() * 10;
      }
      pGeo.attributes.size.needsUpdate = true;
      robot.state.cheer = 1; setTimeout(() => { robot.state.cheer = 0; }, 700);
    },
    // screen-space position of the robot's head, for the speech bubble
    headScreen() {
      const v = robot.headWorldPosition(new THREE.Vector3()).project(camera);
      return { x: (v.x + 1) / 2 * st.size[0], y: (1 - v.y) / 2 * st.size[1] };
    },
    // does a click at client (x, y) hit the robot?
    hitRobot(cx, cy) {
      if (!robot.root.visible) return false;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(cx / st.size[0] * 2 - 1, -(cy / st.size[1]) * 2 + 1), camera);
      return ray.intersectObject(robot.hitBox, false).length > 0;
    },
  };
}
