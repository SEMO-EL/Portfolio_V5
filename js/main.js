/* ==========================================================================
   Simo, portfolio v5: the conductor.
   Scroll position decides which world you are in (and how much of the next one is
   bleeding in); the world engine paints it and moves S-01; each chapter adds its own toy.
   Without WebGL or JavaScript the page still reads top to bottom.
   ========================================================================== */
import { createWorld } from './world.js';
import { createSound } from './sound.js';
import { initPlanner } from './planner.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const root = document.documentElement;
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const phoneQ = window.matchMedia('(max-width: 760px)');
const hoverQ = window.matchMedia('(hover: hover) and (pointer: fine)');
const { gsap, ScrollTrigger, Lenis } = window;
const hasGsap = !!(gsap && ScrollTrigger);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------------ world engine */
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
let world = null;
if (webglOK()) {
  try {
    world = createWorld({ bgCanvas: $('#bg'), fgCanvas: $('#fg'), mobile: phoneQ.matches, calm });
    root.classList.add('webgl');
  } catch (err) { console.warn('WebGL world disabled:', err); }
}

/* ------------------------------------------------------------------ boot screen: S-01 powers up */
// Built by script, so without JavaScript nothing ever covers the page.
const boot = document.createElement('div');
boot.className = 'boot';
boot.setAttribute('aria-hidden', 'true');
boot.innerHTML = '<div class="boot-ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" stroke-width="3"/><path d="M41.5 21.5a10 10 0 1 0-9.5 10.5a10 10 0 1 1-9.5 10.5" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg></div><p class="boot-title">S-01 booting</p><ol class="boot-log"></ol><div class="boot-bar"><i></i></div>';
if (world && !calm) document.body.appendChild(boot);
const bootLog = boot.querySelector('.boot-log');
const bootLines = ['Loading eight worlds', 'Polishing armour plates', 'Calibrating visor', 'Finding Casablanca', 'Ready'];
let bootStep = 0;
const bootTick = setInterval(() => {
  if (bootStep >= bootLines.length) return;
  const li = document.createElement('li'); li.textContent = bootLines[bootStep++]; bootLog.appendChild(li);
  boot.style.setProperty('--p', String(bootStep / bootLines.length));
}, calm ? 40 : 190);
let booted = false;
function finishBoot() {
  if (booted) return; booted = true;
  clearInterval(bootTick);
  boot.style.setProperty('--p', '1');
  boot.classList.add('done');
  setTimeout(() => boot.remove(), calm ? 0 : 900);
}
Promise.race([
  Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, calm ? 150 : 1050))]),
  new Promise((r) => setTimeout(r, 4500)),
]).then(finishBoot);

/* ------------------------------------------------------------------ sound (off until asked) */
const sound = createSound();
const soundBtn = $('#soundBtn');
soundBtn?.addEventListener('click', () => {
  const on = sound.toggle();
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.querySelector('.hud-sound-label').textContent = on ? 'Sound on' : 'Sound off';
  if (on) sound.fx('beep');
});

/* ------------------------------------------------------------------ smooth scroll */
let lenis = null;
if (hasGsap) gsap.registerPlugin(ScrollTrigger);
if (hasGsap && Lenis && !calm) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollToEl(el) {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
  else el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || a.hasAttribute('data-open')) return;
  const id = a.getAttribute('href').slice(1);
  if (!id || id.includes('/')) return;
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  closeMap();
  const sheet = openSheet();                    // a link inside a dossier closes it first, then travels
  if (sheet) closeProject(sheet, { restoreFocus: false });
  scrollToEl(el);
  history.replaceState(null, '', '#' + id);
});

