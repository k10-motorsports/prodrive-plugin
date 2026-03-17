/**
 * webgl-helpers.ts — WebGL visualization helpers
 * Includes tachometer, pedal histograms, traces, and commentary overlays.
 *
 * PARITY NOTE: This module must match the observable DOM behavior of
 * K10 Media Broadcaster/modules/js/webgl-helpers.js exactly, including
 * CSS class names and element IDs. Tests run against both builds.
 */

import { state } from '../state'
import { SIMHUB_URL } from '../constants'

// ========== TACHOMETER ==========
const TACH_SEGS = 11
const tachoBar = document.getElementById('tachoBar')
const rpmText = document.getElementById('rpmText')

if (tachoBar) {
  for (let i = 0; i < TACH_SEGS; i++) {
    const s = document.createElement('div')
    s.className = 'tacho-seg'
    tachoBar.appendChild(s)
  }
}

const RPM_COLORS: Record<string, string> = {
  green: 'var(--green)',
  yellow: 'var(--amber)',
  red: 'var(--red)',
  dim: 'var(--text-dim)',
}

let _prevLitCount = 0
let _rpmPulseTimer: any = null

export function updateTacho(pct: number) {
  if (!tachoBar) return

  pct = Math.max(0, Math.min(1, pct))
  const lit = Math.round(pct * TACH_SEGS)
  let topColor = 'dim'

  const segs = tachoBar.children
  for (let i = 0; i < TACH_SEGS; i++) {
    const seg = segs[i] as HTMLElement
    seg.className = 'tacho-seg'
    if (i < lit) {
      const f = i / TACH_SEGS
      if (f < 0.55) { seg.classList.add('lit-green'); topColor = 'green' }
      else if (f < 0.73) { seg.classList.add('lit-yellow'); topColor = 'yellow' }
      else if (f < 0.91) { seg.classList.add('lit-red'); topColor = 'red' }
      else { seg.classList.add('lit-redline'); topColor = 'red' }
      seg.style.height = '100%'
    } else {
      seg.style.height = '2px'
    }
  }

  if (rpmText) rpmText.style.color = RPM_COLORS[topColor]

  // Pulse the RPM text when a new segment lights up
  if (rpmText && lit > _prevLitCount && lit > 0) {
    const pulseClass = topColor === 'green' ? 'rpm-pulse-green'
      : topColor === 'yellow' ? 'rpm-pulse-yellow' : 'rpm-pulse-red'
    rpmText.classList.remove('rpm-pulse-green', 'rpm-pulse-yellow', 'rpm-pulse-red')
    void rpmText.offsetWidth
    rpmText.classList.add(pulseClass)
    if (_rpmPulseTimer) clearTimeout(_rpmPulseTimer)
    _rpmPulseTimer = setTimeout(() => {
      rpmText.classList.remove('rpm-pulse-green', 'rpm-pulse-yellow', 'rpm-pulse-red')
    }, 180)
  }
  _prevLitCount = lit
}

updateTacho(0)

// ========== PEDAL HISTOGRAMS ==========
const HIST_BARS = 20

function setupHist(id: string, cls: string) {
  const container = document.getElementById(id)
  if (!container) return
  container.innerHTML = ''
  for (let i = 0; i < HIST_BARS; i++) {
    const bar = document.createElement('div')
    bar.className = `pedal-hist-bar ${cls}`
    container.appendChild(bar)
  }
}

setupHist('throttleHist', 'throttle')
setupHist('brakeHist', 'brake')
setupHist('clutchHist', 'clutch')

export function renderHist(id: string, data: number[]) {
  const container = document.getElementById(id)
  if (!container) return

  const bars = container.querySelectorAll('.pedal-hist-bar')
  const max = Math.max(...Array.from(data))

  for (let i = 0; i < HIST_BARS && i < bars.length; i++) {
    const bar = bars[i] as HTMLElement
    const height = max > 0 ? (data[i] / max) * 100 : 0
    bar.style.height = height + '%'
  }
}

