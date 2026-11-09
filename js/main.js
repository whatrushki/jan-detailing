import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';

window.THREE = THREE;

/* ============================================================
   GLOBAL CONSTANTS & INITIAL STATE
   ============================================================ */
var REST_ROT_X = 0.94;
var REST_ROT_Y = 0.46;
var REST_ROT_Z = -0.44;

var clock = new THREE.Clock();
var sunPosition = new THREE.Vector3(26, 30, 20);
var currentLookAt = new THREE.Vector3(-0.35, 0.15, 0);
var introBlend = { value: 0 };

var mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
var windowHalf = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

var scene, camera, renderer;
var carGroup, carModel;
var orbitalEarthGroup, earthMesh;
var starsDeep, starsMid, starsNear;
var isIntroActive = true;

window.__state = { carLoaded: false, earthLoaded: false };

// DOM
var canvas = document.getElementById('webgl');
var flickerItems = document.querySelectorAll('.flicker-item');

/* ============================================================
   RESPONSIVE REST POSITION
   ============================================================ */
function getTargetRestPos() {
  var isDesktop = window.innerWidth > 900;
  return {
    x: isDesktop ? -0.92 : 0,
    y: isDesktop ? 0.36 : 0.98,
    z: isDesktop ? 2.4 : 1.9
  };
}

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
  camera.position.set(0.2, 0.3, 10.0);
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
   COSMIC ENVIRONMENT MAP (PHYSICAL IBL REFLECTIONS)
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
   POWERFUL CINEMATIC SPACE LIGHTING
   ============================================================ */
