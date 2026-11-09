# 根据音频 / 文字直接做 B-Roll

没有录屏、只有一段**口播音频**（或带声音的视频），或者只有一份**文字稿**时，用这条流程一口气做出整段 B-Roll：
**输入 → 时间轴 → 故事板 → 素材（软件图标 / Canva 配图）→ `templates/story.html` → 渲染（带声音）**。

和 `broll.html` 的区别：`broll.html` 是给原视频某一段做遮盖/增强，每个场景手写动画；`story.html` 是**数据驱动**的连续画面，只填 `window.STORY`（选场景类型 + 填文字 + 填时间），不写动画代码，可以覆盖整段音频。

## 1. 得到时间轴

```bash
R=~/.claude/skills/tutorial-b-roll/scripts
$R/setup.sh                                   # 第一次用：装 faster-whisper 虚拟环境（之后自动使用）
```

**有音频 / 视频**（m4a、mp3、wav、mp4、mov 都行）：
```bash
python3 $R/transcribe.py 口播.m4a [--from 0 --to 60] [--srt]
# → 口播_timeline.json；终端打印每句起止时间，以及每个字的时间「字@秒」
```
- 默认 large-v3 模型，CPU 上大约 1 倍实时（1 分钟音频约 1 分钟）。急用可 `--model small`。
- **校对专有名词**：Whisper 常把英文产品名听错（例：Auto → ALT）。故事板里写正确的字，时间照用。

**只有文字稿**（txt / md，或 `-` 从标准输入读）：
```bash
python3 $R/text_timeline.py 文稿.txt --voice Tingting      # 用 macOS 中文语音生成配音 + 时间轴
python3 $R/text_timeline.py 文稿.txt                       # 不配音：按语速估算时间（默认 4.2 字/秒）
```
- `--voice` 生成 `文稿_配音.m4a`（句间停顿 `--pause .35`，开头留白 `--lead .5`，语速 `--rate`）；中文声音：Tingting（女）、Eddy / Reed / Rocko（男）、Flo、Sandy、Shelley、Grandma、Grandpa。
- 句内每个字的时间是按字数比例估算的；需要逐字精确对齐时，对配音再跑一次 `transcribe.py 文稿_配音.m4a`。
- 用户之后会用自己的声音或专业配音重录：先用估算时间轴做画面，录好后对新音频跑 `transcribe.py`，把 `from/to/at` 按新时间更新即可。

两种时间轴 JSON 结构相同：`{source, audio, segments:[{i,start,end,text,words:[{w,s,e}]}]}`，时间都是音频里的绝对秒。

## 2. 写故事板（先给用户确认）

按句子/意群切场景，列一张表给用户看，确认后再做：

| 场景 | 时间 | 口播 | 类型 | 画面内容 | 素材 |
|---|---|---|---|---|---|
| S1 | 0–2.5 | 这节课我们来讲 WorkBuddy 的模型 | title | 标题 + logo | WorkBuddy 图标 |
| S2 | 2.5–6.0 | 点击输入框里的模型选择器 | image | 截图 + 两条要点 | 截图 |
| … | | | | | |

**怎么选类型**：

| 口播里出现 | 用 |
|---|---|
| 开场「这节课讲……」 | `title` |
| 并列的 2–4 个东西（三档、三种角色） | `points`（cards） |
| 5–6 条清单、「比如 A、B、C」 | `points`（`layout:'list'`） |
| 「第一步…然后…最后」、流程 | `steps` |
| 数字、倍率、百分比、时长 | `stat` |
| 过去/现在、以前/改版后、不是…而是… | `compare` |
| 一句结论、金句、需要停顿强调 | `statement`（带关键词胶囊）或 `quote`（带划重点） |
| 点名具体软件（Excel、Word、微信） | `apps`（中心 + 环绕 / 一排），用真实图标 |
| 场景、比喻、情绪（「把时间留给…」） | `image`，配图找 Canva 生成 |
| 讲到软件界面的某处 | `image`，用截图（`grab_frames.sh` 截原视频） |

**节奏**：一个场景 3–8 秒、只讲一件事；画面写关键词不写整句；相邻场景尽量换类型；场景首尾相接不留空（上一个 `to` = 下一个 `from`，句间停顿归到前一个场景）。

## 3. 准备素材

