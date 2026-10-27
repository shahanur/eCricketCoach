"""Deterministic faults, score and recommendations from `rules/coaching_rules.yaml` (spec §11.3–11.5)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from app.schemas import (
    LENGTH_ZONES_M,
    LINE_ZONES_M,
    AnalysisRequest,
    BowlerType,
    Coaching,
    Delivery,
    Fault,
    Severity,
    Target,
    line_offset_m,
)

RULES_PATH = Path(__file__).parent / "rules" / "coaching_rules.yaml"
_SEVERITY_ORDER = {Severity.high: 0, Severity.medium: 1, Severity.low: 2}
_TEXT_KEYS = ("code", "message", "recommendation", "drill", "verdict")
_PHASE_MILESTONES = frozenset({"pre_contact", "post_contact"})


def _validate_check(check: dict[str, Any], where: str) -> None:
    missing = [k for k in ("code", "milestone", "metric") if k not in check]
    if missing:
        raise ValueError(f"{where}: missing {missing}")
    if check.get("min") is None and check.get("max") is None:
        raise ValueError(f"{where}: needs min and/or max")
    for side in ("below", "above"):
        merged = {**check, **check.get(side, {})}
        if not all(merged.get(k) for k in ("message", "recommendation")):
            raise ValueError(f"{where}: missing message/recommendation for {side}")


@lru_cache(maxsize=4)
def load_rules(path: Path = RULES_PATH) -> dict[str, Any]:
    with open(path, encoding="utf-8") as fh:
        rules = yaml.safe_load(fh)
    for shot, checks in rules["batting"].items():
        for i, check in enumerate(checks):
            _validate_check(check, f"batting.{shot}[{i}]")
    for kind, checks in rules["bowling"].items():
        if kind != "delivery":
            for i, check in enumerate(checks):
                _validate_check(check, f"bowling.{kind}[{i}]")
    return rules


def _lookup(metrics: dict[str, float], milestone: str, metric: str) -> float | None:
    # Pre/post-contact checks must not fall back to the contact-frame value of the same metric.
    keys = (f"{milestone}.{metric}",) if milestone in _PHASE_MILESTONES else (f"{milestone}.{metric}", metric)
    for key in keys:
        value = metrics.get(key)
        if value is not None:
            return float(value)
    return None


def _severity(deviation_pct: float, bands: list[float]) -> Severity:
    if deviation_pct <= bands[0]:
        return Severity.low
    if deviation_pct <= bands[1]:
        return Severity.medium
    return Severity.high


def _strength(check: dict[str, Any], value: float) -> str | None:
    text = check.get("strength")
    return text.format(value=value) if text else None


def _pose_check(check: dict[str, Any], value: float, bands: list[float]) -> tuple[Fault | None, str | None]:
    lo, hi = check.get("min"), check.get("max")
    if lo is not None and value < lo:
        side, bound = "below", lo
    elif hi is not None and value > hi:
        side, bound = "above", hi
    else:
        return None, _strength(check, value)
    scale = check.get("scale") or abs(bound) or 1.0
    text = {k: check.get(k) for k in _TEXT_KEYS} | check.get(side, {})
    fault = Fault(
        code=text["code"],
        milestone=check["milestone"],
        metric=check["metric"],
        value=round(value, 2),
        expected=(lo, hi),
        severity=_severity(abs(value - bound) / scale * 100, check.get("severity_bands") or bands),
        message=text["message"],
        recommendation=text["recommendation"],
        drill=text.get("drill"),
    )
    return fault, text.get("verdict")


def _good_range(zones, good: set[str]) -> tuple[float | None, float | None]:
    los = [lo for z, lo, _ in zones if z in good]
    his = [hi for z, _, hi in zones if z in good]
    lo, hi = min(los), max(his)
    return (lo if lo > float("-inf") else None, hi if hi < float("inf") else None)


def _delivery_check(
    check: dict[str, Any], delivery: Delivery, req: AnalysisRequest
) -> tuple[Fault | None, str | None]:
    good = set(check["good"])
    if check["field"] == "length_zone":
        zone, value = delivery.length_zone, delivery.length_m
        expected = _good_range(LENGTH_ZONES_M[req.bowler_type or BowlerType.pace], good)
    elif check["field"] == "line_zone":
        zone, value = delivery.line_zone, line_offset_m(delivery.pitching_point_m[0], req.handedness)
        expected = _good_range(LINE_ZONES_M, good)
    else:
        raise ValueError(f"unknown delivery field {check['field']!r}")
    if zone in good:
        return None, _strength(check, value)
    spec = check["zones"][zone.value]
    return (
        Fault(
            code=spec["code"],
            milestone=check["milestone"],
            metric=check["field"],
            value=round(value, 2),
            expected=expected,
            severity=Severity(spec["severity"]),
            message=spec["message"],
            recommendation=spec["recommendation"],
            drill=spec.get("drill"),
        ),
        None,
    )


def describe_delivery(delivery: Delivery, rules: dict[str, Any] | None = None) -> str:
    labels = (rules or load_rules())["labels"]
    text = f"{labels['length_zone'][delivery.length_zone.value]} {labels['line_zone'][delivery.line_zone.value]}"
    if delivery.speed_kmh is not None:
        text += f" at {delivery.speed_kmh:.0f} km/h"
    return text


def applicable_checks(req: AnalysisRequest) -> list[dict[str, Any]]:
    """Pose checks for this request's shot_type / bowler_type (delivery checks excluded)."""
    rules = load_rules()
    if req.target is Target.batter:
        return [
            *rules["batting"].get("alignment", []),
            *rules["batting"].get(req.shot_type.value, []),
        ]
    return list(rules["bowling"].get(req.bowler_type.value, []))


def evaluate(req: AnalysisRequest, metrics: dict[str, float], delivery: Delivery | None) -> Coaching:
    rules = load_rules()
    bands = rules["scoring"]["default_severity_bands"]
    penalties = rules["scoring"]["penalties"]
    batting = req.target is Target.batter

    pose_checks = applicable_checks(req)
    results: list[tuple[Fault, str | None]] = []
    strengths: list[str] = []
    unavailable: list[str] = []

    def record(fault: Fault | None, extra: str | None) -> None:
        if fault is not None:
            results.append((fault, extra))
        elif extra:
            strengths.append(extra)

    for check in pose_checks:
        value = _lookup(metrics, check["milestone"], check["metric"])
        if value is None:
            if not check.get("optional") and check["metric"] not in unavailable:
                unavailable.append(check["metric"])
            continue
        record(*_pose_check(check, value, bands))

    if not batting:
        for check in rules["bowling"].get("delivery", []):
            if delivery is None:
                unavailable.append(check["field"])
                continue
            fault, strength = _delivery_check(check, delivery, req)
            record(fault, strength)

    results.sort(key=lambda r: _SEVERITY_ORDER[r[0].severity])
    faults = [f for f, _ in results]
    score = max(0, min(100, 100 - sum(penalties[f.severity.value] for f in faults)))

    top_verdict = next((v for _, v in results if v), None)
    if batting:
        verdict = top_verdict or rules["labels"]["positive"]["batting"]
    elif delivery is not None:
        verdict = describe_delivery(delivery, rules) + (f". {top_verdict}" if top_verdict else "")
    else:
        verdict = top_verdict or rules["labels"]["positive"]["bowling"]

    return Coaching(score=score, verdict=verdict, faults=faults, strengths=strengths, unavailable=unavailable)
