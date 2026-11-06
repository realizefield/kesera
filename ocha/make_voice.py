#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""VOICEVOX（四国めたん）で、script.js の全文を 1文ずつ wav にして audio/ に保存します。

使い方:
  1. VOICEVOX を起動しておく（エンジンが http://127.0.0.1:50021 で動きます）
  2. このフォルダで   python make_voice.py
  3. audio/ フォルダに s01_01.wav ... ができます。index.html と同じ場所に置けば、
     スライドが自動でその音声を再生します。

  オプション:  --speed 0.95   読む速さ（既定 0.95。ゆっくりめ）
               --speaker 2    2=四国めたん ノーマル / 0=あまあま / 6=ツンツン / 4=セクシー
               --force        すでにあるファイルも作り直す
標準ライブラリだけで動きます。
音声を公開するときは「VOICEVOX:四国めたん」のクレジット表記が必要です。"""
import argparse, json, re, sys, urllib.parse, urllib.request, urllib.error
from pathlib import Path

BASE = Path(__file__).resolve().parent
PAT = re.compile(r'\{([^|{}]+)\|([^|{}]*)(?:\|([^{}]*))?\}')

def voice(s):
    return PAT.sub(lambda m: m.group(3) if m.group(3) is not None else m.group(2), s)

def load():
    txt = (BASE / 'script.js').read_text(encoding='utf-8')
    body = txt[txt.index('window.OCHA_SCRIPT') :]
    body = body[body.index('=') + 1 :].strip().rstrip(';')
    return json.loads(body)

def post(url, data=None):
    headers = {'Content-Type': 'application/json'} if data else {}
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()

def synth(host, text, speaker, speed):
    q = json.loads(post(f'{host}/audio_query?text={urllib.parse.quote(text)}&speaker={speaker}'))
    q['speedScale'] = speed
    return post(f'{host}/synthesis?speaker={speaker}', json.dumps(q).encode('utf-8'))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--host', default='http://127.0.0.1:50021')
    ap.add_argument('--speaker', type=int, default=None)
    ap.add_argument('--speed', type=float, default=0.95)
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    data = load()
    speaker = a.speaker if a.speaker is not None else data.get('speaker', 2)
    out = BASE / 'audio'
    out.mkdir(exist_ok=True)
    total = sum(len(s['lines']) for s in data['slides'])
    n = 0
    for si, s in enumerate(data['slides'], 1):
        for li, line in enumerate(s['lines'], 1):
            n += 1
            if line.startswith('【'):
                print(f'[{n}/{total}] s{si:02d}_{li:02d} （原稿待ち・スキップ）')
                continue
            f = out / f's{si:02d}_{li:02d}.wav'
            if f.exists() and not a.force:
                print(f'[{n}/{total}] {f.name} 済み')
                continue
            try:
                f.write_bytes(synth(a.host, voice(line), speaker, a.speed))
            except (urllib.error.URLError, ConnectionError) as e:
                sys.exit(f'VOICEVOX に接続できません（{e}）。VOICEVOX を起動してからもう一度どうぞ。')
            print(f'[{n}/{total}] {f.name}  {voice(line)[:30]}')
    print('完了。audio/ フォルダを index.html と同じ場所に置いてください。')

if __name__ == '__main__':
    main()
