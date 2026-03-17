/**
 * Main Dashboard layout — mirrors dashboard.html exactly.
 *
 * Uses the SAME class names and DOM structure as the original
 * so that the original CSS files apply without modification.
 */
import { useEffect } from 'react'
import { useSettings } from '@hooks/useSettings'
import { useTelemetry } from '@hooks/useTelemetry'
import { useSecondaryLayout } from '@hooks/useSecondaryLayout'
import { useWebGLEffects } from '@hooks/useWebGLEffects'

// HUD components
import { Tachometer } from '@components/hud/tachometer/Tachometer'
import { FuelPanel } from '@components/hud/fuel/FuelPanel'
import { TyresPanel } from '@components/hud/tyres/TyresPanel'
import PedalsPanel from '@components/hud/PedalsPanel'
import ControlsPanel from '@components/hud/ControlsPanel'
import PositionPanel from '@components/hud/PositionPanel'
import GapsPanel from '@components/hud/GapsPanel'
import LogoPanel from '@components/hud/LogoPanel'
import CommentaryPanel from '@components/hud/CommentaryPanel'
import TrackMaps from '@components/hud/TrackMaps'
import TimerRow from '@components/hud/TimerRow'

// Secondary panels
import LeaderboardPanel from '@components/panels/LeaderboardPanel'
import DatastreamPanel from '@components/panels/DatastreamPanel'
import IncidentsPanel from '@components/panels/IncidentsPanel'
import SpotterPanel from '@components/panels/SpotterPanel'

// Overlays
import RaceControlBanner from '@components/overlays/RaceControlBanner'
import PitLimiterBanner from '@components/overlays/PitLimiterBanner'
import RaceEndScreen from '@components/overlays/RaceEndScreen'
import GridModule from '@components/overlays/GridModule'
import { SettingsPanel } from '@components/settings/SettingsPanel'

const LAYOUT_MAP: Record<string, string> = {
  'top-right': 'layout-tr',
  'top-left': 'layout-tl',
  'bottom-right': 'layout-br',
  'bottom-left': 'layout-bl',
  'top-center': 'layout-tc',
  'bottom-center': 'layout-bc',
}

export default function Dashboard() {
  const { settings } = useSettings()
  const { telemetry } = useTelemetry()
  const secLayout = useSecondaryLayout(settings)

  // Wire up WebGL effects to telemetry state changes
  useWebGLEffects()

  const sessionNum = parseInt(telemetry.sessionState) || 0
  const isIdle = !telemetry.demoMode && (!telemetry.gameRunning || sessionNum <= 1)
  const inPitLane = telemetry.isInPitLane

  // Zoom: CSS zoom applied to the root dashboard wrapper
  const zoomScale = secLayout.zoomScale

  // Apply body classes and --dash-zoom CSS variable via effect
  useEffect(() => {
    const bodyClasses: string[] = []
    if (isIdle) bodyClasses.push('idle-state')
    if (inPitLane) bodyClasses.push('pit-mode')
    if (settings.greenScreen) bodyClasses.push('opaque-mode')
    if (settings.rallyMode) bodyClasses.push('game-rally')
    // Secondary layout mode class
    bodyClasses.push('sec-' + (settings.secLayout || 'stack'))

    document.body.className = bodyClasses.join(' ')
    document.documentElement.style.setProperty('--dash-zoom', String(zoomScale))

    return () => {
      document.body.className = ''
      document.documentElement.style.removeProperty('--dash-zoom')
    }
  }, [isIdle, inPitLane, settings.greenScreen, settings.rallyMode, settings.secLayout, zoomScale])

  const layoutClass = LAYOUT_MAP[settings.layoutPosition] || 'layout-tr'

  // Auto-resolve flow direction: corner positions determine flow automatically
  const pos = settings.layoutPosition || 'top-right'
  let resolvedFlow = settings.layoutFlow || 'ltr'
  if (pos.includes('right')) resolvedFlow = 'rtl'
  else if (pos.includes('left')) resolvedFlow = 'ltr'
  const flowClass = `flow-${resolvedFlow}`
  const vswapClass = settings.verticalSwap ? 'vswap' : ''

  const dashClasses = [
    'dashboard',
    layoutClass,
    flowClass,
    vswapClass,
  ].filter(Boolean).join(' ')

  return (
    <>
      {/* ── Main HUD Dashboard ── */}
      <div className={dashClasses} id="dashboard" style={{ zoom: zoomScale }}>

        <div className="main-row">
          <div className="main-area">

            {/* COL: Fuel (top) + Tyres (bottom) */}
            <div className="fuel-tyres-col">
              {settings.showFuel !== false && <FuelPanel />}
              {settings.showTyres !== false && <TyresPanel />}
            </div>

            {/* COL: Controls + Layered Pedals */}
            <div className="controls-pedals-block">
              {settings.showControls !== false && <ControlsPanel />}
              {settings.showPedals !== false && <PedalsPanel />}
            </div>

            {/* COL: Maps stacked */}
            {settings.showMaps !== false && <TrackMaps />}

            {/* COL: Position/Rating + Gaps */}
            <div className="pos-gaps-col">
              {settings.showPosition !== false && <PositionPanel />}
              <GapsPanel />
            </div>

            {/* COL: Tachometer */}
            {settings.showTacho !== false && <Tachometer />}

            {/* COL: Logo (two stacked squares) */}
            <LogoPanel />

          </div>{/* /main-area */}
        </div>{/* /main-row */}

        {/* ROW: Race Timer */}
        <TimerRow />

        {/* COMMENTARY — spans both rows */}
        {settings.showCommentary !== false && <CommentaryPanel />}

        <div className="conn-status connecting" id="connStatus" />

      </div>{/* /dashboard */}

      {/* ── Secondary Panels (fixed-positioned, zoomed) ── */}
      {settings.showLeaderboard !== false && (
        <LeaderboardPanel
          posClasses={secLayout.classes.leaderboard}
          panelStyle={secLayout.panelStyle}
        />
      )}
      {settings.showDatastream !== false && (
        <DatastreamPanel
          posClasses={secLayout.classes.datastream}
          panelStyle={secLayout.panelStyle}
        />
      )}
      {settings.showIncidents !== false && (
        <IncidentsPanel
          posClasses={secLayout.classes.incidents}
          panelStyle={secLayout.panelStyle}
        />
      )}

      {/* ── Overlay Components ── */}
      <RaceControlBanner />
      <div className={`idle-logo${isIdle ? ' idle-visible' : ''}`} id="idleLogo">
        <img src="images/branding/logomark.png" alt="K10" />
      </div>
      <PitLimiterBanner />
      <RaceEndScreen />
      {settings.showSpotter !== false && (
        <SpotterPanel
          posClasses={secLayout.classes.spotter}
          panelStyle={secLayout.panelStyle}
        />
      )}
      <GridModule />
      <SettingsPanel />
    </>
  )
}
