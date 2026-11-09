import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/* ============================================================
   GLOBAL STATE & CLOCK
   ============================================================ */
const clock = new THREE.Clock();
let scene, camera, renderer;
let carGroup, carModel;
let orbitalEarthGroup, earthMesh;
let starsDeep, starsMid, starsNear;
let isIntroActive = true;
const introBlend = { value: 0 };
const currentLookAt = new THREE.Vector3(-0.35, 0.15, 0);

// Directional Sun in space (Top-Right to match Earth cloud shadow angle)
const sunPosition = new THREE.Vector3(26, 30, 20);

// Expose state for inspection
window.__state = { carLoaded: false, earthLoaded: false };
window.scene = scene;

// Smooth mouse tracking with multi-layer inertia
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
const windowHalf = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

// DOM
const canvas = document.getElementById('webgl');
const flickerItems = document.querySelectorAll('.flicker-item');

/* ============================================================
   INITIALIZATION
   ============================================================ */
initThree();
initDeepCosmosWithLayers();
initCinematicSunlight();
initPhotorealisticOrbitalEarth();
loadFerrariF40();
initEvents();
animate();

/* ============================================================
   THREE.JS SETUP & REALISTIC SPACE ENVIRONMENT MAP
   ============================================================ */
function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  window.scene = scene;

  camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 4000);
  // Initial camera position matches the exact starting point of the cinematic dive (NO jump on load!)
  camera.position.set(0.2, 0.3, 10.0);
  camera.lookAt(currentLookAt);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  // Unified Cosmic Environment: binds car reflections to Earth & cosmic space
  scene.environment = createSpaceEnvironment();

  carGroup = new THREE.Group();
  carGroup.visible = false;
  scene.add(carGroup);
  window.__carGroup = carGroup;
}

/* ============================================================
   COSMIC ENVIRONMENT MAP (PHYSICAL IBL REFLECTIONS)
   ============================================================ */
function createSpaceEnvironment() {
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 1024;
  envCanvas.height = 512;
  const ctx = envCanvas.getContext('2d');

  // Deep space gradient with radiant blue Earth albedo on the lower hemisphere
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#000002');
  grad.addColorStop(0.46, '#010408');
  grad.addColorStop(0.55, '#051b3b'); // Ethereal atmospheric horizon glow
  grad.addColorStop(0.72, '#12437a'); // Deep Pacific ocean reflection
  grad.addColorStop(0.88, '#2667ab'); // Cloud reflectance
  grad.addColorStop(1.0, '#0a233d');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Radiant orbital Sun highlight in upper right
  const sunGrad = ctx.createRadialGradient(720, 140, 0, 720, 140, 90);
  sunGrad.addColorStop(0, '#ffffff');
  sunGrad.addColorStop(0.2, '#f8fafc');
  sunGrad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  sunGrad.addColorStop(1.0, 'transparent');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(720, 140, 90, 0, Math.PI * 2);
  ctx.fill();

  const envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  return envTex;
}

/* ============================================================
   POWERFUL CINEMATIC SPACE LIGHTING (VACUUM CONTRAST)
   ============================================================ */
