import { useState, useEffect, useMemo } from 'react';
import { useTelemetry } from '@hooks/useTelemetry';
import { fmtLap, fmtIRating } from '@lib/formatters';

export default function RaceEndScreen() {
  const { telemetry } = useTelemetry();
  const [isVisible, setIsVisible] = useState(false);
  const [hideTimer, setHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [prevFlagState, setPrevFlagState] = useState<string>(telemetry.flagState);

  // Detect DNF: position is 0 OR checkered but completed far fewer laps than total
  const isDNF = useMemo(() => {
    if (telemetry.position === 0) return true;
    if (telemetry.flagState === 'Checkered') {
      const lapThreshold = Math.max(1, Math.floor(telemetry.totalLaps * 0.5));
      if (telemetry.completedLaps > 0 && telemetry.totalLaps > 0 && telemetry.completedLaps < lapThreshold) {
        return true;
      }
    }
    return false;
  }, [telemetry.position, telemetry.flagState, telemetry.totalLaps, telemetry.completedLaps]);

  // Determine finish type
  const finishType = useMemo(() => {
    if (isDNF) return 'dnf';
    if (telemetry.position >= 1 && telemetry.position <= 3) return 'podium';
    if (telemetry.position >= 4 && telemetry.position <= 10) return 'strong';
    return 'midpack';
  }, [isDNF, telemetry.position]);

  // Determine tint class (matches original: gold, silver, bronze, green, neutral, purple)
  const tintClass = useMemo(() => {
    if (isDNF) return 're-tint-purple';
    if (finishType === 'podium') {
      if (telemetry.position === 1) return 're-tint-gold';
      if (telemetry.position === 2) return 're-tint-silver';
      return 're-tint-bronze';
    }
    if (finishType === 'strong') return 're-tint-green';
    return 're-tint-neutral';
  }, [isDNF, finishType, telemetry.position]);

  // Determine main title (matches original: "PODIUM FINISH!" not just "PODIUM!")
  const titleInfo = useMemo(() => {
    if (isDNF) {
      return { title: 'TOUGH BREAK', subtitle: 'Every lap is a lesson. Regroup and go again.' };
    }
    if (finishType === 'podium') {
      if (telemetry.position === 1) {
        return { title: 'VICTORY!', subtitle: null };
      } else {
        return { title: 'PODIUM FINISH!', subtitle: null };
      }
    }
    if (finishType === 'strong') {
      return { title: 'STRONG FINISH', subtitle: null };
    }
    return { title: 'RACE COMPLETE', subtitle: null };
  }, [isDNF, finishType, telemetry.position]);

  // Check for clean race badge (≤4 incidents, matches original)
  const isCleanRace = useMemo(() => {
    return telemetry.incidentCount <= 4;
  }, [telemetry.incidentCount]);

  // Trigger visibility on checkered flag
  useEffect(() => {
    if (
      telemetry.flagState === 'Checkered' &&
      prevFlagState !== 'Checkered'
    ) {
      setIsVisible(true);

      if (hideTimer) {
        clearTimeout(hideTimer);
      }

      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 30000);

      setHideTimer(timer);
    }

    setPrevFlagState(telemetry.flagState);
  }, [telemetry.flagState, prevFlagState, hideTimer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
    };
  }, [hideTimer]);

  // Click to dismiss
  const handleDismiss = () => {
    setIsVisible(false);
    if (hideTimer) {
      clearTimeout(hideTimer);
    }
  };

  if (!isVisible || telemetry.flagState !== 'Checkered') {
    return null;
  }

  return (
    <div className={`race-end-screen re-visible ${tintClass}`} id="raceEndScreen" onClick={handleDismiss}>
      <div className="race-end-bg"></div>
      <div className="re-confetti" id="reConfetti">
        {finishType === 'podium' && Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="re-confetti-dot"
            style={{
              left: `${5 + i * 6.8}%`,
              animationDelay: `${i * 0.12}s`,
              animationDuration: `${2.5 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
      <div className="race-end-content" id="raceEndContent">
        <div className="re-position" id="rePosition">
          {!isDNF && telemetry.position > 0 ? `P${telemetry.position}` : '—'}
        </div>
        <div className="re-title-block">
          <h1 className="re-title" id="reTitle">{titleInfo.title}</h1>
          {titleInfo.subtitle && (
            <p className="re-subtitle" id="reSubtitle">{titleInfo.subtitle}</p>
          )}
        </div>
        {isCleanRace && (
          <div className="re-clean-badge" id="reCleanBadge"><span>✓</span> CLEAN RACE</div>
        )}
        <div className="re-stats">
          <div className="re-stat">
            <div className="re-stat-label">POSITION</div>
            <div className="re-stat-val" id="reStatPos">
              {!isDNF && telemetry.position > 0 ? `P${telemetry.position}` : 'DNF'}
            </div>
          </div>
          <div className="re-stat">
            <div className="re-stat-label">INCIDENTS</div>
            <div className="re-stat-val" id="reStatInc">{telemetry.incidentCount}</div>
          </div>
          <div className="re-stat">
            <div className="re-stat-label">BEST LAP</div>
            <div className="re-stat-val" id="reStatLap">{fmtLap(telemetry.bestLapTime)}</div>
          </div>
          <div className="re-stat">
            <div className="re-stat-label">iRATING</div>
            <div className="re-stat-val" id="reStatIR">{fmtIRating(telemetry.iRating)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
