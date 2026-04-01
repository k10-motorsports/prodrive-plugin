---
title: "v0.2: Dashboard, Maps, and the Pedal Curve Wars"
date: "2026-03-27T12:36:00-06:00"
version: "0.2.0"
---

We shipped the live dashboard embed on the marketing site — real telemetry polling straight into the browser. No smoke and mirrors. The track map got a serious overhaul: g-force trails now animate behind your player dot, manufacturer colors code each driver, and glow effects bloom wherever there's action. It's subtle but it changes how you read the field.

The commentary system leveled up too — we baked in car research with factory photos. You'll actually see the car you're talking about instead of guessing.

On the hardware side, the Moza pedal curve system got rebuilt from the ground up. Full-size curves, direction matching that finally works, the whole deal. We also flipped tire wear backwards — it now shows remaining percentage instead of worn, which feels more natural when you're thinking about pit strategy.

Some quality-of-life wins: logo-only startup mode (HUD reveals when the session goes hot), Settings split into subtabs with Branding isolated, pit limiter detection finally doesn't lie, spotter alerts warn you about tire-track mismatches. Sparklines stopped drawing garbage during rolling starts. And we decoupled data fetch from DOM rendering — you're looking at 60fps+ now.

Small release but the compounding effect is real.

---
title: "v0.3: Pro Members and Better Maps"
date: "2026-03-29T16:26:00-06:00"
version: "0.3.0"
---

K10 Pro Drive is live. Full OAuth2 flow — members authenticate through the marketing site and unlock pro features gated behind real auth, not just a checkbox. No more honor system.

The track map rendering got another pass too. Trails are smoother, zoom behaves right, the glow effects don't get confused when drivers stack up. Map is starting to feel like the nerve center it should be.

Small release by line count, massive one in terms of what it unlocks. The infrastructure to run a real membership program is there now.

---
title: "v0.4: We're RaceCor Now"
date: "2026-03-30T15:54:00-06:00"
version: "0.4.0"
---

We burned down K10 Motorsports and rose as RaceCor.io. Full rebrand — repository restructured, simhub-plugin and homebridge merged into racecor-plugin, web folder shuffled, OAuth redirects all point to prodrive.racecor.io now. New branding icons everywhere: plugin, overlay, the works.

Typography switched to Cinzel Decorative display font with a hard 14px minimum. Taskbar reflowed, histograms got layered, fonts adjusted for the new branding weight. New logo work means the whole visual identity snapped into place.

Big structural change but zero product breakage. The foundation is firmer.

---
title: "v0.5: Cloud Sync and Dashboard Polish"
date: "2026-03-30T21:00:00-06:00"
version: "0.5.0"
---

Track maps are now synced to PostgreSQL and cached in the cloud. No more local-only limitations — maps stay consistent across installs.

The dashboard got serious polish: map layout makes sense now, logos render right, fonts match the rebrand, game logo detection fixed, close and quit buttons work like you'd expect. Leaderboard gap modes let you choose how to read gaps — delta, gap-to-leader, whatever fits your broadcast. Tire and fuel have fallback logic when telemetry stutters. Tire strategy noise got suppressed so false alarms don't spam your chat.

Custom logo and subtitle support shipped. Moza folder import works. These sound small but they're the details that keep a broadcast running smooth when things get weird.

---
title: "v0.6: Web Components, Design Audits, and Admin"
date: "2026-03-31T16:57:00-06:00"
version: "0.6.0"
---

All 21 overlay modules are now web components. We did it in three phases — shadow DOM isolation, CSS variables crossing shadow boundaries, CustomEvent data bus. Zero visual regression. Same pixels on screen, but now components are reusable between overlay and web app. Future-proofing paid off immediately.

We also ran design audits. Tufte data visualization scored 72/100 (not bad for a racing HUD). Racing HUD design review hit 79/100. That feedback is already rolling into v0.7.

New admin area shipped with track management built in. Fuel and tyres stripped from the main HUD — they were noise when you're trying to read the race. Sparkline finally stops lying during rolling starts. Pitbox dismiss works now.

Structural win that unblocks the web app without breaking anything.

---
title: "v0.7: Effects, Presets, and Custom Track Names"
date: "2026-03-31T18:23:00-06:00"
version: "0.7.0"
---

New Effects tab consolidates every visual knob we scattered across settings — lighting, glow, animation, WebGL, ambient. All in one place instead of hunting through Branding or Display.

Three visual presets: Standard (what you know), Minimal (Tufte-pure — strips chartjunk, maximizes data-ink ratio), and Minimal+ (racing-educated Tufte — keeps the reactive glow and fuel colors that matter for racing). Minimal and Minimal+ are gated behind K10 Pro.

Map panel layout got fixed — SVG now flush to top instead of floating awkwardly. Track display names are editable from the admin area and fetched by the overlay from the API, falling back to the game name if something breaks.

We seeded 11 bundled track maps to the database. You've got something to build on immediately instead of starting blank.

Small feature-wise but this is the kind of release that makes the product feel complete. Everything has its place.
