import { useMemo, useRef } from 'react';
import { useTelemetry } from '@hooks/useTelemetry';

export default function TrackMaps() {
  const { telemetry } = useTelemetry();

  // Smoothing state (matches original low-pass filter)
  const smoothedRef = useRef({ x: 0, y: 0, hasInit: false });

  // Parse opponent positions from "x1,y1,p1;x2,y2,p2;..." format
  const opponents = useMemo(() => {
    if (!telemetry.opponentMapPositions) return [];

    return telemetry.opponentMapPositions
      .split(';')
      .filter((entry) => entry.trim())
      .map((entry) => {
        const parts = entry.split(',');
        return {
          x: Math.max(0, Math.min(100, parseFloat(parts[0] ?? '0') || 0)),
          y: Math.max(0, Math.min(100, parseFloat(parts[1] ?? '0') || 0)),
          inPit: parseInt(parts[2] ?? '0', 10) === 1,
        };
      });
  }, [telemetry.opponentMapPositions]);

  // Player position with smoothing (matches original)
  const playerX = Math.max(0, Math.min(100, telemetry.playerMapX || 50));
  const playerY = Math.max(0, Math.min(100, telemetry.playerMapY || 50));

  const smoothed = smoothedRef.current;
  if (!smoothed.hasInit) {
    smoothed.x = playerX;
    smoothed.y = playerY;
    smoothed.hasInit = true;
  } else {
    const dx = playerX - smoothed.x;
    const dy = playerY - smoothed.y;
    const jump = Math.sqrt(dx * dx + dy * dy);
    // Matches original: large jump (>20 SVG units) → slow blend, else fast
    const alpha = jump > 20 ? 0.08 : 0.45;
    smoothed.x += dx * alpha;
    smoothed.y += dy * alpha;
  }

  const sx = smoothed.x;
  const sy = smoothed.y;

  // Zoom viewBox: ±15 units around player, clamped to 0-100 (matches original)
  const zoomViewBox = useMemo(() => {
    const zr = 15;
    const vx = Math.max(0, Math.min(100 - zr * 2, sx - zr));
    const vy = Math.max(0, Math.min(100 - zr * 2, sy - zr));
    return `${vx.toFixed(1)} ${vy.toFixed(1)} ${zr * 2} ${zr * 2}`;
  }, [sx, sy]);

  // Start/finish marker position from path start
  const sfTransform = useMemo(() => {
    if (!telemetry.trackMapSvg) return '';
    const match = telemetry.trackMapSvg.match(/^M\s*([\d.]+)[,\s]+([\d.]+)/);
    if (match) {
      return `translate(${(+match[1]).toFixed(1)},${(+match[2]).toFixed(1)})`;
    }
    return '';
  }, [telemetry.trackMapSvg]);

  // Check if opponent is close to player (within ~8 SVG units)
  const isClose = (ox: number, oy: number) => {
    const dx = sx - ox, dy = sy - oy;
    return (dx * dx + dy * dy) < 64;
  };

  return (
    <div className="maps-col">
      {/* Full Map Panel */}
      <div className="panel map-panel">
        <svg className="map-svg" id="fullMapSvg" viewBox="0 0 100 100">
          {/* Track path */}
          <path className="map-track" id="fullMapTrack" d={telemetry.trackMapSvg} />

          {/* Start/Finish flag */}
          {sfTransform && (
            <g id="fullMapSF" className="map-sf" transform={sfTransform}>
              <line x1="0" y1="-3.5" x2="0" y2="3.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
              <rect x="-5" y="-2.5" width="5" height="2.5" fill="#fff" opacity="0.9" />
              <rect x="0" y="-2.5" width="5" height="2.5" fill="#111" stroke="#fff" strokeWidth="0.3" />
              <rect x="-5" y="0" width="5" height="2.5" fill="#111" stroke="#fff" strokeWidth="0.3" />
              <rect x="0" y="0" width="5" height="2.5" fill="#fff" opacity="0.9" />
            </g>
          )}

          {/* Opponent dots */}
          <g id="fullMapOpponents">
            {opponents.map((opp, idx) =>
              !opp.inPit && (
                <circle
                  key={idx}
                  className={`map-opponent${isClose(opp.x, opp.y) ? ' close' : ''}`}
                  cx={opp.x}
                  cy={opp.y}
                  r="2.5"
                />
              )
            )}
          </g>

          {/* Player position */}
          <circle
            className="map-player"
            id="fullMapPlayer"
            cx={sx.toFixed(1)}
            cy={sy.toFixed(1)}
            r="4"
          />
        </svg>
        <div className="map-zoom-label">Full</div>
      </div>

      {/* Zoom Map Panel */}
      <div className="panel map-zoom-panel">
        <svg className="map-zoom-svg" id="zoomMapSvg" viewBox={zoomViewBox}>
          {/* Track path */}
          <path
            className="map-track"
            id="zoomMapTrack"
            d={telemetry.trackMapSvg}
            style={{ strokeWidth: '1.5' }}
          />

          {/* Start/Finish flag (scaled for zoom) */}
          {sfTransform && (
            <g id="zoomMapSF" className="map-sf" transform={sfTransform}>
              <line x1="0" y1="-2" x2="0" y2="2" stroke="#fff" strokeWidth="0.6" strokeLinecap="round" />
              <rect x="-2.5" y="-1.25" width="2.5" height="1.25" fill="#fff" opacity="0.9" />
              <rect x="0" y="-1.25" width="2.5" height="1.25" fill="#111" stroke="#fff" strokeWidth="0.15" />
              <rect x="-2.5" y="0" width="2.5" height="1.25" fill="#111" stroke="#fff" strokeWidth="0.15" />
              <rect x="0" y="0" width="2.5" height="1.25" fill="#fff" opacity="0.9" />
            </g>
          )}

          {/* Opponent dots */}
          <g id="zoomMapOpponents">
            {opponents.map((opp, idx) =>
              !opp.inPit && (
                <circle
                  key={idx}
                  className={`map-opponent${isClose(opp.x, opp.y) ? ' close' : ''}`}
                  cx={opp.x}
                  cy={opp.y}
                  r="1.5"
                />
              )
            )}
          </g>

          {/* Player position */}
          <circle
            className="map-player"
            id="zoomMapPlayer"
            cx={sx.toFixed(1)}
            cy={sy.toFixed(1)}
            r="2"
          />
        </svg>
        <div className="map-zoom-label">Local</div>
      </div>
    </div>
  );
}
