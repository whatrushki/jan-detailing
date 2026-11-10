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

var isIntroActive = true;
var introTimeline = null;
var currentStep = 0;
var targetStep = 0;
var stepProgress = { value: 0 };
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
   MINIMALIST STUDIO ENVIRONMENT
   ============================================================ */
function initStudioEnvironment() {
  // 1. Matte-Mirror Reflective Floor with Radial Falloff (Zero Blue, Zero Harsh Horizon)
  var floorGeo = new THREE.PlaneGeometry(60, 60);
  var floorMat = new THREE.MeshStandardMaterial({
    map: createStudioFloorTexture(),
    alphaMap: createFloorAlphaMap(),
    color: 0x080808,
    roughness: 0.22,
    metalness: 0.75,
    transparent: true,
    opacity: 0.0
  });
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0.0; // Ground plane exactly at y = 0
  scene.add(floorMesh);

  // 2. Soft Contact Ground Shadow under the car
  var shadowGeo = new THREE.PlaneGeometry(5.4, 3.0);
  var shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    opacity: 0.0,
    depthWrite: false
  });
  contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.005; // 5mm above floor
  scene.add(contactShadow);

  // 3. Studio Overhead Directional Soft Light & Ambient (Pure White)
  studioCeilingLight = new THREE.DirectionalLight(0xffffff, 0);
  studioCeilingLight.position.set(0, 8, 3);
  scene.add(studioCeilingLight);

  studioAmbientLight = new THREE.AmbientLight(0xffffff, 0);
  scene.add(studioAmbientLight);

  // 4. Wash Bay Crisp Top Cleanroom Light (Step 1)
  washBayLight = new THREE.SpotLight(0xffffff, 0, 18, Math.PI / 4, 0.6);
  washBayLight.position.set(-2.2, 5.5, 2.5);
  scene.add(washBayLight);
  scene.add(washBayLight.target);

  // 5. Polishing Flank Inspection Spotlight (Step 2)
  polishSpotLight = new THREE.SpotLight(0xffffff, 0, 16, Math.PI / 6, 0.35);
  polishSpotLight.position.set(-3.5, 1.8, 4.5);
  scene.add(polishSpotLight);
  scene.add(polishSpotLight.target);
}

/* ============================================================
   PROCEDURAL DETAILING WATER WASH STREAMS (STEP 1)
   ============================================================ */
function initWaterWashStreams() {
  var streamCount = 320;
  var positions = new Float32Array(streamCount * 6);
  waterVelArr = new Float32Array(streamCount);

  for (var i = 0; i < streamCount; i++) {
    var x = -2.2 + (Math.random() - 0.5) * 2.5;
    var y = 0.2 + Math.random() * 3.6;
    var z = 2.6 + (Math.random() - 0.5) * 3.6;
    var len = 0.2 + Math.random() * 0.25;

    positions[i * 6]     = x;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = z;

    positions[i * 6 + 3] = x;
    positions[i * 6 + 4] = y - len;
    positions[i * 6 + 5] = z;

    waterVelArr[i] = 0.07 + Math.random() * 0.12;
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

      var maxDim = Math.max(size.x, size.y, size.z);
      var targetScale = 3.25 / maxDim;
      carModel.scale.setScalar(targetScale);

      // Recompute bounding box after scale to get exact bottom of tires
      box.setFromObject(carModel);
      center = box.getCenter(new THREE.Vector3());

      // Center X and Z, and place the bottom of the tires EXACTLY at y = 0
      carModel.position.x = -center.x;
      carModel.position.y = -box.min.y; // Lowest point (tires) is exactly at y = 0!
      carModel.position.z = -center.z;

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
      startIntroSequence();
    },
    undefined,
    function(err) {
      console.error('Error loading car:', err);
    }
  );
}

/* ============================================================
   INTRO FLY-IN SEQUENCE (Locked until car arrives)
   ============================================================ */
