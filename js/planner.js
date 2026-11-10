/* ==========================================================================
   RoboRoute, in miniature. A JavaScript port of the route search from the real app
   (whose engine is Python), written for this page so visitors can run it.
   Same method as the engine's notes describe: the robot becomes a disc, cells are free
   when their centre keeps the disc clear of everything (plus half a cell diagonal, so a
   step between free neighbours is safe too), the search is A* with the octile estimate or
   Dijkstra on an 8-connected grid, the grid path is straightened by line of sight, and
   the drive is timed with a speed-up / cruise / slow-down profile.
   The table is the app's fictional example "Scenario D". Units: centimetres.
   ========================================================================== */
const FIELD = { w: 236, h: 114, cell: 2 };
const ROBOT = { len: 20, wid: 16, margin: 1, v: 25, a: 50, omega: 2.5, alpha: 6 };
const R = 0.5 * Math.hypot(ROBOT.len, ROBOT.wid) + ROBOT.margin;          // 13.8 cm
const DELTA = FIELD.cell * Math.SQRT2 / 2;
const SOLIDS = [
  { id: 'dam', kind: 'rect', cx: 85, cy: 75, w: 10, h: 40 },
  { id: 'rock', kind: 'circle', cx: 130, cy: 35, r: 10 },
  { id: 'pier', kind: 'rect', cx: 175, cy: 80, w: 30, h: 10 },
  { id: 'mast', kind: 'circle', cx: 200, cy: 35, r: 8 },
  { id: 'marsh', kind: 'rect', cx: 55, cy: 100, w: 30, h: 12, nogo: true },
];
const HOME = { cx: 25, cy: 25, w: 45, h: 45 };
const START = { x: 25, y: 25, th: 0 };
export const MISSIONS = [
  { id: 'key', name: 'Collect the key', x: 60, y: 55, th: Math.PI / 2, lab: [-5, 4.5, 'end'] },
  { id: 'gate', name: 'Open the gate', x: 110, y: 80, th: 0 },
  { id: 'ramp', name: 'Lower the ramp', x: 155, y: 55, th: 0 },
  { id: 'bridge', name: 'Cross the bridge', x: 210, y: 65, th: -Math.PI / 2, lab: [-5, 4.5, 'end'] },
  { id: 'dock-a', name: 'Dock at bay A', x: 140, y: 97, th: 0 },
  { id: 'dock-b', name: 'Dock at bay B', x: 95, y: 25, th: -Math.PI / 2, lab: [5, -7.5, 'start'] },
  { id: 'tree', name: 'Shake the tree', x: 175, y: 25, th: 0, lab: [4, -8, 'start'] },
  { id: 'beacon', name: 'Light the beacon', x: 70, y: 25, th: 0, lab: [-4, -8, 'end'] },
];

/* ------------------------------------------------------------------ geometry */
function clearance(x, y) {
  let c = Math.min(x, FIELD.w - x, y, FIELD.h - y);
  for (const o of SOLIDS) {
    let d;
    if (o.kind === 'circle') d = Math.hypot(x - o.cx, y - o.cy) - o.r;
    else { const dx = Math.abs(x - o.cx) - o.w / 2, dy = Math.abs(y - o.cy) - o.h / 2; d = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0); }
    if (d < c) c = d;
  }
  return c;
}
// a straight drive is safe when the disc stays clear all along it (sampled every 5 mm)
function segmentFree(a, b) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.5));
  for (let i = 0; i <= n; i++) { const t = i / n; if (clearance(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) < R - 1e-6) return false; }
  return true;
}

/* ------------------------------------------------------------------ the planning grid */
const NX = Math.floor(FIELD.w / FIELD.cell), NY = Math.floor(FIELD.h / FIELD.cell);
const centre = (i, j) => ({ x: (i + 0.5) * FIELD.cell, y: (j + 0.5) * FIELD.cell });
const FREE = new Uint8Array(NX * NY);
for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const c = centre(i, j); FREE[j * NX + i] = clearance(c.x, c.y) >= R + DELTA ? 1 : 0; }
// the nearest free cell centre (within three cells) that the point can reach in a straight line
function snap(p) {
  const ci = Math.floor(p.x / FIELD.cell), cj = Math.floor(p.y / FIELD.cell);
  let best = -1, bd = Infinity;
  for (let j = cj - 3; j <= cj + 3; j++) for (let i = ci - 3; i <= ci + 3; i++) {
    if (i < 0 || j < 0 || i >= NX || j >= NY || !FREE[j * NX + i]) continue;
    const c = centre(i, j), d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd && segmentFree(p, c)) { bd = d; best = j * NX + i; }
  }
  return best;
}

