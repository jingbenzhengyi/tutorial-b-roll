#!/usr/bin/env python3
"""文字稿 → 时间轴 JSON（与 transcribe.py 同格式）。根据文字做 B-Roll 的第一步。
用法：text_timeline.py <文稿.txt|-> [-o timeline.json] [--voice Tingting] [--rate 210] [--cps 4.2] [--pause .35] [--lead .5]
  不给 --voice：按朗读速度估算时间（cps = 每秒字数），出无声画面，之后可以按画面配音或剪辑时再对齐。
  给 --voice：用 macOS 系统朗读（say）逐句生成配音 → <文稿名>_配音.m4a；每句的起止时间是真实时长。
             中文声音：Tingting / Eddy / Flo / Reed / Sandy / Shelley…（say -v '?' | grep zh_CN 查看）。
  句内逐字时间按字数均分（估算）；需要精确到字时，对生成的配音再跑一次 transcribe.py。"""
import sys, os, re, json, subprocess, tempfile, argparse

ap = argparse.ArgumentParser()
ap.add_argument('input'); ap.add_argument('-o', '--out')
ap.add_argument('--voice'); ap.add_argument('--rate', type=int); ap.add_argument('--audio-out')
ap.add_argument('--cps', type=float, default=4.2); ap.add_argument('--pause', type=float, default=.35); ap.add_argument('--lead', type=float, default=.5)
a = ap.parse_args()
raw = sys.stdin.read() if a.input == '-' else open(a.input, encoding='utf-8').read()
stem = 'script' if a.input == '-' else os.path.splitext(os.path.abspath(a.input))[0]

# 去掉 Markdown 记号，按句末标点/换行分句；太长的句子再按逗号切
text = re.sub(r'^\s*(#+|[-*>]|\d+[.、)])\s*', '', raw, flags=re.M).replace('**', '').replace('`', '')
sents = []
for part in re.split(r'(?<=[。！？!?；;])|\n+', text):
    part = part.strip()
    if not part: continue
    while len(part) > 40 and '，' in part[12:]:
        k = part.index('，', 12) + 1
        sents.append(part[:k]); part = part[k:].strip()
    if part: sents.append(part)
if not sents: sys.exit('文稿是空的')

TOK = re.compile(r'[A-Za-z0-9][A-Za-z0-9.\-_+%/]*|[\u3400-\u9fff]|[^\s]')
PUNCT = set('，。！？；：、“”‘’（）《》,.!?;:()"\'—…·')
def words_in(s, t0, t1):
    toks = TOK.findall(s); wt = [0 if x in PUNCT else (1.6 if x[0].isascii() and len(x) > 1 else 1) for x in toks]
    tot = sum(wt) or 1; t = t0; out = []
    for x, w in zip(toks, wt):
        if w == 0:
            if out: out[-1]['w'] += x
            continue
        d = (t1 - t0) * w / tot; out.append({'w': x, 's': round(t, 2), 'e': round(t + d, 2)}); t += d
    return out

dur = lambda f: float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode())
segments, t, audio = [], a.lead, None
with tempfile.TemporaryDirectory() as d:
    parts = []
    if a.voice:
        sil = lambda sec, name: (subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', str(sec), os.path.join(d, name)], check=True), os.path.join(d, name))[1]
        parts.append(sil(a.lead, 'lead.wav')); gap = sil(a.pause, 'gap.wav')
    for i, s in enumerate(sents):
        if a.voice:
            aiff, wav = os.path.join(d, f'{i}.aiff'), os.path.join(d, f'{i}.wav')
            subprocess.run(['say', '-v', a.voice, *(['-r', str(a.rate)] if a.rate else []), '-o', aiff, '--', s], check=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-i', aiff, '-ar', '44100', '-ac', '1', wav], check=True)
            ln = dur(wav); parts += [wav, gap]
        else:
            ln = max(1.2, len([x for x in TOK.findall(s) if x not in PUNCT]) / a.cps)
        segments.append({'i': i + 1, 'start': round(t, 2), 'end': round(t + ln, 2), 'text': s, 'words': words_in(s, t, t + ln)})
        t += ln + a.pause
    if a.voice:
        audio = os.path.abspath(a.audio_out or stem + '_配音.m4a')
        lst = os.path.join(d, 'list.txt')
        open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c:a', 'aac', '-b:a', '160k', audio], check=True)

total = round(t - a.pause + a.lead, 2)
tl = {'source': 'tts' if a.voice else 'text', 'audio': audio, 'estimated': not a.voice, 'from': 0, 'to': total, 'segments': segments}
out = a.out or stem + '_timeline.json'
with open(out, 'w', encoding='utf-8') as f: json.dump(tl, f, ensure_ascii=False, indent=1)
for s in segments:
    print(f"[{s['i']:02d}] {s['start']:6.2f}–{s['end']:6.2f}  {s['text']}")
print(f"\n时间轴已写入 {out}（{len(segments)} 句，总长 {total:.2f}s{'，配音 ' + audio if audio else '，时间为估算、无声'}）")
