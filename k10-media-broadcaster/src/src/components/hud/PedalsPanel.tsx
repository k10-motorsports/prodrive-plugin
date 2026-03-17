import { useState, useRef, useEffect } from 'react';
import { useTelemetry } from '@hooks/useTelemetry';
import { fmtPercent } from '@lib/formatters';

const HISTORY_LENGTH = 20;
const PEDAL_TRACE_LEN = 120;

export default function PedalsPanel() {
  const { telemetry } = useTelemetry();

  // History arrays for pedals (0-1 range)
  const [throttleHist, setThrottleHist] = useState<number[]>(Array(HISTORY_LENGTH).fill(0));
  const [brakeHist, setBrakeHist] = useState<number[]>(Array(HISTORY_LENGTH).fill(0));
  const [clutchHist, setClutchHist] = useState<number[]>(Array(HISTORY_LENGTH).fill(0));

  const frameCountRef = useRef(0);

  // Pedal trace ring buffers and canvas context
  const pedalTraceCanvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const ptThrRef = useRef(new Float32Array(PEDAL_TRACE_LEN));
  const ptBrkRef = useRef(new Float32Array(PEDAL_TRACE_LEN));
  const ptCltRef = useRef(new Float32Array(PEDAL_TRACE_LEN));
  const ptIndexRef = useRef(0);

  // Initialize canvas context
  useEffect(() => {
    if (pedalTraceCanvasRef.current) {
      ctxRef.current = pedalTraceCanvasRef.current.getContext('2d');
    }
  }, []);

  // Update history every other frame
  useEffect(() => {
    frameCountRef.current++;

    if (frameCountRef.current % 2 === 0) {
      setThrottleHist((prev) => [...prev.slice(1), telemetry.throttleRaw]);
      setBrakeHist((prev) => [...prev.slice(1), telemetry.brakeRaw]);
      setClutchHist((prev) => [...prev.slice(1), telemetry.clutchRaw]);
    }
  }, [telemetry.throttleRaw, telemetry.brakeRaw, telemetry.clutchRaw]);

  // Update pedal trace canvas
  useEffect(() => {
    const ctx = ctxRef.current;
    const canvas = pedalTraceCanvasRef.current;
    if (!ctx || !canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 4;
    const drawHeight = height - padding * 2;

    // Add current sample to ring buffer
    const idx = ptIndexRef.current;
    ptThrRef.current[idx] = telemetry.throttleRaw;
    ptBrkRef.current[idx] = telemetry.brakeRaw;
    ptCltRef.current[idx] = telemetry.clutchRaw;
    ptIndexRef.current = (idx + 1) % PEDAL_TRACE_LEN;

    // Clear canvas
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, width, height);

    // Helper to draw a pedal trace line
    const drawTrace = (buffer: Float32Array, color: string) => {
      const pixelsPerSample = width / PEDAL_TRACE_LEN;

      // Create gradient from transparent to opaque
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, `${color}00`); // transparent at left (oldest)
      gradient.addColorStop(1, color); // opaque at right (newest)

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      for (let i = 0; i < PEDAL_TRACE_LEN; i++) {
        const bufferIdx = (ptIndexRef.current + i) % PEDAL_TRACE_LEN;
        const value = buffer[bufferIdx] ?? 0;
        const x = i * pixelsPerSample;
        const y = height - padding - value * drawHeight;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    };

    // Draw the three pedal traces
    drawTrace(ptThrRef.current, '#00ff00'); // green throttle
    drawTrace(ptBrkRef.current, '#ff0000'); // red brake
    drawTrace(ptCltRef.current, '#0080ff'); // blue clutch

    // Draw glow dots at the leading edge (newest sample)
    const leadIdx = (ptIndexRef.current - 1 + PEDAL_TRACE_LEN) % PEDAL_TRACE_LEN;
    const leadX = (PEDAL_TRACE_LEN - 1) * (width / PEDAL_TRACE_LEN);
    const dotRadius = 3;
    const glowRadius = 6;

    const drawGlowDot = (buffer: Float32Array, color: string) => {
      const value = buffer[leadIdx] ?? 0;
      if (value < 0.02) return; // Only draw if value > 0.02

      const y = height - padding - value * drawHeight;

      // Glow
      ctx.fillStyle = `${color}40`;
      ctx.beginPath();
      ctx.arc(leadX, y, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(leadX, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    };

    drawGlowDot(ptThrRef.current, '#00ff00');
    drawGlowDot(ptBrkRef.current, '#ff0000');
    drawGlowDot(ptCltRef.current, '#0080ff');
  }, [telemetry.throttleRaw, telemetry.brakeRaw, telemetry.clutchRaw]);

  return (
    <div
      className="panel pedals-area"
      id="pedalsArea"
      style={{ '--thr-glow': telemetry.throttleRaw } as React.CSSProperties}
    >
      <canvas className="gl-overlay" id="pedalsGlCanvas"></canvas>

      <div className="pedal-labels-row">
        <div className="pedal-label-group">
          <div className="pedal-channel-label throttle">THROTTLE</div>
          <div className="pedal-pct" style={{ color: 'var(--green)' }}>
            {fmtPercent(telemetry.throttleRaw)}
          </div>
        </div>
        <div className="pedal-label-group">
          <div className="pedal-channel-label brake">BRAKE</div>
          <div className="pedal-pct" style={{ color: 'var(--red)' }}>
            {fmtPercent(telemetry.brakeRaw)}
          </div>
        </div>
        <div className="pedal-label-group" id="clutchLabelGroup">
          <div className="pedal-channel-label clutch">CLUTCH</div>
          <div className="pedal-pct" style={{ color: 'var(--blue)' }}>
            {fmtPercent(telemetry.clutchRaw)}
          </div>
        </div>
      </div>

      <div className="pedal-viz-stack">
        <div className="pedal-viz-layer throttle-layer" id="throttleHist">
          {throttleHist.map((value, i) => (
            <div
              key={i}
              className={`pedal-hist-bar throttle${i === HISTORY_LENGTH - 1 ? ' live' : ''}`}
              style={{ height: `${Math.max(1, value * 100)}%` }}
            />
          ))}
        </div>
        <div className="pedal-viz-layer brake-layer" id="brakeHist">
          {brakeHist.map((value, i) => (
            <div
              key={i}
              className={`pedal-hist-bar brake${i === HISTORY_LENGTH - 1 ? ' live' : ''}`}
              style={{ height: `${Math.max(1, value * 100)}%` }}
            />
          ))}
        </div>
        <div className="pedal-viz-layer clutch-layer" id="clutchHist">
          {clutchHist.map((value, i) => (
            <div
              key={i}
              className={`pedal-hist-bar clutch${i === HISTORY_LENGTH - 1 ? ' live' : ''}`}
              style={{ height: `${Math.max(1, value * 100)}%` }}
            />
          ))}
        </div>
        <canvas ref={pedalTraceCanvasRef} className="pedal-trace-canvas" id="pedalTraceCanvas" width={240} height={80}></canvas>
      </div>
    </div>
  );
}
