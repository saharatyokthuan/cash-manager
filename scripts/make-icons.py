"""สร้างไอคอน PWA จากรูปกระเป๋าเงินบนแถบบนของแอป (path SVG ขนาด 24x24 เดียวกับใน index.html)

รัน: python3 scripts/make-icons.py  (ต้องมี Pillow)
"""
import math
import os
from PIL import Image, ImageDraw

BG = (5, 5, 10)            # --color-bg
ACCENT = (0, 255, 255)     # --accent (ธีม cyan)
ACCENT2 = (255, 0, 255)    # --accent2
SUPERSAMPLE = 4


def arc_points(cx, cy, r, start_deg, end_deg, steps=24):
    return [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
            for a in (start_deg + (end_deg - start_deg) * i / steps for i in range(steps + 1))]


# เส้นของไอคอนกระเป๋าเงิน (พิกัดในกริด 24x24 ตาม SVG ต้นฉบับ)
WALLET_STROKES = [
    # M20 12V8H6a2 2 0 0 1 0-4h12v4
    [(20, 12), (20, 8)] + arc_points(6, 6, 2, 90, 270) + [(18, 4), (18, 8)],
    # M4 6v12a2 2 0 0 0 2 2h14v-4
    [(4, 6)] + arc_points(6, 18, 2, 180, 90) + [(20, 20), (20, 16)],
    # M18 12a2 2 0 0 0 0 4h4v-4Z
    arc_points(18, 14, 2, 270, 90) + [(22, 16), (22, 12), (18, 12)],
]


def draw_icon(size, glyph_ratio, rounded):
    big = size * SUPERSAMPLE
    # พื้นหลังสีมืด (ไอคอนทั่วไปมุมมน, ไอคอน maskable เต็มขอบให้ระบบตัดเอง)
    bg_mask = Image.new('L', (big, big), 0)
    radius = int(big * 0.22) if rounded else 0
    ImageDraw.Draw(bg_mask).rounded_rectangle([0, 0, big - 1, big - 1], radius=radius, fill=255)

    # เส้นกระเป๋าเงินเป็น mask แล้วเติมสีไล่ระดับฟ้า→ชมพูตามธีมนีออน
    glyph = Image.new('L', (big, big), 0)
    draw = ImageDraw.Draw(glyph)
    scale = big * glyph_ratio / 20          # รูปจริงกว้างประมาณ 20 หน่วย (x 2-22)
    offset = (big - 24 * scale) / 2
    width = max(1, round(2 * scale))
    for stroke in WALLET_STROKES:
        pts = [(offset + x * scale, offset + y * scale) for x, y in stroke]
        draw.line(pts, fill=255, width=width)
        # จุดกลมทุกจุดต่อ = ปลายเส้นและมุมมน (stroke-linecap/linejoin: round) ไม่มีเส้นขนที่มุมโค้ง
        for x, y in pts:
            draw.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=255)

    gradient = Image.new('RGB', (big, big))
    gpx = gradient.load()
    for y in range(big):
        for x in range(big):
            t = (x + y) / (2 * (big - 1))
            gpx[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(ACCENT, ACCENT2))

    icon = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    icon.paste(Image.new('RGB', (big, big), BG), (0, 0), bg_mask)
    icon.paste(gradient, (0, 0), glyph)
    return icon.resize((size, size), Image.LANCZOS)


def main():
    out = os.path.join(os.path.dirname(__file__), '..', 'icons')
    os.makedirs(out, exist_ok=True)
    # maskable: เก็บรูปไว้ในวงกลมปลอดภัย 80% ตรงกลาง เพราะ Android ตัดขอบเป็นวงกลม/ทรงอื่น
    for name, size, ratio, rounded in [
        ('icon-192.png', 192, 0.62, True),
        ('icon-512.png', 512, 0.62, True),
        ('icon-maskable-512.png', 512, 0.5, False),
        ('apple-touch-icon.png', 180, 0.6, False),   # iOS ทำมุมมนให้เอง
    ]:
        draw_icon(size, ratio, rounded).save(os.path.join(out, name), optimize=True)
        print('wrote', name)


if __name__ == '__main__':
    main()
