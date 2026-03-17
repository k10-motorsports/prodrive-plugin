import { useState, useEffect, useRef, useMemo } from 'react';
import { useTelemetry } from '@hooks/useTelemetry';

/**
 * Leaderboard entry format from JSON: [pos, name, irating, bestLap, lastLap, gapToPlayer, inPit, isPlayer]
 */
type LeaderboardRawEntry = [
  pos: number,
  name: string,
  irating: number,
  bestLap: number,
  lastLap: number,
  gapToPlayer: number,
  inPit: number,
  isPlayer: number
];

/**
 * Format gap to player: negative = ahead, positive = behind
 * Matches original: "-3.5s" / "+2.0s" / "" for player
 */
function formatGap(gap: number, isPlayer: boolean): { text: string; cls: string } {
  if (isPlayer) return { text: '', cls: 'gap-player' };
  if (gap < 0) return { text: '-' + Math.abs(gap).toFixed(1) + 's', cls: 'gap-ahead' };
  if (gap > 0) return { text: '+' + gap.toFixed(1) + 's', cls: 'gap-behind' };
  return { text: '0.0s', cls: 'gap-player' };
}

/**
 * Format iRating: 2800 → "2.8k", 800 → "800"
 */
function fmtIR(ir: number): string {
  if (ir <= 0) return '';
  return ir >= 1000 ? (ir / 1000).toFixed(1) + 'k' : String(ir);
}

/**
 * Format lap time: seconds → "M:SS.s"
 */
function fmtLapShort(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}

interface LeaderboardPanelProps {
  posClasses?: string;
  panelStyle?: React.CSSProperties;
}

const SPARK_MAX = 12;

