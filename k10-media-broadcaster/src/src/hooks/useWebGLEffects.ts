/**
 * Centralized WebGL effects integration hook.
 *
 * Listens to telemetry changes and drives all WebGL effects via
 * the WebGLManager instance from WebGLProvider context.
 *
 * This mirrors the original dashboard's poll-engine.js + per-module
 * WebGL calls, but in a single React hook.
 */

import { useEffect, useRef } from 'react';
import { useWebGLManager } from '@components/layout/WebGLProvider';
import { useTelemetry } from '@hooks/useTelemetry';
import { useSettings } from '@hooks/useSettings';

export function useWebGLEffects() {
  const manager = useWebGLManager();
  const { telemetry } = useTelemetry();
  const { settings } = useSettings();

  // Refs to track previous values for change detection
  const prevFlagRef = useRef('');
  const prevPositionRef = useRef(0);
  const startPositionRef = useRef<number | null>(null);
  const prevIncidentsRef = useRef(0);
  const prevPitLaneRef = useRef(false);
  const prevCommentaryVisibleRef = useRef(false);
  const prevSpotterSeverityRef = useRef('');
  const prevGridActiveRef = useRef(false);
  const prevLightsPhaseRef = useRef(0);

  // ═══ GLFX: RPM, Throttle, Brake, Clutch (every frame via telemetry) ═══
  useEffect(() => {
    if (!manager || !settings.showWebGL) return;

    const rpmRatio = telemetry.maxRpm > 0
      ? Math.min(telemetry.rpm / telemetry.maxRpm, 1.0)
      : 0;
    const thr = telemetry.throttleRaw || 0;
    const brk = telemetry.brakeRaw || 0;
    const clt = telemetry.clutchRaw || 0;

    manager.updateGLFX(rpmRatio, thr, brk, clt);
  }, [manager, settings.showWebGL, telemetry.rpm, telemetry.maxRpm, telemetry.throttleRaw, telemetry.brakeRaw, telemetry.clutchRaw]);

  // ═══ Flag GL Colors ═══
  useEffect(() => {
    if (!manager || !settings.showWebGL) return;

    const flagState = telemetry.flagState?.toLowerCase() || '';
    if (flagState !== prevFlagRef.current) {
      const showFlag = flagState && flagState !== 'green' && flagState !== 'none' && flagState !== ''
        ? flagState
        : null;
      manager.setFlagGLColors(showFlag || '');

      // Trigger leaderboard event on flag transitions
      if (flagState === 'green' && prevFlagRef.current !== 'green') {
        manager.triggerLBEvent('green');
      }
      if (flagState === 'checkered') {
        manager.triggerLBEvent('finish');
      }

      prevFlagRef.current = flagState;
    }
  }, [manager, settings.showWebGL, telemetry.flagState]);

  // ═══ Leaderboard: Position change events ═══
  useEffect(() => {
    if (!manager || !settings.showWebGL) return;

    const pos = telemetry.position || 0;

    // Capture starting position
    if (startPositionRef.current === null && pos > 0) {
      startPositionRef.current = pos;
    }

    if (pos > 0 && prevPositionRef.current > 0 && pos !== prevPositionRef.current) {
      if (pos === 1) {
        manager.triggerLBEvent('p1');
      } else if (pos < prevPositionRef.current) {
        manager.triggerLBEvent('gain');
      } else {
        manager.triggerLBEvent('lose');
      }
    }

    prevPositionRef.current = pos;
  }, [manager, settings.showWebGL, telemetry.position]);

  // ═══ Leaderboard: Highlight mode (relative to start) ═══
  useEffect(() => {
    if (!manager || !settings.showWebGL) return;

    const pos = telemetry.position || 0;
    const sessionNum = parseInt(telemetry.sessionState) || 0;
    const startPos = startPositionRef.current;

    if (sessionNum >= 4 && startPos !== null) {
      // Race session
      if (pos === 1) {
        manager.setLBHighlightMode(3); // P1 special
      } else if (pos < startPos) {
        manager.setLBHighlightMode(1); // Ahead of start
      } else if (pos > startPos) {
        manager.setLBHighlightMode(2); // Behind start
      } else {
        manager.setLBHighlightMode(0); // Same as start
      }
    } else {
      manager.setLBHighlightMode(0);
    }
  }, [manager, settings.showWebGL, telemetry.position, telemetry.sessionState]);

  // ═══ Leaderboard: Player position tracking ═══
  useEffect(() => {
    if (!manager || !settings.showWebGL) return;

    // Find player row in the leaderboard DOM and report its position
    const lbPanel = document.getElementById('leaderboardPanel');
    if (!lbPanel) return;

    const playerRow = lbPanel.querySelector('.lb-player') as HTMLElement;
    const lbInner = lbPanel.querySelector('.lb-inner') as HTMLElement;

    if (playerRow && lbInner) {
      const innerRect = lbInner.getBoundingClientRect();
      const rowRect = playerRow.getBoundingClientRect();
      const relTop = (rowRect.top - innerRect.top) / innerRect.height;
      const relBottom = (rowRect.bottom - innerRect.top) / innerRect.height;
      manager.updateLBPlayerPos(relTop, relBottom, true);
    } else {
      manager.updateLBPlayerPos(0, 0, false);
    }
  }, [manager, settings.showWebGL, telemetry.leaderboardJson]);

  // ═══ Incidents GL ═══
  useEffect(() => {
    if (!manager || !settings.showWebGL) return;

    const inc = telemetry.incidentCount || 0;
    const dqLimit = settings.incidentDQLimit || 25;
    const penLimit = settings.incidentPenaltyLimit || 17;

    if (inc !== prevIncidentsRef.current) {
      if (inc >= dqLimit) {
        manager.setIncidentsGL('dq');
      } else if (inc >= penLimit) {
        manager.setIncidentsGL('penalty');
      } else {
        manager.setIncidentsGL('');
      }
      prevIncidentsRef.current = inc;
    }
  }, [manager, settings.showWebGL, telemetry.incidentCount, settings.incidentDQLimit, settings.incidentPenaltyLimit]);

  // ═══ Pit Limiter (Bonkers GL) ═══
  useEffect(() => {
    if (!manager || !settings.showWebGL) return;

    const inPit = telemetry.isInPitLane;
    if (inPit !== prevPitLaneRef.current) {
      manager.setBonkersGL(inPit);
      prevPitLaneRef.current = inPit;
    }
  }, [manager, settings.showWebGL, telemetry.isInPitLane]);

  // ═══ Commentary Trail GL ═══
  useEffect(() => {
    if (!manager || !settings.showWebGL) return;

    const visible = telemetry.commentaryVisible;
    if (visible !== prevCommentaryVisibleRef.current) {
      if (visible) {
        // Calculate hue from commentary color
        const hue = getHueFromHex(telemetry.commentaryColor || '#3399ff');
        manager.setCommentaryTrailGL(true, hue);
      } else {
        manager.setCommentaryTrailGL(false);
      }
      prevCommentaryVisibleRef.current = visible;
    }
  }, [manager, settings.showWebGL, telemetry.commentaryVisible, telemetry.commentaryColor]);

  // ═══ Spotter Glow ═══
  useEffect(() => {
    if (!manager || !settings.showWebGL) return;

    // Derive severity from gap data (same logic as SpotterPanel)
    const gapAhead = telemetry.gapAhead;
    const gapBehind = telemetry.gapBehind;
    let severity = 'off';

    if (gapAhead < 0 && gapAhead > -10 && Math.abs(gapAhead) < 1.5) {
      severity = 'warn';
    } else if (gapAhead > 0 && gapAhead < 1.5) {
      severity = gapAhead < 0.5 ? 'warn' : 'info';
    } else if (gapBehind < 0 && Math.abs(gapBehind) < 1.5) {
      severity = Math.abs(gapBehind) < 0.5 ? 'warn' : 'info';
    } else if (gapBehind > 0 && gapBehind < 5) {
      severity = 'clear';
    }

    if (severity !== prevSpotterSeverityRef.current) {
      manager.setSpotterGlow(severity);
      prevSpotterSeverityRef.current = severity;
    }
  }, [manager, settings.showWebGL, telemetry.gapAhead, telemetry.gapBehind]);

  // ═══ Grid Flag GL ═══
  useEffect(() => {
    if (!manager || !settings.showWebGL) return;

    const gridActive = telemetry.lightsPhase > 0 ||
      telemetry.sessionState === 'gridding' ||
      telemetry.sessionState === 'formation';

    if (gridActive !== prevGridActiveRef.current) {
      manager.setGridFlagGL(gridActive);
      prevGridActiveRef.current = gridActive;
    }

    // Update grid flag colors when lights phase changes
    if (telemetry.lightsPhase !== prevLightsPhaseRef.current) {
      if (telemetry.lightsPhase >= 7) {
        // Green lights
        manager.setGridFlagColors('#00ff00', '#00cc00', '#009900');
      } else if (telemetry.lightsPhase >= 1) {
        // Red lights
        manager.setGridFlagColors('#ff0000', '#cc0000', '#990000');
      }
      prevLightsPhaseRef.current = telemetry.lightsPhase;
    }
  }, [manager, settings.showWebGL, telemetry.lightsPhase, telemetry.sessionState]);
}

/**
 * Convert hex color to hue value (0-360)
 */
function getHueFromHex(hex: string): number {
  if (!hex || !hex.startsWith('#')) return 200;

  const clean = hex.slice(1);
  if (clean.length < 6) return 200;

  let r = parseInt(clean.slice(0, 2), 16) / 255;
  let g = parseInt(clean.slice(2, 4), 16) / 255;
  let b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;

  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return Math.round(h * 360);
}
