# LOWLIFE brand: sunset tile with a Pricedown "L", mask, X banner, OG. Run: python3 brand/render_lowlife.py
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
R = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(R)
PD = os.path.join(ROOT, "src/app/fonts/Pricedown.otf")
def grad(w, h, stops):
    im = Image.new("RGB", (w, h)); px = im.load()
    for y in range(h):
        t = y / (h - 1)
        for i in range(len(stops) - 1):
            (a, ca), (b, cb) = stops[i], stops[i + 1]
            if a <= t <= b:
                k = (t - a) / (b - a); c = tuple(int(ca[j] + (cb[j] - ca[j]) * k) for j in range(3)); break
        for x in range(w): px[x, y] = c
    return im
SUNSET = [(0, (26, 11, 61)), (.5, (120, 30, 110)), (.78, (255, 95, 168)), (1, (255, 195, 138))]
def sun(im, cx, cy, r):
    d = ImageDraw.Draw(im, "RGBA")
    s = grad(2 * r, 2 * r, [(0, (255, 225, 122)), (1, (255, 61, 139))]); m = Image.new("L", (2 * r, 2 * r)); ImageDraw.Draw(m).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
    for i in range(6):  # retro stripes
        y = int(r * 1.05 + i * r * 0.16); ImageDraw.Draw(m).rectangle((0, y, 2 * r, y + int(r * 0.05 + i * 2)), fill=0)
    im.paste(s, (cx - r, cy - r), m)
def tile(n):
    im = grad(n, n, SUNSET); sun(im, n // 2, int(n * .56), int(n * .33))
    f = ImageFont.truetype(PD, int(n * .78)); d = ImageDraw.Draw(im)
    d.text((n // 2, int(n * .5)), "L", font=f, anchor="mm", fill="white", stroke_width=max(2, n // 40), stroke_fill=(13, 7, 32))
    m = Image.new("L", (n, n), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, n - 1, n - 1), radius=n // 5, fill=255)
    out = Image.new("RGBA", (n, n)); out.paste(im, (0, 0), m); return out
tile(1000).save(os.path.join(R, "pfp-1000.png")); tile(512).save(os.path.join(ROOT, "public/brand/pfp-512.png"))
t = tile(512).convert("RGB"); t.resize((256, 256)).save(os.path.join(ROOT, "src/app/icon.png")); t.resize((180, 180)).save(os.path.join(ROOT, "src/app/apple-icon.png"))
mk = Image.new("RGBA", (512, 512)); ImageDraw.Draw(mk).text((256, 256), "L", font=ImageFont.truetype(PD, 420), anchor="mm", fill="white"); mk.save(os.path.join(ROOT, "public/brand/logo-mask.png"))
def wide(w, h, title, sub, path):
    im = grad(w, h, SUNSET); sun(im, int(w * .72), int(h * .62), int(h * .42))
    d = ImageDraw.Draw(im)
    d.text((int(w * .06), int(h * .42)), title, font=ImageFont.truetype(PD, int(h * .30)), anchor="lm", fill="white", stroke_width=h // 90, stroke_fill=(13, 7, 32))
    d.text((int(w * .065), int(h * .66)), sub, font=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", int(h * .065)), anchor="lm", fill=(255, 240, 220))
    im.save(path)
wide(1500, 500, "LOWLIFE", "Ten AI locals of Leonida. Real trades on Robinhood Chain.", os.path.join(R, "x-banner-1500x500.png"))
wide(1200, 630, "LOWLIFE", "AI locals of Leonida trading on Robinhood Chain", os.path.join(R, "og-1200x630.png"))
for n in ("opengraph-image.png", "twitter-image.png"): Image.open(os.path.join(R, "og-1200x630.png")).save(os.path.join(ROOT, "src/app", n))
print("ok")
