import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';
import { initTuner } from './tuner.js';

window.THREE = THREE;

/* ============================================================
   GLOBAL STATE & CONSTANTS
   ============================================================ */
var clock = new THREE.Clock();
var scene, camera, renderer;
var carGroup, carModel;
var orbitalEarthGroup, earthMesh;
var starsDeep, starsMid, starsNear;
var floorMesh, contactShadow, studioCeilingLight, studioAmbientLight;
var polishSpotLight, washBayLight, waterStreams, waterVelArr;
var aeroSmokeGroup, aeroSmokeParticles, aeroSmokeLines, aeroSmokeMat, aeroLinesMat, aeroGeo, aeroParticleData, aeroSamples, aeroPositions, aeroColors;
var headlightMat, frontLensMat, rearLightMat;
var carModelTireOffset = -0.56;

var isIntroActive = true;
var introTimeline = null;
var currentStep = 0;
var targetStep = 0;
var stepProgress = { value: 0 };
window.__stepProgress = stepProgress;
var isStepAnimating = false;
var wheelCooldown = false;

var mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
var windowHalf = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

// 3D Animated State Targets
var currentCarPos = new THREE.Vector3(0, 0, 0);
var currentCarRot = new THREE.Euler(0.94, 0.46, -0.44);
var currentCamPos = new THREE.Vector3(0.2, 0.3, 10.0);
var currentLookAt = new THREE.Vector3(-0.35, 0.15, 0);
var currentFov = { value: 35 };
var currentStudioFade = { value: 0 }; // 0 = cosmos, 1 = studio

var _vCarPos = new THREE.Vector3();
var _vCamPos = new THREE.Vector3();
var _vLookAt = new THREE.Vector3();

window.__state = { carLoaded: false, earthLoaded: false };

// DOM Elements
var canvas = document.getElementById('webgl');
var hudSteps = document.querySelectorAll('.hud-step');
var brandOverlay = document.getElementById('brandOverlay');
var heroContent = document.getElementById('heroContent');
var servicesOverlay = document.getElementById('servicesOverlay');
var contactOverlay = document.getElementById('contactOverlay');
var serviceSlides = document.querySelectorAll('.service-slide');

/* ============================================================
   INITIALIZATION
   ============================================================ */
initThree();
initDeepCosmosWithLayers();
initCinematicSunlight();
initPhotorealisticOrbitalEarth();
initStudioEnvironment();
initAerodynamicWindTunnelSmoke();
loadFerrariF40();
initScrollAndInteractions();
initTuner({
  THREE: THREE,
  camera: camera,
  carGroup: carGroup,
  getStepPose: getStepPose,
  goToStep: goToStep,
  getCurrentStep: function() { return currentStep; }
});
animate();

/* ============================================================
   THREE.JS SETUP & RENDERER
   ============================================================ */
function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  // Fog is NOT set initially so Earth and Cosmos are 100% visible!
  scene.fog = null;
  window.scene = scene;

  camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.08, 4000);
  camera.position.copy(currentCamPos);
  camera.lookAt(currentLookAt);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  scene.environment = createMonochromeStudioEnvironment();

  carGroup = new THREE.Group();
  carGroup.visible = false;
  scene.add(carGroup);
  window.__carGroup = carGroup;
  window.camera = camera;
  window.scene = scene;

  window.__currentCarPos = currentCarPos;
  window.__currentCarRot = currentCarRot;
  window.__currentCamPos = currentCamPos;
  window.__currentLookAt = currentLookAt;
  window.__currentFov = currentFov;
}

/* ============================================================
   MONOCHROME STUDIO ENVIRONMENT MAP (ZERO BLUE)
   ============================================================ */
function createMonochromeStudioEnvironment() {
  var envCanvas = document.createElement('canvas');
  envCanvas.width = 1024;
  envCanvas.height = 512;
  var ctx = envCanvas.getContext('2d');

  var grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#020202');
  grad.addColorStop(0.45, '#070707');
  grad.addColorStop(0.55, '#121212');
  grad.addColorStop(0.75, '#181818');
  grad.addColorStop(1.0, '#010101');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Pure white overhead softbox reflection
  var softGrad = ctx.createRadialGradient(512, 100, 0, 512, 100, 160);
  softGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  softGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.65)');
  softGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
  softGrad.addColorStop(1.0, 'transparent');
  ctx.fillStyle = softGrad;
  ctx.fillRect(0, 0, 1024, 260);

  var envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  return envTex;
}

/* ============================================================
   LIGHTING (PURE WHITE & MINIMALIST - ZERO BLUE)
   ============================================================ */
function initCinematicSunlight() {
  var ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);

  var sunLight = new THREE.DirectionalLight(0xffffff, 4.4);
  sunLight.position.set(26, 30, 20);
  sunLight.target.position.set(-0.5, 0.2, 0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  var rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
  rimLight.position.set(-20, 20, -10);
  scene.add(rimLight);
}

function createStarTexture() {
  var canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  var ctx = canvas.getContext('2d');

  // Smooth circular luminous celestial falloff (Zero square pixels)
  var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.9)');
  grad.addColorStop(0.55, 'rgba(210, 230, 255, 0.35)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  var tex = new THREE.CanvasTexture(canvas);
  return tex;
}

/* ============================================================
   DEEP COSMOS STARFIELD (CIRCULAR SOFT STARS WITH LIVING TWINKLE)
   ============================================================ */
