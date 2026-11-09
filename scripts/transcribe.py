#!/usr/bin/env python3
"""音频（或视频的声音）→ 时间轴 JSON：分句 + 逐字时间戳。根据音频做 B-Roll 的第一步。
用法：transcribe.py <音频或视频> [--from 秒] [--to 秒] [--model large-v3|medium|small] [-o timeline.json] [--srt 字幕.srt]
时间都是这个音频文件里的绝对秒（给了 --from 也一样），可以直接写进 story.html 的 from/to/at，
渲染时 render.js --audio 同一个文件即可对上。"""
import sys, os, json, subprocess, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _env import whisper_model, load_audio, PROMPT

ap = argparse.ArgumentParser()
ap.add_argument('input'); ap.add_argument('--from', dest='t0', type=float, default=0.0); ap.add_argument('--to', dest='t1', type=float)
ap.add_argument('--model', default='large-v3'); ap.add_argument('-o', '--out'); ap.add_argument('--srt')
a = ap.parse_args()
src = os.path.abspath(a.input)
total = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).decode().strip())
t1 = min(a.t1, total) if a.t1 else total

model = whisper_model(a.model)
if True:
    wav = load_audio(src, a.t0, t1)
    segs, _ = model.transcribe(wav, language='zh', word_timestamps=True, initial_prompt=PROMPT,
                               vad_filter=True, vad_parameters={'min_silence_duration_ms': 400})
    segments = []
    for s in segs:
        words = [{'w': w.word.strip(), 's': round(a.t0 + w.start, 2), 'e': round(a.t0 + w.end, 2)} for w in (s.words or []) if w.word.strip()]
        if not words: continue
        segments.append({'i': len(segments) + 1, 'start': words[0]['s'], 'end': words[-1]['e'], 'text': s.text.strip(), 'words': words})
        print(f"[{len(segments):02d} {words[0]['s']:7.2f}–{words[-1]['e']:7.2f}] {s.text.strip()}", file=sys.stderr)

tl = {'source': 'audio', 'audio': src, 'from': round(a.t0, 2), 'to': round(t1, 2), 'segments': segments}
out = a.out or os.path.splitext(src)[0] + '_timeline.json'
with open(out, 'w', encoding='utf-8') as f: json.dump(tl, f, ensure_ascii=False, indent=1)

# 给人看的版本：每句一行，下面是逐字时间
for s in segments:
    print(f"\n[{s['i']:02d}] {s['start']:.2f}–{s['end']:.2f}  {s['text']}")
    print('     ' + '  '.join(f"{w['w']}@{w['s']:.2f}" for w in s['words']))
print(f'\n时间轴已写入 {out}（{len(segments)} 句，{a.t0:.2f}–{t1:.2f}s）')

if a.srt:
    ts = lambda t: f'{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(round(t % 1 * 1000)) % 1000:03d}'
    with open(a.srt, 'w', encoding='utf-8') as f:
        for s in segments: f.write(f"{s['i']}\n{ts(s['start'])} --> {ts(s['end'])}\n{s['text']}\n\n")
    print(f'字幕已写入 {a.srt}')
