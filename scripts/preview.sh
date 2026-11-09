#!/usr/bin/env bash
# 把成品片段叠回原视频对应时段（前后各留 1 秒、带原声），只用于检查同步。
# 用法：preview.sh <原视频> <片段.mp4|.mov|.webm> <入点秒> <出点秒> <out.mp4>
set -euo pipefail
[ $# -eq 5 ] || { sed -n '2,3p' "$0"; exit 1; }
src="$1"; clip="$2"; t0="$3"; t1="$4"; out="$5"
pad=1
a=$(awk -v t="$t0" -v p=$pad 'BEGIN{x=t-p; if(x<0)x=0; printf "%.4f", x}')
off=$(awk -v t="$t0" -v a="$a" 'BEGIN{printf "%.4f", t-a}')
d=$(awk -v t0="$t0" -v t1="$t1" -v p=$pad -v off="$off" 'BEGIN{printf "%.4f", t1-t0+off+p}')
dec=(); case "$clip" in *.webm) dec=(-c:v libvpx-vp9);; esac
ffmpeg -y -v error -ss "$a" -t "$d" -i "$src" ${dec[@]+"${dec[@]}"} -i "$clip" -filter_complex \
  "[1:v]format=rgba,setpts=PTS-STARTPTS+${off}/TB[c];[0:v][c]overlay=0:0:eof_action=pass,format=yuv420p[v]" \
  -map "[v]" -map 0:a? -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 160k -movflags +faststart "$out"
echo "预览：$out"
