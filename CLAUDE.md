# Project Guidelines

## Agent Work — Always Use Worktrees

All agent-spawned work (subagents, background tasks, investigations, code changes) MUST run in
isolated git worktrees (`isolation: "worktree"`). This keeps the main working tree clean, prevents
lock file conflicts, and allows parallel agents to operate without stepping on each other.

The only exceptions are:
- Pure read-only exploration (searching, reading files, grepping)
- Single-file writes that don't touch code (e.g., saving a report to the project root)

For anything that modifies code, creates branches, or runs builds/tests — use a worktree.

## Project Overview

K10 Motorsports — a broadcast-grade sim racing platform comprising:
- **racecor-overlay/** — Electron overlay HUD (vanilla JS, WebGL2, Canvas 2D, CSS modules)
- **racecor-plugin/** — SimHub C# .NET plugin + Homebridge HomeKit integration
- **web/** — Next.js marketing site and Pro Drive member dashboard
- **docs/** — Architecture and design documentation
- **scripts/** — Install and launch scripts

## Code Style

- Overlay modules use vanilla JavaScript (no framework) — intentional for performance at 30fps
- CSS uses custom properties (CSS variables) extensively — theme through variables, not class overrides
- WebGL shaders are inlined in JS files
- The overlay polls a local HTTP server (port 8889) for telemetry data
