# Builds the logo (transparent corners) and the text-free icon mark from
# assets-src/logo-source.webp, then writes the extension icon sizes.
# Run: python3 scripts/make-icons.py assets-src/logo-source.webp assets-src
import sys
from PIL import Image, ImageDraw
src, outdir = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
W, H = im.size
R = 200  # corner radius of the tile

def mask(size, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m

px = im.load()
# 1) Fill the white outer corners with the tile's background colour of that row.
for y in range(H):
    ref = px[W // 2, y] if (y < 300 or y > 1000) else px[100, y]
    for x in list(range(0, 260)) + list(range(W - 260, W)):
        r, g, b, a = px[x, y]
        if r + g + b > 600 and (y < 260 or y > H - 260):
            px[x, y] = ref

full = im.copy()
full.putalpha(mask(W, R))
full.save(f'{outdir}/logo.png')

# 2) Icon mark: erase the wordmark (rows below the artwork) with the background,
#    then shift the artwork down so it is centred.
mark = im.copy()
mp = mark.load()
for y in range(820, H):
    left, right = mp[40, y], mp[W - 40, y]
    for x in range(W):
        t = x / (W - 1)
        mp[x, y] = tuple(int(left[i] * (1 - t) + right[i] * t) for i in range(4))
# Square crop around the artwork (book, orbit, sparkle), then round the corners.
crop = mark.crop((187, 45, 1067, 925)).resize((1024, 1024), Image.LANCZOS)
crop.putalpha(mask(1024, 180))
crop.save(f'{outdir}/icon-mark.png')

# 3) Extension icons (toolbar, extensions page, store) from the mark.
import os
icon_dir = os.path.join(os.path.dirname(outdir.rstrip('/')) or '.', 'public', 'icon')
os.makedirs(icon_dir, exist_ok=True)
for size in (16, 32, 48, 96, 128):
    crop.resize((size, size), Image.LANCZOS).save(f'{icon_dir}/{size}.png', optimize=True)
