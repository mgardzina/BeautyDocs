"""Convert recorded media (scripts/platform-media/out) into web assets in public/platforma."""

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "scripts" / "platform-media" / "out"
TARGET = ROOT / "public" / "platforma"
TARGET.mkdir(parents=True, exist_ok=True)

for png in sorted(SOURCE.glob("*.png")):
    image = Image.open(png).convert("RGB")
    if image.width > 2400:  # 2x of the largest on-page size is plenty
        image = image.resize((2400, round(image.height * 2400 / image.width)), Image.LANCZOS)
    out = TARGET / png.with_suffix(".webp").name
    image.save(out, "WEBP", quality=80, method=6)
    print(f"{out.relative_to(ROOT)}  {image.size[0]}x{image.size[1]}  {out.stat().st_size // 1024} KB")

for video in sorted(SOURCE.glob("*.webm")):
    shutil.copy2(video, TARGET / video.name)
    print(f"{(TARGET / video.name).relative_to(ROOT)}  {video.stat().st_size // 1024} KB")
