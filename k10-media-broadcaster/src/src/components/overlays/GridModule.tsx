import { useMemo } from 'react';
import { useTelemetry } from '@hooks/useTelemetry';

export default function GridModule() {
  const { telemetry } = useTelemetry();

  // Determine if grid module is active (pre-race states or start lights)
  // SessionState: 1=GetInCar, 2=Warmup, 3=ParadeLaps/Formation — matches original dashboard
  const sessionNum = parseInt(telemetry.sessionState) || 0;
  const isPreRace = sessionNum >= 1 && sessionNum <= 3;
  const lightsPhase = telemetry.lightsPhase || 0;

  const gridActive = useMemo(() => {
    return lightsPhase > 0 || isPreRace;
  }, [lightsPhase, isPreRace]);

  // Determine if we should show formation info (grid active but lights haven't started)
  const showFormationInfo = useMemo(() => {
    return isPreRace && lightsPhase === 0;
  }, [isPreRace, lightsPhase]);

  // Title based on session state (matches original formation.js)
  const gridTitle = sessionNum === 1 ? 'Get In Car'
    : sessionNum === 2 ? 'Warm Up'
    : 'Formation Lap';

  // Countdown text based on pace mode and session state (matches original)
  const countdownText = useMemo(() => {
    if (lightsPhase > 0) return '—';
    const paceMode = telemetry.paceMode || 0;
    if (paceMode === 1) return 'GRID';
    if (paceMode === 2) return 'PACE';
    if (paceMode === 3) return 'READY';
    if (sessionNum === 1) return 'PIT';
    if (sessionNum === 2) return 'WARM';
    return 'FORM';
  }, [lightsPhase, telemetry.paceMode, sessionNum]);

  // Determine if we should show start lights (lights phase > 0)
  const showStartLights = useMemo(() => {
    return lightsPhase > 0;
  }, [lightsPhase]);

  // Map lights phase to light states
  const getLightState = (bulbIndex: number): 'off' | 'red' | 'green' => {
    if (lightsPhase === 0) return 'off';
    if (lightsPhase >= 1 && lightsPhase <= 5) {
      // Phases 1-5: building reds (light N lit for phase >= N)
      return bulbIndex <= lightsPhase ? 'red' : 'off';
    }
    if (lightsPhase === 6) return 'red'; // All red (hold)
    if (lightsPhase === 7) return 'green'; // All green
    if (lightsPhase === 8) return 'off'; // Done

    return 'off';
  };

  // Extract flag colors from telemetry
  const flagColors = useMemo(() => {
    return {
      color1: telemetry.flagColor1 || '',
      color2: telemetry.flagColor2 || '',
      color3: telemetry.flagColor3 || '',
    };
  }, [telemetry.flagColor1, telemetry.flagColor2, telemetry.flagColor3]);

  const hasFlagColors = flagColors.color1 || flagColors.color2 || flagColors.color3;

  // Start type display
  const startTypeText = useMemo(() => {
    const st = (telemetry.startType || 'rolling').toLowerCase();
    return st === 'standing' ? 'Standing Start' : 'Rolling Start';
  }, [telemetry.startType]);

  const startTypeClass = (telemetry.startType || 'rolling').toLowerCase();

  // Grid strip dots
  const gridStripDots = useMemo(() => {
    const total = telemetry.totalCars || 0;
    const gridded = telemetry.griddedCars || 0;
    const playerPos = telemetry.position || 0;
    if (total <= 0) return null;
    const dots = [];
    for (let i = 1; i <= total; i++) {
      const isPlayer = i === playerPos;
      const isGridded = i <= gridded;
      let cls = 'grid-dot';
      if (isPlayer) cls += ' player';
      else if (isGridded) cls += ' gridded';
      dots.push(<div key={i} className={cls} />);
    }
    return dots;
  }, [telemetry.totalCars, telemetry.griddedCars, telemetry.position]);

  if (!gridActive) {
    return null;
  }

  return (
    <div className={`grid-module ${gridActive ? 'grid-visible' : ''}`} id="gridModule">
      {/* WebGL Canvas Placeholder */}
      <canvas className="grid-flag-gl" id="gridFlagGlCanvas" />

      {/* Countdown Display */}
      <div className="grid-countdown" id="gridCountdown">
        {countdownText}
      </div>

      {/* Formation/Start Info Section */}
      {showFormationInfo && (
        <div className="grid-info" id="gridInfo">
          {/* Country Flag */}
          <div className={`grid-flag${hasFlagColors ? ' flag-active' : ''}`} id="gridFlag">
            <div className="grid-flag-stripe" id="flagStripe1" style={{ backgroundColor: flagColors.color1 }} />
            <div className="grid-flag-stripe" id="flagStripe2" style={{ backgroundColor: flagColors.color2 }} />
            <div className="grid-flag-stripe" id="flagStripe3" style={{ backgroundColor: flagColors.color3 }} />
          </div>

          {/* Background element */}
          <div className="grid-bg" id="gridBg" />

          {/* Title */}
          <div className="grid-title">{gridTitle}</div>

          {/* Cars gridded/total info */}
          <div className="grid-cars">
            <span id="gridCarsGridded">{telemetry.griddedCars || 0}</span>
            <span className="grid-cars-total">
              / <span id="gridCarsTotal">{telemetry.totalCars || 0}</span> gridded
            </span>
          </div>

          {/* Grid strip — one dot per car, player highlighted */}
          <div className="grid-strip" id="gridStrip">
            {gridStripDots}
          </div>

          {/* Start type */}
          <div className={`grid-start-type ${startTypeClass}`} id="gridStartType">
            {startTypeText}
          </div>
        </div>
      )}

      {/* Start Lights Section */}
      {showStartLights && (
        <div className="start-lights lights-active" id="startLights">
          <div className="lights-housing">
            {/* 5 light columns, each with top and bottom bulb */}
            {Array.from({ length: 5 }).map((_, colIndex) => {
              const bulbIndex = colIndex + 1;
              const lightState = getLightState(bulbIndex);

              return (
                <div key={colIndex} className="light-col">
                  <div
                    className={`light-bulb${lightState === 'red' ? ' lit-red' : ''}${lightState === 'green' ? ' lit-green' : ''}`}
                    id={`light${bulbIndex}t`}
                  />
                  <div
                    className={`light-bulb${lightState === 'red' ? ' lit-red' : ''}${lightState === 'green' ? ' lit-green' : ''}`}
                    id={`light${bulbIndex}b`}
                  />
                </div>
              );
            })}
          </div>

          {/* GO! Text */}
          <div className={`lights-go${lightsPhase === 7 ? ' go-visible' : ''}`} id="lightsGo">
            {lightsPhase === 7 ? 'GO!' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
