/**
 * JAN DETAILING - Interactive 3D Camera & Car Visual Tuner
 * Allows real-time live manipulation of camera and car coordinates on Desktop & Mobile.
 */

export function initTuner(options) {
  var isDebug = window.location.search.includes('debug=1');
  if (!isDebug) {
    return; // Strictly hidden in production unless ?debug=1 is set
  }
  document.body.classList.add('debug-mode');

  var THREE = options.THREE;
  var camera = options.camera;
  var carGroup = options.carGroup;
  var getStepPose = options.getStepPose;
  var goToStep = options.goToStep;
  var getCurrentStep = options.getCurrentStep;

  window.__tunerOverrides = {};
  window.__tunerActive = false;

  // Create UI elements
  var toggleBtn = document.createElement('button');
  toggleBtn.id = 'tunerToggleBtn';
  toggleBtn.innerHTML = '⚙ ТЮНЕР 3D';
  toggleBtn.setAttribute('style', `
    position: fixed;
    bottom: 18px;
    left: 18px;
    z-index: 999999;
    background: rgba(0, 0, 0, 0.85);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.4);
    padding: 10px 18px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 2px;
    cursor: pointer;
    backdrop-filter: blur(12px);
    border-radius: 4px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
    transition: all 0.25s ease;
  `);

  var panel = document.createElement('div');
  panel.id = 'tunerPanel';
  panel.setAttribute('style', `
    position: fixed;
    top: 10px;
    left: 10px;
    bottom: 10px;
    width: min(390px, calc(100vw - 20px));
    z-index: 999999;
    background: rgba(6, 6, 8, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(16px);
    color: #fff;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    padding: 16px;
    display: none;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    border-radius: 6px;
    box-sizing: border-box;
  `);

  document.body.appendChild(toggleBtn);
  document.body.appendChild(panel);

  var activeStep = getCurrentStep() || 0;

  function getStepValues(step) {
    if (window.__tunerOverrides[step]) {
      return window.__tunerOverrides[step];
    }
    var orig = getStepPose(step);
    var clone = {
      carPos: orig.carPos.clone(),
      carRot: orig.carRot.clone(),
      camPos: orig.camPos.clone(),
      lookAt: orig.lookAt.clone(),
      fov: orig.fov,
      studioFade: orig.studioFade,
      headlights: orig.headlights,
      washFade: orig.washFade
    };
    window.__tunerOverrides[step] = clone;
    return clone;
  }

  function renderUI() {
    var vals = getStepValues(activeStep);
    var isDesktop = window.innerWidth > 900;
    var devName = isDesktop ? '🖥 DESKTOP (>900px)' : '📱 MOBILE (≤900px, w:' + window.innerWidth + 'px)';

    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:8px;">
        <span style="font-weight:700; color:#fff; font-size:12px; letter-spacing:1px;">3D CAMERA & CAR TUNER</span>
        <button id="tunerCloseBtn" style="background:none; border:none; color:#888; font-size:16px; cursor:pointer; padding:0 6px;">✕</button>
      </div>

      <div style="font-size:10px; color:#aaa;">Устройство: <b style="color:#fff;">${devName}</b></div>

      <!-- Step Selector -->
      <div>
        <div style="font-size:10px; color:#888; margin-bottom:6px; letter-spacing:1px;">ВЫБЕРИТЕ ШАГ:</div>
        <div style="display:flex; gap:4px; flex-wrap:wrap;">
          ${[0, 1, 2, 3, 4].map(s => `
            <button class="step-btn" data-step="${s}" style="
              flex:1;
              min-width:56px;
              padding:8px 4px;
              background:${s === activeStep ? '#fff' : 'rgba(255,255,255,0.08)'};
              color:${s === activeStep ? '#000' : '#fff'};
              border:1px solid ${s === activeStep ? '#fff' : 'rgba(255,255,255,0.2)'};
              font-family:'JetBrains Mono', monospace;
              font-size:10px;
              font-weight:${s === activeStep ? '700' : '400'};
              cursor:pointer;
              border-radius:2px;
            ">${s === 0 ? '00 HERO' : (s === 1 ? '01 WASH' : (s === 2 ? '02 POLISH' : (s === 3 ? '03 CABIN' : '04 STUDIO')))}</button>
          `).join('')}
        </div>
      </div>

      <!-- Quick Canvas Drag Mode notice -->
      <div style="background:rgba(255,255,255,0.05); padding:8px 10px; border-radius:4px; font-size:10px; color:#ccc; line-height:1.4;">
        💡 <b>Подсказка:</b> Двигайте ползунки ниже, чтобы менять положение машины и камеры в реальном времени.
      </div>

      <!-- CAR POSITION -->
      <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:10px; color:#fff; font-weight:700; margin-bottom:8px; letter-spacing:1px;">🚗 ПОЛОЖЕНИЕ МАШИНЫ (CAR POS)</div>
        ${createSlider('car_pos_x', 'Машина Влево / Вправо (X)', vals.carPos.x, -4.0, 4.0, 0.02)}
        ${createSlider('car_pos_y', 'Машина Вниз / Вверх (Y)', vals.carPos.y, -1.5, 3.5, 0.02)}
        ${createSlider('car_pos_z', 'Машина Ближе / Дальше (Z)', vals.carPos.z, -2.0, 6.0, 0.05)}
      </div>

      <!-- CAR ROTATION -->
      <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:10px; color:#fff; font-weight:700; margin-bottom:8px; letter-spacing:1px;">🔄 ПОВОРОТ МАШИНЫ (CAR ROT)</div>
        ${createSlider('car_rot_y', 'Поворот влево-вправо (Rot Y, рад)', vals.carRot.y, -3.1415, 3.1415, 0.02)}
        ${createSlider('car_rot_x', 'Наклон носа вверх-вниз (Rot X)', vals.carRot.x, -1.57, 1.57, 0.02)}
        ${createSlider('car_rot_z', 'Крен кузова (Rot Z)', vals.carRot.z, -1.57, 1.57, 0.02)}
      </div>

      <!-- CAMERA POSITION -->
      <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:10px; color:#fff; font-weight:700; margin-bottom:8px; letter-spacing:1px;">📷 ПОЛОЖЕНИЕ КАМЕРЫ (CAM POS)</div>
        ${createSlider('cam_pos_x', 'Камера Влево / Вправо (X)', vals.camPos.x, -5.0, 5.0, 0.02)}
        ${createSlider('cam_pos_y', 'Камера Ниже / Выше (Y)', vals.camPos.y, -1.5, 4.0, 0.02)}
        ${createSlider('cam_pos_z', 'Камера Дистанция / Отдаление (Z)', vals.camPos.z, 0.5, 14.0, 0.05)}
      </div>

      <!-- CAMERA LOOK-AT -->
      <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:10px; color:#fff; font-weight:700; margin-bottom:8px; letter-spacing:1px;">🎯 ТОЧКА ВЗГЛЯДА (LOOK AT)</div>
        ${createSlider('look_x', 'Взгляд Влево / Вправо (X)', vals.lookAt.x, -4.0, 4.0, 0.02)}
        ${createSlider('look_y', 'Взгляд Ниже / Выше (Y)', vals.lookAt.y, -1.5, 3.0, 0.02)}
        ${createSlider('look_z', 'Взгляд Глубина (Z)', vals.lookAt.z, -3.0, 3.0, 0.05)}
      </div>

      <!-- CAMERA FOV -->
      <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:10px; color:#fff; font-weight:700; margin-bottom:8px; letter-spacing:1px;">🔍 УГОЛ ОБЗОРА (FOV / ЗУМ)</div>
        ${createSlider('cam_fov', 'FOV (градусы)', vals.fov, 18, 90, 1)}
      </div>

      <!-- LIVE CODE OUTPUT -->
      <div>
        <div style="font-size:10px; color:#888; margin-bottom:4px; letter-spacing:1px;">КОД ДЛЯ ВСТАВКИ В ЧАТ:</div>
        <textarea id="tunerCodeBox" readonly style="
          width:100%;
          height:130px;
          background:#000;
          color:#00ff88;
          border:1px solid rgba(255,255,255,0.25);
          font-family:'JetBrains Mono', monospace;
          font-size:10px;
          padding:8px;
          box-sizing:border-box;
          border-radius:3px;
          resize:none;
        "></textarea>
      </div>

      <!-- COPY BUTTON -->
      <button id="tunerCopyBtn" style="
        background:#ffffff;
        color:#000000;
        border:none;
        padding:12px;
        font-family:'JetBrains Mono', monospace;
        font-size:11px;
        font-weight:700;
        letter-spacing:2px;
        cursor:pointer;
        border-radius:3px;
        transition:all 0.2s ease;
        text-transform:uppercase;
      ">📋 СКОПИРОВАТЬ ЭТОТ ШАГ</button>

      <button id="tunerResetBtn" style="
        background:transparent;
        color:#aaa;
        border:1px solid rgba(255,255,255,0.2);
        padding:8px;
        font-family:'JetBrains Mono', monospace;
        font-size:10px;
        cursor:pointer;
        border-radius:3px;
      ">↺ СБРОСИТЬ К ИСХОДНЫМ</button>
    `;

    bindEvents();
    updateCodeBox();
  }

  function createSlider(id, label, val, min, max, step) {
    return `
      <div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:2px; font-size:9.5px; color:#bbb;">
          <span>${label}</span>
          <b id="${id}_val" style="color:#fff;">${typeof val === 'number' ? val.toFixed(2) : val}</b>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <button class="nudge-btn" data-id="${id}" data-delta="-${step * 2}" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; width:22px; height:20px; font-size:10px; cursor:pointer; border-radius:2px;">-</button>
          <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="flex:1; cursor:pointer;">
          <button class="nudge-btn" data-id="${id}" data-delta="${step * 2}" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; width:22px; height:20px; font-size:10px; cursor:pointer; border-radius:2px;">+</button>
        </div>
      </div>
    `;
  }

  function updateCodeBox() {
    var vals = getStepValues(activeStep);
    var isDesktop = window.innerWidth > 900;
    var targetName = isDesktop ? 'Desktop' : 'Mobile';
    var stepNames = ['00 HERO', '01 WASH', '02 POLISH', '03 INTERIOR', '04 STUDIO'];

    var snippet = `// Шаг ${activeStep} (${stepNames[activeStep]}) для ${targetName}:
carPos: new THREE.Vector3(${vals.carPos.x.toFixed(2)}, ${vals.carPos.y.toFixed(2)}, ${vals.carPos.z.toFixed(2)}),
carRot: new THREE.Euler(${vals.carRot.x.toFixed(2)}, ${vals.carRot.y.toFixed(2)}, ${vals.carRot.z.toFixed(2)}),
camPos: new THREE.Vector3(${vals.camPos.x.toFixed(2)}, ${vals.camPos.y.toFixed(2)}, ${vals.camPos.z.toFixed(2)}),
lookAt: new THREE.Vector3(${vals.lookAt.x.toFixed(2)}, ${vals.lookAt.y.toFixed(2)}, ${vals.lookAt.z.toFixed(2)}),
fov: ${Math.round(vals.fov)}`;

    var codeBox = document.getElementById('tunerCodeBox');
    if (codeBox) {
      codeBox.value = snippet;
    }
  }

  function applyLiveChanges() {
    var vals = getStepValues(activeStep);
    if (carGroup) {
      carGroup.position.copy(vals.carPos);
      carGroup.rotation.copy(vals.carRot);
    }
    if (camera) {
      camera.position.copy(vals.camPos);
      camera.lookAt(vals.lookAt);
      camera.fov = vals.fov;
      camera.updateProjectionMatrix();
    }
    if (window.__currentCarPos) window.__currentCarPos.copy(vals.carPos);
    if (window.__currentCarRot) window.__currentCarRot.copy(vals.carRot);
    if (window.__currentCamPos) window.__currentCamPos.copy(vals.camPos);
    if (window.__currentLookAt) window.__currentLookAt.copy(vals.lookAt);
    if (window.__currentFov) window.__currentFov.value = vals.fov;
  }

  function bindEvents() {
    var vals = getStepValues(activeStep);

    // Step selection
    panel.querySelectorAll('.step-btn').forEach(btn => {
      btn.onclick = function() {
        var s = parseInt(btn.getAttribute('data-step'), 10);
        activeStep = s;
        goToStep(s);
        setTimeout(function() {
          renderUI();
          applyLiveChanges();
        }, 120);
      };
    });

    // Close button
    var closeBtn = document.getElementById('tunerCloseBtn');
    if (closeBtn) {
      closeBtn.onclick = function() {
        panel.style.display = 'none';
        window.__tunerActive = false;
      };
    }

    // Sliders
    var sliders = [
      { id: 'car_pos_x', obj: vals.carPos, prop: 'x' },
      { id: 'car_pos_y', obj: vals.carPos, prop: 'y' },
      { id: 'car_pos_z', obj: vals.carPos, prop: 'z' },
      { id: 'car_rot_y', obj: vals.carRot, prop: 'y' },
      { id: 'car_rot_x', obj: vals.carRot, prop: 'x' },
      { id: 'car_rot_z', obj: vals.carRot, prop: 'z' },
      { id: 'cam_pos_x', obj: vals.camPos, prop: 'x' },
      { id: 'cam_pos_y', obj: vals.camPos, prop: 'y' },
      { id: 'cam_pos_z', obj: vals.camPos, prop: 'z' },
      { id: 'look_x',    obj: vals.lookAt, prop: 'x' },
      { id: 'look_y',    obj: vals.lookAt, prop: 'y' },
      { id: 'look_z',    obj: vals.lookAt, prop: 'z' },
      { id: 'cam_fov',   obj: vals,        prop: 'fov' }
    ];

    sliders.forEach(s => {
      var el = document.getElementById(s.id);
      var valEl = document.getElementById(s.id + '_val');
      if (el) {
        el.oninput = function() {
          var num = parseFloat(el.value);
          s.obj[s.prop] = num;
          if (valEl) valEl.innerText = num.toFixed(2);
          applyLiveChanges();
          updateCodeBox();
        };
      }
    });

    // Nudge buttons (+ / -)
    panel.querySelectorAll('.nudge-btn').forEach(btn => {
      btn.onclick = function() {
        var targetId = btn.getAttribute('data-id');
        var delta = parseFloat(btn.getAttribute('data-delta'));
        var el = document.getElementById(targetId);
        if (el) {
          var current = parseFloat(el.value);
          var next = Math.max(parseFloat(el.min), Math.min(parseFloat(el.max), current + delta));
          el.value = next;
          el.dispatchEvent(new Event('input'));
        }
      };
    });

    // Copy Button
    var copyBtn = document.getElementById('tunerCopyBtn');
    if (copyBtn) {
      copyBtn.onclick = function() {
        var codeBox = document.getElementById('tunerCodeBox');
        if (codeBox) {
          codeBox.select();
          navigator.clipboard.writeText(codeBox.value).then(function() {
            var origText = copyBtn.innerText;
            copyBtn.innerText = '✅ СКОПИРОВАНО В БУФЕР!';
            copyBtn.style.background = '#00ff88';
            setTimeout(function() {
              copyBtn.innerText = origText;
              copyBtn.style.background = '#ffffff';
            }, 1800);
          }).catch(function() {
            alert('Скопируйте текст из поля вручную.');
          });
        }
      };
    }

    // Reset Button
    var resetBtn = document.getElementById('tunerResetBtn');
    if (resetBtn) {
      resetBtn.onclick = function() {
        delete window.__tunerOverrides[activeStep];
        renderUI();
        applyLiveChanges();
      };
    }
  }

  // Toggle button click
  toggleBtn.onclick = function() {
    var isOpen = panel.style.display === 'flex';
    if (isOpen) {
      panel.style.display = 'none';
      window.__tunerActive = false;
    } else {
      panel.style.display = 'flex';
      window.__tunerActive = true;
      activeStep = getCurrentStep();
      renderUI();
      applyLiveChanges();
    }
  };

  // Keyboard shortcut: Press 'D' or 'T' to toggle tuner
  window.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'd' || e.key === 'D' || e.key === 't' || e.key === 'T' || e.key === 'в' || e.key === 'е') {
      toggleBtn.click();
    }
  });

  // Auto-open if ?debug=1 or ?tuner=1
  if (window.location.search.includes('debug=1') || window.location.search.includes('tuner=1')) {
    setTimeout(function() {
      toggleBtn.click();
    }, 400);
  }
}
