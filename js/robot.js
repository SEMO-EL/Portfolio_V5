// S-01: the guide robot, rebuilt in code from Simo's Ironline agents (reference: the agents on the
// Ironline main menu). Every part is a primitive; joints are groups so the robot can walk, wave,
// hop and look around. Materials blend between one "look" per world.
import * as THREE from '../vendor/three.module.min.js';

// ------------------------------------------------------------------ geometry helpers
function roundedBox(w, h, d, r = 0.02, seg = 3) {
  const iw = Math.max(w - 2 * r, 0.001);
  const ih = Math.max(h - 2 * r, 0.001);
  const rc = Math.min(r, iw / 2, ih / 2);
  const s = new THREE.Shape();
  const x = -iw / 2, y = -ih / 2;
  s.moveTo(x + rc, y);
  s.lineTo(x + iw - rc, y);
  s.quadraticCurveTo(x + iw, y, x + iw, y + rc);
  s.lineTo(x + iw, y + ih - rc);
  s.quadraticCurveTo(x + iw, y + ih, x + iw - rc, y + ih);
  s.lineTo(x + rc, y + ih);
  s.quadraticCurveTo(x, y + ih, x, y + ih - rc);
  s.lineTo(x, y + rc);
  s.quadraticCurveTo(x, y, x + rc, y);
  const depth = Math.max(d - 2 * r, 0.001);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: seg });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}
