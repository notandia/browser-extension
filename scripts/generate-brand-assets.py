#!/usr/bin/env python3
"""Generate the committed Notandia vector and raster identity assets."""

from __future__ import annotations

import io
import math
import subprocess
from pathlib import Path

from cairosvg import svg2png
from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "docs" / "brand"
ICONS = ROOT / "icons"
STORE = ROOT / "store" / "assets"
for directory in (BRAND, ICONS, STORE):
    directory.mkdir(parents=True, exist_ok=True)

INK = "#12263F"
INK_DARK = "#0B1728"
PAPER = "#F8FAFC"
AMBER = "#FFC857"
MUTED = "#48627A"


def svg_wrap(inner: str, viewbox: str = "0 0 1024 1024", title: str = "Notandia") -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" role="img" aria-labelledby="title desc">
  <title id="title">{title}</title>
  <desc id="desc">A geometric N with a highlighted note point, representing scholarly context worth noticing.</desc>
  {inner}
</svg>\n'''


def symbol_inner(
    background: str = INK,
    foreground: str = PAPER,
    accent: str = AMBER,
    include_background: bool = True,
) -> str:
    background_element = (
        f'<rect x="64" y="64" width="896" height="896" rx="224" fill="{background}"/>'
        if include_background
        else ""
    )
    return f'''{background_element}
  <path d="M292 736V304" fill="none" stroke="{foreground}" stroke-width="128" stroke-linecap="round"/>
  <path d="M326 700L704 324" fill="none" stroke="{foreground}" stroke-width="128" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M748 414V736" fill="none" stroke="{foreground}" stroke-width="128" stroke-linecap="round"/>
  <circle cx="748" cy="286" r="82" fill="{accent}"/>'''


def inter_font_path() -> str:
    result = subprocess.run(
        ["fc-match", "Inter Display:style=SemiBold", "-f", "%{file}"],
        check=True,
        capture_output=True,
        text=True,
    )
    path = result.stdout.strip()
    if not path:
        raise RuntimeError("Inter Display SemiBold was not found")
    return path


def outlined_text(text: str, origin_x: float, baseline_y: float, size: float, fill: str) -> tuple[str, float]:
    font = TTFont(inter_font_path())
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    units = font["head"].unitsPerEm
    scale = size / units
    x = 0.0
    paths: list[str] = []
    for character in text:
        glyph_name = cmap[ord(character)]
        pen = SVGPathPen(glyph_set)
        transformed = TransformPen(
            pen,
            Transform(scale, 0, 0, -scale, origin_x + x, baseline_y),
        )
        glyph_set[glyph_name].draw(transformed)
        commands = pen.getCommands()
        if commands:
            paths.append(f'<path d="{commands}" fill="{fill}"/>')
        advance, _ = hmtx[glyph_name]
        x += advance * scale
    return "\n  ".join(paths), x


def write_vectors() -> tuple[str, str]:
    symbol = svg_wrap(symbol_inner())
    (BRAND / "notandia-symbol.svg").write_text(symbol, encoding="utf-8")
    (BRAND / "notandia-symbol-transparent.svg").write_text(
        svg_wrap(symbol_inner(foreground=INK, accent=AMBER, include_background=False)),
        encoding="utf-8",
    )
    (BRAND / "notandia-symbol-mono-dark.svg").write_text(
        svg_wrap(symbol_inner(background=INK, foreground=PAPER, accent=PAPER)),
        encoding="utf-8",
    )
    (BRAND / "notandia-symbol-mono-light.svg").write_text(
        svg_wrap(symbol_inner(background=PAPER, foreground=INK, accent=INK)),
        encoding="utf-8",
    )

    wordmark_paths, wordmark_width = outlined_text("Notandia", 0, 260, 244, INK)
    wordmark = svg_wrap(wordmark_paths, f"0 0 {math.ceil(wordmark_width)} 300", "Notandia wordmark")
    (BRAND / "notandia-wordmark.svg").write_text(wordmark, encoding="utf-8")

    horizontal_paths, horizontal_width = outlined_text("Notandia", 300, 268, 244, INK)
    horizontal_view_width = math.ceil(320 + horizontal_width)
    horizontal_inner = f'''<g transform="scale(0.25)">{symbol_inner()}</g>
  {horizontal_paths}'''
    horizontal = svg_wrap(horizontal_inner, f"0 0 {horizontal_view_width} 300")
    (BRAND / "notandia-lockup-horizontal.svg").write_text(horizontal, encoding="utf-8")

    dark_paths, _ = outlined_text("Notandia", 300, 268, 244, PAPER)
    dark_inner = f'''<rect width="{horizontal_view_width}" height="300" rx="40" fill="{INK_DARK}"/>
  <g transform="scale(0.25)">{symbol_inner(background=PAPER, foreground=INK, accent=AMBER)}</g>
  {dark_paths}'''
    (BRAND / "notandia-lockup-horizontal-dark.svg").write_text(
        svg_wrap(dark_inner, f"0 0 {horizontal_view_width} 300"),
        encoding="utf-8",
    )

    stacked_width = max(1024, math.ceil(wordmark_width) + 100)
    stacked_paths, _ = outlined_text(
        "Notandia", (stacked_width - wordmark_width) / 2, 1260, 244, INK
    )
    stacked_inner = f'''<g transform="translate({(stacked_width - 720) / 2} 0) scale(0.703125)">{symbol_inner()}</g>
  {stacked_paths}'''
    (BRAND / "notandia-lockup-stacked.svg").write_text(
        svg_wrap(stacked_inner, f"0 0 {stacked_width} 1320"),
        encoding="utf-8",
    )
    return symbol, horizontal


def write_rasters(symbol: str) -> None:
    for size in (16, 32, 48, 64, 96, 128, 256, 300, 512, 1024):
        data = svg2png(bytestring=symbol.encode(), output_width=size, output_height=size)
        if size in (16, 32, 48, 64, 96, 128, 256, 512):
            (ICONS / f"icon-{size}.png").write_bytes(data)
        (STORE / f"notandia-icon-{size}.png").write_bytes(data)

    for size, filename in ((180, "apple-touch-icon.png"), (32, "favicon-32.png"), (16, "favicon-16.png")):
        data = svg2png(bytestring=symbol.encode(), output_width=size, output_height=size)
        (BRAND / filename).write_bytes(data)


def write_review_sheet(horizontal: str) -> None:
    canvas = Image.new("RGB", (1400, 900), "white")
    draw = ImageDraw.Draw(canvas)
    draw.text((60, 40), "Notandia identity review", fill=INK)

    lockup_png = svg2png(bytestring=horizontal.encode(), output_width=900)
    lockup = Image.open(io.BytesIO(lockup_png)).convert("RGBA")
    canvas.paste(lockup, (60, 90), lockup)

    for index, size in enumerate((16, 32, 48, 64, 96, 128)):
        image = Image.open(ICONS / f"icon-{size}.png").convert("RGBA")
        x = 60 + index * 190
        canvas.paste(image, (x, 400), image)
        draw.text((x, 545), f"{size}×{size} actual", fill=INK)
        resampling = Image.Resampling.NEAREST if size <= 32 else Image.Resampling.LANCZOS
        enlarged = image.resize((128, 128), resampling)
        canvas.paste(enlarged, (x, 590), enlarged)
        draw.text((x, 725), "enlarged", fill=MUTED)

    for index, (name, color) in enumerate(
        (("Ink", INK), ("Paper", PAPER), ("Note", AMBER), ("Muted", MUTED))
    ):
        x = 60 + index * 260
        draw.rounded_rectangle((x, 780, x + 100, 840), radius=12, fill=color, outline="#CDD5DF")
        draw.text((x + 115, 798), f"{name} {color}", fill=INK)
    canvas.save(BRAND / "notandia-brand-review.png")


def main() -> None:
    symbol, horizontal = write_vectors()
    write_rasters(symbol)
    write_review_sheet(horizontal)
    print("Generated Notandia vectors, extension icons, store exports, and review sheet")


if __name__ == "__main__":
    main()
