#!/bin/bash
# Run this ONCE to install all dependencies for nonprofit-audit.
set -e

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "  nonprofit-audit — Setup"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Check / install Node.js ───────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "Node.js not found. Installing via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
  echo "✓ Node.js installed: $(node --version)"
else
  echo "✓ Node.js found: $(node --version)"
fi

# ── npm install ───────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
echo ""
echo "Installing npm dependencies..."
npm install

# ── Playwright browser ────────────────────────────────────────────────────────
echo ""
echo "Installing Playwright Chromium browser..."
npx playwright install chromium

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "  ✓ Setup complete!"
echo ""
echo "  To run an audit, switch to Agent mode in Cursor and say:"
echo "    Run the full nonprofit audit for https://example.org"
echo ""
echo "  Or from Terminal directly:"
echo "    node ~/Desktop/cursor_tools/nonprofit-audit/audit.js https://example.org"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