/* ------------------------------------------------------------------ chapters */
const CHAPTERS = {
  start: { label: 'Deep space', accent: '#6ee7ff', light: false, line: 'Hi! I’m S-01. Simo built my body for Ironline. Click me any time.' },
  origins: { label: 'Clay', accent: '#ff7a59', light: true, line: 'This is where it started. Watch your step.' },
  simoai: { label: 'Glass lab', accent: '#28ffd2', light: false, line: 'Six models, one 16 GB card. We take turns.' },
  ironline: { label: 'Night arena', accent: '#ff4b1f', light: false, line: 'The rules run 128 times a second. I counted.' },
  mana: { label: 'Twilight valley', accent: '#ffd36b', light: false, line: 'Pick a rune and I’ll cast it.' },
  roboroute: { label: 'Game table', accent: '#2dd4bf', light: false, line: 'Robot games. This is my kind of table.' },
  shipped: { label: 'Concrete', accent: '#dd614c', light: true, line: 'Everything here is live. Go and click something.' },
  studio: { label: 'Paper and ink', accent: '#2547d0', light: true, line: 'Every frame of those films was drawn by code.' },
  method: { label: 'Editorial', accent: '#e9e4d8', light: false, line: '' },
  contact: { label: 'Back to space', accent: '#6ee7ff', light: false, line: 'Say hi to Simo for me.' },
};
const LINES = { "start": [ "Hi! I’m S-01. Simo built my body for Ironline. Click me any time.", "Scroll down. I’ll walk.", "I have a halo here. Only here.", "Eight worlds. I’ve been to all of them." ], "origins": [ "This is where it started. Watch your step.", "Hit the blocks. They pay out.", "A Mario-style platformer in 2020. Very brave.", "Panama, then Houston. Not bad for a robot kid." ], "simoai": [ "Six models, one 16 GB card. We take turns.", "Pick a request. Watch it plan.", "The kitten was made on Simo’s GPU. No cloud.", "I asked for a circle once. Long story." ], "ironline": [ "The rules run 128 times a second. I counted.", "Shoot the bots, not me.", "Every rule here has a test. 290 of them.", "Aim for the visor." ], "mana": [ "Pick a rune and I’ll cast it.", "Three chapters so far. I’m in none of them.", "The Demon Continent is very red.", "Fire is the classic. Try healing." ], "roboroute": [ "Robot games. This is my kind of table.", "Pick a mission. Watch the search spread.", "A* heads for the goal. Dijkstra looks everywhere.", "The real one runs Python inside your browser tab.", "I’m about 14 centimetres too tall for this table." ], "shipped": [ "Everything here is live. Go and click something.", "Two colourways sold out. True story.", "Built in a day. Some of them.", "Concrete suits me." ], "studio": [ "Every frame of those films was drawn by code.", "Click the paper. Make a mess.", "The PoseSandbox film has a voice. Turn it on.", "I get a new paint job here." ], "method": [ "Read this one slowly." ], "contact": [ "Say hi to Simo for me.", "The email button works. I checked.", "Thanks for walking with me.", "Want to go again? Scroll up." ] };
const lineAt = {};
function nextLine(id) { const L = LINES[id] || LINES.start; const i = (lineAt[id] = ((lineAt[id] ?? -1) + 1) % L.length); return L[i]; }
const parsePose = (s) => { const [x, y, h, rot] = (s || '0,-2,0.3,0').split(',').map(Number); return { x, y, h, rot }; };
const sections = $$('[data-world]').map((el) => ({
  el, id: el.id, world: el.dataset.world,
  pose: parsePose(el.dataset.robot), poseM: parsePose(el.dataset.robotM || el.dataset.robot),
}));
const railLinks = Object.fromEntries($$('[data-rail]').map((a) => [a.dataset.rail, a]));
const worldName = $('#worldName');
let current = null;

function blendNow() {
  const vh = window.innerHeight;
  const c = vh * 0.5;
  let i = sections.findIndex((s) => { const r = s.el.getBoundingClientRect(); return r.top <= c && r.bottom > c; });
  if (i < 0) i = sections[0].el.getBoundingClientRect().top > c ? 0 : sections.length - 1;
  const cur = sections[i];
  const next = sections[i + 1];
  const r = cur.el.getBoundingClientRect();
  const zone = Math.min(vh * 0.55, r.height * 0.4);
  const b = next ? smooth(zone, 0, r.bottom - c) : 0;
  const weights = {};
  weights[cur.world] = (weights[cur.world] || 0) + (1 - b);
  if (next && b > 0) weights[next.world] = (weights[next.world] || 0) + b;
  const phone = phoneQ.matches;
  const pa = phone ? cur.poseM : cur.pose;
  const pb = next ? (phone ? next.poseM : next.pose) : pa;
  const lerp = (k) => pa[k] + (pb[k] - pa[k]) * b;
  return { cur, b, weights, pose: { x: lerp('x'), y: lerp('y'), h: lerp('h'), rot: lerp('rot') } };
}

function setChapter(sec) {
  if (current === sec.id) return;
  current = sec.id;
  const ch = CHAPTERS[sec.id] || CHAPTERS.start;
  worldName.textContent = ch.label;
  root.dataset.hud = ch.light ? 'light' : 'dark';
  root.style.setProperty('--hud-accent', ch.accent);
  Object.entries(railLinks).forEach(([id, a]) => a.setAttribute('aria-current', String(id === sec.id)));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ch.light ? '#e8e4dc' : '#05060f');
}

/* ------------------------------------------------------------------ pointer + robot chat */
const pointer = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  world?.setMouse(pointer.x, pointer.y);
}, { passive: true });

const bubble = $('#bubble');
let bubbleTimer = 0;
function say(text, ms = 3400) {
  if (!world || !text) return;
  bubble.textContent = text;
  bubble.hidden = false;
  placeBubble();
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => { bubble.hidden = true; }, ms);
}
function placeBubble() {
  if (bubble.hidden || !world) return;
  const p = world.headScreen();
  const w = bubble.offsetWidth, h = bubble.offsetHeight;
  const x = Math.min(window.innerWidth - w - 12, Math.max(12, p.x + 26));
  const y = Math.min(window.innerHeight - h - 12, Math.max(70, p.y - h - 30));
  bubble.style.transform = `translate(${x}px, ${y}px)`;
  bubble.style.setProperty('--bx', `${x}px`);
  bubble.style.setProperty('--by', `${y}px`);
}
const INTERACTIVE = 'a, button, input, select, textarea, iframe, video, dialog, .screen, .slice, .rune, .station, [data-open], .ev-card, .glass-panel, .field-panel';
document.addEventListener('click', (e) => {
  if (!world || e.target.closest(INTERACTIVE)) return;
  if (world.hitRobot(e.clientX, e.clientY)) {
    world.robot.wave(1.8);
    world.robot.hop(2.6);
    sound.fx('beep');
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const i = sections.findIndex((s) => s.id === current);
    const next = sections[i + 1];
    if (coarse && next) {
      say('Next stop: ' + (CHAPTERS[next.id] || CHAPTERS.start).label + '!', 1800);
      setTimeout(() => scrollToEl(next.el), 650);
    } else say(nextLine(current));
  }
});

