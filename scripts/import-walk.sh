#!/usr/bin/env bash
# Turn a walk-cycle video (character on a plain green/blue background) into transparent walk frames.
# Usage: bash scripts/import-walk.sh <character-id> <video> [fps=12] [key-colour=0x00FF00] [height=560]
# Writes assets/characters/<id>/walk_1.png ... walk_N.png (old walk_*.png for that id are removed first).
set -euo pipefail
id="${1:?character id}"; video="${2:?video file}"; fps="${3:-12}"; key="${4:-0x00FF00}"; height="${5:-560}"
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
[[ "$id" =~ ^[a-z0-9_-]+$ ]] || { echo "bad character id: $id" >&2; exit 1; }
out="assets/characters/$id"
mkdir -p "$out"
rm -f "$out"/walk_*.png
ffmpeg -loglevel error -i "$video" \
  -vf "fps=$fps,colorkey=$key:0.30:0.08,despill=type=green,scale=-1:$height:flags=lanczos,format=rgba" \
  "$out/walk_%d.png"
n=$(ls "$out"/walk_*.png | wc -l)
echo "Wrote $n frames to $out (set \"walkFps\": $fps and \"walkFacing\" in $out/character.json)"
