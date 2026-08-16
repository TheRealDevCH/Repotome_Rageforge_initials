/* ==========================================================================
   Rageforge Mirror Cube — Three.js hero
   A borderless, fully reflective cube. Drag to orbit, scroll to progress.
   ========================================================================== */

import * as THREE from 'https://esm.sh/three@0.169.0';

const canvas = document.getElementById('cube-canvas');
if (canvas) initCube(canvas);

function initCube(canvas) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = canvas.parentElement;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(3.1, 2.05, 4.35);
  camera.lookAt(0, 0, 0);

  /* ---- environment: gives the mirror something real to reflect ---- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromScene(buildWorld(), 0.04);
  scene.environment = envRT.texture;

  /* ---- the cube ---- */
  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  const mirrorMat = new THREE.MeshPhysicalMaterial({
    color: 0xdfe8f7,
    metalness: 1.0,
    roughness: 0.035,
    envMapIntensity: 1.45,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    reflectivity: 1.0
  });

  const cube = new THREE.Mesh(new THREE.BoxGeometry(1.62, 1.62, 1.62, 1, 1, 1), mirrorMat);
  cubeGroup.add(cube);

  /* faint inner glass shell — hints at depth without adding a border */
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(1.605, 1.605, 1.605),
    new THREE.MeshPhysicalMaterial({
      color: 0x94b7f5,
      transparent: true,
      opacity: 0.16,
      roughness: 0.0,
      metalness: 0.0,
      transmission: 0.85,
      ior: 1.42,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  cubeGroup.add(shell);

  /* ---- orbiting satellite cubes: show the infinite-mirror idea ---- */
  const satellites = [];
  const satGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const satMat = new THREE.MeshPhysicalMaterial({
    color: 0xb9d2ff, metalness: 1.0, roughness: 0.12, envMapIntensity: 1.2
  });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(satGeo, satMat);
    const a = (i / 5) * Math.PI * 2;
    s.userData = { a, r: 2.35 + (i % 2) * 0.32, y: -0.5 + i * 0.26, sp: 0.16 + i * 0.035 };
    satellites.push(s);
    scene.add(s);
  }

  /* ---- lights: rim highlights so the silhouette reads on dark bg ---- */
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(4, 5.5, 3);
  scene.add(key);

  const rimA = new THREE.DirectionalLight(0x94b7f5, 2.6);
  rimA.position.set(-4.5, 1.4, -2.6);
  scene.add(rimA);

  const rimB = new THREE.DirectionalLight(0xc0bcae, 1.15);
  rimB.position.set(1.6, -3.2, -3.4);
  scene.add(rimB);

  scene.add(new THREE.HemisphereLight(0xb9d2ff, 0x0b1017, 0.55));

  /* ---- ground contact glow ---- */
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 64),
    new THREE.MeshBasicMaterial({
      color: 0x94b7f5, transparent: true, opacity: 0.075, depthWrite: false
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -1.42;
  scene.add(glow);

  /* ---- interaction: drag to orbit, with inertia ---- */
  const state = {
    tx: 0.62, ty: 0.36,      // target rotation
    cx: 0.62, cy: 0.36,      // current rotation
    vx: 0, vy: 0,            // velocity
    dragging: false,
    px: 0, py: 0,
    auto: 0.0032,            // idle spin speed
    scroll: 0,
    hover: false
  };

  const onDown = (e) => {
    state.dragging = true;
    state.px = e.clientX ?? e.touches[0].clientX;
    state.py = e.clientY ?? e.touches[0].clientY;
    stage.classList.add('grabbing');
  };
  const onMove = (e) => {
    if (!state.dragging) return;
    const x = e.clientX ?? e.touches[0].clientX;
    const y = e.clientY ?? e.touches[0].clientY;
    state.vx = (x - state.px) * 0.0062;
    state.vy = (y - state.py) * 0.0052;
    state.tx += state.vx;
    state.ty = Math.max(-0.95, Math.min(1.15, state.ty + state.vy));
    state.px = x;
    state.py = y;
  };
  const onUp = () => { state.dragging = false; stage.classList.remove('grabbing'); };

  stage.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  stage.addEventListener('pointerleave', () => { state.hover = false; });
  stage.addEventListener('pointerenter', () => { state.hover = true; });
  stage.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onUp);

  /* subtle parallax from pointer when not dragging */
  let pointerNX = 0, pointerNY = 0;
  window.addEventListener('pointermove', (e) => {
    pointerNX = (e.clientX / window.innerWidth - 0.5) * 2;
    pointerNY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  /* scroll drives a slow dolly + tilt so hero and page feel connected */
  window.addEventListener('scroll', () => {
    state.scroll = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
  }, { passive: true });

  /* face labels follow the cube */
  const faceHint = document.getElementById('face-hint');
  const FACES = ['Front', 'Right', 'Back', 'Left'];

  /* ---- resize ---- */
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(stage);

  /* ---- entrance animation ---- */
  let intro = 0;
  cubeGroup.scale.setScalar(0.001);

  /* ---- render loop ---- */
  const clock = new THREE.Clock();
  let visible = true;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;

    const t = clock.getElapsedTime();
    const dt = Math.min(clock.getDelta(), 0.05);

    /* intro: scale + unwind spin */
    if (intro < 1) {
      intro = Math.min(1, intro + dt * 0.85);
      const e = 1 - Math.pow(1 - intro, 4);
      cubeGroup.scale.setScalar(e);
      state.cx = 0.62 + (1 - e) * 2.4;
    }

    /* idle spin unless the user is dragging */
    if (!state.dragging && !reduced) {
      state.tx += state.auto * (state.hover ? 0.35 : 1);
      state.vx *= 0.92;
      state.vy *= 0.92;
      state.tx += state.vx * 0.35;
    }

    /* eased follow */
    state.cx += (state.tx - state.cx) * (state.dragging ? 0.32 : 0.075);
    state.cy += (state.ty - state.cy) * (state.dragging ? 0.32 : 0.075);

    cubeGroup.rotation.y = state.cx;
    cubeGroup.rotation.x = state.cy * 0.55;

    /* gentle float */
    if (!reduced) {
      cubeGroup.position.y = Math.sin(t * 0.85) * 0.055;
      cubeGroup.rotation.z = Math.sin(t * 0.55) * 0.022;
    }

    /* satellites orbit */
    satellites.forEach((s) => {
      const d = s.userData;
      d.a += d.sp * dt;
      s.position.set(Math.cos(d.a) * d.r, d.y + Math.sin(d.a * 1.6) * 0.16, Math.sin(d.a) * d.r);
      s.rotation.x += dt * 0.5;
      s.rotation.y += dt * 0.35;
    });

    /* camera: pointer parallax + scroll dolly */
    const px = pointerNX * 0.28;
    const py = -pointerNY * 0.2;
    const dolly = state.scroll * 1.5;
    camera.position.x += (3.1 + px - camera.position.x) * 0.055;
    camera.position.y += (2.05 + py + state.scroll * 0.9 - camera.position.y) * 0.055;
    camera.position.z += (4.35 + dolly - camera.position.z) * 0.055;
    camera.lookAt(0, state.scroll * 0.25, 0);

    /* fade the whole stage out as the page scrolls past the hero */
    stage.style.opacity = String(Math.max(0, 1 - state.scroll * 1.25));

    /* which face is toward the viewer */
    if (faceHint) {
      const idx = Math.round(((state.cx % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2)) % 4;
      const label = FACES[idx];
      if (faceHint.dataset.face !== label) {
        faceHint.dataset.face = label;
        faceHint.textContent = label + ' face';
      }
    }

    renderer.render(scene, camera);
  }
  frame();

  canvas.classList.add('ready');

  /* ------------------------------------------------------------------
     A small procedural "world" that the mirror reflects.
     Room shell + coloured blocks, in Minecraft-ish tones.
     ------------------------------------------------------------------ */
  function buildWorld() {
    const w = new THREE.Scene();

    const add = (geo, color, pos, emissive = 0) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: emissive ? 1.5 : 0,
        roughness: 0.68
      }));
      m.position.set(pos[0], pos[1], pos[2]);
      w.add(m);
      return m;
    };

    /* enclosing sky dome, seen from the inside */
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(26, 32, 20),
      new THREE.MeshBasicMaterial({ color: 0x0d1524, side: THREE.BackSide })
    );
    w.add(dome);

    /* ground slab */
    add(new THREE.BoxGeometry(52, 1, 52), 0x2f3a2a, [0, -8, 0]);

    /* emissive panels — these become the bright streaks across the mirror */
    add(new THREE.BoxGeometry(8, 0.35, 8), 0xffffff, [0, 7.6, 0], 0xffffff);
    add(new THREE.BoxGeometry(0.3, 6, 6), 0x94b7f5, [-8.4, 1.6, 0], 0x94b7f5);
    add(new THREE.BoxGeometry(0.3, 5, 5), 0xc0bcae, [8.4, 0.4, 1.5], 0xc0bcae);
    add(new THREE.BoxGeometry(5, 4, 0.3), 0xb9d2ff, [0, 1.2, -8.8], 0xb9d2ff);

    /* scattered blocks give the reflection texture and depth */
    const tones = [0x6b8f5a, 0x8a7358, 0x5a6b7f, 0x9a8d6f, 0x4a5a6a];
    for (let i = 0; i < 26; i++) {
      const s = 0.7 + Math.random() * 1.7;
      const a = Math.random() * Math.PI * 2;
      const r = 5.5 + Math.random() * 8;
      add(new THREE.BoxGeometry(s, s, s), tones[i % tones.length], [
        Math.cos(a) * r,
        -6.5 + Math.random() * 4,
        Math.sin(a) * r
      ]);
    }
    return w;
  }
}
