/**
 * WebGL2 Effects Manager — Ported from original webgl.js
 *
 * Manages 11 WebGL2 effects across different canvas elements:
 * 1. Tachometer (bloom + heat distortion)
 * 2. Pedals (edge glow energy)
 * 3. Flag (waving cloth animation)
 * 4. Leaderboard Player (shimmer/glow highlight)
 * 5. Leaderboard Event (position change/race state effects)
 * 6. K10 Logo (subtle chevron drift)
 * 7. Spotter (edge glow for messages)
 * 8. Commentary Trail (flowing energy border)
 * 9. Bonkers Pit (fire/energy burst)
 * 10. Incidents (penalty/DQ fire glow)
 * 11. Grid Flag (aurora-like wisps)
 */

export interface CanvasMap {
  tachoGlCanvas?: HTMLCanvasElement;
  pedalsGlCanvas?: HTMLCanvasElement;
  flagGlCanvas?: HTMLCanvasElement;
  lbPlayerGlCanvas?: HTMLCanvasElement;
  lbEventGlCanvas?: HTMLCanvasElement;
  k10LogoGlCanvas?: HTMLCanvasElement;
  spotterGlCanvas?: HTMLCanvasElement;
  commentaryGlCanvas?: HTMLCanvasElement;
  pitGlCanvas?: HTMLCanvasElement;
  incGlCanvas?: HTMLCanvasElement;
  gridFlagGlCanvas?: HTMLCanvasElement;
}

interface GLContext {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
}

export class WebGLManager {
  private contexts: Map<string, GLContext> = new Map();
  private programs: Map<string, WebGLProgram> = new Map();
  private buffers: Map<string, WebGLBuffer> = new Map();

  // State for each effect
  private tachoRpm = 0;
  private tachoTime = 0;
  private pedalValues = { thr: 0, brk: 0, clt: 0 };
  private pedalTime = 0;

  private flagTime = 0;
  private flagColors = { c1: [1, 0.85, 0.15], c2: [1, 1, 0.95], pattern: 0.0 };
  private flagVisible = false;

  private lbTime = 0;
  private lbPlayerTop = 0;
  private lbPlayerBottom = 1;
  private lbHasPlayer = false;
  private lbHighlightMode = 0;

  private lbEvtTime = 0;
  private lbEvtActive = false;
  private lbEvtColor = [0.0, 0.8, 0.3];
  private lbEvtDuration = 1.2;
  private lbEvtElapsed = 99;
  private lbEvtMode = 0;

  private k10LogoTime = 0;

  private spotTime = 0;
  private spotMode = 0;
  private spotIntensity = 0;

  private commTrailActive = false;
  private commTrailTime = 0;
  private commTrailHue = 200;
  private commTrailIntensity = 0;

  private bonkersGLActive = false;
  private bonkersTime = 0;
  private bonkersIntensity = 0;

  private incGLMode = '';
  private incGLTime = 0;
  private incGLIntensity = 0;

  private flagGLActive = false;
  private flagGLTime = 0;
  private flagGLIntensity = 0;
  private gridFlagCol1 = [0.35, 0.55, 0.85];
  private gridFlagCol2 = [0.6, 0.65, 0.8];
  private gridFlagCol3 = [0.5, 0.7, 0.95];

  private flagGLColors: {
    [key: string]: { c1: [number, number, number]; c2: [number, number, number]; pattern: number };
  } = {
    yellow: { c1: [1.0, 0.85, 0.12], c2: [1.0, 1.0, 0.92], pattern: 0.0 },
    red: { c1: [0.9, 0.14, 0.12], c2: [0.5, 0.06, 0.06], pattern: 0.0 },
    blue: { c1: [0.2, 0.45, 0.92], c2: [0.08, 0.2, 0.55], pattern: 3.0 },
    green: { c1: [0.2, 0.72, 0.28], c2: [0.1, 0.42, 0.16], pattern: 0.0 },
    white: { c1: [0.95, 0.95, 0.95], c2: [0.72, 0.72, 0.72], pattern: 0.0 },
    debris: { c1: [1.0, 0.85, 0.12], c2: [0.9, 0.18, 0.12], pattern: 3.0 },
    checkered: { c1: [0.95, 0.95, 0.95], c2: [0.06, 0.06, 0.06], pattern: 2.0 },
    black: { c1: [0.06, 0.06, 0.06], c2: [0.8, 0.12, 0.08], pattern: 1.0 },
    meatball: { c1: [0.85, 0.12, 0.1], c2: [0.06, 0.06, 0.06], pattern: 4.0 },
    orange: { c1: [1.0, 0.6, 0.08], c2: [0.9, 0.35, 0.05], pattern: 0.0 },
  };

  constructor() {}

  /**
   * Initialize WebGL contexts and compile shaders for all effects.
   * Wrapped in try-catch to prevent GPU crashes from killing Electron's
   * renderer process (transparent windows + many WebGL2 contexts can be fragile).
   */
  init(canvasMap: CanvasMap): void {
    try {
      // Initialize each canvas context
      Object.entries(canvasMap).forEach(([key, canvas]) => {
        if (canvas) {
          try {
            const ctx = this.initGL(canvas);
            if (ctx) {
              this.contexts.set(key, ctx);
            }
          } catch (e) {
            console.warn(`WebGLManager: Failed to init GL for ${key}`, e);
          }
        }
      });

      if (this.contexts.size === 0) {
        console.warn('WebGLManager: No WebGL contexts could be created');
        return;
      }

      this.initTachoEffect();
      this.initPedalsEffect();
      this.initFlagEffect();
      this.initLeaderboardPlayerEffect();
      this.initLeaderboardEventEffect();
      this.initK10LogoEffect();
      this.initSpotterEffect();
      this.initCommentaryTrailEffect();
      this.initBonkersEffect();
      this.initIncidentsEffect();
      this.initGridFlagEffect();
    } catch (e) {
      console.error('WebGLManager: init failed —', e);
    }
  }

  /**
   * Render frame for all active effects
   */
  updateFrame(dt: number, _telemetry?: any): void {
    try {
      if (dt > 0.05) dt = 0.05; // cap at 50ms

      this.renderTachoEffect(dt);
      this.renderPedalsEffect(dt);
      this.renderFlagEffect(dt);
      this.renderLeaderboardPlayerEffect(dt);
      this.renderLeaderboardEventEffect(dt);
      this.renderK10LogoEffect(dt);
      this.renderSpotterEffect(dt);
      this.renderCommentaryTrailEffect(dt);
      this.renderBonkersEffect(dt);
      this.renderIncidentsEffect(dt);
      this.renderGridFlagEffect(dt);
    } catch (e) {
      // Silently ignore render errors to prevent renderer crash
    }
  }