// ========== PEDAL TRACE ==========
export function renderPedalTrace(
  canvasId: string,
  thr: number[],
  brk: number[],
  clt: number[]
) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height
  const len = Math.min(thr.length, brk.length, clt.length)

  ctx.fillStyle = 'rgba(10, 10, 20, 0.8)'
  ctx.fillRect(0, 0, w, h)

  // Draw grid
  ctx.strokeStyle = 'rgba(100, 100, 120, 0.3)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = (h / 4) * i
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  // Draw traces
  const colors = ['#22dd88', '#dd2222', '#2288ff']
  const traces = [thr, brk, clt]
  const names = ['throttle', 'brake', 'clutch']

  traces.forEach((data, idx) => {
    ctx.strokeStyle = colors[idx]
    ctx.lineWidth = 2
    ctx.beginPath()

    for (let i = 0; i < len; i++) {
      const x = (i / len) * w
      const y = h - data[i] * h
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }

    ctx.stroke()
  })

  // Draw labels
  ctx.fillStyle = '#aaa'
  ctx.font = '11px monospace'
  names.forEach((name, idx) => {
    ctx.fillStyle = colors[idx]
    ctx.fillText(name, 5, 15 + idx * 12)
  })
}

// ========== COMMENTARY / OVERLAY ==========
// Match original: operates on #commentaryCol, #commentaryTitle, #commentaryText, #commentaryMeta

let _hasRatingData = false

export function setHasRatingData(has: boolean) {
  _hasRatingData = has
}

const _heatTopics: Record<string, boolean> = {
  tyre_temp_high: true, tyre_temp_critical: true,
  brake_temp_high: true, brake_temp_critical: true,
}
const _wearTopics: Record<string, boolean> = {
  tyre_wear_high: true, tyre_degradation: true,
}
const _bestTopics: Record<string, boolean> = {
  personal_best: true, position_gained: true,
}

export function showCommentary(
  hue: number,
  title: string,
  text: string,
  meta?: string,
  topicId?: string,
  severity?: number
) {
  const col = document.getElementById('commentaryCol')
  const dash = document.getElementById('dashboard')
  if (!col) return

  // Resolve topic for hue overrides
  const resolvedTopic = topicId || ''
  if (_heatTopics[resolvedTopic]) {
    hue = (severity && severity >= 3) ? 0 : 30
  } else if (_wearTopics[resolvedTopic]) {
    hue = 30
  } else if (_bestTopics[resolvedTopic]) {
    hue = 145
  }

  const inner = col.querySelector('.commentary-inner') as HTMLElement
  if (inner) {
    inner.style.background = `hsla(${hue}, 50%, 13%, 0.96)`
    inner.style.borderColor = `hsla(${hue}, 50%, 27%, 0.50)`
  }

  const titleEl = document.getElementById('commentaryTitle')
  const textEl = document.getElementById('commentaryText')
  const metaEl = document.getElementById('commentaryMeta')

  if (titleEl) {
    titleEl.textContent = title
    titleEl.style.color = `hsl(${hue},55%,65%)`
  }
  if (textEl) textEl.textContent = text
  if (metaEl && meta) metaEl.textContent = meta

  col.classList.add('visible')

  if (dash) {
    dash.style.setProperty('--sentiment-h', String(hue))
    dash.style.setProperty('--sentiment-s', '40%')
    dash.style.setProperty('--sentiment-l', '12%')
    dash.style.setProperty('--sentiment-alpha', '0.06')
  }
}

export function hideCommentary() {
  const col = document.getElementById('commentaryCol')
  const dash = document.getElementById('dashboard')
  if (col) col.classList.remove('visible')
  if (dash) dash.style.setProperty('--sentiment-alpha', '0')
  if ((window as any).hideCommentaryViz) (window as any).hideCommentaryViz()
  if ((window as any).setCommentaryTrailGL) (window as any).setCommentaryTrailGL(false)
}