function startIntroSequence() {
  console.log('START INTRO SEQUENCE CALLED');
  try {
    var rest = getStepPose(0);

    // Initial position in deep space
    carGroup.position.set(rest.carPos.x + 1.2, rest.carPos.y + 4.8, -60);
    carGroup.rotation.set(
      rest.carRot.x + Math.PI * 2.0,
      rest.carRot.y + Math.PI * 2.5,
      rest.carRot.z - Math.PI * 1.4
    );
    carGroup.visible = true;

    // Strict lock: text hidden while intro is running
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

        // Text flickers in smoothly on the right exactly as in b696b71
        if (heroContent) {
          heroContent.classList.remove('hero-hidden');
          heroContent.classList.add('hero-visible');
        }
        triggerFlickerIn(brandOverlay);
      }
    });

    introTimeline.to(camera.position, {
      x: rest.camPos.x,
      y: rest.camPos.y,
      z: rest.camPos.z,
      duration: 2.6,
      ease: 'power3.out'
    }, 0);

    introTimeline.to(carGroup.position, {
      x: rest.carPos.x,
      y: rest.carPos.y,
      z: rest.carPos.z,
      duration: 2.6,
      ease: 'power3.out'
    }, 0);

    introTimeline.to(carGroup.rotation, {
      x: rest.carRot.x,
      y: rest.carRot.y,
      z: rest.carRot.z,
      duration: 2.6,
      ease: 'power3.out'
    }, 0);
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
    case 0: // HERO: Space orbit (Original b696b71 stance)
      return {
        carPos: new THREE.Vector3(isDesktop ? -0.92 : 0, isDesktop ? 0.36 : 0.98, isDesktop ? 2.4 : 1.9),
        carRot: new THREE.Euler(0.94, 0.46, -0.44),
        camPos: new THREE.Vector3(0, 0, 7.5),
        lookAt: new THREE.Vector3(-0.35, 0.15, 0),
        fov: 35,
        studioFade: 0.0,
        headlights: 0.0,
        washFade: 0.0
      };

    case 1: // 01 WASH: Detailing bay entry with cascading water (Strictly on left, tires on floor)
      return {
        carPos: new THREE.Vector3(isDesktop ? -2.2 : 0, 0.0, isDesktop ? 2.6 : 2.2),
        carRot: new THREE.Euler(0.0, 0.72, 0.0),
        camPos: new THREE.Vector3(0, 0.35, 7.2),
        lookAt: new THREE.Vector3(-0.6, 0.28, 0),
        fov: 35,
        studioFade: 1.0,
        headlights: 0.0,
        washFade: 1.0
      };

    case 2: // 02 POLISH: Flank macro reflection & scanning inspection spotlight (Strictly on left)
      return {
        carPos: new THREE.Vector3(isDesktop ? -2.0 : 0, 0.0, isDesktop ? 3.4 : 2.6),
        carRot: new THREE.Euler(0.0, 1.50, 0.0),
        camPos: new THREE.Vector3(-0.6, 0.38, 5.2),
        lookAt: new THREE.Vector3(-1.4, 0.34, 3.4),
        fov: 35,
        studioFade: 1.0,
        headlights: 0.0,
        washFade: 0.0
      };

    case 3: // 03 INTERIOR: Camera flies INSIDE driver cockpit (Steering wheel, Dials, Alcantara)
      return {
        carPos: new THREE.Vector3(isDesktop ? -1.4 : 0, 0.0, isDesktop ? 2.0 : 1.6),
        carRot: new THREE.Euler(0.0, 0.35, 0.0),
        camPos: new THREE.Vector3(isDesktop ? -1.64 : -0.24, 0.46, isDesktop ? 2.04 : 1.64),
        lookAt: new THREE.Vector3(isDesktop ? -1.95 : -0.24, 0.38, isDesktop ? 1.19 : 0.8),
        fov: 52, // Wide immersive interior cabin FOV
        studioFade: 1.0,
        headlights: 0.0,
        washFade: 0.0
      };

    case 4: // 04 STUDIO & LOCATION: Front faces camera (rot.y = PI), nose tilted down, headlights on
    default:
      return {
        carPos: new THREE.Vector3(0, isDesktop ? 0.08 : 0.22, isDesktop ? 2.6 : 2.1),
        carRot: new THREE.Euler(-0.09, Math.PI, 0.0), // Front bumper faces camera, nose down
        camPos: new THREE.Vector3(0, 0.55, 6.2),
        lookAt: new THREE.Vector3(0, 0.22, 0),
        fov: 35,
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
  if (isIntroActive) return;
  if (newStep < 0 || newStep > 4) return;
  if (newStep === currentStep && !isStepAnimating) return;

  targetStep = newStep;
  updateUIStep(newStep);

  isStepAnimating = true;
  var gsapInst = window.gsap || gsap;
  gsapInst.to(stepProgress, {
    value: newStep,
    duration: 1.25,
    ease: 'power2.out',
    onComplete: function() {
      isStepAnimating = false;
    }
  });
}
window.goToStep = goToStep;

