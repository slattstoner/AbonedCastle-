// 3D-просмотрщик построек: three.js, по одному InstancedMesh на непрозрачные
// и прозрачные блоки. Каждый блок — набор параллелепипедов из SHAPES.
(function () {
  const $ = (s) => document.querySelector(s);

  // Формы блоков в единичной клетке для поворота «на север» (сторона z = 0).
  const SHAPES = {
    full: () => [[0, 0, 0, 1, 1, 1]],
    slab: (b) => (b.h === 'top' ? [[0, 0.5, 0, 1, 1, 1]] : [[0, 0, 0, 1, 0.5, 1]]),
    stairs: (b) => [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 1, 1, 0.5]],
    trap: (b) => (b.open ? [[0, 0, 0, 1, 1, 0.19]] : b.h === 'top' ? [[0, 0.81, 0, 1, 1, 1]] : [[0, 0, 0, 1, 0.19, 1]]),
    door: (b) => (b.open ? [[0, 0, 0, 0.19, 1, 1]] : [[0, 0, 0, 1, 1, 0.19]]),
    thin: (b) => (b.h === 'flat' ? [[0.1, 0, 0.2, 0.9, 0.08, 0.8]] : [[0, 0, 0, 1, 1, 0.07]]),
    frame: () => [[0.12, 0.12, 0, 0.88, 0.88, 0.07]],
    hang: () => [[0.1, 0.1, 0.44, 0.9, 0.7, 0.56]],
    carpet: () => [[0, 0, 0, 1, 0.07, 1]],
    layer: () => [[0, 0, 0, 1, 0.13, 1]],
    small: () => [[0.3, 0, 0.3, 0.7, 0.45, 0.7]],
    candle: () => [[0.42, 0, 0.42, 0.58, 0.4, 0.58]],
    torch: () => [[0.44, 0, 0.44, 0.56, 0.62, 0.56]],
    tiny: () => [[0.36, 0, 0.36, 0.64, 0.18, 0.64]],
    plant: () => [[0.18, 0, 0.18, 0.82, 0.8, 0.82]],
    bush: () => [[0.08, 0, 0.08, 0.92, 0.75, 0.92]],
    pot: () => [[0.2, 0, 0.2, 0.8, 0.85, 0.8]],
    chest: () => [[0.06, 0, 0.06, 0.94, 0.88, 0.94]],
    bed: () => [[0, 0, 0, 1, 0.56, 1]],
    fire: () => [[0, 0, 0, 1, 0.44, 1]],
    lectern: () => [[0.25, 0, 0.25, 0.75, 0.75, 0.75], [0, 0.75, 0, 1, 0.95, 1]],
    cauldron: () => [[0, 0.2, 0, 1, 1, 0.12], [0, 0.2, 0.88, 1, 1, 1], [0, 0.2, 0, 0.12, 1, 1], [0.88, 0.2, 0, 1, 1, 1], [0, 0, 0, 1, 0.3, 1]],
    saw: () => [[0, 0, 0, 1, 0.56, 1], [0.45, 0.56, 0.1, 0.55, 0.95, 0.9]],
    // Книжная полка: доски и два ряда корешков разного цвета.
    shelf: (b) => {
      const BOOKS = ['#8c2f27', '#2f4f7a', '#3d6b35', '#7a5a2a', '#5a3a6b', '#a07a35'];
      const out = [[0, 0, 0, 1, 0.08, 1, '#5b4027'], [0, 0.46, 0, 1, 0.54, 1, '#5b4027'], [0, 0.92, 0, 1, 1, 1, '#5b4027']];
      for (const [y0, y1] of [[0.08, 0.46], [0.54, 0.92]])
        for (let k = 0; k < 4; k++) out.push([k * 0.25, y0, 0.04, (k + 1) * 0.25, y1 - (k % 2) * 0.06, 0.96, BOOKS[Math.floor(hash(b.x + k, b.y + y0 * 10, b.z) * BOOKS.length)]]);
      return out;
    },
  };
  // Заборы, стены и панели соединяются с соседями.
  const LINKED = {
    fence: { post: 0.125, arm: [0.44, 0.38, 0.56, 0.94] },
    wall: { post: 0.25, arm: [0.31, 0, 0.69, 0.8] },
    pane: { post: 0.06, arm: [0.47, 0, 0.53, 1] },
  };
  const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

  function rotate(box, f) {
    const [x0, y0, z0, x1, y1, z1] = box;
    const t = {
      n: (x, z) => [x, z], s: (x, z) => [1 - x, 1 - z],
      e: (x, z) => [1 - z, x], w: (x, z) => [z, 1 - x],
    }[f || 'n'];
    const [ax, az] = t(x0, z0), [bx, bz] = t(x1, z1);
    return [Math.min(ax, bx), y0, Math.min(az, bz), Math.max(ax, bx), y1, Math.max(az, bz)];
  }

  function boxesFor(blk, get) {
    const def = BLOCKS[blk.id] || {};
    const s = def.s || 'full';
    if (LINKED[s]) {
      const { post, arm } = LINKED[s];
      const out = [[0.5 - post, 0, 0.5 - post, 0.5 + post, s === 'wall' ? 1 : 1, 0.5 + post]];
      for (const [f, [dx, dz]] of Object.entries(DIRS)) {
        const nb = get(blk.x + dx, blk.y, blk.z + dz);
        const ns = nb && ((BLOCKS[nb.id] || {}).s || 'full');
        if (!nb || !(ns === s || ns === 'full' || ns === 'gate')) continue;
        out.push(rotate([arm[0], arm[1], 0, arm[2], arm[3], 0.5], f));
      }
      return out;
    }
    if (s === 'gate') {
      return blk.open ? [[0, 0.3, 0, 0.12, 0.95, 0.5], [0.88, 0.3, 0, 1, 0.95, 0.5]] : [rotate([0, 0.3, 0.44, 1, 0.95, 0.56], blk.f === 'e' || blk.f === 'w' ? 'e' : 'n')];
    }
    const base = (SHAPES[s] || SHAPES.full)(blk);
    if (s === 'stairs' && blk.h === 'top') return base.map((bx) => rotate([bx[0], 1 - bx[4], bx[2], bx[3], 1 - bx[1], bx[5]], blk.f));
    return base.map((bx) => { const r = rotate(bx, blk.f); if (bx[6]) r.push(bx[6]); return r; });
  }

  function hash(x, y, z) {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ---------- Сцена ----------
  const wrap = $('#stage');
  const canvas = $('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI * 0.95;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3020, 0.75));
  const sun = new THREE.DirectionalLight(0xfff1d6, 0.75);
  sun.position.set(0.6, 1, 0.35);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.25);
  fill.position.set(-0.7, 0.4, -0.5);
  scene.add(fill);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const matOpaque = new THREE.MeshLambertMaterial();
  const matGlass = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.5, depthWrite: false });
  const MARK_COLORS = { slot: 0xe0a14a, clue: 0x4fb3a9, secret: 0xd8574a, room: 0x5b7fc4 };
  let meshes = [], markObjs = [];

  const state = { i: 0, variant: null, cut: Infinity, env: true, built: null, focus: -1 };

  function themeColor(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function applyTheme() { scene.background = new THREE.Color(themeColor('--scene') || '#1b231d'); }

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function clearScene() {
    for (const m of meshes) { scene.remove(m); m.dispose && m.dispose(); }
    for (const m of markObjs) scene.remove(m.obj);
    meshes = []; markObjs = [];
  }

  function draw() {
    clearScene();
    const b = state.built;
    const get = (x, y, z) => b.blocks.get(x + ',' + y + ',' + z);
    const items = { o: [], t: [] };
    for (const blk of b.blocks.values()) {
      if (blk.y > state.cut) continue;
      if ((blk.env || blk.g) && !state.env) continue;
      const def = BLOCKS[blk.id] || { c: '#ff00ff' };
      const list = def.t ? items.t : items.o;
      for (const bx of boxesFor(blk, get)) list.push({ blk, bx, c: bx[6] || def.c });
    }
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (const [key, mat] of [['o', matOpaque], ['t', matGlass]]) {
      const list = items[key];
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(unit, mat, list.length);
      mesh.frustumCulled = false;
      mesh.userData.blocks = [];
      list.forEach(({ blk, bx, c }, i) => {
        const [x0, y0, z0, x1, y1, z1] = bx;
        m4.makeScale(Math.max(x1 - x0, 0.01), Math.max(y1 - y0, 0.01), Math.max(z1 - z0, 0.01));
        m4.setPosition(blk.x + (x0 + x1) / 2, blk.y + (y0 + y1) / 2, blk.z + (z0 + z1) / 2);
        mesh.setMatrixAt(i, m4);
        col.set(c).multiplyScalar(0.9 + hash(blk.x, blk.y, blk.z) * 0.2);
        mesh.setColorAt(i, col);
        mesh.userData.blocks.push(blk);
      });
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
      meshes.push(mesh);
    }
    // Метки видны сквозь стены
    b.marks.forEach((mk, i) => {
      const color = MARK_COLORS[mk.type];
      const g = new THREE.Group();
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.08, 1.08, 1.08)), new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
      edges.renderOrder = 10;
      const solid = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthTest: false }));
      solid.renderOrder = 9;
      g.add(edges, solid);
      g.position.set(mk.x + 0.5, mk.y + 0.5, mk.z + 0.5);
      scene.add(g);
      markObjs.push({ obj: g, mk, i, solid });
    });
    renderBadges();
  }

  function bounds(b) {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const v of b.blocks.values()) {
      const p = [v.x, v.y, v.z];
      for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k] + 1); }
    }
    return { mn, mx };
  }

  function frame(b) {
    const { mn, mx } = bounds(b);
    const c = new THREE.Vector3((mn[0] + mx[0]) / 2, Math.max(0, (mn[1] + mx[1]) / 2 - 1), (mn[2] + mx[2]) / 2);
    const r = Math.hypot(mx[0] - mn[0], mx[2] - mn[2], (mx[1] - mn[1]) * 0.6) * 0.5;
    const dist = r / Math.sin((camera.fov * Math.PI) / 360) * (camera.aspect < 1 ? 1.1 : 1.0);
    controls.target.copy(c);
    camera.position.set(c.x + dist * 0.62, c.y + dist * 0.55, c.z + dist * 0.62);
    controls.update();
  }

  // ---------- Значки меток и всплывающие подсказки ----------
  const badges = $('#badges');
  function renderBadges() {
    badges.innerHTML = '';
    for (const m of markObjs) {
      const el = document.createElement('button');
      el.className = 'badge ' + m.mk.type;
      el.textContent = m.i + 1;
      el.title = m.mk.title;
      el.addEventListener('click', () => selectMark(m.i));
      m.el = el;
      badges.appendChild(el);
    }
  }
  const v3 = new THREE.Vector3();
  function placeBadges() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    for (const m of markObjs) {
      v3.copy(m.obj.position).add(new THREE.Vector3(0, 0.9, 0)).project(camera);
      const vis = v3.z < 1;
      m.el.style.display = vis ? '' : 'none';
      m.el.style.transform = `translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h}px) translate(-50%, -50%)`;
    }
  }

  const tip = $('#tip');
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(meshes)[0];
    if (!hit) { tip.hidden = true; return; }
    const blk = hit.object.userData.blocks[hit.instanceId];
    tip.innerHTML = `<b>${BLOCKS[blk.id].n}</b><code>${blk.id}</code><span>${blk.x}, ${blk.y}, ${blk.z}</span>`;
    tip.style.left = Math.min(e.clientX - r.left + 12, r.width - 200) + 'px';
    tip.style.top = Math.max(e.clientY - r.top - 50, 8) + 'px';
    tip.hidden = false;
  });

  // ---------- Панель ----------
  const TYPE_LABEL = { slot: 'Слот тайника', clue: 'Место подсказки', secret: 'Секрет', room: 'Помещение' };
  const sel = $('#pick');
  const groups = {};
  STRUCTURES.forEach((s, i) => { (groups[s.group] = groups[s.group] || []).push([s, i]); });
  for (const [g, list] of Object.entries(groups)) {
    const og = document.createElement('optgroup');
    og.label = g;
    for (const [s, i] of list) og.appendChild(new Option(s.name, i));
    sel.appendChild(og);
  }

  function selectMark(i) {
    const m = markObjs[i];
    if (!m) return;
    state.focus = i;
    document.querySelectorAll('.marks li').forEach((li, k) => li.classList.toggle('on', k === i));
    const p = m.obj.position;
    if (m.mk.y < 0 && state.env) setEnv(false);
    controls.target.set(p.x, p.y, p.z);
    const dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, 14);
    controls.update();
  }

  function setEnv(v) {
    state.env = v;
    $('#env').checked = v;
    draw();
  }

  function palette(b) {
    const count = {};
    for (const v of b.blocks.values()) if (!v.env && !v.g) count[v.id] = (count[v.id] || 0) + 1;
    return Object.entries(count).sort((a, c) => c[1] - a[1]).slice(0, 10);
  }

  function load(i, variant) {
    state.i = i;
    const s = STRUCTURES[i];
    state.variant = variant || (s.states ? s.states[0].id : null);
    state.built = s.build(state.variant);
    state.focus = -1;
    sel.value = String(i);
    try { localStorage.setItem('taiga-preview', String(i)); } catch (e) { /* хранилище недоступно */ }
    const { mn, mx } = bounds(state.built);
    const slider = $('#cut');
    slider.min = mn[1];
    slider.max = mx[1] - 1;
    slider.value = mx[1] - 1;
    state.cut = Infinity;
    $('#cutval').textContent = 'всё';
    tip.hidden = true;

    const nStruct = [...state.built.blocks.values()].filter((v) => !v.env).length;
    let w = 0, d = 0;
    { const xs = [], zs = []; for (const v of state.built.blocks.values()) if (!v.env) { xs.push(v.x); zs.push(v.z); } w = Math.max(...xs) - Math.min(...xs) + 1; d = Math.max(...zs) - Math.min(...zs) + 1; }
    $('#group').textContent = s.group;
    $('#name').textContent = s.name;
    $('#meta').innerHTML = [
      `<span class="chip rarity r-${s.rarity.replace(/\s/g, '')}">${s.rarity}</span>`,
      `<span class="chip">${w}×${d}, высота ${mx[1] - Math.max(mn[1], 0)}</span>`,
      `<span class="chip">${nStruct} блоков</span>`,
    ].join('');
    $('#biomes').textContent = s.biomes;
    $('#desc').textContent = s.desc;
    const vs = $('#variants');
    vs.hidden = !s.states;
    vs.innerHTML = '';
    if (s.states) for (const st of s.states) {
      const btn = document.createElement('button');
      btn.textContent = st.label;
      btn.setAttribute('aria-pressed', st.id === state.variant);
      btn.addEventListener('click', () => load(i, st.id));
      vs.appendChild(btn);
    }
    $('#marks').innerHTML = state.built.marks.map((m, k) =>
      `<li data-k="${k}" class="${m.type}"><button><span class="num">${k + 1}</span><span class="txt"><b>${m.title}</b><em>${TYPE_LABEL[m.type]}${m.y < 0 ? ' · под землёй' : ''}</em><span>${m.desc}</span></span></button></li>`).join('');
    document.querySelectorAll('#marks li').forEach((li) => li.querySelector('button').addEventListener('click', () => selectMark(+li.dataset.k)));
    $('#territory').innerHTML = s.territory.map((t) => `<li>${t}</li>`).join('');
    $('#palette').innerHTML = palette(state.built).map(([id, n]) =>
      `<li><i style="background:${BLOCKS[id].c}"></i><span>${BLOCKS[id].n}</span><small>${n}</small></li>`).join('');
    draw();
    frame(state.built);
  }

  sel.addEventListener('change', () => load(+sel.value));
  $('#prev').addEventListener('click', () => load((state.i - 1 + STRUCTURES.length) % STRUCTURES.length));
  $('#next').addEventListener('click', () => load((state.i + 1) % STRUCTURES.length));
  $('#cut').addEventListener('input', (e) => {
    const v = +e.target.value;
    state.cut = v >= +e.target.max ? Infinity : v;
    $('#cutval').textContent = state.cut === Infinity ? 'всё' : 'до y = ' + v;
    draw();
  });
  $('#env').addEventListener('change', (e) => setEnv(e.target.checked));
  $('#reset').addEventListener('click', () => frame(state.built));

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener && mq.addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  new ResizeObserver(resize).observe(wrap);
  applyTheme();
  resize();

  let start = 0;
  try { start = Math.min(+localStorage.getItem('taiga-preview') || 0, STRUCTURES.length - 1); } catch (e) { /* хранилище недоступно */ }
  const hashId = location.hash.slice(1);
  const hi = STRUCTURES.findIndex((s) => s.id === hashId);
  load(hi >= 0 ? hi : start);

  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    for (const m of markObjs) m.solid.material.opacity = m.i === state.focus ? 0.35 + Math.sin(t * 5) * 0.15 : 0.16;
    controls.update();
    renderer.render(scene, camera);
    placeBadges();
  })();
})();
