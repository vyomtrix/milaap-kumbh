import numpy as np
from fastapi.testclient import TestClient

import main


class FakeCursor:
    def __init__(self, rows=None, result=None):
        self.rows = rows or []
        self.result = result
        self.executed = []

    def execute(self, query, params=None):
        self.executed.append((query, params))

    def fetchone(self):
        return self.result

    def fetchall(self):
        return self.rows

    def close(self):
        pass


class FakeConnection:
    def __init__(self, cursor):
        self.cursor_instance = cursor
        self.committed = False

    def cursor(self):
        return self.cursor_instance

    def commit(self):
        self.committed = True

    def close(self):
        pass


def enrollment_form():
    return {
        "name": "Asha Patel",
        "age": "31",
        "zone": "Zone Area 1",
        "complainant_lat": "25.43",
        "complainant_lng": "81.84",
    }


def test_enroll_creates_a_person_from_detected_faces(monkeypatch):
    cursor = FakeCursor(result=(42,))
    monkeypatch.setattr(main, "get_conn", lambda: FakeConnection(cursor))
    monkeypatch.setattr(main, "detect_and_embed", lambda _: [{"bbox": [0, 0, 10, 10], "embedding": np.array([3.0, 4.0])}])
    client = TestClient(main.app)

    response = client.post(
        "/enroll",
        data=enrollment_form(),
        files=[("photos", ("person.jpg", b"not-a-real-image", "image/jpeg"))],
    )

    assert response.status_code == 200
    assert response.json() == {"success": True, "person_id": 42}
    assert "INSERT INTO enrolled_persons" in cursor.executed[0][0]


def test_enroll_rejects_uploads_without_a_detected_face(monkeypatch):
    monkeypatch.setattr(main, "detect_and_embed", lambda _: [])
    client = TestClient(main.app)

    response = client.post(
        "/enroll",
        data=enrollment_form(),
        files=[("photos", ("person.jpg", b"not-a-real-image", "image/jpeg"))],
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "No face detected" in response.json()["error"]


def test_match_face_filters_results_below_the_threshold(monkeypatch):
    cursor = FakeCursor(rows=[(5, "Asha Patel", "Zone Area 1", 0.72)])
    monkeypatch.setattr(main, "get_conn", lambda: FakeConnection(cursor))

    assert main.match_face(np.array([0.1, 0.2]), threshold=0.7) == [{
        "id": 5, "name": "Asha Patel", "zone": "Zone Area 1", "similarity": 0.72,
    }]
    assert main.match_face(np.array([0.1, 0.2]), threshold=0.8) == []