function initScrollAndInteractions() {
  window.addEventListener('resize', onWindowResize);

  // Pointer Parallax
  window.addEventListener('pointermove', function(e) {
    if (e.pointerType === 'mouse') {
      mouse.targetX = (e.clientX - windowHalf.x) / windowHalf.x;
      mouse.targetY = (e.clientY - windowHalf.y) / windowHalf.y;
    }
  });

  // Mouse Wheel Navigation (STRICT DEBOUNCE - 1 FLICK = 1 STEP)
  window.addEventListener('wheel', function(e) {
    if (isIntroActive || isStepAnimating || wheelCooldown) return;
    if (Math.abs(e.deltaY) < 20) return;

    wheelCooldown = true;
    setTimeout(function() { wheelCooldown = false; }, 950);

    if (e.deltaY > 0) {
      goToStep(currentStep + 1);
    } else {
      goToStep(currentStep - 1);
    }
  }, { passive: true });

  // Touch Drag & Swipe (STRICT DEBOUNCE)
  var touchStartY = 0;
  window.addEventListener('touchstart', function(e) {
    if (isIntroActive) return;
    if (e.touches && e.touches.length > 0) {
      touchStartY = e.touches[0].clientY;
      var touch = e.touches[0];
      mouse.targetX = (touch.clientX - windowHalf.x) / windowHalf.x;
      mouse.targetY = (touch.clientY - windowHalf.y) / windowHalf.y;
    }
  }, { passive: true });

  window.addEventListener('touchmove', function(e) {
    if (isIntroActive) return;
    if (e.touches && e.touches.length > 0) {
      var touch = e.touches[0];
      mouse.targetX = (touch.clientX - windowHalf.x) / windowHalf.x;
      mouse.targetY = (touch.clientY - windowHalf.y) / windowHalf.y;
    }
  }, { passive: true });

  window.addEventListener('touchend', function(e) {
    if (isIntroActive || isStepAnimating || wheelCooldown) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    var touchEndY = e.changedTouches[0].clientY;
    var diffY = touchStartY - touchEndY;

    if (Math.abs(diffY) > 35) {
      wheelCooldown = true;
      setTimeout(function() { wheelCooldown = false; }, 950);
      if (diffY > 0) {
        goToStep(currentStep + 1);
      } else {
        goToStep(currentStep - 1);
      }
    }
  }, { passive: true });

  // Keyboard Arrow / Page Navigation
  window.addEventListener('keydown', function(e) {
    if (isIntroActive || isStepAnimating || wheelCooldown) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      wheelCooldown = true;
      setTimeout(function() { wheelCooldown = false; }, 950);
      goToStep(currentStep + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      wheelCooldown = true;
      setTimeout(function() { wheelCooldown = false; }, 950);
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

    // Interpolate pose targets between steps
    var targetCarP = new THREE.Vector3().lerpVectors(poseA.carPos, poseB.carPos, stepFrac);
    var targetCamP = new THREE.Vector3().lerpVectors(poseA.camPos, poseB.camPos, stepFrac);
    var targetLook = new THREE.Vector3().lerpVectors(poseA.lookAt, poseB.lookAt, stepFrac);
    var targetFovVal = THREE.MathUtils.lerp(poseA.fov, poseB.fov, stepFrac);

    var targetRotX = THREE.MathUtils.lerp(poseA.carRot.x, poseB.carRot.x, stepFrac);
    var targetRotY = THREE.MathUtils.lerp(poseA.carRot.y, poseB.carRot.y, stepFrac);
    var targetRotZ = THREE.MathUtils.lerp(poseA.carRot.z, poseB.carRot.z, stepFrac);

    var targetFade = THREE.MathUtils.lerp(poseA.studioFade, poseB.studioFade, stepFrac);
    var targetLights = THREE.MathUtils.lerp(poseA.headlights, poseB.headlights, stepFrac);
    var targetWash = THREE.MathUtils.lerp(poseA.washFade, poseB.washFade, stepFrac);

    // Subtle parallax tilt
    targetCamP.x += mouse.x * 0.16;
    targetCamP.y += -mouse.y * 0.12;
    targetLook.x += mouse.x * 0.04;
    targetLook.y += -mouse.y * 0.03;

    // Smooth LERP (Spring damping)
    currentCarPos.lerp(targetCarP, 0.065);
    currentCamPos.lerp(targetCamP, 0.065);
    currentLookAt.lerp(targetLook, 0.065);
    currentFov.value += (targetFovVal - currentFov.value) * 0.065;

    camera.fov = currentFov.value;
    camera.updateProjectionMatrix();

    currentCarRot.x += (targetRotX - currentCarRot.x) * 0.065;
    currentCarRot.y += (targetRotY - currentCarRot.y) * 0.065;
    currentCarRot.z += (targetRotZ - currentCarRot.z) * 0.065;

    currentStudioFade.value += (targetFade - currentStudioFade.value) * 0.06;

    // Strict Ground Penetration Protection (Car tires and nose NEVER dip below y = 0)
    var sFade = currentStudioFade.value;
    if (sFade > 0.05) {
      var pitchDip = Math.max(0, Math.sin(Math.max(0, currentCarRot.x)) * 1.4);
      if (currentCarPos.y < pitchDip) {
        currentCarPos.y = pitchDip;
      }
    }

    carGroup.position.copy(currentCarPos);
    carGroup.rotation.copy(currentCarRot);
    camera.position.copy(currentCamPos);
    camera.lookAt(currentLookAt);

    // Dynamic Fog Management: Only active when entering studio
    if (sFade > 0.08) {
      if (!scene.fog) {
        scene.fog = new THREE.Fog(0x000000, 12, 28);
      }
    } else {
      scene.fog = null;
    }

    // Studio Environment Fading
    if (floorMesh) {
      floorMesh.material.opacity = sFade * 0.94;
    }
    if (contactShadow) {
      contactShadow.position.x = currentCarPos.x;
      contactShadow.position.z = currentCarPos.z;
      contactShadow.material.opacity = sFade * 0.88;
    }
    if (studioCeilingLight) {
      studioCeilingLight.intensity = sFade * 3.4;
    }
    if (studioAmbientLight) {
      studioAmbientLight.intensity = sFade * 0.55;
    }

    // Earth and Space Stars: CLEAN AND TOTAL FADE OUT
    var earthAlpha = Math.max(0, 1.0 - raw * 2.2);
    if (earthMesh) {
      earthMesh.material.opacity = earthAlpha;
    }
    if (orbitalEarthGroup) {
      orbitalEarthGroup.visible = (raw < 0.5);
      orbitalEarthGroup.position.y = -2.4 - raw * 8.0;
    }

    var starAlpha = Math.max(0, 1.0 - raw * 1.8);
    if (starsDeep) {
      starsDeep.material.opacity = starAlpha * 0.85;
      starsDeep.visible = (starAlpha > 0.001);
    }
    if (starsMid) {
      starsMid.material.opacity = starAlpha * 0.95;
      starsMid.visible = (starAlpha > 0.001);
    }
    if (starsNear) {
      starsNear.material.opacity = starAlpha * 1.0;
      starsNear.visible = (starAlpha > 0.001);
    }

    // 1. CASCADING WATER STREAMS & CLEANROOM LIGHT (ACTIVE ON STEP 1: WASH)
    if (waterStreams) {
      waterStreams.material.opacity = targetWash * 0.85;
      if (targetWash > 0.01) {
        var pos = waterStreams.geometry.attributes.position.array;
        var sCount = pos.length / 6;
        for (var si = 0; si < sCount; si++) {
          var vel = waterVelArr[si];
          pos[si * 6 + 1] -= vel;
          pos[si * 6 + 4] -= vel;

          if (pos[si * 6 + 4] < 0.02) {
            pos[si * 6 + 1] = 3.6;
            pos[si * 6 + 4] = 3.35;
          }
        }
        waterStreams.geometry.attributes.position.needsUpdate = true;
      }
    }
    if (washBayLight) {
      washBayLight.intensity = targetWash * 6.5;
      washBayLight.target.position.set(currentCarPos.x, currentCarPos.y, currentCarPos.z);
      washBayLight.target.updateMatrixWorld();
    }

    // 2. POLISHING GLIDING INSPECTION SPOTLIGHT (ACTIVE ON STEP 2: POLISH)
    if (polishSpotLight) {
      var isPolishActive = (baseStep === 2 || nextStep === 2);
      polishSpotLight.intensity = isPolishActive ? (14.0 + Math.sin(elapsedTime * 2.5) * 4.0) * sFade : 0;
      polishSpotLight.position.set(
        currentCarPos.x - 1.1 + Math.sin(elapsedTime * 1.8) * 1.1,
        currentCarPos.y + 0.85,
        currentCarPos.z + 1.2
      );
      polishSpotLight.target.position.set(currentCarPos.x - 0.4, currentCarPos.y + 0.2, currentCarPos.z);
      polishSpotLight.target.updateMatrixWorld();
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
