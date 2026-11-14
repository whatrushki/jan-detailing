import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';

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
initWaterWashStreams();
loadFerrariF40();
initScrollAndInteractions();
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

/* ============================================================
   DEEP COSMOS STARFIELD
   ============================================================ */
function initDeepCosmosWithLayers() {
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

      var bri = Math.pow(Math.random(), 3.5) * 0.7 + 0.3;
      col[i * 3]     = bri;
      col[i * 3 + 1] = bri;
      col[i * 3 + 2] = bri;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var mat = new THREE.PointsMaterial({
      size: size,
      vertexColors: true,
      transparent: true,
      opacity: opacity,
      sizeAttenuation: true
    });
    mat.fog = false; // Never let fog dim the stars!
    return new THREE.Points(geo, mat);
  }

  starsDeep = makeStars(6000, 900, 2000, 0.75, 0.85);
  starsMid  = makeStars(2400, 450, 900, 1.1, 0.95);
  starsNear = makeStars(300, 250, 450, 1.6, 1.0);

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
   PROCEDURAL DETAILING WATER WASH STREAMS (STEP 1)
   ============================================================ */
function initWaterWashStreams() {
  var streamCount = 420;
  var positions = new Float32Array(streamCount * 6);
  waterVelArr = new Float32Array(streamCount);

  // Full-width atmospheric detailing rain canopy
  for (var i = 0; i < streamCount; i++) {
    var x = (Math.random() - 0.5) * 11.0;
    var y = 0.4 + Math.random() * 4.2;
    var z = 3.0 + (Math.random() - 0.5) * 5.0;
    var len = 0.22 + Math.random() * 0.32;

    positions[i * 6]     = x;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = z;

    positions[i * 6 + 3] = x;
    positions[i * 6 + 4] = y - len;
    positions[i * 6 + 5] = z;

    waterVelArr[i] = 0.08 + Math.random() * 0.14;
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  var mat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  waterStreams = new THREE.LineSegments(geo, mat);
  scene.add(waterStreams);
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
  var isDesktop = window.innerWidth > 900;

  switch (step) {
    case 0: // HERO: Space orbit (Size verified as good)
      return {
        carPos: new THREE.Vector3(isDesktop ? -1.22 : 0, isDesktop ? 0.36 : 1.20, isDesktop ? 2.4 : 1.85),
        carRot: new THREE.Euler(0.94, 0.46, -0.44),
        camPos: new THREE.Vector3(0, 0, 7.5),
        lookAt: new THREE.Vector3(isDesktop ? -0.48 : 0, isDesktop ? 0.15 : 0.38, 0),
        fov: 35,
        studioFade: 0.0,
        headlights: 0.0,
        washFade: 0.0
      };

    case 1: // 01 WASH: Detailing bay with full-width cascading water (Scaled slightly smaller and lowered on mobile)
      return {
        carPos: new THREE.Vector3(isDesktop ? -1.35 : -0.65, isDesktop ? 0.78 : 0.96, isDesktop ? 3.1 : 2.2),
        carRot: new THREE.Euler(0.0, 0.62, 0.0),
        camPos: new THREE.Vector3(isDesktop ? -0.10 : 0, isDesktop ? 0.82 : 0.95, isDesktop ? 6.2 : 7.1),
        lookAt: new THREE.Vector3(isDesktop ? -0.55 : -0.30, isDesktop ? 0.65 : 0.50, 0),
        fov: isDesktop ? 35 : 37,
        studioFade: 1.0,
        headlights: 0.0,
        washFade: 1.0
      };

    case 2: // 02 POLISH: Diagonal stance, lowered and moved further left on mobile
      return {
        carPos: new THREE.Vector3(isDesktop ? -1.65 : -1.25, isDesktop ? 1.10 : 1.05, isDesktop ? 3.2 : 2.1),
        carRot: new THREE.Euler(0.0, -0.45, 0.0), // Diagonal flank view, nose away
        camPos: new THREE.Vector3(isDesktop ? -0.15 : -0.12, isDesktop ? 1.12 : 1.02, 4.85),
        lookAt: new THREE.Vector3(isDesktop ? -0.95 : -0.75, isDesktop ? 0.98 : 0.68, 0),
        fov: 37,
        studioFade: 1.0,
        headlights: 0.0,
        washFade: 0.0
      };

    case 3: // 03 INTERIOR: Cabin view, camera brought closer, lower and further left, car lifted slightly
      return {
        carPos: new THREE.Vector3(isDesktop ? -0.65 : -0.48, isDesktop ? 0.18 : 0.82, isDesktop ? 2.2 : 1.8),
        carRot: new THREE.Euler(0.0, 0.16, 0.0),
        camPos: new THREE.Vector3(isDesktop ? -1.05 : -0.78, isDesktop ? 0.28 : 0.58, isDesktop ? 2.58 : 2.15),
        lookAt: new THREE.Vector3(isDesktop ? -0.38 : -0.22, isDesktop ? 0.10 : 0.32, isDesktop ? 1.25 : 1.05),
        fov: isDesktop ? 66 : 70,
        studioFade: 1.0,
        headlights: 0.0,
        washFade: 0.0
      };

    case 4: // 04 STUDIO & LOCATION: Strictly 180° REAR view, scaled smaller and lowered on mobile
    default:
      return {
        carPos: new THREE.Vector3(0, isDesktop ? 0.78 : 0.98, isDesktop ? 2.2 : 1.85),
        carRot: new THREE.Euler(0.0, Math.PI, 0.0), // Exact 180° - strictly and symmetrically rear-facing
        camPos: new THREE.Vector3(0, isDesktop ? 0.80 : 0.98, isDesktop ? 6.2 : 7.2),
        lookAt: new THREE.Vector3(0, isDesktop ? 0.38 : 0.52, 0),
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
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (isIntroActive || isStepAnimating) return;
      var target = parseInt(btn.getAttribute('data-target'), 10);
      goToStep(target);
    });
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
var _vCarPos = new THREE.Vector3();
var _vCamPos = new THREE.Vector3();
var _vLookAt = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);

  var elapsedTime = clock.getElapsedTime();

  // Smooth mouse damping
  mouse.x += (mouse.targetX - mouse.x) * 0.055;
  mouse.y += (mouse.targetY - mouse.y) * 0.055;

  if (!isIntroActive && carGroup) {
    var raw = stepProgress.value;
    var baseStep = Math.floor(raw);
    var nextStep = Math.min(baseStep + 1, 4);
    var stepFrac = raw - baseStep;

    var poseA = getStepPose(baseStep);
    var poseB = getStepPose(nextStep);

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

  // Continuous unified 3D updates & parallax: zero teleportation or snap
  if (carGroup) {
    carGroup.position.copy(currentCarPos);
    carGroup.rotation.copy(currentCarRot);
  }

  camera.fov = currentFov.value;
  camera.updateProjectionMatrix();

  // Vertical mouse sensitivity: gently reduced across all steps, and strictly clamped inside cockpit (step 3) so camera NEVER penetrates roof
  var vertSens = (raw >= 2.4 && raw <= 3.6) ? 0.018 : 0.045;
  camera.position.set(
    currentCamPos.x + mouse.x * 0.14,
    currentCamPos.y - mouse.y * vertSens,
    currentCamPos.z
  );
  camera.lookAt(
    currentLookAt.x + mouse.x * 0.035,
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
    if (earthMesh) {
      earthMesh.material.opacity = earthAlpha;
    }
    if (orbitalEarthGroup) {
      orbitalEarthGroup.visible = (raw < 0.98);
      orbitalEarthGroup.position.y = -2.4 - raw * 6.0;
    }

    // Volumetric 3D Cosmos: dynamic layered depth parallax on every scroll swipe
    if (starsDeep) {
      starsDeep.position.z = raw * 15;
      starsDeep.material.opacity = 0.85;
      starsDeep.visible = true;
    }
    if (starsMid) {
      starsMid.position.z = raw * 35;
      starsMid.material.opacity = 0.92;
      starsMid.visible = true;
    }
    if (starsNear) {
      starsNear.position.z = raw * 75;
      starsNear.material.opacity = 0.98;
      starsNear.visible = true;
    }

    // 1. CASCADING WATER STREAMS & CLEANROOM LIGHT (ACTIVE ON STEP 1: WASH)
    // 100% GPU-native transform: zero CPU looping and zero buffer uploads
    if (waterStreams) {
      var isWashActive = (targetWash > 0.005);
      waterStreams.visible = isWashActive;
      waterStreams.material.opacity = targetWash * 0.85;
      if (isWashActive) {
        waterStreams.position.y = -((elapsedTime * 4.8) % 0.85);
      }
    }
    if (washBayLight) {
      washBayLight.intensity = targetWash * 6.5;
      washBayLight.position.set(currentCarPos.x, currentCarPos.y + 5.5, currentCarPos.z);
      washBayLight.target.position.set(currentCarPos.x, currentCarPos.y, currentCarPos.z);
    }

    // 2. POLISHING GLIDING INSPECTION SPOTLIGHT (SMOOTH FADE IN/OUT ACROSS TRANSITIONS)
    if (polishSpotLight) {
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
    if (headlightMat) {
      headlightMat.emissive.setRGB(targetLights, targetLights, targetLights);
      headlightMat.emissiveIntensity = targetLights * 28.0;
    }
    if (frontLensMat) {
      frontLensMat.emissive.setRGB(targetLights, targetLights, targetLights);
      frontLensMat.emissiveIntensity = targetLights * 22.0;
    }
    if (rearLightMat) {
      rearLightMat.emissive.setRGB(targetLights * 1.0, targetLights * 0.02, 0);
      rearLightMat.emissiveIntensity = targetLights * 12.0;
    }
  }

  renderer.render(scene, camera);
}
