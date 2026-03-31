# RaceCor Overlay — Visual Style Guide

## Overview

The RaceCor overlay supports three visual styles, each optimized for different viewing contexts:
- **Standard** — full broadcasting aesthetic with effects and branding
- **Minimal** — Tufte-pure data visualization, maximum clarity
- **Minimal+** — racing-educated Tufte with essential data-reactive effects

All three modes share the same underlying data and layout structure. Visual style is applied via CSS custom properties and body class toggles, with no HTML restructuring required.

---

## CSS Variable System

The overlay defines a comprehensive CSS variable library for consistent theming:

### Layout & Spacing
```css
--corner-r: 8px;          /* Primary border radius */
--corner-r-sm: 5px;       /* Secondary border radius */
--gap: 4px;               /* Intra-panel gaps */
--panel-gap: 6px;         /* Inter-panel spacing */
--edge: 10px;             /* Screen edge inset */
--pad: 6px;               /* Padding inside panels */
```

### Colors
```css
--bg: hsla(0, 0%, 8%, 0.90);             /* Primary background */
--bg-panel: hsla(0, 0%, 6%, 0.90);       /* Panel background */
--bg-logo: hsla(0, 0%, 12%, 0.90);       /* Logo panel background */
--border: hsla(0, 0%, 100%, 0.14);       /* Standard border color */

--text-primary: hsla(0, 0%, 100%, 1.0);      /* Headings, values */
--text-secondary: hsla(0, 0%, 100%, 0.69);   /* Labels, hints */
--text-dim: hsla(0, 0%, 100%, 0.55);         /* Footnotes, muted */

--red: #e53935;      /* Caution / Alert */
--green: #43a047;    /* Optimal / Safe */
--amber: #ffb300;    /* Warning / Flag */
--blue: #1e88e5;     /* Info */
--orange: #fb8c00;   /* Secondary alert */
--cyan: #00acc1;     /* Accent */
--purple: hsl(280,80%,70%);  /* Accent */
```

### Typography
```css
--ff: 'Barlow Condensed', 'Corbel', 'Segoe UI', system-ui, sans-serif;
--ff-display: 'Cinzel Decorative', 'Georgia', serif;
--ff-mono: 'JetBrains Mono', 'Consolas', 'SF Mono', monospace;

--fs-xl: 20px;    /* Large headings */
--fs-lg: 13px;    /* Panel titles */
--fs-md: 11px;    /* Standard text */
--fs-sm: 11px;    /* Labels */
--fs-xs: 10px;    /* Fine print */

--fw-black: 800;   /* Strongest emphasis */
--fw-bold: 700;    /* Values, titles */
--fw-semi: 600;    /* Emphasis */
--fw-medium: 500;  /* Mid-weight */
--fw-regular: 400; /* Body text */
```

### Animation & Transitions
```css
--t-fast: 180ms ease;
--t-med: 350ms ease;
--t-slow: 600ms ease-out;
```

### Data Visualization
```css
--sentiment-h: 0;      /* Commentary sentiment hue */
--sentiment-s: 0%;     /* Sentiment saturation */
--sentiment-l: 0%;     /* Sentiment lightness */
--sentiment-alpha: 0;  /* Sentiment halo opacity */
```

---

## Visual Modes

### Standard Mode (Default)

**Philosophy:** Broadcast-grade presentation with full cinematic effects. Maximum visual impact for streaming audiences.

**Characteristics:**
- Full panel borders: `--border: hsla(0,0%,100%,0.14)`
- WebGL effects enabled: bloom, glow, ambient light sampling
- Sentiment halo around dashboard (color-reactive based on commentary tone)
- Animated stripe patterns on race control banner
- Track map player dot glow with drop shadow
- Car manufacturer logo visible (branding)
- K10 logo visible (branding)
- Game logo visible (branding)
- Fuel bar: gradient green → amber → red
- iRating: segmented bar + numeric value
- Safety Rating: pie chart + numeric value
- Commentary panel: 14px padding
- G-force vignette at full intensity
- Backdrop filter blur on panels (CSS)
- All animations enabled

**CSS Class:** (none — this is the root state)

**Use Cases:**
- Broadcast streams
- Public viewing / esports venues
- Premium viewing experience

---

### Minimal Mode

**Philosophy:** Tufte-pure information visualization. Maximum data-ink ratio, zero decoration. All cognitive load goes to reading actual data values.

**Characteristics:**
- No panel borders: `--border: transparent`
- WebGL effects disabled (all canvas/glow hidden)
- No sentiment halo (alpha 0)
- No animated stripe patterns on race control banner — solid color block only
- No track map player dot glow — bright dot only
- Tighter padding: `--pad: 4px`, `--gap: 3px`
- Car manufacturer logo hidden
- K10 branding logo hidden
- Game logo hidden
- Fuel bar: single-hue green darkening (no gradient)
- iRating: number only, no bar
- Safety Rating: number only, no pie chart
- Commentary panel: hidden or minimal
- Labels use regular weight, values use bold — maximum contrast
- Label font sizes reduced by 1px
- No backdrop-filter blur
- No animations except essential state changes (toggles, transitions)
- Drive mode: no background tints, pure black with bright data elements

**CSS Class:** `body.mode-minimal`

**Use Cases:**
- Accessibility-first environments
- Data archival / analysis overlays
- Minimal distraction during intense racing
- Testing and verification

**CSS Variable Overrides:**
```css
body.mode-minimal {
  --border: transparent;
  --pad: 4px;
  --gap: 3px;
}
```

