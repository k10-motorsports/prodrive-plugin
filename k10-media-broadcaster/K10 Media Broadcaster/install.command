#!/bin/bash
# ═══════════════════════════════════════════════
#  K10 Media Broadcaster — Install Dependencies
# ═══════════════════════════════════════════════

cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════"
echo " K10 Media Broadcaster — Install Dependencies"
echo "═══════════════════════════════════════════════"
echo ""

# Check for npm
if ! command -v npm &>/dev/null; then
    echo "ERROR: npm not found."
    echo ""
    echo "Install Node.js from https://nodejs.org"
    echo "  or:  brew install node"
    echo ""
    read -p "Press Enter to close..."
    exit 1
fi

echo "[1/5] Cleaning previous install (fixes code-signature issues)..."
rm -rf node_modules package-lock.json

echo ""
echo "[2/5] Installing Electron dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: npm install failed."
    read -p "Press Enter to close..."
    exit 1
fi

# Fix macOS code signature — required on Apple Silicon after fresh install
echo ""
echo "  Fixing Electron code signature..."
xattr -cr node_modules/electron/dist/Electron.app 2>/dev/null
codesign --force --deep --sign - node_modules/electron/dist/Electron.app 2>/dev/null

echo ""
echo "[3/5] Installing React dashboard dependencies..."
SRC_DIR="$(dirname "$0")/../src"
if [ ! -f "$SRC_DIR/package.json" ]; then
    echo "WARNING: React source directory not found — skipping React build."
else
    cd "$SRC_DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "ERROR: React dependency install failed."
        read -p "Press Enter to close..."
        exit 1
    fi

    echo ""
    echo "[4/5] Building React dashboard..."
    npx vite build
    if [ $? -ne 0 ]; then
        echo ""
        echo "ERROR: React dashboard build failed."
        read -p "Press Enter to close..."
        exit 1
    fi
    cd "$(dirname "$0")"
fi

echo ""
echo "[5/5] Verifying build output..."
if [ -f "dashboard-react.html" ]; then
    echo "  dashboard-react.html OK"
else
    echo "  WARNING: dashboard-react.html not found"
fi

echo ""
echo "Done! Double-click 'K10 Media Broadcaster.command' to launch the overlay."
echo ""
read -p "Press Enter to close..."
