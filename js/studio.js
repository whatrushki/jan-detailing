import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';

/* ============================================================
   JAN DETAILING - 3D PHOTO & EXPORT STUDIO (FERRARI F40)
   Full Pro Camera Control, Flexible Angles, Lenses, FOV,
   Pan Targets, Aspect Ratio Guides & Ultra-Res PNG Exporter
   ============================================================ */

var scene, camera, renderer, carGroup, carModel;
var headlightMat, frontLensMat, rearLightMat;
var studioFloor, contactShadowMesh, studioLightGroup;
var starsGroup;
var currentBgMode = 'studio'; // 'studio', 'transparent', 'black', 'cosmos'
var exportRes = '1080'; // '1080', '4k', '8k'
var currentRatio = 'full'; // '16-9', '1-1', '9-16', '21-9', 'full'
var isTurntableActive = false;
var lightsOn = false;
var rearLightsOn = false;
var floorVisible = true;
var showGrid = false;

// Camera Lens & FOV State
var currentFov = 38;
var targetFov = 38;

// Camera Roll (Dutch Angle) in radians
var currentRoll = 0.0;
var targetRoll = 0.0;

// Orbit Controls State (Spherical Coordinates)
var spherical = {
  radius: 6.2,
  theta: 0.75, // azimuth angle around Y
  phi: 1.25    // polar angle from top (0 = top, PI/2 = horizon)
};
var targetSpherical = {
  radius: 6.2,
  theta: 0.75,
  phi: 1.25
};
var targetCenter = new THREE.Vector3(0, 0.25, 0);
var currentCenter = new THREE.Vector3(0, 0.25, 0);

var isDragging = false;
var isPanning = false;
var isUserInteracting = false;
var previousMousePosition = { x: 0, y: 0 };
var canvas = document.getElementById('webgl');
var loaderOverlay = document.getElementById('loaderOverlay');
var toast = document.getElementById('toast');

// UI Elements for live readouts
var elAzimuthSlider = document.getElementById('azimuthSlider');
var elAzimuthVal = document.getElementById('azimuthVal');
var elElevationSlider = document.getElementById('elevationSlider');
var elElevationVal = document.getElementById('elevationVal');
var elDistanceSlider = document.getElementById('distanceSlider');
var elDistanceVal = document.getElementById('distanceVal');
var elRollSlider = document.getElementById('rollSlider');
var elRollVal = document.getElementById('rollVal');
var elFovSlider = document.getElementById('fovSlider');
var elFovVal = document.getElementById('fovVal');
var elLensBadge = document.getElementById('lensBadge');
var elOrbitBadge = document.getElementById('orbitBadge');

// Frame Overlay elements
var frameOverlay = document.getElementById('frameOverlay');
var frameBox = document.getElementById('frameBox');
var matteTop = document.getElementById('matteTop');
var matteBottom = document.getElementById('matteBottom');
var matteLeft = document.getElementById('matteLeft');
var matteRight = document.getElementById('matteRight');

init();

function init() {
  // 1. Scene & Camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060608);

  camera = new THREE.PerspectiveCamera(currentFov, window.innerWidth / window.innerHeight, 0.1, 1000);
  updateCameraOrientation();

  // 2. High-Precision Renderer with Alpha & Drawing Buffer Preservation
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  // 3. Studio Environment Map (Equirectangular procedural softbox)
  scene.environment = createStudioEnvMap();

  // 4. Studio Lighting
  initStudioLighting();

  // 5. Floor & Shadow
  initFloorAndShadow();

  // 6. Deep Cosmos Stars (for Cosmos preset)
  initCosmosStars();

  // 7. Car Container & Model Loading
  carGroup = new THREE.Group();
  scene.add(carGroup);

  loadCarModel();

  // 8. Event Listeners & UI Controls
  setupOrbitInteractions();
  setupUIHandlers();
  updateFrameOverlay();

  // 9. Render Loop
  requestAnimationFrame(animate);
}

/* ============================================================
   STUDIO ENVIRONMENT & LIGHTING
   ============================================================ */
