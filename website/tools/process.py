"""Turns assets-raw/*.png and captures/*.png into web-ready WebP in public/img/ and writes src/img-meta.json.

    python tools/process.py            everything
    python tools/process.py stone kit  only ids starting with these prefixes

Blur is baked in here, once, so the page never animates a blur filter: every depth-of-field effect on the
site is a cross-fade between a sharp file and its "-soft" twin, moved with transforms.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets-raw"
SHOTS = ROOT / "captures"
OUT = ROOT / "public" / "img"
META = ROOT / "src" / "img-meta.json"
OUT.mkdir(parents=True, exist_ok=True)

meta = json.loads(META.read_text()) if META.exists() else {}
only = sys.argv[1:]
# Generated or captured, looked at, and left out of the page. Their raw files stay in assets-raw/ and captures/.
UNUSED = {"boulder", "branch", "cairn", "snow", "kit-headlamp", "kit-plane", "shot-chat", "shot-history", "shot-settings", "shot-splash", "shot-detail", "shot-downloading", "shot-desktop"}
SOFT_ONLY = {"grass", "ridge"}  # only ever seen out of focus

wanted = lambda name: name not in UNUSED and (not only or any(name.startswith(p) for p in only))


def save(im, name, width=None, quality=82):
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    path = OUT / f"{name}.webp"
    im.save(path, "WEBP", quality=quality, method=6)
    meta[name] = {"w": im.width, "h": im.height}
    print(f"{name:20} {im.width:>4}x{im.height:<4} {path.stat().st_size // 1024:>4} KB")


def trim(im, pad=0.02):
    """Crop a cut-out to its visible pixels plus a small margin."""
    alpha = np.asarray(im)[..., 3]
    ys, xs = np.where(alpha > 12)
    m = round(pad * max(xs.max() - xs.min(), ys.max() - ys.min()))
    return im.crop((max(0, xs.min() - m), max(0, ys.min() - m), min(im.width, xs.max() + m + 1), min(im.height, ys.max() + m + 1)))


def soften(im, radius):
    """Gaussian blur that is correct for transparency (blurs premultiplied colour, so no dark fringe)."""
    if im.mode != "RGBA":
        return im.filter(ImageFilter.GaussianBlur(radius))
    pad = round(radius * 3)
    canvas = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad))
    arr = np.asarray(canvas).astype(np.float32) / 255
    pre = np.dstack([arr[..., :3] * arr[..., 3:], arr[..., 3:]])
    blurred = np.dstack([np.asarray(Image.fromarray((pre[..., c] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))) for c in range(4)]).astype(np.float32) / 255
    a = np.clip(blurred[..., 3:], 1e-4, 1)
    out = np.dstack([np.clip(blurred[..., :3] / a, 0, 1), blurred[..., 3:]])
    return Image.fromarray((out * 255).astype(np.uint8), "RGBA")


def from_black(im, floor=7, gamma=0.85):
    """A soft subject shot on black becomes a cut-out: brightness is the alpha, colour is un-darkened."""
    arr = np.asarray(im.convert("RGB")).astype(np.float32)
    peak = arr.max(axis=2)
    alpha = np.clip((peak - floor) / (255 - floor), 0, 1) ** gamma
    colour = np.clip(arr / np.maximum(peak, 1)[..., None] * 255, 0, 255)
    return Image.fromarray(np.dstack([colour, alpha * 255]).astype(np.uint8), "RGBA")


# ── Landscape plates ─────────────────────────────────────────────────────
for name in ["valley", "cloudsea", "dawn", "road", "camp-1", "camp-2", *[f"world-{i}" for i in range(1, 11)]]:
    if not wanted(name):
        continue
    im = Image.open(RAW / f"{name}.png").convert("RGB")
    if name == "dawn":  # mirrored, so the lit summit sits on the right and the words get the quiet side
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    save(im, name, 1672, 80)
    save(im, f"{name}-m", 960, 76)  # phones
    if name == "valley":
        save(im.filter(ImageFilter.GaussianBlur(2.4)), f"{name}-soft", 1672, 72)

# ── Cut-outs: one sharp, one out of focus ────────────────────────────────
for p in sorted(RAW.glob("*.png")):
    name = p.stem
    kind = "stone" if name.startswith("stone") else "kit" if name.startswith("kit") else "fore" if name in ("grass", "boulder", "branch", "cairn", "ridge") else None
    if not kind or not wanted(name):
        continue
    im = trim(Image.open(p).convert("RGBA"))
    size, blur = {"stone": (860, 16), "kit": (560, 14), "fore": (1100, 16)}[kind]
    im.thumbnail((size, size), Image.LANCZOS)
    if name not in SOFT_ONLY:
        save(im, name, quality=90)
    soft = soften(im, blur)
    soft.thumbnail((soft.width // 2, soft.height // 2), Image.LANCZOS)
    save(soft, f"{name}-soft", quality=78)

# ── Cloud, snow and light, lifted off their black backgrounds ────────────
for name, blur in [("mist-1", 0), ("mist-2", 0), ("mist-3", 0), ("mist-4", 12), ("lights", 0)]:
    if not wanted(name):
        continue
    im = from_black(Image.open(RAW / f"{name}.png"), gamma=1.0 if name == "lights" else 0.85)
    if blur:
        im = soften(im, blur)
    save(im, name, 900, 70)

# ── Real screenshots of the app ──────────────────────────────────────────
for p in sorted(SHOTS.glob("*.png")):
    name = f"shot-{p.stem}"
    if not wanted(name):
        continue
    im = Image.open(p).convert("RGB")
    save(im, name, 780, 92)
    save(im.resize((390, 844), Image.LANCZOS).filter(ImageFilter.GaussianBlur(9)), f"{name}-soft", 390, 70)

# ── Film grain, generated rather than photographed ───────────────────────
if wanted("grain"):
    rng = np.random.default_rng(7)
    noise = np.clip(rng.normal(128, 46, (160, 160)), 0, 255).astype(np.uint8)
    grain = Image.merge("LA", (Image.fromarray(noise), Image.fromarray(np.full((160, 160), 255, np.uint8))))
    grain.save(OUT / "grain.png", optimize=True)
    meta["grain"] = {"w": 160, "h": 160}

META.write_text(json.dumps(dict(sorted(meta.items())), indent=1))