---

### Minimal+ Mode

**Philosophy:** Racing-educated Tufte. Preserves essential data-reactive effects that communicate urgency and state, while removing static decoration. A middle path: maximum clarity + racing context.

**Characteristics:**
- No panel borders: `--border: transparent`
- WebGL effects enabled but reduced intensity (60% of standard)
  - RPM tachometer bloom preserved (color-reactive)
  - Ambient light off
  - Glow canvas off (replaced by CSS-only glow)
- Track map player dot glow preserved, tightened radius
- Fuel bar: green → amber → red (racing color convention)
- Safety Rating: pie chart visible + license-class threshold marks
- Car manufacturer logo visible (contextual data for broadcast)
- K10 branding logo hidden
- Game logo hidden
- Commentary panel visible with tighter padding (10px vs 14px)
- Sentiment halo at 40% of standard alpha (subtle peripheral cue)
- Flag banner: animated stripe on flag state change, settles after 4 seconds
- G-force vignette at 50% intensity (peripheral safety cue)
- Labels use regular weight, values use bold
- Tighter padding: `--pad: 5px`, `--gap: 3px`

**CSS Class:** `body.mode-minimal-plus`

**Use Cases:**
- Serious racing broadcasts (league play, esports)
- Professional stream overlays with pro-audience context
- Training / coaching scenarios (need urgency cues)

**Key Difference from Minimal:**
Data-reactive glow on tachometer stays because RPM heat is actively changing during driving and the color intensity (brighter at redline) encodes urgency that drivers train to perceive. Static decoration (ambient light, sentiment halo at full intensity) is removed.

---

## Feature Gates

### Preset Buttons (Settings → Effects Tab)

Three preset buttons appear at the top of the Effects settings tab:
- **Minimal** — applies all Minimal mode toggles, gates to K10 Pro
- **Minimal+** — applies all Minimal+ mode toggles, gates to K10 Pro
- **Standard** — applies all Standard mode toggles, always available

When K10 Pro is not connected, Minimal and Minimal+ buttons show a pro badge and trigger navigation to the Connections tab.

### Per-Feature Toggles

Individual effect toggles live in the Effects tab and can be mixed:
- **Panel Borders** (default: on)
- **WebGL Effects** (default: on)
- **Ambient Light** (default: reflective)
- **Sentiment Halo** (default: on)
- **Commentary Glow** (default: on)
- **Race Control Animation** (default: on)
- **Track Map Glow** (default: on)
- **Redline Flash** (default: on)
- **Pit Limiter Bonkers** (default: on)

The preset buttons set all toggles at once; individual toggles allow fine-tuning.

---

## Implementation Details

### Body Classes

Visual mode is applied via CSS body class:
```html
<!-- Standard (no class) -->
<body>

<!-- Minimal -->
<body class="mode-minimal">

<!-- Minimal+ -->
<body class="mode-minimal-plus">
```

### Settings Storage

Visual preset is stored in `_settings.visualPreset`:
```javascript
_settings.visualPreset = 'standard' | 'minimal' | 'minimal-plus';
```

Individual toggles are stored separately:
```javascript
_settings.showBorders = boolean;
_settings.showWebGL = boolean;
_settings.ambientMode = 'reflective' | 'matte' | 'plastic' | 'off';
_settings.showSentimentHalo = boolean;
_settings.showCommentaryGlow = boolean;
_settings.showRcAnimation = boolean;
_settings.showMapGlow = boolean;
_settings.showRedlineFlash = boolean;
_settings.showBonkers = boolean;
_settings.showK10Logo = boolean;
_settings.showCarLogo = boolean;
_settings.showGameLogo = boolean;
```

### Drive Mode

Drive mode follows Minimal principles by default:
- Pure black background
- No tints or atmospheric effects
- Bright data elements floating on black
- Optional redline flash (CSS property `--redline-flash: on/off`)
- Color-coding preserved (data, not decoration)

---

## Accessibility

### Color Contrast

All text meets WCAG AAA standards (7:1 ratio minimum):
- Primary text on dark background: `--text-primary` on `--bg`
- Secondary text: `--text-secondary` has sufficient separation

### Colorblind Safety

- Gap ahead/behind uses direction AND color (left = behind, right = ahead)
- Fuel state: green → amber → red uses hue AND saturation darkening
- Tire temperature: color palette tested for deuteranopia and protanopia

### Motion

- All animations respect `prefers-reduced-motion`
- Essential feedback (toggle state changes) use brief, direct transitions
- The Minimal preset disables non-essential animations entirely

---

## Migration Guide

### From Standard to Minimal

Settings automatically collapse when "Minimal" preset is clicked:
1. All glow/bloom effects hidden
2. Panel borders removed
3. Logos hidden
4. Padding tightened
5. Animations disabled (except essential state changes)

No user data is lost — switching back to Standard restores all effects.

### Custom Presets

Users who want "Minimal but keep the fuel gradient" can:
1. Click Minimal preset
2. Manually toggle on `showWebGL` or individual toggles
3. The preset updates the preset button to show "Custom" (not yet implemented, but possible)

---

## Future Enhancements

- **Dark mode / Light mode** — standard CSS dark color scheme swap
- **Custom color schemes** — user-defined hue ranges for alert colors
- **High-contrast mode** — white text, black background, max saturation
- **Dyslexia-friendly font** — OpenDyslexic or similar fallback
- **Salient object detection** — AI-based glow routing to only the most critical data element per frame
