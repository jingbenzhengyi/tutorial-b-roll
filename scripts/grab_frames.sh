#!/usr/bin/env bash
# 从原视频按时间点截参考帧（精确定位），用来量坐标、做 enhance 设计、给模板当 poster。
# 用法：grab_frames.sh <video> <outdir> 秒 [秒 ...]   → <outdir>/frame_<秒>.png
set -euo pipefail
[ $# -ge 3 ] || { sed -n '2,3p' "$0"; exit 1; }
src="$1"; out="$2"; shift 2; mkdir -p "$out"
for t in "$@"; do
  ffmpeg -y -v error -i "$src" -ss "$t" -frames:v 1 "$out/frame_${t}.png"
  echo "$out/frame_${t}.png"
done
