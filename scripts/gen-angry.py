#!/usr/bin/env python3
"""Make angry.png for the Girl, Boy and Cat from their resting pose (greeting_1.png).

Only the face changes: the original brows and smile are painted over with nearby
skin/fur colour, then angry slanted brows, lowered eyelids, a frown and a red flush
are drawn. Body, hands and tumbler stay pixel-identical.

Usage: python3 scripts/gen-angry.py   (needs Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / 'assets' / 'characters'
K = 4  # supersampling factor for smooth strokes

# All coordinates are pixels in greeting_1.png.
FACES = {
    'girl': {
        'patch': [  # (ellipse box, colour sample point) painted over brows and smile
            ((137, 66, 166, 81), (152, 85)),
            ((182, 66, 212, 85), (196, 87)),
            ((155, 115, 193, 130), (174, 131)),
        ],
        'brows': [((139, 72), (165, 82)), ((206, 72), (182, 82))],  # outer -> inner
        'brow_w': 4.2, 'brow_col': (98, 55, 35),
        'lids': [((141, 86), (163, 92)), ((206, 87), (183, 92))],  # outer -> inner lid line
        'eyes': [(151, 97, 12), (194, 98, 12)],  # centre x, y, radius (lid fill limit)
        'mouth': ((163, 126), (174, 120), (186, 126)), 'mouth_w': 2.4, 'mouth_col': (150, 70, 60),
        'flush': [(148, 113, 12), (198, 113, 12)],
    },
    'boy': {
        'patch': [
            ((137, 77, 169, 92), (155, 77)),
            ((178, 76, 212, 92), (195, 78)),
            ((155, 121, 196, 133), (175, 135)),
        ],
        'brows': [((140, 79), (168, 89)), ((210, 79), (181, 89))],
        'brow_w': 5.0, 'brow_col': (95, 58, 40),
        'lids': [((141, 92), (163, 97)), ((208, 92), (186, 97))],
        'eyes': [(152, 102, 12), (197, 102, 12)],
        'mouth': ((164, 131), (175, 124), (187, 131)), 'mouth_w': 2.4, 'mouth_col': (120, 70, 62),
        'flush': [(148, 117, 12), (203, 117, 12)],
    },
    'cat': {
        'patch': [
            ((172, 128, 208, 154), (168, 136)),
        ],
        'brows': [((145, 88), (173, 97)), ((234, 79), (196, 92))],
        'brow_w': 4.5, 'brow_col': (70, 35, 20),
        'lids': [((145, 89), (172, 97)), ((233, 80), (196, 92))],
        'eyes': [(159, 98, 14), (213, 91, 18)],
        'mouth': ((177, 146), (190, 136), (203, 146)), 'mouth_w': 2.6, 'mouth_col': (70, 35, 25),
        'flush': [(150, 118, 12), (222, 112, 12)],
    },
}


def s(p):
    return tuple(v * K for v in p)


def bezier(a, c, b, n=24):
    return [((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
             (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]) for t in (i / n for i in range(n + 1))]


def tapered(draw, a, b, w0, w1, col):
    """Thick stroke from a to b whose width goes from w0 to w1 (rounded ends)."""
    import math
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy) or 1
    nx, ny = -dy / length, dx / length
    poly = [(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2), (b[0] + nx * w1 / 2, b[1] + ny * w1 / 2),
            (b[0] - nx * w1 / 2, b[1] - ny * w1 / 2), (a[0] - nx * w0 / 2, a[1] - ny * w0 / 2)]
    draw.polygon([s(p) for p in poly], fill=col)
    for p, w in ((a, w0), (b, w1)):
        r = w * K / 2
        draw.ellipse((p[0] * K - r, p[1] * K - r, p[0] * K + r, p[1] * K + r), fill=col)


def make(cid, f):
    src = Image.open(ROOT / cid / 'greeting_1.png').convert('RGBA')
    big = src.resize((src.width * K, src.height * K), Image.LANCZOS)
    # 1. Paint over the original brows / smile with soft-edged local skin colour.
    for box, sample in f['patch']:
        col = src.getpixel(sample)[:3] + (255,)
        mask = Image.new('L', big.size, 0)
        ImageDraw.Draw(mask).ellipse(s(box), fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(2 * K))
        big.paste(Image.new('RGBA', big.size, col), (0, 0), mask)
    # 2. Red flush over the face.
    flush = Image.new('L', big.size, 0)
    for cx, cy, r in f['flush']:  # cheeks only, never over the eyes
        ImageDraw.Draw(flush).ellipse(s((cx - r, cy - r * 0.7, cx + r, cy + r * 0.7)), fill=110)
    flush = flush.filter(ImageFilter.GaussianBlur(3 * K))
    big.paste(Image.new('RGBA', big.size, (230, 40, 30, 255)), (0, 0), flush)
    d = ImageDraw.Draw(big)
    # 3. Lowered upper eyelids: fill above the slanted lid line (inside the eye) with skin colour.
    for (outer, inner), (ex, ey, er), (box, sample) in zip(f['lids'], f['eyes'], [(None, None)] * 2):
        top = min(outer[1], inner[1]) - er
        skin = src.getpixel((int(ex), int(top - 2)))[:3] + (255,)
        lid = Image.new('L', big.size, 0)
        ImageDraw.Draw(lid).polygon([s(outer), s(inner), s((inner[0], top)), s((outer[0], top))], fill=255)
        eye = Image.new('L', big.size, 0)
        ImageDraw.Draw(eye).ellipse(s((ex - er - 2, ey - er - 2, ex + er + 2, ey + er + 2)), fill=255)
        from PIL import ImageChops
        lid = ImageChops.multiply(lid, eye).filter(ImageFilter.GaussianBlur(K * 0.6))
        big.paste(Image.new('RGBA', big.size, skin), (0, 0), lid)
        tapered(d, outer, inner, 1.6, 2.6, f['brow_col'] if cid == 'cat' else (60, 30, 20, 255))
    # 4. Angry brows: thin at the outside, thick and low near the nose.
    for outer, inner in f['brows']:
        tapered(d, outer, inner, f['brow_w'] * 0.6, f['brow_w'], f['brow_col'] + (255,))
    # 5. Frown.
    a, c, b = f['mouth']
    d.line([s(p) for p in bezier(a, c, b)], fill=f['mouth_col'] + (255,), width=round(f['mouth_w'] * K), joint='curve')
    for p in (a, b):
        rr = f['mouth_w'] * K / 2
        d.ellipse((p[0] * K - rr, p[1] * K - rr, p[0] * K + rr, p[1] * K + rr), fill=f['mouth_col'] + (255,))
    out = big.resize(src.size, Image.LANCZOS)
    # Keep everything outside the face pixel-identical; keep the original alpha.
    xs = [p[0] for p in sum(([q[0][:2], q[0][2:]] for q in f['patch']), [])] + [x for br in f['brows'] for x, _ in br]
    ys = [p[1] for p in sum(([q[0][:2], q[0][2:]] for q in f['patch']), [])] + [y for br in f['brows'] for _, y in br]
    xs += [x + d for x, _, r in f['flush'] for d in (-r, r)]
    ys += [y + r for _, y, r in f['flush']]
    box = (min(xs) - 8, min(ys) - 20, max(xs) + 8, max(ys) + 8)
    box = tuple(int(v) for v in box)
    result = src.copy()
    face = out.crop(box)
    face.putalpha(src.crop(box).getchannel('A'))
    result.paste(face, box[:2])
    result.save(ROOT / cid / 'angry.png')
    print(f'{cid}: wrote angry.png (face box {box})')


if __name__ == '__main__':
    for cid, f in FACES.items():
        make(cid, f)
