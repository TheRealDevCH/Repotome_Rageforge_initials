import * as THREE from 'https://esm.sh/three@0.169.0';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR_CAP = window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio;

const running = new Set();

function makeRenderer(canvas, alpha = true) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha,
    powerPreference: 'high-performance',
    stencil: false
  });
  renderer.setPixelRatio(DPR_CAP);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

function autoResize(renderer, camera, host, onResize) {
  const apply = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (onResize) onResize(w, h);
  };
  apply();
  new ResizeObserver(apply).observe(host);
  window.addEventListener('orientationchange', () => setTimeout(apply, 120));
  return apply;
}

function driveWhenVisible(host, tick) {
  const entry = { tick, active: false };
  running.add(entry);
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { entry.active = e.isIntersecting; }),
    { rootMargin: '120px' }
  );
  io.observe(host);
  return entry;
}

const clock = new THREE.Clock();
let pageVisible = true;
document.addEventListener('visibilitychange', () => { pageVisible = !document.hidden; });

function loop() {
  requestAnimationFrame(loop);
  if (!pageVisible) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  running.forEach((e) => { if (e.active) e.tick(dt, t); });
}
loop();

const pointer = { nx: 0, ny: 0 };
window.addEventListener('pointermove', (e) => {
  pointer.nx = (e.clientX / window.innerWidth - 0.5) * 2;
  pointer.ny = (e.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });

let scrollNorm = 0;
window.addEventListener('scroll', () => {
  scrollNorm = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
}, { passive: true });

function buildReflectedWorld() {
  const w = new THREE.Scene();

  const add = (geo, color, pos, emissive = 0, rough = 0.66) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: emissive ? 1.6 : 0,
      roughness: rough,
      metalness: 0.02
    }));
    m.position.set(pos[0], pos[1], pos[2]);
    w.add(m);
    return m;
  };

  w.add(new THREE.Mesh(
    new THREE.SphereGeometry(30, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0x0c1420, side: THREE.BackSide })
  ));

  add(new THREE.BoxGeometry(64, 1, 64), 0x2c3728, [0, -9, 0], 0, 0.85);

  add(new THREE.BoxGeometry(10, 0.3, 10), 0xffffff, [0, 8.4, 0], 0xffffff);
  add(new THREE.BoxGeometry(0.28, 7, 7), 0x94b7f5, [-9.2, 1.8, 0], 0x94b7f5);
  add(new THREE.BoxGeometry(0.28, 5.5, 5.5), 0xc0bcae, [9.2, 0.2, 1.6], 0xc0bcae);
  add(new THREE.BoxGeometry(6, 4.4, 0.28), 0xbcd4ff, [0, 1.4, -9.6], 0xbcd4ff);
  add(new THREE.BoxGeometry(4, 0.28, 4), 0xf0b64a, [4.2, -5.5, 4.2], 0xf0b64a);

  const tones = [0x6b8f5a, 0x8a7358, 0x566578, 0x9a8d6f, 0x45525f, 0x7d8a6b];
  for (let i = 0; i < 34; i++) {
    const s = 0.65 + ((i * 37) % 100) / 100 * 1.9;
    const a = (i / 34) * Math.PI * 2 + ((i * 17) % 30) / 30;
    const r = 5.8 + ((i * 53) % 100) / 100 * 9;
    add(new THREE.BoxGeometry(s, s, s), tones[i % tones.length], [
      Math.cos(a) * r,
      -7.4 + ((i * 29) % 100) / 100 * 5.2,
      Math.sin(a) * r
    ]);
  }
  return w;
}

const envCache = new WeakMap();
function getEnv(renderer) {
  const cached = envCache.get(renderer);
  if (cached) return cached;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromScene(buildReflectedWorld(), 0.03).texture;
  pmrem.dispose();
  envCache.set(renderer, env);
  return env;
}

function mirrorMaterial(env, rough = 0.03) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xe2eaf8,
    metalness: 1,
    roughness: rough,
    envMap: env,
    envMapIntensity: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.05
  });
}

function standardRig(scene) {
  const key = new THREE.DirectionalLight(0xffffff, 2.05);
  key.position.set(4.4, 6, 3.2);
  scene.add(key);

  const rimA = new THREE.DirectionalLight(0x94b7f5, 2.5);
  rimA.position.set(-5, 1.5, -2.8);
  scene.add(rimA);

  const rimB = new THREE.DirectionalLight(0xc0bcae, 1.1);
  rimB.position.set(1.8, -3.4, -3.6);
  scene.add(rimB);

  scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x0d1218, 0.5));
}

