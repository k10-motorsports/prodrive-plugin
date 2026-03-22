// ═══════════════════════════════════════════════════════════════
//  AMBIENT CAPTURE — Region selection + settings color preview
// ═══════════════════════════════════════════════════════════════
//
//  1) User draws a capture rectangle via "Draw Region" button.
//     The rect is sent to main.js via IPC so the Electron
//     desktopCapturer samples color from that region only.
//
//  2) Settings preview: a colored div + info text showing the
//     current ambient color (~15fps, only while settings open).
//
//  3) When settings re-open, the saved capture rect is re-drawn
//     so the user can see where they last placed it.
// ═══════════════════════════════════════════════════════════════

(function initAmbientCapture() {
  'use strict';

  let _captureRect = null;     // { x, y, w, h } as ratios of viewport

  // Preview state
  let _previewInterval = null;

  // Region selection state
  let _isSelecting = false;
  let _startX = 0, _startY = 0;

  // ═════════════════════════════════════════════
  //  REGION SELECTION UI
  // ═════════════════════════════════════════════

  window.startCaptureAreaSelection = async function() {
    // Request screen recording permission (macOS)
    if (window.k10 && window.k10.ambientRequestPermission) {
      const btn = document.getElementById('btnSetCaptureArea');
      if (btn) btn.textContent = 'Requesting...';

      try {
        const result = await window.k10.ambientRequestPermission();
        console.log('[AmbientCapture] Permission result:', result);

        if (!result.granted) {
          if (btn) btn.textContent = 'Draw Region';
          const info = document.getElementById('ambientPreviewInfo');
          if (info) {
            info.textContent = result.platform === 'darwin'
              ? 'Grant Screen Recording permission in System Preferences, then try again'
              : 'Screen recording permission denied';
          }
          return;
        }
      } catch (err) {
        console.warn('[AmbientCapture] Permission request failed:', err);
      }

      if (btn) btn.textContent = 'Draw Region';
    }

    // Show selection overlay (settings stay open for click surface)
    const overlay = document.getElementById('captureAreaOverlay');
    if (!overlay) return;

    overlay.style.display = 'block';
    const rectEl = document.getElementById('captureAreaRect');
    if (rectEl) rectEl.style.display = 'none';

    overlay.addEventListener('mousedown', onSelectionStart);
    document.addEventListener('keydown', onSelectionEscape);
  };

  function onSelectionStart(e) {
    if (e.button !== 0) return;
    _isSelecting = true;
    _startX = e.clientX;
    _startY = e.clientY;
    const rectEl = document.getElementById('captureAreaRect');
    if (rectEl) {
      rectEl.style.display = 'block';
      rectEl.style.left = _startX + 'px';
      rectEl.style.top = _startY + 'px';
      rectEl.style.width = '0px';
      rectEl.style.height = '0px';
    }
    document.addEventListener('mousemove', onSelectionMove);
    document.addEventListener('mouseup', onSelectionEnd);
  }

  function onSelectionMove(e) {
    if (!_isSelecting) return;
    const rectEl = document.getElementById('captureAreaRect');
    if (!rectEl) return;
    const x = Math.min(e.clientX, _startX);
    const y = Math.min(e.clientY, _startY);
    const w = Math.abs(e.clientX - _startX);
    const h = Math.abs(e.clientY - _startY);
    rectEl.style.left = x + 'px';
    rectEl.style.top = y + 'px';
    rectEl.style.width = w + 'px';
    rectEl.style.height = h + 'px';
  }

  function onSelectionEnd(e) {
    if (!_isSelecting) return;
    _isSelecting = false;
    document.removeEventListener('mousemove', onSelectionMove);
    document.removeEventListener('mouseup', onSelectionEnd);

    const x = Math.min(e.clientX, _startX);
    const y = Math.min(e.clientY, _startY);
    const w = Math.abs(e.clientX - _startX);
    const h = Math.abs(e.clientY - _startY);

    if (w < 20 || h < 20) {
      console.warn('[AmbientCapture] Selection too small, ignoring');
      closeSelectionOverlay();
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    _captureRect = { x: x / vw, y: y / vh, w: w / vw, h: h / vh };

    // Persist locally
    if (window._settings) {
      window._settings.ambientCaptureRect = _captureRect;
      if (typeof window.saveSettings === 'function') window.saveSettings();
    }

    // Send to main process so desktopCapturer uses this region
    if (window.k10 && window.k10.ambientSetRect) {
      window.k10.ambientSetRect(_captureRect);
    }

    console.log('[AmbientCapture] Region set:', _captureRect);
    closeSelectionOverlay();
  }

  function onSelectionEscape(e) {
    if (e.key === 'Escape') closeSelectionOverlay();
  }

  function closeSelectionOverlay() {
    const overlay = document.getElementById('captureAreaOverlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.removeEventListener('mousedown', onSelectionStart);
    }
    document.removeEventListener('keydown', onSelectionEscape);
    document.removeEventListener('mousemove', onSelectionMove);
    document.removeEventListener('mouseup', onSelectionEnd);
    _isSelecting = false;
  }

  // ═════════════════════════════════════════════
  //  SETTINGS PREVIEW — realtime color + thumbnail
  //  ~15fps, only when settings panel is open.
  // ═════════════════════════════════════════════

  let _previewImgEl = null;   // <img> for screen thumbnail from main process

  window.startAmbientPreview = function() {
    if (_previewInterval) return;

    // Show saved capture rect overlay outline (non-interactive)
    showSavedRect();

    // Listen for preview frames from main process (screen thumbnails)
    if (window.k10 && window.k10.onAmbientPreviewFrame && !_previewImgEl) {
      // Create a thumbnail image element above the swatch
      const container = document.getElementById('ambientPreviewContainer');
      if (container) {
        _previewImgEl = document.createElement('img');
        _previewImgEl.id = 'ambientPreviewThumbnail';
        _previewImgEl.style.cssText =
          'width:100%;height:auto;border-radius:4px;margin-bottom:4px;' +
          'border:1px solid hsla(0,0%,100%,0.1);display:none;';
        // Insert before the swatch
        const swatch = document.getElementById('ambientPreviewSwatch');
        if (swatch) container.insertBefore(_previewImgEl, swatch);
      }
      window.k10.onAmbientPreviewFrame((dataUrl) => {
        if (_previewImgEl && dataUrl) {
          _previewImgEl.src = dataUrl;
          _previewImgEl.style.display = 'block';
        }
      });
    }

    // Update color swatch at ~15fps
    _previewInterval = setInterval(updatePreview, 66);
    updatePreview(); // immediate first frame

    // Tell main process to bump capture rate + send thumbnails
    if (window.k10 && window.k10.ambientPreviewStart) {
      window.k10.ambientPreviewStart();
    }
  };

  window.stopAmbientPreview = function() {
    if (_previewInterval) {
      clearInterval(_previewInterval);
      _previewInterval = null;
    }
    // Hide thumbnail
    if (_previewImgEl) _previewImgEl.style.display = 'none';
    hideSavedRect();
    if (window.k10 && window.k10.ambientPreviewStop) {
      window.k10.ambientPreviewStop();
    }
  };

  function updatePreview() {
    const swatch = document.getElementById('ambientPreviewSwatch');
    const info = document.getElementById('ambientPreviewInfo');
    if (!swatch && !info) return;

    // Get ambient color state
    const state = (typeof window.getAmbientColor === 'function')
      ? window.getAmbientColor()
      : { r: 0, g: 0, b: 0, tr: 0, tg: 0, tb: 0, enabled: false, hasData: false, polled: false };

    // Use target color (immediate, not lerped) so preview reacts fast
    const cr = state.tr !== undefined ? state.tr : state.r;
    const cg = state.tg !== undefined ? state.tg : state.g;
    const cb = state.tb !== undefined ? state.tb : state.b;
    const r8 = Math.round(cr * 255);
    const g8 = Math.round(cg * 255);
    const b8 = Math.round(cb * 255);

    // Color swatch — just set the background color
    if (swatch) {
      swatch.style.background = `rgb(${r8}, ${g8}, ${b8})`;
    }

    // Info text
    if (info) {
      let source;
      if (!state.enabled) source = 'OFF';
      else if (state.hasData && !state.polled) source = 'Screen Capture';
      else if (state.polled) source = 'Flag State';
      else source = 'No region set';

      const rect = _captureRect
        ? `Region: ${Math.round(_captureRect.w * 100)}% × ${Math.round(_captureRect.h * 100)}%`
        : 'Draw a region to start';

      info.textContent = `RGB(${r8}, ${g8}, ${b8}) — ${source} — ${rect}`;
    }
  }

  // ═════════════════════════════════════════════
  //  SAVED RECT VISUALIZATION
  //  When settings open, show where the capture
  //  rect is positioned as a dashed outline.
  // ═════════════════════════════════════════════

  let _savedRectDiv = null;

  function showSavedRect() {
    // Load from settings if we don't have one in memory
    if (!_captureRect && window._settings && window._settings.ambientCaptureRect) {
      _captureRect = window._settings.ambientCaptureRect;
    }
    if (!_captureRect) return;

    if (!_savedRectDiv) {
      _savedRectDiv = document.createElement('div');
      _savedRectDiv.id = 'savedCaptureRect';
      _savedRectDiv.style.cssText =
        'position:fixed;z-index:9999;pointer-events:none;' +
        'border:2px dashed hsla(45,100%,60%,0.6);' +
        'background:hsla(45,100%,60%,0.05);' +
        'border-radius:3px;' +
        'box-shadow:0 0 8px hsla(45,100%,60%,0.2);';
      document.body.appendChild(_savedRectDiv);
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    _savedRectDiv.style.left   = Math.round(_captureRect.x * vw) + 'px';
    _savedRectDiv.style.top    = Math.round(_captureRect.y * vh) + 'px';
    _savedRectDiv.style.width  = Math.round(_captureRect.w * vw) + 'px';
    _savedRectDiv.style.height = Math.round(_captureRect.h * vh) + 'px';
    _savedRectDiv.style.display = 'block';
  }

  function hideSavedRect() {
    if (_savedRectDiv) _savedRectDiv.style.display = 'none';
  }

  // ── Restore saved capture rect on load ──
  window.restoreAmbientCapture = function() {
    if (window._settings && window._settings.ambientCaptureRect) {
      _captureRect = window._settings.ambientCaptureRect;
      if (window.k10 && window.k10.ambientSetRect) {
        window.k10.ambientSetRect(_captureRect);
      }
      console.log('[AmbientCapture] Restored saved region:', _captureRect);
    }
  };

  window.stopAmbientCapture = function() {
    // Nothing to stop — Electron main process handles capture lifecycle
  };

})();
