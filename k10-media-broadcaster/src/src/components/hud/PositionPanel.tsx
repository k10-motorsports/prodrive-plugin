import { useState, useEffect, useRef, useMemo } from 'react';
import { useTelemetry } from '@hooks/useTelemetry';
import { fmtLap } from '@lib/formatters';

export default function PositionPanel() {
  const { telemetry } = useTelemetry();

  const [activePage, setActivePage] = useState<'position' | 'rating'>('position');
  const startPositionRef = useRef<number>(0);
  const hasRatingDataRef = useRef(false);

  // Track starting position
  useEffect(() => {
    if (startPositionRef.current === 0 && telemetry.position > 0) {
      startPositionRef.current = telemetry.position;
    }
  }, [telemetry.position]);

  // Track if we have rating data
  useEffect(() => {
    if (telemetry.iRating > 0 || telemetry.safetyRating > 0) {
      hasRatingDataRef.current = true;
    }
  }, [telemetry.iRating, telemetry.safetyRating]);

  // Auto-cycle between pages every 10 seconds (only if rating data available)
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasRatingDataRef.current) {
        setActivePage((prev) => (prev === 'rating' ? 'position' : 'rating'));
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Position delta
  const startPos = startPositionRef.current;
  const posDelta = startPos > 0 ? telemetry.position - startPos : 0;
  const posIndicator = posDelta > 0 ? `▼${Math.abs(posDelta)}` : posDelta < 0 ? `▲${Math.abs(posDelta)}` : '';
  const posIndicatorColor = posDelta > 0 ? 'var(--red)' : posDelta < 0 ? 'var(--green)' : 'var(--text-dim)';
  const posDeltaVisible = posDelta !== 0;

  // iRating bar: 0-5000 range mapped to 0-100%
  const iRatingPercent = Math.max(0, Math.min(100, (telemetry.iRating / 5000) * 100));

  // SR pie: 0-4.0 range
  const srPerimeter = 2 * Math.PI * 15;
  const srOffset = srPerimeter - (telemetry.safetyRating / 4.0) * srPerimeter;
  const srColor = telemetry.safetyRating >= 3.0 ? 'var(--green)'
    : telemetry.safetyRating >= 2.0 ? 'var(--amber)' : 'var(--red)';

  // Shared position layout (used in both cycle-sizer and position page)
  const positionContent = (
    <div className="pos-layout">
      <div className="pos-number">
        <span className="skew-accent">
          P{telemetry.position > 0 ? telemetry.position : '—'}
        </span>
        <div
          className={`pos-delta${posDeltaVisible ? ' visible' : ''}${posDelta < 0 ? ' delta-up' : posDelta > 0 ? ' delta-down' : ' delta-same'}`}
          style={{ color: posIndicatorColor }}
        >
          {posIndicator}
        </div>
      </div>
      <div className="pos-meta">
        <div className="pos-meta-row">
          Lap <span className="val">{telemetry.currentLap > 0 ? telemetry.currentLap : '—'}</span>
        </div>
        <div className="pos-meta-row best-row">
          <span className="val purple">{fmtLap(telemetry.bestLapTime)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="panel cycle-container rating-pos-block" id="cycleRatingPos">
      {/* Invisible sizer keeps the container tall enough */}
      <div className="cycle-sizer">
        {positionContent}
      </div>

      {/* Page A: Rating (iRating + Safety) */}
      <div className={`cycle-page ${activePage === 'rating' ? 'active' : 'inactive'}`} id="ratingPage">
        <div className="rating-row">
          <div className="rating-item">
            <div className="panel-label">iRating</div>
            <div className="rating-value">{telemetry.iRating > 0 ? telemetry.iRating : '—'}</div>
            <div className="rating-delta">—</div>
            <div className="ir-bar-container">
              <div className="ir-bar-track">
                <div
                  className="ir-bar-fill"
                  id="irBarFill"
                  style={{ width: `${iRatingPercent}%` }}
                />
                <div className="ir-bar-ticks">
                  <div className="ir-bar-tick" style={{ left: '20%' }} />
                  <div className="ir-bar-tick-label" style={{ left: '20%' }}>1k</div>
                  <div className="ir-bar-tick" style={{ left: '40%' }} />
                  <div className="ir-bar-tick-label" style={{ left: '40%' }}>2k</div>
                  <div className="ir-bar-tick" style={{ left: '60%' }} />
                  <div className="ir-bar-tick-label" style={{ left: '60%' }}>3k</div>
                  <div className="ir-bar-tick" style={{ left: '80%' }} />
                  <div className="ir-bar-tick-label" style={{ left: '80%' }}>4k</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rating-item">
            <div className="panel-label">Safety</div>
            <div className="rating-value" style={{ fontSize: '14px' }}>
              {telemetry.safetyRating > 0 ? telemetry.safetyRating.toFixed(2) : '—'}
            </div>
            <div className="rating-delta">—</div>
            <div className="sr-pie-container">
              <svg className="sr-pie-svg" viewBox="0 0 40 40">
                <circle className="sr-pie-bg" cx="20" cy="20" r="15" />
                <circle
                  className="sr-pie-fill"
                  id="srPieFill"
                  cx="20"
                  cy="20"
                  r="15"
                  stroke={srColor}
                  strokeDasharray={srPerimeter}
                  strokeDashoffset={srOffset}
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Page B: Position */}
      <div className={`cycle-page ${activePage === 'position' ? 'active' : 'inactive'}`} id="positionPage">
        {positionContent}
      </div>

      {/* Cycle dots */}
      <div className="cycle-dots">
        <div
          className={`cycle-dot ${activePage === 'rating' ? 'active' : ''}`}
          id="dotRating"
          onClick={() => setActivePage('rating')}
        />
        <div
          className={`cycle-dot ${activePage === 'position' ? 'active' : ''}`}
          id="dotPos"
          onClick={() => setActivePage('position')}
        />
      </div>
    </div>
  );
}
