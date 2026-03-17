// @ts-nocheck
/**
 * webgl.ts — WebGL FX engine (tachometer bloom, pedal glow, flag effects, leaderboard glow, etc.)
 * Converted from webgl.js — IIFE wrapped, exposes public API via window globals.
 *
 * Public API (registered on window at init time):
 *   window.updateGLFX(rpmRatio, thr, brk, clt)  — called each poll frame
 *   window.setFlagGLColors(flagType)             — called when flag state changes
 *   window.setGridFlagGL(active)                 — grid module active state
 *   window.setGridFlagColors(hex1, hex2, hex3)   — country flag colors
 *   window.setSpotterGlow(type)                  — spotter severity glow
 *   window.setCommentaryTrailGL(active, hue)     — commentary trail glow
 *   window.triggerLBEvent(type)                  — leaderboard event animation
 *   window.setLBHighlightMode(mode)              — player highlight color mode
 */

import { state } from '../state'

// Make state.settings available as the legacy _settings global that webgl.js reads
;(window as any)._settings = state.settings;

// WebGL FX ENGINE

  // ═══════════════════════════════════════════════════════════════
  //  WebGL FX ENGINE — Tachometer + Pedal Histograms
  // ═══════════════════════════════════════════════════════════════
  ;(function initWebGLFX() {
    'use strict';

    /* ── GL helpers ── */
    function createShader(gl, type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('Shader compile:', gl.getShaderInfoLog(s));
        gl.deleteShader(s); return null;
      }
      return s;
    }
    function createProgram(gl, vs, fs) {
      const p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.warn('Program link:', gl.getProgramInfoLog(p));
        return null;
      }
      return p;
    }
    function initGL(canvasId) {
      const c = document.getElementById(canvasId);
      if (!c) return null;
      const gl = c.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true });
      if (!gl) { console.warn('WebGL2 not available for', canvasId); return null; }
      return { canvas: c, gl };
    }
    function resizeCanvas(canvas, gl) {
      const r = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(r.width * dpr);
      const h = Math.round(r.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    /* ════════════════════════════════════════════
       TACHOMETER FX — bloom, heat distortion
       ════════════════════════════════════════════ */
    const tachoCtx = initGL('tachoGlCanvas');
    let _tachoRpm = 0;  // updated from main loop
    let _tachoTime = 0;

    if (tachoCtx) {
      const { canvas: tC, gl: tGL } = tachoCtx;

      // Full-screen quad vertex shader
      const quadVS = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
          vUV = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      // Tachometer fragment shader — bloom glow + heat distortion
      // uDPR compensates for HiDPI/Retina displays where the same UV-space
      // effect is spread over 2-4× more physical pixels, making glow appear dimmer.
      const tachoFS = `#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;

        uniform float uRpm;       // 0.0 - 1.0
        uniform float uTime;
        uniform vec2  uRes;
        uniform float uDPR;       // devicePixelRatio (1.0 on 1× screens, 2.0 on Retina)

        // Color zones: green < 0.55, yellow < 0.73, red < 0.91, redline >= 0.91
        vec3 rpmColor(float r) {
          if (r < 0.55) return vec3(0.18, 0.82, 0.34);  // green
          if (r < 0.73) return vec3(0.95, 0.75, 0.15);  // amber
          return vec3(0.92, 0.22, 0.20);                 // red
        }

        // Smooth noise for heat distortion
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                     mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }

        void main() {
          vec2 uv = vUV;
          // Scale glow spread so it looks the same on 1× and 2× screens
          float dprScale = max(uDPR, 1.0);
          float dpr2 = dprScale * dprScale;  // quadratic — compensates for HiDPI area scaling

          // Heat distortion — only active at high RPM
          float heatIntensity = smoothstep(0.75, 0.95, uRpm) * 0.6 * dpr2;
          if (heatIntensity > 0.0) {
            float n1 = noise(uv * 8.0 + uTime * 3.0) * 2.0 - 1.0;
            float n2 = noise(uv * 6.0 - uTime * 2.5 + 50.0) * 2.0 - 1.0;
            uv += vec2(n1, n2) * heatIntensity * 0.012;
          }

          // Bloom glow — bar region is roughly bottom 35% of the block
          float barTop = 0.35;  // bars live in bottom portion
          float barY = smoothstep(0.0, barTop, uv.y);
          float inBar = 1.0 - barY;

          // Horizontal fill: how far the RPM lights extend
          float fillX = uRpm;
          float xDist = max(0.0, uv.x - fillX);
          // Softer falloff on HiDPI so bloom covers equivalent visual area
          float glowFalloff = exp(-xDist * (6.0 / dpr2)) * inBar;

          // Color based on the edge of the lit region
          vec3 col = rpmColor(uRpm);

          // Pulsing intensity at redline
          float pulse = 1.0;
          if (uRpm >= 0.91) {
            pulse = 0.85 + 0.15 * sin(uTime * 18.0);
          }

          // Bloom: soft glow radiating from lit segments — boosted on HiDPI
          float bloom = glowFalloff * uRpm * 1.2 * dpr2 * pulse;

          // Upward glow bleed above the bars
          float aboveBar = smoothstep(barTop, barTop + 0.3 * dpr2, uv.y);
          float upGlow = aboveBar * exp(-abs(uv.x - fillX * 0.5) * (3.0 / dpr2)) * uRpm * 0.35 * dpr2 * pulse;

          // Edge highlight along the top of lit region
          float edgeGlow = exp(-abs(uv.y - barTop) * (25.0 / dpr2)) * smoothstep(0.0, fillX, uv.x) * uRpm * 0.5 * dpr2;

          float alpha = bloom + upGlow + edgeGlow;
          vec3 final = col * alpha;

          // ── Redline full-block flash strobe ──
          if (uRpm >= 0.91) {
            float redStr = smoothstep(0.91, 0.96, uRpm);
            // Hard strobe
            float flash = pow(0.5 + 0.5 * sin(uTime * 22.0), 4.0);
            // Secondary faster flicker
            float flicker = 0.8 + 0.2 * sin(uTime * 55.0 + uv.x * 12.0);
            // Gentle vignette — even glow with soft falloff at edges
            float vig = 1.0 - 0.2 * length((uv - 0.5) * vec2(0.8, 1.4));
            float flashA = flash * flicker * redStr * vig * 0.5 * dpr2;
            vec3 flashCol = vec3(0.95, 0.08, 0.03);
            final += flashCol * flashA;
            alpha += flashA;
            // Scanline overlay for CRT intensity
            float scan = 0.88 + 0.12 * sin(uv.y * uRes.y * 0.4 + uTime * 45.0);
            final *= scan;
            alpha *= scan;
          }

          float maxAlpha = dprScale > 1.1 ? 0.95 : 0.85;
          alpha = clamp(alpha, 0.0, maxAlpha);
          fragColor = vec4(final * alpha, alpha);
        }`;

      const vs = createShader(tGL, tGL.VERTEX_SHADER, quadVS);
      const fs = createShader(tGL, tGL.FRAGMENT_SHADER, tachoFS);
      const prog = createProgram(tGL, vs, fs);

      if (prog) {
        const aPos = tGL.getAttribLocation(prog, 'aPos');
        const uRpm = tGL.getUniformLocation(prog, 'uRpm');
        const uTime = tGL.getUniformLocation(prog, 'uTime');
        const uRes = tGL.getUniformLocation(prog, 'uRes');
        const uDPR = tGL.getUniformLocation(prog, 'uDPR');

        // Fullscreen quad
        const buf = tGL.createBuffer();
        tGL.bindBuffer(tGL.ARRAY_BUFFER, buf);
        tGL.bufferData(tGL.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), tGL.STATIC_DRAW);

        tGL.enable(tGL.BLEND);
        tGL.blendFunc(tGL.ONE, tGL.ONE_MINUS_SRC_ALPHA);

        window._tachoFXFrame = function(dt) {
          resizeCanvas(tC, tGL);
          _tachoTime += dt;

          tGL.clearColor(0, 0, 0, 0);
          tGL.clear(tGL.COLOR_BUFFER_BIT);

          // ── Main bloom/distortion pass ──
          tGL.useProgram(prog);
          tGL.bindBuffer(tGL.ARRAY_BUFFER, buf);
          tGL.enableVertexAttribArray(aPos);
          tGL.vertexAttribPointer(aPos, 2, tGL.FLOAT, false, 0, 0);
          tGL.uniform1f(uRpm, _tachoRpm);
          tGL.uniform1f(uTime, _tachoTime);
          tGL.uniform2f(uRes, tC.width, tC.height);
          tGL.uniform1f(uDPR, window.devicePixelRatio || 1.0);
          tGL.drawArrays(tGL.TRIANGLE_STRIP, 0, 4);
        };
      }
    }

    /* ════════════════════════════════════════════
       PEDAL HISTOGRAM FX — additive glow + energy
       ════════════════════════════════════════════ */
    const pedalsCtx = initGL('pedalsGlCanvas');
    let _pedalValues = { thr: 0, brk: 0, clt: 0 };
    let _pedalTime = 0;

    if (pedalsCtx) {
      const { canvas: pC, gl: pGL } = pedalsCtx;

      const quadVS = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
          vUV = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      const pedalsFS = `#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;

        uniform float uThr;
        uniform float uBrk;
        uniform float uClt;
        uniform float uTime;
        uniform vec2  uRes;
        uniform float uDPR;       // devicePixelRatio compensation

        float pulse(float t, float speed, float base) {
          return base + (1.0 - base) * (0.5 + 0.5 * sin(t * speed * 0.6));
        }

        void main() {
          vec2 uv = vUV;
          vec3 col = vec3(0.0);
          float alpha = 0.0;
          float dprScale = max(uDPR, 1.0);
          float dpr2 = dprScale * dprScale;

          // Edge-only glow — light hugs the panel borders, center stays clear
          float rightEdge  = exp(-(1.0 - uv.x) * (16.0 / dpr2));
          float leftEdge   = exp(-uv.x * (16.0 / dpr2));
          float bottomEdge = exp(-uv.y * (14.0 / dpr2));
          float topEdge    = exp(-(1.0 - uv.y) * (20.0 / dpr2));

          // Throttle — right edge + bottom glow (neon green, mirrors brake on left)
          if (uThr > 0.01) {
            float p = pulse(uTime, 4.0 + uThr * 2.0, 0.88);
            float edge = rightEdge + bottomEdge * 0.6 + topEdge * 0.2;
            float glow = edge * uThr * p;
            col += vec3(0.20, 1.0, 0.05) * glow * 0.9 * dpr2;
            alpha += glow * 0.4 * dpr2;
          }

          // Brake — left edge glow (red)
          if (uBrk > 0.01) {
            float p = pulse(uTime, 3.5 + uBrk * 2.5, 0.88);
            float edge = leftEdge + bottomEdge * 0.25 + topEdge * 0.15;
            float glow = edge * uBrk * p;
            col += vec3(0.92, 0.22, 0.20) * glow * 0.35 * dpr2;
            alpha += glow * 0.12 * dpr2;
          }

          // Clutch — right edge glow (shares side with throttle)
          if (uClt > 0.01) {
            float p = pulse(uTime, 3.5 + uClt * 2.0, 0.92);
            float edge = rightEdge * 0.6 + bottomEdge * 0.25;
            float glow = edge * uClt * p;
            col += vec3(0.25, 0.50, 0.92) * glow * 0.14 * dpr2;
            alpha += glow * 0.05 * dpr2;
          }

          float maxAlpha = dprScale > 1.1 ? 0.75 : 0.65;
          alpha = clamp(alpha, 0.0, maxAlpha);
          fragColor = vec4(col * alpha, alpha);
        }`;

      const vs = createShader(pGL, pGL.VERTEX_SHADER, quadVS);
      const fs = createShader(pGL, pGL.FRAGMENT_SHADER, pedalsFS);
      const prog = createProgram(pGL, vs, fs);

      if (prog) {
        const aPos = pGL.getAttribLocation(prog, 'aPos');
        const uThr  = pGL.getUniformLocation(prog, 'uThr');
        const uBrk  = pGL.getUniformLocation(prog, 'uBrk');
        const uClt  = pGL.getUniformLocation(prog, 'uClt');
        const uTime = pGL.getUniformLocation(prog, 'uTime');
        const uRes  = pGL.getUniformLocation(prog, 'uRes');
        const uDPR  = pGL.getUniformLocation(prog, 'uDPR');

        const buf = pGL.createBuffer();
        pGL.bindBuffer(pGL.ARRAY_BUFFER, buf);
        pGL.bufferData(pGL.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), pGL.STATIC_DRAW);

        pGL.enable(pGL.BLEND);
        pGL.blendFunc(pGL.ONE, pGL.ONE_MINUS_SRC_ALPHA);

        window._pedalsFXFrame = function(dt) {
          resizeCanvas(pC, pGL);
          _pedalTime += dt;

          pGL.clearColor(0, 0, 0, 0);
          pGL.clear(pGL.COLOR_BUFFER_BIT);

          pGL.useProgram(prog);
          pGL.bindBuffer(pGL.ARRAY_BUFFER, buf);
          pGL.enableVertexAttribArray(aPos);
          pGL.vertexAttribPointer(aPos, 2, pGL.FLOAT, false, 0, 0);

          pGL.uniform1f(uThr, _pedalValues.thr);
          pGL.uniform1f(uBrk, _pedalValues.brk);
          pGL.uniform1f(uClt, _pedalValues.clt);
          pGL.uniform1f(uTime, _pedalTime);
          pGL.uniform2f(uRes, pC.width, pC.height);
          pGL.uniform1f(uDPR, window.devicePixelRatio || 1.0);

          pGL.drawArrays(pGL.TRIANGLE_STRIP, 0, 4);
        };
      }
    }

    /* ════════════════════════════════════════════
       FLAG ICON FX — waving flag with cloth shading
       ════════════════════════════════════════════ */
    const flagCtx = initGL('flagGlCanvas');
    let _flagTime = 0;
    let _flagColors = { c1: [1,0.85,0.15], c2: [1,1,0.95], pattern: 0.0 };
    let _flagVisible = false;

    if (flagCtx) {
      const { canvas: fC, gl: fGL } = flagCtx;

      const quadVS = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
          vUV = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      const flagFS = `#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;

        uniform float uTime;
        uniform vec3  uColor1;
        uniform vec3  uColor2;
        uniform float uPattern;  // 0=solid, 1=horiz stripes, 2=checkered, 3=diagonal, 4=circles
        uniform vec2  uRes;      // canvas pixel size for aspect correction

        void main() {
          vec2 uv = vUV;
          float aspect = uRes.x / max(uRes.y, 1.0);

          // Full-background waving cloth — fills entire box
          float fx = uv.x;
          float fy = uv.y;

          // Wave displacement — increases from left to right (cloth physics)
          float amp = fx * fx * 0.12;
          float w1 = sin(fx * 12.0 - uTime * 5.0) * amp;
          float w2 = sin(fx * 18.0 - uTime * 3.5 + 2.0) * amp * 0.35;
          float wave = w1 + w2;

          // Distort vertical coordinate for cloth wave
          float fy2 = fy + wave * 0.6;

          // ── Cloth shading — light on peaks, dark in valleys ──
          float dWave = cos(fx * 12.0 - uTime * 5.0);
          float shade = 0.80 + 0.20 * dWave * fx;

          // ── Pattern coloring ──
          vec3 col;
          if (uPattern < 0.5) {
            // Solid
            col = uColor1;
          } else if (uPattern < 1.5) {
            // Horizontal stripes — doubled count
            float bandCount = max(4.0, floor(aspect * 1.2));
            float band = step(0.5, fract(fy2 * bandCount));
            col = mix(uColor1, uColor2, band);
          } else if (uPattern < 2.5) {
            // Checkered — doubled cells
            float cellsX = max(8.0, floor(aspect * 4.0));
            float cellsY = 4.0;
            float cx = step(0.5, fract(fx * cellsX + wave * 0.5));
            float cy = step(0.5, fract(fy2 * cellsY));
            col = mix(uColor1, uColor2, abs(cx - cy));
          } else if (uPattern < 3.5) {
            // Diagonal stripes — doubled, with wave distortion
            float diag = step(0.5, fract((fx * aspect + fy2 * 3.0) * 1.6));
            col = mix(uColor1, uColor2, diag);
          } else {
            // Circles (meatball flag) — red circles on black background
            float cellsX = max(6.0, floor(aspect * 3.0));
            float cellsY = 3.0;
            float cx = fract(fx * cellsX + wave * 0.3);
            float cy = fract(fy2 * cellsY);
            float d = length(vec2(cx - 0.5, cy - 0.5));
            float circle = 1.0 - smoothstep(0.28, 0.34, d);
            col = mix(uColor2, uColor1, circle);
          }

          col *= shade;

          // Flag cloth alpha — tripled for high visibility
          float alpha = 0.48;

          // Brightness variation from the wave folds
          alpha *= (0.85 + 0.30 * abs(dWave) * fx);

          fragColor = vec4(col * alpha, alpha);
        }`;

      const vs = createShader(fGL, fGL.VERTEX_SHADER, quadVS);
      const fs = createShader(fGL, fGL.FRAGMENT_SHADER, flagFS);
      const prog = createProgram(fGL, vs, fs);

      if (prog) {
        const aPos    = fGL.getAttribLocation(prog, 'aPos');
        const uTime   = fGL.getUniformLocation(prog, 'uTime');
        const uColor1 = fGL.getUniformLocation(prog, 'uColor1');
        const uColor2 = fGL.getUniformLocation(prog, 'uColor2');
        const uPat    = fGL.getUniformLocation(prog, 'uPattern');
        const uRes    = fGL.getUniformLocation(prog, 'uRes');

        const buf = fGL.createBuffer();
        fGL.bindBuffer(fGL.ARRAY_BUFFER, buf);
        fGL.bufferData(fGL.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), fGL.STATIC_DRAW);

        fGL.enable(fGL.BLEND);
        fGL.blendFunc(fGL.ONE, fGL.ONE_MINUS_SRC_ALPHA);

        window._flagFXFrame = function(dt) {
          if (!_flagVisible) return;
          resizeCanvas(fC, fGL);
          _flagTime += dt;

          fGL.clearColor(0, 0, 0, 0);
          fGL.clear(fGL.COLOR_BUFFER_BIT);

          fGL.useProgram(prog);
          fGL.bindBuffer(fGL.ARRAY_BUFFER, buf);
          fGL.enableVertexAttribArray(aPos);
          fGL.vertexAttribPointer(aPos, 2, fGL.FLOAT, false, 0, 0);

          fGL.uniform1f(uTime, _flagTime);
          fGL.uniform3fv(uColor1, _flagColors.c1);
          fGL.uniform3fv(uColor2, _flagColors.c2);
          fGL.uniform1f(uPat, _flagColors.pattern);
          fGL.uniform2f(uRes, fC.width, fC.height);

          fGL.drawArrays(fGL.TRIANGLE_STRIP, 0, 4);
        };
      }
    }

    // Flag color definitions per flag type
    window._FLAG_GL_COLORS = {
      yellow:    { c1: [1.0, 0.85, 0.12], c2: [1.0, 1.0, 0.92],  pattern: 0.0 },
      red:       { c1: [0.90, 0.14, 0.12], c2: [0.50, 0.06, 0.06], pattern: 0.0 },
      blue:      { c1: [0.20, 0.45, 0.92], c2: [0.08, 0.20, 0.55], pattern: 3.0 },
      green:     { c1: [0.20, 0.72, 0.28], c2: [0.10, 0.42, 0.16], pattern: 0.0 },
      white:     { c1: [0.95, 0.95, 0.95], c2: [0.72, 0.72, 0.72], pattern: 0.0 },
      debris:    { c1: [1.0, 0.85, 0.12], c2: [0.90, 0.18, 0.12], pattern: 3.0 },
      checkered: { c1: [0.95, 0.95, 0.95], c2: [0.06, 0.06, 0.06], pattern: 2.0 },
      black:     { c1: [0.06, 0.06, 0.06], c2: [0.80, 0.12, 0.08], pattern: 1.0 },
      meatball:  { c1: [0.85, 0.12, 0.10], c2: [0.06, 0.06, 0.06], pattern: 4.0 }, // red circles on black
      orange:    { c1: [1.0, 0.60, 0.08], c2: [0.90, 0.35, 0.05], pattern: 0.0 }   // solid orange
    };

    window.setFlagGLColors = function(flagType) {
      const def = window._FLAG_GL_COLORS[flagType];
      if (def) {
        _flagColors.c1 = def.c1;
        _flagColors.c2 = def.c2;
        _flagColors.pattern = def.pattern;
        _flagVisible = true;
      } else {
        _flagVisible = false;
      }
    };

    /* ════════════════════════════════════════════
       LEADERBOARD PLAYER HIGHLIGHT — shimmer/glow
       ════════════════════════════════════════════ */
    const lbCtx = initGL('lbPlayerGlCanvas');
    let _lbTime = 0;
    let _lbPlayerTop = 0;     // 0-1 normalized
    let _lbPlayerBottom = 1;   // 0-1 normalized
    let _lbHasPlayer = false;
    // Highlight mode: 0=blue(same), 1=green(ahead), 2=red(behind), 3=gold(P1)
    let _lbHighlightMode = 0;

    if (lbCtx) {
      const { canvas: lC, gl: lGL } = lbCtx;

      const quadVS = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
          vUV = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      const lbFS = `#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;

        uniform float uTime;
        uniform float uPlayerTop;    // normalized y of player row top
        uniform float uPlayerBot;    // normalized y of player row bottom
        uniform float uMode;         // 0=blue, 1=green, 2=red, 3=gold(P1)
        uniform vec2  uRes;

        // Pseudo-random for P1 sparkles
        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        void main() {
          vec2 uv = vUV;
          float y = 1.0 - uv.y;

          if (y < uPlayerTop || y > uPlayerBot) {
            fragColor = vec4(0.0);
            return;
          }

          float ly = (y - uPlayerTop) / max(uPlayerBot - uPlayerTop, 0.001);
          float lx = uv.x;

          // ── Color selection by mode ──
          // 0=blue(same), 1=green(ahead), 2=red(behind), 3=gold(P1)
          vec3 baseColor;
          vec3 brightColor;
          if (uMode < 0.5) {
            baseColor  = vec3(0.25, 0.45, 0.80);   // blue
            brightColor = vec3(0.40, 0.60, 0.95);
          } else if (uMode < 1.5) {
            baseColor  = vec3(0.15, 0.70, 0.40);   // green
            brightColor = vec3(0.25, 0.85, 0.55);
          } else if (uMode < 2.5) {
            baseColor  = vec3(0.80, 0.20, 0.15);   // red
            brightColor = vec3(0.95, 0.35, 0.25);
          } else {
            baseColor  = vec3(0.76, 0.60, 0.22);   // deep gold
            brightColor = vec3(1.0, 0.88, 0.55);    // bright gold
          }

          // ── Effect 1: Shimmer sweep ──
          float sweepSpeed = 0.25;
          float sweepX = fract(uTime * sweepSpeed);
          float beamW = 0.08;
          float beam = exp(-pow((lx - sweepX) / beamW, 2.0)) * 0.55;
          float trail = exp(-max(0.0, lx - sweepX + 0.1) * 4.0) * 0.08
                      * step(sweepX - 0.3, lx);
          float effect1 = beam + trail;

          // ── Effect 2: Edge breathing glow ──
          float edgeY = min(ly, 1.0 - ly);
          float edgeGlow = exp(-edgeY * 10.0) * 0.35;
          float leftGlow = exp(-lx * 6.0) * 0.45;
          float pulse = 0.55 + 0.45 * sin(uTime * 1.8);
          float effect2 = (edgeGlow + leftGlow) * pulse;

          // ── Crossfade between effects (~8s per full cycle) ──
          float blend = 0.5 + 0.5 * sin(uTime * 0.4);
          float effect = mix(effect1, effect2, blend);

          float rowEdge = smoothstep(0.0, 0.15, ly) * smoothstep(1.0, 0.85, ly);
          effect *= rowEdge;

          float alpha = clamp(effect * 0.55, 0.0, 0.5);
          vec3 col = baseColor;

          // ── P1 sparkle overlay (very sparse) ──
          if (uMode > 2.5) {
            float beamBright = exp(-pow((lx - sweepX) / beamW, 2.0)) * 0.15 * rowEdge;
            col = mix(baseColor, brightColor, beamBright * 2.0 + 0.3);

            float gridScale = 24.0;
            vec2 gridCell = floor(vec2(lx, ly) * gridScale);
            float cellRand = hash21(gridCell);
            if (cellRand > 0.94) {
              vec2 cellUV = fract(vec2(lx, ly) * gridScale);
              float sparklePhase = cellRand * 6.28 + uTime * (2.5 + cellRand * 2.0);
              float blink = pow(max(0.0, sin(sparklePhase)), 28.0);
              float dist = length(cellUV - 0.5);
              float point = exp(-dist * dist * 50.0);
              float sparkle = blink * point * rowEdge * 0.5;
              col += vec3(1.0, 0.97, 0.85) * sparkle;
              alpha += sparkle;
            }
          }

          alpha = clamp(alpha, 0.0, 0.55);
          fragColor = vec4(col * alpha, alpha);
        }`;

      const vs = createShader(lGL, lGL.VERTEX_SHADER, quadVS);
      const fs = createShader(lGL, lGL.FRAGMENT_SHADER, lbFS);
      const prog = createProgram(lGL, vs, fs);

      if (prog) {
        const aPos       = lGL.getAttribLocation(prog, 'aPos');
        const uTime      = lGL.getUniformLocation(prog, 'uTime');
        const uPlayerTop = lGL.getUniformLocation(prog, 'uPlayerTop');
        const uPlayerBot = lGL.getUniformLocation(prog, 'uPlayerBot');
        const uMode      = lGL.getUniformLocation(prog, 'uMode');
        const uRes       = lGL.getUniformLocation(prog, 'uRes');

        const buf = lGL.createBuffer();
        lGL.bindBuffer(lGL.ARRAY_BUFFER, buf);
        lGL.bufferData(lGL.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), lGL.STATIC_DRAW);

        lGL.enable(lGL.BLEND);
        lGL.blendFunc(lGL.ONE, lGL.ONE_MINUS_SRC_ALPHA);

        window._lbFXFrame = function(dt) {
          if (!_lbHasPlayer) return;
          resizeCanvas(lC, lGL);
          _lbTime += dt;

          lGL.clearColor(0, 0, 0, 0);
          lGL.clear(lGL.COLOR_BUFFER_BIT);

          lGL.useProgram(prog);
          lGL.bindBuffer(lGL.ARRAY_BUFFER, buf);
          lGL.enableVertexAttribArray(aPos);
          lGL.vertexAttribPointer(aPos, 2, lGL.FLOAT, false, 0, 0);

          lGL.uniform1f(uTime, _lbTime);
          lGL.uniform1f(uPlayerTop, _lbPlayerTop);
          lGL.uniform1f(uPlayerBot, _lbPlayerBottom);
          lGL.uniform1f(uMode, _lbHighlightMode);
          lGL.uniform2f(uRes, lC.width, lC.height);

          lGL.drawArrays(lGL.TRIANGLE_STRIP, 0, 4);
        };
      }
    }

    // Update leaderboard player row position for WebGL highlight
    window.updateLBPlayerPos = function() {
      const inner = document.querySelector('.lb-inner');
      const playerRow = document.querySelector('.lb-row.lb-player');
      if (!inner || !playerRow) {
        _lbHasPlayer = false;
        return;
      }
      const ir = inner.getBoundingClientRect();
      const pr = playerRow.getBoundingClientRect();
      if (ir.height < 1) { _lbHasPlayer = false; return; }
      _lbPlayerTop = (pr.top - ir.top) / ir.height;
      _lbPlayerBottom = (pr.bottom - ir.top) / ir.height;
      _lbHasPlayer = true;
    };

    // Update highlight mode: 0=blue(same), 1=green(ahead), 2=red(behind), 3=gold(P1)
    window.setLBHighlightMode = function(mode) { _lbHighlightMode = mode; };

    /* ════════════════════════════════════════════
       K10 LOGO BACKGROUND — ultra-subtle chevron drift
       SDF-based chevron shapes from the K10 logomark,
       barely perceptible at 3-4% opacity, drifting so slowly
       you only notice after 4-5 minutes of watching.
       ════════════════════════════════════════════ */
    const k10LogoCtx = initGL('k10LogoGlCanvas');
    let _k10LogoTime = 0;

    if (k10LogoCtx) {
      const { canvas: kC, gl: kGL } = k10LogoCtx;

      const quadVS = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
          vUV = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      const k10FS = `#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;
        uniform float uTime;
        uniform vec2  uRes;

        // Rotate 2D point
        vec2 rot(vec2 p, float a) {
          float c = cos(a), s = sin(a);
          return vec2(p.x*c - p.y*s, p.x*s + p.y*c);
        }

        // SDF for a single chevron (two angled bars forming a > shape)
        // Centered at origin, pointing right, with arm length and thickness
        float sdChevron(vec2 p, float armLen, float thick, float angle) {
          // Mirror across x-axis for the two arms
          vec2 q = vec2(p.x, abs(p.y));
          // Rotate the arm direction
          vec2 dir = vec2(cos(angle), sin(angle));
          // Project onto arm line
          float t = clamp(dot(q, dir), 0.0, armLen);
          vec2 closest = dir * t;
          return length(q - closest) - thick;
        }

        // Smoother chevron using box-like approach
        float sdChevronV(vec2 p, float size, float thick) {
          vec2 q = vec2(p.x, abs(p.y));
          // V-shape: line from (0, size) to (size*0.6, 0)
          vec2 a = vec2(0.0, size);
          vec2 b = vec2(size * 0.7, 0.0);
          vec2 ab = b - a;
          vec2 aq = q - a;
          float t = clamp(dot(aq, ab) / dot(ab, ab), 0.0, 1.0);
          vec2 closest = a + ab * t;
          return length(q - closest) - thick;
        }

        void main() {
          vec2 uv = vUV;
          float aspect = uRes.x / uRes.y;
          vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

          float t = uTime;

          // Three chevrons that drift independently at glacial speeds
          // Each has its own phase, position offset, scale, and slight rotation

          float totalAlpha = 0.0;
          vec3 totalColor = vec3(0.0);

          // Chevron 1 — leftmost, lighter red
          {
            // Drift: very slow circular path + slight horizontal oscillation
            vec2 offset = vec2(
              sin(t * 0.008 + 0.0) * 0.12 + cos(t * 0.003) * 0.05,
              cos(t * 0.006 + 1.0) * 0.08 + sin(t * 0.004) * 0.03
            );
            float scale = 0.38 + sin(t * 0.005 + 2.0) * 0.03;
            float angle = sin(t * 0.004) * 0.06;
            vec2 cp = rot(p - vec2(-0.15, 0.0) - offset, angle) / scale;
            float d = sdChevronV(cp, 0.5, 0.06);
            float shape = 1.0 - smoothstep(-0.01, 0.03, d);
            float breath = 0.5 + 0.5 * sin(t * 0.012 + 0.0);
            float a = shape * breath * 0.035;
            totalColor += vec3(0.85, 0.30, 0.25) * a;
            totalAlpha += a;
          }

          // Chevron 2 — middle, medium red
          {
            vec2 offset = vec2(
              cos(t * 0.007 + 2.0) * 0.10 + sin(t * 0.0035) * 0.04,
              sin(t * 0.009 + 0.5) * 0.10 + cos(t * 0.005) * 0.03
            );
            float scale = 0.42 + cos(t * 0.006 + 1.0) * 0.025;
            float angle = cos(t * 0.005 + 1.0) * 0.05;
            vec2 cp = rot(p - vec2(0.0, 0.0) - offset, angle) / scale;
            float d = sdChevronV(cp, 0.5, 0.06);
            float shape = 1.0 - smoothstep(-0.01, 0.03, d);
            float breath = 0.5 + 0.5 * sin(t * 0.010 + 2.1);
            float a = shape * breath * 0.035;
            totalColor += vec3(0.75, 0.22, 0.20) * a;
            totalAlpha += a;
          }

          // Chevron 3 — rightmost, dark maroon/wine
          {
            vec2 offset = vec2(
              sin(t * 0.006 + 4.0) * 0.11 + cos(t * 0.004) * 0.05,
              cos(t * 0.008 + 3.0) * 0.09 + sin(t * 0.003) * 0.04
            );
            float scale = 0.35 + sin(t * 0.007 + 3.5) * 0.03;
            float angle = sin(t * 0.003 + 2.0) * 0.07;
            vec2 cp = rot(p - vec2(0.12, 0.0) - offset, angle) / scale;
            float d = sdChevronV(cp, 0.5, 0.06);
            float shape = 1.0 - smoothstep(-0.01, 0.03, d);
            float breath = 0.5 + 0.5 * sin(t * 0.014 + 4.2);
            float a = shape * breath * 0.035;
            totalColor += vec3(0.55, 0.12, 0.15) * a;
            totalAlpha += a;
          }

          // Very subtle edge vignette to keep it contained
          float vig = smoothstep(0.0, 0.15, min(uv.x, min(uv.y, min(1.0-uv.x, 1.0-uv.y))));
          totalAlpha *= vig;
          totalColor *= vig;

          totalAlpha = clamp(totalAlpha, 0.0, 0.06);
          fragColor = vec4(totalColor, totalAlpha);
        }`;

      const vs = createShader(kGL, kGL.VERTEX_SHADER, quadVS);
      const fs = createShader(kGL, kGL.FRAGMENT_SHADER, k10FS);
      const prog = createProgram(kGL, vs, fs);

      if (prog) {
        const aPos  = kGL.getAttribLocation(prog, 'aPos');
        const uTime = kGL.getUniformLocation(prog, 'uTime');
        const uRes  = kGL.getUniformLocation(prog, 'uRes');

        const buf = kGL.createBuffer();
        kGL.bindBuffer(kGL.ARRAY_BUFFER, buf);
        kGL.bufferData(kGL.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), kGL.STATIC_DRAW);

        kGL.enable(kGL.BLEND);
        kGL.blendFunc(kGL.ONE, kGL.ONE_MINUS_SRC_ALPHA);

        window._k10LogoFXFrame = function(dt) {
          resizeCanvas(kC, kGL);
          _k10LogoTime += dt;

          kGL.clearColor(0, 0, 0, 0);
          kGL.clear(kGL.COLOR_BUFFER_BIT);

          kGL.useProgram(prog);
          kGL.bindBuffer(kGL.ARRAY_BUFFER, buf);
          kGL.enableVertexAttribArray(aPos);
          kGL.vertexAttribPointer(aPos, 2, kGL.FLOAT, false, 0, 0);

          kGL.uniform1f(uTime, _k10LogoTime);
          kGL.uniform2f(uRes, kC.width, kC.height);

          kGL.drawArrays(kGL.TRIANGLE_STRIP, 0, 4);
        };
      }
    }

    /* ════════════════════════════════════════════
       LEADERBOARD EVENT OVERLAY — position change / race start / finish
       Subtle full-panel flash effects, lower intensity than flag animations
       ════════════════════════════════════════════ */
    const lbEvtCtx = initGL('lbEventGlCanvas');
    let _lbEvtTime = 0;
    let _lbEvtActive = false;
    let _lbEvtColor = [0.0, 0.8, 0.3]; // green default
    let _lbEvtDuration = 1.2;           // seconds
    let _lbEvtElapsed = 99;             // start expired
    let _lbEvtMode = 0;                 // 0=flash, 1=green-flag sweep, 2=checkered

    if (lbEvtCtx) {
      const { canvas: eC, gl: eGL } = lbEvtCtx;

      const quadVS = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
          vUV = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      const evtFS = `#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;

        uniform float uTime;
        uniform float uElapsed;
        uniform float uDuration;
        uniform vec3  uColor;
        uniform float uMode;     // 0=flash, 1=green sweep, 2=checkered, 3=P1 gold
        uniform vec2  uRes;

        // Pseudo-random hash for sparkle particles
        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        void main() {
          vec2 uv = vUV;
          float progress = clamp(uElapsed / uDuration, 0.0, 1.0);

          // Global fade out — starts fading at 40% through
          float fadeOut = smoothstep(1.0, 0.4, progress);

          float alpha = 0.0;
          vec3 col = uColor;

          if (uMode < 0.5) {
            // ── MODE 0: Subtle edge flash (position change) ──
            float edgeX = min(uv.x, 1.0 - uv.x);
            float edgeY = min(uv.y, 1.0 - uv.y);
            float edge = exp(-min(edgeX, edgeY) * 8.0);
            float attack = smoothstep(0.0, 0.15, progress);
            float envelope = attack * fadeOut;
            alpha = edge * envelope * 0.28;
            alpha += envelope * 0.04;
          }
          else if (uMode < 1.5) {
            // ── MODE 1: Green flag sweep (race start) ──
            float sweepPos = progress * 1.6 - 0.3;
            float sweep = exp(-pow((uv.x - sweepPos) / 0.15, 2.0));
            alpha = sweep * fadeOut * 0.22;
            alpha += fadeOut * 0.03 * (1.0 - progress);
          }
          else if (uMode < 2.5) {
            // ── MODE 2: Checkered finish ──
            float scale = 8.0;
            float cx = floor(uv.x * scale);
            float cy = floor(uv.y * scale);
            float checker = mod(cx + cy, 2.0);
            float reveal = smoothstep(uv.x - 0.3, uv.x + 0.1, progress * 1.5);
            col = mix(vec3(0.9), vec3(0.15), checker);
            alpha = reveal * fadeOut * 0.16;
          }
          else {
            // ── MODE 3: P1 Gold celebration ──
            // Rich gold palette — warm, not yellow
            vec3 goldDeep = vec3(0.76, 0.60, 0.22);   // deep warm gold
            vec3 goldBright = vec3(1.0, 0.88, 0.55);   // bright highlight gold
            vec3 goldWhite = vec3(1.0, 0.97, 0.85);    // near-white sparkle peak

            // ── Slow fade-in, long presence, gentle fade-out ──
            float fadeIn = smoothstep(0.0, 0.12, progress);
            float fadeP1 = fadeIn * smoothstep(1.0, 0.5, progress);

            // ── Warm edge glow (stronger than normal gain) ──
            float edgeX = min(uv.x, 1.0 - uv.x);
            float edgeY = min(uv.y, 1.0 - uv.y);
            float edge = exp(-min(edgeX, edgeY) * 5.0);
            float edgeAlpha = edge * fadeP1 * 0.35;

            // ── Soft horizontal shimmer sweep ──
            float shimmerPos = fract(uTime * 0.3 + 0.2);
            float shimmer = exp(-pow((uv.x - shimmerPos) / 0.12, 2.0)) * 0.18;
            shimmer *= fadeP1;

            // ── Sparse sparkle particles ──
            // Grid of potential sparkle sites — only a few activate
            float sparkle = 0.0;
            float gridScale = 18.0; // controls density — higher = more cells but sparser activation
            vec2 gridCell = floor(uv * gridScale);
            float cellRand = hash21(gridCell);

            // Only ~8% of cells can sparkle at all
            if (cellRand > 0.92) {
              vec2 cellUV = fract(uv * gridScale);
              // Each sparkle has its own timing offset
              float sparklePhase = cellRand * 6.28 + uTime * (2.0 + cellRand * 3.0);
              // Sharp on/off blink — visible for only a narrow window
              float blink = pow(max(0.0, sin(sparklePhase)), 24.0);
              // Point-like: bright only near cell center
              float dist = length(cellUV - 0.5);
              float point = exp(-dist * dist * 40.0);
              // Stagger appearance across the animation
              float appear = smoothstep(cellRand * 0.4, cellRand * 0.4 + 0.1, progress);
              sparkle = blink * point * appear * fadeP1 * 0.65;
            }

            // Compose: edge glow is deep gold, shimmer is bright gold, sparkles are near-white
            col = goldDeep * edgeAlpha
                + goldBright * shimmer
                + goldWhite * sparkle;
            alpha = edgeAlpha + shimmer + sparkle;
            // Very subtle overall warm wash
            col += goldDeep * fadeP1 * 0.03;
            alpha += fadeP1 * 0.03;
          }

          alpha = clamp(alpha, 0.0, 0.55);
          fragColor = vec4(col * alpha, alpha);
        }`;

      const vs = createShader(eGL, eGL.VERTEX_SHADER, quadVS);
      const fs = createShader(eGL, eGL.FRAGMENT_SHADER, evtFS);
      const prog = createProgram(eGL, vs, fs);

      if (prog) {
        const aPos      = eGL.getAttribLocation(prog, 'aPos');
        const uTime     = eGL.getUniformLocation(prog, 'uTime');
        const uElapsed  = eGL.getUniformLocation(prog, 'uElapsed');
        const uDuration = eGL.getUniformLocation(prog, 'uDuration');
        const uColor    = eGL.getUniformLocation(prog, 'uColor');
        const uMode     = eGL.getUniformLocation(prog, 'uMode');
        const uRes      = eGL.getUniformLocation(prog, 'uRes');

        const buf = eGL.createBuffer();
        eGL.bindBuffer(eGL.ARRAY_BUFFER, buf);
        eGL.bufferData(eGL.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), eGL.STATIC_DRAW);

        eGL.enable(eGL.BLEND);
        eGL.blendFunc(eGL.ONE, eGL.ONE_MINUS_SRC_ALPHA);

        window._lbEvtFXFrame = function(dt) {
          _lbEvtElapsed += dt;
          if (_lbEvtElapsed > _lbEvtDuration) {
            // Clear canvas when animation is done
            if (_lbEvtActive) {
              eGL.clearColor(0, 0, 0, 0);
              eGL.clear(eGL.COLOR_BUFFER_BIT);
              _lbEvtActive = false;
            }
            return;
          }
          _lbEvtActive = true;
          resizeCanvas(eC, eGL);
          _lbEvtTime += dt;

          eGL.clearColor(0, 0, 0, 0);
          eGL.clear(eGL.COLOR_BUFFER_BIT);

          eGL.useProgram(prog);
          eGL.bindBuffer(eGL.ARRAY_BUFFER, buf);
          eGL.enableVertexAttribArray(aPos);
          eGL.vertexAttribPointer(aPos, 2, eGL.FLOAT, false, 0, 0);

          eGL.uniform1f(uTime, _lbEvtTime);
          eGL.uniform1f(uElapsed, _lbEvtElapsed);
          eGL.uniform1f(uDuration, _lbEvtDuration);
          eGL.uniform3fv(uColor, _lbEvtColor);
          eGL.uniform1f(uMode, _lbEvtMode);
          eGL.uniform2f(uRes, eC.width, eC.height);

          eGL.drawArrays(eGL.TRIANGLE_STRIP, 0, 4);
        };
      }
    }

    // Public API: trigger a leaderboard event animation
    // type: 'gain' | 'lose' | 'p1' | 'green' | 'finish'
    window.triggerLBEvent = function(type) {
      switch (type) {
        case 'gain':
          _lbEvtColor = [0.1, 0.85, 0.35];  // green
          _lbEvtDuration = 1.0;
          _lbEvtMode = 0;
          break;
        case 'lose':
          _lbEvtColor = [0.9, 0.15, 0.1];   // red
          _lbEvtDuration = 1.0;
          _lbEvtMode = 0;
          break;
        case 'p1':
          _lbEvtColor = [0.76, 0.60, 0.22]; // deep gold (shader handles its own palette)
          _lbEvtDuration = 3.5;
          _lbEvtMode = 3;
          break;
        case 'green':
          _lbEvtColor = [0.1, 0.85, 0.35];  // green
          _lbEvtDuration = 2.0;
          _lbEvtMode = 1;
          break;
        case 'finish':
          _lbEvtColor = [0.9, 0.9, 0.9];    // white (checkered)
          _lbEvtDuration = 2.5;
          _lbEvtMode = 2;
          break;
      }
      _lbEvtElapsed = 0;
      _lbEvtActive = true;
    };

    /* ════════════════════════════════════════════
       SPOTTER GLOW — edge glow that fades in/out with messages
       Color varies by severity: warn=amber, danger=red, clear=green
       ════════════════════════════════════════════ */
    const spotCtx = initGL('spotterGlCanvas');
    let _spotTime = 0;
    // 0=idle(off), 1=warn(amber), 2=danger(red), 3=clear(green)
    let _spotMode = 0;
    let _spotIntensity = 0;  // smoothly animated 0→1

    if (spotCtx) {
      const { canvas: sC, gl: sGL } = spotCtx;

      const quadVS = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
          vUV = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      const spotFS = `#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;

        uniform float uTime;
        uniform float uIntensity;  // 0-1 animated fade
        uniform float uMode;       // 1=warn, 2=danger, 3=clear
        uniform vec2  uRes;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                     mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }

        void main() {
          if (uIntensity < 0.005) { fragColor = vec4(0.0); return; }

          vec2 uv = vUV;

          // Color by mode
          vec3 col;
          float pulseSpeed;
          if (uMode < 1.5) {
            // Warn — warm amber
            col = vec3(0.95, 0.70, 0.15);
            pulseSpeed = 2.5;
          } else if (uMode < 2.5) {
            // Danger — urgent red
            col = vec3(0.92, 0.18, 0.12);
            pulseSpeed = 4.0;
          } else {
            // Clear — cool green
            col = vec3(0.15, 0.82, 0.40);
            pulseSpeed = 1.8;
          }

          // Edge distance — glow hugs all edges
          float edgeX = min(uv.x, 1.0 - uv.x);
          float edgeY = min(uv.y, 1.0 - uv.y);
          float edgeDist = min(edgeX, edgeY);

          // Primary edge glow — exponential falloff from borders
          float edgeGlow = exp(-edgeDist * 12.0);

          // Corner hotspots — brighter where two edges meet
          float cornerDist = length(vec2(edgeX, edgeY));
          float cornerGlow = exp(-cornerDist * 8.0) * 0.4;

          // Animated pulse — breathing intensity
          float pulse = 0.65 + 0.35 * sin(uTime * pulseSpeed);

          // Danger mode: add a faster flicker overlay
          float flicker = 1.0;
          if (uMode > 1.5 && uMode < 2.5) {
            flicker = 0.85 + 0.15 * sin(uTime * 11.0 + uv.x * 5.0);
          }

          // Noise-based shimmer along the edges
          float shimmer = noise(uv * 6.0 + uTime * 1.5) * 0.3 + 0.7;

          // Compose
          float glow = (edgeGlow + cornerGlow) * pulse * flicker * shimmer;
          glow *= uIntensity;

          // Sweep highlight — slow beam traveling around the perimeter
          float sweep = fract(uTime * 0.3);
          // Parametric edge position: top→right→bottom→left mapped to 0→1
          float perim;
          if (uv.y < 0.05) perim = uv.x * 0.25;                          // top edge
          else if (uv.x > 0.95) perim = 0.25 + uv.y * 0.25;             // right edge
          else if (uv.y > 0.95) perim = 0.5 + (1.0 - uv.x) * 0.25;     // bottom edge
          else if (uv.x < 0.05) perim = 0.75 + (1.0 - uv.y) * 0.25;    // left edge
          else perim = -1.0;

          if (perim >= 0.0) {
            float beamDist = min(abs(perim - sweep), min(abs(perim - sweep + 1.0), abs(perim - sweep - 1.0)));
            float beam = exp(-beamDist * beamDist * 800.0) * 0.5 * uIntensity;
            glow += beam;
          }

          float alpha = clamp(glow * 0.6, 0.0, 0.65);
          fragColor = vec4(col * alpha, alpha);
        }`;

      const vs = createShader(sGL, sGL.VERTEX_SHADER, quadVS);
      const fs = createShader(sGL, sGL.FRAGMENT_SHADER, spotFS);
      const prog = createProgram(sGL, vs, fs);

      if (prog) {
        const aPos       = sGL.getAttribLocation(prog, 'aPos');
        const uTime      = sGL.getUniformLocation(prog, 'uTime');
        const uIntensity = sGL.getUniformLocation(prog, 'uIntensity');
        const uMode      = sGL.getUniformLocation(prog, 'uMode');
        const uRes       = sGL.getUniformLocation(prog, 'uRes');

        const buf = sGL.createBuffer();
        sGL.bindBuffer(sGL.ARRAY_BUFFER, buf);
        sGL.bufferData(sGL.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), sGL.STATIC_DRAW);

        sGL.enable(sGL.BLEND);
        sGL.blendFunc(sGL.ONE, sGL.ONE_MINUS_SRC_ALPHA);

        window._spotterFXFrame = function(dt) {
          // Smooth intensity towards target
          const target = _spotMode > 0 ? 1.0 : 0.0;
          const speed = target > 0.5 ? 6.0 : 3.0; // fast in, slower out
          _spotIntensity += (target - _spotIntensity) * Math.min(1.0, dt * speed);

          if (_spotIntensity < 0.005) {
            // Clear canvas when fully faded
            sGL.clearColor(0, 0, 0, 0);
            sGL.clear(sGL.COLOR_BUFFER_BIT);
            return;
          }

          // Only resize canvas when glow is ramping up — prevents jarring
          // shrink when fading cards are removed from the DOM
          if (target > 0.5) resizeCanvas(sC, sGL);
          _spotTime += dt;

          sGL.clearColor(0, 0, 0, 0);
          sGL.clear(sGL.COLOR_BUFFER_BIT);

          sGL.useProgram(prog);
          sGL.bindBuffer(sGL.ARRAY_BUFFER, buf);
          sGL.enableVertexAttribArray(aPos);
          sGL.vertexAttribPointer(aPos, 2, sGL.FLOAT, false, 0, 0);

          sGL.uniform1f(uTime, _spotTime);
          sGL.uniform1f(uIntensity, _spotIntensity);
          sGL.uniform1f(uMode, _spotMode);
          sGL.uniform2f(uRes, sC.width, sC.height);

          sGL.drawArrays(sGL.TRIANGLE_STRIP, 0, 4);
        };
      }
    }

    // Public API: set spotter glow mode
    // 'warn' | 'danger' | 'clear' | 'off'
    window.setSpotterGlow = function(type) {
      switch (type) {
        case 'warn':   _spotMode = 1; break;
        case 'danger': _spotMode = 2; break;
        case 'clear':  _spotMode = 3; break;
        default:       _spotMode = 0; break;
      }
    };

    /* ════════════════════════════════════════════
       COMMENTARY TRAIL FX — flowing energy border
       ════════════════════════════════════════════ */
    const commGLCtx = initGL('commentaryGlCanvas');
    let _commTrailActive = false;
    let _commTrailTime = 0;
    let _commTrailHue = 200;   // updated via setCommentaryTrailGL

    if (commGLCtx) {
      const { canvas: cC, gl: cGL } = commGLCtx;

      const commVS = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
          vUV = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      // Trail fragment shader — energy particles tracing the border,
      // subtle inner ambient shimmer, hue-driven color.
      const commFS = `#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;

        uniform float uTime;
        uniform vec2  uRes;
        uniform float uIntensity;  // 0-1 fade
        uniform float uHue;        // 0-360

        // ── Noise ──
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                     mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }

        // ── HSL to RGB ──
        vec3 hsl2rgb(float h, float s, float l) {
          float c = (1.0 - abs(2.0 * l - 1.0)) * s;
          float x = c * (1.0 - abs(mod(h / 60.0, 2.0) - 1.0));
          float m = l - c * 0.5;
          vec3 rgb;
          if (h < 60.0)       rgb = vec3(c, x, 0);
          else if (h < 120.0) rgb = vec3(x, c, 0);
          else if (h < 180.0) rgb = vec3(0, c, x);
          else if (h < 240.0) rgb = vec3(0, x, c);
          else if (h < 300.0) rgb = vec3(x, 0, c);
          else                rgb = vec3(c, 0, x);
          return rgb + m;
        }

        void main() {
          vec2 uv = vUV;
          float t = uTime;
          float inten = uIntensity;
          float aspect = uRes.x / uRes.y;

          // Rounded-rect SDF (UV-space with aspect correction)
          vec2 center = vec2(0.5);
          float cornerR = 0.06;
          vec2 d = abs(uv - center) - vec2(0.5 - cornerR);
          // aspect-correct for x
          d.x *= aspect;
          float sdf = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - cornerR * aspect;

          // Border band — narrow strip along the edge
          float borderW = 0.022;
          float border = smoothstep(borderW, borderW * 0.3, abs(sdf));

          // ── Trail particles: 3 streams at different speeds ──
          // Parametric angle around the perimeter
          float angle = atan(uv.y - 0.5, (uv.x - 0.5) * aspect);
          float a = angle / 6.28318 + 0.5; // normalize 0-1

          float trail1 = pow(max(0.0, sin(a * 12.5663 + t * 3.0)), 16.0);
          float trail2 = pow(max(0.0, sin(a * 18.8496 - t * 2.2 + 1.0)), 12.0);
          float trail3 = pow(max(0.0, sin(a * 8.3776  + t * 4.5 + 2.5)), 20.0);

          float trails = (trail1 * 0.7 + trail2 * 0.5 + trail3 * 0.9);
          trails *= border;

          // ── Flowing shimmer along border ──
          float shimmer = noise(vec2(a * 8.0 + t * 1.5, t * 0.3)) * 0.5 + 0.5;
          shimmer *= border * 0.35;

          // ── Subtle inner ambient glow ──
          float innerDist = smoothstep(0.0, -0.08, sdf);
          float ambient = innerDist * 0.04 * (0.7 + 0.3 * sin(t * 0.8));

          // ── Color: hue-matched with slight variation on trails ──
          vec3 baseCol = hsl2rgb(uHue, 0.6, 0.55);
          vec3 brightCol = hsl2rgb(uHue, 0.7, 0.7);
          vec3 trailCol = mix(baseCol, brightCol, trails);

          // ── Compose ──
          float alpha = (trails * 0.6 + shimmer * 0.4 + ambient) * inten;
          vec3 col = trailCol;

          // Clamp
          alpha = clamp(alpha, 0.0, 0.65);

          fragColor = vec4(col * alpha, alpha);
        }`;

      const cvs = createShader(cGL, cGL.VERTEX_SHADER, commVS);
      const cfs = createShader(cGL, cGL.FRAGMENT_SHADER, commFS);
      const commProg = (cvs && cfs) ? createProgram(cGL, cvs, cfs) : null;

      if (commProg) {
        const commPosLoc = cGL.getAttribLocation(commProg, 'aPos');
        const commUTime = cGL.getUniformLocation(commProg, 'uTime');
        const commURes = cGL.getUniformLocation(commProg, 'uRes');
        const commUInten = cGL.getUniformLocation(commProg, 'uIntensity');
        const commUHue = cGL.getUniformLocation(commProg, 'uHue');

        const commBuf = cGL.createBuffer();
        cGL.bindBuffer(cGL.ARRAY_BUFFER, commBuf);
        cGL.bufferData(cGL.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), cGL.STATIC_DRAW);

        let _commInten = 0;

        window._commTrailFXFrame = function(dt) {
          if (_commTrailActive) {
            _commInten = Math.min(1, _commInten + dt * 2.0);  // fade in ~0.5s
            _commTrailTime += dt;
          } else {
            _commInten = Math.max(0, _commInten - dt * 3.0);  // fade out faster
            if (_commInten <= 0) return;
          }

          resizeCanvas(cC, cGL);
          cGL.enable(cGL.BLEND);
          cGL.blendFunc(cGL.SRC_ALPHA, cGL.ONE);  // additive
          cGL.clearColor(0, 0, 0, 0);
          cGL.clear(cGL.COLOR_BUFFER_BIT);

          cGL.useProgram(commProg);
          cGL.uniform1f(commUTime, _commTrailTime);
          cGL.uniform2f(commURes, cC.width, cC.height);
          cGL.uniform1f(commUInten, _commInten);
          cGL.uniform1f(commUHue, _commTrailHue);

          cGL.bindBuffer(cGL.ARRAY_BUFFER, commBuf);
          cGL.enableVertexAttribArray(commPosLoc);
          cGL.vertexAttribPointer(commPosLoc, 2, cGL.FLOAT, false, 0, 0);
          cGL.drawArrays(cGL.TRIANGLE_STRIP, 0, 4);
        };
      }
    }

    // Public API: toggle commentary trail + set hue
    window.setCommentaryTrailGL = function(active, hue) {
      _commTrailActive = active;
      if (typeof hue === 'number') _commTrailHue = hue;
      if (active) _commTrailTime = 0;
    };

    /* ════════════════════════════════════════════
       BONKERS PIT BANNER FX — fire / energy burst
       ════════════════════════════════════════════ */
    const pitGLCtx = initGL('pitGlCanvas');
    let _bonkersGLActive = false;
    let _bonkersTime = 0;

    if (pitGLCtx) {
      const { canvas: pC, gl: pGL } = pitGLCtx;

      const pitVS = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
          vUV = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      const pitFS = `#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;

        uniform float uTime;
        uniform vec2  uRes;
        uniform float uIntensity;  // 0-1, ramps up

        // ── Noise functions ──
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                     mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.1;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 uv = vUV;
          vec2 center = vec2(0.5, 0.5);
          float t = uTime;
          float inten = uIntensity;

          // Distance from perimeter (0 at edge, 1 at center)
          float dx = abs(uv.x - 0.5) * 2.0;
          float dy = abs(uv.y - 0.5) * 2.0;
          float edgeDist = max(dx, dy);
          float border = smoothstep(0.7, 1.0, edgeDist);

          // ── Fire layer: fbm-driven flames rising from edges ──
          vec2 fireUV = uv * vec2(4.0, 3.0);
          fireUV.y -= t * 2.5;                    // flames rise
          float fire = fbm(fireUV + t * 0.8);
          fire = smoothstep(0.3, 0.7, fire);
          fire *= border * inten;

          // Fire color: red core → orange → yellow tips
          vec3 fireCol = mix(vec3(0.9, 0.1, 0.0), vec3(1.0, 0.7, 0.0), fire);
          fireCol = mix(fireCol, vec3(1.0, 1.0, 0.3), fire * fire);

          // ── Energy arcs: bright streaks along perimeter ──
          float angle = atan(uv.y - 0.5, uv.x - 0.5);
          float arc1 = sin(angle * 8.0 + t * 12.0) * 0.5 + 0.5;
          float arc2 = sin(angle * 5.0 - t * 9.0 + 1.5) * 0.5 + 0.5;
          float arcMask = smoothstep(0.82, 0.95, edgeDist);
          float arcs = (pow(arc1, 8.0) + pow(arc2, 6.0) * 0.7) * arcMask * inten;
          vec3 arcCol = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 0.9, 0.2), arc1);

          // ── Heat shimmer: distorted inner haze ──
          float shimmer = noise(uv * 10.0 + t * 3.0) * 0.15;
          float innerGlow = smoothstep(0.85, 0.5, edgeDist) * shimmer * inten;
          vec3 shimmerCol = vec3(0.8, 0.2, 0.0) * innerGlow;

          // ── Pulse: whole-surface throb ──
          float pulse = (sin(t * 15.0) * 0.5 + 0.5) * 0.12 * inten * border;

          // ── Compose ──
          vec3 col = fireCol * fire * 0.9
                   + arcCol * arcs * 0.8
                   + shimmerCol
                   + vec3(1.0, 0.5, 0.1) * pulse;

          float alpha = fire * 0.7 + arcs * 0.6 + innerGlow + pulse;
          alpha = clamp(alpha * inten, 0.0, 0.85);

          fragColor = vec4(col * alpha, alpha);
        }`;

      const pvs = createShader(pGL, pGL.VERTEX_SHADER, pitVS);
      const pfs = createShader(pGL, pGL.FRAGMENT_SHADER, pitFS);
      const pitProg = (pvs && pfs) ? createProgram(pGL, pvs, pfs) : null;

      if (pitProg) {
        const pitPosLoc = pGL.getAttribLocation(pitProg, 'aPos');
        const pitUTime = pGL.getUniformLocation(pitProg, 'uTime');
        const pitURes = pGL.getUniformLocation(pitProg, 'uRes');
        const pitUInten = pGL.getUniformLocation(pitProg, 'uIntensity');

        // Full-screen quad
        const pitBuf = pGL.createBuffer();
        pGL.bindBuffer(pGL.ARRAY_BUFFER, pitBuf);
        pGL.bufferData(pGL.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), pGL.STATIC_DRAW);

        let _bonkersInten = 0;  // smoothly ramps 0→1

        window._bonkersFXFrame = function(dt) {
          // Ramp intensity
          if (_bonkersGLActive) {
            _bonkersInten = Math.min(1, _bonkersInten + dt * 2.5); // ramp up over 0.4s
            _bonkersTime += dt;
          } else {
            _bonkersInten = Math.max(0, _bonkersInten - dt * 4.0); // ramp down faster
            if (_bonkersInten <= 0) return;
          }

          resizeCanvas(pC, pGL);
          pGL.enable(pGL.BLEND);
          pGL.blendFunc(pGL.SRC_ALPHA, pGL.ONE);  // additive for fire
          pGL.clearColor(0, 0, 0, 0);
          pGL.clear(pGL.COLOR_BUFFER_BIT);

          pGL.useProgram(pitProg);
          pGL.uniform1f(pitUTime, _bonkersTime);
          pGL.uniform2f(pitURes, pC.width, pC.height);
          pGL.uniform1f(pitUInten, _bonkersInten);

          pGL.bindBuffer(pGL.ARRAY_BUFFER, pitBuf);
          pGL.enableVertexAttribArray(pitPosLoc);
          pGL.vertexAttribPointer(pitPosLoc, 2, pGL.FLOAT, false, 0, 0);
          pGL.drawArrays(pGL.TRIANGLE_STRIP, 0, 4);
        };
      }
    }

    // Public API: toggle bonkers WebGL
    window.setBonkersGL = function(active) {
      _bonkersGLActive = active;
      if (active) _bonkersTime = 0;
    };

    /* ════════════════════════════════════════════
       INCIDENTS MODULE FX — penalty / DQ fire glow
       Reuses the bonkers fire pattern with two modes:
         'penalty' → yellower, subtler, lower intensity
         'dq'      → full red bonkers fire
       ════════════════════════════════════════════ */
    const incGLCtx = initGL('incGlCanvas');
    let _incGLMode = '';   // '', 'penalty', 'dq'
    let _incGLTime = 0;
    let _incGLInten = 0;

    if (incGLCtx) {
      const { canvas: iC, gl: iGL } = incGLCtx;

      const incVS = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
          vUV = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      const incFS = `#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;

        uniform float uTime;
        uniform vec2  uRes;
        uniform float uIntensity;
        uniform float uHueShift;   // 0.0 = red/orange (DQ), 1.0 = yellow/amber (penalty)

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                     mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
          return v;
        }

        void main() {
          vec2 uv = vUV;
          float t = uTime;
          float inten = uIntensity;
          float dx = abs(uv.x - 0.5) * 2.0;
          float dy = abs(uv.y - 0.5) * 2.0;
          float edgeDist = max(dx, dy);
          float border = smoothstep(0.65, 1.0, edgeDist);

          // Fire
          vec2 fireUV = uv * vec2(4.0, 3.0);
          fireUV.y -= t * 2.0;
          float fire = fbm(fireUV + t * 0.6);
          fire = smoothstep(0.35, 0.7, fire) * border * inten;

          // Color shift: DQ (hueShift=0) = red→orange, penalty (hueShift=1) = amber→yellow
          vec3 coreCol  = mix(vec3(0.9, 0.1, 0.0), vec3(0.85, 0.65, 0.0), uHueShift);
          vec3 tipCol   = mix(vec3(1.0, 0.7, 0.0), vec3(1.0, 0.95, 0.3), uHueShift);
          vec3 brightCol = mix(vec3(1.0, 1.0, 0.3), vec3(1.0, 1.0, 0.6), uHueShift);
          vec3 fireCol = mix(coreCol, tipCol, fire);
          fireCol = mix(fireCol, brightCol, fire * fire);

          // Energy arcs — subtler for penalty
          float angle = atan(uv.y - 0.5, uv.x - 0.5);
          float arcSpeed = mix(10.0, 6.0, uHueShift);
          float arc1 = sin(angle * 6.0 + t * arcSpeed) * 0.5 + 0.5;
          float arcMask = smoothstep(0.80, 0.95, edgeDist);
          float arcs = pow(arc1, 8.0) * arcMask * inten * mix(0.8, 0.4, uHueShift);
          vec3 arcCol = mix(tipCol, brightCol, arc1);

          // Compose
          vec3 col = fireCol * fire * 0.85 + arcCol * arcs * 0.7;
          float alpha = fire * 0.6 + arcs * 0.5;
          alpha = clamp(alpha * inten, 0.0, mix(0.80, 0.50, uHueShift));

          fragColor = vec4(col * alpha, alpha);
        }`;

      const ivs = createShader(iGL, iGL.VERTEX_SHADER, incVS);
      const ifs = createShader(iGL, iGL.FRAGMENT_SHADER, incFS);
      const incProg = (ivs && ifs) ? createProgram(iGL, ivs, ifs) : null;

      if (incProg) {
        const incPosLoc = iGL.getAttribLocation(incProg, 'aPos');
        const incUTime  = iGL.getUniformLocation(incProg, 'uTime');
        const incURes   = iGL.getUniformLocation(incProg, 'uRes');
        const incUInten = iGL.getUniformLocation(incProg, 'uIntensity');
        const incUHue   = iGL.getUniformLocation(incProg, 'uHueShift');

        const incBuf = iGL.createBuffer();
        iGL.bindBuffer(iGL.ARRAY_BUFFER, incBuf);
        iGL.bufferData(iGL.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), iGL.STATIC_DRAW);

        window._incidentsFXFrame = function(dt) {
          const active = _incGLMode !== '';
          if (active) {
            _incGLInten = Math.min(1, _incGLInten + dt * 2.0);
            _incGLTime += dt;
          } else {
            _incGLInten = Math.max(0, _incGLInten - dt * 3.0);
            if (_incGLInten <= 0) return;
          }

          resizeCanvas(iC, iGL);
          iGL.enable(iGL.BLEND);
          iGL.blendFunc(iGL.SRC_ALPHA, iGL.ONE);
          iGL.clearColor(0, 0, 0, 0);
          iGL.clear(iGL.COLOR_BUFFER_BIT);

          iGL.useProgram(incProg);
          iGL.uniform1f(incUTime, _incGLTime);
          iGL.uniform2f(incURes, iC.width, iC.height);
          iGL.uniform1f(incUInten, _incGLInten);
          iGL.uniform1f(incUHue, _incGLMode === 'penalty' ? 1.0 : 0.0);

          iGL.bindBuffer(iGL.ARRAY_BUFFER, incBuf);
          iGL.enableVertexAttribArray(incPosLoc);
          iGL.vertexAttribPointer(incPosLoc, 2, iGL.FLOAT, false, 0, 0);
          iGL.drawArrays(iGL.TRIANGLE_STRIP, 0, 4);
        };
      }
    }

    // Public API: set incidents fire mode ('', 'penalty', 'dq')
    window.setIncidentsGL = function(mode) {
      const prev = _incGLMode;
      _incGLMode = mode || '';
      if (_incGLMode && !prev) _incGLTime = 0;
      // Toggle CSS class for canvas opacity
      const panel = document.getElementById('incidentsPanel');
      if (panel) panel.classList.toggle('inc-bonkers', _incGLMode !== '');
    };

    /* ════════════════════════════════════════════
       GRID FLAG FX — flag-colored energy tendrils
       that radiate outward beyond the card edges.
       Three flag colors drift as aurora-like wisps,
       with particle sparks at the periphery.
       ════════════════════════════════════════════ */
    const flagGLCtx = initGL('gridFlagGlCanvas');
    let _flagGLActive = false;
    let _flagGLTime = 0;
    // Flag colors (linear RGB) — updated via setGridFlagColors
    let _gridFlagCol1 = [0.35, 0.55, 0.85];
    let _gridFlagCol2 = [0.6, 0.65, 0.8];
    let _gridFlagCol3 = [0.5, 0.7, 0.95];

    if (flagGLCtx) {
      const { canvas: fC, gl: fGL } = flagGLCtx;

      const flagVS = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
          vUV = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

      const flagFS = `#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;

        uniform float uTime;
        uniform float uIntensity;
        uniform vec2  uRes;
        uniform vec3  uCol1;
        uniform vec3  uCol2;
        uniform vec3  uCol3;

        // Noise helpers
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                     mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = p * 2.1 + 0.3;
            a *= 0.5;
          }
          return v;
        }

        // Rounded-rect SDF
        float roundedBox(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b + r;
          return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
        }

        void main() {
          vec2 uv = vUV;
          float aspect = uRes.x / uRes.y;
          vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
          float t = uTime;

          // Card shape — the inner card occupies ~60% of canvas
          // (canvas extends 80px beyond card on each side)
          vec2 boxSize = vec2(aspect * 0.30, 0.34);
          float r = 0.035;
          float d = roundedBox(p, boxSize, r);

          // Only draw outside the card
          if (d < -0.005) { fragColor = vec4(0.0); return; }

          // ── Aurora wisps: fbm-driven flowing tendrils ──
          float angle = atan(p.y, p.x);
          float edgeDist = max(0.0, d);

          // Three color channels at different speeds/offsets
          float n1 = fbm(vec2(angle * 1.2 - t * 0.4, edgeDist * 3.0 + t * 0.2));
          float n2 = fbm(vec2(angle * 1.2 + t * 0.5 + 2.094, edgeDist * 3.0 - t * 0.15));
          float n3 = fbm(vec2(angle * 1.2 - t * 0.35 + 4.189, edgeDist * 3.0 + t * 0.25));

          // Shape each wisp: strong near edge, fading outward
          float falloff = exp(-edgeDist * 4.5);
          float w1 = pow(n1, 2.5) * falloff;
          float w2 = pow(n2, 2.5) * falloff;
          float w3 = pow(n3, 2.5) * falloff;

          // Boost flag colors for vibrancy
          vec3 c1 = uCol1 * 0.8 + 0.2;
          vec3 c2 = uCol2 * 0.8 + 0.2;
          vec3 c3 = uCol3 * 0.8 + 0.2;

          vec3 col = c1 * w1 + c2 * w2 + c3 * w3;

          // ── Edge glow: soft light hugging the card border ──
          float edgeGlow = exp(-edgeDist * 12.0) * 0.35;
          float wTotal = w1 + w2 + w3 + 0.001;
          vec3 edgeCol = (c1 * w1 + c2 * w2 + c3 * w3) / wTotal;
          col += edgeCol * edgeGlow;

          // ── Spark particles: bright dots at the periphery ──
          float sparkNoise = noise(uv * 40.0 + t * vec2(1.3, 0.7));
          float sparkMask = smoothstep(0.92, 0.96, sparkNoise) * falloff * 1.5;
          col += edgeCol * sparkMask;

          // ── Breathing pulse ──
          float pulse = 0.85 + 0.15 * sin(t * 1.5);

          float alpha = (w1 + w2 + w3 + edgeGlow + sparkMask * 0.5) * uIntensity * pulse;
          alpha = clamp(alpha, 0.0, 0.7);

          // Soft fade at canvas edges to avoid hard cutoff
          float canvasEdge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
          alpha *= smoothstep(0.0, 0.08, canvasEdge);

          fragColor = vec4(col * alpha, alpha);
        }`;

      const fvs = createShader(fGL, fGL.VERTEX_SHADER, flagVS);
      const ffs = createShader(fGL, fGL.FRAGMENT_SHADER, flagFS);
      const flagProg = (fvs && ffs) ? createProgram(fGL, fvs, ffs) : null;

      if (flagProg) {
        const flagPosLoc = fGL.getAttribLocation(flagProg, 'aPos');
        const flagUTime  = fGL.getUniformLocation(flagProg, 'uTime');
        const flagUInten = fGL.getUniformLocation(flagProg, 'uIntensity');
        const flagURes   = fGL.getUniformLocation(flagProg, 'uRes');
        const flagUCol1  = fGL.getUniformLocation(flagProg, 'uCol1');
        const flagUCol2  = fGL.getUniformLocation(flagProg, 'uCol2');
        const flagUCol3  = fGL.getUniformLocation(flagProg, 'uCol3');

        const flagBuf = fGL.createBuffer();
        fGL.bindBuffer(fGL.ARRAY_BUFFER, flagBuf);
        fGL.bufferData(fGL.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), fGL.STATIC_DRAW);

        let _flagInten = 0;

        window._gridFlagFXFrame = function(dt) {
          if (_flagGLActive) {
            _flagInten = Math.min(1, _flagInten + dt * 1.5);
            _flagGLTime += dt;
          } else {
            _flagInten = Math.max(0, _flagInten - dt * 2.0);
            if (_flagInten <= 0) return;
          }

          resizeCanvas(fC, fGL);
          fGL.enable(fGL.BLEND);
          fGL.blendFunc(fGL.SRC_ALPHA, fGL.ONE);
          fGL.clearColor(0, 0, 0, 0);
          fGL.clear(fGL.COLOR_BUFFER_BIT);

          fGL.useProgram(flagProg);
          fGL.uniform1f(flagUTime, _flagGLTime);
          fGL.uniform1f(flagUInten, _flagInten);
          fGL.uniform2f(flagURes, fC.width, fC.height);
          fGL.uniform3fv(flagUCol1, _gridFlagCol1);
          fGL.uniform3fv(flagUCol2, _gridFlagCol2);
          fGL.uniform3fv(flagUCol3, _gridFlagCol3);

          fGL.bindBuffer(fGL.ARRAY_BUFFER, flagBuf);
          fGL.enableVertexAttribArray(flagPosLoc);
          fGL.vertexAttribPointer(flagPosLoc, 2, fGL.FLOAT, false, 0, 0);
          fGL.drawArrays(fGL.TRIANGLE_STRIP, 0, 4);
        };
      }
    }

    // Public API: toggle grid flag WebGL
    window.setGridFlagGL = function(active) {
      _flagGLActive = active;
      if (active) _flagGLTime = 0;
    };

    // Public API: set flag colors for the grid flag glow (hex → linear RGB)
    window.setGridFlagColors = function(hex1, hex2, hex3) {
      function hexToGL(hex) {
        hex = hex.replace('#', '');
        return [
          parseInt(hex.substring(0, 2), 16) / 255,
          parseInt(hex.substring(2, 4), 16) / 255,
          parseInt(hex.substring(4, 6), 16) / 255
        ];
      }
      _gridFlagCol1 = hexToGL(hex1);
      _gridFlagCol2 = hexToGL(hex2);
      _gridFlagCol3 = hexToGL(hex3);
    };

    /* ── Master FX animation loop ── */
    let _lastFXTime = 0;
    function fxLoop(now) {
      const dt = Math.min((now - _lastFXTime) / 1000, 0.05); // cap at 50ms
      _lastFXTime = now;
      // Skip rendering when WebGL effects are disabled
      if (typeof _settings !== 'undefined' && _settings.showWebGL === false) {
        requestAnimationFrame(fxLoop);
        return;
      }
      if (window._tachoFXFrame) window._tachoFXFrame(dt);
      if (window._pedalsFXFrame) window._pedalsFXFrame(dt);
      if (window._flagFXFrame) window._flagFXFrame(dt);
      if (window._lbFXFrame) window._lbFXFrame(dt);
      if (window._lbEvtFXFrame) window._lbEvtFXFrame(dt);
      if (window._k10LogoFXFrame) window._k10LogoFXFrame(dt);
      if (window._spotterFXFrame) window._spotterFXFrame(dt);
      if (window._bonkersFXFrame) window._bonkersFXFrame(dt);
      if (window._incidentsFXFrame) window._incidentsFXFrame(dt);
      if (window._commTrailFXFrame) window._commTrailFXFrame(dt);
      if (window._gridFlagFXFrame) window._gridFlagFXFrame(dt);
      requestAnimationFrame(fxLoop);
    }
    requestAnimationFrame((now) => { _lastFXTime = now; requestAnimationFrame(fxLoop); });

    /* ── Public API for main update loop ── */
    window.updateGLFX = function(rpmRatio, thr, brk, clt) {
      _tachoRpm = rpmRatio;
      _pedalValues.thr = thr;
      _pedalValues.brk = brk;
      _pedalValues.clt = clt;
    };
  })();

export {}