function createStudioEnvMap() {
  var c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  var ctx = c.getContext('2d');

  var grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#040406');
  grad.addColorStop(0.48, '#0b0b10');
  grad.addColorStop(0.52, '#181822');
  grad.addColorStop(0.75, '#1e1e28');
  grad.addColorStop(1.0, '#020203');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Pure white overhead softbox
  var softGrad = ctx.createRadialGradient(512, 110, 0, 512, 110, 180);
  softGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  softGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.7)');
  softGrad.addColorStop(0.75, 'rgba(255, 255, 255, 0.15)');
  softGrad.addColorStop(1.0, 'transparent');
  ctx.fillStyle = softGrad;
  ctx.fillRect(0, 0, 1024, 280);

  var tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

function initStudioLighting() {
  studioLightGroup = new THREE.Group();
  scene.add(studioLightGroup);

  // Key Overhead Directional Light
  var keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(0, 12, 4);
  studioLightGroup.add(keyLight);

  // Rim / Backlight
  var rimLight = new THREE.DirectionalLight(0xffffff, 2.4);
  rimLight.position.set(-6, 8, -8);
  studioLightGroup.add(rimLight);

  // Soft Front Fill
  var fillLight = new THREE.DirectionalLight(0xffffff, 1.8);
  fillLight.position.set(8, 4, 8);
  studioLightGroup.add(fillLight);

  // Ambient Base
  var ambient = new THREE.AmbientLight(0xffffff, 0.65);
  studioLightGroup.add(ambient);
}

function initFloorAndShadow() {
  // Reflective Matte Studio Floor
  var floorGeo = new THREE.PlaneGeometry(80, 80);
  var floorMat = new THREE.MeshStandardMaterial({
    color: 0x07070a,
    roughness: 0.22,
    metalness: 0.15
  });
  studioFloor = new THREE.Mesh(floorGeo, floorMat);
  studioFloor.rotation.x = -Math.PI / 2;
  studioFloor.position.y = -0.56;
  scene.add(studioFloor);

  // Contact Shadow texture under car
  var shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 512;
  shadowCanvas.height = 512;
  var sCtx = shadowCanvas.getContext('2d');
  var sGrad = sCtx.createRadialGradient(256, 256, 40, 256, 256, 240);
  sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
  sGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.65)');
  sGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.15)');
  sGrad.addColorStop(1, 'transparent');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, 512, 512);

  var shadowTex = new THREE.CanvasTexture(shadowCanvas);
  var shadowGeo = new THREE.PlaneGeometry(5.2, 3.2);
  var shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
  contactShadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadowMesh.rotation.x = -Math.PI / 2;
  contactShadowMesh.position.y = -0.555;
  scene.add(contactShadowMesh);
}

function initCosmosStars() {
  starsGroup = new THREE.Group();
  starsGroup.visible = false;
  scene.add(starsGroup);

  var starCount = 3000;
  var pos = new Float32Array(starCount * 3);
  var col = new Float32Array(starCount * 3);

  for (var i = 0; i < starCount; i++) {
    var rad = 150 + Math.random() * 400;
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);

    pos[i * 3]     = rad * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = rad * Math.cos(phi);

    var b = 0.7 + Math.random() * 0.3;
    col[i * 3]     = b;
    col[i * 3 + 1] = b;
    col[i * 3 + 2] = b * (0.95 + Math.random() * 0.05);
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  var mat = new THREE.PointsMaterial({
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: false
  });

  var stars = new THREE.Points(geo, mat);
  starsGroup.add(stars);
}

/* ============================================================
   LOAD FERRARI F40 MODEL
   ============================================================ */
