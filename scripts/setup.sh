#!/bin/bash
# 一次性安装：语音识别（faster-whisper）装进独立环境 ~/.cache/tutorial-b-roll/venv，不动系统 Python。
# 渲染用的 playwright-core 由 render.js 首次运行时自动安装。
set -euo pipefail
D=~/.cache/tutorial-b-roll; V=$D/venv; mkdir -p "$D"
PY=$(command -v python3.12 || command -v python3.11 || command -v python3)   # ctranslate2 对新版 Python 的轮子可能滞后
[ -x "$V/bin/python" ] || "$PY" -m venv "$V"
if ! "$V/bin/pip" install -q --disable-pip-version-check faster-whisper 2>/dev/null; then
  # 公司网络/代理常见：Python 证书包里没有代理的根证书 → 用 macOS 钥匙串里的证书（不关闭校验）
  echo "pip 证书校验失败，改用系统钥匙串证书重试…"
  security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain /Library/Keychains/System.keychain > "$D/ca.pem"
  SSL_CERT_FILE="$D/ca.pem" PIP_CERT="$D/ca.pem" "$V/bin/pip" install -q --disable-pip-version-check faster-whisper
fi
"$V/bin/python" -c "import faster_whisper;print('faster-whisper', faster_whisper.__version__, 'OK')"
command -v ffmpeg >/dev/null || echo "⚠ 没找到 ffmpeg：brew install ffmpeg"
[ -d "/Applications/Google Chrome.app" ] || echo "⚠ 没找到 Google Chrome（或用环境变量 CHROME 指定浏览器路径）"