function initDeepCosmosWithLayers() {
  var starTexture = createStarTexture();

  function makeStars(count, minR, maxR, size, opacity) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var col = new Float32Array(count * 3);

    for (var i = 0; i < count; i++) {
      var r = minR + Math.random() * (maxR - minR);
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      var bri = 0.45 + Math.random() * 0.55;
      col[i * 3]     = bri;
      col[i * 3 + 1] = bri;
      col[i * 3 + 2] = bri;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var mat = new THREE.PointsMaterial({
      size: size,
      map: starTexture,
      vertexColors: true,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    mat.fog = false; // Never let fog dim the stars!
    return new THREE.Points(geo, mat);
  }

  // Dense, rich starry deep cosmos filled with sparkling celestial points
  starsDeep = makeStars(9000, 700, 1800, 2.2, 0.95);
  starsMid  = makeStars(4500, 350, 750, 2.8, 0.98);
  starsNear = makeStars(850, 180, 360, 3.4, 0.95);

  scene.add(starsDeep);
  scene.add(starsMid);
  scene.add(starsNear);
}

/* ============================================================
   PHOTOREALISTIC ORBITAL EARTH (NEVER BLOCKED BY FOG)
   ============================================================ */
function initPhotorealisticOrbitalEarth() {
  var textureLoader = new THREE.TextureLoader();
  var maxAniso = renderer.capabilities.getMaxAnisotropy();

  orbitalEarthGroup = new THREE.Group();
  orbitalEarthGroup.position.set(-3.2, -2.4, -22.0);
  orbitalEarthGroup.rotation.z = -0.13;

  var earthGeo = new THREE.PlaneGeometry(54, 36, 64, 64);
  var posAttr = earthGeo.attributes.position;
  for (var i = 0; i < posAttr.count; i++) {
    var x = posAttr.getX(i);
    var y = posAttr.getY(i);
    var distSq = (x * x) * 0.006 + (y * y) * 0.004;
    posAttr.setZ(i, -distSq);
  }
  earthGeo.computeVertexNormals();

  var orbitalTex = textureLoader.load('assets/textures/earth_orbital_borneo.jpg', function() {
    window.__state.earthLoaded = true;
  });
  orbitalTex.colorSpace = THREE.SRGBColorSpace;
  orbitalTex.anisotropy = maxAniso;

  var earthMat = new THREE.MeshBasicMaterial({
    map: orbitalTex,
    toneMapped: true,
    transparent: true,
    opacity: 1.0,
    fog: false // STRICT: Fog must NEVER obscure the Earth!
  });

  earthMesh = new THREE.Mesh(earthGeo, earthMat);
  orbitalEarthGroup.add(earthMesh);
  scene.add(orbitalEarthGroup);
}

/* ============================================================
   PROCEDURAL TEXTURES FOR MATTE-MIRROR STUDIO FLOOR
   ============================================================ */
function createStudioFloorTexture() {
  var floorCanvas = document.createElement('canvas');
  floorCanvas.width = 1024;
  floorCanvas.height = 1024;
  var ctx = floorCanvas.getContext('2d');

  // Deep neutral charcoal (NO BLUE)
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle clean luxury grid (128x128px tiles)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.032)';
  ctx.lineWidth = 1.5;
  for (var i = 0; i <= 1024; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  var tex = new THREE.CanvasTexture(floorCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  return tex;
}

function createFloorAlphaMap() {
  var aCanvas = document.createElement('canvas');
  aCanvas.width = 512;
  aCanvas.height = 512;
  var aCtx = aCanvas.getContext('2d');

  // Smooth radial falloff to zero opacity at the edges (Zero harsh horizon line)
  var grad = aCtx.createRadialGradient(256, 256, 80, 256, 256, 256);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(0.85, 'rgba(255, 255, 255, 0.25)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

  aCtx.fillStyle = grad;
  aCtx.fillRect(0, 0, 512, 512);

  return new THREE.CanvasTexture(aCanvas);
}

function createContactShadowTexture() {
  var sCanvas = document.createElement('canvas');
  sCanvas.width = 512;
  sCanvas.height = 512;
  var sCtx = sCanvas.getContext('2d');

  var grad = sCtx.createRadialGradient(256, 256, 30, 256, 256, 240);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 512, 512);

  return new THREE.CanvasTexture(sCanvas);
}

/* ============================================================
   MINIMALIST STUDIO LIGHTING (DEEP SPACE DETAILING PAVILION)
   ============================================================ */
function initStudioEnvironment() {
  // Pure open space: zero hazy floor planes or artificial stripes floating under the car
  floorMesh = null;
  contactShadow = null;

  // 1. Studio Overhead Directional Soft Light & Ambient (Pure White)
  studioCeilingLight = new THREE.DirectionalLight(0xffffff, 0);
  studioCeilingLight.position.set(0, 8, 3);
  scene.add(studioCeilingLight);

  studioAmbientLight = new THREE.AmbientLight(0xffffff, 0);
  scene.add(studioAmbientLight);

  // 2. Wash Bay Crisp Top Cleanroom Light (Step 1)
  washBayLight = new THREE.SpotLight(0xffffff, 0, 18, Math.PI / 4, 0.6);
  washBayLight.position.set(-2.2, 5.5, 2.5);
  scene.add(washBayLight);
  scene.add(washBayLight.target);

  // 3. Polishing Flank Inspection Spotlight (Step 2)
  polishSpotLight = new THREE.SpotLight(0xffffff, 0, 16, Math.PI / 6, 0.35);
  polishSpotLight.position.set(-3.5, 1.8, 4.5);
  scene.add(polishSpotLight);
  scene.add(polishSpotLight.target);
}

/* ============================================================
   AERODYNAMIC WIND TUNNEL STREAMLINES (STEP 1: WASH / AERO DRY)
   Focused, semi-transparent aerodynamic vapor ribbons hugging F40 contours
   ============================================================ */
// Exact surface height from 3D model vertices
var F40_SURFACE_PROFILE = [
  { z: 1.15, y0: 0.007, ySide: 0.032 },
  { z: 1.05, y0: 0.027, ySide: 0.059 },
  { z: 0.95, y0: 0.048, ySide: 0.080 },
  { z: 0.85, y0: 0.084, ySide: 0.099 },
  { z: 0.75, y0: 0.130, ySide: 0.115 },
  { z: 0.65, y0: 0.143, ySide: 0.138 },
  { z: 0.55, y0: 0.151, ySide: 0.181 },
  { z: 0.45, y0: 0.189, ySide: 0.185 },
  { z: 0.35, y0: 0.256, ySide: 0.254 },
  { z: 0.25, y0: 0.284, ySide: 0.282 },
  { z: 0.15, y0: 0.340, ySide: 0.338 },
  { z: 0.05, y0: 0.359, ySide: 0.356 },
  { z: -0.05, y0: 0.371, ySide: 0.368 },
  { z: -0.15, y0: 0.375, ySide: 0.371 },
  { z: -0.25, y0: 0.370, ySide: 0.365 },
  { z: -0.35, y0: 0.376, ySide: 0.371 },
  { z: -0.45, y0: 0.372, ySide: 0.367 },
  { z: -0.55, y0: 0.358, ySide: 0.361 },
  { z: -0.65, y0: 0.352, ySide: 0.350 },
  { z: -0.75, y0: 0.339, ySide: 0.329 },
  { z: -0.85, y0: 0.317, ySide: 0.301 },
  { z: -0.95, y0: 0.292, ySide: 0.273 },
  { z: -1.05, y0: 0.266, ySide: 0.257 },
  { z: -1.15, y0: 0.242, ySide: 0.232 },
  { z: -1.25, y0: 0.210, ySide: 0.188 },
  { z: -1.35, y0: 0.313, ySide: 0.316 },
  { z: -1.45, y0: 0.350, ySide: 0.360 },
  { z: -1.55, y0: 0.386, ySide: 0.386 }
];

function getF40SurfaceY(x, z) {
  var absX = Math.abs(x);
  var sideBlend = Math.min(1.0, absX / 0.35);

  if (z >= 1.15) {
    return 0.007 + (z - 1.15) * 0.05;
  }
  if (z <= -1.55) {
    var wakeDist = -1.55 - z;
    return 0.386 - wakeDist * 0.04;
  }

  for (var i = 0; i < F40_SURFACE_PROFILE.length - 1; i++) {
    var p0 = F40_SURFACE_PROFILE[i];
    var p1 = F40_SURFACE_PROFILE[i + 1];
    if (z <= p0.z && z >= p1.z) {
      var frac = (p0.z - z) / (p0.z - p1.z);
      var yCenter = p0.y0 + frac * (p1.y0 - p0.y0);
      var ySide = p0.ySide + frac * (p1.ySide - p0.ySide);
      var base = yCenter * (1.0 - sideBlend) + ySide * sideBlend;
      if (absX > 0.45) {
        base = Math.max(0.12, base - (absX - 0.45) * 0.25);
      }
      return base;
    }
  }

  return 0.25;
}

function initAerodynamicWindTunnelSmoke() {
  aeroSmokeGroup = new THREE.Group();
  aeroSmokeGroup.visible = false;
  carGroup.add(aeroSmokeGroup);

  // Silky, delicate aerodynamic smoke filament texture (128x128)
  var smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = 128;
  smokeCanvas.height = 128;
  var sCtx = smokeCanvas.getContext('2d');
  var sGrad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  sGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
  sGrad.addColorStop(0.25, 'rgba(235, 245, 255, 0.55)');
  sGrad.addColorStop(0.60, 'rgba(210, 235, 255, 0.15)');
  sGrad.addColorStop(0.85, 'rgba(180, 220, 255, 0.03)');
  sGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, 128, 128);
  var smokeTex = new THREE.CanvasTexture(smokeCanvas);

  // 5 elegant, focused aerodynamic streamline ribbons (like laser-illuminated wind tunnel smoke nozzles)
  // Ribbons start slightly behind front bumper on hood (z = 0.95) so no front wall is seen!
  var lanes = [
    { base: 0.00, spread: 0.035, count: 650 },
    { base: -0.22, spread: 0.030, count: 500 },
    { base: 0.22, spread: 0.030, count: 500 },
    { base: -0.42, spread: 0.030, count: 450 },
    { base: 0.42, spread: 0.030, count: 450 }
  ];

  var totalParticles = 0;
  lanes.forEach(function(l) { totalParticles += l.count; });

  aeroParticleData = [];
  aeroPositions = new Float32Array(totalParticles * 3);
  aeroColors = new Float32Array(totalParticles * 3);

  var pIndex = 0;
  lanes.forEach(function(lane) {
    for (var i = 0; i < lane.count; i++) {
      var lateralOffset = (Math.random() - 0.5) * lane.spread;
      var laneX = lane.base + lateralOffset;
      var initT = Math.random();
      var speed = 0.28 + Math.random() * 0.10;
      var hover = 0.012 + Math.random() * 0.012;
      var phase = Math.random() * Math.PI * 2;

      var z = 0.95 - initT * 3.55;
      var y = getF40SurfaceY(laneX, z) + hover;

      aeroParticleData.push({
        baseLane: lane.base,
        lateralOffset: lateralOffset,
        t: initT,
        speed: speed,
        hover: hover,
        phase: phase
      });

      aeroPositions[pIndex * 3]     = laneX;
      aeroPositions[pIndex * 3 + 1] = y;
      aeroPositions[pIndex * 3 + 2] = z;

      aeroColors[pIndex * 3]     = 1.0;
      aeroColors[pIndex * 3 + 1] = 1.0;
      aeroColors[pIndex * 3 + 2] = 1.0;
      pIndex++;
    }
  });

  aeroGeo = new THREE.BufferGeometry();
  aeroGeo.setAttribute('position', new THREE.BufferAttribute(aeroPositions, 3));
  aeroGeo.setAttribute('color', new THREE.BufferAttribute(aeroColors, 3));

  // Small, sharp, delicate particles that form sleek continuous silky ribbons
  aeroSmokeMat = new THREE.PointsMaterial({
    size: 0.14,
    map: smokeTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  aeroSmokeMat.fog = false;

  aeroSmokeParticles = new THREE.Points(aeroGeo, aeroSmokeMat);
  aeroSmokeGroup.add(aeroSmokeParticles);
}

/* ============================================================
   LOAD FERRARI F40 (MATHEMATICAL TIRE GROUND CONTACT)
   ============================================================ */
function loadFerrariF40() {
  var loader = new GLTFLoader();

  loader.load(
    'assets/models/ferrari_f40.glb',
    function(gltf) {
      carModel = gltf.scene;

      var box = new THREE.Box3().setFromObject(carModel);
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());

      // Center exactly at center of mass as in b696b71
      carModel.position.x = -center.x;
      carModel.position.y = -center.y;
      carModel.position.z = -center.z;

      var maxDim = Math.max(size.x, size.y, size.z);
      var targetScale = 3.25 / maxDim;
      carModel.scale.setScalar(targetScale);

      // Measure exact bottom of tires in carGroup coordinates
      var scaledBox = new THREE.Box3().setFromObject(carModel);
      carModelTireOffset = scaledBox.min.y;
      window.__carModelTireOffset = carModelTireOffset;

      carModel.traverse(function(node) {
        if (node.isMesh && node.material) {
          var mat = node.material;

          // Paint Material: High-Gloss Mirror Clearcoat
          if (mat.name === 'Paint' || mat.name.toLowerCase().includes('paint')) {
            mat.roughness = 0.02;
            mat.metalness = 0.35;
            mat.clearcoat = 1.0;
            mat.clearcoatRoughness = 0.002;
          }

          // Real 3D Headlights & Front Lenses
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
      window.__carModel = carModel;
      window.__state.carLoaded = true;
      console.log('CAR LOADED AT:', performance.now());

      // Pre-warm and compile all WebGL programs up front to guarantee ZERO stutter during transitions
      try {
        renderer.compile(scene, camera);
      } catch (e) {
        console.warn('Renderer compile notice:', e);
      }

      startIntroSequence();
    },
    undefined,
    function(err) {
      console.error('Error loading car:', err);
    }
  );
}

/* ============================================================
   INTRO FLY-IN SEQUENCE (Locked until car arrives, but skippable)
   ============================================================ */
function skipIntroIfActive() {
  if (isIntroActive) {
    if (introTimeline) introTimeline.kill();
    isIntroActive = false;
    window.__isIntroActive = false;
    var rest = getStepPose(0);
    currentCarPos.copy(rest.carPos);
    currentCarRot.copy(rest.carRot);
    currentCamPos.copy(rest.camPos);
    currentLookAt.copy(rest.lookAt);
    if (heroContent) {
      heroContent.classList.remove('hero-hidden');
      heroContent.classList.add('hero-visible');
    }
    triggerFlickerIn(brandOverlay);
  }
}

function startIntroSequence() {
  console.log('START INTRO SEQUENCE CALLED');
  try {
    var rest = getStepPose(0);

    // Initial position in deep space (classic grand approach)
    currentCarPos.set(rest.carPos.x + 1.2, rest.carPos.y + 4.8, -60);
    currentCarRot.set(
      rest.carRot.x + Math.PI * 2.0,
      rest.carRot.y + Math.PI * 2.5,
      rest.carRot.z - Math.PI * 1.4
    );
    currentCamPos.set(0.2, 0.3, 10.0);
    currentLookAt.set(rest.lookAt.x, rest.lookAt.y, rest.lookAt.z);
    currentFov.value = rest.fov;
    currentStudioFade.value = 0;

    carGroup.position.copy(currentCarPos);
    carGroup.rotation.copy(currentCarRot);
    carGroup.visible = true;

    // Strict lock: text hidden initially, flickers in concurrently during landing
    if (heroContent) {
      heroContent.classList.add('hero-hidden');
      heroContent.classList.remove('hero-visible');
    }

    var gsapInst = window.gsap || gsap;

    introTimeline = gsapInst.timeline({
      onComplete: function() {
        console.log('INTRO COMPLETE AT:', performance.now());
        isIntroActive = false;
        window.__isIntroActive = false;
        currentCarPos.copy(rest.carPos);
        currentCarRot.copy(rest.carRot);
        currentCamPos.copy(rest.camPos);
        currentLookAt.copy(rest.lookAt);
      }
    });

    // Grand cinematic approach: camera glides in from orbit toward Earth and the car
    introTimeline.to(currentCamPos, {
      x: rest.camPos.x,
      y: rest.camPos.y,
      z: rest.camPos.z,
      duration: 2.6,
      ease: 'power3.out'
    }, 0);

    introTimeline.to(currentLookAt, {
      x: rest.lookAt.x,
      y: rest.lookAt.y,
      z: rest.lookAt.z,
      duration: 2.6,
      ease: 'power3.out'
    }, 0);

    introTimeline.to(currentCarPos, {
      x: rest.carPos.x,
      y: rest.carPos.y,
      z: rest.carPos.z,
      duration: 2.6,
      ease: 'power3.out'
    }, 0);

    introTimeline.to(currentCarRot, {
      x: rest.carRot.x,
      y: rest.carRot.y,
      z: rest.carRot.z,
      duration: 2.6,
      ease: 'power3.out'
    }, 0);

    // Concurrently trigger text flicker during landing
    introTimeline.add(function() {
      if (heroContent) {
        heroContent.classList.remove('hero-hidden');
        heroContent.classList.add('hero-visible');
      }
      triggerFlickerIn(brandOverlay);
    }, 1.9);
  } catch (err) {
    console.error('START INTRO ERROR:', err);
  }
}

/* ============================================================
   SCENE STEP POSES (HERO -> WASH -> POLISH -> COCKPIT -> STUDIO)
   ============================================================ */
function getStepPose(step) {
  if (window.__tunerOverrides && window.__tunerOverrides[step]) {
    return window.__tunerOverrides[step];
  }

  var isDesktop = window.innerWidth > 900;

  switch (step) {
    case 0: // HERO: Space orbit
      return {
        carPos: new THREE.Vector3(isDesktop ? -1.22 : 0.00, isDesktop ? 0.36 : 1.20, isDesktop ? 2.40 : 1.85),
        carRot: new THREE.Euler(0.94, 0.46, -0.44),
        camPos: new THREE.Vector3(0.00, 0.00, 7.50),
        lookAt: new THREE.Vector3(isDesktop ? -0.48 : 0.00, isDesktop ? 0.15 : 0.38, 0.00),
        fov: 35,
        studioFade: 0.0,
        headlights: 0.0,
        washFade: 0.0
      };

    case 1: // 01 WASH
      return {
        carPos: new THREE.Vector3(isDesktop ? -1.34 : -0.18, isDesktop ? 0.72 : 0.86, isDesktop ? 2.20 : 1.80),
        carRot: new THREE.Euler(0.00, isDesktop ? 0.78 : 0.28, 0.00),
        camPos: new THREE.Vector3(0.00, isDesktop ? 0.82 : 1.02, isDesktop ? 6.60 : 8.60),
        lookAt: new THREE.Vector3(isDesktop ? -0.42 : 0.00, isDesktop ? 0.54 : 0.70, isDesktop ? -0.30 : 0.00),
        fov: isDesktop ? 18 : 33,
        studioFade: 1.0,
        headlights: 0.0,
        washFade: 1.0
      };

    case 2: // 02 POLISH
      return {
        carPos: new THREE.Vector3(isDesktop ? -1.65 : -1.48, isDesktop ? 1.30 : 1.08, isDesktop ? 3.15 : 2.25),
        carRot: new THREE.Euler(0.00, -0.42, 0.00),
        camPos: new THREE.Vector3(isDesktop ? -0.20 : -0.32, isDesktop ? 1.20 : 1.02, isDesktop ? 4.35 : 5.10),
        lookAt: new THREE.Vector3(isDesktop ? -0.95 : -0.92, isDesktop ? 1.05 : 0.65, 0.00),
        fov: isDesktop ? 28 : 36,
        studioFade: 1.0,
        headlights: 0.0,
        washFade: 0.0
      };

    case 3: // 03 INTERIOR
      return {
        carPos: new THREE.Vector3(isDesktop ? -0.56 : 0.16, isDesktop ? 0.28 : 0.72, isDesktop ? 1.90 : 1.20),
        carRot: new THREE.Euler(0.00, isDesktop ? -0.16 : 0.40, isDesktop ? 0.00 : 0.01),
        camPos: new THREE.Vector3(isDesktop ? -0.84 : 0.10, isDesktop ? 0.22 : 0.68, isDesktop ? 2.20 : 1.60),
        lookAt: new THREE.Vector3(isDesktop ? -0.32 : 0.15, isDesktop ? 0.08 : 0.45, isDesktop ? 1.35 : 0.50),
        fov: isDesktop ? 90 : 82,
        studioFade: 1.0,
        headlights: 0.0,
        washFade: 0.0
      };

    case 4: // 04 STUDIO & LOCATION: Strictly 180° REAR view, locked and centered
    default:
      return {
        carPos: new THREE.Vector3(0.00, isDesktop ? 0.55 : 0.38, isDesktop ? 2.00 : 1.85),
        carRot: new THREE.Euler(0.00, Math.PI, 0.00), // Exact 180° - strictly and symmetrically rear-facing
        camPos: new THREE.Vector3(0.00, isDesktop ? 0.60 : 0.42, isDesktop ? 6.80 : 8.80),
        lookAt: new THREE.Vector3(0.00, isDesktop ? 0.25 : 0.18, 0.00),
        fov: isDesktop ? 34 : 36,
        studioFade: 1.0,
        headlights: 1.0,
        washFade: 0.0
      };
  }
}

/* ============================================================
   DIGITAL FLICKER SYSTEM
   ============================================================ */
function triggerFlickerIn(container) {
  if (!container) return;
  var items = container.querySelectorAll('.flicker-item');
  items.forEach(function(item, index) {
    item.classList.remove('flicker-out');
    item.classList.remove('flicker-active');
    setTimeout(function() {
      item.classList.add('flicker-active');
    }, index * 55);
  });
}

function triggerFlickerOut(container, callback) {
  if (!container) {
    if (callback) callback();
    return;
  }
  var items = container.querySelectorAll('.flicker-item');
  items.forEach(function(item) {
    item.classList.remove('flicker-active');
    item.classList.add('flicker-out');
  });
  setTimeout(function() {
    if (callback) callback();
  }, 200);
}

/* ============================================================
   UI OVERLAY STEP SWITCHER
   ============================================================ */
function updateUIStep(newStep) {
  if (newStep === currentStep) return;
  currentStep = newStep;
  window.__currentStep = currentStep;

  // Update HUD indicator
  hudSteps.forEach(function(stepEl) {
    var target = parseInt(stepEl.getAttribute('data-target'), 10);
    stepEl.classList.toggle('active', target === newStep);
  });

  // Manage Overlays
  brandOverlay.classList.toggle('active', newStep === 0);
  servicesOverlay.classList.toggle('active', newStep >= 1 && newStep <= 3);
  contactOverlay.classList.toggle('active', newStep === 4);

  // Trigger minimal flicker
  if (newStep === 0) {
    triggerFlickerIn(brandOverlay);
  } else if (newStep >= 1 && newStep <= 3) {
    serviceSlides.forEach(function(slide) {
      var sIdx = parseInt(slide.getAttribute('data-service'), 10);
      if (sIdx === newStep) {
        slide.classList.add('current');
        triggerFlickerIn(slide);
      } else {
        slide.classList.remove('current');
      }
    });
  } else if (newStep === 4) {
    triggerFlickerIn(contactOverlay);
  }
}

/* ============================================================
   STEP CONTROLLER & INTERACTION EVENTS (INERTIAL DEBOUNCE)
   ============================================================ */
function goToStep(newStep) {
  if (isIntroActive) {
    skipIntroIfActive();
  }
  if (newStep < 0 || newStep > 4) return;
  if (newStep === currentStep && !isStepAnimating) return;

  targetStep = newStep;
  updateUIStep(newStep);

  isStepAnimating = true;
  var gsapInst = window.gsap || gsap;
  // Slower, smoother, luxury pacing across all steps (and extended for rear turnaround)
  var animDuration = (newStep === 4 || currentStep === 4) ? 2.1 : 1.7;

  gsapInst.to(stepProgress, {
    value: newStep,
    duration: animDuration,
    ease: 'power2.inOut',
    onComplete: function() {
      isStepAnimating = false;
    }
  });
}
window.goToStep = goToStep;

function initScrollAndInteractions() {
  window.addEventListener('resize', onWindowResize);

  // Pointer Parallax (with safe vertical clamp)
  window.addEventListener('pointermove', function(e) {
    if (e.pointerType === 'mouse') {
      mouse.targetX = (e.clientX - windowHalf.x) / windowHalf.x;
      mouse.targetY = Math.max(-0.45, Math.min(0.45, (e.clientY - windowHalf.y) / windowHalf.y));
    }
  });

  // Mouse Wheel Navigation (STRICT DEBOUNCE - 1 FLICK = 1 STEP)
  window.addEventListener('wheel', function(e) {
    if (isIntroActive) {
      skipIntroIfActive();
    }
    if (isStepAnimating || wheelCooldown) return;
    if (Math.abs(e.deltaY) < 20) return;

    wheelCooldown = true;
    setTimeout(function() { wheelCooldown = false; }, 850);

    if (e.deltaY > 0) {
      goToStep(currentStep + 1);
    } else {
      goToStep(currentStep - 1);
    }
  }, { passive: true });

  // Touch Drag & Swipe (STRICT DEBOUNCE)
  var touchStartY = 0;
  window.addEventListener('touchstart', function(e) {
    if (isIntroActive) {
      skipIntroIfActive();
    }
    if (e.touches && e.touches.length > 0) {
      touchStartY = e.touches[0].clientY;
      var touch = e.touches[0];
      mouse.targetX = (touch.clientX - windowHalf.x) / windowHalf.x;
      mouse.targetY = (touch.clientY - windowHalf.y) / windowHalf.y;
    }
  }, { passive: true });

  window.addEventListener('touchmove', function(e) {
    if (e.touches && e.touches.length > 0) {
      var touch = e.touches[0];
      mouse.targetX = (touch.clientX - windowHalf.x) / windowHalf.x;
      mouse.targetY = (touch.clientY - windowHalf.y) / windowHalf.y;
    }
  }, { passive: true });

  window.addEventListener('touchend', function(e) {
    if (isIntroActive) {
      skipIntroIfActive();
    }
    if (isStepAnimating || wheelCooldown) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    var touchEndY = e.changedTouches[0].clientY;
    var diffY = touchStartY - touchEndY;

    if (Math.abs(diffY) > 35) {
      wheelCooldown = true;
      setTimeout(function() { wheelCooldown = false; }, 850);
      if (diffY > 0) {
        goToStep(currentStep + 1);
      } else {
        goToStep(currentStep - 1);
      }
    }
  }, { passive: true });

  // Keyboard Arrow / Page Navigation
  window.addEventListener('keydown', function(e) {
    if (isIntroActive) {
      skipIntroIfActive();
    }
    if (isStepAnimating || wheelCooldown) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      wheelCooldown = true;
      setTimeout(function() { wheelCooldown = false; }, 850);
      goToStep(currentStep + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      wheelCooldown = true;
      setTimeout(function() { wheelCooldown = false; }, 850);
      goToStep(currentStep - 1);
    }
  });

  // Navigation Click Handlers (Buttons, HUD dots)
  document.querySelectorAll('[data-target]').forEach(function(btn) {
    var triggerNav = function(e) {
      e.preventDefault();
      e.stopPropagation();
      var target = parseInt(btn.getAttribute('data-target'), 10);
      if (isIntroActive) {
        skipIntroIfActive();
      }
      goToStep(target);
    };
    btn.addEventListener('click', triggerNav);
    btn.addEventListener('touchend', triggerNav);
  });
}

function onWindowResize() {
  windowHalf.x = window.innerWidth / 2;
  windowHalf.y = window.innerHeight / 2;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ============================================================
   CONTINUOUS RENDER & LERP ANIMATION LOOP
   ============================================================ */
function animate() {
  requestAnimationFrame(animate);

  var elapsedTime = clock.getElapsedTime();
  var isDesktop = window.innerWidth > 900;
  var raw = (stepProgress && typeof stepProgress.value === 'number') ? stepProgress.value : 0;

  // Smooth mouse damping
  mouse.x += (mouse.targetX - mouse.x) * 0.055;
  mouse.y += (mouse.targetY - mouse.y) * 0.055;

  if (!isIntroActive && carGroup) {
    var baseStep = Math.floor(raw);
    var nextStep = Math.min(baseStep + 1, 4);
    var stepFrac = raw - baseStep;

    var poseA = getStepPose(baseStep);
    var poseB = getStepPose(nextStep);

    if (poseA && poseB && poseA.carPos && poseB.carPos) {
      // Interpolate pose targets between steps using static vectors (zero GC pressure)
      _vCarPos.lerpVectors(poseA.carPos, poseB.carPos, stepFrac);
      _vCamPos.lerpVectors(poseA.camPos, poseB.camPos, stepFrac);
      _vLookAt.lerpVectors(poseA.lookAt, poseB.lookAt, stepFrac);
      var targetFovVal = THREE.MathUtils.lerp(poseA.fov, poseB.fov, stepFrac);

      var rotProgress = (baseStep === 3) ? (stepFrac * stepFrac * (3 - 2 * stepFrac)) : stepFrac;
      var targetRotX = THREE.MathUtils.lerp(poseA.carRot.x, poseB.carRot.x, stepFrac);
      var targetRotY = THREE.MathUtils.lerp(poseA.carRot.y, poseB.carRot.y, rotProgress);
      var targetRotZ = THREE.MathUtils.lerp(poseA.carRot.z, poseB.carRot.z, stepFrac);

      var targetFade = THREE.MathUtils.lerp(poseA.studioFade, poseB.studioFade, stepFrac);
      var targetLights = THREE.MathUtils.lerp(poseA.headlights, poseB.headlights, stepFrac);
      var targetWash = THREE.MathUtils.lerp(poseA.washFade, poseB.washFade, stepFrac);

      // Direct exact synchronization with GSAP interpolation (zero phase lag)
      currentCarPos.copy(_vCarPos);
      currentCarRot.set(targetRotX, targetRotY, targetRotZ);
      currentCamPos.copy(_vCamPos);
      currentLookAt.copy(_vLookAt);
      currentFov.value = targetFovVal;
      currentStudioFade.value = targetFade;
    }
  }

  // Continuous unified 3D updates & parallax: zero teleportation or snap
  if (carGroup) {
    carGroup.position.copy(currentCarPos);
    carGroup.rotation.copy(currentCarRot);
  }

  camera.fov = currentFov.value;
  camera.updateProjectionMatrix();

  // Camera parallax sensitivity: strictly damped in cockpit (Step 3) so camera NEVER touches windshield or A-pillar
  // On mobile at Step 4 (Studio), strictly ZERO sensitivity so car stands perfectly still and does not react to finger touch
  var isInterior = (raw >= 2.4 && raw <= 3.6);
  var isFinalMobile = (!isDesktop && raw >= 3.65);
  var horizSens = (isFinalMobile || window.__tunerActive) ? 0 : (isInterior ? 0.025 : 0.14);
  var vertSens  = (isFinalMobile || window.__tunerActive) ? 0 : (isInterior ? 0.015 : 0.045);

  if (isFinalMobile) {
    mouse.x = 0;
    mouse.y = 0;
    mouse.targetX = 0;
    mouse.targetY = 0;
  }

  camera.position.set(
    currentCamPos.x + mouse.x * horizSens,
    currentCamPos.y - mouse.y * vertSens,
    currentCamPos.z
  );
  camera.lookAt(
    currentLookAt.x + mouse.x * (horizSens * 0.35),
    currentLookAt.y - mouse.y * (vertSens * 0.35),
    currentLookAt.z
  );

  if (!isIntroActive && carGroup) {
    var sFade = currentStudioFade.value;

    if (studioCeilingLight) {
      studioCeilingLight.intensity = sFade * 3.4;
    }
    if (studioAmbientLight) {
      studioAmbientLight.intensity = sFade * 0.55;
    }

    // Earth ONLY on Step 0 (Hero): smoothly fades out during the transition to Wash
    var earthAlpha = Math.max(0, 1.0 - raw * 1.5);
    if (earthMesh && earthMesh.material) {
      earthMesh.material.opacity = earthAlpha;
    }
    if (orbitalEarthGroup) {
      orbitalEarthGroup.visible = (raw < 0.98);
      orbitalEarthGroup.position.y = -2.4 - raw * 6.0;
    }

    // Volumetric 3D Cosmos: dynamic layered depth parallax and living celestial twinkle
    var twinkle1 = (Math.sin(elapsedTime * 2.8) * 0.5 + 0.5);
    var twinkle2 = (Math.cos(elapsedTime * 3.4) * 0.5 + 0.5);
    if (starsDeep && starsDeep.material) {
      starsDeep.position.z = raw * 15;
      starsDeep.material.opacity = 0.70 + twinkle1 * 0.28;
      starsDeep.visible = true;
    }
    if (starsMid && starsMid.material) {
      starsMid.position.z = raw * 35;
      starsMid.material.opacity = 0.72 + twinkle2 * 0.26;
      starsMid.visible = true;
    }
    if (starsNear && starsNear.material) {
      starsNear.position.z = raw * 75;
      starsNear.material.opacity = 0.75 + ((twinkle1 + twinkle2) * 0.5) * 0.24;
      starsNear.visible = true;
    }

    // 1. AERODYNAMIC WIND TUNNEL STREAMLINES (ACTIVE ON STEP 1: WASH / AERO DRY)
    if (aeroSmokeGroup && aeroSmokeMat) {
      var isWashActive = (targetWash > 0.005);
      aeroSmokeGroup.visible = isWashActive;
      aeroSmokeMat.opacity = targetWash * 0.38;

      if (isWashActive && aeroParticleData && aeroPositions) {
        var dt = 0.016;
        for (var i = 0; i < aeroParticleData.length; i++) {
          var p = aeroParticleData[i];
          p.t = (p.t + dt * p.speed) % 1.0;

          // Starts gracefully on the hood (z = 0.95), skims windshield, roof, louvers, and wing to z = -2.6
          var z = 0.95 - p.t * 3.55;
          var x = p.baseLane + p.lateralOffset;

          // Delicate vortex dissipation behind rear wing (z < -1.55)
          if (z < -1.55) {
            var wakeDist = -1.55 - z;
            x += Math.sign(p.baseLane || (i % 2 === 0 ? 1 : -1)) * (wakeDist * 0.08);
            var vortex = Math.sin(p.t * 14 + elapsedTime * 4.5 + p.phase) * (wakeDist * 0.04);
            x += vortex;
          }

          var surfaceY = getF40SurfaceY(x, z);
          var wakeTurbulence = (z < -1.55) ? Math.cos(p.t * 14 + elapsedTime * 4.5 + p.phase) * ((-1.55 - z) * 0.035) : 0;
          var y = surfaceY + p.hover + wakeTurbulence;

          aeroPositions[i * 3]     = x;
          aeroPositions[i * 3 + 1] = y;
          aeroPositions[i * 3 + 2] = z;

          // Pure aerodynamic laser smoke visibility:
          // Smooth fade-in on front hood (t < 0.15) — no wall in front of car!
          // Silky streamlined ribbon along the body (0.15 <= t <= 0.72)
          // Gradual dissipation into wake behind wing (t > 0.72)
          var alpha = 1.0;
          if (p.t < 0.15) {
            alpha = p.t / 0.15;
          } else if (p.t > 0.72) {
            alpha = Math.max(0, 1.0 - (p.t - 0.72) / 0.28);
          }

          var b = alpha * targetWash;
          aeroColors[i * 3]     = b * 0.92;
          aeroColors[i * 3 + 1] = b * 0.95;
          aeroColors[i * 3 + 2] = b * 1.00;
        }

        if (aeroGeo && aeroGeo.attributes) {
          if (aeroGeo.attributes.position) aeroGeo.attributes.position.needsUpdate = true;
          if (aeroGeo.attributes.color) aeroGeo.attributes.color.needsUpdate = true;
        }
      }
    }
    if (washBayLight && washBayLight.target) {
      washBayLight.intensity = targetWash * 6.5;
      washBayLight.position.set(currentCarPos.x, currentCarPos.y + 5.5, currentCarPos.z);
      washBayLight.target.position.set(currentCarPos.x, currentCarPos.y, currentCarPos.z);
    }

    // 2. POLISHING GLIDING INSPECTION SPOTLIGHT (SMOOTH FADE IN/OUT ACROSS TRANSITIONS)
    if (polishSpotLight && polishSpotLight.target) {
      var polishFactor = Math.max(0, 1.0 - Math.abs(raw - 2.0));
      polishSpotLight.intensity = polishFactor * (14.0 + Math.sin(elapsedTime * 2.5) * 4.0) * sFade;
      polishSpotLight.position.set(
        currentCarPos.x - 1.1 + Math.sin(elapsedTime * 1.8) * 1.1,
        currentCarPos.y + 0.85,
        currentCarPos.z + 1.2
      );
      polishSpotLight.target.position.set(currentCarPos.x - 0.4, currentCarPos.y + 0.2, currentCarPos.z);
    }

    // 3. HEADLIGHT IGNITION ON CAR (ACTIVE ON STEP 4: STUDIO)
    if (headlightMat && headlightMat.emissive) {
      headlightMat.emissive.setRGB(targetLights, targetLights, targetLights);
      headlightMat.emissiveIntensity = targetLights * 28.0;
    }
    if (frontLensMat && frontLensMat.emissive) {
      frontLensMat.emissive.setRGB(targetLights, targetLights, targetLights);
      frontLensMat.emissiveIntensity = targetLights * 22.0;
    }
    if (rearLightMat && rearLightMat.emissive) {
      rearLightMat.emissive.setRGB(targetLights * 1.0, targetLights * 0.02, 0);
      rearLightMat.emissiveIntensity = targetLights * 12.0;
    }
  }

  renderer.render(scene, camera);
}