/* ------------------------------------------------------------------ the frame loop */
const clay = { progress: 0, velocity: 0, walk: 0, active: false, lastX: null };
function tick() {
  if (document.hidden || !world) return;
  const { cur, weights, pose } = blendNow();
  setChapter(cur);
  world.setWeights(weights);
  sound.setWeights(weights);
  world.setRobot({ ...pose, visible: 1 });
  world.setScroll(window.scrollY / window.innerHeight);
  // walking: in the clay chapter the walk follows the horizontal scroll; elsewhere it eases out
  const r = world.robot.state;
  const target = clay.active ? Math.min(1, Math.abs(clay.velocity) / 250) : 0;
  r.walkAmount += (target - r.walkAmount) * 0.12;
  if (clay.active) r.walk = clay.progress * 46;
  world.frame();
  placeBubble();
}
if (hasGsap) gsap.ticker.add(tick);
else { const loop = () => { tick(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }

if (world) {
  // a hello on arrival
  setTimeout(() => { if (window.scrollY < window.innerHeight * 0.4) { world.robot.wave(2); say(CHAPTERS.start.line, 4200); } }, calm ? 300 : 1400);
}

/* ------------------------------------------------------------------ entrances */
if (hasGsap && !calm) {
  gsap.from('.giant-in', { yPercent: 40, opacity: 0, duration: 1.6, ease: 'expo.out', delay: 0.15 });
  gsap.from('.start-copy > *', { y: 36, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12, delay: 0.45 });
  // each chapter's parts arrive in reading order
  const reveal = (sel, opts = {}) => $$(sel).forEach((el) => gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true }, ...opts }));
  reveal('.glass-head > *, .router, .g-shot, .gpu, .bugs-title');
  reveal('.fantasy-head > *, .runes, .scroll-frame');
  reveal('.field-head > *, .planner, .field-step, .field-film > *');
  reveal('.brutal-lead, .slices', { y: 60 });
  reveal('.studio-title, .studio-lead, .sia-film, .sia-text, .print, .machine > *');
  reveal('.ev-card');
  reveal('.arena-more > *');
  reveal('.contact-copy > *');
  gsap.from('.brutal-title', { xPercent: -12, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.brutal-title', start: 'top 85%', once: true } });
  gsap.from('.portal', { scale: 0.6, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.contact', start: 'top 70%', once: true } });
}

/* ------------------------------------------------------------------ ORIGINS: clay platformer */
const clayTrack = $('#clayTrack');
const stations = $$('.station', clayTrack);
if (hasGsap) {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
    const distance = () => Math.max(0, clayTrack.scrollWidth - window.innerWidth);
    const tween = gsap.to(clayTrack, {
      x: () => -distance(), ease: 'none',
      scrollTrigger: {
        trigger: '#clayPin', pin: true, start: 'top top', end: () => '+=' + distance(), scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (self) => { clay.progress = self.progress; clay.velocity = self.getVelocity(); },
        onToggle: (self) => { clay.active = self.isActive; if (!self.isActive) clay.velocity = 0; },
      },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); clay.active = false; };
  });
}
// the robot hops when a station passes under it
let lastStationX = null;
if (world) {
  gsap?.ticker.add(() => {
    if (!clay.active) { lastStationX = null; return; }
    const rx = (world.st.robotNow.x + 1) / 2 * window.innerWidth;
    const xs = stations.map((s) => { const r = s.getBoundingClientRect(); return r.left + r.width / 2; });
    if (lastStationX) xs.forEach((x, i) => { if ((lastStationX[i] - rx) * (x - rx) < 0) world.robot.hop(2.4); });
    lastStationX = xs;
  });
}
$$('.block').forEach((block) => block.addEventListener('click', () => {
  block.classList.remove('bump'); void block.offsetWidth; block.classList.add('bump');
  const coin = document.createElement('span');
  coin.className = 'coin'; coin.textContent = '+1'; coin.setAttribute('aria-hidden', 'true');
  block.parentElement.appendChild(coin);
  setTimeout(() => coin.remove(), 950);
  world?.robot.hop(3);
  sound.fx('coin');
}));

/* ------------------------------------------------------------------ SIMOAI: watch it plan */
const LANES = { chat: 'Chat', code: 'Code', vision: 'Vision', docs: 'PDF reader', render: 'Exact renderer', video: 'Video', image: 'Image' };
const REQUESTS = {
  circle: {
    prompt: 'Explain the area of a circle, draw a blue circle with the formula, and animate a dot growing into a circle.',
    tasks: [['chat', 'Qwen3 14B', 'Write the explanation first'], ['render', 'Exact renderer', 'Draw the blue circle with A = πr²'], ['render', 'Exact renderer', 'Animate the dot growing into a circle']],
    note: 'A real run after the fix: 48 seconds, all three outputs. Before the fix this request produced an office scene.',
  },
  pdf: {
    prompt: 'Read this scanned PDF and tell me what page 3 says.',
    tasks: [['docs', 'PDF reader', 'No selectable text, so render the first five pages as images'], ['vision', 'Gemma 3 12B', 'Read the rendered page 3'], ['chat', 'Qwen3 14B', 'Answer in plain words']],
    note: 'How SimoAI routes a scanned PDF: text PDFs are read directly, up to 50 pages.',
  },
  code: {
    prompt: 'Write a debounce function in JavaScript.',
    tasks: [['code', 'Qwen3-Coder 30B', 'Write the function (split between the GPU and system RAM)'], ['chat', 'Qwen3 14B', 'Explain how to use it']],
    note: 'Debounce was one of the coder’s weak spots on the hidden-test benchmark, so this one gets a test before I trust it.',
  },
  video: {
    prompt: 'Turn this kitten picture into a short video.',
    tasks: [['video', 'Wan 2.2', 'Image to video, about two seconds by default']],
    note: 'The kitten clip in the glass panel below was made exactly this way, on my RTX 5060 Ti.',
  },
};
let routerToken = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, calm ? 0 : ms));
$$('.chip').forEach((chip) => chip.addEventListener('click', async () => {
  const req = REQUESTS[chip.dataset.req];
  if (!req) return;
  const token = ++routerToken;
  $$('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
  const input = $('#routerInput'), plan = $('#routerPlan'), lanes = $('#routerLanes'), note = $('#routerNote');
  lanes.innerHTML = ''; plan.textContent = ''; note.textContent = '';
  const caret = '<span class="router-caret"></span>';
  input.innerHTML = caret;
  for (let i = 1; i <= req.prompt.length; i += calm ? req.prompt.length : 2) {
    if (token !== routerToken) return;
    input.innerHTML = caret + req.prompt.slice(0, i).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    await wait(14);
  }
  input.innerHTML = caret + req.prompt.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  await wait(300); if (token !== routerToken) return;
  plan.textContent = `Qwen3 14B plans ${req.tasks.length} task${req.tasks.length > 1 ? 's' : ''}…`;
  world?.robot.hop(2.2);
  for (const [lane, model, job] of req.tasks) {
    await wait(420); if (token !== routerToken) return;
    const li = document.createElement('li');
    li.className = 'lane';
    li.innerHTML = `<div><b>${LANES[lane]}</b><small>${model}</small></div><p class="lane-job">${job}</p><div class="lane-bar"><i></i></div>`;
    lanes.appendChild(li);
    if (hasGsap && !calm) gsap.from(li, { x: -30, opacity: 0, duration: 0.6, ease: 'expo.out' });
    requestAnimationFrame(() => li.classList.add('go'));
  }
  await wait(700); if (token !== routerToken) return;
  note.textContent = req.note;
}));

// stacked bug cards: earlier ones settle back as the next arrives
if (hasGsap) {
  gsap.matchMedia().add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
    const bugs = $$('.bug');
    const tweens = bugs.slice(0, -1).map((bug, i) => gsap.to(bug, { scale: 0.94, opacity: 0.55, ease: 'none', scrollTrigger: { trigger: bugs[i + 1], start: 'top 85%', end: 'top 25%', scrub: true } }));
    return () => tweens.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); });
  });
}

