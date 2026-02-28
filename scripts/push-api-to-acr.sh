#!/usr/bin/env sh
set -eu

cd "$(cd "$(dirname "$0")/.." && pwd)"

TAG="${1:-}"
if [ -z "$TAG" ]; then
  TAG=$(git rev-parse --short HEAD 2>/dev/null) || true
  if [ -z "$TAG" ]; then
    echo "fatal: no tag provided and git SHA unavailable (not a repo?). Usage: $0 <tag|v1|v2|...>" >&2
    exit 1
  fi
fi

IMAGE=suki-api
REMOTE=sukiacr.azurecr.io/suki-api:$TAG

echo "Building $IMAGE (linux/amd64 for Azure)..."
docker build --platform linux/amd64 -f apps/api/Dockerfile -t "$IMAGE" .

echo "Tagging $REMOTE..."
docker tag "$IMAGE" "$REMOTE"

echo "Pushing $REMOTE..."
docker push "$REMOTE"

echo "Pushed: $REMOTE"
