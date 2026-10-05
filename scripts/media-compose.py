"""
Turns the recordings from e2e/media-capture.ts into the six GIFs and the product video
(docs/MEDIA_PLAN.md §2-3). Local files only; nothing is uploaded.

    python scripts/media-compose.py

Needs Pillow. The video is encoded with the ffmpeg build that Playwright installs (VP8/WebM):
an MP4 needs an ffmpeg with H.264, which is not part of this toolchain.

Frames are taken from the recordings in real time (no speed changes). Captions, key hints and
the end card are drawn on top; the product UI itself is never retouched.
"""
import glob
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, 'e2e', '.out', 'media')
OUT = os.path.join(ROOT, 'drafts', 'media')
FONTS = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')
BOLD = os.path.join(FONTS, 'segoeuib.ttf')
REGULAR = os.path.join(FONTS, 'segoeui.ttf')
ICON = os.path.join(ROOT, 'src', 'assets', 'brand', 'icon128.png')

GIFS = [
    # scene, file, caption
    ('gif-1-space', '1-create-space', 'New Space, first link: two steps.'),
    ('gif-2-command', '2-command-center', 'Everything, one shortcut away.'),
    ('gif-3-shortcut', '3-search-shortcut', 'One search bar. Your rules.'),
    ('gif-4-background', '4-background', 'Fit, position, dim, blur, atmosphere.'),
    ('gif-5-modes', '5-modes', 'A workspace for every mode.'),
    ('gif-6-backup', '6-backup', 'Your setup, in one file.'),
]

VIDEO = [
    # scene, on-screen text, longest it may run (s): anything past it is the idle hold at the end of the recording
    ('video-1-home', 'Make the browser yours.', 3.0),
    ('video-2-spaces', 'Everything you use, organized.', 4.5),
    ('video-3-shortcut', 'One search bar. Your rules.', 3.5),
    ('video-4-command', 'Everything, one shortcut away.', 4.0),
    ('video-5-background', 'Make every new tab feel like yours.', 8.5),
    ('video-6-modes', 'A workspace for every mode.', 3.4),
]


def timeline(scene):
    with open(os.path.join(MEDIA, scene, 'timeline.json'), encoding='utf-8') as f:
        data = json.load(f)
    data['frames'].sort(key=lambda frame: frame['t'])
    return data


def frames_at(scene, fps):
    """(time from start, image path) for every output frame: the latest recorded frame at that moment."""
    data = timeline(scene)
    frames, start, end = data['frames'], data['start'], data['end']
    out, i, step, t = [], 0, 1.0 / fps, start
    while t <= end:
        while i + 1 < len(frames) and frames[i + 1]['t'] <= t:
            i += 1
        out.append((t - start, os.path.join(MEDIA, scene, frames[i]['file'])))
        t += step
    return out, [(k['t'] - start, k['text']) for k in data['keys'] if k['text']]


def font(path, size):
    return ImageFont.truetype(path, size)


