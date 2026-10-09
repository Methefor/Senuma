"""
Turns the recorded landing scenes (e2e/media-capture.ts, CAPTURE_ONLY=loops) into the looping
clips the landing page shows: animated WebP, 960×600, 12 fps, real time, nothing drawn on top.

    python scripts/media-loops.py [scenes folder] [output folder]

Defaults: e2e/.out/media-tr → drafts/media-tr/loops. Needs Pillow. Local only.
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENES = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'e2e', '.out', 'media-tr'))
OUT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'drafts', 'media-tr', 'loops'))
FPS = 12
SIZE = (960, 600)

LOOPS = {
    'loop-space': 'gif-1-space',
    'loop-command': 'gif-2-command',
    'loop-search': 'gif-3-shortcut',
    'loop-background': 'gif-4-background',
    'loop-modes': 'gif-5-modes',
}


def frames_at(scene):
    """The latest recorded frame at each output moment, so the clip runs at real speed."""
    with open(os.path.join(SCENES, scene, 'timeline.json'), encoding='utf-8') as f:
        data = json.load(f)
    frames = sorted(data['frames'], key=lambda frame: frame['t'])
    out, i, t = [], 0, data['start']
    while t <= data['end']:
        while i + 1 < len(frames) and frames[i + 1]['t'] <= t:
            i += 1
        out.append(os.path.join(SCENES, scene, frames[i]['file']))
        t += 1.0 / FPS
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, scene in LOOPS.items():
        images = [Image.open(path).convert('RGB').resize(SIZE, Image.LANCZOS) for path in frames_at(scene)]
        durations = [round(1000 / FPS)] * len(images)
        durations[-1] = 1200  # hold the last frame before the loop starts again
        out = os.path.join(OUT, f'{name}.webp')
        images[0].save(out, 'WEBP', save_all=True, append_images=images[1:], duration=durations, loop=0, quality=72, method=4, minimize_size=True)
        print(f'{os.path.getsize(out) / 1024:7.0f} kB  {name}.webp  {len(images)} frames  {len(images) / FPS:.1f} s')


if __name__ == '__main__':
    main()
