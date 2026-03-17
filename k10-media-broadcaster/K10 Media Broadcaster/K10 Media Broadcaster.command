#!/bin/bash
# ═══════════════════════════════════════════════
#  K10 Media Broadcaster — Overlay Launcher (macOS)
# ═══════════════════════════════════════════════

cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════"
echo " K10 Media Broadcaster — Starting Overlay"
echo "═══════════════════════════════════════════════"
echo ""
echo "Hotkeys:"
echo "  Cmd+Shift+S   Toggle settings mode (clickable)"
echo "  Cmd+Shift+H   Toggle overlay visibility"
echo "  Cmd+Shift+G   Toggle green-screen mode (restarts)"
echo "  Cmd+Shift+T   Toggle React/original dashboard (restarts)"
echo "  Cmd+Shift+R   Reset window position/size"
echo "  Cmd+Shift+D   Restart demo sequence"
echo "  Cmd+Shift+Q   Quit overlay"
echo ""

# Check for npm/npx
if ! command -v npx &>/dev/null; then
    echo "ERROR: Node.js not found."
    echo ""
    echo "Install it from https://nodejs.org"
    echo "  or:  brew install node"
    echo ""
    read -p "Press Enter to close..."
    exit 1
fi

# Auto-install if node_modules missing or Electron binary not executable
if [ ! -d "node_modules" ] || [ ! -x "node_modules/.bin/electron" ]; then
    echo "Installing dependencies..."
    echo ""
    bash "$(dirname "$0")/install.command"
    if [ $? -ne 0 ]; then
        read -p "Press Enter to close..."
        exit 1
    fi
    echo ""
    echo "Dependencies installed. Launching overlay..."
    echo ""
fi

# Rebuild React dashboard if source is newer than built output
SRC_DIR="$(dirname "$0")/../src"
if [ -f "$SRC_DIR/package.json" ]; then
    if [ ! -f "dashboard-react.html" ]; then
        echo "React dashboard not built. Building..."
        pushd "$SRC_DIR" >/dev/null
        npx vite build
        popd >/dev/null
    fi
fi

# Ensure all bin stubs are executable (may lose +x via cross-platform sync)
chmod +x node_modules/.bin/* 2>/dev/null

# Fix Electron code signature if needed (macOS kills unsigned binaries on Apple Silicon)
ELECTRON_APP="node_modules/electron/dist/Electron.app"
if [ -d "$ELECTRON_APP" ]; then
    codesign --verify "$ELECTRON_APP" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo "Fixing Electron code signature..."
        xattr -cr "$ELECTRON_APP" 2>/dev/null
        codesign --force --deep --sign - "$ELECTRON_APP" 2>/dev/null
    fi
fi

# Launch Electron overlay (detach so Terminal can close)
nohup npx electron . >/dev/null 2>&1 &
disown
