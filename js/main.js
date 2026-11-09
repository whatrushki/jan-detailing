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
var floorMesh, contactShadow, studioLightsGroup, studioCeilingLight, studioAmbientLight;
var polishSpotLight, rainParticles, rainPosArr, rainVelArr;
var headlightMat, rearLightMat, headlightLeft, headlightRight, headlightFlareL, headlightFlareR;

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
initProceduralRainWash();
loadFerrariF40();
initScrollAndInteractions();
animate();

/* ============================================================
   THREE.JS SETUP & RENDERER
   ============================================================ */
function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  window.scene = scene;

  camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 4000);
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

  scene.environment = createSpaceEnvironment();

  carGroup = new THREE.Group();
  carGroup.visible = false;
  scene.add(carGroup);
  window.__carGroup = carGroup;
}

/* ============================================================
   COSMIC ENVIRONMENT MAP
   ============================================================ */
function createSpaceEnvironment() {
  var envCanvas = document.createElement('canvas');
  envCanvas.width = 1024;
  envCanvas.height = 512;
  var ctx = envCanvas.getContext('2d');

  var grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#000002');
  grad.addColorStop(0.46, '#010408');
  grad.addColorStop(0.55, '#051b3b');
  grad.addColorStop(0.72, '#12437a');
  grad.addColorStop(0.88, '#2667ab');
  grad.addColorStop(1.0, '#0a233d');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  var sunGrad = ctx.createRadialGradient(720, 140, 0, 720, 140, 90);
  sunGrad.addColorStop(0, '#ffffff');
  sunGrad.addColorStop(0.2, '#f8fafc');
  sunGrad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  sunGrad.addColorStop(1.0, 'transparent');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(720, 140, 90, 0, Math.PI * 2);
  ctx.fill();

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
    return new THREE.Points(geo, new THREE.PointsMaterial({
      size: size,
      vertexColors: true,
      transparent: true,
      opacity: opacity,
      sizeAttenuation: true
    }));
  }

  starsDeep = makeStars(6000, 900, 2000, 0.75, 0.85);
  starsMid  = makeStars(2400, 450, 900, 1.1, 0.95);
  starsNear = makeStars(300, 250, 450, 1.6, 1.0);

  scene.add(starsDeep);
  scene.add(starsMid);
  scene.add(starsNear);
}

/* ============================================================
   PHOTOREALISTIC ORBITAL EARTH
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
    opacity: 1.0
  });

  earthMesh = new THREE.Mesh(earthGeo, earthMat);
  orbitalEarthGroup.add(earthMesh);
  scene.add(orbitalEarthGroup);
}

/* ============================================================
   PROCEDURAL TEXTURES FOR STUDIO & SHADOWS
   ============================================================ */
function createStudioFloorTexture() {
  var floorCanvas = document.createElement('canvas');
  floorCanvas.width = 1024;
  floorCanvas.height = 1024;
  var ctx = floorCanvas.getContext('2d');

  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle clean luxury grid (128x128px tiles)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
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
  tex.repeat.set(10, 10);
  return tex;
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

function createHeadlightFlareTexture() {
  var fCanvas = document.createElement('canvas');
  fCanvas.width = 256;
  fCanvas.height = 256;
  var fCtx = fCanvas.getContext('2d');

  var grad = fCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0)');

  fCtx.fillStyle = grad;
  fCtx.fillRect(0, 0, 256, 256);

  return new THREE.CanvasTexture(fCanvas);
}

/* ============================================================
   MINIMALIST STUDIO ENVIRONMENT (PURE WHITE LEDS)
   ============================================================ */