function initHero(canvas) {
  const host = canvas.parentElement;
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
  camera.position.set(3.2, 2.1, 4.5);

  const env = getEnv(renderer);
  scene.environment = env;

  const group = new THREE.Group();
  scene.add(group);

  const cube = new THREE.Mesh(new THREE.BoxGeometry(1.66, 1.66, 1.66), mirrorMaterial(env));
  group.add(cube);

  const cubeEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cube.geometry),
    new THREE.LineBasicMaterial({ color: 0x090b11, transparent: true, opacity: 0.9 })
  );
  group.add(cubeEdges);

  const edgeGlow = new THREE.Mesh(
    new THREE.BoxGeometry(1.664, 1.664, 1.664),
    new THREE.MeshPhysicalMaterial({
      color: 0x94b7f5,
      transparent: true,
      opacity: 0.14,
      roughness: 0,
      transmission: 0.9,
      ior: 1.45,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  group.add(edgeGlow);

  const satGeo = new THREE.BoxGeometry(0.19, 0.19, 0.19);
  const satMat = mirrorMaterial(env, 0.11);
  const sats = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(satGeo, satMat);
    m.userData = {
      a: (i / 7) * Math.PI * 2,
      r: 2.4 + (i % 3) * 0.34,
      y: -0.62 + i * 0.2,
      sp: 0.14 + i * 0.028
    };
    sats.push(m);
    scene.add(m);
  }

  const grid = new THREE.GridHelper(26, 26, 0x94b7f5, 0x1b2430);
  grid.material.transparent = true;
  grid.material.opacity = 0.13;
  grid.position.y = -1.52;
  scene.add(grid);

  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(2.7, 72),
    new THREE.MeshBasicMaterial({ color: 0x94b7f5, transparent: true, opacity: 0.06, depthWrite: false })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -1.5;
  scene.add(pool);

  standardRig(scene);

  const st = {
    tx: 0.62, ty: 0.34,
    cx: 3.0, cy: 0.34,
    vx: 0, vy: 0,
    dragging: false,
    px: 0, py: 0,
    hover: false,
    intro: 0
  };

  group.scale.setScalar(0.001);

  const coord = (e) => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };

  const down = (e) => {
    st.dragging = true;
    const c = coord(e);
    st.px = c.x;
    st.py = c.y;
    host.classList.add('grabbing');
  };

  const move = (e) => {
    if (!st.dragging) return;
    const c = coord(e);
    st.vx = (c.x - st.px) * 0.0064;
    st.vy = (c.y - st.py) * 0.0052;
    st.tx += st.vx;
    st.ty = Math.max(-0.98, Math.min(1.18, st.ty + st.vy));
    st.px = c.x;
    st.py = c.y;
  };

  const up = () => { st.dragging = false; host.classList.remove('grabbing'); };

  host.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  host.addEventListener('pointerenter', () => { st.hover = true; });
  host.addEventListener('pointerleave', () => { st.hover = false; });
  host.addEventListener('touchstart', down, { passive: true });
  window.addEventListener('touchmove', move, { passive: true });
  window.addEventListener('touchend', up);

  const faceHint = document.getElementById('face-hint');
  const FACES = ['front', 'right', 'back', 'left'];

  autoResize(renderer, camera, host, (w) => {
    camera.fov = w < 760 ? 46 : w < 1400 ? 39 : 34;
    camera.updateProjectionMatrix();
  });

  driveWhenVisible(host, (dt, t) => {
    if (st.intro < 1) {
      st.intro = Math.min(1, st.intro + dt * 0.8);
      const e = 1 - Math.pow(1 - st.intro, 4);
      group.scale.setScalar(e);
      st.tx = 0.62;
      st.cx += (0.62 - st.cx) * 0.05;
    }

    if (!st.dragging && !REDUCED) {
      st.tx += 0.0031 * (st.hover ? 0.32 : 1);
      st.vx *= 0.9;
      st.vy *= 0.9;
      st.tx += st.vx * 0.34;
    }

    const k = st.dragging ? 0.3 : 0.07;
    st.cx += (st.tx - st.cx) * k;
    st.cy += (st.ty - st.cy) * k;

    group.rotation.y = st.cx;
    group.rotation.x = st.cy * 0.54;

    if (!REDUCED) {
      group.position.y = Math.sin(t * 0.82) * 0.05;
      group.rotation.z = Math.sin(t * 0.52) * 0.02;
    }

    sats.forEach((s) => {
      const d = s.userData;
      d.a += d.sp * dt;
      s.position.set(Math.cos(d.a) * d.r, d.y + Math.sin(d.a * 1.7) * 0.15, Math.sin(d.a) * d.r);
      s.rotation.x += dt * 0.48;
      s.rotation.y += dt * 0.33;
    });

    const px = pointer.nx * 0.3;
    const py = -pointer.ny * 0.2;
    camera.position.x += (3.2 + px - camera.position.x) * 0.05;
    camera.position.y += (2.1 + py + scrollNorm * 1.0 - camera.position.y) * 0.05;
    camera.position.z += (4.5 + scrollNorm * 1.7 - camera.position.z) * 0.05;
    camera.lookAt(0, scrollNorm * 0.3, 0);

    host.style.opacity = String(Math.max(0, 1 - scrollNorm * 1.22));

    if (faceHint) {
      const tau = Math.PI * 2;
      const idx = Math.round((((st.cx % tau) + tau) % tau) / (Math.PI / 2)) % 4;
      if (faceHint.dataset.f !== FACES[idx]) {
        faceHint.dataset.f = FACES[idx];
        faceHint.textContent = FACES[idx] + ' face';
      }
    }

    renderer.render(scene, camera);
  }).active = true;

  canvas.classList.add('ready');
}