  /**
   * Clean up WebGL resources
   */
  dispose(): void {
    this.contexts.forEach((ctx) => {
      ctx.gl.deleteProgram(this.programs.get(`taco`) || null);
      ctx.gl.deleteProgram(this.programs.get(`pedals`) || null);
      // ... delete other programs
    });
    this.contexts.clear();
    this.programs.clear();
    this.buffers.clear();
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE HELPER METHODS
  // ═══════════════════════════════════════════════════════════════

  private initGL(canvas: HTMLCanvasElement): GLContext | null {
    // Use conservative GL options to avoid crashing Electron's renderer
    // in transparent overlay windows (many simultaneous WebGL2 contexts).
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false, // Reduce GPU pressure — 11 contexts in transparent window
      failIfMajorPerformanceCaveat: true, // Don't use software fallback
      powerPreference: 'low-power',
    });
    if (!gl) {
      // Fall back to webgl1 if webgl2 is unavailable
      const gl1 = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        failIfMajorPerformanceCaveat: true,
      });
      if (!gl1) {
        console.warn('WebGL not available for canvas:', canvas.id);
        return null;
      }
      return { canvas, gl: gl1 as unknown as WebGL2RenderingContext };
    }
    return { canvas, gl };
  }

  private createShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('Shader compile:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  private createProgram(
    gl: WebGL2RenderingContext,
    vs: WebGLShader | null,
    fs: WebGLShader | null
  ): WebGLProgram | null {
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    if (!p) return null;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('Program link:', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  private resizeCanvas(ctx: GLContext): void {
    const { canvas, gl } = ctx;
    const r = canvas.parentElement?.getBoundingClientRect();
    if (!r) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  private getOrCreateBuffer(gl: WebGL2RenderingContext, key: string): WebGLBuffer {
    let buf = this.buffers.get(key);
    if (!buf) {
      buf = gl.createBuffer();
      if (!buf) throw new Error('Failed to create buffer');
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.buffers.set(key, buf);
    }
    return buf;
  }

  // ═══════════════════════════════════════════════════════════════
  // EFFECT 1: TACHOMETER (bloom + heat distortion)
  // ═══════════════════════════════════════════════════════════════

  private initTachoEffect(): void {
    const ctx = this.contexts.get('tachoGlCanvas');
    if (!ctx) return;
    const { gl } = ctx;

    const quadVS = `#version 300 es
      in vec2 aPos;
      out vec2 vUV;
      void main() {
        vUV = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }`;

    const tachoFS = `#version 300 es
      precision highp float;
      in vec2 vUV;
      out vec4 fragColor;

      uniform float uRpm;
      uniform float uTime;
      uniform vec2  uRes;
      uniform float uDPR;

      vec3 rpmColor(float r) {
        if (r < 0.55) return vec3(0.18, 0.82, 0.34);
        if (r < 0.73) return vec3(0.95, 0.75, 0.15);
        return vec3(0.92, 0.22, 0.20);
      }

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
        float dprScale = max(uDPR, 1.0);
        float dpr2 = dprScale * dprScale;

        float heatIntensity = smoothstep(0.75, 0.95, uRpm) * 0.6 * dpr2;
        if (heatIntensity > 0.0) {
          float n1 = noise(uv * 8.0 + uTime * 3.0) * 2.0 - 1.0;
          float n2 = noise(uv * 6.0 - uTime * 2.5 + 50.0) * 2.0 - 1.0;
          uv += vec2(n1, n2) * heatIntensity * 0.012;
        }

        float barTop = 0.35;
        float barY = smoothstep(0.0, barTop, uv.y);
        float inBar = 1.0 - barY;

        float fillX = uRpm;
        float xDist = max(0.0, uv.x - fillX);
        float glowFalloff = exp(-xDist * (6.0 / dpr2)) * inBar;

        vec3 col = rpmColor(uRpm);

        float pulse = 1.0;
        if (uRpm >= 0.91) {
          pulse = 0.85 + 0.15 * sin(uTime * 18.0);
        }

        float bloom = glowFalloff * uRpm * 1.2 * dpr2 * pulse;
        float aboveBar = smoothstep(barTop, barTop + 0.3 * dpr2, uv.y);
        float upGlow = aboveBar * exp(-abs(uv.x - fillX * 0.5) * (3.0 / dpr2)) * uRpm * 0.35 * dpr2 * pulse;
        float edgeGlow = exp(-abs(uv.y - barTop) * (25.0 / dpr2)) * smoothstep(0.0, fillX, uv.x) * uRpm * 0.5 * dpr2;

        float alpha = bloom + upGlow + edgeGlow;
        vec3 final = col * alpha;

        if (uRpm >= 0.91) {
          float redStr = smoothstep(0.91, 0.96, uRpm);
          float flash = pow(0.5 + 0.5 * sin(uTime * 22.0), 4.0);
          float flicker = 0.8 + 0.2 * sin(uTime * 55.0 + uv.x * 12.0);
          float vig = 1.0 - 0.2 * length((uv - 0.5) * vec2(0.8, 1.4));
          float flashA = flash * flicker * redStr * vig * 0.5 * dpr2;
          vec3 flashCol = vec3(0.95, 0.08, 0.03);
          final += flashCol * flashA;
          alpha += flashA;
          float scan = 0.88 + 0.12 * sin(uv.y * uRes.y * 0.4 + uTime * 45.0);
          final *= scan;
          alpha *= scan;
        }

        float maxAlpha = dprScale > 1.1 ? 0.95 : 0.85;
        alpha = clamp(alpha, 0.0, maxAlpha);
        fragColor = vec4(final * alpha, alpha);
      }`;

    const vs = this.createShader(gl, gl.VERTEX_SHADER, quadVS);
    const fs = this.createShader(gl, gl.FRAGMENT_SHADER, tachoFS);
    const prog = this.createProgram(gl, vs, fs);

    if (prog) {
      this.programs.set('taco', prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  private renderTachoEffect(dt: number): void {
    const ctx = this.contexts.get('tachoGlCanvas');
    const prog = this.programs.get('taco');
    if (!ctx || !prog) return;

    const { canvas, gl } = ctx;
    this.resizeCanvas(ctx);
    this.tachoTime += dt;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);
    const buf = this.getOrCreateBuffer(gl, 'taco_buf');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(gl.getUniformLocation(prog, 'uRpm'), this.tachoRpm);
    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), this.tachoTime);
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(prog, 'uDPR'), window.devicePixelRatio || 1.0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ═══════════════════════════════════════════════════════════════
  // EFFECT 2: PEDALS (edge glow energy)
  // ═══════════════════════════════════════════════════════════════

  private initPedalsEffect(): void {
    const ctx = this.contexts.get('pedalsGlCanvas');
    if (!ctx) return;
    const { gl } = ctx;

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
      uniform float uDPR;

      float pulse(float t, float speed, float base) {
        return base + (1.0 - base) * (0.5 + 0.5 * sin(t * speed * 0.6));
      }

      void main() {
        vec2 uv = vUV;
        vec3 col = vec3(0.0);
        float alpha = 0.0;
        float dprScale = max(uDPR, 1.0);
        float dpr2 = dprScale * dprScale;

        float rightEdge  = exp(-(1.0 - uv.x) * (16.0 / dpr2));
        float leftEdge   = exp(-uv.x * (16.0 / dpr2));
        float bottomEdge = exp(-uv.y * (14.0 / dpr2));
        float topEdge    = exp(-(1.0 - uv.y) * (20.0 / dpr2));

        if (uThr > 0.01) {
          float p = pulse(uTime, 4.0 + uThr * 2.0, 0.88);
          float edge = rightEdge + bottomEdge * 0.6 + topEdge * 0.2;
          float glow = edge * uThr * p;
          col += vec3(0.20, 1.0, 0.05) * glow * 0.9 * dpr2;
          alpha += glow * 0.4 * dpr2;
        }

        if (uBrk > 0.01) {
          float p = pulse(uTime, 3.5 + uBrk * 2.5, 0.88);
          float edge = leftEdge + bottomEdge * 0.25 + topEdge * 0.15;
          float glow = edge * uBrk * p;
          col += vec3(0.92, 0.22, 0.20) * glow * 0.35 * dpr2;
          alpha += glow * 0.12 * dpr2;
        }

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

    const vs = this.createShader(gl, gl.VERTEX_SHADER, quadVS);
    const fs = this.createShader(gl, gl.FRAGMENT_SHADER, pedalsFS);
    const prog = this.createProgram(gl, vs, fs);

    if (prog) {
      this.programs.set('pedals', prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  private renderPedalsEffect(dt: number): void {
    const ctx = this.contexts.get('pedalsGlCanvas');
    const prog = this.programs.get('pedals');
    if (!ctx || !prog) return;

    const { canvas, gl } = ctx;
    this.resizeCanvas(ctx);
    this.pedalTime += dt;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);
    const buf = this.getOrCreateBuffer(gl, 'pedals_buf');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(gl.getUniformLocation(prog, 'uThr'), this.pedalValues.thr);
    gl.uniform1f(gl.getUniformLocation(prog, 'uBrk'), this.pedalValues.brk);
    gl.uniform1f(gl.getUniformLocation(prog, 'uClt'), this.pedalValues.clt);
    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), this.pedalTime);
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(prog, 'uDPR'), window.devicePixelRatio || 1.0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ═══════════════════════════════════════════════════════════════
  // EFFECT 3: FLAG (waving cloth animation)
  // ═══════════════════════════════════════════════════════════════

  private initFlagEffect(): void {
    const ctx = this.contexts.get('flagGlCanvas');
    if (!ctx) return;
    const { gl } = ctx;

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
      uniform float uPattern;
      uniform vec2  uRes;

      void main() {
        vec2 uv = vUV;
        float aspect = uRes.x / max(uRes.y, 1.0);

        float fx = uv.x;
        float fy = uv.y;

        float amp = fx * fx * 0.12;
        float w1 = sin(fx * 12.0 - uTime * 5.0) * amp;
        float w2 = sin(fx * 18.0 - uTime * 3.5 + 2.0) * amp * 0.35;
        float wave = w1 + w2;

        float fy2 = fy + wave * 0.6;

        float dWave = cos(fx * 12.0 - uTime * 5.0);
        float shade = 0.80 + 0.20 * dWave * fx;

        vec3 col;
        if (uPattern < 0.5) {
          col = uColor1;
        } else if (uPattern < 1.5) {
          float bandCount = max(4.0, floor(aspect * 1.2));
          float band = step(0.5, fract(fy2 * bandCount));
          col = mix(uColor1, uColor2, band);
        } else if (uPattern < 2.5) {
          float cellsX = max(8.0, floor(aspect * 4.0));
          float cellsY = 4.0;
          float cx = step(0.5, fract(fx * cellsX + wave * 0.5));
          float cy = step(0.5, fract(fy2 * cellsY));
          col = mix(uColor1, uColor2, abs(cx - cy));
        } else if (uPattern < 3.5) {
          float diag = step(0.5, fract((fx * aspect + fy2 * 3.0) * 1.6));
          col = mix(uColor1, uColor2, diag);
        } else {
          float cellsX = max(6.0, floor(aspect * 3.0));
          float cellsY = 3.0;
          float cx = fract(fx * cellsX + wave * 0.3);
          float cy = fract(fy2 * cellsY);
          float d = length(vec2(cx - 0.5, cy - 0.5));
          float circle = 1.0 - smoothstep(0.28, 0.34, d);
          col = mix(uColor2, uColor1, circle);
        }

        col *= shade;

        float alpha = 0.48;
        alpha *= (0.85 + 0.30 * abs(dWave) * fx);

        fragColor = vec4(col * alpha, alpha);
      }`;

    const vs = this.createShader(gl, gl.VERTEX_SHADER, quadVS);
    const fs = this.createShader(gl, gl.FRAGMENT_SHADER, flagFS);
    const prog = this.createProgram(gl, vs, fs);

    if (prog) {
      this.programs.set('flag', prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  private renderFlagEffect(dt: number): void {
    const ctx = this.contexts.get('flagGlCanvas');
    const prog = this.programs.get('flag');
    if (!ctx || !prog || !this.flagVisible) return;

    const { canvas, gl } = ctx;
    this.resizeCanvas(ctx);
    this.flagTime += dt;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);
    const buf = this.getOrCreateBuffer(gl, 'flag_buf');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), this.flagTime);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uColor1'), this.flagColors.c1);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uColor2'), this.flagColors.c2);
    gl.uniform1f(gl.getUniformLocation(prog, 'uPattern'), this.flagColors.pattern);
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ═══════════════════════════════════════════════════════════════
  // EFFECT 4: LEADERBOARD PLAYER (shimmer/glow highlight)
  // ═══════════════════════════════════════════════════════════════

  private initLeaderboardPlayerEffect(): void {
    const ctx = this.contexts.get('lbPlayerGlCanvas');
    if (!ctx) return;
    const { gl } = ctx;

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
      uniform float uPlayerTop;
      uniform float uPlayerBot;
      uniform float uMode;
      uniform vec2  uRes;

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

        vec3 baseColor;
        vec3 brightColor;
        if (uMode < 0.5) {
          baseColor  = vec3(0.25, 0.45, 0.80);
          brightColor = vec3(0.40, 0.60, 0.95);
        } else if (uMode < 1.5) {
          baseColor  = vec3(0.15, 0.70, 0.40);
          brightColor = vec3(0.25, 0.85, 0.55);
        } else if (uMode < 2.5) {
          baseColor  = vec3(0.80, 0.20, 0.15);
          brightColor = vec3(0.95, 0.35, 0.25);
        } else {
          baseColor  = vec3(0.76, 0.60, 0.22);
          brightColor = vec3(1.0, 0.88, 0.55);
        }

        float sweepSpeed = 0.25;
        float sweepX = fract(uTime * sweepSpeed);
        float beamW = 0.08;
        float beam = exp(-pow((lx - sweepX) / beamW, 2.0)) * 0.55;
        float trail = exp(-max(0.0, lx - sweepX + 0.1) * 4.0) * 0.08 * step(sweepX - 0.3, lx);
        float effect1 = beam + trail;

        float edgeY = min(ly, 1.0 - ly);
        float edgeGlow = exp(-edgeY * 10.0) * 0.35;
        float leftGlow = exp(-lx * 6.0) * 0.45;
        float pulse = 0.55 + 0.45 * sin(uTime * 1.8);
        float effect2 = (edgeGlow + leftGlow) * pulse;

        float blend = 0.5 + 0.5 * sin(uTime * 0.4);
        float effect = mix(effect1, effect2, blend);

        float rowEdge = smoothstep(0.0, 0.15, ly) * smoothstep(1.0, 0.85, ly);
        effect *= rowEdge;

        float alpha = clamp(effect * 0.55, 0.0, 0.5);
        vec3 col = baseColor;

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

    const vs = this.createShader(gl, gl.VERTEX_SHADER, quadVS);
    const fs = this.createShader(gl, gl.FRAGMENT_SHADER, lbFS);
    const prog = this.createProgram(gl, vs, fs);

    if (prog) {
      this.programs.set('lbPlayer', prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  private renderLeaderboardPlayerEffect(dt: number): void {
    const ctx = this.contexts.get('lbPlayerGlCanvas');
    const prog = this.programs.get('lbPlayer');
    if (!ctx || !prog || !this.lbHasPlayer) return;

    const { canvas, gl } = ctx;
    this.resizeCanvas(ctx);
    this.lbTime += dt;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);
    const buf = this.getOrCreateBuffer(gl, 'lbPlayer_buf');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), this.lbTime);
    gl.uniform1f(gl.getUniformLocation(prog, 'uPlayerTop'), this.lbPlayerTop);
    gl.uniform1f(gl.getUniformLocation(prog, 'uPlayerBot'), this.lbPlayerBottom);
    gl.uniform1f(gl.getUniformLocation(prog, 'uMode'), this.lbHighlightMode);
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ═══════════════════════════════════════════════════════════════
  // EFFECT 5: LEADERBOARD EVENT (position change/race state)
  // ═══════════════════════════════════════════════════════════════

  private initLeaderboardEventEffect(): void {
    const ctx = this.contexts.get('lbEventGlCanvas');
    if (!ctx) return;
    const { gl } = ctx;

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
      uniform float uMode;
      uniform vec2  uRes;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec2 uv = vUV;
        float progress = clamp(uElapsed / uDuration, 0.0, 1.0);

        float fadeOut = smoothstep(1.0, 0.4, progress);

        float alpha = 0.0;
        vec3 col = uColor;

        if (uMode < 0.5) {
          float edgeX = min(uv.x, 1.0 - uv.x);
          float edgeY = min(uv.y, 1.0 - uv.y);
          float edge = exp(-min(edgeX, edgeY) * 8.0);
          float attack = smoothstep(0.0, 0.15, progress);
          float envelope = attack * fadeOut;
          alpha = edge * envelope * 0.28;
          alpha += envelope * 0.04;
        }
        else if (uMode < 1.5) {
          float sweepPos = progress * 1.6 - 0.3;
          float sweep = exp(-pow((uv.x - sweepPos) / 0.15, 2.0));
          alpha = sweep * fadeOut * 0.22;
          alpha += fadeOut * 0.03 * (1.0 - progress);
        }
        else if (uMode < 2.5) {
          float scale = 8.0;
          float cx = floor(uv.x * scale);
          float cy = floor(uv.y * scale);
          float checker = mod(cx + cy, 2.0);
          float reveal = smoothstep(uv.x - 0.3, uv.x + 0.1, progress * 1.5);
          col = mix(vec3(0.9), vec3(0.15), checker);
          alpha = reveal * fadeOut * 0.16;
        }
        else {
          vec3 goldDeep = vec3(0.76, 0.60, 0.22);
          vec3 goldBright = vec3(1.0, 0.88, 0.55);
          vec3 goldWhite = vec3(1.0, 0.97, 0.85);

          float fadeIn = smoothstep(0.0, 0.12, progress);
          float fadeP1 = fadeIn * smoothstep(1.0, 0.5, progress);

          float edgeX = min(uv.x, 1.0 - uv.x);
          float edgeY = min(uv.y, 1.0 - uv.y);
          float edge = exp(-min(edgeX, edgeY) * 5.0);
          float edgeAlpha = edge * fadeP1 * 0.35;

          float shimmerPos = fract(uTime * 0.3 + 0.2);
          float shimmer = exp(-pow((uv.x - shimmerPos) / 0.12, 2.0)) * 0.18;
          shimmer *= fadeP1;

          float sparkle = 0.0;
          float gridScale = 18.0;
          vec2 gridCell = floor(uv * gridScale);
          float cellRand = hash21(gridCell);

          if (cellRand > 0.92) {
            vec2 cellUV = fract(uv * gridScale);
            float sparklePhase = cellRand * 6.28 + uTime * (2.0 + cellRand * 3.0);
            float blink = pow(max(0.0, sin(sparklePhase)), 24.0);
            float dist = length(cellUV - 0.5);
            float point = exp(-dist * dist * 40.0);
            float appear = smoothstep(cellRand * 0.4, cellRand * 0.4 + 0.1, progress);
            sparkle = blink * point * appear * fadeP1 * 0.65;
          }

          col = goldDeep * edgeAlpha + goldBright * shimmer + goldWhite * sparkle;
          alpha = edgeAlpha + shimmer + sparkle;
          col += goldDeep * fadeP1 * 0.03;
          alpha += fadeP1 * 0.03;
        }

        alpha = clamp(alpha, 0.0, 0.55);
        fragColor = vec4(col * alpha, alpha);
      }`;

    const vs = this.createShader(gl, gl.VERTEX_SHADER, quadVS);
    const fs = this.createShader(gl, gl.FRAGMENT_SHADER, evtFS);
    const prog = this.createProgram(gl, vs, fs);

    if (prog) {
      this.programs.set('lbEvent', prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  private renderLeaderboardEventEffect(dt: number): void {
    const ctx = this.contexts.get('lbEventGlCanvas');
    const prog = this.programs.get('lbEvent');
    if (!ctx || !prog) return;

    const { canvas, gl } = ctx;
    this.lbEvtElapsed += dt;

    if (this.lbEvtElapsed > this.lbEvtDuration) {
      if (this.lbEvtActive) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.lbEvtActive = false;
      }
      return;
    }

    this.lbEvtActive = true;
    this.resizeCanvas(ctx);
    this.lbEvtTime += dt;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);
    const buf = this.getOrCreateBuffer(gl, 'lbEvent_buf');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), this.lbEvtTime);
    gl.uniform1f(gl.getUniformLocation(prog, 'uElapsed'), this.lbEvtElapsed);
    gl.uniform1f(gl.getUniformLocation(prog, 'uDuration'), this.lbEvtDuration);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uColor'), this.lbEvtColor);
    gl.uniform1f(gl.getUniformLocation(prog, 'uMode'), this.lbEvtMode);
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ═══════════════════════════════════════════════════════════════
  // EFFECT 6: K10 LOGO (subtle chevron drift)
  // ═══════════════════════════════════════════════════════════════

  private initK10LogoEffect(): void {
    const ctx = this.contexts.get('k10LogoGlCanvas');
    if (!ctx) return;
    const { gl } = ctx;

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

      vec2 rot(vec2 p, float a) {
        float c = cos(a), s = sin(a);
        return vec2(p.x*c - p.y*s, p.x*s + p.y*c);
      }

      float sdChevron(vec2 p, float armLen, float thick, float angle) {
        vec2 q = vec2(p.x, abs(p.y));
        vec2 dir = vec2(cos(angle), sin(angle));
        float t = clamp(dot(q, dir), 0.0, armLen);
        vec2 closest = dir * t;
        return length(q - closest) - thick;
      }

      float sdChevronV(vec2 p, float size, float thick) {
        vec2 q = vec2(p.x, abs(p.y));
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

        float totalAlpha = 0.0;
        vec3 totalColor = vec3(0.0);

        {
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

        float vig = smoothstep(0.0, 0.15, min(uv.x, min(uv.y, min(1.0-uv.x, 1.0-uv.y))));
        totalAlpha *= vig;
        totalColor *= vig;

        totalAlpha = clamp(totalAlpha, 0.0, 0.06);
        fragColor = vec4(totalColor, totalAlpha);
      }`;

    const vs = this.createShader(gl, gl.VERTEX_SHADER, quadVS);
    const fs = this.createShader(gl, gl.FRAGMENT_SHADER, k10FS);
    const prog = this.createProgram(gl, vs, fs);

    if (prog) {
      this.programs.set('k10Logo', prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  private renderK10LogoEffect(dt: number): void {
    const ctx = this.contexts.get('k10LogoGlCanvas');
    const prog = this.programs.get('k10Logo');
    if (!ctx || !prog) return;

    const { canvas, gl } = ctx;
    this.resizeCanvas(ctx);
    this.k10LogoTime += dt;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);
    const buf = this.getOrCreateBuffer(gl, 'k10Logo_buf');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), this.k10LogoTime);
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ═══════════════════════════════════════════════════════════════
  // EFFECT 7: SPOTTER (edge glow for messages)
  // ═══════════════════════════════════════════════════════════════

  private initSpotterEffect(): void {
    const ctx = this.contexts.get('spotterGlCanvas');
    if (!ctx) return;
    const { gl } = ctx;

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
      uniform float uIntensity;
      uniform float uMode;
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

        vec3 col;
        float pulseSpeed;
        if (uMode < 1.5) {
          col = vec3(0.95, 0.70, 0.15);
          pulseSpeed = 2.5;
        } else if (uMode < 2.5) {
          col = vec3(0.92, 0.18, 0.12);
          pulseSpeed = 4.0;
        } else {
          col = vec3(0.15, 0.82, 0.40);
          pulseSpeed = 1.8;
        }

        float edgeX = min(uv.x, 1.0 - uv.x);
        float edgeY = min(uv.y, 1.0 - uv.y);
        float edgeDist = min(edgeX, edgeY);

        float edgeGlow = exp(-edgeDist * 12.0);

        float cornerDist = length(vec2(edgeX, edgeY));
        float cornerGlow = exp(-cornerDist * 8.0) * 0.4;

        float pulse = 0.65 + 0.35 * sin(uTime * pulseSpeed);

        float flicker = 1.0;
        if (uMode > 1.5 && uMode < 2.5) {
          flicker = 0.85 + 0.15 * sin(uTime * 11.0 + uv.x * 5.0);
        }

        float shimmer = noise(uv * 6.0 + uTime * 1.5) * 0.3 + 0.7;

        float glow = (edgeGlow + cornerGlow) * pulse * flicker * shimmer;
        glow *= uIntensity;

        float sweep = fract(uTime * 0.3);
        float perim;
        if (uv.y < 0.05) perim = uv.x * 0.25;
        else if (uv.x > 0.95) perim = 0.25 + uv.y * 0.25;
        else if (uv.y > 0.95) perim = 0.5 + (1.0 - uv.x) * 0.25;
        else if (uv.x < 0.05) perim = 0.75 + (1.0 - uv.y) * 0.25;
        else perim = -1.0;

        if (perim >= 0.0) {
          float beamDist = min(abs(perim - sweep), min(abs(perim - sweep + 1.0), abs(perim - sweep - 1.0)));
          float beam = exp(-beamDist * beamDist * 800.0) * 0.5 * uIntensity;
          glow += beam;
        }

        float alpha = clamp(glow * 0.6, 0.0, 0.65);
        fragColor = vec4(col * alpha, alpha);
      }`;

    const vs = this.createShader(gl, gl.VERTEX_SHADER, quadVS);
    const fs = this.createShader(gl, gl.FRAGMENT_SHADER, spotFS);
    const prog = this.createProgram(gl, vs, fs);

    if (prog) {
      this.programs.set('spotter', prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  private renderSpotterEffect(dt: number): void {
    const ctx = this.contexts.get('spotterGlCanvas');
    const prog = this.programs.get('spotter');
    if (!ctx || !prog) return;

    const { canvas, gl } = ctx;

    const target = this.spotMode > 0 ? 1.0 : 0.0;
    const speed = target > 0.5 ? 6.0 : 3.0;
    this.spotIntensity += (target - this.spotIntensity) * Math.min(1.0, dt * speed);

    if (this.spotIntensity < 0.005) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    if (target > 0.5) this.resizeCanvas(ctx);
    this.spotTime += dt;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);
    const buf = this.getOrCreateBuffer(gl, 'spotter_buf');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), this.spotTime);
    gl.uniform1f(gl.getUniformLocation(prog, 'uIntensity'), this.spotIntensity);
    gl.uniform1f(gl.getUniformLocation(prog, 'uMode'), this.spotMode);
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ═══════════════════════════════════════════════════════════════
  // EFFECT 8: COMMENTARY TRAIL (flowing energy border)
  // ═══════════════════════════════════════════════════════════════

  private initCommentaryTrailEffect(): void {
    const ctx = this.contexts.get('commentaryGlCanvas');
    if (!ctx) return;
    const { gl } = ctx;

    const commVS = `#version 300 es
      in vec2 aPos;
      out vec2 vUV;
      void main() {
        vUV = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }`;

    const commFS = `#version 300 es
      precision highp float;
      in vec2 vUV;
      out vec4 fragColor;

      uniform float uTime;
      uniform vec2  uRes;
      uniform float uIntensity;
      uniform float uHue;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }

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

        vec2 center = vec2(0.5);
        float cornerR = 0.06;
        vec2 d = abs(uv - center) - vec2(0.5 - cornerR);
        d.x *= aspect;
        float sdf = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - cornerR * aspect;

        float borderW = 0.022;
        float border = smoothstep(borderW, borderW * 0.3, abs(sdf));

        float angle = atan(uv.y - 0.5, (uv.x - 0.5) * aspect);
        float a = angle / 6.28318 + 0.5;

        float trail1 = pow(max(0.0, sin(a * 12.5663 + t * 3.0)), 16.0);
        float trail2 = pow(max(0.0, sin(a * 18.8496 - t * 2.2 + 1.0)), 12.0);
        float trail3 = pow(max(0.0, sin(a * 8.3776  + t * 4.5 + 2.5)), 20.0);

        float trails = (trail1 * 0.7 + trail2 * 0.5 + trail3 * 0.9);
        trails *= border;

        float shimmer = noise(vec2(a * 8.0 + t * 1.5, t * 0.3)) * 0.5 + 0.5;
        shimmer *= border * 0.35;

        float innerDist = smoothstep(0.0, -0.08, sdf);
        float ambient = innerDist * 0.04 * (0.7 + 0.3 * sin(t * 0.8));

        vec3 baseCol = hsl2rgb(uHue, 0.6, 0.55);
        vec3 brightCol = hsl2rgb(uHue, 0.7, 0.7);
        vec3 trailCol = mix(baseCol, brightCol, trails);

        float alpha = (trails * 0.6 + shimmer * 0.4 + ambient) * inten;
        vec3 col = trailCol;

        alpha = clamp(alpha, 0.0, 0.65);

        fragColor = vec4(col * alpha, alpha);
      }`;

    const cvs = this.createShader(gl, gl.VERTEX_SHADER, commVS);
    const cfs = this.createShader(gl, gl.FRAGMENT_SHADER, commFS);
    const commProg = this.createProgram(gl, cvs, cfs);

    if (commProg) {
      this.programs.set('commentary', commProg);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    }
  }

  private renderCommentaryTrailEffect(dt: number): void {
    const ctx = this.contexts.get('commentaryGlCanvas');
    const prog = this.programs.get('commentary');
    if (!ctx || !prog) return;

    const { canvas, gl } = ctx;

    if (this.commTrailActive) {
      this.commTrailIntensity = Math.min(1, this.commTrailIntensity + dt * 2.0);
      this.commTrailTime += dt;
    } else {
      this.commTrailIntensity = Math.max(0, this.commTrailIntensity - dt * 3.0);
      if (this.commTrailIntensity <= 0) return;
    }

    this.resizeCanvas(ctx);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);
    const buf = this.getOrCreateBuffer(gl, 'commentary_buf');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), this.commTrailTime);
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(prog, 'uIntensity'), this.commTrailIntensity);
    gl.uniform1f(gl.getUniformLocation(prog, 'uHue'), this.commTrailHue);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ═══════════════════════════════════════════════════════════════
  // EFFECT 9: BONKERS PIT (fire/energy burst)
  // ═══════════════════════════════════════════════════════════════

  private initBonkersEffect(): void {
    const ctx = this.contexts.get('pitGlCanvas');
    if (!ctx) return;
    const { gl } = ctx;

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
      uniform float uIntensity;

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

        float dx = abs(uv.x - 0.5) * 2.0;
        float dy = abs(uv.y - 0.5) * 2.0;
        float edgeDist = max(dx, dy);
        float border = smoothstep(0.7, 1.0, edgeDist);

        vec2 fireUV = uv * vec2(4.0, 3.0);
        fireUV.y -= t * 2.5;
        float fire = fbm(fireUV + t * 0.8);
        fire = smoothstep(0.3, 0.7, fire);
        fire *= border * inten;

        vec3 fireCol = mix(vec3(0.9, 0.1, 0.0), vec3(1.0, 0.7, 0.0), fire);
        fireCol = mix(fireCol, vec3(1.0, 1.0, 0.3), fire * fire);

        float angle = atan(uv.y - 0.5, uv.x - 0.5);
        float arc1 = sin(angle * 8.0 + t * 12.0) * 0.5 + 0.5;
        float arc2 = sin(angle * 5.0 - t * 9.0 + 1.5) * 0.5 + 0.5;
        float arcMask = smoothstep(0.82, 0.95, edgeDist);
        float arcs = (pow(arc1, 8.0) + pow(arc2, 6.0) * 0.7) * arcMask * inten;
        vec3 arcCol = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 0.9, 0.2), arc1);

        float shimmer = noise(uv * 10.0 + t * 3.0) * 0.15;
        float innerGlow = smoothstep(0.85, 0.5, edgeDist) * shimmer * inten;
        vec3 shimmerCol = vec3(0.8, 0.2, 0.0) * innerGlow;

        float pulse = (sin(t * 15.0) * 0.5 + 0.5) * 0.12 * inten * border;

        vec3 col = fireCol * fire * 0.9
                 + arcCol * arcs * 0.8
                 + shimmerCol
                 + vec3(1.0, 0.5, 0.1) * pulse;

        float alpha = fire * 0.7 + arcs * 0.6 + innerGlow + pulse;
        alpha = clamp(alpha * inten, 0.0, 0.85);

        fragColor = vec4(col * alpha, alpha);
      }`;

    const pvs = this.createShader(gl, gl.VERTEX_SHADER, pitVS);
    const pfs = this.createShader(gl, gl.FRAGMENT_SHADER, pitFS);
    const pitProg = this.createProgram(gl, pvs, pfs);

    if (pitProg) {
      this.programs.set('bonkers', pitProg);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    }
  }

  private renderBonkersEffect(dt: number): void {
    const ctx = this.contexts.get('pitGlCanvas');
    const prog = this.programs.get('bonkers');
    if (!ctx || !prog) return;

    const { canvas, gl } = ctx;

    if (this.bonkersGLActive) {
      this.bonkersIntensity = Math.min(1, this.bonkersIntensity + dt * 2.5);
      this.bonkersTime += dt;
    } else {
      this.bonkersIntensity = Math.max(0, this.bonkersIntensity - dt * 4.0);
      if (this.bonkersIntensity <= 0) return;
    }

    this.resizeCanvas(ctx);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);
    const buf = this.getOrCreateBuffer(gl, 'bonkers_buf');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), this.bonkersTime);
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(prog, 'uIntensity'), this.bonkersIntensity);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ═══════════════════════════════════════════════════════════════
  // EFFECT 10: INCIDENTS (penalty/DQ fire glow)
  // ═══════════════════════════════════════════════════════════════

  private initIncidentsEffect(): void {
    const ctx = this.contexts.get('incGlCanvas');
    if (!ctx) return;
    const { gl } = ctx;

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
      uniform float uHueShift;

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

        vec2 fireUV = uv * vec2(4.0, 3.0);
        fireUV.y -= t * 2.0;
        float fire = fbm(fireUV + t * 0.6);
        fire = smoothstep(0.35, 0.7, fire) * border * inten;

        vec3 coreCol  = mix(vec3(0.9, 0.1, 0.0), vec3(0.85, 0.65, 0.0), uHueShift);
        vec3 tipCol   = mix(vec3(1.0, 0.7, 0.0), vec3(1.0, 0.95, 0.3), uHueShift);
        vec3 brightCol = mix(vec3(1.0, 1.0, 0.3), vec3(1.0, 1.0, 0.6), uHueShift);
        vec3 fireCol = mix(coreCol, tipCol, fire);
        fireCol = mix(fireCol, brightCol, fire * fire);

        float angle = atan(uv.y - 0.5, uv.x - 0.5);
        float arcSpeed = mix(10.0, 6.0, uHueShift);
        float arc1 = sin(angle * 6.0 + t * arcSpeed) * 0.5 + 0.5;
        float arcMask = smoothstep(0.80, 0.95, edgeDist);
        float arcs = pow(arc1, 8.0) * arcMask * inten * mix(0.8, 0.4, uHueShift);
        vec3 arcCol = mix(tipCol, brightCol, arc1);

        vec3 col = fireCol * fire * 0.85 + arcCol * arcs * 0.7;
        float alpha = fire * 0.6 + arcs * 0.5;
        alpha = clamp(alpha * inten, 0.0, mix(0.80, 0.50, uHueShift));

        fragColor = vec4(col * alpha, alpha);
      }`;

    const ivs = this.createShader(gl, gl.VERTEX_SHADER, incVS);
    const ifs = this.createShader(gl, gl.FRAGMENT_SHADER, incFS);
    const incProg = this.createProgram(gl, ivs, ifs);

    if (incProg) {
      this.programs.set('incidents', incProg);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    }
  }

  private renderIncidentsEffect(dt: number): void {
    const ctx = this.contexts.get('incGlCanvas');
    const prog = this.programs.get('incidents');
    if (!ctx || !prog) return;

    const { canvas, gl } = ctx;

    const active = this.incGLMode !== '';
    if (active) {
      this.incGLIntensity = Math.min(1, this.incGLIntensity + dt * 2.0);
      this.incGLTime += dt;
    } else {
      this.incGLIntensity = Math.max(0, this.incGLIntensity - dt * 3.0);
      if (this.incGLIntensity <= 0) return;
    }

    this.resizeCanvas(ctx);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);
    const buf = this.getOrCreateBuffer(gl, 'incidents_buf');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), this.incGLTime);
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(prog, 'uIntensity'), this.incGLIntensity);
    gl.uniform1f(gl.getUniformLocation(prog, 'uHueShift'), this.incGLMode === 'penalty' ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ═══════════════════════════════════════════════════════════════
  // EFFECT 11: GRID FLAG (aurora-like wisps)
  // ═══════════════════════════════════════════════════════════════

  private initGridFlagEffect(): void {
    const ctx = this.contexts.get('gridFlagGlCanvas');
    if (!ctx) return;
    const { gl } = ctx;

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

      float roundedBox(vec2 p, vec2 b, float r) {
        vec2 d = abs(p) - b + r;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
      }

      void main() {
        vec2 uv = vUV;
        float aspect = uRes.x / uRes.y;
        vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
        float t = uTime;

        vec2 boxSize = vec2(aspect * 0.30, 0.34);
        float r = 0.035;
        float d = roundedBox(p, boxSize, r);

        if (d < -0.005) { fragColor = vec4(0.0); return; }

        float angle = atan(p.y, p.x);
        float edgeDist = max(0.0, d);

        float n1 = fbm(vec2(angle * 1.2 - t * 0.4, edgeDist * 3.0 + t * 0.2));
        float n2 = fbm(vec2(angle * 1.2 + t * 0.5 + 2.094, edgeDist * 3.0 - t * 0.15));
        float n3 = fbm(vec2(angle * 1.2 - t * 0.35 + 4.189, edgeDist * 3.0 + t * 0.25));

        float falloff = exp(-edgeDist * 4.5);
        float w1 = pow(n1, 2.5) * falloff;
        float w2 = pow(n2, 2.5) * falloff;
        float w3 = pow(n3, 2.5) * falloff;

        vec3 c1 = uCol1 * 0.8 + 0.2;
        vec3 c2 = uCol2 * 0.8 + 0.2;
        vec3 c3 = uCol3 * 0.8 + 0.2;

        vec3 col = c1 * w1 + c2 * w2 + c3 * w3;

        float edgeGlow = exp(-edgeDist * 12.0) * 0.35;
        float wTotal = w1 + w2 + w3 + 0.001;
        vec3 edgeCol = (c1 * w1 + c2 * w2 + c3 * w3) / wTotal;
        col += edgeCol * edgeGlow;

        float sparkNoise = noise(uv * 40.0 + t * vec2(1.3, 0.7));
        float sparkMask = smoothstep(0.92, 0.96, sparkNoise) * falloff * 1.5;
        col += edgeCol * sparkMask;

        float pulse = 0.85 + 0.15 * sin(t * 1.5);

        float alpha = (w1 + w2 + w3 + edgeGlow + sparkMask * 0.5) * uIntensity * pulse;
        alpha = clamp(alpha, 0.0, 0.7);

        float canvasEdge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
        alpha *= smoothstep(0.0, 0.08, canvasEdge);

        fragColor = vec4(col * alpha, alpha);
      }`;

    const fvs = this.createShader(gl, gl.VERTEX_SHADER, flagVS);
    const ffs = this.createShader(gl, gl.FRAGMENT_SHADER, flagFS);
    const flagProg = this.createProgram(gl, fvs, ffs);

    if (flagProg) {
      this.programs.set('gridFlag', flagProg);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    }
  }

  private renderGridFlagEffect(dt: number): void {
    const ctx = this.contexts.get('gridFlagGlCanvas');
    const prog = this.programs.get('gridFlag');
    if (!ctx || !prog) return;

    const { canvas, gl } = ctx;

    if (this.flagGLActive) {
      this.flagGLIntensity = Math.min(1, this.flagGLIntensity + dt * 1.5);
      this.flagGLTime += dt;
    } else {
      this.flagGLIntensity = Math.max(0, this.flagGLIntensity - dt * 2.0);
      if (this.flagGLIntensity <= 0) return;
    }

    this.resizeCanvas(ctx);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);
    const buf = this.getOrCreateBuffer(gl, 'gridFlag_buf');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), this.flagGLTime);
    gl.uniform1f(gl.getUniformLocation(prog, 'uIntensity'), this.flagGLIntensity);
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uCol1'), this.gridFlagCol1);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uCol2'), this.gridFlagCol2);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uCol3'), this.gridFlagCol3);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API METHODS
  // ═══════════════════════════════════════════════════════════════

  setFlagGLColors(flagType: string): void {
    const def = this.flagGLColors[flagType];
    if (def) {
      this.flagColors.c1 = def.c1;
      this.flagColors.c2 = def.c2;
      this.flagColors.pattern = def.pattern;
      this.flagVisible = true;
    } else {
      this.flagVisible = false;
    }
  }

  setBonkersGL(active: boolean): void {
    this.bonkersGLActive = active;
    if (active) this.bonkersTime = 0;
  }

  setSpotterGlow(type: string): void {
    switch (type) {
      case 'warn':
        this.spotMode = 1;
        break;
      case 'danger':
        this.spotMode = 2;
        break;
      case 'clear':
        this.spotMode = 3;
        break;
      default:
        this.spotMode = 0;
    }
  }

  setCommentaryTrailGL(active: boolean, hue?: number): void {
    this.commTrailActive = active;
    if (typeof hue === 'number') this.commTrailHue = hue;
    if (active) this.commTrailTime = 0;
  }

  setIncidentsGL(mode: string): void {
    const prev = this.incGLMode;
    this.incGLMode = mode || '';
    if (this.incGLMode && !prev) this.incGLTime = 0;
  }

  triggerLBEvent(type: string): void {
    switch (type) {
      case 'gain':
        this.lbEvtColor = [0.1, 0.85, 0.35];
        this.lbEvtDuration = 1.0;
        this.lbEvtMode = 0;
        break;
      case 'lose':
        this.lbEvtColor = [0.9, 0.15, 0.1];
        this.lbEvtDuration = 1.0;
        this.lbEvtMode = 0;
        break;
      case 'p1':
        this.lbEvtColor = [0.76, 0.6, 0.22];
        this.lbEvtDuration = 3.5;
        this.lbEvtMode = 3;
        break;
      case 'green':
        this.lbEvtColor = [0.1, 0.85, 0.35];
        this.lbEvtDuration = 2.0;
        this.lbEvtMode = 1;
        break;
      case 'finish':
        this.lbEvtColor = [0.9, 0.9, 0.9];
        this.lbEvtDuration = 2.5;
        this.lbEvtMode = 2;
        break;
    }
    this.lbEvtElapsed = 0;
    this.lbEvtActive = true;
  }

  updateLBPlayerPos(top: number, bottom: number, hasPlayer: boolean): void {
    this.lbPlayerTop = top;
    this.lbPlayerBottom = bottom;
    this.lbHasPlayer = hasPlayer;
  }

  setLBHighlightMode(mode: number): void {
    this.lbHighlightMode = mode;
  }

  setGridFlagGL(active: boolean): void {
    this.flagGLActive = active;
    if (active) this.flagGLTime = 0;
  }

  setGridFlagColors(hex1: string, hex2: string, hex3: string): void {
    const hexToGL = (hex: string) => {
      hex = hex.replace('#', '');
      return [
        parseInt(hex.substring(0, 2), 16) / 255,
        parseInt(hex.substring(2, 4), 16) / 255,
        parseInt(hex.substring(4, 6), 16) / 255,
      ];
    };
    this.gridFlagCol1 = hexToGL(hex1) as [number, number, number];
    this.gridFlagCol2 = hexToGL(hex2) as [number, number, number];
    this.gridFlagCol3 = hexToGL(hex3) as [number, number, number];
  }

  updateGLFX(rpmRatio: number, thr: number, brk: number, clt: number): void {
    this.tachoRpm = rpmRatio;
    this.pedalValues.thr = thr;
    this.pedalValues.brk = brk;
    this.pedalValues.clt = clt;
  }
}
