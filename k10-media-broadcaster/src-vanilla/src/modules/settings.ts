/**
 * settings — Settings system: persistence, layout, toggles
 * Converted from settings.js + connections.js (layout/zoom/settings persistence parts)
 */

import { state } from '../state'
import { SIMHUB_URL, DEFAULT_SETTINGS } from '../constants'
import { isRallyGame, applyGameMode } from './game-detect'

// ─── Section element finder ───

export function findSectionEls(sectionKey: string): HTMLElement[] {
  if (!sectionKey) return []
  let el = document.getElementById(sectionKey)
  if (el) return [el]
  return Array.from(document.querySelectorAll('.' + sectionKey)) as HTMLElement[]
}

// ─── Column collapse ───

function collapseParentColumns(): void {
  const ftCol = document.querySelector('.fuel-tyres-col') as HTMLElement | null
  if (ftCol) {
    const fuelHidden = state.settings.showFuel === false
    const tyresHidden = state.settings.showTyres === false
    ftCol.classList.toggle('section-hidden', fuelHidden && tyresHidden)
  }
  const cpBlock = document.querySelector('.controls-pedals-block') as HTMLElement | null
  if (cpBlock) {
    const ctrlHidden = state.settings.showControls === false
    const pedalsHidden = state.settings.showPedals === false
    cpBlock.classList.toggle('section-hidden', ctrlHidden && pedalsHidden)
  }
  const logoCol = document.querySelector('.logo-col') as HTMLElement | null
  if (logoCol) {
    const k10Hidden = state.settings.showK10Logo === false
    const carHidden = state.settings.showCarLogo === false
    logoCol.classList.toggle('section-hidden', k10Hidden && carHidden)
  }
}

// ─── Apply all settings to the DOM ───

export function applySettings(): void {
  const toggles = document.querySelectorAll('.settings-toggle[data-key]')
  toggles.forEach((t: Element) => {
    const toggle = t as HTMLElement
    const key = toggle.dataset.key as string
    const on = (state.settings as any)[key] !== false
    toggle.classList.toggle('on', on)

    const els = findSectionEls(toggle.dataset.section || '')
    els.forEach(el => el.classList.toggle('section-hidden', !on))
  })

  collapseParentColumns()

  const urlInput = document.getElementById('settingsSimhubUrl') as HTMLInputElement | null
  if (urlInput) urlInput.value = state.settings.simhubUrl || SIMHUB_URL
  if (state.settings.simhubUrl && state.settings.simhubUrl !== SIMHUB_URL) {
    ;(window as any)._simhubUrlOverride = state.settings.simhubUrl
  }

  const gsToggle = document.getElementById('greenScreenToggle')
  if (gsToggle) gsToggle.classList.toggle('on', state.settings.greenScreen === true)
  document.body.classList.toggle('green-screen-mode', state.settings.greenScreen === true)

  const webglOn = state.settings.showWebGL !== false
  document.querySelectorAll('.gl-overlay').forEach((c: Element) => {
    (c as HTMLElement).style.display = webglOn ? '' : 'none'
  })

  document.body.classList.toggle('bonkers-off', state.settings.showBonkers === false)

  applyLayout()
  applySecLayout()
  applySecOffset()

  const secLayoutSelect = document.getElementById('settingsSecLayout') as HTMLSelectElement | null
  if (secLayoutSelect) secLayoutSelect.value = state.settings.secLayout || 'stack'
  const secOxSlider = document.getElementById('settingsSecOffsetX') as HTMLInputElement | null
  const secOxVal = document.getElementById('secOffsetXVal')
  if (secOxSlider) { secOxSlider.value = String(state.settings.secOffsetX || 0) }
  if (secOxVal) secOxVal.textContent = (state.settings.secOffsetX || 0) + 'px'
  const secOySlider = document.getElementById('settingsSecOffsetY') as HTMLInputElement | null
  const secOyVal = document.getElementById('secOffsetYVal')
  if (secOySlider) { secOySlider.value = String(state.settings.secOffsetY || 0) }
  if (secOyVal) secOyVal.textContent = (state.settings.secOffsetY || 0) + 'px'

  const zoomVal = state.settings.zoom || 100
  const zoomSlider = document.getElementById('settingsZoom') as HTMLInputElement | null
  const zoomLabel = document.getElementById('zoomVal')
  if (zoomSlider) zoomSlider.value = String(zoomVal)
  if (zoomLabel) zoomLabel.textContent = zoomVal + '%'
  applyZoom(zoomVal)

  state.forceFlagState = state.settings.forceFlag || ''
  const flagSelect = document.getElementById('settingsForceFlag') as HTMLSelectElement | null
  if (flagSelect) flagSelect.value = state.forceFlagState

  state.rallyModeEnabled = state.settings.rallyMode || false
  state.isRally = isRallyGame() || state.rallyModeEnabled

  const layoutRallyToggle = document.getElementById('layoutRallyToggle')
  if (layoutRallyToggle) layoutRallyToggle.classList.toggle('on', state.rallyModeEnabled)
}