function initStudioEnvironment() {
  // 1. Glossy Reflective Dark Studio Floor
  var floorGeo = new THREE.PlaneGeometry(100, 100);
  var floorMat = new THREE.MeshStandardMaterial({
    map: createStudioFloorTexture(),
    color: 0x06080d,
    roughness: 0.14,
    metalness: 0.92,
    transparent: true,
    opacity: 0.0
  });
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.68;
  scene.add(floorMesh);

  // 2. Soft Contact Ground Shadow under the car
  var shadowGeo = new THREE.PlaneGeometry(5.6, 3.2);
  var shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    opacity: 0.0,
    depthWrite: false
  });
  contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = -0.67;
  scene.add(contactShadow);

  // 3. Minimalist Parallel Overhead White LED Light Strips (At y = 2.45)
  studioLightsGroup = new THREE.Group();
  studioLightsGroup.position.set(0, 2.45, 0);

  for (var i = -2; i <= 2; i++) {
    var tubeGeo = new THREE.BoxGeometry(0.12, 0.03, 7.0);
    var tubeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0
    });
    var tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.position.x = i * 1.35;
    studioLightsGroup.add(tube);
  }
  scene.add(studioLightsGroup);

  // 4. Studio Overhead Key Directional Light & Ambient
  studioCeilingLight = new THREE.DirectionalLight(0xffffff, 0);
  studioCeilingLight.position.set(0, 8, 3);
  scene.add(studioCeilingLight);

  studioAmbientLight = new THREE.AmbientLight(0xffffff, 0);
  scene.add(studioAmbientLight);

  // 5. Polishing Flank Inspection Spotlight (Active on step 2)
  polishSpotLight = new THREE.SpotLight(0xffffff, 0, 16, Math.PI / 6, 0.35);
  polishSpotLight.position.set(-3.5, 1.8, 4.5);
  scene.add(polishSpotLight);
  scene.add(polishSpotLight.target);

  // 6. Car Twin Headlight Projectors & Bright Visual Flares
  headlightLeft = new THREE.SpotLight(0xffffff, 0, 35, Math.PI / 6, 0.4);
  headlightRight = new THREE.SpotLight(0xffffff, 0, 35, Math.PI / 6, 0.4);
  scene.add(headlightLeft);
  scene.add(headlightRight);

  var flareMat = new THREE.SpriteMaterial({
    map: createHeadlightFlareTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  headlightFlareL = new THREE.Sprite(flareMat.clone());
  headlightFlareL.scale.set(0.65, 0.65, 1.0);
  headlightFlareL.position.set(-0.58, 0.12, 1.48);
  carGroup.add(headlightFlareL);

  headlightFlareR = new THREE.Sprite(flareMat.clone());
  headlightFlareR.scale.set(0.65, 0.65, 1.0);
  headlightFlareR.position.set(0.58, 0.12, 1.48);
  carGroup.add(headlightFlareR);
}

/* ============================================================
   PROCEDURAL DETAILING WASH WATER RAIN SYSTEM (STEP 1)
   ============================================================ */
function initProceduralRainWash() {
  var rainCount = 1400;
  var rainGeo = new THREE.BufferGeometry();
  rainPosArr = new Float32Array(rainCount * 3);
  rainVelArr = new Float32Array(rainCount);

  for (var i = 0; i < rainCount; i++) {
    rainPosArr[i * 3]     = (Math.random() - 0.5) * 5.5; // X
    rainPosArr[i * 3 + 1] = Math.random() * 4.5;         // Y
    rainPosArr[i * 3 + 2] = (Math.random() - 0.5) * 6.5; // Z
    rainVelArr[i] = 0.07 + Math.random() * 0.14;
  }

  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPosArr, 3));

  var rainMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.035,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  rainParticles = new THREE.Points(rainGeo, rainMat);
  scene.add(rainParticles);
}

