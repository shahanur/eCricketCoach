"""Fine-tune YOLOv11-Nano-Seg for cricket-bat segmentation and install it as weights/bat-seg.pt.

Usage (from cape-api/):
    python -m training.split_dataset datasets/raw_bat datasets/bat
    python -m training.train_bat --data datasets/bat --epochs 150 --device 0 [--export onnx|engine]
Labels are YOLO segmentation polygons (`0 x1 y1 x2 y2 ...`, normalised); a frame with no bat has an empty
or missing .txt. The installed model is single-class, which models.bat.YoloBatSegmenter treats as "every
mask is a bat". Requires `ultralytics` and ideally a CUDA GPU.
"""

from __future__ import annotations

import argparse
import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
DATASET_YAML = HERE / "bat.yaml"
DEFAULT_WEIGHTS_OUT = HERE.parent / "weights" / "bat-seg.pt"
SPLITS = ("train", "val", "test")

AUGMENT = {
    "hsv_h": 0.015,
    "hsv_s": 0.5,
    "hsv_v": 0.4,  # sun glare vs floodlights
    "scale": 0.3,
    "degrees": 10.0,  # the bat is seen at every angle through the swing
    "mosaic": 1.0,
    "fliplr": 0.5,  # left/right-handed batters
    "flipud": 0.0,
}


@dataclass
class LabelReport:
    images: int = 0
    with_bat: int = 0
    polygons: int = 0
    errors: list[str] = field(default_factory=list)


def check_seg_labels(split_root: Path, num_classes: int = 1, max_errors: int = 20) -> LabelReport:
    """Check <split_root>/labels/*.txt are YOLO polygons, not detection boxes (the usual export mistake)."""
    images = Path(split_root) / "images"
    labels = Path(split_root) / "labels"
    report = LabelReport()
    for img in sorted(images.iterdir()) if images.is_dir() else []:
        if img.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
            continue
        report.images += 1
        label = labels / f"{img.stem}.txt"
        if not label.exists():
            continue
        found = 0
        for n, line in enumerate(label.read_text(encoding="utf-8").splitlines(), 1):
            parts = line.split()
            if not parts:
                continue
            where = f"{label.name}:{n}"
            try:
                cls, coords = int(parts[0]), [float(v) for v in parts[1:]]
            except ValueError:
                report.errors.append(f"{where}: not numbers")
                continue
            if not 0 <= cls < num_classes:
                report.errors.append(f"{where}: class {cls} (expected 0..{num_classes - 1})")
            elif len(coords) == 4:
                report.errors.append(f"{where}: looks like a box; export polygons (YOLO segmentation)")
            elif len(coords) < 6 or len(coords) % 2:
                report.errors.append(f"{where}: polygon needs >= 3 x,y pairs")
            elif any(not 0.0 <= v <= 1.0 for v in coords):
                report.errors.append(f"{where}: coordinates must be normalised to 0-1")
            else:
                found += 1
        report.polygons += found
        report.with_bat += found > 0
    del report.errors[max_errors:]
    return report


def dataset_config(data_root: Path) -> Path:
    """Write a copy of bat.yaml with `path` set to the absolute dataset root."""
    cfg = yaml.safe_load(DATASET_YAML.read_text(encoding="utf-8"))
    cfg["path"] = str(Path(data_root).resolve())
    for split in SPLITS:
        if not (Path(cfg["path"]) / cfg[split]).is_dir():
            raise FileNotFoundError(f"missing {split} split under {cfg['path']} (run training.split_dataset)")
    tmp = Path(tempfile.mkdtemp(prefix="cape-bat-")) / "bat.yaml"
    tmp.write_text(yaml.safe_dump(cfg, sort_keys=False), encoding="utf-8")
    return tmp


def validate_dataset(data_root: Path) -> dict[str, LabelReport]:
    reports = {s: check_seg_labels(Path(data_root) / s) for s in SPLITS}
    errors = [e for r in reports.values() for e in r.errors]
    if errors:
        raise ValueError("bad bat labels:\n  " + "\n  ".join(errors))
    if reports["train"].with_bat == 0:
        raise ValueError("no bat polygons in the train split")
    return reports


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--data", type=Path, default=HERE.parent / "datasets" / "bat", help="split dataset root")
    ap.add_argument("--model", default="yolo11n-seg.pt")
    ap.add_argument("--imgsz", type=int, default=960)
    ap.add_argument("--epochs", type=int, default=150)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--patience", type=int, default=30)
    ap.add_argument("--device", default="0", help="'0', '0,1' or 'cpu'")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--project", type=Path, default=HERE / "runs")
    ap.add_argument("--name", default="bat")
    ap.add_argument("--out", type=Path, default=DEFAULT_WEIGHTS_OUT, help="where to install best.pt")
    ap.add_argument("--export", choices=("onnx", "engine"), help="also export best.pt (engine = TensorRT FP16)")
    a = ap.parse_args(argv)

    reports = validate_dataset(a.data)
    print(" ".join(f"{s}={r.images} images/{r.with_bat} with bat" for s, r in reports.items()))
    data_yaml = str(dataset_config(a.data))

    from ultralytics import YOLO

    model = YOLO(a.model)
    model.train(
        data=data_yaml,
        imgsz=a.imgsz,
        epochs=a.epochs,
        batch=a.batch,
        workers=a.workers,
        patience=a.patience,
        device=a.device,
        seed=a.seed,
        deterministic=True,
        project=str(a.project),
        name=a.name,
        exist_ok=True,
        **AUGMENT,
    )
    best = Path(model.trainer.save_dir) / "weights" / "best.pt"
    if not best.exists():
        raise SystemExit(f"training produced no {best}")

    trained = YOLO(str(best))
    metrics = trained.val(
        data=data_yaml,
        split="test",
        imgsz=a.imgsz,
        device=a.device,
        workers=a.workers,
    )
    print(f"test mask mAP50={metrics.seg.map50:.3f} mAP50-95={metrics.seg.map:.3f}")

    a.out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best, a.out)
    print(f"installed {a.out}")

    if a.export:
        exported = Path(trained.export(format=a.export, imgsz=a.imgsz, half=a.export == "engine", device=a.device))
        target = a.out.with_suffix(exported.suffix)
        shutil.copy2(exported, target)
        print(f"exported {target}")


if __name__ == "__main__":
    main()