def pill(draw, xy, text, fnt, pad=(16, 8), fill=(12, 14, 26, 196), color=(238, 240, 247, 255)):
    x, y = xy
    box = draw.textbbox((0, 0), text, font=fnt)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.rounded_rectangle((x, y, x + w + pad[0] * 2, y + h + pad[1] * 2 + 4), radius=(h + pad[1] * 2) // 2, fill=fill)
    draw.text((x + pad[0], y + pad[1] - box[1]), text, font=fnt, fill=color)
    return w + pad[0] * 2, h + pad[1] * 2


def keycap(img, text, scale):
    """The key being pressed, bottom centre, as a plain keycap."""
    draw = ImageDraw.Draw(img, 'RGBA')
    fnt = font(BOLD, int(22 * scale))
    box = draw.textbbox((0, 0), text, font=fnt)
    w = box[2] - box[0] + int(36 * scale)
    h = int(46 * scale)
    x, y = (img.width - w) // 2, int(150 * scale / 1.2)
    draw.rounded_rectangle((x, y, x + w, y + h), radius=int(10 * scale), fill=(245, 246, 250, 235), outline=(0, 0, 0, 90), width=max(1, int(2 * scale)))
    draw.text((x + (w - (box[2] - box[0])) // 2, y + (h - (box[3] - box[1])) // 2 - box[1]), text, font=fnt, fill=(20, 22, 32, 255))


BAR = 52


def gif(scene, name, caption, fps=12, size=(960, 600)):
    """The recording on top, a caption bar underneath: the caption never covers the product."""
    frames, keys = frames_at(scene, fps)
    images = []
    cap_font, key_font = font(BOLD, 20), font(BOLD, 17)
    canvas = (size[0], size[1] + BAR)
    for t, path in frames:
        img = Image.new('RGB', canvas, (11, 13, 26))
        img.paste(Image.open(path).convert('RGB').resize(size, Image.LANCZOS), (0, 0))
        draw = ImageDraw.Draw(img, 'RGBA')
        box = draw.textbbox((0, 0), caption, font=cap_font)
        draw.text((22, size[1] + (BAR - (box[3] - box[1])) // 2 - box[1]), caption, font=cap_font, fill=(238, 240, 247))
        for kt, text in keys:
            if kt - 0.05 <= t <= kt + 0.8:
                kb = draw.textbbox((0, 0), text, font=key_font)
                w, h = kb[2] - kb[0] + 26, 32
                x, y = canvas[0] - w - 20, size[1] + (BAR - h) // 2
                draw.rounded_rectangle((x, y, x + w, y + h), radius=8, fill=(245, 246, 250))
                draw.text((x + 13, y + (h - (kb[3] - kb[1])) // 2 - kb[1]), text, font=key_font, fill=(20, 22, 32))
        images.append(img)
    # One palette for the whole GIF, so colours do not shimmer between frames.
    sample = Image.new('RGB', (canvas[0], canvas[1] * 4))
    for k, idx in enumerate([0, len(images) // 3, 2 * len(images) // 3, len(images) - 1]):
        sample.paste(images[idx], (0, canvas[1] * k))
    palette = sample.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    paletted = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in images]
    # Hold the last frame before looping.
    durations = [int(1000 / fps)] * len(paletted)
    durations[-1] = 1200
    path = os.path.join(OUT, 'gif', f'{name}.gif')
    paletted[0].save(path, save_all=True, append_images=paletted[1:], duration=durations, loop=0, optimize=True, disposal=1)
    print(f'{name}.gif  {len(paletted)} frames  {len(paletted) / fps:.1f} s  {os.path.getsize(path) / 1e6:.1f} MB')


def text_band(img, text):
    """A soft dim at the top and one line of text; the controls in use stay clear."""
    w, h = img.size
    band = Image.new('L', (1, 240))
    for y in range(240):
        band.putpixel((0, y), int(165 * (1 - y / 240) ** 1.6))
    shade = Image.new('RGBA', (w, 240), (6, 8, 18, 0))
    shade.putalpha(band.resize((w, 240)))
    out = img.convert('RGBA')
    out.alpha_composite(shade, (0, 0))
    draw = ImageDraw.Draw(out, 'RGBA')
    fnt = font(BOLD, 56)
    box = draw.textbbox((0, 0), text, font=fnt)
    draw.text(((w - (box[2] - box[0])) // 2, 64 - box[1]), text, font=fnt, fill=(240, 242, 248, 255))
    return out.convert('RGB')


def end_card(size=(1920, 1080)):
    w, h = size
    card = Image.new('RGB', size, (11, 13, 26))
    glow = Image.new('RGB', size, (11, 13, 26))
    ImageDraw.Draw(glow).ellipse((-w * 0.2, -h * 0.6, w * 0.7, h * 0.9), fill=(28, 32, 68))
    card = Image.blend(card, glow.filter(ImageFilter.GaussianBlur(220)), 1.0)
    icon = Image.open(ICON).convert('RGBA').resize((128, 128), Image.LANCZOS)
    draw = ImageDraw.Draw(card)
    word, line = font(BOLD, 104), font(REGULAR, 40)
    wb = draw.textbbox((0, 0), 'senuma', font=word)
    total = 128 + 28 + (wb[2] - wb[0])
    x0 = (w - total) // 2
    card.paste(icon, (x0, h // 2 - 120), icon)
    draw.text((x0 + 156, h // 2 - 120 + (128 - (wb[3] - wb[1])) // 2 - wb[1]), 'senuma', font=word, fill=(238, 240, 247))
    lb = draw.textbbox((0, 0), 'Your place on the web.', font=line)
    draw.text(((w - (lb[2] - lb[0])) // 2, h // 2 + 48), 'Your place on the web.', font=line, fill=(185, 189, 207))
    return card


def video(fps=30):
    ffmpeg = sorted(glob.glob(os.path.join(os.environ['LOCALAPPDATA'], 'ms-playwright', 'ffmpeg-*', 'ffmpeg-win64.exe')))[-1]
    path = os.path.join(OUT, 'video', 'senuma-28s-silent.webm')
    proc = subprocess.Popen([ffmpeg, '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',  # this build has no '-' shorthand
                             '-c:v', 'libvpx', '-b:v', '8M', '-crf', '6', '-qmin', '2', '-qmax', '30', '-auto-alt-ref', '0', path], stdin=subprocess.PIPE)
    timings, written = [], 0

    def emit(img):
        nonlocal written
        # This ffmpeg build reads JPEG frames only; near-lossless settings keep the UI crisp.
        img.save(proc.stdin, 'JPEG', quality=96, subsampling=0)
        written += 1

    black = Image.new('RGB', (1920, 1080), (0, 0, 0))
    for index, (scene, text, longest) in enumerate(VIDEO):
        frames, keys = frames_at(scene, fps)
        frames = frames[:int(longest * fps)]
        timings.append((scene, written / fps, len(frames) / fps))
        for n, (t, file) in enumerate(frames):
            img = Image.open(file).convert('RGB')
            if img.size != (1920, 1080):
                img = img.resize((1920, 1080), Image.LANCZOS)
            img = text_band(img, text)
            for kt, key in keys:
                if kt - 0.05 <= t <= kt + 0.8:
                    img = img.convert('RGBA')
                    keycap(img, key, 1.2)
                    img = img.convert('RGB')
            if index == 0 and t < 0.4:  # fade in from black
                img = Image.blend(black, img, t / 0.4)
            emit(img)
    card = end_card()
    hold = int(2.0 * fps)
    for n in range(hold):
        fade_out = max(0.0, (n - (hold - 0.6 * fps)) / (0.6 * fps))
        emit(Image.blend(card, black, min(1.0, fade_out)))
    timings.append(('end card', (written - hold) / fps, 2.0))
    proc.stdin.close()
    proc.wait()
    for scene, at, length in timings:
        print(f'  {at:5.1f} s  {length:4.1f} s  {scene}')
    print(f'senuma-28s-silent.webm  {written / fps:.1f} s  {os.path.getsize(path) / 1e6:.1f} MB')


if __name__ == '__main__':
    for sub in ('gif', 'video'):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)
    only = sys.argv[1:] or ['gif', 'video']
    if 'gif' in only:
        for scene, name, caption in GIFS:
            gif(scene, name, caption)
    if 'video' in only:
        video()
