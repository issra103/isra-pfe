#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  EnergyWatch — Lanceur universel
#  Usage : ./start.sh
#  Démarre : MongoDB · Backend Node.js · Service IA FastAPI · Simulateur · Frontend
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV_PYTHON="$ROOT/ai_service/venv/bin/python"
VENV_UVICORN="$ROOT/ai_service/venv/bin/uvicorn"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

# ─── Couleurs ─────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERR]${NC}   $*"; }

# ─── Nettoyage à la sortie (Ctrl+C) ──────────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  warn "Arrêt de tous les services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null && info "PID $pid arrêté" || true
  done
  # Stop mongod if we started it
  if [[ -n "${MONGO_PID:-}" ]]; then
    kill "$MONGO_PID" 2>/dev/null && info "MongoDB arrêté" || true
  fi
  success "Tous les services arrêtés."
  exit 0
}
trap cleanup INT TERM

# ─── 1. Vérifications préalables ──────────────────────────────────────────────
info "Vérification de l'environnement..."

if ! command -v mongod &>/dev/null; then
  error "mongod introuvable. Installez MongoDB : brew install mongodb-community"
  exit 1
fi
if ! command -v node &>/dev/null; then
  error "node introuvable."
  exit 1
fi
if [[ ! -f "$VENV_PYTHON" ]]; then
  error "Venv Python introuvable : $VENV_PYTHON"
  error "Créez-le : cd ai_service && python3 -m venv venv && venv/bin/pip install -r requirements.txt"
  exit 1
fi
if [[ ! -f "$ROOT/ai_service/models/anomaly_model.pkl" ]]; then
  warn "Modèles IA introuvables — lancement de l'entraînement..."
  "$VENV_PYTHON" "$ROOT/ai_service/train.py" 2>&1 | tee "$LOG_DIR/train.log"
  success "Entraînement terminé"
fi

# ─── 2. MongoDB ───────────────────────────────────────────────────────────────
info "Démarrage de MongoDB..."
if pgrep -x mongod &>/dev/null; then
  success "MongoDB déjà actif"
else
  mkdir -p "$ROOT/data/db"
  mongod --dbpath "$ROOT/data/db" --logpath "$LOG_DIR/mongodb.log" --fork --quiet
  MONGO_PID=$(pgrep -x mongod | tail -1)
  success "MongoDB démarré (PID $MONGO_PID, log: logs/mongodb.log)"
fi
sleep 1

# ─── 3. Backend Node.js (port 4000) ───────────────────────────────────────────
info "Démarrage du Backend Node.js..."
cd "$ROOT/backend"
if [[ ! -d node_modules ]]; then
  warn "node_modules manquant — npm install..."
  npm install --silent
fi
node src/app.js >"$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
PIDS+=("$BACKEND_PID")
sleep 2
if kill -0 "$BACKEND_PID" 2>/dev/null; then
  success "Backend démarré (PID $BACKEND_PID) → http://localhost:4000  [log: logs/backend.log]"
else
  error "Backend a planté — voir logs/backend.log"
  cat "$LOG_DIR/backend.log"
  exit 1
fi

# ─── 4. Service IA FastAPI (port 8000) ────────────────────────────────────────
info "Démarrage du Service IA FastAPI..."
cd "$ROOT/ai_service"
"$VENV_UVICORN" main:app --host 0.0.0.0 --port 8000 >"$LOG_DIR/ai.log" 2>&1 &
AI_PID=$!
PIDS+=("$AI_PID")
sleep 2
if kill -0 "$AI_PID" 2>/dev/null; then
  success "Service IA démarré (PID $AI_PID) → http://localhost:8000  [log: logs/ai.log]"
else
  error "Service IA a planté — voir logs/ai.log"
  cat "$LOG_DIR/ai.log"
  exit 1
fi

# ─── 5. Simulateur Python ─────────────────────────────────────────────────────
info "Démarrage du Simulateur IoT..."
cd "$ROOT/simulator"
"$VENV_PYTHON" simulator.py >"$LOG_DIR/simulator.log" 2>&1 &
SIM_PID=$!
PIDS+=("$SIM_PID")
sleep 2
if kill -0 "$SIM_PID" 2>/dev/null; then
  success "Simulateur démarré (PID $SIM_PID) [log: logs/simulator.log]"
else
  error "Simulateur a planté — voir logs/simulator.log"
  cat "$LOG_DIR/simulator.log"
fi

# ─── 6. Frontend Vite (port 3000) ─────────────────────────────────────────────
info "Démarrage du Frontend React..."
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  warn "node_modules manquant — npm install..."
  npm install --silent
fi
npm run dev -- --port 3000 >"$LOG_DIR/frontend.log" 2>&1 &
FRONT_PID=$!
PIDS+=("$FRONT_PID")
sleep 3
if kill -0 "$FRONT_PID" 2>/dev/null; then
  success "Frontend démarré (PID $FRONT_PID) → http://localhost:3000  [log: logs/frontend.log]"
else
  error "Frontend a planté — voir logs/frontend.log"
  cat "$LOG_DIR/frontend.log"
  exit 1
fi

# ─── Récapitulatif ────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     EnergyWatch — Tous les services actifs       ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  🗄  MongoDB        localhost:27017              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ⚙️  Backend API    http://localhost:4000        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🤖 Service IA     http://localhost:8000        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  📡 Simulateur     en cours d'exécution         ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🌐 Interface      http://localhost:3000        ${GREEN}║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Logs → ./logs/                                 ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Appuyez sur Ctrl+C pour tout arrêter           ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Attente (maintient le trap actif) ────────────────────────────────────────
wait
