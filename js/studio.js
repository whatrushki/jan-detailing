import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';

/* ============================================================
   JAN DETAILING - 3D PHOTO & EXPORT STUDIO (FERRARI F40)
   High-Resolution Viewport, Full Orbit, Lighting & PNG Exporter
   ============================================================ */

var scene, camera, renderer, carGroup, carModel;
var headlightMat, frontLensMat, rearLightMat;
var studioFloor, contactShadowMesh, studioLightGroup;
var starsGroup;
var currentBgMode = 'studio'; // 'studio', 'transparent', 'black', 'cosmos'
var exportRes = '1080'; // '1080', '4k', '8k'
var isTurntableActive = false;
var lightsOn = false;
var rearLightsOn = false;
var floorVisible = true;

// Orbit Controls State (Spherical Coordinates)
var spherical = {
  radius: 6.2,
  theta: 0.75, // azimuth angle around Y
  phi: 1.25    // polar angle from top (0 to PI)
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
var previousMousePosition = { x: 0, y: 0 };
var canvas = document.getElementById('webgl');
var loaderOverlay = document.getElementById('loaderOverlay');
var toast = document.getElementById('toast');

init();

function init() {
  // 1. Scene & Camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060608);

  camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 1000);
  updateCameraFromSpherical();

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

  // 8. Event Listeners (Orbit, UI, Hotkeys)
  setupOrbitInteractions();
  setupUIHandlers();

  // 9. Render Loop
  requestAnimationFrame(animate);
}

/* ============================================================
   STUDIO ENVIRONMENT & LIGHTING
   ============================================================ */
function createStudioEnvMap() {
  var canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  var ctx = canvas.getContext('2d');

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

  var tex = new THREE.CanvasTexture(canvas);
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
   ORBIT CAMERA CONTROLLER (INTERACTION)
   ============================================================ */
function setupOrbitInteractions() {
  // Prevent context menu on right click for panning
  canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });

  canvas.addEventListener('mousedown', function(e) {
    isDragging = true;
    isPanning = (e.button === 2); // Right click = pan
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mousemove', function(e) {
    if (!isDragging) return;

    var deltaX = e.clientX - previousMousePosition.x;
    var deltaY = e.clientY - previousMousePosition.y;

    if (isPanning) {
      // Pan camera target
      var panSpeed = 0.004 * targetSpherical.radius;
      var forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      var right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      var up = camera.up.clone().normalize();

      targetCenter.addScaledVector(right, -deltaX * panSpeed);
      targetCenter.addScaledVector(up, deltaY * panSpeed);
    } else {
      // Rotate spherical coordinates
      var rotateSpeed = 0.006;
      targetSpherical.theta -= deltaX * rotateSpeed;
      targetSpherical.phi -= deltaY * rotateSpeed;

      // Clamp polar angle (never flip upside down or clip into floor)
      targetSpherical.phi = Math.max(0.08, Math.min(Math.PI * 0.52, targetSpherical.phi));
    }

    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', function() {
    isDragging = false;
    isPanning = false;
  });

  // Wheel Zoom
  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    var zoomSpeed = 0.0018 * targetSpherical.radius;
    targetSpherical.radius += e.deltaY * zoomSpeed;
    // Clamp zoom distance
    targetSpherical.radius = Math.max(1.8, Math.min(18.0, targetSpherical.radius));
  }, { passive: false });

  // Touch Support (Pinch zoom & 1-finger rotate)
  var initialTouchDist = 0;
  canvas.addEventListener('touchstart', function(e) {
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

      targetSpherical.theta -= deltaX * 0.008;
      targetSpherical.phi -= deltaY * 0.008;
      targetSpherical.phi = Math.max(0.08, Math.min(Math.PI * 0.52, targetSpherical.phi));

      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      var dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      var factor = (initialTouchDist - dist) * 0.015;
      targetSpherical.radius += factor;
      targetSpherical.radius = Math.max(1.8, Math.min(18.0, targetSpherical.radius));
      initialTouchDist = dist;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', function() {
    isDragging = false;
  }, { passive: true });

  // Window Resize
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateCameraFromSpherical() {
  var x = targetCenter.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
  var y = targetCenter.y + spherical.radius * Math.cos(spherical.phi);
  var z = targetCenter.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);

  camera.position.set(x, y, z);
  camera.lookAt(currentCenter);
}