/* ------------------------------------------------------------------ IRONLINE: cinematic frames + crosshair */
const screen = $('#arenaScreen');
const shots = $$('.shot', screen);
const subtitle = $('#arenaSub');
let shotIndex = 0;
function showShot(i, zoom = 1) {
  if (i !== shotIndex) {
    shots.forEach((s, k) => s.classList.toggle('is-on', k === i));
    shotIndex = i;
    subtitle.textContent = shots[i].dataset.sub;
    const img = shots[i].querySelector('img');
    if (img && img.loading === 'lazy') img.loading = 'eager';
  }
  shots[i].style.setProperty('--z', zoom.toFixed(3));
}
if (hasGsap) {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const st = ScrollTrigger.create({
      trigger: '#arenaPin', pin: true, start: 'top top', end: '+=260%', scrub: true, anticipatePin: 1,
      onUpdate: (self) => {
        const p = self.progress * shots.length;
        const i = Math.min(shots.length - 1, Math.floor(p));
        showShot(i, 1.14 - (p - i) * 0.14);
      },
    });
    const bars = gsap.to('.letterbox', { scaleY: 1, ease: 'power2.out', scrollTrigger: { trigger: '#ironline', start: 'top 70%', end: 'top top', scrub: true } });
    return () => { st.kill(); bars.scrollTrigger?.kill(); bars.kill(); };
  });
}
let hits = 0, score = 0, landed = 0, combo = 0, lastHit = 0;
const crosshair = $('#crosshair');
const targets = new Set();
let rangeTimer = 0;
function spawnTarget() {
  if (!screen || document.hidden || targets.size >= 3) return;
  const t = document.createElement('div');
  t.className = 'target';
  // a free spot, away from the bots already up
  let x = 50, y = 50;
  for (let k = 0; k < 10; k++) {
    x = 12 + Math.random() * 76; y = 22 + Math.random() * 52;
    if (![...targets].every((o) => Math.abs(parseFloat(o.style.left) - x) > 20 || Math.abs(parseFloat(o.style.top) - y) > 26)) continue;
    break;
  }
  t.style.left = x + '%'; t.style.top = y + '%';
  t.style.setProperty('--ts', (0.8 + Math.random() * 0.5).toFixed(2));
  t.innerHTML = '<span class="t-head"><span class="t-visor"></span></span>';
  screen.appendChild(t);
  targets.add(t);
  t.dataset.timer = String(setTimeout(() => despawn(t, true), 1700 + Math.random() * 600));
}
function despawn(t, missed) {
  if (!targets.has(t)) return;
  targets.delete(t);
  clearTimeout(Number(t.dataset.timer));
  t.classList.add(missed ? 'gone' : 'down');
  if (missed) { combo = 0; $('#combo').textContent = ''; }
  setTimeout(() => t.remove(), 420);
}
function popText(x, y, text, cls = '') {
  const p = document.createElement('div');
  p.className = 'pop ' + cls; p.textContent = text; p.style.left = x + 'px'; p.style.top = y + 'px';
  screen.appendChild(p); setTimeout(() => p.remove(), 900);
}
// targets only run while the screen is on view (and never under reduced motion)
if (screen && 'IntersectionObserver' in window && !calm) {
  new IntersectionObserver((en) => en.forEach((e) => {
    clearInterval(rangeTimer);
    if (e.isIntersecting) { spawnTarget(); rangeTimer = setInterval(spawnTarget, 950); }
    else targets.forEach((t) => despawn(t, false));
  }), { threshold: 0.45 }).observe(screen);
}
function aim(clientX, clientY) {
  const r = screen.getBoundingClientRect();
  crosshair.style.transform = `translate(${clientX - r.left}px, ${clientY - r.top}px)`;
}
function fire(x, y) {
  const flash = document.createElement('div');
  flash.className = 'muzzle'; flash.style.setProperty('--mx', `${x}px`); flash.style.setProperty('--my', `${y}px`);
  const mark = document.createElement('div');
  mark.className = 'hitmark'; mark.style.left = `${x}px`; mark.style.top = `${y}px`;
  screen.append(flash, mark);
  setTimeout(() => { flash.remove(); mark.remove(); }, 560);
  hits += 1; $('#hitCount').textContent = hits;
  world?.flash(0.7);
  world?.robot.duck?.();
  sound.fx('shot');
  if (calm) showShot((shotIndex + 1) % shots.length);
  // did the shot land on a bot?
  const r = screen.getBoundingClientRect();
  const hit = [...targets].find((t) => { const b = t.querySelector('.t-head').getBoundingClientRect(); return x + r.left >= b.left - 6 && x + r.left <= b.right + 6 && y + r.top >= b.top - 6 && y + r.top <= b.bottom + 6; });
  if (hit) {
    const now = performance.now();
    combo = now - lastHit < 1400 ? combo + 1 : 1; lastHit = now;
    const gain = 100 * Math.min(combo, 5);
    score += gain; landed += 1;
    $('#score').textContent = score; $('#hitTargets').textContent = landed;
    $('#combo').textContent = combo > 1 ? 'x' + Math.min(combo, 5) : '';
    popText(x, y - 18, '+' + gain, combo > 2 ? 'hot' : '');
    despawn(hit, false);
    sound.fx('hit');
    if (combo === 5) say('Five in a row. Simo would hire you.', 2200);
  }
}
// keyboard: Enter fires at the oldest bot on screen, or the centre
function fireKey() {
  const r = screen.getBoundingClientRect();
  const t = targets.values().next().value;
  let x = r.width / 2, y = r.height / 2;
  if (t) { const b = t.querySelector('.t-head').getBoundingClientRect(); x = b.left + b.width / 2 - r.left; y = b.top + b.height / 2 - r.top; }
  screen.classList.add('aiming');
  crosshair.style.transform = `translate(${x}px, ${y}px)`;
  fire(x, y);
}
if (screen) {
  screen.tabIndex = 0;
  screen.setAttribute('role', 'button');
  screen.setAttribute('aria-label', 'Ironline target practice. Click a bot, or press Enter to fire at the next one.');
  screen.addEventListener('pointermove', (e) => aim(e.clientX, e.clientY));
  screen.addEventListener('pointerdown', (e) => { const r = screen.getBoundingClientRect(); aim(e.clientX, e.clientY); fire(e.clientX - r.left, e.clientY - r.top); });
  screen.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    fireKey();
  });
  screen.addEventListener('blur', () => screen.classList.remove('aiming'));
}

