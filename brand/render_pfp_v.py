# X avatar: Pricedown "V" with chrome-pink fill, drop shadow and glow over a retro sunset + grid. Full-bleed square (X crops to a circle).
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import os, importlib.util
R = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(R)
spec = importlib.util.spec_from_file_location("b", os.path.join(R, "render_lowlife.py"))
N = 1000; PD = os.path.join(ROOT, "src/app/fonts/Pricedown.otf")
def grad(w, h, stops):
    g = Image.new("RGB", (1, h)); px = g.load()
    for y in range(h):
        t = y / (h - 1)
        for i in range(len(stops) - 1):
            (a, ca), (b, cb) = stops[i], stops[i + 1]
            if a <= t <= b: k = (t - a) / (b - a); px[0, y] = tuple(int(ca[j] + (cb[j] - ca[j]) * k) for j in range(3)); break
    return g.resize((w, h))
im = grad(N, N, [(0, (20, 8, 48)), (.45, (90, 24, 110)), (.68, (230, 70, 150)), (1, (255, 170, 120))])
# sun
r = 330; cx, cy = N // 2, 560
s = grad(2 * r, 2 * r, [(0, (255, 232, 130)), (.6, (255, 120, 120)), (1, (255, 50, 140))])
m = Image.new("L", (2 * r, 2 * r)); md = ImageDraw.Draw(m); md.ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
for i in range(7): y = int(r * 1.0 + i * r * 0.15); md.rectangle((0, y, 2 * r, y + 6 + i * 5), fill=0)
glow = Image.new("RGB", (N, N)); ImageDraw.Draw(glow).ellipse((cx - r - 60, cy - r - 60, cx + r + 60, cy + r + 60), fill=(255, 80, 160))
im = ImageChops.screen(im, glow.filter(ImageFilter.GaussianBlur(90)))
im.paste(s, (cx - r, cy - r), m)
# grid floor
hz = 790; d = ImageDraw.Draw(im, "RGBA"); d.rectangle((0, hz, N, N), fill=(25, 6, 50, 255))
for i in range(-12, 13): d.line((N // 2 + i * 40, hz, N // 2 + i * 260, N), fill=(255, 80, 200, 200), width=3)
y, k = hz, 8
while y < N: d.line((0, y, N, y), fill=(255, 80, 200, 200), width=3); y += k; k = int(k * 1.45) + 2
d.line((0, hz, N, hz), fill=(255, 210, 240, 255), width=4)
# the V
f = ImageFont.truetype(PD, 880); pos = (N // 2, 470)
mask = Image.new("L", (N, N)); ImageDraw.Draw(mask).text(pos, "V", font=f, anchor="mm", fill=255)
out = Image.new("L", (N, N)); ImageDraw.Draw(out).text(pos, "V", font=f, anchor="mm", fill=255, stroke_width=26, stroke_fill=255)
neon = Image.new("RGB", (N, N), (255, 60, 200)); im.paste(neon, (0, 0), out.filter(ImageFilter.GaussianBlur(40)).point(lambda v: int(v * .9)))
im.paste((14, 4, 30), (22, 26), out)  # drop shadow
im.paste((14, 4, 30), (0, 0), out)
fill = grad(N, N, [(0, (255, 255, 255)), (.32, (255, 236, 250)), (.5, (255, 150, 215)), (.62, (255, 95, 180)), (1, (255, 200, 120))])
im.paste(fill, (0, 0), mask)
hl = Image.new("L", (N, N)); ImageDraw.Draw(hl).rectangle((0, 0, N, 300), fill=90); hl = ImageChops.multiply(hl, mask)
im.paste((255, 255, 255), (0, 0), hl)
im.save(os.path.join(R, "pfp-1000.png"))