function initCinematicSunlight() {
  var ambient = new THREE.AmbientLight(0x0a101d, 0.45);
  scene.add(ambient);

  var sunLight = new THREE.DirectionalLight(0xffffff, 4.4);
  sunLight.position.copy(sunPosition);
  sunLight.target.position.set(-0.5, 0.2, 0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  var earthBounce = new THREE.DirectionalLight(0x2563eb, 0.65);
  earthBounce.position.set(-15, -25, 8);
  earthBounce.target.position.set(0, 0, 0);
  scene.add(earthBounce);
  scene.add(earthBounce.target);

  var rimLight = new THREE.DirectionalLight(0xf1f5f9, 1.4);
  rimLight.position.set(-20, 20, -10);
  scene.add(rimLight);
}

/* ============================================================
   TRUE CINEMATIC DEEP SPACE
   ============================================================ */
function initDeepCosmosWithLayers() {
  var deepCount = 8000;
  var deepGeo = new THREE.BufferGeometry();
  var deepPos = new Float32Array(deepCount * 3);
  var deepCol = new Float32Array(deepCount * 3);

  for (var i = 0; i < deepCount; i++) {
    var r = 900 + Math.random() * 1200;
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);

    deepPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    deepPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    deepPos[i * 3 + 2] = r * Math.cos(phi);

    var bri = Math.pow(Math.random(), 4.0) * 0.5 + 0.08;
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

  var midCount = 2800;
  var midGeo = new THREE.BufferGeometry();
  var midPos = new Float32Array(midCount * 3);
  var midCol = new Float32Array(midCount * 3);

  for (var j = 0; j < midCount; j++) {
    var rMid = 450 + Math.random() * 450;
    var thetaMid = Math.random() * Math.PI * 2;
    var phiMid = Math.acos(2 * Math.random() - 1);

    midPos[j * 3]     = rMid * Math.sin(phiMid) * Math.cos(thetaMid);
    midPos[j * 3 + 1] = rMid * Math.sin(phiMid) * Math.sin(thetaMid);
    midPos[j * 3 + 2] = rMid * Math.cos(phiMid);

    var briMid = Math.pow(Math.random(), 3.0) * 0.75 + 0.25;
    midCol[j * 3]     = briMid;
    midCol[j * 3 + 1] = briMid * 0.98;
    midCol[j * 3 + 2] = briMid * 1.02;
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

  var nearCount = 350;
  var nearGeo = new THREE.BufferGeometry();
  var nearPos = new Float32Array(nearCount * 3);
  var nearCol = new Float32Array(nearCount * 3);

  for (var k = 0; k < nearCount; k++) {
    var rNear = 250 + Math.random() * 250;
    var thetaNear = Math.random() * Math.PI * 2;
    var phiNear = Math.acos(2 * Math.random() - 1);

    nearPos[k * 3]     = rNear * Math.sin(phiNear) * Math.cos(thetaNear);
    nearPos[k * 3 + 1] = rNear * Math.sin(phiNear) * Math.sin(thetaNear);
    nearPos[k * 3 + 2] = rNear * Math.cos(phiNear);

    var warm = Math.random() > 0.65;
    nearCol[k * 3]     = warm ? 1.0 : 0.88;
    nearCol[k * 3 + 1] = warm ? 0.94 : 0.96;
    nearCol[k * 3 + 2] = warm ? 0.78 : 1.0;
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
   PHOTOREALISTIC ORBITAL EARTH
   ============================================================ */
function initPhotorealisticOrbitalEarth() {
  var textureLoader = new THREE.TextureLoader();
  var maxAniso = renderer.capabilities.getMaxAnisotropy();

  orbitalEarthGroup = new THREE.Group();
  orbitalEarthGroup.position.set(-3.2, -2.4, -22.0);
  orbitalEarthGroup.rotation.z = -0.13;

  var width = 54;
  var height = 36;
  var segW = 64;
  var segH = 64;
  var earthGeo = new THREE.PlaneGeometry(width, height, segW, segH);

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
    toneMapped: true
  });

  earthMesh = new THREE.Mesh(earthGeo, earthMat);
  orbitalEarthGroup.add(earthMesh);

  scene.add(orbitalEarthGroup);
}

/* ============================================================
   LOAD FERRARI F40 (DIRECT GLB)
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

      startCinematicSequence();
    },
    undefined,
    function(err) {
      console.error('Error loading car:', err);
    }
  );
}

/* ============================================================
   CINEMATIC SEQUENCE
   ============================================================ */
function startCinematicSequence() {
  var restPos = getTargetRestPos();

  carGroup.position.set(restPos.x + 1.2, restPos.y + 4.8, -60);
  carGroup.rotation.set(
    REST_ROT_X + Math.PI * 2.0,
    REST_ROT_Y + Math.PI * 2.5,
    REST_ROT_Z - Math.PI * 1.4
  );
  carGroup.visible = true;

  var tl = gsap.timeline({
    onComplete: function() {
      isIntroActive = false;
      // Trigger text flicker ONLY when car lands!
      triggerTextFlicker();
      gsap.to(introBlend, {
        value: 1.0,
        duration: 1.4,
        ease: 'power2.out'
      });
    }
  });

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
   TEXT FLICKER EFFECT
   ============================================================ */
function triggerTextFlicker() {
  flickerItems.forEach(function(item, index) {
    setTimeout(function() {
      item.classList.add('flicker-active');
    }, index * 120);
  });
}

/* ============================================================
   SMOOTH MOUSE & TOUCH REACTION (PURE & ROCK-SOLID)
   ============================================================ */
function initEvents() {
  window.addEventListener('resize', onWindowResize);

  window.addEventListener('pointermove', function(e) {
    if (e.pointerType === 'mouse') {
      mouse.targetX = (e.clientX - windowHalf.x) / windowHalf.x;
      mouse.targetY = (e.clientY - windowHalf.y) / windowHalf.y;
    }
  });

  var onTouch = function(e) {
    if (e.touches && e.touches.length > 0) {
      var touch = e.touches[0];
      mouse.targetX = (touch.clientX - windowHalf.x) / windowHalf.x;
      mouse.targetY = (touch.clientY - windowHalf.y) / windowHalf.y;
    }
  };

  window.addEventListener('touchmove', onTouch, { passive: true });
  window.addEventListener('touchstart', onTouch, { passive: true });
}

function onWindowResize() {
  windowHalf.x = window.innerWidth / 2;
  windowHalf.y = window.innerHeight / 2;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  if (!isIntroActive && carGroup) {
    var restPos = getTargetRestPos();
    carGroup.position.x = restPos.x;
    carGroup.position.y = restPos.y;
    carGroup.position.z = restPos.z;
  }
}

/* ============================================================
   RENDER LOOP
   ============================================================ */
function animate() {
  requestAnimationFrame(animate);

  var elapsedTime = clock.getElapsedTime();

  mouse.x += (mouse.targetX - mouse.x) * 0.055;
  mouse.y += (mouse.targetY - mouse.y) * 0.055;

  var blend = introBlend.value;

  if (!isIntroActive) {
    var targetCamX = mouse.x * 0.38 * blend;
    var targetCamY = -mouse.y * 0.24 * blend;

    camera.position.x += (targetCamX - camera.position.x) * 0.045;
    camera.position.y += (targetCamY - camera.position.y) * 0.045;
    camera.position.z += (7.5 - camera.position.z) * 0.045;

    var targetLookX = -0.35 + (mouse.x * 0.10) * blend;
    var targetLookY = 0.15 - (mouse.y * 0.08) * blend;
    currentLookAt.x += (targetLookX - currentLookAt.x) * 0.045;
    currentLookAt.y += (targetLookY - currentLookAt.y) * 0.045;
  }
  camera.lookAt(currentLookAt);

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

  if (orbitalEarthGroup) {
    orbitalEarthGroup.position.x = -3.2 - (mouse.x * 0.45) * blend + Math.sin(elapsedTime * 0.03) * 0.10 * blend;
    orbitalEarthGroup.position.y = -2.4 + (mouse.y * 0.30) * blend + Math.cos(elapsedTime * 0.02) * 0.08 * blend;
  }

  if (!isIntroActive && carGroup) {
    var restPos = getTargetRestPos();

    var targetRotX = REST_ROT_X - (mouse.y * 0.025) * blend;
    var targetRotY = REST_ROT_Y + (mouse.x * 0.035) * blend;
    var targetRotZ = REST_ROT_Z - (mouse.x * 0.015) * blend;

    carGroup.rotation.x += (targetRotX - carGroup.rotation.x) * 0.03;
    carGroup.rotation.y += (targetRotY - carGroup.rotation.y) * 0.03;
    carGroup.rotation.z += (targetRotZ - carGroup.rotation.z) * 0.03;

    var targetPosX = restPos.x + (mouse.x * 0.04) * blend;
    var targetPosY = restPos.y + (-mouse.y * 0.035 + Math.sin(elapsedTime * 0.75) * 0.025) * blend;

    carGroup.position.x += (targetPosX - carGroup.position.x) * 0.03;
    carGroup.position.y += (targetPosY - carGroup.position.y) * 0.03;
  }

  renderer.render(scene, camera);
}
