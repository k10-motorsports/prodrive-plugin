import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useRef,
  useEffect,
} from 'react';

import { createTelemetryClient, type TelemetryClient } from '../lib/telemetry-client';
import { getDemoTelemetry } from '../lib/demo-sequence';
import type {
  TelemetryProps,
  ParsedTelemetry,
  ConnectionStatus,
  PollStats,
} from '../types/telemetry';
import type { OverlaySettings } from '../types/settings';

/**
 * Parse raw telemetry props into normalized ParsedTelemetry.
 * Handles demo mode: if K10MediaBroadcaster.Plugin.DemoMode is truthy,
 * reads from Demo.* keys instead of game keys.
 */
function parseTelemetry(raw: TelemetryProps): ParsedTelemetry {
  // Helper to get value from either demo or game key
  const demoMode = +(raw['K10MediaBroadcaster.Plugin.DemoMode'] || 0) > 0;
  const v = (gameKey: string, demoKey: string): any => {
    if (demoMode) {
      return raw[`K10MediaBroadcaster.Plugin.${demoKey}`];
    }
    return raw[gameKey];
  };

  // Helper to normalize 0-1 values (0-100 becomes 0-1)
  const normalize01 = (value: any): number => {
    if (typeof value !== 'number') return 0;
    return value > 1 ? value / 100 : value;
  };

  return {
    // Engine
    gameRunning: (raw['DataCorePlugin.GameRunning'] || 0) > 0,
    gear: v('DataCorePlugin.GameData.Gear', 'Demo.Gear') || 'N',
    rpm: v('DataCorePlugin.GameData.Rpms', 'Demo.Rpm') || 0,
    maxRpm: v('DataCorePlugin.GameData.CarSettings_MaxRPM', 'Demo.MaxRpm') || 1,
    speedMph: v('DataCorePlugin.GameData.SpeedMph', 'Demo.SpeedMph') || 0,
    throttleRaw: normalize01(v('DataCorePlugin.GameData.Throttle', 'Demo.Throttle')),
    brakeRaw: normalize01(v('DataCorePlugin.GameData.Brake', 'Demo.Brake')),
    clutchRaw: normalize01(v('DataCorePlugin.GameData.Clutch', 'Demo.Clutch')),

    // Fuel
    fuelPercent: 0, // Will be computed from liter data if needed
    fuelLiters: v('DataCorePlugin.GameData.Fuel', 'Demo.Fuel') || 0,
    maxFuelLiters: v('DataCorePlugin.GameData.MaxFuel', 'Demo.MaxFuel') || 0,
    fuelPerLap: v('DataCorePlugin.Computed.Fuel_LitersPerLap', 'Demo.FuelPerLap') || 0,
    fuelRemainingLaps: v('DataCorePlugin.GameData.RemainingLaps', 'Demo.RemainingLaps') || 0,

    // Tyres
    tyreTempFL: v('DataCorePlugin.GameData.TyreTempFrontLeft', 'Demo.TyreTempFL') || 0,
    tyreTempFR: v('DataCorePlugin.GameData.TyreTempFrontRight', 'Demo.TyreTempFR') || 0,
    tyreTempRL: v('DataCorePlugin.GameData.TyreTempRearLeft', 'Demo.TyreTempRL') || 0,
    tyreTempRR: v('DataCorePlugin.GameData.TyreTempRearRight', 'Demo.TyreTempRR') || 0,
    tyreWearFL: v('DataCorePlugin.GameData.TyreWearFrontLeft', 'Demo.TyreWearFL') || 0,
    tyreWearFR: v('DataCorePlugin.GameData.TyreWearFrontRight', 'Demo.TyreWearFR') || 0,
    tyreWearRL: v('DataCorePlugin.GameData.TyreWearRearLeft', 'Demo.TyreWearRL') || 0,
    tyreWearRR: v('DataCorePlugin.GameData.TyreWearRearRight', 'Demo.TyreWearRR') || 0,

    // Brake / TC / ABS
    brakeBias: v('DataCorePlugin.GameRawData.Telemetry.dcBrakeBias', 'Demo.BrakeBias') || 0,
    tractionControl: v('DataCorePlugin.GameRawData.Telemetry.dcTractionControl', 'Demo.TC') || 0,
    tc: v('DataCorePlugin.GameRawData.Telemetry.dcTractionControl', 'Demo.TC') || 0,
    abs: v('DataCorePlugin.GameRawData.Telemetry.dcABS', 'Demo.ABS') || 0,

    // Position
    position: v('DataCorePlugin.GameData.Position', 'Demo.Position') || 0,
    gapAhead: v('IRacingExtraProperties.iRacing_Opponent_Ahead_Gap', 'Demo.GapAhead') || 0,
    gapBehind: v('IRacingExtraProperties.iRacing_Opponent_Behind_Gap', 'Demo.GapBehind') || 0,
    driverAhead: v('IRacingExtraProperties.iRacing_Opponent_Ahead_Name', 'Demo.DriverAhead') || '',
    driverBehind: v('IRacingExtraProperties.iRacing_Opponent_Behind_Name', 'Demo.DriverBehind') || '',
    irAhead: v('IRacingExtraProperties.iRacing_Opponent_Ahead_IRating', 'Demo.IRAhead') || 0,
    irBehind: v('IRacingExtraProperties.iRacing_Opponent_Behind_IRating', 'Demo.IRBehind') || 0,

    // Lap Timing
    currentLap: v('DataCorePlugin.GameData.CurrentLap', 'Demo.CurrentLap') || 0,
    totalLaps: v('DataCorePlugin.GameData.TotalLaps', 'Demo.TotalLaps') || 0,
    currentLapTime: v('DataCorePlugin.GameData.CurrentLapTime', 'Demo.CurrentLapTime') || 0,
    bestLapTime: v('DataCorePlugin.GameData.BestLapTime', 'Demo.BestLapTime') || 0,
    lastLapTime: v('DataCorePlugin.GameData.LastLapTime', 'Demo.LastLapTime') || 0,
    sessionBestLapTime: v('DataCorePlugin.GameData.BestLapTime', 'Demo.BestLapTime') || 0,
    sessionTime: v('DataCorePlugin.GameData.SessionTimeSpan', 'Demo.SessionTime') || 0,
    remainingTime: v('DataCorePlugin.GameData.RemainingTime', 'Demo.RemainingTime') || 0,

    // iRating & Safety
    iRating: v('IRacingExtraProperties.iRacing_DriverInfo_IRating', 'Demo.IRating') || 0,
    safetyRating: v('IRacingExtraProperties.iRacing_DriverInfo_SafetyRating', 'Demo.SafetyRating') || 0,

    // Vehicle
    carModel: v('DataCorePlugin.GameData.CarModel', 'Demo.CarModel') || '',

    // Commentary
    commentaryVisible: (raw['K10MediaBroadcaster.Plugin.CommentaryVisible'] || 0) > 0,
    commentaryText: raw['K10MediaBroadcaster.Plugin.CommentaryText'] || '',
    commentaryTitle: raw['K10MediaBroadcaster.Plugin.CommentaryTopicTitle'] || '',
    commentaryTopicId: raw['K10MediaBroadcaster.Plugin.CommentaryTopicId'] || '',
    commentaryCategory: raw['K10MediaBroadcaster.Plugin.CommentaryCategory'] || '',
    commentaryColor: raw['K10MediaBroadcaster.Plugin.CommentarySentimentColor'] || '',
    commentarySeverity: raw['K10MediaBroadcaster.Plugin.CommentarySeverity'] || 0,

    // Datastream
    latG: v('K10MediaBroadcaster.Plugin.DS.LatG', 'Demo.DS.LatG') || 0,
    longG: v('K10MediaBroadcaster.Plugin.DS.LongG', 'Demo.DS.LongG') || 0,
    yawRate: v('K10MediaBroadcaster.Plugin.DS.YawRate', 'Demo.DS.YawRate') || 0,
    steerTorque: v('K10MediaBroadcaster.Plugin.DS.SteerTorque', 'Demo.DS.SteerTorque') || 0,
    trackTemp: v('K10MediaBroadcaster.Plugin.DS.TrackTemp', 'Demo.DS.TrackTemp') || 0,
    incidentCount: v('K10MediaBroadcaster.Plugin.DS.IncidentCount', 'Demo.DS.IncidentCount') || 0,
    absActive: (v('K10MediaBroadcaster.Plugin.DS.AbsActive', 'Demo.DS.AbsActive') || 0) > 0,
    tcActive: (v('K10MediaBroadcaster.Plugin.DS.TcActive', 'Demo.DS.TcActive') || 0) > 0,
    trackPct: v('K10MediaBroadcaster.Plugin.DS.TrackPct', 'Demo.DS.TrackPct') || 0,
    lapDelta: v('K10MediaBroadcaster.Plugin.DS.LapDelta', 'Demo.DS.LapDelta') || 0,
    completedLaps: v('K10MediaBroadcaster.Plugin.DS.CompletedLaps', 'Demo.DS.CompletedLaps') || 0,
    isInPitLane: (v('K10MediaBroadcaster.Plugin.DS.IsInPitLane', 'Demo.DS.IsInPitLane') || 0) > 0,
    speedKmh: v('K10MediaBroadcaster.Plugin.DS.SpeedKmh', 'Demo.DS.SpeedKmh') || 0,
    pitLimiterOn: (v('K10MediaBroadcaster.Plugin.DS.PitLimiterOn', 'Demo.DS.PitLimiterOn') || 0) > 0,
    pitSpeedLimitKmh: v('K10MediaBroadcaster.Plugin.DS.PitSpeedLimitKmh', 'Demo.DS.PitSpeedLimitKmh') || 0,

    // Track Map
    trackMapReady: (raw['K10MediaBroadcaster.Plugin.TrackMap.Ready'] || 0) > 0,
    trackMapSvg: raw['K10MediaBroadcaster.Plugin.TrackMap.SvgPath'] || '',
    playerMapX: raw['K10MediaBroadcaster.Plugin.TrackMap.PlayerX'] || 0,
    playerMapY: raw['K10MediaBroadcaster.Plugin.TrackMap.PlayerY'] || 0,
    opponentMapPositions: raw['K10MediaBroadcaster.Plugin.TrackMap.Opponents'] || '',

    // Leaderboard
    leaderboardJson: raw['K10MediaBroadcaster.Plugin.Leaderboard'] || '',

    // Driver Info
    driverFirstName: raw['K10MediaBroadcaster.Plugin.DriverFirstName'] || '',
    driverLastName: raw['K10MediaBroadcaster.Plugin.DriverLastName'] || '',
    driverDisplayName: (() => {
      const first = raw['K10MediaBroadcaster.Plugin.DriverFirstName'] || '';
      const last = raw['K10MediaBroadcaster.Plugin.DriverLastName'] || '';
      if (first && last) return first.charAt(0) + '. ' + last;
      if (last) return last;
      return 'YOU';
    })(),

    // Flag
    flagState: raw['currentFlagState'] || '',

    // Flag colors for grid module (from country flags data)
    flagColor1: raw['K10MediaBroadcaster.Plugin.Grid.FlagColor1'] || raw['K10MediaBroadcaster.Plugin.Demo.Grid.FlagColor1'] || '',
    flagColor2: raw['K10MediaBroadcaster.Plugin.Grid.FlagColor2'] || raw['K10MediaBroadcaster.Plugin.Demo.Grid.FlagColor2'] || '',
    flagColor3: raw['K10MediaBroadcaster.Plugin.Grid.FlagColor3'] || raw['K10MediaBroadcaster.Plugin.Demo.Grid.FlagColor3'] || '',

    // Grid State
    sessionState: v('K10MediaBroadcaster.Plugin.Grid.SessionState', 'Demo.Grid.SessionState') || '',
    griddedCars: v('K10MediaBroadcaster.Plugin.Grid.GriddedCars', 'Demo.Grid.GriddedCars') || 0,
    totalCars: v('K10MediaBroadcaster.Plugin.Grid.TotalCars', 'Demo.Grid.TotalCars') || 0,
    paceMode: v('K10MediaBroadcaster.Plugin.Grid.PaceMode', 'Demo.Grid.PaceMode') || '',
    startType: v('K10MediaBroadcaster.Plugin.Grid.StartType', 'Demo.Grid.StartType') || '',
    lightsPhase: v('K10MediaBroadcaster.Plugin.Grid.LightsPhase', 'Demo.Grid.LightsPhase') || 0,
    trackCountry: v('K10MediaBroadcaster.Plugin.Grid.TrackCountry', 'Demo.Grid.TrackCountry') || '',
    gridCountdown: 0,

    // Demo mode flag
    demoMode,
  };
}

