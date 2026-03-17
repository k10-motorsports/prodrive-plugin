import { useState, useEffect } from 'react';
import { useTelemetry } from '@hooks/useTelemetry';
import { fmtGap } from '@lib/formatters';

export default function GapsPanel() {
  const { telemetry } = useTelemetry();

  // Flash animation state when driver changes
  const [prevDriverAhead, setPrevDriverAhead] = useState(telemetry.driverAhead);
  const [prevDriverBehind, setPrevDriverBehind] = useState(telemetry.driverBehind);

  const [flashAhead, setFlashAhead] = useState(false);
  const [flashBehind, setFlashBehind] = useState(false);

  useEffect(() => {
    if (telemetry.driverAhead !== prevDriverAhead) {
      setPrevDriverAhead(telemetry.driverAhead);
      setFlashAhead(true);
      const timer = setTimeout(() => setFlashAhead(false), 150);
      return () => clearTimeout(timer);
    }
  }, [telemetry.driverAhead, prevDriverAhead]);

  useEffect(() => {
    if (telemetry.driverBehind !== prevDriverBehind) {
      setPrevDriverBehind(telemetry.driverBehind);
      setFlashBehind(true);
      const timer = setTimeout(() => setFlashBehind(false), 150);
      return () => clearTimeout(timer);
    }
  }, [telemetry.driverBehind, prevDriverBehind]);

  // Determine flag state and styling
  const flagState = telemetry.flagState.toLowerCase();
  const isFlagActive = flagState && flagState !== 'green' && flagState !== 'none' && flagState !== '';

  // Flag label and context based on flag type
  const getFlagDisplay = () => {
    switch (flagState) {
      case 'yellow':
        return { label: 'YELLOW FLAG', context: 'Caution' };
      case 'red':
        return { label: 'RED FLAG', context: 'Session stopped' };
      case 'blue':
        return { label: 'BLUE FLAG', context: 'Faster car approaching' };
      case 'white':
        return { label: 'WHITE FLAG', context: 'Last lap' };
      case 'green':
        return { label: 'GREEN FLAG', context: 'Track clear' };
      case 'debris':
        return { label: 'DEBRIS', context: 'Debris on track' };
      case 'checkered':
        return { label: 'CHECKERED', context: 'Session finished' };
      case 'black':
        return { label: 'BLACK FLAG', context: 'Disqualified' };
      default:
        return { label: '', context: '' };
    }
  };

  const flagDisplay = getFlagDisplay();

  // Build flag class name
  const flagClassName = isFlagActive
    ? `flag-${flagState}`
    : '';

  return (
    <div className={`panel gaps-block ${flagClassName}`.trim()} id="gapsBlock">
      <div className={`gap-item ${flashAhead ? 'flash' : ''}`.trim()}>
        <div className="gap-normal">
          <div className="panel-label">Ahead</div>
          <div className="gap-time ahead">
            {fmtGap(telemetry.gapAhead) || '—'}
          </div>
          <div className="gap-driver">{telemetry.driverAhead || '—'}</div>
          <div className="gap-ir">
            {telemetry.irAhead > 0 ? `${telemetry.irAhead} iR` : ''}
          </div>
        </div>
      </div>

      <div className={`gap-item ${flashBehind ? 'flash' : ''}`.trim()}>
        <div className="gap-normal">
          <div className="panel-label">Behind</div>
          <div className="gap-time behind">
            {fmtGap(telemetry.gapBehind) || '—'}
          </div>
          <div className="gap-driver">{telemetry.driverBehind || '—'}</div>
          <div className="gap-ir">
            {telemetry.irBehind > 0 ? `${telemetry.irBehind} iR` : ''}
          </div>
        </div>
      </div>

      <canvas className="flag-gl gl-overlay" id="flagGlCanvas"></canvas>
      <div className="flag-overlay" id="flagOverlay">
        <div className="flag-label" id="flagLabel1">{flagDisplay.label}</div>
        <div className="flag-context" id="flagCtx1">{flagDisplay.context}</div>
      </div>
    </div>
  );
}
