"""
Composes the vertical clips (docs/MEDIA_PLAN.md § 7) from the portrait recordings made by
e2e/media-portrait.ts: 1080×1920, 30 fps, real time. The recording is the real interface in a
real 432×768 window at 2.5×; the recorder also captures the empty window area beside the page,
which is trimmed here. Added on top: the hook line, short overlay lines, the keys pressed, and an
end card. The product itself is never retouched.

    python scripts/media-portrait.py [en] [tr] [scene …]

Output: drafts/media/portrait/<lang>/v<n>-<slug>-<lang>.webm (VP8, the ffmpeg Playwright installs).
MP4: node scripts/media-mp4.mjs <file.webm> <folder> 6000000 <name>.mp4 noposters
"""
import glob
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENES = os.path.join(ROOT, 'e2e', '.out', 'media-portrait')
OUT = os.path.join(ROOT, 'drafts', 'media', 'portrait')
FONTS = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')
BOLD = os.path.join(FONTS, 'segoeuib.ttf')
REGULAR = os.path.join(FONTS, 'segoeui.ttf')
ICON = os.path.join(ROOT, 'src', 'assets', 'brand', 'icon128.png')
SIZE = (1080, 1920)
FPS = 30
HOOK_SECONDS = 1.5
END_SECONDS = 1.3

# Platform-safe zones inside 1080×1920 (MEDIA_PLAN.md § 7.2).
HOOK_Y = 250
# Lines replace the hook over the greeting: the one area that is inside the platform-safe zone and
# holds nothing the clip is about. Keys show in the gap between the Spaces and the dock.
OVERLAY_Y = {'bottom': 250, 'top': 250}
KEY_Y = 1612
# A line stays at most this long, so it never outlives the step it describes.
OVERLAY_SECONDS = 2.8

# Hook, overlay lines (one per “@n” mark) and where the overlays sit. Lines: docs/CONTENT_LIBRARY.md.
CLIPS = {
    'v1-lofi': {
        'slug': 'y-lofi-mix', 'zone': 'top',
        'en': ('Stop opening YouTube first.', ['y + space + what you want', 'One search bar. Your rules.']),
        'tr': ('Önce YouTube’u açmayı bırak.', ['y + boşluk + ne istiyorsan', 'Tek arama çubuğu. Senin kuralların.']),
    },
    'v2-command': {
        'slug': 'ctrl-k', 'zone': 'top',
        'en': ('Everything, one shortcut away.', ['Open anything', 'Switch Mode']),
        'tr': ('Her şey tek kısayol uzağında.', ['Her şeyi aç', 'Mod değiştir']),
    },
    'v3-modes': {
        'slug': 'work-to-gaming', 'zone': 'top',
        'en': ('Work mode → Gaming mode. One key.', ['Work', 'Gaming', 'Same tab.']),
        'tr': ('İş modu → Oyun modu. Tek tuş.', ['İş', 'Oyun', 'Aynı sekme.']),
        'hook_with_first': True,
    },
    'v4-customize': {
        'slug': 'customization', 'zone': 'top',
        'en': ('Make every new tab feel like yours.', ['Your photo', 'Fill / Fit · Position', 'Dim · Blur', 'Atmosphere', 'Make every new tab feel like yours.']),
        'tr': ('Her yeni sekme sana ait hissettirsin.', ['Senin fotoğrafın', 'Doldur / Sığdır · Konum', 'Karartma · Bulanıklık', 'Atmosfer', 'Her yeni sekme sana ait hissettirsin.']),
    },
    'v5-ai-dev': {
        'slug': 'ai-dev-space', 'zone': 'top',
        'en': ('All my AI and dev tools on one page.', ['One Space for AI', 'cl = Claude', 'One Space for code', 'gh = GitHub']),
        'tr': ('Tüm yapay zekâ ve geliştirme araçlarım tek sayfada.', ['Yapay zekâ için tek Alan', 'cl = Claude', 'Kod için tek Alan', 'gh = GitHub']),
    },
}
END = {
    'en': ('senuma', 'Free on the Chrome Web Store'),
    'tr': ('senuma', 'Chrome Web Store’da ücretsiz'),
}


def font(path, size):
    return ImageFont.truetype(path, size)


def wrap(draw, text, fnt, width):
    lines, line = [], ''
    for word in text.split(' '):
        trial = f'{line} {word}'.strip()
        if draw.textlength(trial, font=fnt) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line]


def band(img, text, y, size, alpha=1.0):
    """One or two centred lines on a soft dark plate, so they read over any background."""
    if alpha <= 0:
        return img
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    fnt = font(BOLD, size)
    lines = wrap(draw, text, fnt, 900)[:2]
    height = int(size * 1.25)
    widest = max(draw.textlength(line, font=fnt) for line in lines)
    pad_x, pad_y = 36, 22
    box = ((SIZE[0] - widest) / 2 - pad_x, y - pad_y, (SIZE[0] + widest) / 2 + pad_x, y + height * len(lines) + pad_y - 8)
    draw.rounded_rectangle(box, radius=28, fill=(10, 11, 22, int(205 * alpha)))
    for index, line in enumerate(lines):
        width = draw.textlength(line, font=fnt)
        draw.text(((SIZE[0] - width) / 2, y + index * height), line, font=fnt, fill=(244, 245, 250, int(255 * alpha)))
    return Image.alpha_composite(img.convert('RGBA'), layer).convert('RGB')


