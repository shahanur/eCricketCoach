import math

import pytest

from app.coaching import describe_delivery, evaluate, load_rules
from app.schemas import (
    DEFAULT_PITCH_POINTS_M,
    LENGTH_ZONES_M,
    LINE_ZONES_M,
    AnalysisRequest,
    BowlerType,
    Delivery,
    LengthZone,
    LineZone,
    Severity,
    ShotType,
)

CAL = [(10, 10), (200, 10), (200, 400), (10, 400)]
GOOD_DRIVE = {"front_knee": 130.0, "head_front_knee_offset_pct": 5.0, "bat_angle_deg": 12.0, "stride_m": 0.8}


def bat_req(shot="front_foot_drive", handedness="right"):
    return AnalysisRequest(target="batter", handedness=handedness, shot_type=shot, calibration_points=CAL)


def bowl_req(bowler_type="pace"):
    return AnalysisRequest(target="bowler", handedness="right", bowler_type=bowler_type, calibration_points=CAL)


def delivery(length_zone=LengthZone.good_length, line_zone=LineZone.off_stump_channel, x=-0.3, y=6.5, speed=118):
    return Delivery(
        speed_kmh=speed, pitching_point_m=(x, y), length_m=y, length_zone=length_zone, line_zone=line_zone,
        is_good_ball=length_zone is LengthZone.good_length and line_zone in (LineZone.stumps, LineZone.off_stump_channel),
    )


def test_in_range_gives_strengths():
    c = evaluate(bat_req(), GOOD_DRIVE, None)
    assert c.faults == [] and c.score == 100 and c.unavailable == []
    assert "Straight bat at contact (12°)" in c.strengths and len(c.strengths) == 4
    assert c.verdict == load_rules()["labels"]["positive"]["batting"]


@pytest.mark.parametrize(
    "knee,code,severity",
    [(105, "front_knee_collapsed", Severity.low), (98.2, "front_knee_collapsed", Severity.medium),
     (70, "front_knee_collapsed", Severity.high), (160, "front_knee_locked", Severity.low)],
)
def test_out_of_range_fault(knee, code, severity):
    c = evaluate(bat_req(), {**GOOD_DRIVE, "front_knee": knee}, None)
    (fault,) = c.faults
    assert (fault.code, fault.severity, fault.metric, fault.milestone) == (code, severity, "front_knee", "point_of_contact")
    assert fault.value == pytest.approx(knee) and fault.expected == (110, 150)
    assert fault.recommendation and fault.drill
    if code == "front_knee_collapsed":
        assert fault.recommendation.startswith("Stride to the pitch of the ball")
        assert c.verdict == "Drive played with a collapsed front knee"
    assert c.score == 100 - {"low": 5, "medium": 10, "high": 20}[severity.value]


def test_milestone_prefixed_metric_wins():
    c = evaluate(bat_req(), {**GOOD_DRIVE, "point_of_contact.front_knee": 70.0}, None)
    assert [f.code for f in c.faults] == ["front_knee_collapsed"]


def test_missing_metrics_are_unavailable():
    c = evaluate(bat_req(), {"front_knee": 130.0}, None)
    assert c.faults == [] and c.score == 100
    assert c.unavailable == ["head_front_knee_offset_pct", "bat_angle_deg", "stride_m"]


def test_faults_sorted_by_severity_and_score():
    metrics = {**GOOD_DRIVE, "bat_angle_deg": 22.0, "stride_m": 0.1, "front_knee": 98.2}
    c = evaluate(bat_req(), metrics, None)
    assert [f.severity for f in c.faults] == [Severity.high, Severity.medium, Severity.low]
    assert c.score == 100 - 20 - 10 - 5
    assert c.verdict == "Drive played without getting to the pitch of the ball"


def test_score_clamped_at_zero():
    metrics = {"bat_ahead_of_pad_cm": -10, "head_front_knee_offset_pct": -20, "bat_angle_deg": 40,
               "front_knee": 50, "stride_m": 0.1}
    c = evaluate(bat_req("forward_defence"), metrics, None)
    assert len(c.faults) == 5 and all(f.severity is Severity.high for f in c.faults)
    assert c.score == 0


def test_deterministic():
    m = {**GOOD_DRIVE, "front_knee": 98.2}
    assert evaluate(bat_req(), m, None) == evaluate(bat_req(), m, None)


def test_bowling_good_ball_verdict():
    c = evaluate(bowl_req(), {"front_knee": 170, "back_elbow": 175, "release_height_m": 2.1}, delivery())
    assert c.faults == [] and c.score == 100
    assert c.verdict == "Good-length ball in the off-stump channel at 118 km/h"
    assert "Good length (6.5 m from the stumps)" in c.strengths
    assert "Good line (+0.30 m from middle stump)" in c.strengths