function loadCarModel() {
  var loader = new GLTFLoader();
  loader.load(
    'assets/models/ferrari_f40.glb',
    function(gltf) {
      carModel = gltf.scene;

      var box = new THREE.Box3().setFromObject(carModel);
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());

      // Center exactly at origin
      carModel.position.x = -center.x;
      carModel.position.y = -center.y;
      carModel.position.z = -center.z;

      var maxDim = Math.max(size.x, size.y, size.z);
      var targetScale = 3.25 / maxDim;
      carModel.scale.setScalar(targetScale);

      // Enhance materials for maximum photographic clarity
      carModel.traverse(function(node) {
        if (node.isMesh && node.material) {
          var mat = node.material;

          // Paint: Mirror-finish Rosso Corsa clearcoat
          if (mat.name === 'Paint' || mat.name.toLowerCase().includes('paint')) {
            mat.roughness = 0.015;
            mat.metalness = 0.38;
            mat.clearcoat = 1.0;
            mat.clearcoatRoughness = 0.002;
          }

          // Lights
          if (mat.name === 'Headlight') {
            headlightMat = mat;
            headlightMat.color.setRGB(1, 1, 1);
            headlightMat.emissive = new THREE.Color(0x000000);
            headlightMat.emissiveIntensity = 0;
          }
          if (mat.name === 'PaletteMaterial006') {
            frontLensMat = mat;
            frontLensMat.emissive = new THREE.Color(0x000000);
            frontLensMat.emissiveIntensity = 0;
          }
          if (mat.name === 'RearLights') {
            rearLightMat = mat;
            rearLightMat.emissive = new THREE.Color(0x000000);
            rearLightMat.emissiveIntensity = 0;
          }
        }
      });

      carGroup.add(carModel);

      // Hide preloader
      if (loaderOverlay) {
        loaderOverlay.classList.add('hidden');
      }
    },
    undefined,
    function(err) {
      console.error('Error loading F40:', err);
      if (loaderOverlay) {
        loaderOverlay.innerHTML = '<div style="color:#ff3344; font-size:12px;">ОШИБКА ЗАГРУЗКИ МОДЕЛИ F40</div>';
      }
    }
  );
}

/* ============================================================
   CAMERA POSITION & ORIENTATION (ROLL & DUTCH ANGLE SUPPORT)
   ============================================================ */
function updateCameraOrientation() {
  var x = currentCenter.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
  var y = currentCenter.y + spherical.radius * Math.cos(spherical.phi);
  var z = currentCenter.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);

  camera.position.set(x, y, z);

  // Compute robust up vector with roll support
  var forward = new THREE.Vector3().subVectors(currentCenter, camera.position).normalize();
  var worldUp = Math.abs(forward.y) > 0.99 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  var right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
  var camUp = new THREE.Vector3().crossVectors(right, forward).normalize();

  if (currentRoll !== 0) {
    camUp.applyAxisAngle(forward, currentRoll);
  }

  camera.up.copy(camUp);
  camera.lookAt(currentCenter);
}

/* ============================================================
   ORBIT CAMERA CONTROLLER (MOUSE & TOUCH INTERACTION)
   ============================================================ */
function setupOrbitInteractions() {
  canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });

  canvas.addEventListener('mousedown', function(e) {
    isDragging = true;
    isUserInteracting = true;
    isPanning = (e.button === 2); // Right click = pan
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mousemove', function(e) {
    if (!isDragging) return;

    var deltaX = e.clientX - previousMousePosition.x;
    var deltaY = e.clientY - previousMousePosition.y;

    if (isPanning) {
      // Pan camera target
      var panSpeed = 0.0035 * targetSpherical.radius;
      var forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      var right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      var up = camera.up.clone().normalize();

      targetCenter.addScaledVector(right, -deltaX * panSpeed);
      targetCenter.addScaledVector(up, deltaY * panSpeed);
    } else {
      // Rotate spherical coordinates
      var rotateSpeed = 0.0055;
      targetSpherical.theta -= deltaX * rotateSpeed;
      targetSpherical.phi -= deltaY * rotateSpeed;

      // Clamp polar angle (never flip upside down or clip into floor)
      // phi: 0.08 (~85° elevation) to 1.75 (~-10° low angle)
      targetSpherical.phi = Math.max(0.08, Math.min(Math.PI * 0.55, targetSpherical.phi));
    }

    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', function() {
    isDragging = false;
    isPanning = false;
    setTimeout(function() { isUserInteracting = false; }, 200);
  });

  // Wheel Zoom
  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    isUserInteracting = true;
    var zoomSpeed = 0.0016 * targetSpherical.radius;
    targetSpherical.radius += e.deltaY * zoomSpeed;
    targetSpherical.radius = Math.max(1.8, Math.min(16.0, targetSpherical.radius));
    setTimeout(function() { isUserInteracting = false; }, 200);
  }, { passive: false });

  // Touch Support (Pinch zoom & 1-finger rotate)
  var initialTouchDist = 0;
  canvas.addEventListener('touchstart', function(e) {
    isUserInteracting = true;
    if (e.touches.length === 1) {
      isDragging = true;
      isPanning = false;
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDragging = false;
      initialTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 1 && isDragging) {
      var deltaX = e.touches[0].clientX - previousMousePosition.x;
      var deltaY = e.touches[0].clientY - previousMousePosition.y;

      targetSpherical.theta -= deltaX * 0.007;
      targetSpherical.phi -= deltaY * 0.007;
      targetSpherical.phi = Math.max(0.08, Math.min(Math.PI * 0.55, targetSpherical.phi));

      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      var dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      var factor = (initialTouchDist - dist) * 0.015;
      targetSpherical.radius += factor;
      targetSpherical.radius = Math.max(1.8, Math.min(16.0, targetSpherical.radius));
      initialTouchDist = dist;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', function() {
    isDragging = false;
    setTimeout(function() { isUserInteracting = false; }, 200);
  }, { passive: true });

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateFrameOverlay();
}

