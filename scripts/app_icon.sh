#!/usr/bin/env bash
# 从 /Applications 里的 .app 提取真实图标为 PNG（B-Roll 里提到任何软件都用真图标）。
# 用法：app_icon.sh "<App 名或 .app 路径>" <out.png> [尺寸=512]
set -euo pipefail
[ $# -ge 2 ] || { sed -n '2,3p' "$0"; exit 1; }
app="$1"; out="$2"; size="${3:-512}"
[ -d "$app" ] || for d in "/Applications/$app.app" "/System/Applications/$app.app" "/Applications/Utilities/$app.app" "$HOME/Applications/$app.app"; do [ -d "$d" ] && app="$d" && break; done
[ -d "$app" ] || { echo "找不到应用：$1" >&2; exit 1; }
icon=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIconFile' "$app/Contents/Info.plist" 2>/dev/null || true)
icns="$app/Contents/Resources/${icon%.icns}.icns"
[ -f "$icns" ] || icns=$(ls "$app"/Contents/Resources/*.icns 2>/dev/null | head -1)
[ -f "$icns" ] || { echo "$app 没有 .icns（可能用 Assets.car），请截图或用官网图标" >&2; exit 1; }
mkdir -p "$(dirname "$out")"
sips -s format png -Z "$size" "$icns" --out "$out" >/dev/null
echo "$out"
