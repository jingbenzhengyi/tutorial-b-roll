---
name: tutorial-b-roll
description: 制作领英学习（LinkedIn Learning）风格的课程视频 B-Roll。用 HTML 写动画、无头 Chrome 逐帧渲染、ffmpeg 编码，帧率与原视频对齐、节拍对齐口播字级时间。支持三种做法：画面遮盖式（全屏品牌画面替换一段）、画面增强式（在原录屏上压暗聚光、框选、编号、箭头、说明卡，或推镜头放大）、透明元素（标题卡、侧边要点）；还能直接根据一段口播音频或一篇文字稿（可自动配音）生成整段连续 B-Roll。可导出 MP4（可带声音），也可导出无背景/透明视频（PNG .mov、ProRes 4444、WebM VP9、PNG 序列），需要配图时调用 Canva 生成插画。用户说"做 B-Roll""做个领英风格的画面""这段加个遮盖/增强/叠加""做透明的/无背景的""导出 MP4""给这段做个标题卡""根据这段音频/口播/文稿/文字做 B-Roll""给这篇稿子配画面""用 Canva 配图"时使用。
---

# 领英学习风格 B-Roll

把课程视频的某一段做成 LinkedIn Learning 风格的 B-Roll：**HTML 写画面 → `scripts/render.js` 逐帧渲染 → MP4 或透明视频**。

- 视觉规范（颜色、字体、安全区、组件、动效）：`references/style-guide.md`，**动手前先读**。
- 三种做法怎么选、每种怎么渲染、导出格式区别：`references/modes.md`
- Canva 配图流程与授权规则：`references/canva.md`
- **只有音频或文字稿**（没有要配的录屏段落）：走 `references/audio-text.md`，用 `templates/story.html`
- 起步模板：`templates/broll.html`（给原视频某一段做画面，含 5 个示例场景：A 遮盖、B 叠加标注、Z 推镜头、T 标题卡、K 侧边要点）；`templates/story.html`（数据驱动的连续画面，9 种场景类型，填 `window.STORY` 即可）
- 背景：暖灰 #F3F2EF + 淡蓝漂移光斑 + 点阵（模板自带，见 style-guide）；顶部标题是章节标题，同一话题的几个场景共用，不要像字幕一样每个场景换

> 如果项目里有自己的约定（例如 `CLAUDE.md` 里的 B-Roll 规则、`B-Roll清单.md`、命名规范），**以项目约定为准**，本 skill 是默认做法。

## 环境

需要：Node 18+、Google Chrome（或 `CHROME=/path/to/chrome`）、ffmpeg（带 libx264；透明导出需要 png / prores_ks / libvpx-vp9 编码器）。`render.js` 首次运行会自动把 `playwright-core` 装到 `~/.cache/tutorial-b-roll`。字级时间戳 / 音频转时间轴需要 faster-whisper：第一次运行 `~/.claude/skills/tutorial-b-roll/scripts/setup.sh`（建独立虚拟环境并下载模型，脚本之后自动使用）。文字配音用 macOS 自带 `say`。

```bash
R=~/.claude/skills/tutorial-b-roll/scripts
```

## 工作流程

> 用户给的是**音频 / 带口播的视频要整段配画面 / 文字稿**：按 `references/audio-text.md` 做（转时间轴 → 故事板给用户确认 → 素材 → `story.html` → `render.js x.html ALL --audio a.m4a`）。下面 1–9 步是给原视频某一段做 B-Roll 的流程。

### 1. 确认段落和做法
- 问清楚：哪个视频、哪一段（时间或口播内容）、想要遮盖式 / 增强式 / 透明元素。
- 用户没指定时，按 `references/modes.md` 的选择表推荐；拿不准就**同一段做 A（遮盖）+ B（增强）两版**让用户挑。
- 找字幕 SRT（通常与视频同名或在 `字幕/` 下），读这一段口播，定下画面要表达的 2–5 个要点。

### 2. 取节拍（对齐口播）
```bash
python3 $R/word_times.py 原视频.mp4 22 30          # 打印 22–30 秒每个字的绝对时间
```
挑出关键词的时间作为节拍（卡片亮起、框出现、数字跳动），写进 JS 注释：`// 「快速」24.36`。