- 软件图标：`$R/app_icon.sh "Microsoft Excel" assets/excel.png 256`
- 截图：`$R/grab_frames.sh 原视频.mp4 assets 4.5`，必要时 `ffmpeg -i in.png -vf crop=w:h:x:y out.png` 裁出要讲的部分。
- 插图：用 Canva 生成（`references/canva.md`）。纯白/米白底、无渐变、无文字；导出 PNG 放 `assets/`，文件头注释写设计 ID。
- 全部用相对路径 `assets/xxx.png`，HTML 和 `assets/` 放同一目录。

## 4. 填 story.html

```bash
cp ~/.claude/skills/tutorial-b-roll/templates/story.html <名字>_B-Roll.html
```
只改 `window.STORY.scenes`。每个场景上面写一行注释：口播原文 + 关键字时间「输入框@3.94」，方便以后对。

**时间规则**：
- `from/to`：场景起止（音频绝对秒）。
- 要点 / 列表：条目在场景开头自动依次出现，`at` = 说到它时**高亮 / 打勾**。
- 步骤、数字、对比、胶囊、图片要点、软件图标：`at` = **出现**时刻。
- 场景开头 0.5 秒内必须有东西（标题会自动先出来）；不要为了对齐某个字让画面空等好几秒。

**字段速查**（`title` 字段可用 `<em>` 标蓝，`<br>` 换行）：

| type | 字段 |
|---|---|
| 所有 | `id` `type` `from` `to`；可选 `title`（顶部标题）、`note:{text,icon,tone:'amber'\|'green'\|'blue',at}`（底部提示胶囊） |
| title | `title` `sub` `img`（logo 图）或 `icon`；`at:{icon,title,sub,bar}` |
| points | `items:[{text,desc,icon\|img,at,show}]`；`layout:'cards'`（默认，2–4 个）\|`'list'`；`check:true` 列表打勾 |
| steps | `items:[{text,desc,icon,at}]`（2–5 步） |
| stat | `items:[{value,dec,prefix,suffix,label,desc,tone:'gray'\|'amber'\|'green',at}]`（1–3 个；`value` 是数字就从 0 数上去） |
| compare | `left:{label,icon,items:[{text}],at}` `right:{…}`；左边灰色 ✕，右边蓝框绿 ✓；`leftMark:'dot'` 改左侧符号 |
| statement | `text` `at` `chips:[{text,icon,tone,at}]` |
| quote | `text`（`<em>` 处划荧光笔）`by` `at` `hl:[秒,…]` |
| image | `img` `side:'left'\|'right'\|'full'` `title` `sub` `items:[{text,icon\|img,at}]` `fit:'contain'` `box:[x,y,w,h]` |
| apps | `items:[{img,label,at}]`；`hub:{img\|icon,label,at}` 有中心时环绕排布并连虚线 |

图标名（`icon`）：bolt bal gem chk x dot spark info arr cpu file clock user users chat folder table warn up target bulb mail cal play lock link。

## 5. 检查与渲染

```bash
open "<名字>_B-Roll.html?t=12&guides"           # 浏览器看某一刻；&play 播放；&scene=S3 只看一个场景
node $R/render.js <名字>_B-Roll.html ALL --mode stills --at 1.8,5.6,11,22    # 静帧 + 联系表（每个场景挑一刻）
node $R/render.js <名字>_B-Roll.html ALL --audio 口播.m4a                    # 整段 MP4，带声音
```
- 静帧必看：文字有没有溢出、内容有没有进下方 200px 字幕区、每个场景开头是否空屏。
- 成片抽查转场：`ffmpeg -i out.mp4 -vf "select='eq(n,183)+eq(n,370)',scale=640:-1,tile=2x1" -frames:v 1 x.png`。
- 只要一个场景：`node $R/render.js x.html S3 [--audio a.m4a]`（场景 ID 就是 STORY 里的 id）。
- 无背景版（叠到别的画面上）：`node $R/render.js x.html ALL --mode alpha --codec prores`（背景和点阵会隐藏，卡片阴影自动加重）。
- 要插回原视频的某一段：`node $R/render.js x.html S3 --src 原视频.mp4`（首尾淡到真实画面），再用 `compose.sh` 合回去。

## 6. 交付

给用户：成片路径（含声音）、联系表、故事板表；说明哪些素材来自 Canva（设计 ID）、哪些是截图/图标；提醒校对过的专有名词。
