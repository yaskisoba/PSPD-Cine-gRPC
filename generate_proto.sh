#!/usr/bin/env bash
# generate_proto.sh — Generates gRPC stubs for all CineGRPC services.
#
# Outputs:
#   gateway/generated/      — Python stubs (movies_pb2, reviews_pb2, *_grpc)
#   movies-service/generated/ — Go stubs   (movies.pb.go, movies_grpc.pb.go)
#
# Requirements:
#   Python: pip install grpcio-tools
#   Go:     go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
#           go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
set -euo pipefail

PROTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/proto"
GATEWAY_OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/gateway/generated"
MOVIES_OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/movies-service/generated"

# ── Dependency checks ─────────────────────────────────────────────────────────
if ! command -v protoc &>/dev/null; then
  echo "ERROR: protoc not found."
  echo ""
  echo "Install instructions:"
  echo "  Ubuntu/Debian : sudo apt install -y protobuf-compiler"
  echo "  macOS (Homebrew): brew install protobuf"
  echo "  Manual        : https://github.com/protocolbuffers/protobuf/releases"
  exit 1
fi

echo "protoc $(protoc --version)"

# ── Create output directories ─────────────────────────────────────────────────
mkdir -p "$GATEWAY_OUT" "$MOVIES_OUT"

# ── Python stubs (gateway) ────────────────────────────────────────────────────
echo ""
echo "Generating Python stubs for gateway..."

if ! python3 -c "import grpc_tools" &>/dev/null 2>&1; then
  echo "ERROR: grpcio-tools is not installed."
  echo "  Run: pip install grpcio-tools"
  exit 1
fi

python3 -m grpc_tools.protoc \
  -I"$PROTO_DIR" \
  --python_out="$GATEWAY_OUT" \
  --grpc_python_out="$GATEWAY_OUT" \
  "$PROTO_DIR/movies.proto" \
  "$PROTO_DIR/reviews.proto"

# grpc_tools emits relative imports by default; fix them to absolute for Python 3
sed -i 's/^import movies_pb2/from . import movies_pb2/'   "$GATEWAY_OUT/movies_pb2_grpc.py"  2>/dev/null || true
sed -i 's/^import reviews_pb2/from . import reviews_pb2/' "$GATEWAY_OUT/reviews_pb2_grpc.py" 2>/dev/null || true

touch "$GATEWAY_OUT/__init__.py"

echo "✓ Python stubs generated → $GATEWAY_OUT"
echo "    movies_pb2.py  movies_pb2_grpc.py"
echo "    reviews_pb2.py reviews_pb2_grpc.py"

# ── Go stubs (movies-service) ─────────────────────────────────────────────────
echo ""
echo "Generating Go stubs for movies-service..."

for plugin in protoc-gen-go protoc-gen-go-grpc; do
  if ! command -v "$plugin" &>/dev/null; then
    echo "ERROR: $plugin not found."
    echo "  Install:"
    echo "    go install google.golang.org/protobuf/cmd/protoc-gen-go@latest"
    echo "    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest"
    echo "  Then add \$GOPATH/bin to your PATH."
    exit 1
  fi
done

protoc \
  -I"$PROTO_DIR" \
  --go_out="$MOVIES_OUT" \
  --go_opt=paths=source_relative \
  --go-grpc_out="$MOVIES_OUT" \
  --go-grpc_opt=paths=source_relative \
  "$PROTO_DIR/movies.proto"

echo "✓ Go stubs generated → $MOVIES_OUT"
echo "    movies.pb.go  movies_grpc.pb.go"

echo ""
echo "All stubs generated successfully."
