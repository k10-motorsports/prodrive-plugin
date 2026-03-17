import { useMemo, useRef, useEffect } from 'react';
import { useTelemetry } from '@hooks/useTelemetry';

/**
 * Tachometer HUD Component
 * Displays gear, speed, RPM with visual bar indicator and redline state.
 * - 11 segments colored by RPM ratio: green (<55%), yellow (55-73%), red (73-91%), redline (>91%)
 * - RPM text pulses when new segments light up
 * - Whole component gets 'tacho-redline' class when in redline state
 */
export function Tachometer() {
  const { telemetry } = useTelemetry();
  const prevLitRef = useRef(0);
  const rpmRef = useRef<HTMLSpanElement>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rpmRatio = useMemo(() => {
    if (!telemetry.maxRpm || telemetry.maxRpm <= 0) return 0;
    return Math.min(telemetry.rpm / telemetry.maxRpm, 1.0);
  }, [telemetry.rpm, telemetry.maxRpm]);

  const isRedline = rpmRatio >= 0.91;
  const lit = Math.round(rpmRatio * 11);

  // Determine top color for RPM text (matches original thresholds)
  const rpmColor = useMemo(() => {
    let topColor = 'dim';
    for (let i = 0; i < 11; i++) {
      if (i < lit) {
        const f = i / 11;
        if (f < 0.55) topColor = 'green';
        else if (f < 0.73) topColor = 'yellow';
        else topColor = 'red';
      }
    }
    const colorMap: Record<string, string> = {
      green: 'var(--green)',
      yellow: 'var(--amber)',
      red: 'var(--red)',
      dim: 'var(--text-dim)',
    };
    return colorMap[topColor];
  }, [lit]);

  // Pulse RPM text when a new segment lights up (matches original)
  useEffect(() => {
    const el = rpmRef.current;
    if (!el) return;
    if (lit > prevLitRef.current && lit > 0) {
      let topColor = 'green';
      for (let i = 0; i < lit; i++) {
        const f = i / 11;
        if (f >= 0.73) topColor = 'red';
        else if (f >= 0.55) topColor = 'yellow';
      }
      const pulseClass = topColor === 'green' ? 'rpm-pulse-green'
        : topColor === 'yellow' ? 'rpm-pulse-yellow' : 'rpm-pulse-red';
      el.classList.remove('rpm-pulse-green', 'rpm-pulse-yellow', 'rpm-pulse-red');
      void el.offsetWidth;
      el.classList.add(pulseClass);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = setTimeout(() => {
        el.classList.remove('rpm-pulse-green', 'rpm-pulse-yellow', 'rpm-pulse-red');
      }, 180);
    }
    prevLitRef.current = lit;
  }, [lit]);

  // Generate 11 tachometer segments (matches original thresholds: 0.55, 0.73, 0.91)
  const segments = useMemo(() => {
    const result = [];
    for (let i = 0; i < 11; i++) {
      let segmentClass = 'tacho-seg';
      const isLit = i < lit;

      if (isLit) {
        const f = i / 11;
        if (f < 0.55) segmentClass += ' lit-green';
        else if (f < 0.73) segmentClass += ' lit-yellow';
        else if (f < 0.91) segmentClass += ' lit-red';
        else segmentClass += ' lit-redline';
      }

      result.push(
        <div
          key={i}
          className={segmentClass}
          style={{ height: isLit ? '100%' : '2px' }}
        />
      );
    }
    return result;
  }, [lit]);

  const blockClass = isRedline
    ? 'panel tacho-block tacho-redline'
    : 'panel tacho-block';

  return (
    <div className={blockClass}>
      <canvas className="gl-overlay" id="tachoGlCanvas"></canvas>
      <div className="tacho-top-row">
        <div className="tacho-gear" id="gearText">
          {telemetry.gear || 'N'}
        </div>
        <div className="tacho-speed-cluster">
          <div className="speed-value" id="speedText">
            {Math.round(telemetry.speedMph)}
          </div>
          <div className="speed-unit">MPH</div>
        </div>
      </div>

      <span className="tacho-rpm" id="rpmText" ref={rpmRef} style={{ color: rpmColor }}>
        {Math.round(telemetry.rpm)}
      </span>

      <div className="tacho-bar-track" id="tachoBar">
        {segments}
      </div>
    </div>
  );
}
