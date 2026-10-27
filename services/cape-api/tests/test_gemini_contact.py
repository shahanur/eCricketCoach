import json

import cv2
import numpy as np
import pytest

from app import gemini_contact


def test_parse_selection_clamps_frame_and_accepts_normalised_point():
    result = gemini_contact._parse_selection(
        {
            "frame_index": 11,
            "confidence": 1.4,
            "contact_point_norm": [0.25, 0.75],
            "reason": "ball meets blade",
        },
        [0, 10, 20],
    )
    assert result.frame_index == 10
    assert result.confidence == 1.0
    assert result.contact_point_norm == (0.25, 0.75)


def test_parse_selection_rejects_missing_frame():
    with pytest.raises(gemini_contact.GeminiContactError):
        gemini_contact._parse_selection({"confidence": 0.8}, [1, 2])


def test_sheet_contains_all_tiles():
    frames = [(i, np.full((60, 80, 3), i, np.uint8)) for i in range(5)]
    encoded = gemini_contact._sheet(frames, 25)
    image = cv2.imdecode(np.frombuffer(encoded, np.uint8), cv2.IMREAD_COLOR)
    assert image.shape[1] == gemini_contact.TILE_WIDTH * 4
    assert image.shape[0] > 0


def test_request_sends_images_and_parses_json(monkeypatch):
    captured = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self):
            return json.dumps(
                {
                    "candidates": [
                        {
                            "content": {
                                "parts": [
                                    {
                                        "text": '{"frame_index": 7, "confidence": 0.9, '
                                        '"contact_point_norm": [0.4, 0.5], "reason": "impact"}'
                                    }
                                ]
                            }
                        }
                    ]
                }
            ).encode()

    def fake_open(request, timeout):
        captured["body"] = json.loads(request.data)
        captured["timeout"] = timeout
        return Response()

    monkeypatch.setattr(gemini_contact.urllib.request, "urlopen", fake_open)
    result = gemini_contact._request("secret", "gemini-test", "find impact", [b"jpeg"], 12)
    assert result["frame_index"] == 7
    assert captured["timeout"] == 12
    assert captured["body"]["contents"][0]["parts"][1]["inline_data"]["mime_type"] == "image/jpeg"


def test_request_retries_a_timeout(monkeypatch):
    calls = 0

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self):
            return b'{"candidates":[{"content":{"parts":[{"text":"{\\"frame_index\\": 4, \\"confidence\\": 0.8}"}]}}]}'

    def fake_open(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise TimeoutError("slow")
        return Response()

    monkeypatch.setattr(gemini_contact.urllib.request, "urlopen", fake_open)
    monkeypatch.setattr(gemini_contact.time, "sleep", lambda *_: None)
    assert gemini_contact._request("key", "model", "prompt", [b"jpg"], 1)["frame_index"] == 4
    assert calls == 2