function initPlaneDemo(canvas) {
  const host = canvas.parentElement;
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  camera.position.set(0, 1.5, 6.6);
  camera.lookAt(0, 0.2, 0);

  const env = getEnv(renderer);
  scene.environment = env;
  standardRig(scene);

  const planeY = 0;
  const mirrorPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 4.6),
    new THREE.MeshPhysicalMaterial({
      color: 0xbcd4ff,
      metalness: 1,
      roughness: 0.06,
      envMap: env,
      envMapIntensity: 1.2,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide
    })
  );
  mirrorPlane.rotation.x = -Math.PI / 2;
  mirrorPlane.position.y = planeY;
  scene.add(mirrorPlane);

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(7.2, 4.6)),
    new THREE.LineBasicMaterial({ color: 0x94b7f5, transparent: true, opacity: 0.55 })
  );
  outline.rotation.x = -Math.PI / 2;
  scene.add(outline);

  const realGroup = new THREE.Group();
  const mirrorGroup = new THREE.Group();
  scene.add(realGroup, mirrorGroup);

  const camGeo = new THREE.ConeGeometry(0.3, 0.62, 4);
  const realCam = new THREE.Mesh(camGeo, new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0x94b7f5, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.3
  }));
  const ghostCam = new THREE.Mesh(camGeo, new THREE.MeshStandardMaterial({
    color: 0x94b7f5, emissive: 0x94b7f5, emissiveIntensity: 0.35,
    roughness: 0.5, transparent: true, opacity: 0.5
  }));
  realGroup.add(realCam);
  mirrorGroup.add(ghostCam);

  const blockMat = new THREE.MeshStandardMaterial({ color: 0x6b8f5a, roughness: 0.7 });
  const ghostMat = new THREE.MeshStandardMaterial({
    color: 0x6b8f5a, roughness: 0.7, transparent: true, opacity: 0.34
  });

  const props = [
    { p: [-1.5, 0.42, -0.6], s: 0.82 },
    { p: [1.35, 0.32, 0.5], s: 0.62 },
    { p: [0.2, 0.55, -1.5], s: 1.08 }
  ];

  props.forEach((o) => {
    const g = new THREE.BoxGeometry(o.s, o.s, o.s);
    const a = new THREE.Mesh(g, blockMat);
    a.position.set(o.p[0], o.p[1], o.p[2]);
    realGroup.add(a);
    const b = new THREE.Mesh(g, ghostMat);
    b.position.set(o.p[0], -o.p[1], o.p[2]);
    mirrorGroup.add(b);
  });

  const rayMat = new THREE.LineDashedMaterial({
    color: 0xbcd4ff, dashSize: 0.16, gapSize: 0.12, transparent: true, opacity: 0.75
  });
  const rayGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()
  ]);
  const ray = new THREE.Line(rayGeo, rayMat);
  scene.add(ray);

  autoResize(renderer, camera, host, (w) => {
    camera.fov = w < 700 ? 52 : 42;
    camera.updateProjectionMatrix();
  });

  driveWhenVisible(host, (dt, t) => {
    const a = t * 0.32;
    const ex = Math.cos(a) * 2.5;
    const ez = Math.sin(a) * 1.3 + 2.4;
    const ey = 1.25 + Math.sin(t * 0.5) * 0.28;

    realCam.position.set(ex, ey, ez);
    realCam.lookAt(0, 0, 0);
    realCam.rotateX(Math.PI / 2);

    ghostCam.position.set(ex, -ey, ez);
    ghostCam.lookAt(0, 0, 0);
    ghostCam.rotateX(-Math.PI / 2);

    const hit = new THREE.Vector3(ex * 0.34, 0, ez * 0.34);
    const pts = ray.geometry.attributes.position;
    pts.setXYZ(0, ex, ey, ez);
    pts.setXYZ(1, hit.x, hit.y, hit.z);
    pts.setXYZ(2, ex, -ey, ez);
    pts.needsUpdate = true;
    ray.computeLineDistances();

    camera.position.x += (pointer.nx * 0.7 - camera.position.x) * 0.03;
    camera.position.y += (1.6 - pointer.ny * 0.4 - camera.position.y) * 0.03;
    camera.lookAt(0, 0.1, 0);

    renderer.render(scene, camera);
  });
}

