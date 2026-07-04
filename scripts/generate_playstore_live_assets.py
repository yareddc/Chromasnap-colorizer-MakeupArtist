from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
PLAYSTORE = ROOT / "android" / "playstore"

PHONE_SIZE = (1080, 1920)
TABLET7_SIZE = (1200, 1920)
TABLET10_SIZE = (1600, 2560)
FEATURE_SIZE = (1024, 500)

# Reuse existing output paths that Play Console upload scripts already reference.
TARGETS = {
    "phone": [
        PLAYSTORE / "screenshots" / "phone" / "play-phone-01-upload.png",
        PLAYSTORE / "screenshots" / "phone" / "play-phone-02-result.png",
        PLAYSTORE / "screenshots" / "phone" / "play-phone-03-focus.png",
    ],
    "tablet7": [
        PLAYSTORE / "screenshots" / "7inch" / "play-tablet7-01-upload.png",
        PLAYSTORE / "screenshots" / "7inch" / "play-tablet7-02-result.png",
        PLAYSTORE / "screenshots" / "7inch" / "play-tablet7-03-focus.png",
    ],
    "tablet10": [
        PLAYSTORE / "screenshots" / "10inch" / "play-tablet10-01-upload.png",
        PLAYSTORE / "screenshots" / "10inch" / "play-tablet10-02-result.png",
        PLAYSTORE / "screenshots" / "10inch" / "play-tablet10-03-focus.png",
    ],
    "feature": [
        PLAYSTORE / "feature-graphics" / "play-feature-graphic-inapp-01.png",
    ],
}

SOURCE_IMAGES = {
    "upload": PUBLIC / "bw_smoke_test.jpg",
    "colorized": PUBLIC / "colorized_eritrean_man.png",
    "beauty": PUBLIC / "e2e_beauty_virtual_makeup.png",
    "barbershop": PUBLIC / "e2e_barbershop_after.png",
    "outfit1": PUBLIC / "e2e_outfit_primary.png",
    "outfit2": PUBLIC / "e2e_outfit_look1.png",
}