const cyl = (rt, rb, h, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
const ball = (r, w = 24, hgt = 16) => new THREE.SphereGeometry(r, w, hgt);

// ------------------------------------------------------------------ looks, one per world
// plates: one colour, or a list of 11 (chest, shoulders, upper arms, forearms, thighs, shins)
export const LOOKS = {
  cosmic:    { body: '#1c2333', bodyRough: 0.5, plates: '#e9eefb', rough: 0.22, metal: 0.35, clear: 1, trans: 0, visor: '#6ee7ff', glow: 2.4, halo: 1, orb: 0, puff: 1 },
  clay:      { body: '#6c7cab', bodyRough: 0.95, plates: ['#ffd166', '#ff9f87', '#ff9f87', '#8ecae6', '#8ecae6', '#b5e48c', '#b5e48c', '#ffb5c2', '#ffb5c2', '#8ecae6', '#8ecae6'], rough: 0.9, metal: 0, clear: 0, trans: 0, visor: '#fff3b0', glow: 0.7, halo: 0, orb: 0, puff: 1.16 },
  glass:     { body: '#0e2b3b', bodyRough: 0.35, plates: '#a8f4ff', rough: 0.06, metal: 0, clear: 1, trans: 0.92, visor: '#4dffd2', glow: 2.8, halo: 0, orb: 0, puff: 1 },
  arena:     { body: '#121212', bodyRough: 0.55, plates: '#ff4b1f', rough: 0.32, metal: 0.25, clear: 0.6, trans: 0, visor: '#ff7a2b', glow: 3.2, halo: 0, orb: 0, puff: 1 },
  fantasy:   { body: '#2a1840', bodyRough: 0.6, plates: '#d6a82e', rough: 0.28, metal: 1, clear: 0.4, trans: 0, visor: '#c39bff', glow: 2.4, halo: 0, orb: 1, puff: 1 },
  concrete:  { body: '#232323', bodyRough: 0.9, plates: '#bdb8ae', rough: 1, metal: 0, clear: 0, trans: 0, visor: '#f4f4f4', glow: 0.5, halo: 0, orb: 0, puff: 1 },
  studio:    { body: '#1d1d1f', bodyRough: 0.6, plates: ['#2547d0', '#f5b301', '#e63946', '#2a9d8f', '#ff7bac', '#2547d0', '#f5b301', '#e63946', '#2a9d8f', '#ff7bac', '#2547d0'], rough: 0.55, metal: 0, clear: 0.3, trans: 0, visor: '#ffffff', glow: 1.2, halo: 0, orb: 0, puff: 1.04 },
  editorial: { body: '#202124', bodyRough: 0.6, plates: '#ece6d8', rough: 0.4, metal: 0.1, clear: 0.5, trans: 0, visor: '#6ee7ff', glow: 1.4, halo: 0, orb: 0, puff: 1 },
  field:     { body: '#111a2e', bodyRough: 0.5, plates: ['#2dd4bf', '#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0', '#fbbf24', '#fbbf24', '#e2e8f0', '#e2e8f0', '#2dd4bf', '#2dd4bf'], rough: 0.38, metal: 0.05, clear: 0.7, trans: 0, visor: '#2dd4bf', glow: 2.6, halo: 0, orb: 0, puff: 1 },
};
const PLATE_COUNT = 11;
const toColor = (hex) => new THREE.Color(hex);
// pre-convert looks to Color objects once
const LOOK_C = {};
for (const [k, l] of Object.entries(LOOKS)) {
  LOOK_C[k] = {
    ...l,
    body: toColor(l.body),
    visor: toColor(l.visor),
    plates: Array.isArray(l.plates) ? l.plates.map(toColor) : Array.from({ length: PLATE_COUNT }, () => toColor(l.plates)),
  };
}

// ------------------------------------------------------------------ the factory
export function createRobot() {
  const root = new THREE.Group();
  root.name = 'S-01';

  const bodyMat = new THREE.MeshStandardMaterial({ color: '#1c2333', roughness: 0.5, metalness: 0.4 });
  const jointMat = new THREE.MeshStandardMaterial({ color: '#0b0d12', roughness: 0.6, metalness: 0.5 });
  const visorMat = new THREE.MeshStandardMaterial({ color: '#05080c', emissive: '#6ee7ff', emissiveIntensity: 2.4, roughness: 0.2, side: THREE.DoubleSide });
  const emblemMat = new THREE.MeshStandardMaterial({ color: '#05080c', emissive: '#6ee7ff', emissiveIntensity: 2.2, roughness: 0.3 });
  const plateMats = Array.from({ length: PLATE_COUNT }, () => new THREE.MeshPhysicalMaterial({ color: '#e9eefb', roughness: 0.22, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2, thickness: 0.35, ior: 1.45 }));
  const haloMat = new THREE.MeshStandardMaterial({ color: '#05080c', emissive: '#6ee7ff', emissiveIntensity: 2.4, transparent: true, opacity: 1 });
  const orbMat = new THREE.MeshStandardMaterial({ color: '#3b1f63', emissive: '#a77bff', emissiveIntensity: 1.3, roughness: 0.2, transparent: true, opacity: 1 });

  const plates = []; // { mesh, baseScale }
  const mesh = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = false; return m; };
  const plate = (geo, i, name) => { const m = mesh(geo, plateMats[i], name); plates.push(m); return m; };

  // ---- hips and pelvis (root of the upper body and the legs)
  const hips = new THREE.Group(); hips.name = 'hips'; hips.position.y = 0.98; root.add(hips);
  const pelvis = mesh(roundedBox(0.36, 0.13, 0.21, 0.04), bodyMat, 'pelvis'); hips.add(pelvis);
  const belt = mesh(roundedBox(0.38, 0.05, 0.23, 0.02), jointMat, 'belt'); belt.position.y = 0.065; hips.add(belt);
  const buckle = mesh(roundedBox(0.07, 0.045, 0.02, 0.008), emblemMat, 'buckle'); buckle.position.set(0, 0.065, 0.12); hips.add(buckle);

  // ---- torso
  const torso = new THREE.Group(); torso.name = 'torso'; torso.position.y = 0.05; hips.add(torso);
  const chest = mesh(roundedBox(0.44, 0.46, 0.26, 0.07), bodyMat, 'chest'); chest.position.y = 0.3; torso.add(chest);
  const chestPlate = plate(roundedBox(0.3, 0.26, 0.05, 0.03), 0, 'chestPlate'); chestPlate.position.set(0, 0.36, 0.13); torso.add(chestPlate);
  const emblem = mesh(roundedBox(0.035, 0.14, 0.02, 0.012), emblemMat, 'emblem'); emblem.position.set(0, 0.36, 0.16); torso.add(emblem);
  const abs = mesh(roundedBox(0.3, 0.09, 0.22, 0.04), jointMat, 'abs'); abs.position.y = 0.09; torso.add(abs);
  const neck = mesh(cyl(0.055, 0.065, 0.1), jointMat, 'neck'); neck.position.y = 0.57; torso.add(neck);

  // ---- head
  const head = new THREE.Group(); head.name = 'head'; head.position.y = 0.6; torso.add(head);
  const skull = mesh(ball(0.17, 32, 24), bodyMat, 'skull'); skull.position.y = 0.17; head.add(skull);
  const visor = mesh(new THREE.CylinderGeometry(0.173, 0.173, 0.055, 40, 1, true, -0.95, 1.9), visorMat, 'visor'); visor.position.y = 0.18; head.add(visor);
  for (const sx of [-1, 1]) {
    const ear = mesh(cyl(0.035, 0.035, 0.05, 16), jointMat, sx < 0 ? 'earR' : 'earL'); ear.rotation.z = Math.PI / 2; ear.position.set(sx * 0.175, 0.17, 0); head.add(ear);
  }
  const antenna = mesh(cyl(0.008, 0.008, 0.09, 6), jointMat, 'antenna'); antenna.position.set(0.07, 0.35, -0.03); antenna.rotation.z = -0.25; head.add(antenna);
  const antennaTip = mesh(ball(0.018, 10, 8), emblemMat, 'antennaTip'); antennaTip.position.set(0.082, 0.395, -0.03); head.add(antennaTip);
  const halo = mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 48), haloMat, 'halo'); halo.rotation.x = Math.PI / 2; halo.position.y = 0.43; head.add(halo);

  // ---- arms
  const arms = {};
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const shoulder = new THREE.Group(); shoulder.name = 'shoulder' + side; shoulder.position.set(sx * 0.3, 0.47, 0); shoulder.rotation.z = sx * 0.09; torso.add(shoulder);
    const pad = plate(ball(0.11, 24, 16), side === 'L' ? 1 : 2, 'pad' + side); pad.scale.set(1, 0.9, 1); shoulder.add(pad);
    const upper = mesh(cyl(0.038, 0.034, 0.3), bodyMat, 'upperArm' + side); upper.position.y = -0.2; shoulder.add(upper);
    const upperPlate = plate(roundedBox(0.09, 0.15, 0.09, 0.025), side === 'L' ? 3 : 4, 'upperPlate' + side); upperPlate.position.y = -0.18; shoulder.add(upperPlate);
    const elbow = new THREE.Group(); elbow.name = 'elbow' + side; elbow.position.y = -0.36; shoulder.add(elbow);
    elbow.add(mesh(ball(0.045, 16, 12), jointMat, 'elbowJoint' + side));
    const fore = mesh(cyl(0.034, 0.03, 0.27), bodyMat, 'forearm' + side); fore.position.y = -0.15; elbow.add(fore);
    const forePlate = plate(roundedBox(0.085, 0.14, 0.085, 0.024), side === 'L' ? 5 : 6, 'forePlate' + side); forePlate.position.y = -0.13; elbow.add(forePlate);
    const hand = mesh(roundedBox(0.07, 0.085, 0.05, 0.02), jointMat, 'hand' + side); hand.position.y = -0.32; elbow.add(hand);
    arms[side] = { shoulder, elbow, hand };
  }

  // ---- legs
  const legs = {};
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const hip = new THREE.Group(); hip.name = 'hip' + side; hip.position.set(sx * 0.105, -0.04, 0); hips.add(hip);
    const thigh = mesh(cyl(0.05, 0.044, 0.38), bodyMat, 'thigh' + side); thigh.position.y = -0.2; hip.add(thigh);
    const thighPlate = plate(roundedBox(0.115, 0.22, 0.11, 0.03), side === 'L' ? 7 : 8, 'thighPlate' + side); thighPlate.position.set(0, -0.17, 0.01); hip.add(thighPlate);
    const knee = new THREE.Group(); knee.name = 'knee' + side; knee.position.y = -0.42; hip.add(knee);
    knee.add(mesh(ball(0.058, 16, 12), jointMat, 'kneeJoint' + side));
    const shin = mesh(cyl(0.042, 0.036, 0.4), bodyMat, 'shin' + side); shin.position.y = -0.22; knee.add(shin);
    const shinPlate = plate(roundedBox(0.105, 0.25, 0.1, 0.03), side === 'L' ? 9 : 10, 'shinPlate' + side); shinPlate.position.set(0, -0.2, 0.012); knee.add(shinPlate);
    const boot = mesh(roundedBox(0.15, 0.11, 0.27, 0.035), jointMat, 'boot' + side); boot.position.set(0, -0.48, 0.04); knee.add(boot);
    legs[side] = { hip, knee };
  }

  // ---- the orb (fantasy): floats beside the right hand
  const orb = mesh(ball(0.08, 24, 16), orbMat, 'orb'); orb.position.set(-0.42, 1.12, 0.18); root.add(orb);
  const orbLight = new THREE.PointLight('#c39bff', 0, 2.5); orb.add(orbLight);

  // invisible hit box for clicks
  const hitBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.05, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  hitBox.position.y = 1.02; hitBox.name = 'hit'; root.add(hitBox);

  plates.forEach((p) => { p.userData.base = p.scale.clone(); });

  // ------------------------------------------------------------------ state + animation
  const state = {
    look: 'cosmic', t: 0,
    lookAt: new THREE.Vector2(0, 0), headYaw: 0, headPitch: 0,
    walk: 0, walkAmount: 0, hop: 0, hopV: 0, grounded: true,
    wave: 0, waveTime: 0, cheer: 0, duck: 0, duckT: 0,
  };

  const tmpC = new THREE.Color();
  // weights: { lookName: weight } summing to about 1
  function applyLook(weights) {
    let body = new THREE.Color(0, 0, 0), visorC = new THREE.Color(0, 0, 0);
    const platesC = Array.from({ length: PLATE_COUNT }, () => new THREE.Color(0, 0, 0));
    let bodyRough = 0, rough = 0, metal = 0, clear = 0, trans = 0, glow = 0, haloW = 0, orbW = 0, puff = 0, total = 0;
    for (const [name, w] of Object.entries(weights)) {
      if (w <= 0.0005) continue;
      const L = LOOK_C[name]; if (!L) continue;
      total += w;
      body.add(tmpC.copy(L.body).multiplyScalar(w));
      visorC.add(tmpC.copy(L.visor).multiplyScalar(w));
      L.plates.forEach((c, i) => platesC[i].add(tmpC.copy(c).multiplyScalar(w)));
      bodyRough += L.bodyRough * w; rough += L.rough * w; metal += L.metal * w; clear += L.clear * w;
      trans += L.trans * w; glow += L.glow * w; haloW += L.halo * w; orbW += L.orb * w; puff += L.puff * w;
    }
    if (total <= 0) return;
    const k = 1 / total;
    bodyMat.color.copy(body.multiplyScalar(k)); bodyMat.roughness = bodyRough * k;
    const vis = visorC.multiplyScalar(k);
    visorMat.emissive.copy(vis); visorMat.emissiveIntensity = glow * k;
    emblemMat.emissive.copy(vis); emblemMat.emissiveIntensity = glow * k * 0.9;
    haloMat.emissive.copy(vis); haloMat.opacity = Math.min(1, haloW * k); halo.visible = haloW * k > 0.02; halo.scale.setScalar(0.6 + 0.4 * Math.min(1, haloW * k));
    orbMat.opacity = Math.min(1, orbW * k); orb.visible = orbW * k > 0.02; orb.scale.setScalar(Math.max(0.001, orbW * k)); orbLight.intensity = 4 * orbW * k;
    plateMats.forEach((m, i) => {
      m.color.copy(platesC[i].multiplyScalar(k));
      m.roughness = rough * k; m.metalness = metal * k; m.clearcoat = clear * k; m.transmission = 0;
      // glass: no refraction pass (nothing behind it to refract on a transparent canvas); a lit,
      // see-through plate reads better and costs nothing
      const tr = trans * k;
      m.transparent = tr > 0.01; m.opacity = 1 - 0.55 * tr; m.depthWrite = tr < 0.5;
      m.emissive.copy(m.color).multiplyScalar(0.45 * tr);
    });
    const p = puff * k;
    plates.forEach((pl) => pl.scale.copy(pl.userData.base).multiplyScalar(p));
  }

  function update(dt) {
    state.t += dt;
    const t = state.t;
    // look toward the pointer (eased)
    const targetYaw = THREE.MathUtils.clamp(state.lookAt.x * 0.7, -0.75, 0.75);
    const targetPitch = THREE.MathUtils.clamp(-state.lookAt.y * 0.35, -0.3, 0.35);
    state.headYaw += (targetYaw - state.headYaw) * Math.min(1, dt * 6);
    state.headPitch += (targetPitch - state.headPitch) * Math.min(1, dt * 6);
    head.rotation.y = state.headYaw;
    head.rotation.x = state.headPitch;
    torso.rotation.y = state.headYaw * 0.25;

    // walk cycle, driven from outside through state.walk (phase) and state.walkAmount (0..1)
    const a = state.walkAmount;
    const ph = state.walk;
    const swing = Math.sin(ph) * 0.55 * a;
    legs.L.hip.rotation.x = swing;
    legs.R.hip.rotation.x = -swing;
    legs.L.knee.rotation.x = Math.max(0, -Math.sin(ph - 0.8)) * 0.8 * a;
    legs.R.knee.rotation.x = Math.max(0, Math.sin(ph - 0.8)) * 0.8 * a;
    const armSwing = -swing * 0.7;

    // idle: breathe and sway
    const breathe = Math.sin(t * 1.6) * 0.012;
    hips.position.y = 0.98 + breathe + Math.abs(Math.sin(ph)) * 0.035 * a;
    // duck: a quick crouch (fired at from the Ironline screen)
    state.duckT = Math.max(0, state.duckT - dt);
    state.duck += ((state.duckT > 0 ? 1 : 0) - state.duck) * Math.min(1, dt * 16);
    if (state.duck > 0.001) {
      const d = state.duck;
      hips.position.y -= 0.17 * d;
      legs.L.hip.rotation.x -= 0.55 * d; legs.R.hip.rotation.x -= 0.55 * d;
      legs.L.knee.rotation.x += 1.0 * d; legs.R.knee.rotation.x += 1.0 * d;
      torso.rotation.x = 0.28 * d;
    } else torso.rotation.x = 0;
    torso.rotation.z = Math.sin(t * 0.8) * 0.015;

    // wave: raise the right arm, wiggle the forearm
    if (state.waveTime > 0) { state.waveTime = Math.max(0, state.waveTime - dt); }
    const waveTarget = state.waveTime > 0 ? 1 : 0;
    state.wave += (waveTarget - state.wave) * Math.min(1, dt * 7);
    const w = state.wave;
    arms.R.shoulder.rotation.x = armSwing * (1 - w) - w * 0.25;
    arms.R.shoulder.rotation.z = -0.09 - w * 2.55;
    arms.R.elbow.rotation.z = -w * (0.35 + Math.sin(t * 11) * 0.35);
    arms.R.elbow.rotation.x = 0;
    arms.L.shoulder.rotation.x = -armSwing;
    arms.L.shoulder.rotation.z = 0.09 + state.cheer * 2.4;
    arms.L.elbow.rotation.x = -0.12 - a * 0.25;

    // hop: simple ballistic arc
    if (!state.grounded) {
      state.hopV -= 9.8 * dt;
      state.hop += state.hopV * dt;
      if (state.hop <= 0) { state.hop = 0; state.hopV = 0; state.grounded = true; }
    }
    root.position.y = root.userData.baseY + state.hop * root.scale.y;

    // orb floats and orbits a little
    orb.position.set(-0.45 + Math.sin(t * 1.3) * 0.05, 1.15 + Math.sin(t * 2.1) * 0.06, 0.2 + Math.cos(t * 1.3) * 0.05);
    halo.rotation.z = t * 0.6;
  }

  root.userData.baseY = 0;
  return {
    root, hitBox, head, orb, state, applyLook, update,
    wave(seconds = 1.8) { state.waveTime = seconds; },
    duck(seconds = 0.28) { state.duckT = seconds; },
    hop(v = 3.2) { if (state.grounded) { state.grounded = false; state.hopV = v; } },
    headWorldPosition(target = new THREE.Vector3()) { return skull.getWorldPosition(target); },
    handWorldPosition(target = new THREE.Vector3()) { return arms.R.hand.getWorldPosition(target); },
    orbWorldPosition(target = new THREE.Vector3()) { return orb.getWorldPosition(target); },
  };
}
