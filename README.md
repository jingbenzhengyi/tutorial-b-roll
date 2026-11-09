# tutorial-b-roll

An agent skill (Claude Code / GitHub Copilot) for producing **LinkedIn Learning–style B-Roll** for tutorial videos: write animations in HTML, render frame-by-frame with headless Chrome, encode with ffmpeg — frame rate matched to the source video and beats aligned to word-level narration timestamps.

制作领英学习风格的教学视频 B-Roll：HTML 写动画 → 无头 Chrome 逐帧渲染 → ffmpeg 编码，帧率对齐原视频，节拍对齐口播字级时间。

## Features

- **Cover** – full-screen branded scene replaces a segment
- **Enhance** – dim/spotlight, boxes, numbered callouts, arrows, cards, zoom on the original screen recording
- **Overlay** – transparent title cards and side bullet lists
- **From audio or script** – generate a continuous B-Roll from narration audio or a text script (optional TTS via macOS `say`)
- Export MP4 (with audio) or transparent video (PNG .mov, ProRes 4444, WebM VP9, PNG sequence)
- Optional illustrations via Canva

## Install

```bash
git clone https://github.com/jingbenzhengyi/tutorial-b-roll ~/.claude/skills/tutorial-b-roll
# GitHub Copilot CLI / app
mkdir -p ~/.copilot/skills && ln -s ~/.claude/skills/tutorial-b-roll ~/.copilot/skills/tutorial-b-roll
# One-time: faster-whisper for word timestamps
~/.claude/skills/tutorial-b-roll/scripts/setup.sh
```

Requirements: Node 18+, Google Chrome (or `CHROME=/path/to/chrome`), ffmpeg (libx264; png / prores_ks / libvpx-vp9 for transparent export).

See [`SKILL.md`](SKILL.md) for the full workflow.
