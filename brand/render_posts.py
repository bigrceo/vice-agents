# X post cards: one per agent + teaser + countdown. Run from repo root: python3 brand/render_posts.py
import json, os, re, sys
sys.path.insert(0, "brand")
from render_lowlife import grad, sun, SUNSET, PD
from PIL import Image, ImageDraw, ImageFont
AR = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"; AI = "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf"
src = open("src/lib/agents/cast.ts").read()
cast = [dict(zip(("name", "role", "color", "home", "bio"), m)) for m in re.findall(r'name: "([^"]+)", role: "([^"]+)", color: "([^"]+)", home: "([^"]+)",\s*\n\s*bio: "([^"]+)"', src)]
def wrap(d, text, font, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) > width: lines.append(cur); cur = w
        else: cur = t
    return lines + [cur]
def card(title, kicker, body, path, accent="#ffe17a", face=None):
    W, H = 1200, 675; im = grad(W, H, SUNSET)
    if face:
        ph = Image.open(face).convert("RGB"); ph = ph.resize((int(H * ph.width / ph.height), H)); im.paste(ph, (W - ph.width, 0))
        fade = Image.new("L", (260, H)); [ImageDraw.Draw(fade).line((x, 0, x, H), fill=int(255 * (1 - x / 259))) for x in range(260)]
        im.paste(grad(260, H, SUNSET), (W - ph.width, 0), fade)
    else: sun(im, 930, 420, 230)
    d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle((50, 60, 700, 615), 28, fill=(13, 7, 32, 200))
    d.text((90, 100), kicker.upper(), font=ImageFont.truetype(AR, 26), fill=accent)
    y = 140
    for ln in wrap(d, title.upper(), ImageFont.truetype(PD, 78), 560): d.text((88, y), ln, font=ImageFont.truetype(PD, 78), fill="white"); y += 82
    y += 16
    for ln in wrap(d, body, ImageFont.truetype(AR, 30), 560): d.text((90, y), ln, font=ImageFont.truetype(AR, 30), fill=(255, 235, 220)); y += 40
    d.text((90, 570), "LEONIDA · ROBINHOOD CHAIN", font=ImageFont.truetype(AR, 20), fill=(255, 255, 255, 160))
    im.save(path, quality=92)
os.makedirs("brand/x-posts", exist_ok=True)
IDS = ["dez", "ray", "sloane", "kiki", "hollis", "vince", "marisol", "tex", "doc", "lou"]
for i, a in enumerate(cast): card(a["name"], f'{a["role"]} · {a["home"]}', a["bio"], f'brand/x-posts/agent-{i+1:02d}.jpg', a["color"], f"public/agents/{IDS[i]}-full.jpg")
card("Ten locals. Ten wallets.", "Coming to Leonida", "A dealer, a cop, a fired trader, an influencer and six more. They walk the map, talk, and trade.", "brand/x-posts/teaser.jpg")
card("Who blows up first?", "Leaderboard opens soon", "Every agent starts with the same bag. Every trade comes with a reason. One of them will be broke by Friday.", "brand/x-posts/leaderboard-teaser.jpg")
card("They never sleep.", "Live 24/7", "While Leonida sleeps, the locals are still trading. Real prices, read on Robinhood Chain every two minutes.", "brand/x-posts/never-sleep.jpg")
print(len(cast), "agents")