function initRecursionDemo(canvas) {
  const host = canvas.parentElement;
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
  camera.position.set(0, 0.4, 7.4);
  camera.lookAt(0, 0, 0);

  const env = getEnv(renderer);
  scene.environment = env;
  standardRig(scene);

  const shellGeo = new THREE.BoxGeometry(1, 1, 1);
  const shells = [];
  const LEVELS = 7;

  for (let i = 0; i < LEVELS; i++) {
    const f = 1 - i / LEVELS;
    const m = new THREE.Mesh(shellGeo, new THREE.MeshPhysicalMaterial({
      color: 0xdfe8f7,
      metalness: 1,
      roughness: 0.03 + i * 0.045,
      envMap: env,
      envMapIntensity: 1.45 * f + 0.12,
      transparent: true,
      opacity: 0.28 + f * 0.62
    }));
    const s = 2.55 * Math.pow(0.7, i);
    m.scale.setScalar(s);
    m.userData = { i, base: s };
    shells.push(m);
    scene.add(m);
  }

  const frames = shells.map((s) => {
    const l = new THREE.LineSegments(
      new THREE.EdgesGeometry(shellGeo),
      new THREE.LineBasicMaterial({
        color: 0x94b7f5,
        transparent: true,
        opacity: 0.5 - s.userData.i * 0.055
      })
    );
    l.scale.copy(s.scale);
    scene.add(l);
    return l;
  });

  const depthLabel = document.getElementById('depth-live');
  let shown = LEVELS;

  autoResize(renderer, camera, host, (w) => {
    camera.fov = w < 700 ? 50 : 40;
    camera.position.z = w < 700 ? 8.6 : 7.4;
    camera.updateProjectionMatrix();
  });

  driveWhenVisible(host, (dt, t) => {
    const cycle = (Math.sin(t * 0.22) + 1) / 2;
    const limit = 1 + Math.floor(cycle * (LEVELS - 0.001));

    if (limit !== shown) {
      shown = limit;
      if (depthLabel) depthLabel.textContent = String(shown);
    }

    shells.forEach((m, i) => {
      const on = i < limit;
      const target = on ? m.userData.base : 0.001;
      m.scale.x += (target - m.scale.x) * 0.09;
      m.scale.y = m.scale.x;
      m.scale.z = m.scale.x;
      m.rotation.y = t * (0.14 + i * 0.055);
      m.rotation.x = t * (0.07 + i * 0.03);
      frames[i].scale.copy(m.scale);
      frames[i].rotation.copy(m.rotation);
      frames[i].visible = on;
    });

    camera.position.x += (pointer.nx * 0.85 - camera.position.x) * 0.028;
    camera.position.y += (0.4 - pointer.ny * 0.5 - camera.position.y) * 0.028;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  });
}

const heroCanvas = document.getElementById('cube-canvas');
if (heroCanvas) initHero(heroCanvas);

const planeCanvas = document.getElementById('plane-canvas');
if (planeCanvas) initPlaneDemo(planeCanvas);

const recCanvas = document.getElementById('recursion-canvas');
if (recCanvas) initRecursionDemo(recCanvas);
