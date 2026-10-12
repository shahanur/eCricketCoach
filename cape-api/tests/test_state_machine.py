import numpy as np
import pytest

from app.tracking.kalman import Kalman2D
from app.tracking.state_machine import Phase, Tracker


def run(tracker, points):
    """points: list of (x, y) or None, one per frame starting at frame 0."""
    return [tracker.update(i, p) for i, p in enumerate(points)]


def straight_in_bounce_back(contact=10, n=20, speed=12.0):
    """Ball travels +x to the bat at frame `contact`, then rebounds -x and upward."""
    pts = []
    for i in range(n):
        if i <= contact:
            pts.append((100 + speed * i, 300 + 2.0 * i))
        else:
            k = i - contact
            pts.append((100 + speed * contact - 15 * k, 300 + 2.0 * contact - 6 * k))
    return pts


# --- Kalman ---------------------------------------------------------------------


def test_kalman_tracks_constant_velocity():
    kf = Kalman2D((0, 0), (5, -2))
    for i in range(1, 20):
        kf.step((5 * i, -2 * i))
    assert kf.position == pytest.approx((95, -38), abs=0.5)
    assert kf.velocity == pytest.approx((5, -2), abs=0.2)
    assert kf.predict() == pytest.approx((100, -40), abs=0.5)


def test_kalman_smooths_noise():
    rng = np.random.default_rng(0)
    kf = Kalman2D((0, 0), (3, 1), measurement_noise=9.0)
    errs = []
    for i in range(1, 60):
        truth = np.array([3 * i, i], float)
        est = kf.step(tuple(truth + rng.normal(0, 3, 2)))
        if i > 20:
            errs.append(np.linalg.norm(np.subtract(est, truth)))
    assert np.mean(errs) < 3 * np.sqrt(2) * 0.7


# --- State machine ------------------------------------------------------------


def test_contact_frame_detected():
    t = Tracker()
    phases = run(t, straight_in_bounce_back(contact=10))
    assert t.contact_frame == 10
    # Vertex at 10; confirmed by the detection at 12 (first outgoing at 11 + 1 confirmation).
    assert phases[:12] == [Phase.PRE_CONTACT] * 12
    assert phases[12] == Phase.AT_CONTACT
    assert phases[13:] == [Phase.POST_CONTACT] * 7
    assert [f for f, _ in t.history(Phase.PRE_CONTACT)] == list(range(10))
    assert t.history(Phase.AT_CONTACT) == [(10, (220.0, 320.0))]
    post = t.history(Phase.POST_CONTACT)
    assert [f for f, _ in post] == list(range(11, 20))
    assert post[-1][1] == pytest.approx((220 - 15 * 9, 320 - 6 * 9), abs=1.0)


def test_noise_does_not_trigger_early():
    rng = np.random.default_rng(42)
    pts = [(x + rng.normal(0, 1.0), y + rng.normal(0, 1.0)) for x, y in straight_in_bounce_back(contact=15, n=25)]
    t = Tracker()
    run(t, pts)
    assert t.contact_frame == 15


def test_jitter_below_min_speed_and_warmup_ignored():
    # Stationary ball jittering (e.g. in the bowler's hand) – inversions but tiny speeds.
    jitter = [(50 + (i % 2) * 1.5, 50 - (i % 2)) for i in range(8)]
    t = Tracker(min_speed_px=2.0)
    assert run(t, jitter) == [Phase.PRE_CONTACT] * 8 and t.contact_frame is None
    # A fast inversion inside the warm-up window is ignored.
    t = Tracker(warmup=3)
    run(t, [(0, 0), (20, 0), (0, 0), (-20, 0)])
    assert t.contact_frame is None


def test_single_outlier_is_debounced():
    pts = [(100 + 12 * i, 300.0) for i in range(15)]
    pts[8] = (pts[7][0] - 30, 300.0)  # one bad detection reverses direction once
    t = Tracker()
    run(t, pts)
    assert t.contact_frame is None


def test_no_inversion_stays_pre():
    t = Tracker()
    phases = run(t, [(10 * i, 5 * i) for i in range(30)])
    assert set(phases) == {Phase.PRE_CONTACT} and t.contact_frame is None
    assert len(t.history(Phase.PRE_CONTACT)) == 30
    assert t.history(Phase.POST_CONTACT) == []


def test_post_contact_gaps_filled():
    pts = straight_in_bounce_back(contact=10, n=30)
    for i in (13, 14, 15, 16):
        pts[i] = None
    t = Tracker(max_gap=8)
    run(t, pts)
    post = dict(t.history(Phase.POST_CONTACT))
    assert {13, 14, 15, 16} <= t.filled_frames
    for i in (13, 14, 15, 16):
        expected = (220 - 15 * (i - 10), 320 - 6 * (i - 10))
        assert post[i] == pytest.approx(expected, abs=2.0)


def test_gap_longer_than_max_gap_stops_filling():
    pts = straight_in_bounce_back(contact=10, n=13) + [None] * 10
    t = Tracker(max_gap=3)
    run(t, pts)
    frames = [f for f, _ in t.history(Phase.POST_CONTACT)]
    assert frames == list(range(11, 16))
    assert t.filled_frames == {13, 14, 15}


def test_pre_contact_missed_detections_tolerated():
    pts = straight_in_bounce_back(contact=10)
    pts[4] = pts[7] = None
    t = Tracker()
    run(t, pts)
    assert t.contact_frame == 10
    assert 4 not in dict(t.history(Phase.PRE_CONTACT))


def test_frames_must_increase():
    t = Tracker()
    t.update(3, (0, 0))
    with pytest.raises(ValueError):
        t.update(3, (1, 1))
