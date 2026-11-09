#!/usr/bin/env bash
# 把多段 B-Roll 一次性合成回整条原视频（保留原声、帧率跟原视频一致）。
# 用法：compose.sh <原视频> <out.mp4> <片段1> <入点1秒> [<片段2> <入点2秒> ...]
#   片段可以是遮盖/增强的 .mp4，也可以是透明 .mov/.webm；出点按片段自身时长计算。
set -euo pipefail
[ $# -ge 4 ] && [ $(( ($# - 2) % 2 )) -eq 0 ] || { sed -n '2,4p' "$0"; exit 1; }
src="$1"; out="$2"; shift 2
rate=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$src")
inputs=(-i "$src"); fc=""; last="0:v"; i=1
while [ $# -gt 0 ]; do
  clip="$1"; t0="$2"; shift 2
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$clip")
  t1=$(awk -v a="$t0" -v d="$dur" 'BEGIN{printf "%.4f", a+d}')
  case "$clip" in *.webm) inputs+=(-c:v libvpx-vp9);; esac
  inputs+=(-i "$clip")
  fc+="[$i:v]format=rgba,setpts=PTS-STARTPTS+${t0}/TB[c$i];[$last][c$i]overlay=0:0:eof_action=pass:enable='between(t,${t0},${t1})'[v$i];"
  last="v$i"; i=$((i+1))
done
fc+="[$last]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[out]"
ffmpeg -y -v error "${inputs[@]}" -filter_complex "$fc" -map "[out]" -map 0:a? \
  -c:v libx264 -preset slow -crf 17 -r "$rate" -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a copy -movflags +faststart "$out"
echo "合成：$out"
