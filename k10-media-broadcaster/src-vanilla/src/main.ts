/**
 * main.ts — Entry point for K10 Media Broadcaster (src-vanilla build)
 * Imports all modules in the correct load order matching dashboard.html's <script> sequence:
 * config → keyboard → car-logos → game-detect → webgl-helpers → settings → connections →
 * leaderboard → datastream → race-control → race-timeline → incidents → pit-limiter →
 * race-end → formation → spotter → fps → webgl → commentary-viz → poll-engine
 */

// CSS - import all stylesheets
import '../../K10 Media Broadcaster/modules/styles/base.css'
import '../../K10 Media Broadcaster/modules/styles/dashboard.css'
import '../../K10 Media Broadcaster/modules/styles/effects.css'
import '../../K10 Media Broadcaster/modules/styles/rally.css'
import '../../K10 Media Broadcaster/modules/styles/settings.css'
import '../../K10 Media Broadcaster/modules/styles/connections.css'
import '../../K10 Media Broadcaster/modules/styles/leaderboard.css'
import '../../K10 Media Broadcaster/modules/styles/datastream.css'

// Core modules (order matters: dependencies first)
import './modules/config'
import './modules/keyboard'
import './modules/car-logos'
import './modules/game-detect'
import './modules/webgl-helpers'
import './modules/settings'
import './modules/connections'
import './modules/leaderboard'
import './modules/datastream'
import './modules/race-control'
import './modules/race-timeline'
import './modules/incidents'
import './modules/pit-limiter'
import './modules/race-end'
import './modules/formation'
import './modules/spotter'
import './modules/fps'
import './modules/webgl'
import './modules/commentary-viz'
import './modules/window-globals'
import { initPollEngine } from './modules/poll-engine'

// Start the poll engine (loads settings, connects Discord, starts polling)
initPollEngine()