/* ============================================================
   ASPECT RATIO CROP GUIDE & OVERLAY
   ============================================================ */
function updateFrameOverlay() {
  if (!frameOverlay || !frameBox) return;

  if (currentRatio === 'full') {
    frameOverlay.classList.remove('active');
    return;
  }

  frameOverlay.classList.add('active');
  if (showGrid) {
    frameBox.classList.add('show-grid');
  } else {
    frameBox.classList.remove('show-grid');
  }

  var w = window.innerWidth;
  var h = window.innerHeight;
  var targetAspect = 16 / 9;

  if (currentRatio === '16-9') targetAspect = 16 / 9;
  else if (currentRatio === '1-1') targetAspect = 1.0;
  else if (currentRatio === '9-16') targetAspect = 9 / 16;
  else if (currentRatio === '21-9') targetAspect = 21 / 9;

  var currentAspect = w / h;
  var boxW, boxH, boxX, boxY;

  if (currentAspect > targetAspect) {
    // Screen is wider than target frame -> Pillarbox (bars on left & right)
    boxH = h * 0.92;
    boxW = boxH * targetAspect;
    boxX = (w - boxW) / 2;
    boxY = (h - boxH) / 2;
  } else {
    // Screen is taller than target frame -> Letterbox (bars on top & bottom)
    boxW = w * 0.92;
    boxH = boxW / targetAspect;
    boxX = (w - boxW) / 2;
    boxY = (h - boxH) / 2;
  }

  // Position frame box
  frameBox.style.left = boxX + 'px';
  frameBox.style.top = boxY + 'px';
  frameBox.style.width = boxW + 'px';
  frameBox.style.height = boxH + 'px';

  // Position matte bars
  matteTop.style.left = '0px';
  matteTop.style.top = '0px';
  matteTop.style.width = '100%';
  matteTop.style.height = boxY + 'px';

  matteBottom.style.left = '0px';
  matteBottom.style.top = (boxY + boxH) + 'px';
  matteBottom.style.width = '100%';
  matteBottom.style.height = (h - (boxY + boxH)) + 'px';

  matteLeft.style.left = '0px';
  matteLeft.style.top = boxY + 'px';
  matteLeft.style.width = boxX + 'px';
  matteLeft.style.height = boxH + 'px';

  matteRight.style.left = (boxX + boxW) + 'px';
  matteRight.style.top = boxY + 'px';
  matteRight.style.width = (w - (boxX + boxW)) + 'px';
  matteRight.style.height = boxH + 'px';
}

/* ============================================================
   UI HANDLERS & FULL BI-DIRECTIONAL CONTROLS
   ============================================================ */