/* ------------------------------------------------------------------ A* and Dijkstra */
// a binary heap ordered by f, then by the smaller estimate (closer to the goal), then by age
function makeHeap() {
  const f = [], h = [], id = [], seq = [];
  const less = (a, b) => f[a] < f[b] || (f[a] === f[b] && (h[a] < h[b] || (h[a] === h[b] && seq[a] < seq[b])));
  const swap = (a, b) => { for (const arr of [f, h, id, seq]) { const t = arr[a]; arr[a] = arr[b]; arr[b] = t; } };
  let count = 0;
  return {
    get size() { return f.length; },
    push(F, H, I) {
      f.push(F); h.push(H); id.push(I); seq.push(count++);
      let k = f.length - 1;
      while (k > 0) { const p = (k - 1) >> 1; if (!less(k, p)) break; swap(k, p); k = p; }
    },
    pop() {
      const top = id[0], last = f.length - 1;
      swap(0, last); f.pop(); h.pop(); id.pop(); seq.pop();
      let k = 0;
      for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < f.length && less(l, m)) m = l; if (r < f.length && less(r, m)) m = r; if (m === k) break; swap(k, m); k = m; }
      return top;
    },
  };
}
const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
function search(start, goal, useEstimate) {
  const gi = goal % NX, gj = Math.floor(goal / NX);
  const est = useEstimate ? (n) => { const dx = Math.abs(n % NX - gi), dy = Math.abs(Math.floor(n / NX) - gj); return (Math.max(dx, dy) - Math.min(dx, dy)) + Math.SQRT2 * Math.min(dx, dy); } : () => 0;
  const g = new Float64Array(NX * NY).fill(Infinity), from = new Int32Array(NX * NY).fill(-1), done = new Uint8Array(NX * NY);
  const heap = makeHeap(), order = [];
  g[start] = 0; heap.push(est(start), est(start), start);
  while (heap.size) {
    const n = heap.pop();
    if (done[n]) continue;                     // a stale entry: a shorter way was found later
    done[n] = 1; order.push(n);
    if (n === goal) break;
    const i = n % NX, j = Math.floor(n / NX);
    for (const [dx, dy, w] of STEPS) {
      const x = i + dx, y = j + dy;
      if (x < 0 || y < 0 || x >= NX || y >= NY) continue;
      const m = y * NX + x;
      if (!FREE[m] || done[m]) continue;
      const cand = g[n] + w;
      if (cand < g[m]) { g[m] = cand; from[m] = n; const hm = est(m); heap.push(cand + hm, hm, m); }
    }
  }
  if (!done[goal]) return { order, cells: null };
  const cells = [];
  for (let n = goal; n !== -1; n = from[n]) cells.push(n);
  return { order, cells: cells.reverse(), cost: g[goal] * FIELD.cell };
}

/* ------------------------------------------------------------------ from grid path to driven route */
function smoothPath(points) {
  // merge runs in one direction, then jump to the farthest later point in a clear straight line
  const pts = points.filter((p, k) => { if (k === 0 || k === points.length - 1) return true; const a = points[k - 1], b = points[k + 1]; return Math.abs((p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x)) > 1e-9; });
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !segmentFree(pts[i], pts[j])) j--;
    out.push(pts[j]); i = j;
  }
  return out;
}
const profile = (d, v, a) => (d <= 0 ? 0 : d >= v * v / a ? d / v + v / a : 2 * Math.sqrt(d / a));
const wrap = (t) => { let x = (t + Math.PI) % (2 * Math.PI); if (x <= 0) x += 2 * Math.PI; return x - Math.PI; };
// total time: every straight drive plus every turn on the spot; each segment may be driven
// forwards or backwards, whichever order of choices turns least (two states per segment)
function driveTime(pts, th0, thEnd) {
  const seg = [];
  for (let k = 1; k < pts.length; k++) { const dx = pts[k].x - pts[k - 1].x, dy = pts[k].y - pts[k - 1].y, len = Math.hypot(dx, dy); if (len > 1e-6) seg.push({ len, phi: Math.atan2(dy, dx) }); }
  const turn = (a, b) => profile(Math.abs(wrap(b - a)), ROBOT.omega, ROBOT.alpha);
  let cost = [0, 0], head = [th0, th0], headings = [[], []];
  for (const s of seg) {
    const nc = [0, 0], nh = [0, 0], nhs = [[], []];
    for (const dir of [0, 1]) {
      const hd = s.phi + dir * Math.PI;
      const viaA = cost[0] + turn(head[0], hd), viaB = cost[1] + turn(head[1], hd), pick = viaA <= viaB ? 0 : 1;
      nc[dir] = Math.min(viaA, viaB) + profile(s.len, ROBOT.v, ROBOT.a); nh[dir] = hd; nhs[dir] = [...headings[pick], hd];
    }
    cost = nc; head = nh; headings = nhs;
  }
  const end = [0, 1].map((d) => cost[d] + (thEnd === null || !seg.length ? 0 : turn(head[d], thEnd)));
  const best = end[0] <= end[1] ? 0 : 1;
  return { time: end[best], headings: headings[best], length: seg.reduce((s, x) => s + x.len, 0) };
}

