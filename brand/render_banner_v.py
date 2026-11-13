# X banner 1500x500 matching the V avatar: sunset glow, striped sun, synthwave grid, chrome-pink "VICE AGENTS".
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import os
R = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(R)
PD = os.path.join(ROOT, "src/app/fonts/Pricedown.otf"); W, H = 1500, 500
def grad(w, h, stops):
    g = Image.new("RGB", (1, h)); px = g.load()
    for y in range(h):
        t = y / (h - 1)
        for i in range(len(stops) - 1):
            (a, ca), (b, cb) = stops[i], stops[i + 1]
            if a <= t <= b: k = (t - a) / (b - a); px[0, y] = tuple(int(ca[j] + (cb[j] - ca[j]) * k) for j in range(3)); break
    return g.resize((w, h))
im = grad(W, H, [(0, (20, 8, 48)), (.5, (100, 26, 112)), (.78, (240, 80, 155)), (1, (255, 170, 120))])
cx, cy, r = 1060, 330, 230
glow = Image.new("RGB", (W, H)); ImageDraw.Draw(glow).ellipse((cx - r - 70, cy - r - 70, cx + r + 70, cy + r + 70), fill=(255, 80, 160))
im = ImageChops.screen(im, glow.filter(ImageFilter.GaussianBlur(90)))
s = grad(2 * r, 2 * r, [(0, (255, 232, 130)), (.6, (255, 120, 120)), (1, (255, 50, 140))])
m = Image.new("L", (2 * r, 2 * r)); md = ImageDraw.Draw(m); md.ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
for i in range(6): y = int(r * 1.0 + i * r * 0.14); md.rectangle((0, y, 2 * r, y + 5 + i * 4), fill=0)
im.paste(s, (cx - r, cy - r), m)
hz = 400; d = ImageDraw.Draw(im, "RGBA"); d.rectangle((0, hz, W, H), fill=(25, 6, 50, 255))
for i in range(-30, 31): d.line((W // 2 + i * 45, hz, W // 2 + i * 260, H), fill=(255, 80, 200, 190), width=2)
y, k = hz, 6
while y < H: d.line((0, y, W, y), fill=(255, 80, 200, 190), width=2); y += k; k = int(k * 1.5) + 2
d.line((0, hz, W, hz), fill=(255, 210, 240, 255), width=3)
def chrome(text, size, pos):
    global im
    f = ImageFont.truetype(PD, size)
    mask = Image.new("L", (W, H)); ImageDraw.Draw(mask).text(pos, text, font=f, anchor="mm", fill=255)
    out = Image.new("L", (W, H)); ImageDraw.Draw(out).text(pos, text, font=f, anchor="mm", fill=255, stroke_width=size // 30, stroke_fill=255)
    im.paste((255, 60, 200), (0, 0), out.filter(ImageFilter.GaussianBlur(28)).point(lambda v: int(v * .85)))
    im.paste((14, 4, 30), (size // 40, size // 34), out); im.paste((14, 4, 30), (0, 0), out)
    bb = mask.getbbox(); fill = Image.new("RGB", (W, H)); fill.paste(grad(W, bb[3] - bb[1], [(0, (255, 255, 255)), (.4, (255, 225, 248)), (.62, (255, 110, 195)), (1, (255, 200, 120))]), (0, bb[1]))
    im.paste(fill, (0, 0), mask)
chrome("VICE AGENTS", 230, (840, 205))
f2 = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 34)
ImageDraw.Draw(im).text((840, 345), "Ten AI agents in Leonida. The map is the market.", font=f2, anchor="mm", fill=(255, 240, 250), stroke_width=3, stroke_fill=(30, 8, 50))
im.save(os.path.join(R, "x-banner-1500x500.png"))