// ─── Settings tab navigation ───

export function switchSettingsTab(tab: HTMLElement): void {
  const tabName = tab.dataset.tab!
  document.querySelectorAll('.settings-tab').forEach((t: Element) => t.classList.toggle('active', t === tab))
  document.querySelectorAll('.settings-tab-content').forEach((c: Element) => {
    c.classList.toggle('active', c.id === 'settingsTab' + tabName.charAt(0).toUpperCase() + tabName.slice(1))
  })
  if (tabName === 'connections') {
    ;(window as any).updateConnectionsTab?.()
  }
}

// ─── Layout management ───

const LAYOUT_POSITION_MAP: Record<string, string> = {
  'top-right': 'layout-tr', 'top-left': 'layout-tl',
  'bottom-right': 'layout-br', 'bottom-left': 'layout-bl',
  'top-center': 'layout-tc', 'bottom-center': 'layout-bc',
}

function resolveFlow(pos: string, explicitFlow: string): string {
  if (pos.includes('right')) return 'rtl'
  if (pos.includes('left')) return 'ltr'
  return explicitFlow || 'ltr'
}

export function applyLayout(): void {
  const dash = document.getElementById('dashboard')
  if (!dash) return
  const pos = state.settings.layoutPosition || 'top-right'
  const flow = resolveFlow(pos, state.settings.layoutFlow)
  const vswap = state.settings.verticalSwap || false

  Object.values(LAYOUT_POSITION_MAP).forEach(c => dash.classList.remove(c))
  dash.classList.remove('flow-ltr', 'flow-rtl', 'vswap')

  const layoutClass = LAYOUT_POSITION_MAP[pos] || 'layout-tr'
  dash.classList.add(layoutClass)
  dash.classList.add('flow-' + flow)
  if (vswap) dash.classList.add('vswap')

  const posSelect = document.getElementById('settingsPosition') as HTMLSelectElement | null
  if (posSelect) posSelect.value = pos
  const flowSelect = document.getElementById('settingsFlow') as HTMLSelectElement | null
  if (flowSelect) flowSelect.value = state.settings.layoutFlow || 'ltr'
  const flowRow = document.getElementById('flowDirectionRow') as HTMLElement | null
  if (flowRow) flowRow.style.display = pos.includes('center') ? '' : 'none'
  const vswapToggle = document.getElementById('vswapToggle')
  if (vswapToggle) vswapToggle.classList.toggle('on', vswap)

  const secVOppose = state.settings.secVOppose !== false
  const secHOppose = state.settings.secHOppose !== false
  const dashIsBottom = pos.includes('bottom')
  const dashIsRight = pos.includes('right')
  const dashIsCenter = pos.includes('center')
  const secVert = secVOppose ? (dashIsBottom ? 'top' : 'bottom') : (dashIsBottom ? 'bottom' : 'top')

  let secHoriz: string
  if (dashIsCenter) secHoriz = 'center'
  else if (secHOppose) secHoriz = dashIsRight ? 'left' : 'right'
  else secHoriz = dashIsRight ? 'right' : 'left'

  let dsHoriz = secHoriz, incHoriz = secHoriz
  if (dashIsCenter) { dsHoriz = 'center-left'; incHoriz = 'center-left' }

  const secVToggle = document.getElementById('secVOpposeToggle')
  if (secVToggle) secVToggle.classList.toggle('on', secVOppose)
  const secHToggle = document.getElementById('secHOpposeToggle')
  if (secHToggle) secHToggle.classList.toggle('on', secHOppose)

  const sameSideVOffset = (!secHOppose && !dashIsCenter) ? 250 : 0

  const lb = document.getElementById('leaderboardPanel')
  if (lb) {
    lb.classList.remove('lb-top', 'lb-bottom', 'lb-left', 'lb-right', 'lb-center')
    lb.classList.add('lb-' + secVert)
    lb.classList.add('lb-' + secHoriz)
    if (sameSideVOffset && secVert === 'top') lb.style.marginTop = sameSideVOffset + 'px'
    else if (sameSideVOffset && secVert === 'bottom') lb.style.marginBottom = sameSideVOffset + 'px'
    else { lb.style.marginTop = ''; lb.style.marginBottom = '' }
  }

  const ds = document.getElementById('datastreamPanel')
  if (ds) {
    ds.classList.remove('ds-top', 'ds-bottom', 'ds-left', 'ds-right', 'ds-center-left', 'ds-center-right')
    ds.classList.add('ds-' + secVert)
    ds.classList.add('ds-' + dsHoriz)
    if (sameSideVOffset && secVert === 'top') ds.style.marginTop = sameSideVOffset + 'px'
    else if (sameSideVOffset && secVert === 'bottom') ds.style.marginBottom = sameSideVOffset + 'px'
    else { ds.style.marginTop = ''; ds.style.marginBottom = '' }
  }

  const inc = document.getElementById('incidentsPanel')
  if (inc) {
    inc.classList.remove('inc-top', 'inc-bottom', 'inc-left', 'inc-right', 'inc-center-left', 'inc-center-right')
    inc.classList.add('inc-' + secVert)
    inc.classList.add('inc-' + incHoriz)
    if (sameSideVOffset && secVert === 'top') inc.style.marginTop = sameSideVOffset + 'px'
    else if (sameSideVOffset && secVert === 'bottom') inc.style.marginBottom = sameSideVOffset + 'px'
    else { inc.style.marginTop = ''; inc.style.marginBottom = '' }
  }

  const sp = document.getElementById('spotterPanel')
  if (sp) {
    sp.classList.remove('sp-top', 'sp-bottom', 'sp-left', 'sp-right')
    sp.classList.add('sp-' + (dashIsCenter ? 'left' : secHoriz))
    const spVert = secVert === 'bottom' ? 'top' : 'bottom'
    sp.classList.add('sp-' + spVert)
    sp.style.marginTop = ''; sp.style.marginBottom = ''
  }
}

