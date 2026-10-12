"""Deterministic 80/10/10 split of a YOLO images+labels folder, grouped by source video (spec §10.2).

Input:  <src>/images/<video>_<frame>.jpg and <src>/labels/<video>_<frame>.txt (labels optional = background).
Output: <out>/{train,val,test}/{images,labels}/...

Every frame of a source video goes to the same split so near-identical frames cannot leak
between train and val/test.
"""

from __future__ import annotations

import argparse
import random
import re
import shutil
from collections import defaultdict
from pathlib import Path

SPLITS = ("train", "val", "test")
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
DEFAULT_GROUP_PATTERN = r"^(?P<video>.+?)[_-](?:f(?:rame)?)?\d+$"


def group_key(stem: str, pattern: str = DEFAULT_GROUP_PATTERN) -> str:
    m = re.match(pattern, stem)
    return m.group("video") if m and "video" in m.groupdict() else (m.group(1) if m else stem)


def plan_split(
    images: list[Path],
    ratios: tuple[float, float, float] = (0.8, 0.1, 0.1),
    seed: int = 42,
    pattern: str = DEFAULT_GROUP_PATTERN,
) -> dict[str, list[Path]]:
    """Assign whole video groups to splits, largest first, to the split furthest below its target."""
    if len(ratios) != 3 or any(r < 0 for r in ratios) or sum(ratios) <= 0:
        raise ValueError("ratios must be three non-negative numbers")
    groups: dict[str, list[Path]] = defaultdict(list)
    for img in sorted(images, key=lambda p: p.name):
        groups[group_key(img.stem, pattern)].append(img)
    names = sorted(groups)
    random.Random(seed).shuffle(names)
    names.sort(key=lambda n: len(groups[n]), reverse=True)  # stable: seeded order breaks ties

    total = sum(len(v) for v in groups.values())
    targets = [r / sum(ratios) * total for r in ratios]
    plan: dict[str, list[Path]] = {s: [] for s in SPLITS}
    for name in names:
        deficits = [t - len(plan[s]) for s, t in zip(SPLITS, targets)]
        best = max(range(3), key=lambda i: (deficits[i], -i))
        plan[SPLITS[best]].extend(groups[name])
    return plan


def split_dataset(
    src: Path,
    out: Path,
    ratios: tuple[float, float, float] = (0.8, 0.1, 0.1),
    seed: int = 42,
    pattern: str = DEFAULT_GROUP_PATTERN,
    move: bool = False,
) -> dict[str, int]:
    src, out = Path(src), Path(out)
    images = [p for p in (src / "images").iterdir() if p.suffix.lower() in IMAGE_EXTS]
    if not images:
        raise FileNotFoundError(f"no images in {src / 'images'}")
    transfer = shutil.move if move else shutil.copy2
    plan = plan_split(images, ratios, seed, pattern)
    for split, files in plan.items():
        (out / split / "images").mkdir(parents=True, exist_ok=True)
        (out / split / "labels").mkdir(parents=True, exist_ok=True)
        for img in files:
            transfer(img, out / split / "images" / img.name)
            label = src / "labels" / f"{img.stem}.txt"
            if label.exists():
                transfer(label, out / split / "labels" / label.name)
    return {s: len(f) for s, f in plan.items()}


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("src", type=Path, help="folder with images/ and labels/")
    ap.add_argument("out", type=Path, help="output dataset root (ball.yaml `path`)")
    ap.add_argument("--ratios", type=float, nargs=3, default=(0.8, 0.1, 0.1))
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--group-pattern", default=DEFAULT_GROUP_PATTERN, help="regex on the file stem; group 'video'")
    ap.add_argument("--move", action="store_true", help="move instead of copy")
    a = ap.parse_args(argv)
    counts = split_dataset(a.src, a.out, tuple(a.ratios), a.seed, a.group_pattern, a.move)
    print(" ".join(f"{k}={v}" for k, v in counts.items()))
    if sum(counts.values()) < 2500:
        print(f"warning: {sum(counts.values())} frames; spec §10.2 asks for at least 2,500")


if __name__ == "__main__":
    main()