def keycap(img, text):
    draw = ImageDraw.Draw(img, 'RGBA')
    fnt = font(BOLD, 44)
    width = draw.textlength(text, font=fnt) + 64
    x, height = (SIZE[0] - width) / 2, 84
    draw.rounded_rectangle((x, KEY_Y, x + width, KEY_Y + height), radius=20, fill=(245, 246, 250, 238), outline=(0, 0, 0, 90), width=3)
    box = draw.textbbox((0, 0), text, font=fnt)
    draw.text((x + 32, KEY_Y + (height - (box[3] - box[1])) / 2 - box[1]), text, font=fnt, fill=(20, 22, 32, 255))
    return img


def end_card(lang):
    card = Image.new('RGB', SIZE, (9, 11, 22))
    draw = ImageDraw.Draw(card)
    word, line = font(BOLD, 132), font(REGULAR, 50)
    name, call = END[lang]
    icon = Image.open(ICON).convert('RGBA').resize((200, 200), Image.LANCZOS)
    card.paste(icon, ((SIZE[0] - 200) // 2, 640), icon)
    draw.text(((SIZE[0] - draw.textlength(name, font=word)) / 2, 880), name, font=word, fill=(238, 240, 247))
    draw.text(((SIZE[0] - draw.textlength(call, font=line)) / 2, 1070), call, font=line, fill=(185, 189, 207))
    return card


def timeline(lang, scene):
    folder = os.path.join(SCENES, lang, scene)
    with open(os.path.join(folder, 'timeline.json'), encoding='utf-8') as f:
        data = json.load(f)
    frames = sorted(data['frames'], key=lambda frame: frame['t'])
    start, end = data['start'], data['end']
    out, i, t = [], 0, start
    while t <= end:
        while i + 1 < len(frames) and frames[i + 1]['t'] <= t:
            i += 1
        out.append((t - start, os.path.join(folder, frames[i]['file'])))
        t += 1.0 / FPS
    marks = [(mark['t'] - start, mark['text']) for mark in data['keys']]
    return out, marks, end - start


def compose(lang, scene):
    clip = CLIPS[scene]
    hook, lines = clip[lang]
    frames, marks, length = timeline(lang, scene)
    overlays = [(t, int(text[1:]) - 1) for t, text in marks if text.startswith('@')]
    keys = [(t, text) for t, text in marks if not text.startswith('@')]
    ffmpeg = sorted(glob.glob(os.path.join(os.environ['LOCALAPPDATA'], 'ms-playwright', 'ffmpeg-*', 'ffmpeg-win64.exe')))[-1]
    folder = os.path.join(OUT, lang)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, f'{scene.split("-")[0]}-{clip["slug"]}-{lang}.webm')
    proc = subprocess.Popen([ffmpeg, '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0',
                             '-c:v', 'libvpx', '-b:v', '9M', '-crf', '6', '-qmin', '2', '-qmax', '28', '-auto-alt-ref', '0', path], stdin=subprocess.PIPE)
    count, cache = 0, {}

    def emit(img):
        nonlocal count
        img.save(proc.stdin, 'JPEG', quality=95, subsampling=0)
        count += 1

    last = None
    for t, file in frames:
        if file not in cache:
            # The page is the top-left 1080×1920 of the recorded window; the rest is empty window area.
            cache = {file: Image.open(file).convert('RGB').crop((0, 0, SIZE[0], SIZE[1]))}
        img = cache[file].copy()
        if img.size != SIZE:
            raise SystemExit(f'{lang}/{scene}: frame is {img.size}, expected a window of at least {SIZE}')
        # The hook, then the overlay line that is current.
        hook_alpha = 1.0 if t < HOOK_SECONDS else max(0.0, 1 - (t - HOOK_SECONDS) / 0.3)
        current = [index for at, index in overlays if at <= t]
        zone = OVERLAY_Y[clip['zone']]
        if hook_alpha > 0:
            img = band(img, hook, HOOK_Y, 62, hook_alpha)
        if current and current[-1] < len(lines) and t >= HOOK_SECONDS + 0.3:
            since = t - [at for at, _ in overlays if at <= t][-1]
            if since <= OVERLAY_SECONDS:
                img = band(img, lines[current[-1]], zone, 54, min(1.0, since / 0.2, (OVERLAY_SECONDS - since) / 0.2))
        for at, text in keys:
            if at - 0.05 <= t <= at + 0.8:
                img = keycap(img, text)
        emit(img)
        last = img
    card = end_card(lang)
    for n in range(int(END_SECONDS * FPS)):
        emit(Image.blend(last, card, min(1.0, n / (0.25 * FPS))))
    proc.stdin.close()
    proc.wait()
    print(f'{os.path.relpath(path, ROOT)}  {count / FPS:.1f} s  {os.path.getsize(path) / 1e6:.1f} MB')


if __name__ == '__main__':
    args = sys.argv[1:]
    languages = [a for a in args if a in ('en', 'tr')] or ['en', 'tr']
    scenes = [a for a in args if a in CLIPS] or list(CLIPS)
    for language in languages:
        for name in scenes:
            compose(language, name)