/**
 * Context type for telemetry provider.
 */
interface TelemetryContextType {
  telemetry: ParsedTelemetry;
  connectionStatus: ConnectionStatus;
  stats: PollStats;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

/**
 * TelemetryProvider component.
 * Initializes polling on mount, cleans up on unmount.
 */
export function TelemetryProvider({
  children,
  settings,
}: {
  children: ReactNode;
  settings: OverlaySettings;
}) {
  const clientRef = useRef<TelemetryClient | null>(null);
  const stopPollingRef = useRef<(() => void) | null>(null);

  const [telemetry, setTelemetry] = useState<ParsedTelemetry>(() =>
    parseTelemetry({} as TelemetryProps)
  );
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    'disconnected'
  );
  const [stats, setStats] = useState<PollStats>({
    pollCount: 0,
    connectedCount: 0,
    failureCount: 0,
    lastUpdateTime: 0,
    averageLatencyMs: 0,
    connectionStatus: 'disconnected',
  });

  // Track demo mode state
  const demoFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoRafRef = useRef<number | null>(null);
  const demoStartRef = useRef<number>(0);
  const isInDemoRef = useRef(false);

  // Stop demo sequence (does NOT clear the fallback timer)
  const stopDemo = () => {
    isInDemoRef.current = false;
    if (demoRafRef.current) {
      cancelAnimationFrame(demoRafRef.current);
      demoRafRef.current = null;
    }
  };

