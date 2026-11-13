# CLIP-style banner + OG (Ocean Drive photo, purple wash) carrying the V logo's chrome-pink Pricedown look.
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import os
R = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(R)
PD = os.path.join(ROOT, "src/app/fonts/Pricedown.otf"); FD = "/Users/rayane/clipfun/x-launch-pack/fonts/"
PHOTO = Image.open(os.path.join(ROOT, "public/locals/ocean-drive.jpg")).convert("RGB")
def grad(w, h, stops):
    g = Image.new("RGB", (1, h)); px = g.load()
    for y in range(h):
        t = y / max(1, h - 1)
        for i in range(len(stops) - 1):
            (a, ca), (b, cb) = stops[i], stops[i + 1]
            if a <= t <= b: k = (t - a) / (b - a); px[0, y] = tuple(int(ca[j] + (cb[j] - ca[j]) * k) for j in range(3)); break
    return g.resize((w, h))
def make(W, H, title, sub, tagline, out, logo):
    im = ImageOps.fit(PHOTO, (W, H), centering=(.5, .55))
    wash = grad(W, H, [(0, (40, 10, 80)), (.6, (120, 30, 120)), (1, (230, 80, 150))])
    im = Image.blend(im, wash, .52)
    vg = Image.new("L", (W, H), 0); ImageDraw.Draw(vg).ellipse((-W * .2, -H * .4, W * 1.2, H * 1.4), fill=255)
    im = Image.composite(im, Image.blend(im, Image.new("RGB", (W, H), (18, 6, 40)), .6), vg.filter(ImageFilter.GaussianBlur(W // 10)))
    size = int(H * (.36 if W > 1300 else .25)); f = ImageFont.truetype(PD, size)
    cx, cy = W // 2 + (60 if logo else 0), int(H * .46)
    if logo:
        tw = ImageDraw.Draw(im).textlength(title, font=f); L = int(size * 1.0)
        v = Image.open(os.path.join(R, "pfp-1000.png")).convert("RGB").resize((L, L))
        m = Image.new("L", (L, L)); ImageDraw.Draw(m).rounded_rectangle((0, 0, L - 1, L - 1), L // 5, fill=255)
        lx = int(cx - tw / 2 - L - size * .25); im.paste(v, (lx, cy - L // 2), m)
    mask = Image.new("L", (W, H)); ImageDraw.Draw(mask).text((cx, cy), title, font=f, anchor="mm", fill=255)
    outl = Image.new("L", (W, H)); ImageDraw.Draw(outl).text((cx, cy), title, font=f, anchor="mm", fill=255, stroke_width=size // 28, stroke_fill=255)
    im.paste((255, 60, 200), (0, 0), outl.filter(ImageFilter.GaussianBlur(size // 7)).point(lambda v: int(v * .8)))
    im.paste((14, 4, 30), (size // 40, size // 32), outl); im.paste((14, 4, 30), (0, 0), outl)
    bb = mask.getbbox(); fill = Image.new("RGB", (W, H)); fill.paste(grad(W, bb[3] - bb[1], [(0, (255, 255, 255)), (.4, (255, 225, 248)), (.62, (255, 110, 195)), (1, (255, 200, 120))]), (0, bb[1]))
    im.paste(fill, (0, 0), mask)
    d = ImageDraw.Draw(im)
    fs = ImageFont.truetype(FD + "Inter-800.ttf", int(size * .17))
    d.text((cx, bb[1] - int(size * .16)), "W E L C O M E   T O   L E O N I D A", font=fs, anchor="mm", fill=(255, 120, 200))
    fb = ImageFont.truetype(FD + "Inter-800.ttf", int(size * .26))
    d.text((W // 2, bb[3] + int(size * .42)), sub, font=fb, anchor="mm", fill="white", stroke_width=3, stroke_fill=(30, 8, 50))
    if tagline:
        ft = ImageFont.truetype(FD + "Inter-800.ttf", int(size * .17))
        d.text((W // 2, bb[3] + int(size * .78)), tagline, font=ft, anchor="mm", fill=(255, 225, 140), stroke_width=2, stroke_fill=(30, 8, 50))
    im.save(out)
make(1500, 500, "VICE AGENTS", "Ten AI agents trade Robinhood Chain.", None, os.path.join(R, "x-banner-1500x500.png"), False)
make(1200, 630, "VICE AGENTS", "Ten AI agents trade Robinhood Chain.", "The map is the market.  viceagents.fun", os.path.join(R, "og-1200x630.png"), True)
for n in ("opengraph-image.png", "twitter-image.png"): Image.open(os.path.join(R, "og-1200x630.png")).save(os.path.join(ROOT, "src/app", n))
