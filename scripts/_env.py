"""共用：加载 faster-whisper。没装时自动切到 ~/.cache/tutorial-b-roll/venv（由 setup.sh 创建）。"""
import os, sys

VENV = os.path.expanduser('~/.cache/tutorial-b-roll/venv')
HUB = os.path.expanduser('~/.cache/huggingface/hub')


def whisper_model(name='large-v3'):
    # 模型已缓存时离线加载，避免每次联网检查（代理/证书环境下联网检查会报错）
    if os.path.isdir(os.path.join(HUB, f'models--Systran--faster-whisper-{name}')):
        os.environ.setdefault('HF_HUB_OFFLINE', '1')
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        py = os.path.join(VENV, 'bin', 'python')
        if os.path.exists(py) and os.path.realpath(sys.prefix) != os.path.realpath(VENV):
            os.execv(py, [py] + sys.argv)
        sys.exit('缺少 faster-whisper：先运行一次  ' + os.path.join(os.path.dirname(os.path.abspath(__file__)), 'setup.sh'))
    print(f'加载语音识别模型 {name}…', file=sys.stderr)
    return WhisperModel(name, device='cpu', compute_type='int8')


PROMPT = '以下是普通话的句子，使用简体中文和标点符号。'


def load_audio(src, t0=0.0, t1=None):
    """用 ffmpeg 解成 16 kHz 单声道 float32 数组（不依赖 PyAV，避免版本不匹配）。"""
    import subprocess, numpy as np
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(t0), *(['-to', str(t1)] if t1 else []), '-i', src,
           '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, check=True, capture_output=True).stdout, np.float32)