export function updateLayoutPosition(value: string): void {
  state.settings.layoutPosition = value; applyLayout(); saveSettings()
}

export function updateLayoutFlow(value: string): void {
  state.settings.layoutFlow = value; applyLayout(); saveSettings()
}

export function toggleVerticalSwap(el: HTMLElement): void {
  state.settings.verticalSwap = !state.settings.verticalSwap
  el.classList.toggle('on', state.settings.verticalSwap)
  applyLayout(); saveSettings()
}

export function toggleSecVOppose(el: HTMLElement): void {
  state.settings.secVOppose = !state.settings.secVOppose
  el.classList.toggle('on', state.settings.secVOppose)
  applyLayout(); saveSettings()
}

export function toggleSecHOppose(el: HTMLElement): void {
  state.settings.secHOppose = !state.settings.secHOppose
  el.classList.toggle('on', state.settings.secHOppose)
  applyLayout(); saveSettings()
}

export function updateSecLayout(value: string): void {
  state.settings.secLayout = value; applySecLayout(); saveSettings()
}

export function updateSecOffset(axis: string, val: string | number): void {
  const v = Math.max(-200, Math.min(200, +val))
  if (axis === 'x') {
    state.settings.secOffsetX = v
    const el = document.getElementById('secOffsetXVal')
    if (el) el.textContent = v + 'px'
  } else {
    state.settings.secOffsetY = v
    const el = document.getElementById('secOffsetYVal')
    if (el) el.textContent = v + 'px'
  }
  applySecOffset(); saveSettings()
}