function setupUIHandlers() {
  // --- 1. LENS PRESETS & FOV SLIDER ---
  var lensFovMap = {
    '24': 53,
    '35': 38,
    '50': 27,
    '85': 16,
    '135': 10
  };

  document.querySelectorAll('[data-lens]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-lens]').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var mm = btn.getAttribute('data-lens');
      var fov = lensFovMap[mm] || 38;
      targetFov = fov;
      elFovSlider.value = fov;
      elFovVal.textContent = fov + '°';
      elLensBadge.textContent = mm + 'mm (' + fov + '°)';
    });
  });

  elFovSlider.addEventListener('input', function() {
    var val = parseFloat(elFovSlider.value);
    targetFov = val;
    elFovVal.textContent = val + '°';

    // Calculate approximate 35mm equivalent focal length
    var approxMm = Math.round(12 / Math.tan((val * Math.PI) / 360));
    elLensBadge.textContent = '~' + approxMm + 'mm (' + val + '°)';

    // Update active lens button if matches
    document.querySelectorAll('[data-lens]').forEach(function(btn) {
      btn.classList.toggle('active', parseInt(btn.getAttribute('data-lens')) === approxMm);
    });
  });

  // --- 2. CAMERA ANGLE PRESETS ---
  var poses = {
    front34: { theta: 0.72, phi: 1.28, radius: 6.2, center: { x: 0, y: 0.25, z: 0 }, label: '3/4 СПЕРЕДИ' },
    rear34:  { theta: 2.38, phi: 1.28, radius: 6.2, center: { x: 0, y: 0.25, z: 0 }, label: '3/4 СЗАДИ' },
    side:    { theta: Math.PI * 0.5, phi: 1.35, radius: 5.8, center: { x: 0, y: 0.25, z: 0 }, label: 'ПРОФИЛЬ' },
    front:   { theta: 0.0, phi: 1.35, radius: 5.6, center: { x: 0, y: 0.25, z: 0 }, label: 'ФАС (ЛОБ)' },
    rear:    { theta: Math.PI, phi: 1.35, radius: 5.6, center: { x: 0, y: 0.25, z: 0 }, label: 'КОРМА' },
    top:     { theta: 0.0, phi: 0.12, radius: 6.8, center: { x: 0, y: 0.0, z: 0 }, label: 'СВЕРХУ' }
  };

  document.querySelectorAll('[data-pose]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-pose]').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var pose = poses[btn.getAttribute('data-pose')];
      if (pose) {
        targetSpherical.theta = pose.theta;
        targetSpherical.phi = pose.phi;
        targetSpherical.radius = pose.radius;
        targetCenter.set(pose.center.x, pose.center.y, pose.center.z);
        targetRoll = 0.0;
        elRollSlider.value = 0;
        elRollVal.textContent = '0°';
        elOrbitBadge.textContent = pose.label;
      }
    });
  });

  // --- 3. PRECISE CAMERA SLIDERS ---
  // Azimuth Slider (0° to 360°)
  elAzimuthSlider.addEventListener('input', function() {
    var deg = parseFloat(elAzimuthSlider.value);
    targetSpherical.theta = (deg * Math.PI) / 180;
    elAzimuthVal.textContent = Math.round(deg) + '°';
    document.querySelectorAll('[data-pose]').forEach(function(b) { b.classList.remove('active'); });
  });

  // Elevation Slider (-10° to +85°)
  elElevationSlider.addEventListener('input', function() {
    var deg = parseFloat(elElevationSlider.value);
    targetSpherical.phi = ((90 - deg) * Math.PI) / 180;
    elElevationVal.textContent = Math.round(deg) + '°';
    document.querySelectorAll('[data-pose]').forEach(function(b) { b.classList.remove('active'); });
  });

  // Distance Slider (1.8m to 16.0m)
  elDistanceSlider.addEventListener('input', function() {
    var dist = parseFloat(elDistanceSlider.value);
    targetSpherical.radius = dist;
    elDistanceVal.textContent = dist.toFixed(1) + 'm';
  });

  // Roll (Dutch Angle) Slider (-45° to +45°)
  elRollSlider.addEventListener('input', function() {
    var deg = parseFloat(elRollSlider.value);
    targetRoll = (deg * Math.PI) / 180;
    elRollVal.textContent = Math.round(deg) + '°';
  });

  // Camera Height Quick Buttons
  document.querySelectorAll('[data-height]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var hMode = btn.getAttribute('data-height');
      if (hMode === 'ground') {
        targetSpherical.phi = ((90 - 2) * Math.PI) / 180;
        targetSpherical.radius = 5.4;
      } else if (hMode === 'lights') {
        targetSpherical.phi = ((90 - 8) * Math.PI) / 180;
        targetSpherical.radius = 5.8;
      } else if (hMode === 'drone') {
        targetSpherical.phi = ((90 - 45) * Math.PI) / 180;
        targetSpherical.radius = 7.6;
      }
      syncSlidersFromSpherical();
    });
  });

  // --- 4. PAN TARGETS & FOCUS POINTS ---
  var targetPoints = {
    center:  { x: 0.0, y: 0.25, z: 0.0 },
    wheel:   { x: 1.15, y: -0.15, z: 1.35 },
    badge:   { x: 0.0, y: 0.28, z: 1.62 },
    wing:    { x: 0.0, y: 0.85, z: -1.72 },
    cockpit: { x: 0.0, y: 0.45, z: 0.15 },
    exhaust: { x: 0.0, y: -0.22, z: -1.90 }
  };

  document.querySelectorAll('[data-target]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-target]').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var pt = targetPoints[btn.getAttribute('data-target')];
      if (pt) {
        targetCenter.set(pt.x, pt.y, pt.z);
      }
    });
  });

  var btnResetTarget = document.getElementById('btnResetTarget');
  if (btnResetTarget) {
    btnResetTarget.addEventListener('click', function() {
      targetCenter.set(0, 0.25, 0);
      document.querySelectorAll('[data-target]').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-target') === 'center');
      });
    });
  }

  // --- 5. ASPECT RATIO & COMPOSITION GRID ---
  document.querySelectorAll('[data-ratio]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-ratio]').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentRatio = btn.getAttribute('data-ratio');
      updateFrameOverlay();
    });
  });

  var btnToggleGrid = document.getElementById('btnToggleGrid');
  if (btnToggleGrid) {
    btnToggleGrid.addEventListener('click', function() {
      showGrid = !showGrid;
      btnToggleGrid.classList.toggle('active', showGrid);
      btnToggleGrid.textContent = showGrid ? 'СЕТКА 3×3: ВКЛ' : 'СЕТКА 3×3: ВЫКЛ';
      updateFrameOverlay();
    });
  }

  var btnResetAll = document.getElementById('btnResetAll');
  if (btnResetAll) {
    btnResetAll.addEventListener('click', function() {
      // Reset camera to standard 3/4 beauty view
      var p = poses.front34;
      targetSpherical.theta = p.theta;
      targetSpherical.phi = p.phi;
      targetSpherical.radius = p.radius;
      targetCenter.set(p.center.x, p.center.y, p.center.z);
      targetRoll = 0.0;
      targetFov = 38;
      currentRatio = 'full';
      showGrid = false;

      elFovSlider.value = 38;
      elFovVal.textContent = '38°';
      elLensBadge.textContent = '35mm (38°)';
      elRollSlider.value = 0;
      elRollVal.textContent = '0°';

      document.querySelectorAll('[data-pose]').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-pose') === 'front34');
      });
      document.querySelectorAll('[data-lens]').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-lens') === '35');
      });
      document.querySelectorAll('[data-target]').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-target') === 'center');
      });
      document.querySelectorAll('[data-ratio]').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-ratio') === 'full');
      });

      if (btnToggleGrid) {
        btnToggleGrid.classList.remove('active');
        btnToggleGrid.textContent = 'СЕТКА 3×3: ВЫКЛ';
      }

      updateFrameOverlay();
      showToast('✓ НАСТРОЙКИ КАМЕРЫ СБРОШЕНЫ');
    });
  }

  // --- 6. BACKGROUND PRESETS ---
  document.querySelectorAll('[data-bg]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-bg]').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      currentBgMode = btn.getAttribute('data-bg');
      applyBackgroundMode(currentBgMode);
    });
  });

  // --- 7. LIGHTING & EFFECTS ---
  var btnHeadlights = document.getElementById('btnHeadlights');
  btnHeadlights.addEventListener('click', function() {
    lightsOn = !lightsOn;
    btnHeadlights.classList.toggle('active', lightsOn);
    btnHeadlights.textContent = lightsOn ? 'ФАРЫ: ВКЛ' : 'ФАРЫ: ВЫКЛ';

    if (headlightMat) {
      headlightMat.emissive.setRGB(lightsOn ? 1 : 0, lightsOn ? 1 : 0, lightsOn ? 1 : 0);
      headlightMat.emissiveIntensity = lightsOn ? 28.0 : 0;
    }
    if (frontLensMat) {
      frontLensMat.emissive.setRGB(lightsOn ? 1 : 0, lightsOn ? 1 : 0, lightsOn ? 1 : 0);
      frontLensMat.emissiveIntensity = lightsOn ? 22.0 : 0;
    }
  });

  var btnRearLights = document.getElementById('btnRearLights');
  btnRearLights.addEventListener('click', function() {
    rearLightsOn = !rearLightsOn;
    btnRearLights.classList.toggle('active', rearLightsOn);
    btnRearLights.textContent = rearLightsOn ? 'СТОПЫ: ВКЛ' : 'СТОП-СИГНАЛЫ';

    if (rearLightMat) {
      rearLightMat.emissive.setRGB(rearLightsOn ? 1.0 : 0, rearLightsOn ? 0.03 : 0, 0);
      rearLightMat.emissiveIntensity = rearLightsOn ? 20.0 : 0;
    }
  });

  var btnTurntable = document.getElementById('btnTurntable');
  btnTurntable.addEventListener('click', function() {
    isTurntableActive = !isTurntableActive;
    btnTurntable.classList.toggle('active', isTurntableActive);
  });

  var btnFloor = document.getElementById('btnFloor');
  btnFloor.addEventListener('click', function() {
    floorVisible = !floorVisible;
    btnFloor.classList.toggle('active', floorVisible);
    if (studioFloor) studioFloor.visible = floorVisible;
    if (contactShadowMesh) contactShadowMesh.visible = floorVisible;
  });

  var lightSlider = document.getElementById('lightIntensity');
  var lightVal = document.getElementById('lightVal');
  lightSlider.addEventListener('input', function() {
    var val = parseFloat(lightSlider.value);
    renderer.toneMappingExposure = val * 0.85;
    if (lightVal) lightVal.textContent = val.toFixed(1) + '×';
  });

  // --- 8. RESOLUTION PICKER ---
  document.querySelectorAll('[data-res]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-res]').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      exportRes = btn.getAttribute('data-res');
    });
  });

  // --- 9. EXPORT BUTTON ACTION ---
  var btnExport = document.getElementById('btnExport');
  btnExport.addEventListener('click', function() {
    performHighResExport();
  });

  // --- 10. UI TOGGLE & HOTKEYS ---
  var controlPanel = document.getElementById('controlPanel');
  var btnShowUI = document.getElementById('btnShowUI');

  window.addEventListener('keydown', function(e) {
    if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
      controlPanel.classList.toggle('hidden');
    } else if (e.code === 'Space') {
      e.preventDefault();
      btnTurntable.click();
    }
  });

  btnShowUI.addEventListener('click', function() {
    controlPanel.classList.remove('hidden');
  });
}

