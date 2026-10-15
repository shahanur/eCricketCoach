import numpy as np

from app.ingest import MAX_CONSECUTIVE_READ_FAILURES, read_frames


class _FakeCapture:
    def __init__(self, pattern: list[bool]):
        self._pattern = list(pattern)

    def read(self):
        if not self._pattern:
            return False, None
        ok = self._pattern.pop(0)
        return (True, np.zeros((2, 2, 3), np.uint8)) if ok else (False, None)


def test_skips_leading_undecodable_packets():
    frames = list(read_frames(_FakeCapture([False, True, True, False, True])))
    assert len(frames) == 3


def test_stops_after_consecutive_failures():
    pattern = [True] + [False] * MAX_CONSECUTIVE_READ_FAILURES + [True]
    assert len(list(read_frames(_FakeCapture(pattern)))) == 1


def test_all_failures_yield_nothing():
    assert list(read_frames(_FakeCapture([]))) == []