// one whole query: both searches, the driven route and its time
export function plan(from, to) {
  if (clearance(to.x, to.y) < R) return { status: 'blocked' };
  const s = snap(from), g = snap(to);
  if (s < 0 || g < 0) return { status: 'blocked' };
  const astar = search(s, g, true), dijkstra = search(s, g, false);
  if (!astar.cells) return { status: 'unreachable', astar, dijkstra };
  const toPoint = (n) => centre(n % NX, Math.floor(n / NX));
  const pts = smoothPath([{ x: from.x, y: from.y }, ...astar.cells.map(toPoint), { x: to.x, y: to.y }]);
  const drive = driveTime(pts, from.th ?? 0, to.th ?? null);
  return { status: 'ok', astar, dijkstra, pts, ...drive };
}

/* ------------------------------------------------------------------ the table on the page */
const SVGNS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, parent = null) => { const n = document.createElementNS(SVGNS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (parent) parent.appendChild(n); return n; };
const Y = (y) => FIELD.h - y;                                   // the table's y runs up, the screen's runs down
const nf = new Intl.NumberFormat('en-US');

export function initPlanner({ root, calm = false, sound = null, onRoute = null }) {
  const stage = root.querySelector('.planner-stage'), chipsBox = root.querySelector('.planner-chips');
  const out = { cellsA: root.querySelector('#plA'), cellsD: root.querySelector('#plD'), barA: root.querySelector('#plBarA'), barD: root.querySelector('#plBarD'), len: root.querySelector('#plLen'), time: root.querySelector('#plTime'), msg: root.querySelector('#plMsg') };
  if (!stage || !chipsBox) return null;
  let algo = 'astar', robot = { ...START }, token = 0, lastGoal = null, ran = false;

  // explored cells are painted on a canvas under the drawing
  const PX = 6;
  const canvas = document.createElement('canvas');
  canvas.width = FIELD.w * PX; canvas.height = FIELD.h * PX; canvas.className = 'pl-cells'; canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const svg = el('svg', { viewBox: `0 0 ${FIELD.w} ${FIELD.h}`, class: 'pl-svg', role: 'img', 'aria-label': 'A robot-game table, 236 by 114 centimetres: a home zone bottom left, four obstacles, a keep-out area and eight mission positions' });
  stage.append(canvas, svg);

  const defs = el('defs', {}, svg);
  const hatch = el('pattern', { id: 'plHatch', width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 4, stroke: '#f87171', 'stroke-width': 1.1 }, hatch);
  const grid = el('pattern', { id: 'plGrid', width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, defs);
  el('path', { d: 'M10 0H0V10', fill: 'none', stroke: '#1f2f4d', 'stroke-width': 0.35 }, grid);
  el('rect', { width: FIELD.w, height: FIELD.h, fill: 'url(#plGrid)' }, svg);
  el('rect', { x: HOME.cx - HOME.w / 2, y: Y(HOME.cy + HOME.h / 2), width: HOME.w, height: HOME.h, class: 'pl-home' }, svg);
  for (const o of SOLIDS) {
    // dashed: how close the robot's centre may come (the obstacle grown by the robot's radius)
    if (o.kind === 'circle') { el('circle', { cx: o.cx, cy: Y(o.cy), r: o.r + R, class: 'pl-grow' }, svg); el('circle', { cx: o.cx, cy: Y(o.cy), r: o.r, class: 'pl-solid' }, svg); }
    else {
      el('rect', { x: o.cx - o.w / 2 - R, y: Y(o.cy + o.h / 2) - R, width: o.w + 2 * R, height: o.h + 2 * R, rx: R, class: 'pl-grow' }, svg);
      el('rect', { x: o.cx - o.w / 2, y: Y(o.cy + o.h / 2), width: o.w, height: o.h, class: o.nogo ? 'pl-nogo' : 'pl-solid', ...(o.nogo ? { fill: 'url(#plHatch)' } : {}) }, svg);
    }
  }
  const route = el('path', { class: 'pl-route', d: '', pathLength: 1 }, svg);
  const marks = {};
  for (const m of MISSIONS) {
    const g = el('g', { class: 'pl-mission', 'data-id': m.id }, svg);
    el('circle', { cx: m.x, cy: Y(m.y), r: 2.6 }, g);
    el('line', { x1: m.x, y1: Y(m.y), x2: m.x + Math.cos(m.th) * 6.5, y2: Y(m.y + Math.sin(m.th) * 6.5) }, g);
    const [lx, ly, anchor] = m.lab || [5, 4.5, 'start'];        // labels sit where they clear the obstacles
    const t = el('text', { x: m.x + lx, y: Y(m.y + ly), 'text-anchor': anchor }, g); t.textContent = m.name;
    marks[m.id] = g;
  }
  const pin = el('g', { class: 'pl-pin', visibility: 'hidden' }, svg);
  el('circle', { r: 4.2 }, pin); el('circle', { r: 1.3, class: 'pl-pin-dot' }, pin);
  const bot = el('g', { class: 'pl-robot' }, svg);
  el('rect', { x: -ROBOT.len / 2, y: -ROBOT.wid / 2, width: ROBOT.len, height: ROBOT.wid, rx: 3 }, bot);
  el('path', { d: 'M-1.5 -4L4 0L-1.5 4', class: 'pl-robot-nose' }, bot);
  const placeBot = (x, y, th) => bot.setAttribute('transform', `translate(${x.toFixed(2)} ${Y(y).toFixed(2)}) rotate(${(-th * 180 / Math.PI).toFixed(1)})`);
  placeBot(robot.x, robot.y, robot.th);

  // mission buttons
  const chips = {};
  for (const m of [...MISSIONS, { id: 'home', name: 'Back to home', ...START }]) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pl-chip'; b.textContent = m.name; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => go(m));
    chipsBox.appendChild(b); chips[m.id] = b;
  }
  root.querySelectorAll('[data-algo]').forEach((b) => b.addEventListener('click', () => {
    algo = b.dataset.algo;
    root.querySelectorAll('[data-algo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (lastGoal) show(lastGoal.result, lastGoal.goal, true);      // same route, the other search
  }));
  svg.addEventListener('click', (e) => {
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * FIELD.w, y = FIELD.h - (e.clientY - r.top) / r.height * FIELD.h;
    const near = MISSIONS.find((m) => Math.hypot(m.x - x, m.y - y) < 7);
    go(near || { id: 'point', name: 'that spot', x, y, th: null });
  });

  function paintCells(order, n, settled) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = FIELD.cell * PX;
    for (let k = 0; k < n; k++) {
      const c = order[k], i = c % NX, j = Math.floor(c / NX), fresh = !settled && k > n - 70;
      ctx.fillStyle = fresh ? 'rgba(94, 234, 212, 0.85)' : settled ? 'rgba(45, 212, 191, 0.16)' : 'rgba(45, 212, 191, 0.3)';
      ctx.fillRect(i * s + 1, (NY - 1 - j) * s + (FIELD.h * PX - NY * s) + 1, s - 2, s - 2);
    }
  }
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const pathD = (pts) => pts.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(2)} ${Y(p.y).toFixed(2)}`).join('');

  function readout(result, goal) {
    const a = result.astar.order.length, d = result.dijkstra.order.length, top = Math.max(a, d);
    out.cellsA.textContent = nf.format(a); out.cellsD.textContent = nf.format(d);
    out.barA.style.setProperty('--v', (a / top * 100).toFixed(1) + '%'); out.barD.style.setProperty('--v', (d / top * 100).toFixed(1) + '%');
    out.len.textContent = result.length.toFixed(0) + ' cm';
    out.time.textContent = result.time.toFixed(1) + ' s';
    const times = d / a;
    out.msg.textContent = `Route to ${goal.name.toLowerCase()}: ${result.pts.length - 1} straight ${result.pts.length === 2 ? 'drive' : 'drives'}. Dijkstra searched ${times >= 2 ? times.toFixed(1) + ' times' : (d - a) + ' cells'} more than A* for the same route.`;
  }

  async function show(result, goal, replay = false) {
    const mine = ++token;
    const order = (algo === 'astar' ? result.astar : result.dijkstra).order;
    root.dataset.algo = algo;
    route.setAttribute('d', pathD(result.pts)); route.style.strokeDashoffset = '1';
    if (!replay) { out.cellsA.textContent = out.cellsD.textContent = '…'; }
    sound?.fx('scan');
    if (!calm) {
      const steps = Math.min(70, Math.max(24, Math.round(order.length / 50)));
      for (let k = 1; k <= steps; k++) { if (mine !== token) return; paintCells(order, Math.round(order.length * k / steps), false); await frame(); }
    }
    if (mine !== token) return;
    paintCells(order, order.length, true);
    readout(result, goal);
    route.style.transition = calm ? 'none' : 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)';
    route.style.strokeDashoffset = '0';
    sound?.fx('route');
    if (replay) return;
    // the robot drives it: turn on the spot at each corner, then go
    const pts = result.pts, heads = result.headings;
    if (!calm) {
      let th = robot.th;
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k], hd = heads[k - 1] ?? Math.atan2(b.y - a.y, b.x - a.x), dth = wrap(hd - th);
        const turnF = Math.round(Math.abs(dth) * 5), runF = Math.max(8, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 5));
        for (let f = 1; f <= turnF; f++) { if (mine !== token) return; placeBot(a.x, a.y, th + dth * f / turnF); await frame(); }
        th += dth;
        for (let f = 1; f <= runF; f++) { if (mine !== token) return; const t = f / runF, e = t * t * (3 - 2 * t); placeBot(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, th); await frame(); }
      }
      if (goal.th !== null && goal.th !== undefined) { const dth = wrap(goal.th - th), n = Math.round(Math.abs(dth) * 5); for (let f = 1; f <= n; f++) { if (mine !== token) return; placeBot(goal.x, goal.y, th + dth * f / n); await frame(); } th += dth; }
      robot = { x: goal.x, y: goal.y, th };
    } else robot = { x: goal.x, y: goal.y, th: goal.th ?? heads[heads.length - 1] ?? robot.th };
    placeBot(robot.x, robot.y, robot.th);
  }

  function go(goal) {
    ran = true;
    token++;                                                     // stop any drive in progress where it is
    placeBot(robot.x, robot.y, robot.th);
    Object.entries(chips).forEach(([id, b]) => b.setAttribute('aria-pressed', String(id === goal.id)));
    Object.entries(marks).forEach(([id, g]) => g.classList.toggle('is-goal', id === goal.id));
    if (goal.id === 'point') { pin.setAttribute('visibility', 'visible'); pin.setAttribute('transform', `translate(${goal.x.toFixed(1)} ${Y(goal.y).toFixed(1)})`); } else pin.setAttribute('visibility', 'hidden');
    if (Math.hypot(goal.x - robot.x, goal.y - robot.y) < 1) { out.msg.textContent = 'The robot is already there. Pick another mission.'; return; }
    const result = plan(robot, goal);
    if (result.status !== 'ok') {
      route.setAttribute('d', ''); ctx.clearRect(0, 0, canvas.width, canvas.height); lastGoal = null;
      out.msg.textContent = result.status === 'blocked' ? 'The robot can’t stand there: it would touch a wall or an obstacle. The dashed outlines show how close its centre may come.' : 'No route: that spot is walled off for a robot this size.';
      sound?.fx('blocked');
      return;
    }
    lastGoal = { result, goal };
    onRoute?.(result, goal);
    show(result, goal);
  }

  // the first route plans itself when the table scrolls into view
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting && !ran) { io.disconnect(); go(MISSIONS[1]); } }), { threshold: 0.5 });
    io.observe(stage);
  }
  return { go, get robot() { return robot; } };
}
