"""Generate the app icon (neobrutalist card motif) as PNG + ICO with Pillow."""
from PIL import Image, ImageDraw

S = 1024
INK = (20, 20, 20, 255)
PINK = (255, 144, 232, 255)
YELLOW = (255, 201, 0, 255)
CREAM = (253, 246, 236, 255)
WHITE = (255, 255, 255, 255)


def rrect(d, box, r, fill, outline=None, width=0):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

m = int(S * 0.085)
bw = int(S * 0.055)

# base card — pink
rrect(d, (m, m, S - m, S - m), int(S * 0.14), PINK, INK, bw)

# hard offset shadow rectangle peeking behind (draw first behind? simulate with a second card)
# stacked document
doc_m = int(S * 0.26)
off = int(S * 0.055)
# back doc (yellow)
rrect(d, (doc_m + off, doc_m + off, S - doc_m + off, S - doc_m + off),
      int(S * 0.05), YELLOW, INK, int(bw * 0.8))
# front doc (white) with folded corner
fx0, fy0, fx1, fy1 = doc_m, doc_m, S - doc_m, S - doc_m
fold = int(S * 0.14)
rrect(d, (fx0, fy0, fx1, fy1), int(S * 0.05), WHITE, INK, int(bw * 0.8))
# fold triangle top-right
d.polygon([(fx1 - fold, fy0), (fx1, fy0), (fx1, fy0 + fold)], fill=CREAM, outline=INK, width=int(bw * 0.7))
# lines on the doc
lx0 = fx0 + int(S * 0.06)
lx1 = fx1 - int(S * 0.06)
for i, ly in enumerate(range(fy0 + int(S * 0.10), fy1 - int(S * 0.04), int(S * 0.075))):
    end = lx1 if i % 2 == 0 else lx1 - int(S * 0.10)
    d.line((lx0, ly, end, ly), fill=INK, width=int(S * 0.028))

png = img.resize((512, 512), Image.LANCZOS)
png.save("build/icon.png")
img.resize((256, 256), Image.LANCZOS).save(
    "build/icon.ico",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("wrote build/icon.png and build/icon.ico")