def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if bold:
        candidates += [
            "C:/Windows/Fonts/segoeuib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
        ]
    else:
        candidates += [
            "C:/Windows/Fonts/segoeui.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ]
    for fp in candidates:
        path = Path(fp)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def _gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return img


def _cover_resize(src: Image.Image, target_w: int, target_h: int) -> Image.Image:
    sw, sh = src.size
    scale = max(target_w / sw, target_h / sh)
    nw = int(sw * scale)
    nh = int(sh * scale)
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - target_w) // 2
    top = (nh - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def _rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return m


def _draw_screenshot(size: tuple[int, int], title: str, subtitle: str, source_path: Path, accent: tuple[int, int, int]) -> Image.Image:
    canvas = _gradient(size, (14, 22, 33), (28, 42, 58)).convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    w, h = size
    frame_w = int(w * 0.84)
    frame_h = int(h * 0.72)
    frame_x = (w - frame_w) // 2
    frame_y = int(h * 0.15)

    # Soft glow for visual depth.
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle(
        (frame_x - 16, frame_y - 16, frame_x + frame_w + 16, frame_y + frame_h + 16),
        radius=int(w * 0.04),
        fill=(accent[0], accent[1], accent[2], 90),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=int(w * 0.02)))
    canvas.alpha_composite(glow)

    panel = Image.new("RGBA", (frame_w, frame_h), (245, 248, 252, 255))
    pmask = _rounded_mask((frame_w, frame_h), radius=int(w * 0.04))

    src = Image.open(source_path).convert("RGB")
    art_h = int(frame_h * 0.78)
    art = _cover_resize(src, frame_w, art_h)
    panel.paste(art, (0, 0))

    pd = ImageDraw.Draw(panel)
    chip_h = int(frame_h * 0.10)
    chip_w = int(frame_w * 0.42)
    chip_x = int(frame_w * 0.04)
    chip_y = art_h - chip_h - int(frame_h * 0.03)
    pd.rounded_rectangle((chip_x, chip_y, chip_x + chip_w, chip_y + chip_h), radius=chip_h // 2, fill=(12, 21, 31, 220))
    chip_font = _load_font(max(26, int(h * 0.022)), bold=True)
    pd.text((chip_x + int(chip_h * 0.45), chip_y + int(chip_h * 0.25)), "LIVE PREVIEW", fill=(240, 244, 248), font=chip_font)

    body_title = _load_font(max(36, int(h * 0.032)), bold=True)
    body_sub = _load_font(max(24, int(h * 0.020)))
    pd.text((int(frame_w * 0.06), int(art_h + frame_h * 0.05)), title, fill=(15, 26, 37), font=body_title)
    pd.text((int(frame_w * 0.06), int(art_h + frame_h * 0.13)), subtitle, fill=(62, 74, 89), font=body_sub)

    canvas.paste(panel, (frame_x, frame_y), pmask)

    top_font = _load_font(max(32, int(h * 0.027)), bold=True)
    sub_font = _load_font(max(21, int(h * 0.018)))
    draw.text((int(w * 0.08), int(h * 0.05)), "ChromaSnap", fill=(214, 226, 240), font=top_font)
    draw.text((int(w * 0.08), int(h * 0.09)), "AI Colorizer and Studio", fill=(173, 188, 204), font=sub_font)

    return canvas.convert("RGB")


def _draw_feature_graphic(size: tuple[int, int]) -> Image.Image:
    w, h = size
    bg = _gradient(size, (10, 20, 31), (24, 44, 62)).convert("RGBA")
    d = ImageDraw.Draw(bg)

    # Headline
    title_font = _load_font(64, bold=True)
    sub_font = _load_font(30)
    d.text((48, 52), "ChromaSnap Live Studio", fill=(232, 239, 246), font=title_font)
    d.text((50, 126), "Real in-app previews: colorize, beauty, barbershop, outfit.", fill=(175, 193, 210), font=sub_font)

    preview_sources = [
        SOURCE_IMAGES["colorized"],
        SOURCE_IMAGES["beauty"],
        SOURCE_IMAGES["barbershop"],
        SOURCE_IMAGES["outfit1"],
    ]

    card_w = 195
    card_h = 300
    gap = 22
    start_x = 50
    y = 170

    for i, src_path in enumerate(preview_sources):
        x = start_x + i * (card_w + gap)
        card = Image.new("RGBA", (card_w, card_h), (248, 251, 255, 255))
        mask = _rounded_mask((card_w, card_h), 26)
        src = Image.open(src_path).convert("RGB")
        art = _cover_resize(src, card_w, int(card_h * 0.77))
        card.paste(art, (0, 0))
        cd = ImageDraw.Draw(card)
        labels = ["Colorize", "Beauty", "Barbershop", "Outfit"]
        cf = _load_font(24, bold=True)
        cd.text((14, int(card_h * 0.82)), labels[i], fill=(20, 30, 43), font=cf)

        shadow = Image.new("RGBA", (card_w + 20, card_h + 20), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.rounded_rectangle((10, 10, card_w + 10, card_h + 10), radius=28, fill=(0, 0, 0, 90))
        shadow = shadow.filter(ImageFilter.GaussianBlur(8))

        bg.alpha_composite(shadow, (x - 10, y - 6))
        bg.paste(card, (x, y), mask)

    badge = Image.new("RGBA", (280, 68), (12, 23, 36, 220))
    badge_mask = _rounded_mask((280, 68), 34)
    bg.paste(badge, (720, 52), badge_mask)
    bd = ImageDraw.Draw(bg)
    bd.text((748, 72), "LIVE APP SHOTS", fill=(236, 243, 250), font=_load_font(26, bold=True))

    return bg.convert("RGB")


def main() -> None:
    required = [
        SOURCE_IMAGES["upload"],
        SOURCE_IMAGES["colorized"],
        SOURCE_IMAGES["beauty"],
        SOURCE_IMAGES["barbershop"],
        SOURCE_IMAGES["outfit1"],
        SOURCE_IMAGES["outfit2"],
    ]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise FileNotFoundError("Missing required source images:\n" + "\n".join(missing))

    scenes = [
        ("Upload your memory", "Start from old black and white photos", SOURCE_IMAGES["upload"], (57, 130, 255)),
        ("AI colorized result", "Instant natural tones and restored detail", SOURCE_IMAGES["colorized"], (12, 177, 131)),
        ("Style tools", "Beauty, barbershop, and outfit generation", SOURCE_IMAGES["beauty"], (238, 101, 55)),
    ]

    for target in TARGETS["phone"]:
        target.parent.mkdir(parents=True, exist_ok=True)
    for target in TARGETS["tablet7"]:
        target.parent.mkdir(parents=True, exist_ok=True)
    for target in TARGETS["tablet10"]:
        target.parent.mkdir(parents=True, exist_ok=True)
    for target in TARGETS["feature"]:
        target.parent.mkdir(parents=True, exist_ok=True)

    sizes = [
        (PHONE_SIZE, TARGETS["phone"]),
        (TABLET7_SIZE, TARGETS["tablet7"]),
        (TABLET10_SIZE, TARGETS["tablet10"]),
    ]

    for size, target_group in sizes:
        for idx, target in enumerate(target_group):
            title, subtitle, src, accent = scenes[idx]
            out = _draw_screenshot(size, title, subtitle, src, accent)
            out.save(target, format="PNG", optimize=True)
            print(f"Wrote {target.relative_to(ROOT)} {out.size}")

    fg = _draw_feature_graphic(FEATURE_SIZE)
    fg.save(TARGETS["feature"][0], format="PNG", optimize=True)
    print(f"Wrote {TARGETS['feature'][0].relative_to(ROOT)} {fg.size}")


if __name__ == "__main__":
    main()