// ========== RATING / POSITION PAGE CYCLING ==========
// Match original: toggles .active/.inactive on #ratingPage, #positionPage, #dotRating, #dotPos

let _ratingActive = true

export function cycleRatingPos() {
  _ratingActive = !_ratingActive
  const ratingPage = document.getElementById('ratingPage')
  const positionPage = document.getElementById('positionPage')
  const dotRating = document.getElementById('dotRating')
  const dotPos = document.getElementById('dotPos')

  if (ratingPage) {
    ratingPage.classList.toggle('active', _ratingActive)
    ratingPage.classList.toggle('inactive', !_ratingActive)
  }
  if (positionPage) {
    positionPage.classList.toggle('active', !_ratingActive)
    positionPage.classList.toggle('inactive', _ratingActive)
  }
  if (dotRating) dotRating.classList.toggle('active', _ratingActive)
  if (dotPos) dotPos.classList.toggle('active', !_ratingActive)
}

export function showPositionPage() {
  const el = document.getElementById('positionPanel')
  if (el) el.classList.add('visible')
}

// ========== iRATING BAR ==========
// Match original: sets #irBarFill style.width

export function updateIRBar(iRating: number) {
  const maxIR = 5000
  const pct = Math.min(100, (iRating / maxIR) * 100)
  const fill = document.getElementById('irBarFill')
  if (fill) fill.style.width = pct + '%'
}
updateIRBar(0)

// ========== SAFETY RATING PIE ==========
// Match original: sets #srPieFill stroke-dashoffset and stroke attribute

export function updateSRPie(srValue: number) {
  const pct = Math.min(1, srValue / 4.0)
  const circ = 2 * Math.PI * 15 // ~94.25
  const offset = circ * (1 - pct)
  const fill = document.getElementById('srPieFill')
  if (!fill) return
  fill.setAttribute('stroke-dashoffset', String(offset))
  // Color: green if >= 3.0, amber if >= 2.0, red if lower
  if (srValue >= 3.0) fill.setAttribute('stroke', 'var(--green)')
  else if (srValue >= 2.0) fill.setAttribute('stroke', 'var(--amber)')
  else fill.setAttribute('stroke', 'var(--red)')
}

export function flashElement(el: HTMLElement, className: string) {
  if (!el) return
  el.classList.add(className)
  setTimeout(() => {
    el.classList.remove(className)
  }, 300)
}

export function flashCtrlBar(id: string) {
  const el = document.getElementById(id)
  if (el) flashElement(el, 'flash')
}

// ========== CONTROL VISIBILITY ==========
// Match original: toggles .ctrl-hidden class

export function setCtrlVisibility(hasBB: boolean, hasTC: boolean, hasABS: boolean) {
  const bbEl = document.getElementById('ctrlBB')
  const tcEl = document.getElementById('ctrlTC')
  const absEl = document.getElementById('ctrlABS')

  if (bbEl) bbEl.classList.toggle('ctrl-hidden', !hasBB)
  if (tcEl) tcEl.classList.toggle('ctrl-hidden', !hasTC)
  if (absEl) absEl.classList.toggle('ctrl-hidden', !hasABS)
}

// ========== TYRE TEMPERATURE ==========
// Match original thresholds: cold (<150°F), optimal (150-230), hot (230-270), danger (>270)

export function getTyreTempClass(tempF: number): string {
  if (tempF <= 0) return ''
  if (tempF < 150) return 'cold'
  if (tempF < 230) return 'optimal'
  if (tempF < 270) return 'hot'
  return 'danger'
}

