"""Convert a Label Studio JSON export into YOLO label files (boxes for the ball, polygons for the bat).

Usage (from cape-api/):
    python -m training.labelstudio_to_yolo export.json datasets/raw_bat/labels --classes training/bat.yaml
    python -m training.labelstudio_to_yolo --url http://localhost:8080 --project 1 --token <token> \
        datasets/raw_bat/labels --classes training/bat.yaml

Rectangles become `<cls> cx cy w h`, polygons `<cls> x1 y1 ...`, all normalised to 0-1. A submitted task with
no regions becomes an empty .txt (a background frame). Unfinished or skipped tasks are refused, because
split_dataset would otherwise treat the frame as "no object" (pass --allow-unlabelled to skip them instead).
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path, PurePosixPath

import yaml


def class_ids(dataset_yaml: Path) -> dict[str, int]:
    names = yaml.safe_load(Path(dataset_yaml).read_text(encoding="utf-8"))["names"]
    return {str(v): int(k) for k, v in names.items()}


def image_stem(image_ref: str) -> str:
    """`/data/local-files/?d=raw/images/x_000012.jpg` or `/data/upload/1/ab12-x_000012.jpg` -> `x_000012`."""
    parsed = urllib.parse.urlparse(image_ref)
    path = urllib.parse.parse_qs(parsed.query).get("d", [parsed.path])[0]
    return PurePosixPath(urllib.parse.unquote(path)).stem


def _clip(v: float) -> float:
    return min(1.0, max(0.0, v))


def region_line(region: dict, classes: dict[str, int]) -> str | None:
    kind, value = region.get("type"), region.get("value", {})
    labels = value.get(kind) or []
    if not labels:
        return None
    if labels[0] not in classes:
        raise ValueError(f"label {labels[0]!r} is not in the dataset classes {sorted(classes)}")
    cls = classes[labels[0]]
    if kind == "rectanglelabels":
        if value.get("rotation"):
            raise ValueError("rotated rectangles are not supported")
        x, y, w, h = (value[k] / 100 for k in ("x", "y", "width", "height"))
        cx, cy, w, h = _clip(x + w / 2), _clip(y + h / 2), _clip(w), _clip(h)
        return f"{cls} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"
    if kind == "polygonlabels":
        points = value.get("points") or []
        if len(points) < 3:
            return None
        return f"{cls} " + " ".join(f"{_clip(px / 100):.6f} {_clip(py / 100):.6f}" for px, py in points)
    return None


def task_lines(task: dict, classes: dict[str, int]) -> list[str] | None:
    """Label lines from the newest submitted annotation; None when the task has no usable annotation."""
    annotations = [a for a in task.get("annotations", []) if not a.get("was_cancelled")]
    if not annotations:
        return None
    latest = max(annotations, key=lambda a: (a.get("updated_at") or a.get("created_at") or "", a.get("id", 0)))
    return [line for region in latest.get("result", []) if (line := region_line(region, classes))]


def convert(tasks: list[dict], out: Path, classes: dict[str, int], allow_unlabelled: bool = False) -> dict[str, int]:
    pending = [image_stem(t["data"]["image"]) for t in tasks if task_lines(t, classes) is None]
    if pending and not allow_unlabelled:
        raise ValueError(f"{len(pending)} task(s) not labelled yet, e.g. {', '.join(pending[:5])}")
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    counts = {"labelled": 0, "background": 0, "objects": 0, "skipped": len(pending)}
    for task in tasks:
        lines = task_lines(task, classes)
        if lines is None:
            continue
        (out / f"{image_stem(task['data']['image'])}.txt").write_text(
            "".join(f"{line}\n" for line in lines), encoding="utf-8")
        counts["labelled"] += 1
        counts["background"] += not lines
        counts["objects"] += len(lines)
    return counts


def fetch_export(url: str, project: int, token: str) -> list[dict]:
    request = urllib.request.Request(
        f"{url.rstrip('/')}/api/projects/{project}/export?exportType=JSON&download_all_tasks=true",
        headers={"Authorization": f"Token {token}"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310 - local Label Studio URL
        return json.load(response)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("export", type=Path, nargs="?", help="Label Studio JSON export (or use --url/--project)")
    ap.add_argument("out", type=Path, help="labels folder to write, e.g. datasets/raw_bat/labels")
    ap.add_argument("--classes", type=Path, required=True, help="dataset yaml whose `names` give the class ids")
    ap.add_argument("--url", help="Label Studio base URL, e.g. http://localhost:8080")
    ap.add_argument("--project", type=int)
    ap.add_argument("--token", default=os.getenv("LABEL_STUDIO_TOKEN"), help="API token (or LABEL_STUDIO_TOKEN)")
    ap.add_argument("--allow-unlabelled", action="store_true", help="skip unfinished tasks instead of failing")
    a = ap.parse_args(argv)

    if a.url:
        if a.project is None or not a.token:
            ap.error("--url needs --project and --token")
        tasks = fetch_export(a.url, a.project, a.token)
    elif a.export:
        tasks = json.loads(a.export.read_text(encoding="utf-8"))
    else:
        ap.error("give an export file or --url")
    counts = convert(tasks, a.out, class_ids(a.classes), a.allow_unlabelled)
    print(" ".join(f"{k}={v}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
