import { useState, useEffect, useRef, useCallback } from 'react';
import { useTelemetry } from '@hooks/useTelemetry';

const TRAIL_LEN = 40;
const YAW_TRAIL_LEN = 80;

/**
 * G-force diamond canvas — matches original datastream.js drawGforceDiamond()
 */
function GForceDiamond({
  latG,
  longG,
}: {
  latG: number;
  longG: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailLatRef = useRef(new Float32Array(TRAIL_LEN));
  const trailLongRef = useRef(new Float32Array(TRAIL_LEN));
  const trailIdxRef = useRef(0);
  const trailCountRef = useRef(0);
  const peakGRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = 64, cssH = 64;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const cx = cssW / 2, cy = cssH / 2;
    const maxG = 3.0;
    const r = 28;

    // Diamond outline (rotated square)
    ctx.strokeStyle = 'hsla(0,0%,100%,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.stroke();

    // Inner crosshair grid
    ctx.strokeStyle = 'hsla(0,0%,100%,0.04)';
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
    ctx.stroke();

    // Half-diamond
    ctx.strokeStyle = 'hsla(0,0%,100%,0.03)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r / 2);
    ctx.lineTo(cx + r / 2, cy);
    ctx.lineTo(cx, cy + r / 2);
    ctx.lineTo(cx - r / 2, cy);
    ctx.closePath();
    ctx.stroke();

    // G-force trail
    const count = Math.min(trailCountRef.current, TRAIL_LEN);
    if (count > 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'hsla(210,60%,55%,0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < count; i++) {
        const idx = (trailIdxRef.current - 1 - i + TRAIL_LEN) % TRAIL_LEN;
        const px = cx + (trailLatRef.current[idx] / maxG) * r;
        const py = cy - (trailLongRef.current[idx] / maxG) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Store trail sample
    trailLatRef.current[trailIdxRef.current] = latG;
    trailLongRef.current[trailIdxRef.current] = longG;
    trailIdxRef.current = (trailIdxRef.current + 1) % TRAIL_LEN;
    trailCountRef.current++;

    // Current G dot
    const dotX = cx + (latG / maxG) * r;
    const dotY = cy - (longG / maxG) * r;
    const totalG = Math.sqrt(latG * latG + longG * longG);

    if (totalG > peakGRef.current) peakGRef.current = totalG;

    // Dot color: blue at low G, shifts toward red/orange at high G
    const hue = Math.max(0, 210 - totalG * 50);
    const lum = 55 + totalG * 5;
    ctx.fillStyle = `hsl(${hue},70%,${lum}%)`;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.fillStyle = `hsla(${hue},70%,${lum}%,0.25)`;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
    ctx.fill();
  }, [latG, longG]);

  return <canvas ref={canvasRef} id="dsGforceCanvas" style={{ width: 64, height: 64 }} />;
}

interface DatastreamPanelProps {
  posClasses?: string;
  panelStyle?: React.CSSProperties;
}