export function updateTyreCell(index: number, tempF: number, wearPct: number) {
  const cells = document.querySelectorAll('.tyre-cell')
  const wearFills = document.querySelectorAll('.tyre-wear-fill')
  if (index >= cells.length) return
  const cell = cells[index] as HTMLElement
  cell.textContent = tempF > 0 ? Math.round(tempF) + '°' : '—'
  cell.className = 'tyre-cell ' + getTyreTempClass(tempF)

  // Wear bar
  if (index < wearFills.length) {
    const fill = wearFills[index] as HTMLElement
    fill.style.width = Math.max(0, Math.min(100, wearPct)) + '%'
  }
}

// ========== FUEL BAR ==========
// Match original: sets .fuel-bar-inner width + healthy/caution/critical classes

export function updateFuelBar(pct: number, pitLapPct?: number) {
  const bar = document.querySelector('.fuel-bar-inner') as HTMLElement
  if (!bar) return
  bar.style.width = Math.max(0, Math.min(100, pct)) + '%'
  bar.className = 'fuel-bar-inner'
  if (pct > 40) bar.classList.add('healthy')
  else if (pct > 15) bar.classList.add('caution')
  else bar.classList.add('critical')

  // Pit marker
  const marker = document.querySelector('.fuel-bar-pit-marker') as HTMLElement
  if (marker && pitLapPct !== undefined && pitLapPct > 0) {
    marker.style.left = Math.min(100, pitLapPct) + '%'
    marker.style.display = ''
  } else if (marker) {
    marker.style.display = 'none'
  }
}

// ========== TRACK MAP ==========
let _mapLastPath = ''
let _mapSmoothedX = 0, _mapSmoothedY = 0
let _mapHasInit = false
const _SVG_NS = 'http://www.w3.org/2000/svg'
const _MAP_MAX_OPPONENTS = 63

export function resetTrackMap() {
  const mapTrack = document.getElementById('fullMapTrack')
  const mapPlayer = document.getElementById('fullMapPlayer')
  const mapOpponents = document.getElementById('fullMapOpponents')
  if (mapTrack) (mapTrack as any).setAttribute('d', '')
  if (mapPlayer) (mapPlayer as any).style.display = 'none'
  if (mapOpponents) mapOpponents.innerHTML = ''
  _mapLastPath = ''
  _mapHasInit = false
}

export function updateTrackMap(svgPath: string, playerX: number, playerY: number, opponentStr?: string) {
  const mapTrack = document.getElementById('fullMapTrack') as unknown as SVGPathElement
  const mapPlayer = document.getElementById('fullMapPlayer') as unknown as SVGCircleElement
  const mapOpponents = document.getElementById('fullMapOpponents')

  if (!mapTrack) return

  // Update path
  if (svgPath && svgPath !== _mapLastPath) {
    mapTrack.setAttribute('d', svgPath)
    _mapLastPath = svgPath
  }

  // Update player position
  if (mapPlayer) {
    mapPlayer.setAttribute('cx', playerX.toFixed(1))
    mapPlayer.setAttribute('cy', playerY.toFixed(1))
    mapPlayer.style.display = ''
  }

  // Update opponents
  if (mapOpponents && opponentStr) {
    const entries = opponentStr.split(';').filter(Boolean)

    // Ensure enough circles exist
    while (mapOpponents.children.length < entries.length) {
      const c = document.createElementNS(_SVG_NS, 'circle')
      c.setAttribute('r', '2.5')
      c.setAttribute('fill', 'rgba(200,200,200,0.6)')
      mapOpponents.appendChild(c)
    }

    entries.forEach((entry, i) => {
      const parts = entry.split(',')
      const x = parseFloat(parts[0])
      const y = parseFloat(parts[1])
      const inPit = parseInt(parts[2]) === 1
      const circle = mapOpponents.children[i] as SVGCircleElement
      circle.setAttribute('cx', x.toFixed(1))
      circle.setAttribute('cy', y.toFixed(1))
      circle.style.display = inPit ? 'none' : ''
    })
  }
}

// Register on window
;(window as any).resetTrackMap = resetTrackMap
// Note: updateCommentaryVizData is registered by commentary-viz.ts
