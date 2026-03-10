#!/usr/bin/env bash
set -euo pipefail

# Al-Bayt Manager — Build & Deploy Script
# Usage: ./deploy.sh
#
# What it does:
#   1. Installs dependencies (frontend + backend)
#   2. Builds the frontend (Vite → dist/)
#   3. Builds the backend (TypeScript → server/dist/)
#   4. Creates upload directories if they don't exist
#   5. Runs database migrations

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"

# Upload directories (relative to server/)
UPLOAD_DIR="$SERVER_DIR/uploads"
PUBLIC_UPLOAD_DIR="$SERVER_DIR/public-uploads"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[x]${NC} $*"; exit 1; }

# ─── Check prerequisites ───
command -v node  >/dev/null 2>&1 || error "node is not installed"
command -v npm   >/dev/null 2>&1 || error "npm is not installed"

NODE_VERSION=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 20 ]; then
  error "Node.js 20+ required (found v$NODE_VERSION)"
fi

# ─── Frontend ───
info "Installing frontend dependencies..."
cd "$ROOT_DIR"
npm ci --prefer-offline

info "Building frontend..."
npm run build

# ─── Backend ───
info "Installing backend dependencies..."
cd "$SERVER_DIR"
npm ci --prefer-offline

info "Building backend..."
npm run build

# ─── Upload directories ───
create_dir() {
  if [ -d "$1" ]; then
    warn "Directory already exists, skipping: $1"
  else
    info "Creating directory: $1"
    mkdir -p "$1"
  fi
}

create_dir "$UPLOAD_DIR/issues"
create_dir "$UPLOAD_DIR/avatars"
create_dir "$PUBLIC_UPLOAD_DIR/logos"

# ─── Database migrations ───
if [ -f "$SERVER_DIR/.env" ]; then
  info "Running database migrations..."
  cd "$SERVER_DIR"
  npm run db:migrate
else
  warn "No server/.env found — skipping migrations (they will run on first start)"
fi

echo ""
info "Deploy complete!"
info "Frontend:        $ROOT_DIR/dist/"
info "Backend:         $SERVER_DIR/dist/"
info "Uploads:         $UPLOAD_DIR"
info "Public uploads:  $PUBLIC_UPLOAD_DIR"
echo ""
info "Restart the service to apply changes:"
info "  sudo systemctl restart al-bayt-api"