def test_bowling_faults():
    d = delivery(LengthZone.short, LineZone.down_leg, x=0.3, y=11.0)
    c = evaluate(bowl_req(), {"front_knee": 170, "back_elbow": 155, "release_height_m": 2.1}, d)
    codes = {f.code: f for f in c.faults}
    assert set(codes) == {"length_short", "line_down_leg", "bent_bowling_arm"}
    assert codes["length_short"].expected == (5.0, 8.0) and codes["length_short"].value == 11.0
    assert codes["line_down_leg"].expected == (-0.15, 0.45) and codes["line_down_leg"].value == -0.3
    assert codes["bent_bowling_arm"].severity is Severity.high  # 10/165 = 6.1% > band 6
    assert c.verdict == "Short ball down the leg side at 118 km/h. Bowling arm bent at release"
    assert c.score == 40


def test_spin_uses_spin_length_band():
    d = delivery(LengthZone.short_of_a_length, LineZone.stumps, x=0.0, y=5.5)
    c = evaluate(bowl_req("spin"), {}, d)
    (fault,) = c.faults
    assert fault.code == "length_short_of_a_length" and fault.expected == (3.0, 5.0)
    assert set(c.unavailable) == {"front_knee", "back_elbow", "release_height_m"}


def test_bowling_without_delivery():
    c = evaluate(bowl_req(), {"front_knee": 150}, None)
    assert "length_zone" in c.unavailable and "line_zone" in c.unavailable
    assert c.verdict == "Front leg collapsing at delivery"


def test_describe_without_speed():
    assert describe_delivery(delivery(speed=None)) == "Good-length ball in the off-stump channel"


def test_rules_cover_every_shot_and_bowler():
    rules = load_rules()
    for shot in ShotType:
        assert len(rules["batting"][shot.value]) >= 3, shot
    for bt in BowlerType:
        assert rules["bowling"][bt.value]
    for check in rules["bowling"]["delivery"]:
        enum = LengthZone if check["field"] == "length_zone" else LineZone
        assert set(check["zones"]) | set(check["good"]) == {z.value for z in enum}


def test_rules_zone_tables_match_schemas():
    rules = load_rules()
    inf = lambda v, s: s * math.inf if v is None else v  # noqa: E731
    for bt in BowlerType:
        assert {z.value: (lo, hi) for z, lo, hi in LENGTH_ZONES_M[bt]} == {
            z: (inf(lo, -1), inf(hi, 1)) for z, (lo, hi) in rules["length_zones"][bt.value].items()
        }
    assert {z.value: (lo, hi) for z, lo, hi in LINE_ZONES_M} == {
        z: (inf(lo, -1), inf(hi, 1)) for z, (lo, hi) in rules["line_zones"].items()
    }

def test_phase_metrics_do_not_fall_back_and_optional_checks_skip():
    # A contact-frame value must not stand in for a post-contact metric.
    metrics = {**GOOD_DRIVE, "head_front_knee_offset_pct": -40.0}
    c = evaluate(bat_req(), metrics, None)
    codes = {f.code for f in c.faults}
    assert "falling_away_after_contact" not in codes
    assert not any(u.startswith(("pre_contact.", "post_contact.")) or u in ("bat_swing_arc_deg", "follow_through_arc_deg") for u in c.unavailable)
    c = evaluate(bat_req(), {**metrics, "pre_contact.bat_swing_arc_deg": 20.0, "post_contact.follow_through_arc_deg": 20.0,
                             "post_contact.head_front_knee_offset_pct": -40.0}, None)
    phases = {f.code: f.milestone for f in c.faults}
    assert phases["short_backswing"] == "pre_contact"
    assert phases["checked_follow_through"] == "post_contact"
    assert phases["falling_away_after_contact"] == "post_contact"


@pytest.mark.parametrize(
    ("shot", "metrics", "expected"),
    [
        ("front_foot_drive", {"pre_contact.hands_height_pct": -90.0, "pre_contact.bat_swing_speed_kmh": 15.0,
                              "post_contact.head_travel_pct": 40.0, "post_contact.front_elbow_height_pct": -50.0,
                              "post_contact.front_knee": 70.0},
         {"low_backlift", "slow_bat_swing", "head_up_after_contact", "low_finish", "front_leg_collapses_in_finish"}),
        ("forward_defence", {"pre_contact.bat_swing_speed_kmh": 80.0, "post_contact.head_travel_pct": 30.0,
                             "post_contact.head_front_knee_offset_pct": -30.0},
         {"big_swing_in_defence", "head_up_after_contact", "falling_away_after_contact"}),
        ("sweep", {"post_contact.front_knee": 170.0}, {"standing_up_early"}),
    ],
)
def test_phase_rules_flag_faults_before_and_after_contact(shot, metrics, expected):
    c = evaluate(bat_req(shot), metrics, None)
    assert expected <= {f.code for f in c.faults}
    assert all(f.milestone in ("pre_contact", "post_contact") for f in c.faults if f.code in expected)
    assert not any(m.startswith(("pre_contact", "post_contact")) for m in c.unavailable)