function syncSlidersFromSpherical() {
  if (!elAzimuthSlider || !elElevationSlider || !elDistanceSlider) return;

  // Azimuth in degrees [0, 360)
  var rawDeg = (spherical.theta * 180 / Math.PI) % 360;
  if (rawDeg < 0) rawDeg += 360;
  var azDeg = Math.round(rawDeg);
  elAzimuthSlider.value = azDeg;
  elAzimuthVal.textContent = azDeg + '°';

  // Elevation in degrees [-10, 85]
  var elevDeg = Math.round(90 - (spherical.phi * 180 / Math.PI));
  elElevationSlider.value = elevDeg;
  elElevationVal.textContent = elevDeg + '°';

  // Distance in meters
  elDistanceSlider.value = spherical.radius.toFixed(1);
  elDistanceVal.textContent = spherical.radius.toFixed(1) + 'm';
}

function applyBackgroundMode(mode) {
  if (mode === 'transparent') {
    scene.background = null;
    if (studioFloor) studioFloor.visible = false;
    if (starsGroup) starsGroup.visible = false;
  } else if (mode === 'black') {
    scene.background = new THREE.Color(0x000000);
    if (studioFloor) studioFloor.visible = floorVisible;
    if (starsGroup) starsGroup.visible = false;
  } else if (mode === 'cosmos') {
    scene.background = new THREE.Color(0x020205);
    if (studioFloor) studioFloor.visible = false;
    if (starsGroup) starsGroup.visible = true;
  } else {
    // 'studio'
    scene.background = new THREE.Color(0x060608);
    if (studioFloor) studioFloor.visible = floorVisible;
    if (starsGroup) starsGroup.visible = false;
  }
}

