#!/bin/bash
# ═══════════════════════════════════════════════
#  K10 Media Broadcaster — Rebuild React Dashboard
# ═══════════════════════════════════════════════

cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════"
echo " K10 Media Broadcaster — Rebuild React Dashboard"
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

SRC_DIR="$(dirname "$0")/../src"
if [ ! -f "$SRC_DIR/package.json" ]; then
    echo "ERROR: React source directory not found at ../src"
    read -p "Press Enter to close..."
    exit 1
fi

echo "[1/3] Installing React dependencies..."
cd "$SRC_DIR"
npm install
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: npm install failed."
    read -p "Press Enter to close..."
    exit 1
fi

echo ""
echo "[2/3] Building React dashboard..."
npx vite build
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Vite build failed."
    read -p "Press Enter to close..."
    exit 1
fi

cd "$(dirname "$0")"

echo ""
echo "[3/3] Verifying build output..."
if [ -f "dashboard-react.html" ]; then
    echo "  dashboard-react.html OK"
else
    echo "  WARNING: dashboard-react.html not found"
fi

echo ""
echo "Done! React dashboard rebuilt successfully."
echo ""
read -p "Press Enter to close..."
