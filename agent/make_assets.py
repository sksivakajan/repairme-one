"""Makes the app icon and installer artwork from the RepairMe logo (../public/brand/repairme-logo-transparent.png).

Run once after the logo changes:  python make_assets.py
Writes assets/repairme.ico, assets/repairme-64.png and assets/wordmark-header.png.
"""
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
LOGO = HERE.parent / 'public' / 'brand' / 'repairme-logo-transparent.png'
OUT = HERE / 'assets'
EMBLEM_BOX = (20, 195, 470, 685)  # the house, wrench and lightning mark, without the lettering
WORDMARK_BOX = (20, 195, 1730, 685)


def tile(emblem: Image.Image, size: int) -> Image.Image:
    """The emblem on a white rounded square, so it reads on light and dark taskbars."""
    scale = 4  # draw large, then shrink for smooth edges
    big = size * scale
    canvas = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * 0.22), fill=(255, 255, 255, 255))
    draw.rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * 0.22), outline=(225, 229, 235, 255), width=max(1, scale))
    inner = int(big * 0.72)
    mark = emblem.copy()
    mark.thumbnail((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(mark, ((big - mark.width) // 2, (big - mark.height) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    logo = Image.open(LOGO).convert('RGBA')
    emblem = logo.crop(EMBLEM_BOX)
    sizes = [16, 24, 32, 48, 64, 128, 256]
    tile(emblem, 256).save(OUT / 'repairme.ico', sizes=[(s, s) for s in sizes])
    tile(emblem, 64).save(OUT / 'repairme-64.png')
    word = logo.crop(WORDMARK_BOX)
    word.thumbnail((300, 52), Image.LANCZOS)
    header = Image.new('RGBA', word.size, (255, 255, 255, 255))
    header.alpha_composite(word)
    header.convert('RGB').save(OUT / 'wordmark-header.png')
    print('wrote', ', '.join(p.name for p in sorted(OUT.iterdir())))


if __name__ == '__main__':
    main()