/* ============================================================
   HIGH-RESOLUTION ULTRA QUALITY PNG EXPORTER (WITH ASPECT RATIO)
   ============================================================ */
function performHighResExport() {
  var targetAspect = 16 / 9;
  var isCustomRatio = true;

  if (currentRatio === '16-9') {
    targetAspect = 16 / 9;
  } else if (currentRatio === '1-1') {
    targetAspect = 1.0;
  } else if (currentRatio === '9-16') {
    targetAspect = 9 / 16;
  } else if (currentRatio === '21-9') {
    targetAspect = 21 / 9;
  } else {
    // 'full' -> match current viewport aspect exactly
    targetAspect = window.innerWidth / window.innerHeight;
    isCustomRatio = false;
  }

  // Calculate resolution based on exportRes and targetAspect
  var width = 1920;
  var height = Math.round(width / targetAspect);

  if (exportRes === '4k') {
    if (targetAspect >= 1.0) {
      width = 3840;
      height = Math.round(width / targetAspect);
    } else {
      height = 3840;
      width = Math.round(height * targetAspect);
    }
  } else if (exportRes === '8k') {
    if (targetAspect >= 1.0) {
      width = 7680;
      height = Math.round(width / targetAspect);
    } else {
      height = 7680;
      width = Math.round(height * targetAspect);
    }
  } else if (exportRes === '1080') {
    if (targetAspect >= 1.0) {
      width = 1920;
      height = Math.round(width / targetAspect);
    } else {
      height = 1920;
      width = Math.round(height * targetAspect);
    }
  }

  // Ensure even dimensions
  if (width % 2 !== 0) width += 1;
  if (height % 2 !== 0) height += 1;

  // 1. Save current viewport state
  var origAspect = camera.aspect;
  var origPixelRatio = renderer.getPixelRatio();
  var origBg = scene.background;

  // 2. Configure for export
  if (currentBgMode === 'transparent') {
    scene.background = null;
  }

  camera.aspect = targetAspect;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);

  // 3. Render at ultra-high resolution
  renderer.render(scene, camera);

  // 4. Capture Data URL as PNG
  var dataUrl = renderer.domElement.toDataURL('image/png', 1.0);

  // 5. Restore Viewport
  camera.aspect = origAspect;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(origPixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, true);
  scene.background = origBg;
  applyBackgroundMode(currentBgMode);

  // 6. Trigger Download
  var downloadLink = document.createElement('a');
  var timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  var ratioTag = currentRatio === 'full' ? 'screen' : currentRatio;
  downloadLink.download = `ferrari-f40-${exportRes}-${ratioTag}-${timestamp}.png`;
  downloadLink.href = dataUrl;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  // 7. Show success Toast
  showToast(`✓ ЭКСПОРТ В PNG (${exportRes.toUpperCase()} • ${width}×${height}) УСПЕШНО СКАЧАН`);
}

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function() {
    toast.classList.remove('show');
  }, 3400);
}

