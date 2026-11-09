#!/usr/bin/env node
// 领英学习风格 B-Roll 渲染器：无头 Chrome 逐帧调用 window.renderAt(秒) 截图，交给 ffmpeg 编码。
//
// 用法：node render.js <html> <scene> [选项]
//   --mode cover|enhance|alpha|stills   不写则按场景 kind 推断（cover→cover，overlay/zoom→enhance，alpha→alpha）
//   --from 秒 --to 秒                  原视频绝对时间；不写则读 BROLL.scenes[scene].from/to
//   --src 原视频                        enhance 必填；cover 给了它就与真实画面交叉淡化；stills 给了它就合成到原画面上
//   --out 文件                          不写则放在 html 同目录：<html名>_<scene>_<入点>-<出点>.<ext>
//   --codec png|prores|webm|pngseq      alpha 的编码，默认 png（.mov，PNG 编码，剪辑软件通用、透明区域体积小）
//   --at 秒,秒,...                      stills 的时间点；输出 PNG 和一张联系表
//   --fps 30                            给了 --src 时默认跟原视频一致（如 30000/1001），否则 30
//   --scale 1                           2 = 用同一套 1920×1080 布局渲染 3840×2160
//   --crf 16                            H.264 质量
//   --preview                           另出一份「叠在原视频上、带原声、前后各留 1 秒」的预览，只用来检查同步
//   --audio 音频                        把这个音频的 [from, to] 一段混进输出（根据音频/配音做的 B-Roll 用；时间与音频对齐）
//
// HTML 约定（见 templates/broll.html）：?scene=ID 打开；window.renderAt(t) 是 t 的纯函数；
// window.BROLL.scenes[ID] = {kind:'cover'|'overlay'|'zoom'|'alpha', from, to}；zoom 场景用 BROLL.setSource(url) 接收原视频帧。
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn, execFileSync, execSync } = require('child_process');

function loadPlaywright() {
  try { return require('playwright-core'); } catch {}
  const dir = path.join(os.homedir(), '.cache', 'tutorial-b-roll');
  const mod = path.join(dir, 'node_modules', 'playwright-core');
  if (!fs.existsSync(mod)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`首次运行：安装 playwright-core 到 ${dir}`);
    execSync(`npm i --silent --no-audit --no-fund --prefix "${dir}" playwright-core`, { stdio: 'inherit' });
  }
  return require(mod);
}

function findChrome() {
  const c = [process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  const hit = c.find(p => fs.existsSync(p));
  if (!hit) throw new Error('找不到 Chrome/Chromium/Edge，请安装 Google Chrome 或用环境变量 CHROME 指定路径');
  return hit;
}

function parseArgs(argv) {
  const pos = [], o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) o[k] = true; else { o[k] = v; i++; } }
    else pos.push(a);
  }
  return { pos, o };
}

const probeRate = src => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', src]).toString().trim();
const rateNum = r => { const [n, d] = String(r).split('/').map(Number); return d ? n / d : n; };
const mmss = t => { const s = Math.floor(t); return String(Math.floor(s / 60)).padStart(2, '0') + String(s % 60).padStart(2, '0'); };
const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
const H264 = crf => ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', ...BT709, '-movflags', '+faststart'];
const TO709 = 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p';