function initCinematicSunlight() {
  // Ambient cosmic vacuum: deep, cold dark
  const ambient = new THREE.AmbientLight(0x0a101d, 0.45);
  scene.add(ambient);

  // Key Sun (Matching real sun position from Earth cloud shadows)
  const sunLight = new THREE.DirectionalLight(0xffffff, 4.4);
  sunLight.position.copy(sunPosition);
  sunLight.target.position.set(-0.5, 0.2, 0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Earth Albedo bounce: soft upward blue/cyan glow reflecting from oceans
  const earthBounce = new THREE.DirectionalLight(0x2563eb, 0.65);
  earthBounce.position.set(-15, -25, 8);
  earthBounce.target.position.set(0, 0, 0);
  scene.add(earthBounce);
  scene.add(earthBounce.target);

  // Space rim highlight on spoiler & roof edge
  const rimLight = new THREE.DirectionalLight(0xf1f5f9, 1.4);
  rimLight.position.set(-20, 20, -10);
  scene.add(rimLight);
}

/* ============================================================
   TRUE CINEMATIC DEEP SPACE (3-TIER PARALLAX, REAL DEPTH)
   ============================================================ */
function initDeepCosmosWithLayers() {
  // LAYER 1: Distant Galactic Dust & Faint Stars
  const deepCount = 8000;
  const deepGeo = new THREE.BufferGeometry();
  const deepPos = new Float32Array(deepCount * 3);
  const deepCol = new Float32Array(deepCount * 3);

  for (let i = 0; i < deepCount; i++) {
    const r = 900 + Math.random() * 1200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    deepPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    deepPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    deepPos[i * 3 + 2] = r * Math.cos(phi);

    const bri = Math.pow(Math.random(), 4.0) * 0.5 + 0.08;
    deepCol[i * 3]     = bri * 0.92;
    deepCol[i * 3 + 1] = bri * 0.96;
    deepCol[i * 3 + 2] = bri * 1.05;
  }
  deepGeo.setAttribute('position', new THREE.BufferAttribute(deepPos, 3));
  deepGeo.setAttribute('color', new THREE.BufferAttribute(deepCol, 3));
  starsDeep = new THREE.Points(deepGeo, new THREE.PointsMaterial({
    size: 0.75,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true
  }));
  scene.add(starsDeep);

  // LAYER 2: Mid-range Crisp Stars
  const midCount = 2800;
  const midGeo = new THREE.BufferGeometry();
  const midPos = new Float32Array(midCount * 3);
  const midCol = new Float32Array(midCount * 3);

  for (let i = 0; i < midCount; i++) {
    const r = 450 + Math.random() * 450;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    midPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    midPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    midPos[i * 3 + 2] = r * Math.cos(phi);

    const bri = Math.pow(Math.random(), 3.0) * 0.75 + 0.25;
    midCol[i * 3]     = bri;
    midCol[i * 3 + 1] = bri * 0.98;
    midCol[i * 3 + 2] = bri * 1.02;
  }
  midGeo.setAttribute('position', new THREE.BufferAttribute(midPos, 3));
  midGeo.setAttribute('color', new THREE.BufferAttribute(midCol, 3));
  starsMid = new THREE.Points(midGeo, new THREE.PointsMaterial({
    size: 1.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    sizeAttenuation: true
  }));
  scene.add(starsMid);

  // LAYER 3: Foreground Brilliant Beacons
  const nearCount = 350;
  const nearGeo = new THREE.BufferGeometry();
  const nearPos = new Float32Array(nearCount * 3);
  const nearCol = new Float32Array(nearCount * 3);

  for (let i = 0; i < nearCount; i++) {
    const r = 250 + Math.random() * 250;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    nearPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    nearPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    nearPos[i * 3 + 2] = r * Math.cos(phi);

    const warm = Math.random() > 0.65;
    nearCol[i * 3]     = warm ? 1.0 : 0.88;
    nearCol[i * 3 + 1] = warm ? 0.94 : 0.96;
    nearCol[i * 3 + 2] = warm ? 0.78 : 1.0;
  }
  nearGeo.setAttribute('position', new THREE.BufferAttribute(nearPos, 3));
  nearGeo.setAttribute('color', new THREE.BufferAttribute(nearCol, 3));
  starsNear = new THREE.Points(nearGeo, new THREE.PointsMaterial({
    size: 1.6,
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    sizeAttenuation: true
  }));
  scene.add(starsNear);
}

/* ============================================================
   PHOTOREALISTIC ORBITAL EARTH (NASA ISS HIGH-RES DETAIL)
   ============================================================ */
function initPhotorealisticOrbitalEarth() {
  const textureLoader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  orbitalEarthGroup = new THREE.Group();
  // Deep blue Pacific ocean with natural anvil cloud clusters directly behind car
  orbitalEarthGroup.position.set(-3.2, -2.4, -22.0);
  orbitalEarthGroup.rotation.z = -0.13;

  // Curved 3D Orbital Surface geometry
  const width = 54;
  const height = 36;
  const segW = 64;
  const segH = 64;
  const earthGeo = new THREE.PlaneGeometry(width, height, segW, segH);

  const posAttr = earthGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const distSq = (x * x) * 0.006 + (y * y) * 0.004;
    posAttr.setZ(i, -distSq);
  }
  earthGeo.computeVertexNormals();

  // Authentic NASA ISS photograph (4256x2832)
  const orbitalTex = textureLoader.load('assets/textures/earth_orbital_borneo.jpg', () => {
    window.__state.earthLoaded = true;
  });
  orbitalTex.colorSpace = THREE.SRGBColorSpace;
  orbitalTex.anisotropy = maxAniso;

  const earthMat = new THREE.MeshBasicMaterial({
    map: orbitalTex,
    toneMapped: true
  });

  earthMesh = new THREE.Mesh(earthGeo, earthMat);
  orbitalEarthGroup.add(earthMesh);

  scene.add(orbitalEarthGroup);
}