/* ============================================================
   MAIN ANIMATION LOOP
   ============================================================ */
function animate() {
  requestAnimationFrame(animate);

  // Turntable slow majestic spin
  if (isTurntableActive) {
    targetSpherical.theta += 0.005;
  }

  // Smooth inertial interpolation for orbit camera
  spherical.radius += (targetSpherical.radius - spherical.radius) * 0.08;
  spherical.theta  += (targetSpherical.theta  - spherical.theta)  * 0.08;
  spherical.phi    += (targetSpherical.phi    - spherical.phi)    * 0.08;

  // Smooth FOV zoom
  if (Math.abs(currentFov - targetFov) > 0.01) {
    currentFov += (targetFov - currentFov) * 0.1;
    camera.fov = currentFov;
    camera.updateProjectionMatrix();
  }

  // Smooth Roll (Dutch Angle)
  currentRoll += (targetRoll - currentRoll) * 0.08;

  // Smooth Pan Center
  currentCenter.lerp(targetCenter, 0.08);

  updateCameraOrientation();

  // If user is rotating with mouse or touch, or turntable is spinning, sync angle sliders
  if (isDragging || isPanning || isTurntableActive || isUserInteracting) {
    syncSlidersFromSpherical();
  }

  // Gentle star twinkle if cosmos active
  if (starsGroup && starsGroup.visible) {
    starsGroup.rotation.y += 0.0003;
  }

  renderer.render(scene, camera);
}