/* ============================================================
   UI HANDLERS & PRESETS
   ============================================================ */
function setupUIHandlers() {
  // 1. Camera Angle Presets
  var poses = {
    front34: { theta: 0.72, phi: 1.28, radius: 6.2, center: { x: 0, y: 0.25, z: 0 } },
    rear34:  { theta: 2.38, phi: 1.28, radius: 6.2, center: { x: 0, y: 0.25, z: 0 } },
    side:    { theta: Math.PI * 0.5, phi: 1.35, radius: 5.8, center: { x: 0, y: 0.25, z: 0 } },
    front:   { theta: 0.0, phi: 1.35, radius: 5.6, center: { x: 0, y: 0.25, z: 0 } },
    rear:    { theta: Math.PI, phi: 1.35, radius: 5.6, center: { x: 0, y: 0.25, z: 0 } },
    top:     { theta: 0.0, phi: 0.12, radius: 6.8, center: { x: 0, y: 0.0, z: 0 } }
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
      }
    });
  });

  // 2. Background Presets
  document.querySelectorAll('[data-bg]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-bg]').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      currentBgMode = btn.getAttribute('data-bg');
      applyBackgroundMode(currentBgMode);
    });
  });

  // 3. Headlights & Taillights
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

  // 4. Turntable Rotation
  var btnTurntable = document.getElementById('btnTurntable');
  btnTurntable.addEventListener('click', function() {
    isTurntableActive = !isTurntableActive;
    btnTurntable.classList.toggle('active', isTurntableActive);
  });

  // 5. Floor Toggle
  var btnFloor = document.getElementById('btnFloor');
  btnFloor.addEventListener('click', function() {
    floorVisible = !floorVisible;
    btnFloor.classList.toggle('active', floorVisible);
    if (studioFloor) studioFloor.visible = floorVisible;
    if (contactShadowMesh) contactShadowMesh.visible = floorVisible;
  });

  // 6. Light Intensity Slider
  var lightSlider = document.getElementById('lightIntensity');
  lightSlider.addEventListener('input', function() {
    var val = parseFloat(lightSlider.value);
    renderer.toneMappingExposure = val * 0.85;
  });

  // 7. Resolution Picker
  document.querySelectorAll('[data-res]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-res]').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      exportRes = btn.getAttribute('data-res');
    });
  });

  // 8. Export Button Action
  var btnExport = document.getElementById('btnExport');
  btnExport.addEventListener('click', function() {
    performHighResExport();
  });

  // 9. Hide / Show UI Controls (H key & Toggle button)
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
   HIGH-RESOLUTION ULTRA QUALITY PNG EXPORTER
   ============================================================ */
function performHighResExport() {
  var width = window.innerWidth;
  var height = window.innerHeight;

  if (exportRes === '4k') {
    width = 3840;
    height = 2160;
  } else if (exportRes === '8k') {
    width = 7680;
    height = 4320;
  } else if (exportRes === '1080') {
    width = 1920;
    height = 1080;
  }

  // 1. Save current viewport state
  var origAspect = camera.aspect;
  var origWidth = renderer.domElement.width;
  var origHeight = renderer.domElement.height;
  var origPixelRatio = renderer.getPixelRatio();
  var origBg = scene.background;

  // 2. Configure for export
  if (currentBgMode === 'transparent') {
    scene.background = null;
  }

  camera.aspect = width / height;
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
  downloadLink.download = `ferrari-f40-${exportRes}-${timestamp}.png`;
  downloadLink.href = dataUrl;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  // 7. Show success Toast
  showToast(`✓ ЭКСПОРТ В PNG (${exportRes.toUpperCase()}) УСПЕШНО СКАЧАН`);
}

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function() {
    toast.classList.remove('show');
  }, 3200);
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

  currentCenter.lerp(targetCenter, 0.08);

  updateCameraFromSpherical();

  // Gentle star twinkle if cosmos active
  if (starsGroup && starsGroup.visible) {
    starsGroup.rotation.y += 0.0003;
  }

  renderer.render(scene, camera);
}
