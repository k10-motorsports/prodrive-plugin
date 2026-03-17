/**
 * window-globals.ts — Expose module-scoped functions as window globals
 *
 * The original dashboard.html has all functions in global scope. The TypeScript
 * build uses ES modules, so functions are module-scoped. This bridge exposes
 * the same window API that the original dashboard has, ensuring test parity.
 */

import { state } from '../state'
import {
  updateTacho,
  renderHist,
  showCommentary,
  hideCommentary,
  cycleRatingPos,
  updateIRBar,
  updateSRPie,
  flashElement,
  setCtrlVisibility,
  getTyreTempClass,
  updateTyreCell,
  updateFuelBar,
  updateTrackMap,
} from './webgl-helpers'

import { setCarLogo, carLogos } from './car-logos'
import { applyLayout, applySettings } from './settings'

// ─── Functions on window ───
const w = window as any

w.updateTacho = updateTacho
w.renderHist = renderHist
w.showCommentary = showCommentary
w.hideCommentary = hideCommentary
w.cycleRatingPos = cycleRatingPos
w.setCarLogo = setCarLogo
w.updateIRBar = updateIRBar
w.updateSRPie = updateSRPie
w.flashElement = flashElement
w.setCtrlVisibility = setCtrlVisibility
w.getTyreTempClass = getTyreTempClass
w.updateTyreCell = updateTyreCell
w.updateFuelBar = updateFuelBar
w.updateTrackMap = updateTrackMap
w.applyLayout = applyLayout
w.applySettings = applySettings

// ─── Legacy global variables ───
// _settings must be a live reference (getter) so tests see state changes
Object.defineProperty(window, '_settings', {
  get: () => state.settings,
  set: (v: any) => { Object.assign(state.settings, v) },
  enumerable: true,
  configurable: true,
})

// _connFails must be a live reference
Object.defineProperty(window, '_connFails', {
  get: () => state.connFails,
  set: (v: number) => { state.connFails = v },
  enumerable: true,
  configurable: true,
})

// carLogos — the original exposes this as a window global for SVG injection
w.carLogos = carLogos

// _currentCarLogo — used by test helpers to reset logo state
Object.defineProperty(window, '_currentCarLogo', {
  get: () => state.currentCarLogo,
  set: (v: string) => { state.currentCarLogo = v },
  enumerable: true,
  configurable: true,
})

// _lastCarModel — the build tracks this differently, but expose for test compat
Object.defineProperty(window, '_lastCarModel', {
  get: () => state.lastCarModel,
  set: (v: any) => { state.lastCarModel = v },
  enumerable: true,
  configurable: true,
})