/* ============================================================
   LOAD FERRARI F40 (WHITE LIBERTY WALK LIVERY)
   ============================================================ */
function loadFerrariF40() {
  const loader = new GLTFLoader();

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('assets/draco/');
  loader.setDRACOLoader(dracoLoader);

  loader.load(
    'assets/models/ferrari_f40.glb',
    (gltf) => {
      carModel = gltf.scene;

      // Center model pivot
      const box = new THREE.Box3().setFromObject(carModel);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      carModel.position.x = -center.x;
      carModel.position.y = -center.y;
      carModel.position.z = -center.z;

      const maxDim = Math.max(size.x, size.y, size.z);
      // Hero scale with balanced margins
      const targetScale = 3.25 / maxDim;
      carModel.scale.setScalar(targetScale);

      // Supreme ceramic detailing clearcoat: pure glossy white body with sharp reflections
      carModel.traverse((node) => {
        if (node.isMesh && node.material) {
          const mat = node.material;
          if (mat.roughness !== undefined) {
            mat.roughness = Math.min(mat.roughness, 0.10);
          }
          if (mat.metalness !== undefined) {
            mat.metalness = Math.min(mat.metalness, 0.28);
          }
          if (mat.clearcoat !== undefined) {
            mat.clearcoat = 1.0;
            mat.clearcoatRoughness = 0.02;
          }
        }
      });

      carGroup.add(carModel);
      window.__carModel = carModel;
      window.__state.carLoaded = true;

      // Start the cinematic entrance sequence
      startCinematicSequence();
    },
    undefined,
    (err) => {
      console.error('Error loading car:', err);
    }
  );
}

/* ============================================================
   CINEMATIC SEQUENCE: BALANCED MARGINS, HEADLIGHTS IN VIEW
   ============================================================ */
const REST_ROT_X = 0.94;
const REST_ROT_Y = 0.46;
const REST_ROT_Z = -0.44;

function getTargetRestPos() {
  const isDesktop = window.innerWidth > 900;
  return {
    x: isDesktop ? -0.92 : 0,   // Indented from left edge with generous breathing room
    y: isDesktop ? 0.36 : 0.98,  // Lifted on mobile to give perfect breathing room above centered branding!
    z: isDesktop ? 2.4 : 1.9    // Perfectly framed on narrow mobile screens
  };
}

function startCinematicSequence() {
  const restPos = getTargetRestPos();

  // HIGH-ENERGY ENTRY: Starts from deep space spinning & tumbling dynamically!
  carGroup.position.set(restPos.x + 1.2, restPos.y + 4.8, -60);
  carGroup.rotation.set(
    REST_ROT_X + Math.PI * 2.0,
    REST_ROT_Y + Math.PI * 2.5,
    REST_ROT_Z - Math.PI * 1.4
  );
  carGroup.visible = true;

  // Camera is already at (0.2, 0.3, 10.0) from page init — NO sudden pop!
  const tl = gsap.timeline({
    onComplete: () => {
      isIntroActive = false;
      triggerTextFlicker();
      // Silky seamless blend into mouse interactivity and zero-g floating
      gsap.to(introBlend, {
        value: 1.0,
        duration: 1.4,
        ease: 'power2.out'
      });
    }
  });

  // Majestic, slightly slower 2.8s entrance allowing full visual appreciation
  tl.to(camera.position, {
    x: 0,
    y: 0,
    z: 7.5,
    duration: 2.8,
    ease: 'power3.out'
  }, 0);

  tl.to(carGroup.position, {
    x: restPos.x,
    y: restPos.y,
    z: restPos.z,
    duration: 2.8,
    ease: 'power3.out'
  }, 0);

  tl.to(carGroup.rotation, {
    x: REST_ROT_X,
    y: REST_ROT_Y,
    z: REST_ROT_Z,
    duration: 2.8,
    ease: 'power3.out'
  }, 0);
}