  // Start demo sequence
  const startDemo = () => {
    if (isInDemoRef.current) return;
    isInDemoRef.current = true;
    demoStartRef.current = performance.now();
    console.log('[K10] Demo mode — starting race sequence');

    const tick = () => {
      if (!isInDemoRef.current) return;
      const elapsed = performance.now() - demoStartRef.current;
      setTelemetry(getDemoTelemetry(elapsed));
      demoRafRef.current = requestAnimationFrame(tick);
    };
    demoRafRef.current = requestAnimationFrame(tick);
  };

  // Initialize client and polling on mount
  useEffect(() => {
    console.log('[K10] TelemetryProvider mount — connecting to', settings.simhubUrl);
    const client = createTelemetryClient(settings.simhubUrl, {
      pollMs: 33, // ~30fps
      timeoutMs: 2000,
      maxBackoffMs: 10000,
      onStatusChange: (status) => {
        setConnectionStatus(status);
      },
    });

    clientRef.current = client;

    // Start polling
    client
      .startPolling((rawData) => {
        // If plugin reports DemoMode, use client-side demo sequence instead
        const pluginDemoMode = +(rawData['K10MediaBroadcaster.Plugin.DemoMode'] || 0) > 0;
        if (pluginDemoMode) {
          if (!isInDemoRef.current) startDemo();
          return; // Skip real data — demo sequence drives telemetry
        }

        // Real data arrived — ensure demo is off
        if (isInDemoRef.current) stopDemo();

        const parsed = parseTelemetry(rawData);
        setTelemetry(parsed);

        // Update stats
        const currentStats = client.getStats();
        setStats({
          ...currentStats,
          connectionStatus: currentStats.connectionStatus,
        });
      })
      .then((stopFn) => {
        stopPollingRef.current = stopFn;
        console.log('[K10] Polling started');
      })
      .catch((err) => {
        console.warn('[K10] Polling failed to start:', err);
        if (!isInDemoRef.current) startDemo();
      });

    // After 3 seconds of no connection, start demo mode
    // (Use a separate ref so StrictMode cleanup doesn't kill it)
    const fallbackTimer = setTimeout(() => {
      console.log('[K10] Demo fallback timer fired, connectedCount:', client.getStats().connectedCount);
      if (client.getStats().connectedCount === 0 && !isInDemoRef.current) {
        console.log('[K10] No SimHub connection — starting demo');
        startDemo();
      }
    }, 3000);
    demoFallbackTimerRef.current = fallbackTimer;

    // Cleanup on unmount or settings change
    return () => {
      console.log('[K10] TelemetryProvider cleanup');
      clearTimeout(fallbackTimer);
      stopDemo();
      if (stopPollingRef.current) {
        stopPollingRef.current();
      }
      stopPollingRef.current = null;
      clientRef.current = null;
    };
  }, [settings.simhubUrl]);

  const value: TelemetryContextType = {
    telemetry,
    connectionStatus,
    stats,
  };

  return (
    <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>
  );
}

/**
 * Hook to access full telemetry context.
 */
export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within TelemetryProvider');
  }
  return context;
}

/**
 * Convenience hook to select a single telemetry value by key.
 */
export function useTelemetryValue<K extends keyof ParsedTelemetry>(
  selector: K
): ParsedTelemetry[K] {
  const { telemetry } = useTelemetry();
  return telemetry[selector];
}