export default function DatastreamPanel({ posClasses, panelStyle }: DatastreamPanelProps) {
  const { telemetry } = useTelemetry();

  const [peakG, setPeakG] = useState(0);
  const yawTrailRef = useRef(new Float32Array(YAW_TRAIL_LEN));
  const yawTrailIdxRef = useRef(0);
  const yawTrailCountRef = useRef(0);
  const yawCanvasRef = useRef<HTMLCanvasElement>(null);

  // Track peak G
  useEffect(() => {
    const totalG = Math.sqrt(telemetry.latG ** 2 + telemetry.longG ** 2);
    setPeakG((prev) => Math.max(prev, totalG));
  }, [telemetry.latG, telemetry.longG]);

  // Render yaw trail waveform — matches original renderYawTrail()
  const renderYawTrail = useCallback((yawRate: number) => {
    // Store sample in ring buffer
    yawTrailRef.current[yawTrailIdxRef.current] = yawRate;
    yawTrailIdxRef.current = (yawTrailIdxRef.current + 1) % YAW_TRAIL_LEN;
    yawTrailCountRef.current++;

    const canvas = yawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const count = Math.min(yawTrailCountRef.current, YAW_TRAIL_LEN);
    if (count < 2) return;

    const maxYaw = 1.5;
    const mid = h / 2;

    // Draw filled waveform — left=oldest, right=newest
    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let i = 0; i < count; i++) {
      const idx = (yawTrailIdxRef.current - count + i + YAW_TRAIL_LEN) % YAW_TRAIL_LEN;
      const x = (i / (count - 1)) * w;
      const val = yawTrailRef.current[idx];
      const y = mid - (val / maxYaw) * (mid - 2);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, mid);
    ctx.closePath();

    // Gradient fill: newest edge is bright, oldest fades out
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    const absYaw = Math.abs(yawRate);
    const hue = Math.max(0, 210 - absYaw * 120);
    grad.addColorStop(0, `hsla(${hue}, 60%, 50%, 0.02)`);
    grad.addColorStop(0.7, `hsla(${hue}, 65%, 50%, 0.15)`);
    grad.addColorStop(1, `hsla(${hue}, 70%, 55%, 0.35)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke the waveform line
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const idx = (yawTrailIdxRef.current - count + i + YAW_TRAIL_LEN) % YAW_TRAIL_LEN;
      const x = (i / (count - 1)) * w;
      const val = yawTrailRef.current[idx];
      const y = mid - (val / maxYaw) * (mid - 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const strokeGrad = ctx.createLinearGradient(0, 0, w, 0);
    strokeGrad.addColorStop(0, `hsla(${hue}, 60%, 55%, 0.05)`);
    strokeGrad.addColorStop(0.8, `hsla(${hue}, 70%, 55%, 0.3)`);
    strokeGrad.addColorStop(1, `hsla(${hue}, 75%, 60%, 0.6)`);
    ctx.strokeStyle = strokeGrad;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Center line (zero yaw reference)
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.strokeStyle = 'hsla(0, 0%, 100%, 0.06)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }, []);

  // Update yaw trail on each tick
  useEffect(() => {
    renderYawTrail(telemetry.yawRate);
  }, [telemetry.yawRate, renderYawTrail]);

  // Yaw bar: centered, extends left for negative, right for positive (matches original)
  const maxYaw = 1.5;
  const yawPct = Math.min(Math.abs(telemetry.yawRate) / maxYaw, 1.0) * 50;
  const yawBarStyle: React.CSSProperties = telemetry.yawRate >= 0
    ? { left: '50%', width: `${yawPct}%` }
    : { left: `${50 - yawPct}%`, width: `${yawPct}%` };
  const yawHue = Math.max(0, 210 - Math.abs(telemetry.yawRate) * 120);
  yawBarStyle.background = `hsla(${yawHue},70%,55%,0.7)`;

  const deltaClass = telemetry.lapDelta < -0.05 ? 'ds-negative' : telemetry.lapDelta > 0.05 ? 'ds-positive' : 'ds-neutral';

  return (
    <div className={`datastream-panel ${posClasses || 'ds-bottom ds-left'}`} id="datastreamPanel" style={panelStyle}>
      <div className="ds-inner">
        <div className="ds-header">Datastream</div>
        <div className="ds-gforce">
          <div className="ds-gforce-diamond">
            <GForceDiamond
              latG={telemetry.latG}
              longG={telemetry.longG}
            />
          </div>
          <div className="ds-gforce-vals">
            <div className="ds-row" style={{ border: 'none', padding: '0' }}>
              <span className="ds-label">Lat</span>
              <span className="ds-value" id="dsLatG">{Math.abs(telemetry.latG).toFixed(2)}g</span>
            </div>
            <div className="ds-row" style={{ border: 'none', padding: '0' }}>
              <span className="ds-label">Long</span>
              <span className="ds-value" id="dsLongG">{Math.abs(telemetry.longG).toFixed(2)}g</span>
            </div>
            <div className="ds-row" style={{ border: 'none', padding: '0' }}>
              <span className="ds-label">Peak</span>
              <span className="ds-value" id="dsPeakG" style={{ color: 'var(--text-dim)' }}>{peakG.toFixed(2)}g</span>
            </div>
          </div>
        </div>
        <div className="ds-row">
          <span className="ds-label">Yaw</span>
          <span className="ds-value" id="dsYawRate">{Math.abs(telemetry.yawRate).toFixed(2)} r/s</span>
        </div>
        <div className="ds-yaw-bar">
          <div className="ds-yaw-fill" id="dsYawFill" style={yawBarStyle}></div>
        </div>
        <canvas ref={yawCanvasRef} className="ds-yaw-trail" id="dsYawTrail" width="200" height="28"></canvas>
        <div className="ds-row">
          <span className="ds-label">FFB</span>
          <span className="ds-value" id="dsSteerTorque">{telemetry.steerTorque.toFixed(1)} Nm</span>
        </div>
        <div className="ds-row">
          <span className="ds-label">Delta</span>
          <span className={`ds-value ${deltaClass}`} id="dsDelta">
            {telemetry.lapDelta >= 0 ? '+' : ''}{telemetry.lapDelta.toFixed(3)}
          </span>
        </div>
        <div className="ds-row">
          <span className="ds-label">Track</span>
          <span className="ds-value" id="dsTrackTemp">{telemetry.trackTemp > 0 ? telemetry.trackTemp.toFixed(1) + '°C' : '—°C'}</span>
        </div>
        <div className="ds-row">
          <span className="ds-label">FPS</span>
          <span className="ds-value" style={{ color: 'var(--text-dim)' }} id="dsFPS">—</span>
        </div>
      </div>
    </div>
  );
}