/* ============================================================
   TEXT FLICKER EFFECT (STROBE BLINK LIKE IN EDITS)
   ============================================================ */
function triggerTextFlicker() {
  flickerItems.forEach((item, index) => {
    setTimeout(() => {
      item.classList.add('flicker-active');
    }, index * 120);
  });
}

/* ============================================================
   SMOOTH, NATURAL MOUSE, TOUCH & ACCELEROMETER REACTION
   ============================================================ */
let hasGyroData = false;
let initialBeta = null;

function handleOrientation(e) {
  const gamma = e.gamma;
  const beta = e.beta;
  if (typeof gamma !== 'number' || typeof beta !== 'number' || isNaN(gamma) || isNaN(beta)) return;

  hasGyroData = true;

  if (initialBeta === null) {
    initialBeta = beta;
  }

  // Smooth running auto-recalibration if holding position shifts
  if (Math.abs(beta - initialBeta) > 40) {
    initialBeta = beta;
  }

  // Tilt left-right: ±15 degrees -> -1 to 1
  mouse.targetX = Math.max(-1, Math.min(1, gamma / 15));
  // Tilt forward-backward: ±12 degrees -> -1 to 1
  mouse.targetY = Math.max(-1, Math.min(1, (beta - initialBeta) / 12));
}

function handleMotion(e) {
  if (!e.accelerationIncludingGravity) return;
  const acc = e.accelerationIncludingGravity;
  if (typeof acc.x !== 'number' || typeof acc.y !== 'number' || isNaN(acc.x) || isNaN(acc.y)) return;

  // If orientation angles didn't trigger, accelerometer takes over immediately:
  if (!hasGyroData) {
    mouse.targetX = Math.max(-1, Math.min(1, -acc.x / 4.0));
    mouse.targetY = Math.max(-1, Math.min(1, (acc.y - 7.5) / 4.0));
  }
}

function initSensors() {
  // Attach all mobile motion listeners (works out of the box on Android)
  window.addEventListener('deviceorientation', handleOrientation, true);
  window.addEventListener('deviceorientationabsolute', handleOrientation, true);
  window.addEventListener('devicemotion', handleMotion, true);

  // iOS Safari requires explicit request on first touch
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    const onFirstTouch = () => {
      DeviceOrientationEvent.requestPermission()
        .then((state) => {
          if (state === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
            window.addEventListener('deviceorientationabsolute', handleOrientation, true);
            window.addEventListener('devicemotion', handleMotion, true);
          }
        })
        .catch(() => {});
      window.removeEventListener('touchstart', onFirstTouch);
      window.removeEventListener('pointerdown', onFirstTouch);
    };
    window.addEventListener('touchstart', onFirstTouch, { once: true });
    window.addEventListener('pointerdown', onFirstTouch, { once: true });
  }

  window.addEventListener('orientationchange', () => {
    initialBeta = null;
  });
}

function initEvents() {
  window.addEventListener('resize', onWindowResize);

  // Desktop mouse movement
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      mouse.targetX = (e.clientX - windowHalf.x) / windowHalf.x;
      mouse.targetY = (e.clientY - windowHalf.y) / windowHalf.y;
    }
  });

  // Mobile silky-smooth touch drag
  const onTouch = (e) => {
    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      mouse.targetX = (touch.clientX - windowHalf.x) / windowHalf.x;
      mouse.targetY = (touch.clientY - windowHalf.y) / windowHalf.y;
    }
  };

  window.addEventListener('touchmove', onTouch, { passive: true });
  window.addEventListener('touchstart', onTouch, { passive: true });

  initSensors();
}