/* ============================================================
   LOAD FERRARI F40
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

      carModel.position.x = -center.x;
      carModel.position.y = -center.y;
      carModel.position.z = -center.z;

      var maxDim = Math.max(size.x, size.y, size.z);
      var targetScale = 3.25 / maxDim;
      carModel.scale.setScalar(targetScale);

      carModel.traverse(function(node) {
        if (node.isMesh && node.material) {
          var mat = node.material;

          // Paint Material: High-Gloss Mirror Clearcoat
          if (mat.name === 'Paint' || mat.name.toLowerCase().includes('paint')) {
            mat.roughness = 0.03;
            mat.metalness = 0.35;
            mat.clearcoat = 1.0;
            mat.clearcoatRoughness = 0.003;
          }

          // Cache light materials
          if (mat.name === 'Headlight') {
            headlightMat = mat;
            headlightMat.color.setRGB(1, 1, 1);
            headlightMat.emissive = new THREE.Color(0x000000);
            headlightMat.emissiveIntensity = 0;
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
        studioFade: 0.0,
        headlights: 0.0,
        rainFade: 0.0
      };

    case 1: // 01 WASH: Detailing bay entry with procedural water rain
      return {
        carPos: new THREE.Vector3(isDesktop ? -1.35 : 0, isDesktop ? -0.12 : 0.88, isDesktop ? 2.85 : 2.2),
        carRot: new THREE.Euler(0.12, 0.74, -0.04),
        camPos: new THREE.Vector3(0, 0.22, 7.3),
        lookAt: new THREE.Vector3(-0.48, 0.05, 0),
        studioFade: 1.0,
        headlights: 0.0,
        rainFade: 1.0
      };

    case 2: // 02 POLISH: Flank macro reflection & scanning inspection spotlight
      return {
        carPos: new THREE.Vector3(isDesktop ? -1.15 : 0, isDesktop ? 0.08 : 0.65, isDesktop ? 3.8 : 3.0),
        carRot: new THREE.Euler(0.04, 1.48, 0.0),
        camPos: new THREE.Vector3(-0.05, 0.22, 6.0),
        lookAt: new THREE.Vector3(-0.65, 0.12, 0),
        studioFade: 1.0,
        headlights: 0.0,
        rainFade: 0.0
      };

    case 3: // 03 INTERIOR: Camera flies INSIDE the Ferrari F40 cockpit
      return {
        carPos: new THREE.Vector3(isDesktop ? 0.15 : 0, isDesktop ? -0.12 : 0.45, isDesktop ? 2.4 : 2.0),
        carRot: new THREE.Euler(0.02, 0.38, 0.0),
        camPos: new THREE.Vector3(isDesktop ? -0.08 : -0.15, isDesktop ? 0.28 : 0.82, isDesktop ? 4.0 : 3.6),
        lookAt: new THREE.Vector3(isDesktop ? 0.08 : 0, isDesktop ? 0.25 : 0.65, isDesktop ? 2.6 : 2.2),
        studioFade: 1.0,
        headlights: 0.0,
        rainFade: 0.0
      };

    case 4: // 04 STUDIO & LOCATION: Centered ground stance, twin headlights blazing
    default:
      return {
        carPos: new THREE.Vector3(0, isDesktop ? -0.12 : 0.42, isDesktop ? 2.85 : 2.2),
        carRot: new THREE.Euler(0.06, 0.0, 0.0),
        camPos: new THREE.Vector3(0, 0.22, 6.8),
        lookAt: new THREE.Vector3(0, -0.08, 0),
        studioFade: 1.0,
        headlights: 1.0,
        rainFade: 0.0
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
   STEP CONTROLLER & INTERACTION EVENTS
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

  // Mouse Wheel Navigation (Strictly locked during intro)
  window.addEventListener('wheel', function(e) {
    if (isIntroActive || wheelCooldown) return;
    if (Math.abs(e.deltaY) < 14) return;

    wheelCooldown = true;
    setTimeout(function() { wheelCooldown = false; }, 550);

    if (e.deltaY > 0) {
      goToStep(currentStep + 1);
    } else {
      goToStep(currentStep - 1);
    }
  }, { passive: true });

  // Touch Drag & Swipe (Strictly locked during intro)
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
    if (isIntroActive || wheelCooldown) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    var touchEndY = e.changedTouches[0].clientY;
    var diffY = touchStartY - touchEndY;

    if (Math.abs(diffY) > 35) {
      wheelCooldown = true;
      setTimeout(function() { wheelCooldown = false; }, 550);
      if (diffY > 0) {
        goToStep(currentStep + 1);
      } else {
        goToStep(currentStep - 1);
      }
    }
  }, { passive: true });

  // Keyboard Arrow / Page Navigation
  window.addEventListener('keydown', function(e) {
    if (isIntroActive || wheelCooldown) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      wheelCooldown = true;
      setTimeout(function() { wheelCooldown = false; }, 550);
      goToStep(currentStep + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      wheelCooldown = true;
      setTimeout(function() { wheelCooldown = false; }, 550);
      goToStep(currentStep - 1);
    }
  });

  // Navigation Click Handlers (Buttons, HUD dots)
  document.querySelectorAll('[data-target]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (isIntroActive) return;
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

    var targetRotX = THREE.MathUtils.lerp(poseA.carRot.x, poseB.carRot.x, stepFrac);
    var targetRotY = THREE.MathUtils.lerp(poseA.carRot.y, poseB.carRot.y, stepFrac);
    var targetRotZ = THREE.MathUtils.lerp(poseA.carRot.z, poseB.carRot.z, stepFrac);

    var targetFade = THREE.MathUtils.lerp(poseA.studioFade, poseB.studioFade, stepFrac);
    var targetLights = THREE.MathUtils.lerp(poseA.headlights, poseB.headlights, stepFrac);
    var targetRain = THREE.MathUtils.lerp(poseA.rainFade, poseB.rainFade, stepFrac);

    // Subtle parallax tilt
    targetCamP.x += mouse.x * 0.22;
    targetCamP.y += -mouse.y * 0.15;
    targetLook.x += mouse.x * 0.06;
    targetLook.y += -mouse.y * 0.04;

    // Smooth LERP (Spring damping)
    currentCarPos.lerp(targetCarP, 0.065);
    currentCamPos.lerp(targetCamP, 0.065);
    currentLookAt.lerp(targetLook, 0.065);

    currentCarRot.x += (targetRotX - currentCarRot.x) * 0.065;
    currentCarRot.y += (targetRotY - currentCarRot.y) * 0.065;
    currentCarRot.z += (targetRotZ - currentCarRot.z) * 0.065;

    currentStudioFade.value += (targetFade - currentStudioFade.value) * 0.06;

    carGroup.position.copy(currentCarPos);
    carGroup.rotation.copy(currentCarRot);
    camera.position.copy(currentCamPos);
    camera.lookAt(currentLookAt);

    // Studio Environment & Overhead White Lighting Fading
    var sFade = currentStudioFade.value;

    if (floorMesh) {
      floorMesh.material.opacity = sFade * 0.94;
    }
    if (contactShadow) {
      contactShadow.position.x = currentCarPos.x;
      contactShadow.position.z = currentCarPos.z;
      contactShadow.material.opacity = sFade * 0.88;
    }
    if (studioLightsGroup) {
      studioLightsGroup.children.forEach(function(child) {
        if (child.material) {
          child.material.opacity = sFade * 0.95;
        }
      });
    }
    if (studioCeilingLight) {
      studioCeilingLight.intensity = sFade * 3.8;
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

    // 1. PROCEDURAL RAIN PARTICLES ANIMATION (ACTIVE ON STEP 1: WASH)
    if (rainParticles) {
      rainParticles.material.opacity = targetRain * 0.85;
      if (targetRain > 0.01) {
        var pos = rainParticles.geometry.attributes.position.array;
        var rCount = pos.length / 3;
        for (var ri = 0; ri < rCount; ri++) {
          pos[ri * 3 + 1] -= rainVelArr[ri];
          if (pos[ri * 3 + 1] < -0.65) {
            pos[ri * 3 + 1] = 4.2;
          }
        }
        rainParticles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // 2. POLISHING GLIDING INSPECTION SPOTLIGHT (ACTIVE ON STEP 2: POLISH)
    if (polishSpotLight) {
      var isPolishActive = (baseStep === 2 || nextStep === 2);
      polishSpotLight.intensity = isPolishActive ? (12.0 + Math.sin(elapsedTime * 2.5) * 3.5) * sFade : 0;
      polishSpotLight.position.set(
        currentCarPos.x - 1.2 + Math.sin(elapsedTime * 1.8) * 1.1,
        currentCarPos.y + 0.85,
        currentCarPos.z + 1.2
      );
      polishSpotLight.target.position.set(currentCarPos.x - 0.4, currentCarPos.y + 0.2, currentCarPos.z);
      polishSpotLight.target.updateMatrixWorld();
    }

    // 3. HEADLIGHT IGNITION & BEAMS (ACTIVE ON STEP 4: STUDIO)
    if (headlightMat) {
      headlightMat.emissive.setRGB(targetLights, targetLights, targetLights);
      headlightMat.emissiveIntensity = targetLights * 28.0;
    }
    if (rearLightMat) {
      rearLightMat.emissive.setRGB(targetLights * 1.0, targetLights * 0.02, 0);
      rearLightMat.emissiveIntensity = targetLights * 12.0;
    }
    if (headlightFlareL && headlightFlareR) {
      headlightFlareL.material.opacity = targetLights * 1.0;
      headlightFlareR.material.opacity = targetLights * 1.0;
    }
    if (headlightLeft && headlightRight && carModel) {
      headlightLeft.intensity = targetLights * 12.0;
      headlightRight.intensity = targetLights * 12.0;

      // Project twin light beams forward from bumper onto the floor
      var headLPos = new THREE.Vector3(-0.58, 0.25, 1.4).applyMatrix4(carGroup.matrixWorld);
      var headRPos = new THREE.Vector3(0.58, 0.25, 1.4).applyMatrix4(carGroup.matrixWorld);
      var headTarget = new THREE.Vector3(0, -0.6, 9.0).applyMatrix4(carGroup.matrixWorld);

      headlightLeft.position.copy(headLPos);
      headlightRight.position.copy(headRPos);
      headlightLeft.target.position.copy(headTarget);
      headlightRight.target.position.copy(headTarget);
      headlightLeft.target.updateMatrixWorld();
      headlightRight.target.updateMatrixWorld();
    }
  }

  renderer.render(scene, camera);
}
