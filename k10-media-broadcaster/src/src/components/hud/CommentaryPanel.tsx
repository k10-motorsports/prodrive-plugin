import { useMemo, useEffect, useState, useRef } from 'react';
import { useTelemetry } from '@hooks/useTelemetry';

/**
 * Stroke-based SVG icon builder matching original webgl-helpers.js
 * Uses currentColor so it inherits the sentiment hue via style.color.
 */
const _s = (d: string, extra?: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"${extra || ''}>${d}</svg>`;

const _commentaryIcons: Record<string, string> = {
  // car_response
  spin_catch: _s('<path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/><path d="M14.5 9.5l3-3" stroke-dasharray="2 2"/>'),
  wall_contact: _s('<rect x="2" y="4" width="4" height="16" rx="1"/><path d="M6 12h5"/><path d="M11 8l4 4-4 4"/><path d="M15 7l2 2-2 2"/><path d="M17 13l2 2-2 2"/><circle cx="19" cy="6" r="1" fill="currentColor" stroke="none"/>'),
  off_track: _s('<path d="M3 20L12 4l9 16H3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/>'),
  kerb_hit: _s('<path d="M3 18h18"/><path d="M3 18l3-3h2l3-3h2l3-3h2l3-3"/><path d="M8 12v6"/><path d="M16 6v12"/><circle cx="12" cy="9" r="2"/>'),
  high_cornering_load: _s('<circle cx="12" cy="12" r="9"/><path d="M12 12l6-3"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="M5.64 5.64l1.41 1.41"/><path d="M16.95 16.95l1.41 1.41"/>'),
  heavy_braking: _s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><rect x="10" y="6" width="4" height="5" rx="1" fill="currentColor" stroke="none" opacity="0.5"/><path d="M8 12h8"/><path d="M12 8v8"/>'),
  car_balance_sustained: _s('<path d="M4 16l4-8h8l4 8"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/><path d="M12 4v4"/><path d="M10 6h4"/>'),
  rapid_gear_change: _s('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7v4h3V7"/><path d="M12 11v4h3v-4"/><path d="M9 15v3"/><circle cx="12" cy="19" r="0.5" fill="currentColor"/>'),

  // hardware
  abs_activation: _s('<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 11h2l1-2 1 4 1-4 1 2h2"/>', ' stroke-width="1.8"'),
  tc_intervention: _s('<path d="M12 3a9 9 0 1 0 0 18"/><path d="M12 3a9 9 0 0 1 0 18"/><path d="M9 9l6 6"/><path d="M9 9h3v3"/>'),
  ffb_torque_spike: _s('<path d="M12 2v20"/><path d="M2 12h20"/><path d="M7 7c2 2 3 5 5 5s3-3 5-5"/><path d="M7 17c2-2 3-5 5-5s3 3 5 5"/>'),
  brake_bias_change: _s('<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M8 8h-1a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1"/><path d="M16 8h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1"/><path d="M8 12h8" stroke-dasharray="2 1"/>'),
  tc_setting_change: _s('<circle cx="12" cy="12" r="9"/><path d="M8 8h8"/><path d="M12 8v8"/><path d="M9 15l3-3 3 3" stroke-dasharray="2 1"/>'),
  abs_setting_change: _s('<circle cx="12" cy="12" r="9"/><path d="M7 12h10"/><path d="M7 9h10"/><path d="M7 15h10"/><circle cx="14" cy="12" r="1.5" fill="currentColor" stroke="none"/>'),
  arb_front_change: _s('<path d="M4 16h16"/><path d="M6 16V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/><path d="M10 12h4" stroke-dasharray="2 1"/><path d="M8 10l2 2-2 2"/>'),
  arb_rear_change: _s('<path d="M4 8h16"/><path d="M6 8v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/><path d="M10 12h4" stroke-dasharray="2 1"/><path d="M16 10l-2 2 2 2"/>'),

  // game_feel
  qualifying_push: _s('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8"/>'),
  drs_active: _s('<path d="M2 8h20"/><path d="M4 8l2 10h12l2-10"/><path d="M8 8V5a4 4 0 0 1 8 0v3"/><path d="M10 12h4" stroke-dasharray="3 2"/>'),
  ers_low: _s('<path d="M2 12h4l2-4 3 8 3-8 2 4h4"/><path d="M18 6l2 2-2 2"/>'),
  personal_best: _s('<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.3L12 16.7l-6.2 4.5 2.4-7.3L2 9.4h7.6z"/>'),
  long_stint: _s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><path d="M16 4l2 2"/><path d="M8 4L6 6"/>'),
  session_time_low: _s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/><path d="M3 3l3 3"/><path d="M21 3l-3 3"/>'),

  // racing_experience
  close_battle: _s('<path d="M5 17l3-12h3l2 5 2-5h3l3 12"/><path d="M4 10h16" stroke-dasharray="3 2"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/>'),
  position_gained: _s('<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>'),
  position_lost: _s('<path d="M12 5v14"/><path d="M5 12l7 7 7-7"/>'),
  yellow_flag: _s('<path d="M5 2v20"/><path d="M5 4h12l-3 4 3 4H5"/>'),
  debris_on_track: _s('<path d="M3 20h18"/><path d="M7 17l2-5"/><path d="M12 12l-1-4"/><path d="M15 14l2-6"/><path d="M10 17l1-3"/><circle cx="8" cy="10" r="1" fill="currentColor"/><circle cx="14" cy="7" r="1.5" fill="currentColor"/><circle cx="17" cy="11" r="1" fill="currentColor"/>'),
  race_start: _s('<circle cx="8" cy="6" r="2.5"/><circle cx="16" cy="6" r="2.5"/><circle cx="8" cy="12" r="2.5"/><circle cx="16" cy="12" r="2.5"/><circle cx="8" cy="18" r="2.5" fill="currentColor" opacity="0.3"/><circle cx="16" cy="18" r="2.5" fill="currentColor" opacity="0.3"/>'),
  formation_lap: _s('<path d="M3 6h18"/><path d="M7 6v12"/><path d="M12 6v12"/><path d="M17 6v12"/><path d="M5 14h14" stroke-dasharray="2 2"/><path d="M3 18h18"/>'),
  pit_entry: _s('<path d="M3 12h4l2-3h6l2 3h4"/><path d="M7 12v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-5"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/><path d="M11 5h2v4h-2z" fill="currentColor" stroke="none"/><path d="M10 5h4"/>'),
  low_fuel: _s('<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4V2h6v2"/><path d="M9 12h6"/><path d="M12 12v5"/><path d="M8 18h8" stroke-dasharray="2 1"/>'),
  wet_track: _s('<path d="M4 14a4 4 0 0 1 4-4 4 4 0 0 1 4 4 4 4 0 0 0 4-4 4 4 0 0 1 4 4"/><path d="M4 18a4 4 0 0 1 4-4 4 4 0 0 1 4 4 4 4 0 0 0 4-4 4 4 0 0 1 4 4"/><path d="M8 3v3"/><path d="M12 2v4"/><path d="M16 3v3"/>'),
  track_temp_cold: _s('<path d="M12 2v14"/><circle cx="12" cy="18" r="4"/><path d="M8 18a4 4 0 0 0 8 0"/><path d="M10 8h4"/><path d="M10 11h4"/><path d="M3 5l2 1"/><path d="M3 9l2-1"/>'),
  track_temp_hot: _s('<path d="M12 2v14"/><circle cx="12" cy="18" r="4" fill="currentColor" opacity="0.2"/><path d="M8 18a4 4 0 0 0 8 0"/><path d="M10 8h4"/><path d="M10 11h4"/><path d="M18 3l1 3"/><path d="M20 8l-2 1"/><path d="M19 12l-2-1"/>'),
  tyre_wear_high: _s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M9 7l6 10" stroke-dasharray="2 2"/><path d="M15 7l-6 10" stroke-dasharray="2 2"/>'),
  hot_tyres: _s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M10 10l-3-3" stroke-dasharray="1.5 1.5"/><path d="M14 14l3 3" stroke-dasharray="1.5 1.5"/>'),
  incident_spike: _s('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>'),
  black_flag: _s('<path d="M5 2v20"/><path d="M5 4h14v8H5"/><path d="M5 4h7v4H5" fill="currentColor" opacity="0.4"/><path d="M12 8h7v4h-7" fill="currentColor" opacity="0.4"/>'),

  // fallback
  _default: _s('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/>'),
};

// Title → topicId reverse map (matches original)
const _titleToTopicId: Record<string, string> = {
  'Big Save': 'spin_catch',
  'Wall / Barrier Contact': 'wall_contact',
  'Off Track': 'off_track',
  'Kerb / Curb Hit': 'kerb_hit',
  'ABS Activation': 'abs_activation',
  'Traction Control Cut': 'tc_intervention',
  'Close Racing': 'close_battle',
  'Position Gained': 'position_gained',
  'Position Lost': 'position_lost',
  'Yellow Flag': 'yellow_flag',
  'Debris on Track': 'debris_on_track',
  'Race Start': 'race_start',
  'Formation / Pace Lap': 'formation_lap',
  'Personal Best Lap': 'personal_best',
  'Pit Lane Entry': 'pit_entry',
  'Maximum Cornering Load': 'high_cornering_load',
  'FFB Torque Spike': 'ffb_torque_spike',
  'Low Fuel': 'low_fuel',
  'Wet Conditions': 'wet_track',
  'Cold Track Conditions': 'track_temp_cold',
  'High Tyre Wear': 'tyre_wear_high',
  'Overheating Tyres': 'hot_tyres',
  'Major Braking Zone': 'heavy_braking',
  'Hot Qualifying Lap': 'qualifying_push',
  'iRacing Incident Points': 'incident_spike',
  'ERS Battery Low': 'ers_low',
  'High Track Temperature': 'track_temp_hot',
  'DRS Open': 'drs_active',
  'Car On The Limit': 'car_balance_sustained',
  'Black Flag': 'black_flag',
  'Aggressive Gear Shift': 'rapid_gear_change',
  'Long Stint Distance': 'long_stint',
  'Session Time Running Out': 'session_time_low',
  'Brake Bias Adjustment': 'brake_bias_change',
  'Traction Control Adjusted': 'tc_setting_change',
  'ABS Level Adjusted': 'abs_setting_change',
  'Front ARB Adjusted': 'arb_front_change',
  'Rear ARB Adjusted': 'arb_rear_change',
};

// Hue overrides for specific topic categories (matches original)
const _heatTopics: Record<string, boolean> = { hot_tyres: true, track_temp_hot: true };
const _wearTopics: Record<string, boolean> = { tyre_wear_high: true, long_stint: true };
const _bestTopics: Record<string, boolean> = { personal_best: true, position_gained: true };

function resolveIcon(topicId: string, title: string, _category?: string): string {
  if (topicId && _commentaryIcons[topicId]) return _commentaryIcons[topicId];
  const idFromTitle = _titleToTopicId[title];
  if (idFromTitle && _commentaryIcons[idFromTitle]) return _commentaryIcons[idFromTitle];
  return _commentaryIcons['_default'];
}

function resolveHue(hue: number, topicId: string, title: string, severity?: number): number {
  const resolvedTopic = topicId || _titleToTopicId[title] || '';
  if (_heatTopics[resolvedTopic]) return (severity && severity >= 3) ? 0 : 30;
  if (_wearTopics[resolvedTopic]) return 30;
  if (_bestTopics[resolvedTopic]) return 145;
  return hue;
}

/**
 * Parse color string (e.g., "#FF5733") to HSL hue
 */
function getHueFromColor(hex: string): number {
  if (!hex) return 0;
  let r = 0, g = 0, b = 0;
  if (hex.startsWith('#')) {
    const cleanHex = hex.slice(1);
    if (cleanHex.length === 6) {
      r = parseInt(cleanHex.slice(0, 2), 16);
      g = parseInt(cleanHex.slice(2, 4), 16);
      b = parseInt(cleanHex.slice(4, 6), 16);
    } else if (cleanHex.length === 3) {
      r = parseInt((cleanHex[0] ?? '') + (cleanHex[0] ?? ''), 16);
      g = parseInt((cleanHex[1] ?? '') + (cleanHex[1] ?? ''), 16);
      b = parseInt((cleanHex[2] ?? '') + (cleanHex[2] ?? ''), 16);
    }
  }
  r /= 255; g /= 255; b /= 255;
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

export default function CommentaryPanel() {
  const { telemetry } = useTelemetry();
  const scrollElRef = useRef<HTMLDivElement>(null);
  const textElRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  // Compute the effective hue with topic overrides
  const baseHue = useMemo(() => {
    if (!telemetry.commentaryColor) return 0;
    return getHueFromColor(telemetry.commentaryColor);
  }, [telemetry.commentaryColor]);

  const commentaryHue = useMemo(() => {
    return resolveHue(
      baseHue,
      telemetry.commentaryTopicId || '',
      telemetry.commentaryTitle || '',
      telemetry.commentarySeverity
    );
  }, [baseHue, telemetry.commentaryTopicId, telemetry.commentaryTitle, telemetry.commentarySeverity]);

  // Resolve icon HTML
  const iconHtml = useMemo(() => {
    return resolveIcon(
      telemetry.commentaryTopicId || '',
      telemetry.commentaryTitle || '',
      telemetry.commentaryCategory
    );
  }, [telemetry.commentaryTopicId, telemetry.commentaryTitle, telemetry.commentaryCategory]);

  const isVisible = telemetry.commentaryVisible;

  // Handle text overflow scrolling (matches original: wait 620ms then measure)
  useEffect(() => {
    setIsScrolling(false);
    if (!isVisible || !telemetry.commentaryText) return;

    const timer = setTimeout(() => {
      const scrollEl = scrollElRef.current;
      const textEl = textElRef.current;
      if (!scrollEl || !textEl) return;

      const scrollH = scrollEl.clientHeight;
      const textH = textEl.scrollHeight;
      if (textH > scrollH + 4) {
        const overflow = textH - scrollH;
        textEl.style.setProperty('--scroll-distance', `-${overflow}px`);
        const duration = Math.max(6, overflow / 40 * 2 + 4);
        textEl.style.setProperty('--scroll-duration', `${duration.toFixed(1)}s`);
        setIsScrolling(true);
      }
    }, 620);

    return () => clearTimeout(timer);
  }, [isVisible, telemetry.commentaryText]);

  const iconColor = `hsl(${commentaryHue},55%,65%)`;
  const titleColor = `hsl(${commentaryHue},55%,65%)`;
  const innerBg = `hsla(${commentaryHue}, 50%, 13%, 0.96)`;
  const innerBorder = `hsla(${commentaryHue}, 50%, 27%, 0.50)`;

  return (
    <div
      className={`commentary-col ${isVisible ? 'visible' : ''}`.trim()}
      id="commentaryCol"
      style={{ '--commentary-h': commentaryHue } as React.CSSProperties}
    >
      <div
        className="commentary-inner"
        id="commentaryInner"
        style={{ background: innerBg, borderColor: innerBorder }}
      >
        <div
          className="commentary-icon"
          id="commentaryIcon"
          dangerouslySetInnerHTML={{ __html: iconHtml }}
          style={{ color: iconColor }}
        ></div>
        <div className="commentary-title" id="commentaryTitle" style={{ color: titleColor }}>
          {telemetry.commentaryTitle}
        </div>
        <div
          className={`commentary-text-scroll${!isScrolling ? ' no-overflow' : ''}`.trim()}
          id="commentaryScroll"
          ref={scrollElRef}
        >
          <div
            className={`commentary-text${isScrolling ? ' scrolling' : ''}`.trim()}
            id="commentaryText"
            ref={textElRef}
          >
            {telemetry.commentaryText}
          </div>
        </div>
        <canvas className="commentary-gl-canvas" id="commentaryGlCanvas"></canvas>
        <div className="commentary-viz" id="commentaryViz">
          <canvas id="commentaryVizCanvas"></canvas>
          <div className="commentary-viz-value" id="commentaryVizValue"></div>
          <div className="commentary-viz-label" id="commentaryVizLabel"></div>
        </div>
        <div className="commentary-meta" id="commentaryMeta">
          {telemetry.commentaryCategory}
        </div>
      </div>
    </div>
  );
}