function onWindowResize() {
  windowHalf.x = window.innerWidth / 2;
  windowHalf.y = window.innerHeight / 2;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  if (!isIntroActive && carGroup) {
    const restPos = getTargetRestPos();
    carGroup.position.x = restPos.x;
    carGroup.position.y = restPos.y;
    carGroup.position.z = restPos.z;
  }
}

/* ============================================================
   RENDER LOOP: SEAMLESS CONTINUITY (ZERO HITCHES OR JUMPS)
   ============================================================ */
function animate() {
  requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();

  // Smooth mouse/touch/gyro easing (responsive on mobile sensors)
  const easeSpeed = hasGyroData ? 0.12 : 0.055;
  mouse.x += (mouse.targetX - mouse.x) * easeSpeed;
  mouse.y += (mouse.targetY - mouse.y) * easeSpeed;

  const blend = introBlend.value;

  // Active Camera Parallax: dynamic orbital rotation that user loves!
  if (!isIntroActive) {
    const targetCamX = mouse.x * 0.38 * blend;
    const targetCamY = -mouse.y * 0.24 * blend;

    camera.position.x += (targetCamX - camera.position.x) * 0.045;
    camera.position.y += (targetCamY - camera.position.y) * 0.045;
    camera.position.z += (7.5 - camera.position.z) * 0.045;

    const targetLookX = -0.35 + (mouse.x * 0.10) * blend;
    const targetLookY = 0.15 - (mouse.y * 0.08) * blend;
    currentLookAt.x += (targetLookX - currentLookAt.x) * 0.045;
    currentLookAt.y += (targetLookY - currentLookAt.y) * 0.045;
  }
  camera.lookAt(currentLookAt);

  // Multi-tier stellar parallax (deep cosmic planes shifting with camera)
  if (starsNear) {
    starsNear.position.x = -mouse.x * 2.8 * blend;
    starsNear.position.y = mouse.y * 1.8 * blend;
  }
  if (starsMid) {
    starsMid.position.x = -mouse.x * 1.4 * blend;
    starsMid.position.y = mouse.y * 0.9 * blend;
  }
  if (starsDeep) {
    starsDeep.position.x = -mouse.x * 0.45 * blend;
    starsDeep.position.y = mouse.y * 0.3 * blend;
  }

  // Alive Earth dynamics: rich orbital horizon parallax with mouse + slow cosmic rotation
  if (orbitalEarthGroup) {
    orbitalEarthGroup.position.x = -3.2 - (mouse.x * 0.45) * blend + Math.sin(elapsedTime * 0.03) * 0.10 * blend;
    orbitalEarthGroup.position.y = -2.4 + (mouse.y * 0.30) * blend + Math.cos(elapsedTime * 0.02) * 0.08 * blend;
  }

  // Stable zero-g car response: subtle, silky, NO jerky twitching!
  if (!isIntroActive && carGroup) {
    const restPos = getTargetRestPos();

    // Gentle, silky micro-tilt (no jerky twitching!)
    const targetRotX = REST_ROT_X - (mouse.y * 0.025) * blend;
    const targetRotY = REST_ROT_Y + (mouse.x * 0.035) * blend;
    const targetRotZ = REST_ROT_Z - (mouse.x * 0.015) * blend;

    carGroup.rotation.x += (targetRotX - carGroup.rotation.x) * 0.03;
    carGroup.rotation.y += (targetRotY - carGroup.rotation.y) * 0.03;
    carGroup.rotation.z += (targetRotZ - carGroup.rotation.z) * 0.03;

    // Weightless zero-g floating drift
    const targetPosX = restPos.x + (mouse.x * 0.04) * blend;
    const targetPosY = restPos.y + (-mouse.y * 0.035 + Math.sin(elapsedTime * 0.75) * 0.025) * blend;

    carGroup.position.x += (targetPosX - carGroup.position.x) * 0.03;
    carGroup.position.y += (targetPosY - carGroup.position.y) * 0.03;
  }

  renderer.render(scene, camera);
}
