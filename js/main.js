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
var floorMesh, studioLightsGroup, polishLight;
var headlightMat, rearLightMat, headlightLeft, headlightRight;

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
var heroOverlay = document.getElementById('heroOverlay');
var servicesOverlay = document.getElementById('servicesOverlay');
var contactOverlay = document.getElementById('contactOverlay');
var serviceCards = document.querySelectorAll('.service-card');

/* ============================================================
   INITIALIZATION
   ============================================================ */
initThree();
initDeepCosmosWithLayers();
initCinematicSunlight();
initPhotorealisticOrbitalEarth();
initStudioEnvironment();
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
   LIGHTING (COSMIC & STUDIO)
   ============================================================ */
function initCinematicSunlight() {
  var ambient = new THREE.AmbientLight(0x0a101d, 0.45);
  scene.add(ambient);

  var sunLight = new THREE.DirectionalLight(0xffffff, 4.4);
  sunLight.position.set(26, 30, 20);
  sunLight.target.position.set(-0.5, 0.2, 0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  var earthBounce = new THREE.DirectionalLight(0x2563eb, 0.65);
  earthBounce.position.set(-15, -25, 8);
  scene.add(earthBounce);

  var rimLight = new THREE.DirectionalLight(0xf1f5f9, 1.4);
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
      col[i * 3]     = bri * 0.92;
      col[i * 3 + 1] = bri * 0.96;
      col[i * 3 + 2] = bri * 1.05;
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
   VIRTUAL STUDIO ENVIRONMENT (REFLECTIVE FLOOR & LED TUBES)
   ============================================================ */
function initStudioEnvironment() {
  // 1. Glossy Dark Studio Floor
  var floorGeo = new THREE.PlaneGeometry(120, 120);
  var floorMat = new THREE.MeshStandardMaterial({
    color: 0x05070a,
    roughness: 0.12,
    metalness: 0.92,
    transparent: true,
    opacity: 0.0
  });
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.68;
  scene.add(floorMesh);

  // 2. Detailing Overhead LED Hexagon / Tube Grid
  studioLightsGroup = new THREE.Group();
  studioLightsGroup.position.set(0, 3.6, 0);

  for (var i = -3; i <= 3; i++) {
    var tubeGeo = new THREE.CylinderGeometry(0.035, 0.035, 12, 16);
    var tubeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0
    });
    var tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.x = i * 1.35;
    studioLightsGroup.add(tube);
  }
  scene.add(studioLightsGroup);

  // 3. Inspection Sliding Spotlight (For Polish Macro)
  polishLight = new THREE.SpotLight(0xfff7ed, 0);
  polishLight.angle = 0.55;
  polishLight.penumbra = 0.8;
  polishLight.position.set(-3.5, 1.8, 4.5);
  scene.add(polishLight);

  // 4. Car Headlight Projectors
  headlightLeft = new THREE.SpotLight(0xffffff, 0, 32, Math.PI / 6, 0.5);
  headlightRight = new THREE.SpotLight(0xffffff, 0, 32, Math.PI / 6, 0.5);
  scene.add(headlightLeft);
  scene.add(headlightRight);
  window.headlightLeft = headlightLeft;
  window.headlightRight = headlightRight;
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

          // Paint Material Enhancement
          if (mat.roughness !== undefined) {
            mat.roughness = Math.min(mat.roughness, 0.08);
          }
          if (mat.metalness !== undefined) {
            mat.metalness = Math.min(mat.metalness, 0.28);
          }
          if (mat.clearcoat !== undefined) {
            mat.clearcoat = 1.0;
            mat.clearcoatRoughness = 0.02;
          }

          // Cache light materials
          if (mat.name === 'Headlight') {
            headlightMat = mat;
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
   INTRO FLY-IN SEQUENCE
   ============================================================ */
function startIntroSequence() {
  console.log('START INTRO SEQUENCE CALLED');
  try {
    var rest = getStepPose(0);

    carGroup.position.set(rest.carPos.x + 1.2, rest.carPos.y + 4.8, -60);
    carGroup.rotation.set(
      rest.carRot.x + Math.PI * 2.0,
      rest.carRot.y + Math.PI * 2.5,
      rest.carRot.z - Math.PI * 1.4
    );
    carGroup.visible = true;

    var gsapInst = window.gsap || gsap;
    console.log('GSAP instance:', typeof gsapInst);

    introTimeline = gsapInst.timeline({
      onComplete: function() {
        console.log('INTRO COMPLETE AT:', performance.now());
        isIntroActive = false;
        window.__isIntroActive = false;
        currentCarPos.copy(rest.carPos);
        currentCarRot.copy(rest.carRot);
        currentCamPos.copy(rest.camPos);
        currentLookAt.copy(rest.lookAt);
        triggerFlickerIn(heroOverlay);
        onScroll();
      }
    });

    introTimeline.to(camera.position, {
      x: rest.camPos.x,
      y: rest.camPos.y,
      z: rest.camPos.z,
      duration: 2.8,
      ease: 'power3.out'
    }, 0);

    introTimeline.to(carGroup.position, {
      x: rest.carPos.x,
      y: rest.carPos.y,
      z: rest.carPos.z,
      duration: 2.8,
      ease: 'power3.out'
    }, 0);

    introTimeline.to(carGroup.rotation, {
      x: rest.carRot.x,
      y: rest.carRot.y,
      z: rest.carRot.z,
      duration: 2.8,
      ease: 'power3.out'
    }, 0);
  } catch (err) {
    console.error('START INTRO ERROR:', err);
  }
}

/* ============================================================
   SCENE STEP POSES (HERO -> WASH -> POLISH -> INTERIOR -> STUDIO)
   ============================================================ */
function getStepPose(step) {
  var isDesktop = window.innerWidth > 900;

  switch (step) {
    case 0: // HERO: Space orbit
      return {
        carPos: new THREE.Vector3(isDesktop ? -0.92 : 0, isDesktop ? 0.36 : 0.98, isDesktop ? 2.4 : 1.9),
        carRot: new THREE.Euler(0.94, 0.46, -0.44),
        camPos: new THREE.Vector3(0, 0, 7.5),
        lookAt: new THREE.Vector3(-0.35, 0.15, 0),
        studioFade: 0.0,
        headlights: 0.0
      };

    case 1: // 01 WASH: Detailing bay entry
      return {
        carPos: new THREE.Vector3(isDesktop ? -1.25 : 0, isDesktop ? -0.05 : 0.88, isDesktop ? 2.8 : 2.2),
        carRot: new THREE.Euler(0.14, 0.76, -0.04),
        camPos: new THREE.Vector3(0, 0.25, 7.2),
        lookAt: new THREE.Vector3(-0.45, 0.05, 0),
        studioFade: 0.9,
        headlights: 0.0
      };

    case 2: // 02 POLISH: Flank macro & mirror reflections
      return {
        carPos: new THREE.Vector3(isDesktop ? -1.15 : 0, isDesktop ? 0.18 : 0.92, isDesktop ? 3.35 : 2.5),
        carRot: new THREE.Euler(0.06, 1.35, 0.02),
        camPos: new THREE.Vector3(-0.15, 0.20, 6.4),
        lookAt: new THREE.Vector3(-0.55, 0.15, 0),
        studioFade: 1.0,
        headlights: 0.0
      };

    case 3: // 03 INTERIOR: Driver cockpit angle (Alcantara)
      return {
        carPos: new THREE.Vector3(isDesktop ? -0.95 : 0, isDesktop ? 0.38 : 0.98, isDesktop ? 3.1 : 2.35),
        carRot: new THREE.Euler(0.24, 0.98, -0.12),
        camPos: new THREE.Vector3(-0.1, 0.35, 6.6),
        lookAt: new THREE.Vector3(-0.4, 0.25, 0),
        studioFade: 1.0,
        headlights: 0.0
      };

    case 4: // 04 STUDIO & CONTACTS: Centered, ground stance, headlights blazing
    default:
      return {
        carPos: new THREE.Vector3(0, isDesktop ? -0.22 : 0.62, isDesktop ? 2.9 : 2.25),
        carRot: new THREE.Euler(0.08, 0.0, 0.0),
        camPos: new THREE.Vector3(0, 0.15, 6.8),
        lookAt: new THREE.Vector3(0, -0.1, 0),
        studioFade: 1.0,
        headlights: 1.0
      };
  }
}

/* ============================================================
   DIGITAL FLICKER SYSTEM (IN & OUT)
   ============================================================ */
function triggerFlickerIn(container) {
  if (!container) return;
  var items = container.querySelectorAll('.flicker-item');
  items.forEach(function(item, index) {
    item.classList.remove('flicker-out');
    item.classList.remove('flicker-active');
    setTimeout(function() {
      item.classList.add('flicker-active');
    }, index * 75);
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
  }, 230);
}

/* ============================================================
   UI OVERLAY STEP SWITCHER
   ============================================================ */
function updateUIStep(newStep) {
  if (newStep === currentStep) return;
  var prevStep = currentStep;
  currentStep = newStep;
  window.__currentStep = currentStep;

  // Update HUD indicator
  hudSteps.forEach(function(stepEl) {
    var target = parseInt(stepEl.getAttribute('data-target'), 10);
    stepEl.classList.toggle('active', target === newStep);
  });

  // 1. Manage Top-Level Overlays
  heroOverlay.classList.toggle('active', newStep === 0);
  servicesOverlay.classList.toggle('active', newStep >= 1 && newStep <= 3);
  contactOverlay.classList.toggle('active', newStep === 4);

  // 2. Manage Cards & Digital Flicker
  if (newStep === 0) {
    triggerFlickerIn(heroOverlay);
  } else if (newStep >= 1 && newStep <= 3) {
    serviceCards.forEach(function(card) {
      var sIdx = parseInt(card.getAttribute('data-service'), 10);
      if (sIdx === newStep) {
        card.classList.add('current');
        triggerFlickerIn(card);
      } else {
        card.classList.remove('current');
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

  // Mouse & Pointer Parallax (Subtle tilt only)
  window.addEventListener('pointermove', function(e) {
    if (e.pointerType === 'mouse') {
      mouse.targetX = (e.clientX - windowHalf.x) / windowHalf.x;
      mouse.targetY = (e.clientY - windowHalf.y) / windowHalf.y;
    }
  });

  // Mouse Wheel & Trackpad Navigation
  window.addEventListener('wheel', function(e) {
    if (isIntroActive) return;
    if (wheelCooldown) return;
    if (Math.abs(e.deltaY) < 14) return;

    wheelCooldown = true;
    setTimeout(function() { wheelCooldown = false; }, 650);

    if (e.deltaY > 0) {
      goToStep(currentStep + 1);
    } else {
      goToStep(currentStep - 1);
    }
  }, { passive: true });

  // Touch Drag & Swipe for Mobile Devices
  var touchStartY = 0;
  window.addEventListener('touchstart', function(e) {
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
    if (isIntroActive || wheelCooldown) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    var touchEndY = e.changedTouches[0].clientY;
    var diffY = touchStartY - touchEndY;

    if (Math.abs(diffY) > 35) {
      wheelCooldown = true;
      setTimeout(function() { wheelCooldown = false; }, 650);
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
      setTimeout(function() { wheelCooldown = false; }, 650);
      goToStep(currentStep + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      wheelCooldown = true;
      setTimeout(function() { wheelCooldown = false; }, 650);
      goToStep(currentStep - 1);
    }
  });

  // Navigation Click Handlers (Buttons, HUD dots)
  document.querySelectorAll('[data-target]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
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

    // Apply interactive parallax
    targetCamP.x += mouse.x * 0.28;
    targetCamP.y += -mouse.y * 0.18;
    targetLook.x += mouse.x * 0.08;
    targetLook.y += -mouse.y * 0.05;

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

    // Studio Environment Fading
    var sFade = currentStudioFade.value;

    if (floorMesh) {
      floorMesh.material.opacity = sFade * 0.88;
    }
    if (studioLightsGroup) {
      studioLightsGroup.children.forEach(function(tube) {
        tube.material.opacity = sFade * 0.95;
      });
    }
    if (earthMesh) {
      earthMesh.material.opacity = 1.0 - sFade * 0.85;
      orbitalEarthGroup.position.y = -2.4 - sFade * 8.0;
    }
    if (starsDeep && starsMid) {
      starsDeep.material.opacity = 0.85 * (1.0 - sFade * 0.7);
      starsMid.material.opacity  = 0.95 * (1.0 - sFade * 0.7);
    }

    // Polish Inspection Light (Active on step 2)
    if (polishLight) {
      var isPolishActive = (baseStep === 2 || nextStep === 2);
      polishLight.intensity = isPolishActive ? (3.5 + Math.sin(elapsedTime * 1.5) * 1.2) * sFade : 0;
      polishLight.position.x = -3.2 + Math.sin(elapsedTime * 0.8) * 0.6;
    }

    // Headlight Ignition (Active on step 4)
    if (headlightMat) {
      headlightMat.emissive.setRGB(targetLights, targetLights, targetLights);
      headlightMat.emissiveIntensity = targetLights * 12.0;
    }
    if (rearLightMat) {
      rearLightMat.emissive.setRGB(targetLights * 0.9, targetLights * 0.05, 0);
      rearLightMat.emissiveIntensity = targetLights * 8.0;
    }
    if (headlightLeft && headlightRight && carModel) {
      headlightLeft.intensity = targetLights * 6.5;
      headlightRight.intensity = targetLights * 6.5;

      // Position spotlights at front bumper
      var headLPos = new THREE.Vector3(-0.65, 0.45, 1.45).applyMatrix4(carGroup.matrixWorld);
      var headRPos = new THREE.Vector3(0.65, 0.45, 1.45).applyMatrix4(carGroup.matrixWorld);
      var headTarget = new THREE.Vector3(0, 0, 8.0).applyMatrix4(carGroup.matrixWorld);

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
