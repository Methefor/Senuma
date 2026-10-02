"""Assemble captured product frames into a muted GIF; no fabricated UI."""
from pathlib import Path
from PIL import Image
source = Path('assets/gifs/frames')
frames = [Image.open(p).convert('RGB').resize((800, 500)) for p in sorted(source.glob('*.png'))]
if not frames:
    raise SystemExit('Run npm run demo:assets first')
output = Path('assets/gifs/senuma-product-tour.gif')
frames[0].save(output, save_all=True, append_images=frames[1:], duration=180, loop=0, optimize=False)
with Image.open(output) as result:
    print(f'{output}: {result.size}, {result.n_frames} frames')
