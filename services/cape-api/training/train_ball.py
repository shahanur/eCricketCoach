"""Fine-tune YOLOv11-Nano for cricket-ball detection (spec §10) and install it as weights/ball.pt.

Usage (from services/cape-api/):
    python -m training.train_ball --data datasets/ball --epochs 150 --device 0 [--export onnx|engine]
Requires the `ultralytics` package (already in requirements.txt) and ideally a CUDA GPU.
"""

from __future__ import annotations

import argparse
import shutil
import tempfile
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
DATASET_YAML = HERE / "ball.yaml"
DEFAULT_WEIGHTS_OUT = HERE.parent / "weights" / "ball.pt"

# Spec §10.2 augmentations.
AUGMENT = {
    "hsv_h": 0.015,  # hue shift: red / white / pink balls
    "hsv_s": 0.5,
    "hsv_v": 0.4,  # sun glare vs floodlights
    "scale": 0.2,  # 0.8x – 1.2x zoom
    "mosaic": 1.0,  # 4-image mosaic for small objects on busy backgrounds
    "fliplr": 0.5,  # left/right-handed batters, both ends
    "flipud": 0.0,
    "degrees": 0.0,
}


def dataset_config(data_root: Path) -> Path:
    """Write a copy of ball.yaml with `path` set to the absolute dataset root."""
    cfg = yaml.safe_load(DATASET_YAML.read_text(encoding="utf-8"))
    cfg["path"] = str(Path(data_root).resolve())
    for split in ("train", "val", "test"):
        if not (Path(cfg["path"]) / cfg[split]).is_dir():
            raise FileNotFoundError(f"missing {split} split under {cfg['path']} (run training.split_dataset)")
    tmp = Path(tempfile.mkdtemp(prefix="cape-ball-")) / "ball.yaml"
    tmp.write_text(yaml.safe_dump(cfg, sort_keys=False), encoding="utf-8")
    return tmp


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--data", type=Path, default=HERE.parent / "datasets" / "ball", help="split dataset root")
    ap.add_argument("--model", default="yolo11n.pt")
    ap.add_argument("--imgsz", type=int, default=1280, help="large input keeps the small ball detectable")
    ap.add_argument("--epochs", type=int, default=150)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--patience", type=int, default=30)
    ap.add_argument("--device", default="0", help="'0', '0,1' or 'cpu'")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--project", type=Path, default=HERE / "runs")
    ap.add_argument("--name", default="ball")
    ap.add_argument("--out", type=Path, default=DEFAULT_WEIGHTS_OUT, help="where to install best.pt")
    ap.add_argument("--export", choices=("onnx", "engine"), help="also export best.pt (engine = TensorRT FP16)")
    a = ap.parse_args(argv)

    from ultralytics import YOLO

    model = YOLO(a.model)
    model.train(
        data=str(dataset_config(a.data)),
        imgsz=a.imgsz,
        epochs=a.epochs,
        batch=a.batch,
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
    metrics = trained.val(data=str(dataset_config(a.data)), split="test", imgsz=a.imgsz, device=a.device)
    print(f"test mAP50={metrics.box.map50:.3f} mAP50-95={metrics.box.map:.3f}")

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
