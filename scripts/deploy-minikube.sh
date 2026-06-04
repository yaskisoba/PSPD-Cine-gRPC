#!/usr/bin/env bash
# scripts/deploy-minikube.sh — Full CineGRPC deploy workflow for Minikube.
#
# Usage: ./scripts/deploy-minikube.sh
#
# What it does:
#   1. Verifies dependencies (minikube, kubectl, docker)
#   2. Starts Minikube if not already running
#   3. Points Docker daemon to Minikube's internal registry
#   4. Builds all 4 images (reviews-service build context = project root)
#   5. Applies k8s/deployment.yaml
#   6. Waits for all pods to become Ready
#   7. Prints service URLs
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ── 1. Verify dependencies ────────────────────────────────────────────────────
echo "Checking dependencies..."
for cmd in minikube kubectl docker; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' not found. Install it before running this script."
    exit 1
  fi
done
echo "✓ minikube, kubectl, docker found"

# ── 2. Start Minikube if not running ─────────────────────────────────────────
echo ""
echo "Checking Minikube status..."
if minikube status 2>/dev/null | grep -q "Running"; then
  echo "✓ Minikube is already running"
else
  echo "Starting Minikube..."
  minikube start --driver=docker
  echo "✓ Minikube started"
fi

# ── 3. Point Docker to Minikube registry ─────────────────────────────────────
echo ""
echo "Configuring Docker → Minikube registry..."
eval "$(minikube docker-env)"
echo "✓ Docker daemon pointed to Minikube"

# ── 4. Build Docker images ────────────────────────────────────────────────────
# Resolve gateway URL early so the frontend bundle gets the right VITE_API_URL
MINIKUBE_IP="$(minikube ip)"
GATEWAY_URL="http://${MINIKUBE_IP}:30800"

echo ""
echo "Building Docker images (this may take a few minutes)..."

echo "  [1/4] movies-service..."
docker build -t cinegrpc/movies-service:latest \
  -f movies-service/Dockerfile .
echo "  ✓ cinegrpc/movies-service:latest"

echo "  [2/4] reviews-service..."
# Build context must be project root so that proto/reviews.proto is reachable.
docker build -t cinegrpc/reviews-service:latest \
  -f reviews-service/Dockerfile .
echo "  ✓ cinegrpc/reviews-service:latest"

echo "  [3/4] gateway..."
docker build -t cinegrpc/gateway:latest \
  -f gateway/Dockerfile .
echo "  ✓ cinegrpc/gateway:latest"

echo "  [4/4] frontend (VITE_API_URL=${GATEWAY_URL})..."
# VITE_API_URL is baked at build time; the browser calls the gateway NodePort.
docker build -t cinegrpc/frontend:latest \
  --build-arg VITE_API_URL="${GATEWAY_URL}" \
  -f frontend/Dockerfile .
echo "  ✓ cinegrpc/frontend:latest"

# ── 5. Apply manifests ────────────────────────────────────────────────────────
echo ""
echo "Applying Kubernetes manifests..."
kubectl apply -f k8s/deployment.yaml
echo "✓ Manifests applied (namespace: cinegrpc)"

# ── 6. Wait for pods ──────────────────────────────────────────────────────────
echo ""
echo "Waiting for all pods to become Ready (timeout: 120s)..."
# Give the scheduler a moment to create the pods before watching them
sleep 5
kubectl wait --for=condition=ready pod --all -n cinegrpc --timeout=120s
echo "✓ All pods are Ready"

# ── 7. Print service URLs ─────────────────────────────────────────────────────
FRONTEND_URL="$(minikube service frontend-service -n cinegrpc --url 2>/dev/null)"
GW_URL="$(minikube service gateway-service  -n cinegrpc --url 2>/dev/null)"

echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│           CineGRPC — Running Services             │"
echo "├──────────────────────────────────────────────────┤"
printf "│  Frontend : %-36s │\n" "$FRONTEND_URL"
printf "│  Gateway  : %-36s │\n" "$GW_URL"
printf "│  Swagger  : %-36s │\n" "${GW_URL}/docs"
echo "└──────────────────────────────────────────────────┘"
