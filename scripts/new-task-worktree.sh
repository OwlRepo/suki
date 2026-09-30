#!/bin/sh
# Fresh task worktree per docs/ai/execution.md "Worktree and branch isolation":
# fetch origin first, branch from origin/main HEAD, never reuse stale worktrees.
set -eu

if [ $# -ne 2 ]; then
  echo "Usage: scripts/new-task-worktree.sh <fix|feat|refactor|perf|infra|docs> <short-name>" >&2
  exit 1
fi

type="$1"
name="$2"

case "$type" in
  fix|feat|refactor|perf|infra|docs) ;;
  *)
    echo "Invalid type '$type'. Use: fix|feat|refactor|perf|infra|docs" >&2
    exit 1
    ;;
esac

# Resolve the MAIN repo root even when invoked from inside a worktree
# (--show-toplevel would return the worktree root and nest worktrees).
common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
root="$(dirname "$common_dir")"
branch="$type/no-ticket-$name"
dir="$root/.claude/worktrees/$type-$name"

if [ -e "$dir" ]; then
  echo "Worktree directory already exists: $dir" >&2
  exit 1
fi

git fetch origin
git worktree add --no-track "$dir" -b "$branch" origin/main

echo ""
echo "Worktree ready. Next:"
echo "  cd $dir && bun install --frozen-lockfile"
