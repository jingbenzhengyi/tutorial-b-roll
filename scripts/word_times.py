#!/usr/bin/env python3
"""用 faster-whisper 取一段原视频的逐字时间戳，B-Roll 的每个动画节拍都对齐到口播字词。
用法：word_times.py <video> <入点秒> <出点秒> [--model large-v3|medium|small] [--json]
输出时间是原视频绝对时间（可直接写进 renderAt 的节拍注释）。
依赖：先运行一次 setup.sh（faster-whisper 装在 ~/.cache/tutorial-b-roll/venv）。"""
import sys, os, json, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _env import whisper_model, load_audio, PROMPT

ap = argparse.ArgumentParser()
ap.add_argument('video'); ap.add_argument('start', type=float); ap.add_argument('end', type=float)
ap.add_argument('--model', default='large-v3'); ap.add_argument('--json', action='store_true')
a = ap.parse_args()
model = whisper_model(a.model)

if True:
    wav = load_audio(a.video, a.start, a.end)
    segs, _ = model.transcribe(wav, language='zh', word_timestamps=True, vad_filter=False, initial_prompt=PROMPT)
    words = [{'w': w.word.strip(), 's': round(a.start + w.start, 2), 'e': round(a.start + w.end, 2)}
             for s in segs for w in (s.words or [])]

if a.json:
    print(json.dumps(words, ensure_ascii=False, indent=1))
else:
    line = []
    for w in words:
        line.append(f"{w['w']}@{w['s']:.2f}")
        if w['w'][-1:] in '，。？！,.?!' or len(line) >= 10:
            print('  '.join(line)); line = []
    if line: print('  '.join(line))
