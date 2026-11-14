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
var aeroRibbonMesh, aeroRibbonGeo, aeroRibbonMat, aeroRibbonPos, aeroRibbonCol;
var hyperjumpGroup, hyperjumpLines, hyperjumpGeo, hyperjumpMat, hyperjumpPos, hyperjumpCol, hyperjumpData;
var lightTrailsGroup, lightTrailsMesh, lightTrailsGeo, lightTrailsMat, lightTrailsPos, lightTrailsCol;
var starsForeground;
var hyperjumpProgress = { value: 0 };
var hyperjumpCarSurge = { value: 0 };
var hyperjumpCamLag = { value: 0 };
var isHyperjumpAnimating = false;
var headlightMat, frontLensMat, rearLightMat;
var carModelTireOffset = -0.56;

// Exact surface height profile sampled from F40 3D mesh vertices
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
initHyperspaceSystem();
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

  // Volumetric Foreground Floating Stars right in front of the viewer's eyes (r = 4 to 28)
  starsForeground = makeStars(350, 4.5, 32, 2.8, 0.92);

  scene.add(starsDeep);
  scene.add(starsMid);
  scene.add(starsNear);
  scene.add(starsForeground);
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

  if (!F40_SURFACE_PROFILE || !F40_SURFACE_PROFILE.length) {
    return 0.25;
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

/* ============================================================
   AERODYNAMIC WIND TUNNEL 3D FLOW FIELD (STEP 1: WASH / AERO DRY)
   24 continuous laminar streamlines enveloping the car from all sides:
   Top, Sides (NACA ducts, arches), Underbody (diffuser), and Wake vortices
   ============================================================ */
var AERO_LANE_COUNT = 24;
var AERO_SEGS_PER_LANE = 42;

function getStreamlineTrajectory(laneIdx, z, time) {
  var x = 0, y = 0;
  var isWake = (z < -1.55);
  var wakeDist = isWake ? (-1.55 - z) : 0;
  var phase = laneIdx * 0.65;

  if (laneIdx === 0) {
    x = 0;
    y = getF40SurfaceY(0, z) + 0.018;
  } else if (laneIdx === 1 || laneIdx === 2) {
    var s1 = (laneIdx === 1) ? -1 : 1;
    x = s1 * 0.18;
    y = getF40SurfaceY(x, z) + 0.018;
  } else if (laneIdx === 3 || laneIdx === 4) {
    var s2 = (laneIdx === 3) ? -1 : 1;
    x = s2 * 0.35;
    y = getF40SurfaceY(x, z) + 0.018;
  } else if (laneIdx === 5 || laneIdx === 6) {
    var s3 = (laneIdx === 5) ? -1 : 1;
    x = s3 * 0.20;
    var roofBump = Math.max(0, 1.0 - Math.pow((z + 0.15) / 0.85, 2));
    y = 0.48 + roofBump * 0.08;
  } else if (laneIdx === 7) {
    x = 0;
    var roofBump2 = Math.max(0, 1.0 - Math.pow((z + 0.15) / 0.95, 2));
    y = 0.58 + roofBump2 * 0.09;
  } else if (laneIdx >= 8 && laneIdx <= 15) {
    var pair = (laneIdx - 8);
    var sSide = (pair % 2 === 0) ? -1 : 1;
    var level = Math.floor(pair / 2);
    var yLevels = [0.16, 0.02, -0.12, -0.26];
    y = yLevels[level];

    var widthProfile;
    if (z > 0.8) widthProfile = 0.65 + (1.35 - z) * 0.15;
    else if (z > 0.2) widthProfile = 0.73 - (0.8 - z) * 0.20;
    else if (z > -0.6) widthProfile = 0.61 + (-0.2 - z) * 0.15;
    else if (z > -1.4) widthProfile = 0.74 - (-0.6 - z) * 0.05;
    else widthProfile = 0.70;
    x = sSide * (widthProfile + (3 - level) * 0.015);
  } else if (laneIdx >= 16 && laneIdx <= 19) {
    var sUnder = (laneIdx === 16) ? 0 : ((laneIdx === 17) ? -0.28 : ((laneIdx === 18) ? 0.28 : -0.12));
    x = sUnder;
    if (z > -1.0) y = -0.38;
    else y = -0.38 + (-1.0 - z) * 0.20;
  } else if (laneIdx === 20 || laneIdx === 21) {
    var sGround = (laneIdx === 20) ? -0.35 : 0.35;
    x = sGround;
    y = -0.46;
  } else {
    var sOut = (laneIdx === 22) ? -1 : 1;
    x = sOut * 0.88;
    y = 0.06;
  }

  if (isWake) {
    var freq = 9.5;
    var speed = 6.0;
    var amp = Math.min(0.24, wakeDist * 0.16);
    y += Math.sin(wakeDist * freq - time * speed + phase) * amp;
    x += Math.cos(wakeDist * freq - time * speed + phase) * (amp * 0.5);
  }

  return { x: x, y: y, z: z };
}

function initAerodynamicWindTunnelSmoke() {
  aeroSmokeGroup = new THREE.Group();
  aeroSmokeGroup.visible = false;
  carGroup.add(aeroSmokeGroup);

  // 1. Continuous Aerodynamic Streamline Ribbons (Laminar Smoke Sheets)
  var numStreams = AERO_LANE_COUNT;
  var numSegs = AERO_SEGS_PER_LANE;
  var totalVerts = numStreams * numSegs * 2;

  aeroRibbonPos = new Float32Array(totalVerts * 3);
  aeroRibbonCol = new Float32Array(totalVerts * 3);
  var ribbonIndices = [];

  for (var s = 0; s < numStreams; s++) {
    var baseV = s * numSegs * 2;
    for (var i = 0; i < numSegs - 1; i++) {
      var v0 = baseV + i * 2;
      var v1 = v0 + 1;
      var v2 = v0 + 2;
      var v3 = v0 + 3;
      ribbonIndices.push(v0, v1, v2);
      ribbonIndices.push(v2, v1, v3);
    }
  }

  var halfWidth = 0.016;
  var vIdx = 0;
  for (var sIdx = 0; sIdx < numStreams; sIdx++) {
    var isSideStream = (sIdx >= 8 && sIdx <= 15);
    for (var seg = 0; seg < numSegs; seg++) {
      var tFrac = seg / (numSegs - 1);
      var z = 1.35 - tFrac * 4.55;
      var pt = getStreamlineTrajectory(sIdx, z, 0);

      var alpha = 1.0;
      if (z > 0.95) alpha = Math.max(0, (1.35 - z) / 0.40);
      else if (z < -1.8) alpha = Math.max(0, 1.0 - (-1.8 - z) / 1.40);

      var dx0 = isSideStream ? 0 : -halfWidth;
      var dy0 = isSideStream ? -halfWidth : 0;
      var dx1 = isSideStream ? 0 : halfWidth;
      var dy1 = isSideStream ? halfWidth : 0;

      aeroRibbonPos[vIdx * 3]     = pt.x + dx0;
      aeroRibbonPos[vIdx * 3 + 1] = pt.y + dy0;
      aeroRibbonPos[vIdx * 3 + 2] = pt.z;
      aeroRibbonCol[vIdx * 3]     = alpha * 0.92;
      aeroRibbonCol[vIdx * 3 + 1] = alpha * 0.95;
      aeroRibbonCol[vIdx * 3 + 2] = alpha * 1.00;
      vIdx++;

      aeroRibbonPos[vIdx * 3]     = pt.x + dx1;
      aeroRibbonPos[vIdx * 3 + 1] = pt.y + dy1;
      aeroRibbonPos[vIdx * 3 + 2] = pt.z;
      aeroRibbonCol[vIdx * 3]     = alpha * 0.92;
      aeroRibbonCol[vIdx * 3 + 1] = alpha * 0.95;
      aeroRibbonCol[vIdx * 3 + 2] = alpha * 1.00;
      vIdx++;
    }
  }

  aeroRibbonGeo = new THREE.BufferGeometry();
  aeroRibbonGeo.setAttribute('position', new THREE.BufferAttribute(aeroRibbonPos, 3));
  aeroRibbonGeo.setAttribute('color', new THREE.BufferAttribute(aeroRibbonCol, 3));
  aeroRibbonGeo.setIndex(ribbonIndices);

  aeroRibbonMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  aeroRibbonMat.fog = false;

  aeroRibbonMesh = new THREE.Mesh(aeroRibbonGeo, aeroRibbonMat);
  aeroSmokeGroup.add(aeroRibbonMesh);

  // 2. Volumetric Smoke Particles traveling along the 24 streamlines
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

  var particlesPerLane = 50;
  var totalParticles = numStreams * particlesPerLane;
  aeroParticleData = [];
  aeroPositions = new Float32Array(totalParticles * 3);
  aeroColors = new Float32Array(totalParticles * 3);

  var pIdx = 0;
  for (var s = 0; s < numStreams; s++) {
    for (var p = 0; p < particlesPerLane; p++) {
      var initT = Math.random();
      var speed = 0.28 + Math.random() * 0.12;
      var phase = Math.random() * Math.PI * 2;
      var z = 1.35 - initT * 4.55;
      var pt = getStreamlineTrajectory(s, z, 0);

      aeroParticleData.push({
        lane: s,
        t: initT,
        speed: speed,
        phase: phase
      });

      aeroPositions[pIdx * 3]     = pt.x;
      aeroPositions[pIdx * 3 + 1] = pt.y;
      aeroPositions[pIdx * 3 + 2] = pt.z;

      aeroColors[pIdx * 3]     = 1.0;
      aeroColors[pIdx * 3 + 1] = 1.0;
      aeroColors[pIdx * 3 + 2] = 1.0;
      pIdx++;
    }
  }

  aeroGeo = new THREE.BufferGeometry();
  aeroGeo.setAttribute('position', new THREE.BufferAttribute(aeroPositions, 3));
  aeroGeo.setAttribute('color', new THREE.BufferAttribute(aeroColors, 3));

  aeroSmokeMat = new THREE.PointsMaterial({
    size: 0.16,
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
   HYPERSPACE WARP JUMP SYSTEM (STEP 4 / FINAL SCREEN)
   Relativistic Star Wars lightspeed streaks with deceleration & freeze in 3D deep space
   ============================================================ */
function initHyperspaceSystem() {
  hyperjumpGroup = new THREE.Group();
  hyperjumpGroup.visible = false;
  scene.add(hyperjumpGroup);

  var streakCount = 1200;
  hyperjumpData = [];
  hyperjumpPos = new Float32Array(streakCount * 6);
  hyperjumpCol = new Float32Array(streakCount * 6);

  for (var i = 0; i < streakCount; i++) {
    var rad = 1.2 + Math.random() * 24.0;
    var ang = Math.random() * Math.PI * 2;
    var x = Math.cos(ang) * rad;
    var y = Math.sin(ang) * rad;
    var z = -50 + Math.random() * 90;
    var speed = 45 + Math.random() * 45;

    hyperjumpData.push({
      x: x,
      y: y,
      z: z,
      baseZ: z,
      speed: speed,
      rad: rad,
      ang: ang
    });

    hyperjumpPos[i * 6]     = x;
    hyperjumpPos[i * 6 + 1] = y;
    hyperjumpPos[i * 6 + 2] = z;
    hyperjumpCol[i * 6]     = 0.12;
    hyperjumpCol[i * 6 + 1] = 0.75;
    hyperjumpCol[i * 6 + 2] = 1.00;

    hyperjumpPos[i * 6 + 3] = x;
    hyperjumpPos[i * 6 + 4] = y;
    hyperjumpPos[i * 6 + 5] = z;
    hyperjumpCol[i * 6 + 3] = 1.00;
    hyperjumpCol[i * 6 + 4] = 1.00;
    hyperjumpCol[i * 6 + 5] = 1.00;
  }

  hyperjumpGeo = new THREE.BufferGeometry();
  hyperjumpGeo.setAttribute('position', new THREE.BufferAttribute(hyperjumpPos, 3));
  hyperjumpGeo.setAttribute('color', new THREE.BufferAttribute(hyperjumpCol, 3));

  hyperjumpMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  hyperjumpLines = new THREE.LineSegments(hyperjumpGeo, hyperjumpMat);
  hyperjumpGroup.add(hyperjumpLines);

  // 4 Long-Exposure Tail Light Trails (Left Amber, Left Red, Right Red, Right Amber)
  // Each trail is a glowing continuous ribbon trailing backwards from each circular tail lamp
  var trailSegs = 32;
  var totalTrailVerts = 4 * trailSegs * 2;
  lightTrailsPos = new Float32Array(totalTrailVerts * 3);
  lightTrailsCol = new Float32Array(totalTrailVerts * 3);
  var trailIndices = [];

  for (var tIdx = 0; tIdx < 4; tIdx++) {
    var baseV = tIdx * trailSegs * 2;
    for (var seg = 0; seg < trailSegs - 1; seg++) {
      var v0 = baseV + seg * 2;
      var v1 = v0 + 1;
      var v2 = v0 + 2;
      var v3 = v0 + 3;
      trailIndices.push(v0, v1, v2);
      trailIndices.push(v2, v1, v3);
    }
  }

  lightTrailsGeo = new THREE.BufferGeometry();
  lightTrailsGeo.setAttribute('position', new THREE.BufferAttribute(lightTrailsPos, 3));
  lightTrailsGeo.setAttribute('color', new THREE.BufferAttribute(lightTrailsCol, 3));
  lightTrailsGeo.setIndex(trailIndices);

  lightTrailsMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  lightTrailsMat.fog = false;

  lightTrailsMesh = new THREE.Mesh(lightTrailsGeo, lightTrailsMat);
  // Add to carGroup so trails anchor exactly to the 4 circular rear lamps of the F40
  carGroup.add(lightTrailsMesh);

  var hjBtn = document.getElementById('hyperjumpBtn');
  if (hjBtn) {
    hjBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      triggerHyperjump();
    });
  }
}

function triggerHyperjump(onDone) {
  if (isHyperjumpAnimating) return;
  isHyperjumpAnimating = true;

  var tl = gsap.timeline({
    onComplete: function() {
      isHyperjumpAnimating = false;
      hyperjumpProgress.value = 0;
      hyperjumpCarSurge.value = 0;
      hyperjumpCamLag.value = 0;
      if (typeof onDone === 'function') onDone();
    }
  });

  // Phase 1: Pre-jump charge & stretch (0 -> 1.0s)
  // Stars stretch, rear tail light trails ignite and streak backwards
  tl.to(hyperjumpProgress, {
    value: 1.0,
    duration: 1.0,
    ease: 'power2.in'
  }, 0);

  // Phase 2: Full Hyperspace Cruise (0.8 -> 2.0s)
  // Car surges forward deep into space (up to -14 units)
  tl.to(hyperjumpCarSurge, {
    value: 1.0,
    duration: 1.2,
    ease: 'power2.inOut'
  }, 0.8);

  // Camera stays back initially, creating massive distance
  tl.to(hyperjumpCamLag, {
    value: 1.0,
    duration: 1.0,
    ease: 'power2.in'
  }, 0.8);

  // Phase 3: Drop out of hyperspace (1.9 -> 3.4s)
  // Stars rapidly decelerate right in front of the viewer's eyes and FREEZE in 3D space!
  tl.to(hyperjumpProgress, {
    value: 0.0,
    duration: 1.5,
    ease: 'power3.out'
  }, 1.9);

  // Phase 4: Camera gently catches up to the car, settling into the final rest pose (2.3 -> 3.9s)
  tl.to(hyperjumpCarSurge, {
    value: 0.0,
    duration: 1.6,
    ease: 'power3.out'
  }, 2.3);

  tl.to(hyperjumpCamLag, {
    value: 0.0,
    duration: 1.6,
    ease: 'power3.out'
  }, 2.3);
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
    // Step 0 rest pose
    var rest = getStepPose(0);

    // Initial camera starts at target position immediately so scene is 100% solid and never teleports!
    currentCamPos.copy(rest.camPos);
    currentLookAt.copy(rest.lookAt);
    currentFov.value = rest.fov;
    currentStudioFade.value = 0;

    // F40 glides in gracefully from deep space (-28 units)
    currentCarPos.set(rest.carPos.x + 0.35, rest.carPos.y + 0.85, -28.0);
    currentCarRot.set(
      rest.carRot.x + 0.65,
      rest.carRot.y + 1.25,
      rest.carRot.z - 0.45
    );

    carGroup.position.copy(currentCarPos);
    carGroup.rotation.copy(currentCarRot);
    carGroup.visible = true;

    // Earth is solid and fully visible immediately
    if (orbitalEarthGroup) {
      orbitalEarthGroup.visible = true;
      orbitalEarthGroup.position.set(-3.2, -2.4, -22.0);
    }
    if (earthMesh && earthMesh.material) {
      earthMesh.material.opacity = 1.0;
    }

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

    // F40 glides into orbit cleanly without camera jumping or jitter
    introTimeline.to(currentCarPos, {
      x: rest.carPos.x,
      y: rest.carPos.y,
      z: rest.carPos.z,
      duration: 2.2,
      ease: 'power3.out'
    }, 0);

    introTimeline.to(currentCarRot, {
      x: rest.carRot.x,
      y: rest.carRot.y,
      z: rest.carRot.z,
      duration: 2.2,
      ease: 'power3.out'
    }, 0);

    // Text flickers in only once the car has arrived into orbit
    introTimeline.add(function() {
      if (heroContent) {
        heroContent.classList.remove('hero-hidden');
        heroContent.classList.add('hero-visible');
      }
      triggerFlickerIn(brandOverlay);
    }, 1.8);
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

  var gsapInst = window.gsap || gsap;

  // Step 4 special cinematic orchestration:
  // 1. Car turns around 180° into position
  // 2. The moment it locks at 180°, AUTOMATICALLY launch the Star Wars hyperjump!
  // 3. Car surges deep into space, stars streak & freeze, camera catches up, and contacts reveal!
  if (newStep === 4) {
    targetStep = 4;
    contactOverlay.classList.remove('active');
    updateUIStep(4);
    isStepAnimating = true;

    gsapInst.to(stepProgress, {
      value: 4.0,
      duration: 1.8,
      ease: 'power2.inOut',
      onComplete: function() {
        triggerHyperjump(function() {
          isStepAnimating = false;
          contactOverlay.classList.add('active');
          triggerFlickerIn(contactOverlay);
        });
      }
    });
    return;
  }

  targetStep = newStep;
  updateUIStep(newStep);

  isStepAnimating = true;
  var animDuration = (currentStep === 4) ? 2.0 : 1.7;

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

    // Physical Descent from Orbit (Hero Step 0 -> Step 1):
    // Smooth, massive curvature descent of the planetary sphere with atmospheric edge illumination
    if (orbitalEarthGroup) {
      orbitalEarthGroup.visible = (raw < 1.15);
      // Kinematic de-orbit descent: Earth dips down and recedes with atmospheric parallax
      var earthDrop = Math.pow(Math.min(1.0, raw), 1.6);
      orbitalEarthGroup.position.y = -2.4 - earthDrop * 14.5;
      orbitalEarthGroup.position.z = -22.0 - earthDrop * 28.0;
      orbitalEarthGroup.position.x = -3.2 - earthDrop * 6.5;
      orbitalEarthGroup.rotation.z = -0.13 - earthDrop * 0.18;
    }
    if (earthMesh && earthMesh.material) {
      var earthAlpha = Math.max(0, 1.0 - Math.pow(Math.min(1.0, raw), 2.2));
      earthMesh.material.opacity = earthAlpha;
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

    // 1. AERODYNAMIC WIND TUNNEL 3D STREAMLINES (ACTIVE ON STEP 1: WASH / AERO DRY)
    if (aeroSmokeGroup) {
      var isWashActive = (targetWash > 0.005);
      aeroSmokeGroup.visible = isWashActive;

      if (isWashActive) {
        if (aeroRibbonMat) aeroRibbonMat.opacity = targetWash * 0.45;
        if (aeroSmokeMat) aeroSmokeMat.opacity = targetWash * 0.35;

        // Update Ribbon Wake Vortices (Laminar streamline curls matching wind tunnel photo)
        if (aeroRibbonPos && aeroRibbonGeo) {
          var halfW = 0.016;
          var rIdx = 0;
          for (var sIdx = 0; sIdx < AERO_LANE_COUNT; sIdx++) {
            var isSide = (sIdx >= 8 && sIdx <= 15);
            for (var seg = 0; seg < AERO_SEGS_PER_LANE; seg++) {
              var tFrac = seg / (AERO_SEGS_PER_LANE - 1);
              var rz = 1.35 - tFrac * 4.55;
              if (rz < -1.55) {
                var rpt = getStreamlineTrajectory(sIdx, rz, elapsedTime);
                var rdx0 = isSide ? 0 : -halfW;
                var rdy0 = isSide ? -halfW : 0;
                var rdx1 = isSide ? 0 : halfW;
                var rdy1 = isSide ? halfW : 0;

                aeroRibbonPos[rIdx * 3]     = rpt.x + rdx0;
                aeroRibbonPos[rIdx * 3 + 1] = rpt.y + rdy0;
                aeroRibbonPos[rIdx * 3 + 2] = rpt.z;

                aeroRibbonPos[(rIdx + 1) * 3]     = rpt.x + rdx1;
                aeroRibbonPos[(rIdx + 1) * 3 + 1] = rpt.y + rdy1;
                aeroRibbonPos[(rIdx + 1) * 3 + 2] = rpt.z;
              }
              rIdx += 2;
            }
          }
          if (aeroRibbonGeo.attributes.position) {
            aeroRibbonGeo.attributes.position.needsUpdate = true;
          }
        }

        // Update Volumetric Smoke Particles along all 24 lanes
        if (aeroParticleData && aeroPositions && aeroGeo) {
          var dtSmoke = 0.016;
          for (var pi = 0; pi < aeroParticleData.length; pi++) {
            var ap = aeroParticleData[pi];
            ap.t = (ap.t + dtSmoke * ap.speed) % 1.0;
            var pz = 1.35 - ap.t * 4.55;
            var ppt = getStreamlineTrajectory(ap.lane, pz, elapsedTime);

            aeroPositions[pi * 3]     = ppt.x;
            aeroPositions[pi * 3 + 1] = ppt.y;
            aeroPositions[pi * 3 + 2] = ppt.z;

            var pAlpha = 1.0;
            if (ap.t < 0.12) {
              pAlpha = ap.t / 0.12;
            } else if (ap.t > 0.75) {
              pAlpha = Math.max(0, 1.0 - (ap.t - 0.75) / 0.25);
            }

            var pb = pAlpha * targetWash;
            aeroColors[pi * 3]     = pb * 0.92;
            aeroColors[pi * 3 + 1] = pb * 0.95;
            aeroColors[pi * 3 + 2] = pb * 1.00;
          }

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

    // 4. STAR WARS HYPERSPACE JUMP & LONG EXPOSURE LIGHT TRAILS (STEP 4)
    // The hyperjump only engages AFTER the car has fully rotated 180° pointing deep into space!
    // Sequence:
    // a) raw in [3.0, 3.55]: Car fully finishes 180° rotation, facing straight into deep cosmos
    // b) raw in [3.55, 3.82]: Car begins stretching forward, tail light trails streak back, stars accelerate
    // c) raw in [3.82, 4.0]: Car breaks out of hyperspace far ahead, stars decelerate & freeze right in front of camera, camera gently catches up!
    var scrollWarp = 0;
    var carForwardSurge = 0;
    var camLag = 0;

    if (raw >= 3.55 && raw <= 4.0) {
      if (raw < 3.82) {
        // Hyperspace acceleration & stretch
        scrollWarp = (raw - 3.55) / 0.27;
      } else {
        // Drop out of hyperspace: stars decelerate & freeze
        scrollWarp = Math.max(0, 1.0 - (raw - 3.82) / 0.18);
        // Car surges far ahead upon exit, then camera catches up
        var exitT = (raw - 3.82) / 0.18;
        carForwardSurge = Math.sin(exitT * Math.PI) * 2.8;
      }
    }

    var currentWarp = Math.max(scrollWarp, hyperjumpProgress.value);

    // Dynamic surge forward deep into the cosmos during hyperjump & camera lag
    var surgeAmount = hyperjumpCarSurge.value * 16.0;
    var camLagAmount = hyperjumpCamLag.value * 3.5;

    if (carGroup && (surgeAmount > 0.001 || carForwardSurge > 0.001)) {
      var totalSurge = Math.max(surgeAmount, carForwardSurge * 1.8);
      carGroup.position.z = currentCarPos.z - totalSurge;
    }

    if (camLagAmount > 0.001) {
      camera.position.z = currentCamPos.z + camLagAmount;
    }

    // Dynamic FOV expansion during lightspeed warp
    if (currentWarp > 0.001) {
      camera.fov = currentFov.value + currentWarp * 15.0;
      camera.updateProjectionMatrix();
    }

    // 4.1 Update Starfield Hyperdrive Streaks & Deceleration
    if (hyperjumpGroup && hyperjumpMat && hyperjumpPos && hyperjumpData) {
      var showHyper = (currentWarp > 0.001 || isHyperjumpAnimating || raw >= 3.55);
      hyperjumpGroup.visible = showHyper;
      hyperjumpMat.opacity = Math.min(1.0, currentWarp * 1.35);

      var dtWarp = 0.016;
      var warpSpeedMult = currentWarp * 4.2;
      var streakLen = currentWarp * 18.0;

      for (var hi = 0; hi < hyperjumpData.length; hi++) {
        var hd = hyperjumpData[hi];

        // Move stars forward along +Z past the viewer's eyes
        // When warp reaches 0, stars COMPLETELY STOP and FREEZE in 3D space!
        if (currentWarp > 0.001) {
          hd.z += hd.speed * warpSpeedMult * dtWarp;
          if (hd.z > 25.0) {
            hd.z = -55.0 - Math.random() * 20.0;
          }
        }

        hyperjumpPos[hi * 6]     = hd.x;
        hyperjumpPos[hi * 6 + 1] = hd.y;
        hyperjumpPos[hi * 6 + 2] = hd.z;

        hyperjumpPos[hi * 6 + 3] = hd.x;
        hyperjumpPos[hi * 6 + 4] = hd.y;
        hyperjumpPos[hi * 6 + 5] = hd.z + streakLen;
      }

      if (hyperjumpGeo && hyperjumpGeo.attributes && hyperjumpGeo.attributes.position) {
        hyperjumpGeo.attributes.position.needsUpdate = true;
      }
    }

    // 4.2 Long-Exposure Tail Light Streaks from F40's 4 Circular Lamps
    // Left Outer: Amber (-0.523, 0.015, -1.575)
    // Left Inner: Red   (-0.397, 0.022, -1.588)
    // Right Inner: Red  ( 0.396, 0.022, -1.588)
    // Right Outer: Amber( 0.523, 0.015, -1.575)
    if (lightTrailsMesh && lightTrailsMat && lightTrailsPos && lightTrailsGeo) {
      var isTrailActive = (currentWarp > 0.005);
      lightTrailsMesh.visible = isTrailActive;

      if (isTrailActive) {
        lightTrailsMat.opacity = Math.min(1.0, currentWarp * 1.8);
        var lampOrigins = [
          { x: -0.523, y: 0.015, z: -1.575, r: 2.20, g: 1.40, b: 0.05 }, // Left Amber
          { x: -0.397, y: 0.022, z: -1.588, r: 2.20, g: 0.02, b: 0.01 }, // Left Red
          { x:  0.396, y: 0.022, z: -1.588, r: 2.20, g: 0.02, b: 0.01 }, // Right Red
          { x:  0.523, y: 0.015, z: -1.575, r: 2.20, g: 1.40, b: 0.05 }  // Right Amber
        ];

        var trailSegCount = 32;
        var maxTrailDist = currentWarp * 24.0; // Trails stretch backwards up to 24 meters
        var trailWidth = 0.085; // 8.5cm wide intense luminous laser ribbon

        var trVIdx = 0;
        for (var tIdx = 0; tIdx < 4; tIdx++) {
          var lamp = lampOrigins[tIdx];
          for (var seg = 0; seg < trailSegCount; seg++) {
            var sFrac = seg / (trailSegCount - 1);
            // Trail extends backwards from the lamp (-Z in local is +Z trailing behind the rear)
            // Notice: local -Z is the rear bumper of F40! So trailing backwards means z < -1.58 (-Z direction in local)
            var tz = lamp.z - sFrac * maxTrailDist;
            var falloff = Math.pow(1.0 - sFrac, 1.8);

            // Subtle warp pulsation along the trail
            var pulse = Math.sin(seg * 0.8 - elapsedTime * 12.0) * 0.008 * (1.0 - sFrac);

            // Vertex 0 (left edge of ribbon)
            lightTrailsPos[trVIdx * 3]     = lamp.x - trailWidth * 0.5;
            lightTrailsPos[trVIdx * 3 + 1] = lamp.y + pulse;
            lightTrailsPos[trVIdx * 3 + 2] = tz;
            lightTrailsCol[trVIdx * 3]     = lamp.r * falloff;
            lightTrailsCol[trVIdx * 3 + 1] = lamp.g * falloff;
            lightTrailsCol[trVIdx * 3 + 2] = lamp.b * falloff;
            trVIdx++;

            // Vertex 1 (right edge of ribbon)
            lightTrailsPos[trVIdx * 3]     = lamp.x + trailWidth * 0.5;
            lightTrailsPos[trVIdx * 3 + 1] = lamp.y - pulse;
            lightTrailsPos[trVIdx * 3 + 2] = tz;
            lightTrailsCol[trVIdx * 3]     = lamp.r * falloff;
            lightTrailsCol[trVIdx * 3 + 1] = lamp.g * falloff;
            lightTrailsCol[trVIdx * 3 + 2] = lamp.b * falloff;
            trVIdx++;
          }
        }

        if (lightTrailsGeo.attributes.position) lightTrailsGeo.attributes.position.needsUpdate = true;
        if (lightTrailsGeo.attributes.color) lightTrailsGeo.attributes.color.needsUpdate = true;
      }
    }
  }

  renderer.render(scene, camera);
}