export function applySecLayout(): void {
  const mode = state.settings.secLayout || 'stack'
  document.body.classList.remove('sec-stack', 'sec-row', 'sec-compact', 'sec-minimal')
  document.body.classList.add('sec-' + mode)
}

export function applySecOffset(): void {
  const ox = (state.settings.secOffsetX || 0) + 'px'
  const oy = (state.settings.secOffsetY || 0) + 'px'
  const panels = document.querySelectorAll('.leaderboard-panel, .datastream-panel, .incidents-panel, .spotter-panel')
  panels.forEach((p: Element) => {
    (p as HTMLElement).style.setProperty('--sec-offset-x', ox)
    ;(p as HTMLElement).style.setProperty('--sec-offset-y', oy)
  })
  if (state.settings.secOffsetX || state.settings.secOffsetY) {
    document.body.setAttribute('data-sec-offset', '1')
  } else {
    document.body.removeAttribute('data-sec-offset')
  }
}

export function previewZoom(val: string | number): void {
  const v = Math.max(100, Math.min(200, +val))
  const el = document.getElementById('zoomVal')
  if (el) el.textContent = v + '%'
  applyZoom(v, true)
}

export function updateZoom(val: string | number): void {
  const v = Math.max(100, Math.min(200, +val))
  state.settings.zoom = v
  const el = document.getElementById('zoomVal')
  if (el) el.textContent = v + '%'
  applyZoom(v, false)
  saveSettings()
}

export function applyZoom(val: number, skipSettings = false): void {
  const scale = (val || 100) / 100
  document.documentElement.style.setProperty('--dash-zoom', String(scale))
  const dash = document.getElementById('dashboard') as HTMLElement | null
  if (dash) dash.style.zoom = String(scale)
  ;(['leaderboardPanel','datastreamPanel','incidentsPanel','rcBanner','spotterPanel'] as const).forEach(id => {
    const el = document.getElementById(id) as HTMLElement | null
    if (el) el.style.zoom = String(scale)
  })
  if (!skipSettings) {
    const settingsOverlay = document.getElementById('settingsOverlay') as HTMLElement | null
    if (settingsOverlay) settingsOverlay.style.zoom = String(scale)
  }
}

export function updateForceFlag(val: string): void {
  state.forceFlagState = val
  state.settings.forceFlag = val
  saveSettings()
}

export function toggleSettings(): void {
  const overlay = document.getElementById('settingsOverlay')!
  const isOpen = overlay.classList.contains('open')
  if (isOpen) {
    overlay.classList.remove('open')
    document.body.classList.remove('settings-active', 'settings-drag')
    ;(window as any).k10?.releaseInteractive?.()
  } else {
    overlay.classList.add('open')
    document.body.classList.add('settings-active')
    ;(window as any).k10?.requestInteractive?.()
  }
}

export function toggleSetting(el: HTMLElement): void {
  const key = el.dataset.key!
  const isOn = el.classList.contains('on')
  ;(state.settings as any)[key] = !isOn
  el.classList.toggle('on', !isOn)

  const els = findSectionEls(el.dataset.section || '')
  els.forEach(e => e.classList.toggle('section-hidden', isOn))
  collapseParentColumns()
  saveSettings()
}

export function toggleWebGL(el: HTMLElement): void {
  const isOn = el.classList.contains('on')
  const newVal = !isOn
  el.classList.toggle('on', newVal)
  state.settings.showWebGL = newVal
  document.querySelectorAll('.gl-overlay').forEach((c: Element) => {
    (c as HTMLElement).style.display = newVal ? '' : 'none'
  })
  saveSettings()
}

export function toggleBonkers(el: HTMLElement): void {
  const isOn = el.classList.contains('on')
  const newVal = !isOn
  el.classList.toggle('on', newVal)
  state.settings.showBonkers = newVal
  document.body.classList.toggle('bonkers-off', !newVal)
  saveSettings()
}

export function updateSimhubUrl(url: string): void {
  state.settings.simhubUrl = url
  ;(window as any)._simhubUrlOverride = url
  saveSettings()
}