/* ------------------------------------------------------------------ MANA VESSEL: cast a spell */
const SPELL_LINES = { fire: 'Fire! Stand back.', water: 'Water. Everyone’s soaked now.', wind: 'Wind. Hold on to something.', stone: 'Stone. Very solid choice.', healing: 'Healing. I feel brand new.' };
$$('.rune').forEach((rune) => rune.addEventListener('click', () => {
  const spell = rune.dataset.spell, r = rune.getBoundingClientRect();
  rune.classList.remove('cast'); void rune.offsetWidth; rune.classList.add('cast');
  const seal = document.createElement('i');
  seal.className = 'rune-seal'; seal.setAttribute('aria-hidden', 'true');
  rune.appendChild(seal); setTimeout(() => seal.remove(), 1000);
  // if the page covers S-01 (a screenshot frame, or off screen), the spell bursts out of the rune itself
  const orb = world?.orbScreen(), top = orb && document.elementFromPoint(orb.x, orb.y);
  world?.castSpell(spell, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, !top || !!top.closest('.scroll-frame, img, video'));
  sound.fx('spell_' + spell);
  say(SPELL_LINES[spell], 2200);
}));

/* ------------------------------------------------------------------ ROBOROUTE: plan a route on the table */
const plannerEl = $('#planner');
let routesPlanned = 0;
if (plannerEl) initPlanner({
  root: plannerEl, calm, sound,
  onRoute: (result, goal) => {
    world?.robot.hop(2.2);
    routesPlanned += 1;
    // the first route plans itself; S-01 only comments on the ones the visitor asked for
    if (routesPlanned === 2) say('Same grid cells the real engine checks.', 2400);
    else if (routesPlanned > 2 && goal.id === 'home') say('Home zone. Time to swap attachments.', 2200);
  },
});
// the launch film plays with its music on request, like the PoseSandbox one
const rrFilm = $('#rrFilm'), rrPlay = $('#rrPlay');
if (rrFilm && rrPlay) {
  rrPlay.addEventListener('click', () => { rrFilm.muted = false; rrFilm.controls = true; rrFilm.play().catch(() => {}); rrPlay.hidden = true; world?.robot.hop(2.4); });
  rrFilm.addEventListener('ended', () => { rrFilm.controls = false; rrPlay.hidden = false; });
  if ('IntersectionObserver' in window) new IntersectionObserver((en) => en.forEach((e) => { if (!e.isIntersecting && !rrFilm.paused) rrFilm.pause(); }), { threshold: 0.2 }).observe(rrFilm);
}

