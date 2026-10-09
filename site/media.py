"""
Prepares the landing page's media from the finished launch assets: WebP stills, animated-WebP
loops made from the product GIFs, the link-preview image, and the demo video. Only real Senuma
captures are used; nothing is generated, cropped out of context or retouched.

    python site/media.py [media folder]

The media folder is the hand-off folder that holds Senuma-2.0.1-media/ (GIFs, video, hero, icon)
and Senuma-launch-media/ (raw captures, poster frames, MP4, and tr/ with the Turkish captures and
loops); default: release/. Output: dist-site/assets/. Needs Pillow. Local only.
"""
import os
import shutil
import sys

from PIL import Image, ImageSequence

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'release'))
STORE = os.path.join(MEDIA, 'Senuma-2.0.1-media', 'store')
GIFS = os.path.join(MEDIA, 'Senuma-2.0.1-media', 'gif')
VIDEO = os.path.join(MEDIA, 'Senuma-2.0.1-media', 'video')
LAUNCH = os.path.join(MEDIA, 'Senuma-launch-media')
OUT = os.path.join(ROOT, 'dist-site', 'assets')

# Plain captures of the interface (no caption, no frame): the page supplies its own words.
RAW = os.path.join(LAUNCH, 'raw')
STILLS = {
    'home': 'home.png',
    'spaces': 'space.png',
    'search': 'search.png',
    'customize': 'customize.png',
    'modes': 'mode.png',
    'command': 'command.png',
    'privacy': 'privacy.png',
}
LOOPS = {
    'loop-space': '1-create-space.gif',
    'loop-command': '2-command-center.gif',
    'loop-search': '3-search-shortcut.gif',
    'loop-background': '4-background.gif',
    'loop-modes': '5-modes.gif',
}
# The GIFs carry an English caption bar under the recording; the page has its own text in each
# language, so only the recording (the top 960×600) is kept.
RECORDING = (0, 0, 960, 600)


def size(path):
    return f'{os.path.getsize(path) / 1024:8.0f} kB'


def still(name, source):
    out = os.path.join(OUT, f'{name}.webp')
    Image.open(os.path.join(RAW, source)).convert('RGB').save(out, 'WEBP', quality=88, method=6)
    print(size(out), os.path.basename(out))


def loop(name, source):
    gif = Image.open(os.path.join(GIFS, source))
    frames, durations = [], []
    for frame in ImageSequence.Iterator(gif):
        frames.append(frame.convert('RGB').crop(RECORDING))
        durations.append(frame.info.get('duration', 83))
    out = os.path.join(OUT, f'{name}.webp')
    frames[0].save(out, 'WEBP', save_all=True, append_images=frames[1:], duration=durations, loop=0, quality=72, method=4, minimize_size=True)
    print(size(out), os.path.basename(out), f'({len(frames)} frames, from {os.path.getsize(os.path.join(GIFS, source)) / 1024:.0f} kB GIF)')


def turkish():
    """The Turkish page shows the Turkish interface: its own stills, loops, poster and link preview."""
    source = os.path.join(LAUNCH, 'tr')
    out = os.path.join(OUT, 'tr')
    os.makedirs(out, exist_ok=True)
    for name, file in STILLS.items():
        target = os.path.join(out, f'{name}.webp')
        Image.open(os.path.join(source, 'raw', file)).convert('RGB').save(target, 'WEBP', quality=88, method=6)
        print(size(target), f'tr/{name}.webp')
    for name in LOOPS:
        shutil.copyfile(os.path.join(source, 'loops', f'{name}.webp'), os.path.join(out, f'{name}.webp'))
        print(size(os.path.join(out, f'{name}.webp')), f'tr/{name}.webp')
    poster = os.path.join(out, 'poster-home.webp')
    Image.open(os.path.join(source, 'raw', 'home.png')).convert('RGB').save(poster, 'WEBP', quality=84, method=6)
    preview(os.path.join(source, 'store', 'hero-1400x560.png'), os.path.join(out, 'og.png'))


def preview(hero_path, target):
    """Link preview, 1200×630: the store hero scaled to that height and cropped around its centre."""
    hero = Image.open(hero_path).convert('RGB')
    scaled = hero.resize((round(hero.width * 630 / hero.height), 630), Image.LANCZOS)
    left = (scaled.width - 1200) // 2
    scaled.crop((left, 0, left + 1200, 630)).save(target, optimize=True)
    print(size(target), os.path.relpath(target, OUT).replace(os.sep, '/'))


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, source in STILLS.items():
        still(name, source)
    for name, source in LOOPS.items():
        loop(name, source)
    turkish()

    poster = os.path.join(OUT, 'poster-home.webp')
    Image.open(os.path.join(LAUNCH, 'poster-home.png')).convert('RGB').save(poster, 'WEBP', quality=84, method=6)
    print(size(poster), 'poster-home.webp')

    preview(os.path.join(STORE, 'hero-1400x560.png'), os.path.join(OUT, 'og.png'))

    shutil.copyfile(os.path.join(STORE, 'icon-128.png'), os.path.join(OUT, 'icon.png'))
    shutil.copyfile(os.path.join(VIDEO, 'senuma-28s-silent.webm'), os.path.join(OUT, 'senuma-demo.webm'))
    print(size(os.path.join(OUT, 'senuma-demo.webm')), 'senuma-demo.webm')
    # The page-weight MP4 (scripts/media-mp4.mjs with a lower bitrate) when it exists, else the full one.
    web = os.path.join(LAUNCH, 'senuma-28s-silent-web.mp4')
    mp4 = web if os.path.exists(web) else os.path.join(LAUNCH, 'senuma-28s-silent.mp4')
    shutil.copyfile(mp4, os.path.join(OUT, 'senuma-demo.mp4'))
    print(size(os.path.join(OUT, 'senuma-demo.mp4')), 'senuma-demo.mp4', f'(from {os.path.basename(mp4)})')

    total = sum(os.path.getsize(os.path.join(folder, f)) for folder, _, names in os.walk(OUT) for f in names)
    first = sum(os.path.getsize(os.path.join(OUT, f)) for f in ('home.webp', 'icon.png'))
    print(f'\nassets total {total / 1e6:.1f} MB; needed before scrolling: {first / 1024:.0f} kB (hero image and icon)')


if __name__ == '__main__':
    main()
