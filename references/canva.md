# 用 Canva 生成画面素材

B-Roll 的版式、文字、动效都用 HTML 做（可控、可逐帧对齐口播）。Canva 用来补 **HTML 画不好的素材**：插画、场景图、人物、背景纹理、图标组、海报式封面、信息图里的插图。生成后导出 PNG，当作 `<img>` 放进 HTML 里再加动效。

## 什么时候用

- 画面需要插画 / 场景感（「想象一个忙碌的周一早上」「AI 助理像一个同事」）。
- 需要一组风格统一的小插图（例如 4 个角色头像、5 个行业图标）。
- 用户直接说「用 Canva 做」「去 Canva 生成一张」。
- 不用于：文字为主的卡片、流程图、数据图——这些 HTML 更准、更好改。

## 流程（Canva MCP 工具，前缀 `cc-…-`）

1. **问品牌套件**：调用 `generate-design` 之前必须先问用户要不要用品牌套件（`list-brand-kits` 列出来让用户选，或不用）。
2. **写提示词**：说明用途和风格，固定加上：
   「扁平矢量插画，LinkedIn Learning 课程风格，主色 #0A66C2 品牌蓝，辅色 #70B5F9、#E7A33E 少量点缀，**纯白或米白纯色背景（solid plain white / off-white），绝对不要渐变、暗角、纹理底**，干净留白，主体居中，无文字」。
   画面里**不要让 Canva 写中文字**（容易错字），文字统一在 HTML 里加。
3. **生成候选**：`generate-design`（16:9 用 `desktop_wallpaper`，竖图用 `poster`，方图用 `instagram_post`）。候选缩略图链接需要登录 Canva 才能看（curl 拿到的是网页），可以把候选的 `url` 发给用户挑；用户说「你定」就选第一个，导出后自己看图把关，不合适再换下一个。
4. **落成设计**：用户选定后 `create-design-from-candidate`（这会在用户的 Canva 账号里新建一个设计，属于用户可见的改动，先确认）。
5. **需要微调**时：`start-editing-transaction` → `perform-editing-operations` → 给用户看缩略图 → **用户同意后**才 `commit-editing-transaction`；不满意就 `cancel-editing-transaction`。
6. **导出**：先 `get-export-formats` 看支持什么，再 `export-design`：
   - `format: png`，`export_quality: "pro"`，`width` 设为放进画面的 2 倍像素（清晰），
   - 需要抠图效果时 `transparent_background: true`（需要 Canva 高级版，不支持就导出白底，在 HTML 里放到白卡片上用）。
7. **下载到工程目录**：`curl -L -o assets_<编号>/canva_<内容>.png "<导出链接>"`（链接有时效，拿到就下）。
8. **检查底色**：生成图的底色常常偏黄（例如 #F8EDD4）。取色 `ffmpeg -v error -i x.png -vf crop=1:1:50:50,format=rgb24 -f rawvideo - | xxd -p`，偏色就换成白底：
   ```bash
   ffmpeg -f lavfi -i color=c=white:s=<宽>x<高> -i x.png -filter_complex "[1]format=rgba,colorkey=0x<底色>:0.07:0.08[k];[0][k]overlay=format=auto,format=rgb24" -frames:v 1 x_白底.png
   ```
   需要时先 `crop` 裁掉多余留白，让主体占满卡片。
9. 在 HTML 里使用：`broll.html` 用 `<img src="assets_<编号>/canva_xxx.png">`；`story.html` 用 `image` 场景 `img:'assets/canva_xxx.png'`（`side:'left'|'right'` 放白卡片里，`'full'` 铺满）。文件头注释记一笔「插画来自 Canva，设计 ID ……」，方便以后回去改。

## 其它可用的 Canva 能力

- `search-designs`：用户说「用我 Canva 里那张……」时，先搜用户已有的设计再导出。
- `import-design-from-url` / `upload-asset-from-url`：只接受公网 HTTPS 地址。**不要把本地文件或课程截图传到公网图床再上传**，那是把用户内容外泄。
- `resize-design`：同一张插画要做成 16:9 封面和 1:1 社媒图时用。
- `get-design-thumbnail`：生成/修改后给用户看效果。

## 注意

- Canva 素材风格要和规范一致：扁平、品牌蓝、留白、纯白/米白纯色底；拒绝渐变背景、写实照片风、3D 渲染风、霓虹风，除非用户要。
- 一个 B-Roll 里 Canva 插画不超过 1–2 张主图，其余还是 HTML 卡片，避免画面变成海报。
- 用户账号里新建设计、提交修改都要先得到用户同意（用户已经说过「需要图片就找 Canva 生成」的，算同意新建；修改已有设计仍要单独确认）。