export default function LeaderboardPanel({ posClasses, panelStyle }: LeaderboardPanelProps) {
  const { telemetry } = useTelemetry();

  const [startPosition, setStartPosition] = useState<number | null>(null);
  const sparkHistoryRef = useRef<Map<string, number[]>>(new Map());
  const lastPositionRef = useRef<number>(0);

  // Parse leaderboard JSON
  const leaderboard = useMemo(() => {
    try {
      if (!telemetry.leaderboardJson) return [];
      const parsed = JSON.parse(telemetry.leaderboardJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [telemetry.leaderboardJson]);

  // Find session best lap
  const sessionBest = useMemo(() => {
    let best = Infinity;
    for (const e of leaderboard) {
      const b = +(e as LeaderboardRawEntry)[3];
      if (b > 0 && b < best) best = b;
    }
    return best === Infinity ? 0 : best;
  }, [leaderboard]);

  // Track starting positions from first valid leaderboard
  useEffect(() => {
    if (startPosition === null && leaderboard.length > 0) {
      const playerEntry = leaderboard.find((e: LeaderboardRawEntry) => e[7]);
      if (playerEntry) {
        setStartPosition(playerEntry[0]);
      }
    }
  }, [leaderboard, startPosition]);

  // Update spark history and track player position
  useEffect(() => {
    leaderboard.forEach((entry: LeaderboardRawEntry) => {
      const name = entry[1];
      const lastLap = +entry[4];
      const isPlayer = entry[7];

      if (isPlayer) lastPositionRef.current = entry[0];

      if (lastLap > 0) {
        const hist = sparkHistoryRef.current.get(name) || [];
        if (hist.length === 0 || hist[hist.length - 1] !== lastLap) {
          hist.push(lastLap);
          if (hist.length > SPARK_MAX) hist.shift();
          sparkHistoryRef.current.set(name, hist);
        }
      }
    });
  }, [leaderboard]);

  if (!leaderboard.length) {
    return (
      <div className={`leaderboard-panel ${posClasses || 'lb-bottom lb-left'}`} id="leaderboardPanel" style={panelStyle}>
        <div className="lb-inner">
          <div className="lb-header">Relative</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`leaderboard-panel ${posClasses || 'lb-bottom lb-left'}`} id="leaderboardPanel" style={panelStyle}>
      <div className="lb-inner">
        <canvas className="lb-gl gl-overlay" id="lbPlayerGlCanvas"></canvas>
        <canvas className="lb-gl gl-overlay" id="lbEventGlCanvas"></canvas>
        <div className="lb-header">Relative</div>
        <div id="lbRows">
          {leaderboard.map((entry: LeaderboardRawEntry) => {
            const [pos, name, ir, best, last, gapToPlayer, inPit, isPlayer] = entry;
            const isPlayerRow = isPlayer > 0;
            const isInPit = inPit > 0;

            const rowClasses = ['lb-row'];
            if (isPlayerRow) {
              rowClasses.push('lb-player');
              if (pos === 1) rowClasses.push('lb-p1');
              else if (startPosition && pos < startPosition) rowClasses.push('lb-ahead');
              else if (startPosition && pos > startPosition) rowClasses.push('lb-behind');
              else rowClasses.push('lb-same');
            }
            // Mark the starting position row when player has moved away
            if (!isPlayerRow && startPosition && pos === startPosition && lastPositionRef.current !== startPosition) {
              rowClasses.push('lb-start-pos');
            }
            if (isInPit) rowClasses.push('lb-pit');

            // Gap display
            const gap = formatGap(gapToPlayer, isPlayerRow);

            // iRating shorthand
            const irStr = fmtIR(ir);

            // Lap time with color coding
            let lapStr = '';
            let lapClass = '';
            if (last > 0) {
              lapStr = fmtLapShort(last);
              if (sessionBest > 0 && Math.abs(last - sessionBest) < 0.05) {
                lapClass = 'lap-pb';       // session best (purple)
              } else if (best > 0 && Math.abs(last - best) < 0.05) {
                lapClass = 'lap-fast';     // personal best (green)
              } else {
                lapClass = 'lap-slow';     // off-pace (yellow)
              }
            }

            // Sparkline SVG
            const hist = sparkHistoryRef.current.get(name)?.filter(v => v > 0);
            let sparkSvg = null;
            if (hist && hist.length >= 2) {
              const mn = Math.min(...hist);
              const mx = Math.max(...hist);
              const range = mx - mn || 1;
              const w = 44, h = 14;
              let pts = '';
              for (let i = 0; i < hist.length; i++) {
                const x = (i / (hist.length - 1)) * w;
                const y = h - ((hist[i] - mn) / range) * h;
                if (i === 0) {
                  pts += x.toFixed(1) + ',' + y.toFixed(1);
                } else {
                  // Step: horizontal to new x at old y, then vertical to new y
                  const prevY = h - ((hist[i - 1] - mn) / range) * h;
                  pts += ' ' + x.toFixed(1) + ',' + prevY.toFixed(1);
                  pts += ' ' + x.toFixed(1) + ',' + y.toFixed(1);
                }
              }
              const lastY = h - ((hist[hist.length - 1] - mn) / range) * h;
              let col = 'hsla(0,0%,100%,0.3)';
              if (isPlayerRow) {
                if (pos === 1) col = 'hsla(42,80%,55%,1)';
                else if (startPosition && pos < startPosition) col = 'hsla(145,75%,50%,1)';
                else if (startPosition && pos > startPosition) col = 'hsla(0,75%,50%,1)';
                else col = 'hsla(210,75%,55%,1)';
              }
              sparkSvg = (
                <svg className="lb-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                  <polyline points={pts} fill="none" stroke={col} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={w} cy={lastY} r="1.5" fill={col} />
                </svg>
              );
            }

            return (
              <div key={`${pos}-${name}`} className={rowClasses.join(' ')}>
                <div className="lb-pos">{pos}</div>
                <div className="lb-name">{isPlayerRow ? (telemetry.driverDisplayName || name) : name}</div>
                <div className={`lb-lap ${lapClass}`}>{lapStr}</div>
                <div className="lb-ir">{irStr}</div>
                <div className={`lb-gap ${gap.cls}`}>{gap.text}</div>
                {sparkSvg}
              </div>
            );
          })}
        </div>
      </div>
      <div className="race-timeline" id="raceTimeline">
        <canvas className="rt-canvas" id="rtCanvas" width="310" height="9"></canvas>
      </div>
    </div>
  );
}