const exited = p => new Promise((res, rej) => p.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg 退出码 ' + c))));

// rawRate：叠加到原视频时用。Chrome 遇到整帧不透明会输出 RGB 而不是 RGBA 的 PNG，像素格式中途变化会让
// 双输入的 overlay 滤镜重建、丢帧。所以先用一个 ffmpeg 把 PNG 统一解成固定的 rgba 原始帧，再交给主 ffmpeg。
function ffmpeg(args, rawRate) {
  const lvl = process.env.BROLL_FFLOG || 'error';
  const main = spawn('ffmpeg', ['-y', '-v', lvl, ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  let head = main, norm = null;
  if (rawRate) {
    norm = spawn('ffmpeg', ['-v', lvl, '-f', 'image2pipe', '-framerate', rawRate, '-c:v', 'png', '-i', '-', '-vf', 'format=rgba', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { stdio: ['pipe', 'pipe', 'inherit'] });
    norm.stdout.pipe(main.stdin); head = norm;
  }
  let failed = null;
  head.stdin.on('error', e => { failed = e; });
  main.stdin.on('error', e => { failed = e; });
  const done = Promise.all([exited(main), norm && exited(norm)]);
  return {
    async write(buf) { if (failed) throw failed; if (!head.stdin.write(buf)) await new Promise(r => head.stdin.once('drain', r)); },
    async end() { head.stdin.end(); await done; },
  };
}

(async () => {
  const { pos, o } = parseArgs(process.argv.slice(2));
  const [htmlArg, scene] = pos;
  if (!htmlArg || !scene) { console.error(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 18).join('\n')); process.exit(1); }
  const html = path.resolve(htmlArg);
  const src = o.src ? path.resolve(o.src) : null;
  const scale = +(o.scale || 1);
  const rate = o.fps ? String(o.fps) : (src ? probeRate(src) : '30');
  const FPS = rateNum(rate);

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: findChrome(), args: ['--force-color-profile=srgb', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale });
  page.on('pageerror', e => console.error('页面报错：', e.message));
  await page.addInitScript(() => { window.__RENDER__ = true; });
  await page.goto('file://' + html + '?scene=' + encodeURIComponent(scene));
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  const meta = await page.evaluate(s => (window.BROLL && window.BROLL.scenes && window.BROLL.scenes[s]) || null, scene) || {};
  const kind = meta.kind || 'cover';
  const usesSource = kind === 'zoom' || meta.source === true;
  const mode = o.mode || ({ cover: 'cover', overlay: 'enhance', zoom: 'enhance', alpha: 'alpha' }[kind] || 'cover');
  const from = o.from !== undefined ? +o.from : meta.from, to = o.to !== undefined ? +o.to : meta.to;
  if (mode !== 'stills' && (from === undefined || to === undefined)) throw new Error('缺少 --from/--to，场景元数据里也没有 from/to');
  if (mode === 'enhance' && !src) throw new Error('enhance 需要 --src 原视频');
  if (usesSource && !src) throw new Error(`场景 ${scene} 依赖原视频帧（zoom），需要 --src`);
  if (usesSource && mode === 'alpha') throw new Error(`场景 ${scene} 依赖原视频帧，不能导出透明版本；用 --mode enhance`);
  const W = 1920 * scale, H = 1080 * scale;

  const setFlags = (alpha, fadeToSource) => page.evaluate(([a, f]) => {
    document.documentElement.classList.toggle('alpha', a);
    if (window.BROLL) window.BROLL.fadeToSource = f;
  }, [alpha, fadeToSource]);
  const renderAt = t => page.evaluate(t => window.renderAt(t), t);
  const shot = transparent => page.screenshot({ type: 'png', omitBackground: transparent });

  // zoom 场景：先把这一段原视频解成 JPG（高质量），逐帧喂给页面
  let tmp = null;
  const extractSource = (t0, n) => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-src-'));
    execFileSync('ffmpeg', ['-v', 'error', '-ss', t0.toFixed(4), '-i', src, '-frames:v', String(n), '-vf', `fps=${rate}`, '-q:v', '2', path.join(tmp, '%06d.jpg')]);
    return k => 'file://' + path.join(tmp, String(k + 1).padStart(6, '0') + '.jpg');
  };
  const setSource = url => page.evaluate(u => window.BROLL.setSource(u), url);

  const ext = mode === 'alpha' ? ({ png: '.mov', prores: '.mov', webm: '.webm', pngseq: '' }[o.codec || 'png']) : '.mp4';
  const base = path.join(path.dirname(html), `${path.basename(html, '.html')}_${scene}`);
  const out = o.out ? path.resolve(o.out) : (mode === 'stills' ? base + '_stills' : `${base}_${mmss(from)}-${mmss(to)}${ext}`);

  // ---------------- 静帧 ----------------
  if (mode === 'stills') {
    const list = String(o.at || '').split(',').filter(Boolean).map(Number);
    if (!list.length) throw new Error('stills 需要 --at 秒,秒,...');
    fs.mkdirSync(out, { recursive: true });
    const overlay = src && !usesSource && kind !== 'cover';
    await setFlags(overlay || (!src && kind !== 'cover'), false);
    const files = [];
    for (const t of list) {
      const f = path.join(out, `${scene}_${t.toFixed(2)}.png`);
      if (usesSource) { const u = extractSource(t, 1); await setSource(u(0)); }
      await renderAt(t);
      const buf = await shot(overlay || (!src && kind !== 'cover'));
      if (overlay) {
        const ov = path.join(out, '_ov.png'); fs.writeFileSync(ov, buf);
        execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', src, '-i', ov,
          '-filter_complex', `[0:v]scale=${W}:${H}[bg];[bg][1:v]overlay=0:0`, '-frames:v', '1', f]);
        fs.unlinkSync(ov);
      } else fs.writeFileSync(f, buf);
      if (tmp) { fs.rmSync(tmp, { recursive: true, force: true }); tmp = null; }
      files.push(f);
    }
    if (files.length > 1) {
      // 联系表：用 Chrome 排版（透明静帧垫棋盘格，左上角标时间，橙色虚线 = 字幕区）
      const cols = Math.min(3, files.length), rows = Math.ceil(files.length / cols);
      const cells = files.map((f, k) => `<figure><img src="file://${f}"><i></i><b>${scene} · ${list[k].toFixed(2)}s</b></figure>`).join('');
      const sheet = path.join(out, '_sheet.html');
      fs.writeFileSync(sheet, `<meta charset="utf-8"><style>body{margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},640px);gap:8px;padding:8px;width:max-content;font:600 22px "PingFang SC",sans-serif}
figure{margin:0;position:relative;width:640px;height:360px;background:repeating-conic-gradient(#ccc 0 25%,#fff 0 50%) 0 0/24px 24px}
img{width:640px;height:360px;display:block}i{position:absolute;left:0;right:0;top:${(880 / 1080 * 360).toFixed(1)}px;border-top:2px dashed #E7A33E}
b{position:absolute;left:10px;top:8px;color:#fff;background:rgba(0,0,0,.65);padding:3px 10px;border-radius:6px}</style>${cells}`);
      const sp = await browser.newPage({ viewport: { width: cols * 648 + 8, height: rows * 368 + 8 } });
      await sp.goto('file://' + sheet);
      await sp.evaluate(async () => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
      await sp.screenshot({ path: path.join(out, '_联系表.png') });
      fs.unlinkSync(sheet);
    }
    console.log(`done ${out}（${files.length} 张）`);
    await browser.close(); return;
  }

  // ---------------- 视频 ----------------
  const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS), N = f1 - f0;
  const t0 = f0 / FPS, dur = N / FPS;
  const srcIn = src ? ['-ss', t0.toFixed(4), '-t', dur.toFixed(4), '-i', src] : [];
  const pipeIn = ['-f', 'image2pipe', '-framerate', rate, '-c:v', 'png', '-i', '-'];
  const rawIn = ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', rate, '-i', '-'];
  let enc, transparent = false, srcUrl = null;

  if (mode === 'cover' && !usesSource) {
    if (src) { // 交叉淡化到真实画面：页面透明处露出原视频
      await setFlags(false, true); transparent = true;
      enc = ffmpeg([...srcIn, ...rawIn, '-filter_complex',
        `[0:v]fps=${rate},scale=${W}:${H},setpts=PTS-STARTPTS[bg];[1:v]setpts=PTS-STARTPTS[ov];[bg][ov]overlay=0:0:shortest=1,${TO709}`,
        '-an', '-frames:v', String(N), ...H264(o.crf || 16), '-r', rate, out], rate);
    } else {
      await setFlags(false, false);
      enc = ffmpeg([...pipeIn, '-vf', TO709, ...H264(o.crf || 16), '-tune', 'animation', '-r', rate, out]);
    }
  } else if ((mode === 'enhance' || mode === 'cover') && usesSource) {
    await setFlags(false, false); srcUrl = extractSource(t0, N);
    enc = ffmpeg([...pipeIn, '-vf', TO709, ...H264(o.crf || 16), '-r', rate, out]);
  } else if (mode === 'enhance') {
    await setFlags(true, false); transparent = true;
    enc = ffmpeg([...srcIn, ...rawIn, '-filter_complex',
      `[0:v]fps=${rate},scale=${W}:${H},setpts=PTS-STARTPTS[bg];[1:v]setpts=PTS-STARTPTS[ov];[bg][ov]overlay=0:0:shortest=1,${TO709}`,
      '-an', '-frames:v', String(N), ...H264(o.crf || 16), '-r', rate, out], rate);
  } else if (mode === 'alpha') {
    await setFlags(true, false); transparent = true;
    const codec = o.codec || 'png';
    if (codec === 'pngseq') { fs.mkdirSync(out, { recursive: true }); let k = 0; enc = { write: async b => fs.writeFileSync(path.join(out, `frame_${String(k++).padStart(5, '0')}.png`), b), end: async () => {} }; }
    else if (codec === 'png') enc = ffmpeg([...pipeIn, '-c:v', 'png', '-pix_fmt', 'rgba', '-r', rate, out]);
    else if (codec === 'prores') enc = ffmpeg([...pipeIn, '-vf', 'scale=out_color_matrix=bt709', '-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0', ...BT709, '-r', rate, out]);
    else if (codec === 'webm') enc = ffmpeg([...pipeIn, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-crf', '18', '-b:v', '0', '-row-mt', '1', '-auto-alt-ref', '0', '-r', rate, out]);
    else throw new Error('未知 --codec ' + codec);
  } else throw new Error('未知 --mode ' + mode);

  const tStart = Date.now();
  for (let f = f0; f < f1; f++) {
    if (srcUrl) await setSource(srcUrl(f - f0));
    await renderAt(f / FPS);
    await enc.write(await shot(transparent));
    if ((f - f0) % 150 === 0) process.stdout.write(`${scene} ${f - f0}/${N}  ${((f - f0) / ((Date.now() - tStart) / 1000 || 1)).toFixed(1)} 帧/秒\n`);
  }
  await enc.end();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  await browser.close();
  if (o.audio && !(mode === 'alpha' && (o.codec || 'png') === 'pngseq')) {
    const tmpOut = out.replace(/(\.\w+)$/, '.__a$1');
    const ac = ext === '.webm' ? ['-c:a', 'libopus', '-b:a', '160k'] : ['-c:a', 'aac', '-b:a', '192k'];
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', out, '-ss', t0.toFixed(4), '-i', path.resolve(o.audio), '-map', '0:v', '-map', '1:a',
      '-c:v', 'copy', ...ac, '-af', 'apad', '-t', dur.toFixed(4), ...(ext === '.mp4' ? ['-movflags', '+faststart'] : []), tmpOut]);
    fs.renameSync(tmpOut, out);
  }
  console.log(`done ${out}（${N} 帧${o.audio ? '，含音频' : ''}，${t0.toFixed(3)}s → ${(f1 / FPS).toFixed(3)}s，${rate} fps，${W}×${H}）`);

  if (o.preview) {
    if (!src) { console.log('跳过预览：没有 --src'); return; }
    const pv = out.replace(/(\.\w+)?$/, '_预览.mp4');
    execFileSync(path.join(__dirname, 'preview.sh'), [src, out, String(t0), String(f1 / FPS), pv], { stdio: 'inherit' });
  }
})().catch(e => { console.error('✗', e.message); process.exit(1); });