### 3. 截参考帧、量坐标
```bash
$R/grab_frames.sh 原视频.mp4 ref 13 21 26.5        # ref/frame_13.png …
```
- 遮盖式：首尾两帧用来做交叉淡化参考（模板里 `.edge-in/.edge-out` 的 `data-src`）。
- 增强式：在参考帧上量出要标注的区域（x, y, w, h，1920×1080 坐标），写进场景注释「坐标量自 0:26 画面」；确认这段时间录屏没有滚动/平移（多截几帧比对）。

### 4. 准备素材
- 真实软件图标：`$R/app_icon.sh "Microsoft Excel" assets_<编号>/excel.png`
- 插画/场景图：走 Canva（`references/canva.md`），**先问品牌套件、新建设计和提交修改前要用户同意**；配图要白底，底色偏黄要换白。
- 所有素材放 HTML 同目录的 `assets_<编号>/`，用相对路径引用。

### 5. 写 HTML
- 复制模板：`cp ~/.claude/skills/tutorial-b-roll/templates/broll.html <课号>_B-Roll.html`，删掉不用的示例场景，按模板里的写法改。
- 约定：`window.BROLL.scenes[ID] = {kind, from, to, poster?, focus?, zoom?}`；渲染函数 `R[ID](t, el)` 是 t 的纯函数，不用 CSS 动画。
- 一个 HTML 可放同一集的多个场景。
- 浏览器检查：`open "<课号>_B-Roll.html?scene=B&t=26&guides"`（`&play` 循环播放，`&alpha` 看透明效果）。
- 牢记：开场第一秒就要有内容；画面信息丰富；内容不进下方 200px 字幕区；标题不加眉题。

### 6. 静帧检查（必做）
```bash
node $R/render.js <课号>_B-Roll.html B --mode stills --src 原视频.mp4 --at 24.3,25.5,26.6,27.6
```
看生成的 `_联系表.png`：节拍是否对上、坐标是否准、有没有遮住正在讲的东西、字幕区是否干净、首尾是否能接回原画面。有问题改 HTML 再出静帧。

### 7. 渲染
```bash
node $R/render.js <课号>_B-Roll.html A --src 原视频.mp4                 # 遮盖式 MP4（首尾淡入淡出到真实画面）
node $R/render.js <课号>_B-Roll.html B --src 原视频.mp4 --preview       # 增强式 MP4 + 带原声预览
node $R/render.js <课号>_B-Roll.html T --codec prores                   # 透明元素
```
导出格式与参数见 `references/modes.md`。

### 8. 带声音预览
`--preview` 或 `$R/preview.sh 原视频.mp4 片段.mp4 入点 出点 _预览/xxx_预览.mp4`：叠回原视频、前后各留 1 秒、带原声，用来确认和口播同步。整条合成用 `$R/compose.sh`。

### 9. 命名、交付、记录
- 默认命名：`课程前缀_编号_课名_BRoll序号_内容_入点-出点.mp4`，版本后缀 `品牌画面版` / `录屏叠加版` / `透明叠加`；预览放 `_预览/`。
- 有 `B-Roll清单.md` 的项目：追加这一条，时间码写 `HH:MM:SS:FF`（按原视频帧率）。
- 回复用户：给出文件路径、入出点、做法说明；如果做了 A/B 两版，说明区别让用户选。

## 速查

| 任务 | 命令 |
|---|---|
| 字级时间 | `python3 $R/word_times.py v.mp4 from to [--json]` |
| 音频 → 时间轴 | `python3 $R/transcribe.py a.m4a [--from 0 --to 60] [--srt]` |
| 文字 → 配音 + 时间轴 | `python3 $R/text_timeline.py 文稿.txt [--voice Tingting]` |
| 整段连续画面（带声音） | `node $R/render.js x.html ALL --audio a.m4a` |
| 截参考帧 | `$R/grab_frames.sh v.mp4 outdir t1 t2 …` |
| 软件图标 | `$R/app_icon.sh "App 名" out.png [512]` |
| 静帧 + 联系表 | `node $R/render.js x.html S --mode stills [--src v.mp4] --at t1,t2` |
| 遮盖式 | `node $R/render.js x.html S [--src v.mp4]` |
| 增强式 | `node $R/render.js x.html S --src v.mp4` |
| 透明 | `node $R/render.js x.html S --mode alpha --codec png\|prores\|webm\|pngseq` |
| 4K | 加 `--scale 2` |
| 预览 | 加 `--preview`，或 `$R/preview.sh v.mp4 clip t0 t1 out.mp4` |
| 合回整片 | `$R/compose.sh v.mp4 out.mp4 clip1 t0 [clip2 t0 …]` |
