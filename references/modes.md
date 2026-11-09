# 三种做法、五种导出

## 先选做法

| 做法 | 场景 kind | 适合 | 不适合 |
|---|---|---|---|
| **遮盖式** | `cover` | 讲概念、对比、流程、数字；原画面只是讲师或静止界面，没什么可看 | 观众必须看清原画面里的操作 |
| **增强式 · 叠加** | `overlay` | 原画面有关键操作或数据，要告诉观众「看这里」：压暗聚光、框选、编号、箭头、说明卡 | 原画面在快速滚动、平移，坐标跟不住 |
| **增强式 · 推镜头** | `zoom` | 界面字太小，需要放大某个区域并标注；原画面在这段时间基本不动 | 原画面在大幅移动 |
| **透明元素** | `alpha` | 开场标题卡、侧边要点、角标；给剪辑师在 Premiere / 剪映 / Final Cut 里自己叠 | 需要完整背景的画面 |

拿不准时，同一段做两版让用户挑：**A 品牌画面版（遮盖）+ B 录屏叠加版（增强）**，这是以往的惯例。

## 渲染命令

```bash
R=~/.claude/skills/tutorial-b-roll/scripts
SRC=原视频.mp4

# 遮盖式：有 --src 时首尾与真实画面交叉淡化（推荐）；不给则输出纯 B-Roll 画面
node $R/render.js B-Roll.html A --src "$SRC"

# 增强式（叠加 / 推镜头）：必须给原视频，输出已经合成好的 MP4
node $R/render.js B-Roll.html B --src "$SRC" --preview
node $R/render.js B-Roll.html Z --src "$SRC"

# 透明导出（无背景）
node $R/render.js B-Roll.html T                       # .mov，PNG 编码 RGBA（默认，最通用）
node $R/render.js B-Roll.html T --codec prores        # .mov，ProRes 4444 带 alpha（Final Cut / Premiere 最顺，但体积大）
node $R/render.js B-Roll.html T --codec webm          # .webm，VP9 带 alpha（网页、剪映可用，体积最小）
node $R/render.js B-Roll.html T --codec pngseq        # PNG 序列（AE / 达芬奇 最稳）
# 叠加类场景（B）也能导出透明版：--mode alpha，压暗层会一起保留

# 静帧检查（交付前必做）：合成到原画面上，并生成一张联系表
node $R/render.js B-Roll.html B --mode stills --src "$SRC" --at 24.3,25.5,26.6,27.6
```

常用参数：`--from/--to` 临时只渲染一段（首尾淡化仍按 HTML 里的 from/to）；`--out` 指定文件名；`--scale 2` 出 4K；`--fps` 覆盖帧率（默认跟原视频一致，例如 30 或 30000/1001）；`--crf` 改 H.264 质量（默认 16）。

## 每种导出是什么

| 输出 | 编码 | 说明 |
|---|---|---|
| 遮盖式 MP4 | H.264 yuv420p，BT.709，CRF 16，faststart | 直接替换原视频这一段画面，没有声音 |
| 增强式 MP4 | 同上 | 已经把标注叠在原画面上，直接替换这一段 |
| 透明 .mov（png） | PNG RGBA | 透明区域压缩得很好，体积小；所有主流剪辑软件都能读 |
| 透明 .mov（prores） | ProRes 4444，yuva444p10le，16 位 alpha | 剪辑软件里最顺滑，1080p 约 300 Mb/s |
| 透明 .webm | VP9 yuva420p | 体积最小；用 ffmpeg 读时要加 `-c:v libvpx-vp9` 才能拿到 alpha |
| PNG 序列 | 每帧一张 RGBA PNG | 最稳，任何软件都能导入 |
| `_预览.mp4` | 叠回原视频、带原声、前后各 1 秒 | **只用来检查和口播是否同步，不交付** |

## 合回整条视频

```bash
# 片段可以是遮盖/增强的 mp4，也可以是透明 mov/webm；数字是入点（秒）
$R/compose.sh 原视频.mp4 合成版.mp4 A.mp4 13.0 B.mp4 24.0 T.mov 0
```

保留原声（直接拷贝）、帧率跟原视频一致、CRF 17 重新编码视频。

## 帧对齐

渲染器按原视频帧率取帧：`f0 = round(from × fps)`，`f1 = round(to × fps)`，第 f 帧画 `renderAt(f / fps)`。所以入出点会落在原视频的整帧上，清单里写时间码时用 `HH:MM:SS:FF`（FF = 帧）。

## 已知坑

- Chrome 整帧不透明时会输出 RGB（不是 RGBA）PNG；渲染器已经在叠加路径上先统一成 rgba 原始帧，不会再丢帧。自己写 ffmpeg 命令叠 PNG 管道时要注意。
- 推镜头（zoom）依赖原视频帧，不能导出透明版本。
- 模板里不要用 `#A_f0` 这类 id 命名首尾参考帧，以前和元素 id 撞过；模板现在用 `.edge-in/.edge-out` 类名。
- HTML 里引用的图片要用相对路径，并放在 HTML 同目录的 `assets_<编号>/` 下；渲染器会等所有图片解码完才开始截图。