export async function toggleGreenScreen(el: HTMLElement): Promise<void> {
  const isOn = el.classList.contains('on')
  const newValue = !isOn
  el.classList.toggle('on', newValue)
  state.settings.greenScreen = newValue
  const hint = document.getElementById('greenScreenHint') as HTMLElement | null
  if (hint) hint.style.display = 'block'
  await saveSettings()
  const k10 = (window as any).k10
  if (k10 && k10.restartApp) {
    if (hint) {
      hint.textContent = newValue
        ? 'Restarting into green-screen mode…'
        : 'Restarting into transparent overlay mode…'
    }
    setTimeout(() => k10.restartApp(), 400)
  }
}

// ─── Persistence ───

export async function loadSettings(): Promise<void> {
  let saved: any = null
  const k10 = (window as any).k10
  if (k10 && k10.getSettings) {
    saved = await k10.getSettings()
  }
  if (!saved) {
    try { saved = JSON.parse(localStorage.getItem('k10-broadcast-settings') || 'null') } catch (e) {}
  }
  if (saved) state.settings = Object.assign({}, DEFAULT_SETTINGS, saved)
  applySettings()
}

export async function saveSettings(): Promise<void> {
  const k10 = (window as any).k10
  if (k10 && k10.saveSettings) {
    await k10.saveSettings(state.settings)
  }
  try { localStorage.setItem('k10-broadcast-settings', JSON.stringify(state.settings)) } catch (e) {}
}

export function toggleLayoutRally(el: HTMLElement): void {
  if (el.classList.contains('disabled')) return
  const isOn = el.classList.contains('on')
  el.classList.toggle('on', !isOn)
  state.rallyModeEnabled = !isOn
  state.settings.rallyMode = state.rallyModeEnabled
  state.isRally = isRallyGame() || state.rallyModeEnabled
  applyGameMode()
  saveSettings()
  syncRallyToggles()
}

export function syncRallyToggles(): void {
  const layoutToggle = document.getElementById('layoutRallyToggle')
  const connToggle = document.querySelector('.settings-toggle[data-key="rallyMode"]:not(#layoutRallyToggle)')
  if (layoutToggle) layoutToggle.classList.toggle('on', state.rallyModeEnabled)
  if (connToggle) connToggle.classList.toggle('on', state.rallyModeEnabled)
}

/** Sync the layout-page rally toggle button to current state (alias for syncRallyToggles) */
export function updateLayoutRallyToggle(): void {
  syncRallyToggles()
}

// ─── Electron settings mode listener ───

export function initSettingsListeners(): void {
  const k10 = (window as any).k10
  if (k10 && k10.onSettingsMode) {
    k10.onSettingsMode((active: boolean) => {
      const overlay = document.getElementById('settingsOverlay')!
      if (active) {
        overlay.classList.add('open')
        document.body.classList.add('settings-active')
      } else {
        overlay.classList.remove('open')
        document.body.classList.remove('settings-active')
      }
    })
  }
}

// Register globals for HTML onclick handlers
;(window as any).toggleSettings = toggleSettings
;(window as any).switchSettingsTab = switchSettingsTab
;(window as any).toggleSetting = toggleSetting
;(window as any).toggleWebGL = toggleWebGL
;(window as any).toggleBonkers = toggleBonkers
;(window as any).toggleGreenScreen = toggleGreenScreen
;(window as any).updateLayoutPosition = updateLayoutPosition
;(window as any).updateLayoutFlow = updateLayoutFlow
;(window as any).toggleVerticalSwap = toggleVerticalSwap
;(window as any).toggleSecVOppose = toggleSecVOppose
;(window as any).toggleSecHOppose = toggleSecHOppose
;(window as any).updateSecLayout = updateSecLayout
;(window as any).updateSecOffset = updateSecOffset
;(window as any).previewZoom = previewZoom
;(window as any).updateZoom = updateZoom
;(window as any).updateForceFlag = updateForceFlag
;(window as any).updateSimhubUrl = updateSimhubUrl
;(window as any).toggleLayoutRally = toggleLayoutRally
;(window as any).saveSettings = saveSettings
;(window as any).resetTrackMap = () => {} // placeholder — overridden by webgl-helpers