/* ------------------------------------------------------------------ SHIPPED: brutal accordion */
const slices = $$('.slice');
function openSlice(slice) {
  slices.forEach((s) => {
    const on = s === slice;
    s.classList.toggle('is-open', on);
    $('.slice-tab', s).setAttribute('aria-expanded', String(on));
  });
}
slices.forEach((slice) => {
  $('.slice-tab', slice).addEventListener('click', () => {
    const isOpen = slice.classList.contains('is-open');
    if (phoneQ.matches && isOpen) { slice.classList.remove('is-open'); $('.slice-tab', slice).setAttribute('aria-expanded', 'false'); return; }
    openSlice(slice);
  });
  let t = 0;
  slice.addEventListener('mouseenter', () => { if (!hoverQ.matches || phoneQ.matches) return; clearTimeout(t); t = setTimeout(() => openSlice(slice), 140); });
  slice.addEventListener('mouseleave', () => clearTimeout(t));
});

/* ------------------------------------------------------------------ STUDIO: ink */
const studio = $('#studio');
const inkLayer = $('#inkLayer');
const INKS = ['#2547d0', '#f5b301', '#e63946', '#2a9d8f', '#ff7bac'];
let inkN = 0;
function splatPath(seed) {
  const pts = [];
  const n = 14;
  let rnd = seed;
  const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 34 + rand() * 22 + (i % 3 === 0 ? rand() * 30 : 0);
    pts.push([90 + Math.cos(a) * r, 90 + Math.sin(a) * r]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n], q = pts[(i - 1) % n];
    d += ` Q${((p[0] + q[0]) / 2 + (rand() - 0.5) * 16).toFixed(1)} ${((p[1] + q[1]) / 2 + (rand() - 0.5) * 16).toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  }
  let drops = '';
  for (let i = 0; i < 5; i++) { const a = rand() * Math.PI * 2, r = 70 + rand() * 18; drops += `<circle cx="${(90 + Math.cos(a) * r).toFixed(1)}" cy="${(90 + Math.sin(a) * r).toFixed(1)}" r="${(3 + rand() * 5).toFixed(1)}"/>`; }
  return `<path d="${d} Z"/>${drops}`;
}
if (studio) studio.addEventListener('pointerdown', (e) => {
  if (e.target.closest(INTERACTIVE) || e.button !== 0) return;
  const r = studio.getBoundingClientRect();
  const color = INKS[inkN++ % INKS.length];
  const el = document.createElement('div');
  el.className = 'splat';
  el.style.left = `${e.clientX - r.left}px`;
  el.style.top = `${e.clientY - r.top}px`;
  el.style.rotate = `${Math.floor(Math.random() * 360)}deg`;
  el.innerHTML = `<svg viewBox="0 0 180 180" width="180" height="180" fill="${color}" opacity="0.85">${splatPath(Date.now() % 9999)}</svg>`;
  inkLayer.appendChild(el);
  sound.fx('splat');
  // S-01 looks at the splash (and jumps if it lands close)
  if (world) {
    world.setMouse((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    const h = world.headScreen();
    if (Math.hypot(h.x - e.clientX, h.y - e.clientY) < 260) { world.robot.hop(3); say('Hey! Not on the armour.', 1600); }
  }
  while (inkLayer.children.length > 26) inkLayer.firstElementChild.remove();
});

/* ------------------------------------------------------------------ STUDIO: the PoseSandbox film plays with sound on request */
const psFilm = $('#psFilm');
const psPlay = $('#psPlay');
if (psFilm && psPlay) {
  psPlay.addEventListener('click', () => {
    psFilm.muted = false;
    psFilm.controls = true;
    psFilm.play().catch(() => {});
    psPlay.hidden = true;
    world?.robot.hop(2.4);
  });
  psFilm.addEventListener('ended', () => { psFilm.controls = false; psPlay.hidden = false; });
  if ('IntersectionObserver' in window) new IntersectionObserver((en) => en.forEach((e) => { if (!e.isIntersecting && !psFilm.paused) psFilm.pause(); }), { threshold: 0.2 }).observe(psFilm);
}

/* ------------------------------------------------------------------ METHOD: words light up as you read */
const scrub = $('#scrub');
if (scrub) {
  const words = scrub.textContent.trim().split(/\s+/);
  scrub.innerHTML = words.map((w) => `<span class="word">${w.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`).join(' ');
  const spans = $$('.word', scrub);
  if (hasGsap && !calm) {
    spans.forEach((s) => s.style.setProperty('--o', 0.14));
    ScrollTrigger.create({
      trigger: scrub, start: 'top 80%', end: 'bottom 45%', scrub: true,
      onUpdate: (self) => {
        const lit = self.progress * spans.length;
        spans.forEach((s, i) => s.style.setProperty('--o', (0.14 + 0.86 * Math.min(1, Math.max(0, lit - i))).toFixed(3)));
      },
    });
  }
}

/* ------------------------------------------------------------------ world map */
const mapBtn = $('#mapBtn');
const map = $('#worldMap');
let mapOpener = null;
function openMap() {
  mapOpener = document.activeElement;
  map.hidden = false;
  mapBtn.setAttribute('aria-expanded', 'true');
  lenis?.stop();
  $('a', map)?.focus();
}
function closeMap() {
  if (map.hidden) return;
  map.hidden = true;
  mapBtn.setAttribute('aria-expanded', 'false');
  lenis?.start();
  if (mapOpener && document.contains(mapOpener) && !mapOpener.closest('#worldMap')) mapOpener.focus({ preventScroll: true });
}
mapBtn.addEventListener('click', () => (map.hidden ? openMap() : closeMap()));
$$('[data-close-map]').forEach((b) => b.addEventListener('click', closeMap));
map.addEventListener('click', (e) => { if (e.target === map) closeMap(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !map.hidden) { closeMap(); mapBtn.focus(); } });

/* ------------------------------------------------------------------ dossiers (<dialog id="p-…">) */
let opener = null;
const openSheet = () => $('.sheetd[open]');
function openProject(id, { push = true, from = document.activeElement } = {}) {
  const dlg = document.getElementById('p-' + id);
  if (!dlg) return false;
  const was = openSheet();
  if (was === dlg) return true;
  if (was) { was.close(); delete was.dataset.active; } else opener = from;
  dlg.showModal();
  dlg.dataset.active = '1';
  dlg.scrollTop = 0;
  dlg.classList.remove('is-scrolled');
  lenis?.stop();
  root.style.overflow = 'hidden';
  const hash = '#work/' + id;
  if (location.hash !== hash) {
    if (push && !was) history.pushState({ p: id }, '', hash);
    else history.replaceState({ p: id }, '', hash);
  }
  $('[data-close]', dlg)?.focus({ preventScroll: true });
  return true;
}
// cleanup runs from every close path; the native 'close' event is only a fallback,
// because some embedded browsers never fire it
function cleanup(dlg, { restoreFocus = true } = {}) {
  if (!dlg.dataset.active) return;
  delete dlg.dataset.active;
  root.style.overflow = '';
  lenis?.start();
  const id = dlg.id.slice(2);
  if (location.hash === '#work/' + id) {
    if (history.state && history.state.p === id) history.back();
    else history.replaceState(null, '', location.pathname + location.search);
  }
  if (restoreFocus && opener && document.contains(opener)) opener.focus({ preventScroll: true });
}
function closeProject(dlg, opts) { if (dlg.open) dlg.close(); cleanup(dlg, opts); }
$$('.sheetd').forEach((dlg) => {
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeProject(dlg); });
  dlg.addEventListener('close', () => cleanup(dlg));
  $$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => closeProject(dlg)));
  dlg.addEventListener('scroll', () => dlg.classList.toggle('is-scrolled', dlg.scrollTop > 160), { passive: true });
});
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = e.target.closest('[data-open]');
  if (link && openProject(link.dataset.open, { from: link })) e.preventDefault();
});
function syncFromHash() {
  const m = location.hash.match(/^#(?:work|case)\/([\w-]+)$/);
  const dlg = openSheet();
  if (m) { if (!dlg || dlg.id !== 'p-' + m[1]) openProject(m[1], { push: false }); }
  else if (dlg) closeProject(dlg, { restoreFocus: false });
}
window.addEventListener('popstate', syncFromHash);
window.addEventListener('hashchange', syncFromHash);
const deep = location.hash.match(/^#(?:work|case)\/([\w-]+)$/);
if (deep && document.getElementById('p-' + deep[1])) {
  requestAnimationFrame(() => {
    history.replaceState(null, '', location.pathname + location.search);
    openProject(deep[1], { push: true });
  });
}

/* ------------------------------------------------------------------ viewer: any screen, full size */
const viewer = $('#viewer');
const vImg = $('#vImg'), vVid = $('#vVid'), vCap = $('#vCap'), vCount = $('#vCount');
let group = [], at = 0, viewerOpener = null;
function show(i) {
  at = (i + group.length) % group.length;
  const b = group[at];
  if (b.dataset.video) {
    vImg.hidden = true; vVid.hidden = false;
    vVid.poster = b.dataset.full;
    if (vVid.getAttribute('src') !== b.dataset.video) vVid.src = b.dataset.video;
    vVid.setAttribute('aria-label', b.dataset.alt);
    if (!calm) vVid.play().catch(() => {});
  } else {
    vVid.pause(); vVid.hidden = true; vImg.hidden = false;
    vImg.src = b.dataset.full; vImg.alt = b.dataset.alt;
  }
  vCap.textContent = b.dataset.alt;
  vCount.textContent = group.length > 1 ? `${at + 1} of ${group.length}` : '';
  $$('[data-v="prev"], [data-v="next"]', viewer).forEach((x) => { x.hidden = group.length < 2; });
}
function openViewer(btn) {
  const box = btn.closest('[data-group]');
  group = box ? $$('.sf', box) : [btn];
  viewerOpener = btn;
  show(group.indexOf(btn));
  viewer.showModal();
  viewer.dataset.active = '1';
  lenis?.stop();
  $('[data-v="close"]', viewer).focus({ preventScroll: true });
}
function closeViewer() {
  if (viewer.open) viewer.close();
  if (!viewer.dataset.active) return;
  delete viewer.dataset.active;
  vVid.pause();
  if (!openSheet()) lenis?.start();
  if (viewerOpener && document.contains(viewerOpener)) viewerOpener.focus({ preventScroll: true });
}
document.addEventListener('click', (e) => { const b = e.target.closest('.sf'); if (b) openViewer(b); });
viewer.addEventListener('cancel', (e) => { e.preventDefault(); closeViewer(); });
viewer.addEventListener('close', closeViewer);
viewer.addEventListener('click', (e) => {
  const v = e.target.closest('[data-v]');
  if (v) { if (v.dataset.v === 'close') closeViewer(); else show(at + (v.dataset.v === 'next' ? 1 : -1)); return; }
  if (e.target === viewer || e.target.classList.contains('v-fig')) closeViewer();
});
viewer.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' && group.length > 1) { show(at + 1); e.preventDefault(); }
  if (e.key === 'ArrowLeft' && group.length > 1) { show(at - 1); e.preventDefault(); }
});
let sx = null;
viewer.addEventListener('pointerdown', (e) => { sx = e.clientX; });
viewer.addEventListener('pointercancel', () => { sx = null; });
viewer.addEventListener('pointerup', (e) => {
  if (sx === null || group.length < 2) return;
  const dx = e.clientX - sx; sx = null;
  if (Math.abs(dx) > 60) show(at + (dx < 0 ? 1 : -1));
});

/* ------------------------------------------------------------------ loops: five seconds when seen (WCAG 2.2.2) */
const videos = $$('video.m');
const timers = new WeakMap();
function runFor(v, ms) {
  if (calm) return;
  v.preload = 'auto';
  v.play().catch(() => {});
  clearTimeout(timers.get(v));
  timers.set(v, setTimeout(() => v.pause(), ms));
}
if ('IntersectionObserver' in window) {
  const vio = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) runFor(en.target, 5000);
    else if (!en.target.paused) en.target.pause();
  }), { threshold: 0.3 });
  videos.forEach((v) => vio.observe(v));
}
videos.forEach((v) => {
  const host = v.closest('figure, button, .sia-film') || v;
  host.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') runFor(v, 60000); });
  host.addEventListener('pointerleave', () => { clearTimeout(timers.get(v)); v.pause(); });
});

/* ------------------------------------------------------------------ live figures report their height */
const figures = $$('iframe[data-figure]');
figures.forEach((f) => f.addEventListener('load', () => f.contentWindow?.postMessage({ type: 'theme', theme: 'light' }, '*')));
window.addEventListener('message', (e) => {
  const f = figures.find((x) => x.contentWindow === e.source);
  if (!f || !e.data || e.data.type !== 'figure-height') return;
  const h = Math.round(Number(e.data.height));
  if (h > 120 && h < 2000) { f.style.height = h + 'px'; if (hasGsap) ScrollTrigger.refresh(); }
});

/* ------------------------------------------------------------------ settle layout once fonts and images are in */
if (hasGsap) {
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
window.__simo = { world, lenis, sections, blendNow };
