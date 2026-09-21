import cv2
import numpy as np
import psycopg2
import math
import time
import base64
import threading
import uuid
import shutil
import os
import asyncio
import re
import json
import hmac
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated
import bcrypt
from insightface.app import FaceAnalysis
from twilio.rest import Client
from fastapi import Depends, FastAPI, Header, HTTPException, Query, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
load_dotenv()

# ============================================
# CONFIG — fill these in
# ============================================
NEON_CONN_STRING = os.getenv("NEON_CONN_STRING")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
AUTH_SECRET = os.getenv("AUTH_SECRET")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH")
AUTH_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", "3600"))
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]

try:
    CAMERA_SOURCE_OVERRIDES = json.loads(os.getenv("CAMERA_SOURCE_OVERRIDES_JSON", "{}"))
except json.JSONDecodeError as exc:
    raise RuntimeError("CAMERA_SOURCE_OVERRIDES_JSON must be a JSON object") from exc

if not isinstance(CAMERA_SOURCE_OVERRIDES, dict):
    raise RuntimeError("CAMERA_SOURCE_OVERRIDES_JSON must be a JSON object")

# ============================================
# FACE MODEL (CPU)
# ============================================
face_app = None
twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN else None

# ============================================
# CORE DETECTION + EMBEDDING
# ============================================
def get_face_app():
    """Load the CPU model only when it is first needed."""
    global face_app
    if face_app is None:
        face_app = FaceAnalysis(name="buffalo_s", providers=["CPUExecutionProvider"])
        face_app.prepare(ctx_id=0, det_size=(320, 320))
        print("✅ Face model loaded (CPU)")
    return face_app


def detect_and_embed(frame):
    faces = get_face_app().get(frame)
    return [
        {"bbox": f.bbox.astype(int).tolist(), "det_score": float(f.det_score), "embedding": f.normed_embedding}
        for f in faces
    ]

# ============================================
# DB HELPERS
# ============================================
def get_conn():
    return psycopg2.connect(NEON_CONN_STRING)

def match_face(embedding, threshold=0.5, top_k=1):
    conn = get_conn(); cur = conn.cursor()
    cur.execute(
        """SELECT id, name, last_seen_zone, 1 - (embedding <=> %s::vector) AS similarity
           FROM enrolled_persons
           WHERE status != 'resolved'
           ORDER BY embedding <=> %s::vector LIMIT %s""",
        (embedding.tolist(), embedding.tolist(), top_k)
    )
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [{"id": r[0], "name": r[1], "zone": r[2], "similarity": float(r[3])} for r in rows if r[3] >= threshold]
def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat, dlon = math.radians(lat2-lat1), math.radians(lon2-lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def get_nearest_authority(camera_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT latitude, longitude FROM cameras WHERE id=%s", (camera_id,))
    cam_lat, cam_lng = cur.fetchone()
    cur.execute("SELECT id, name, phone, latitude, longitude FROM authorities")
    authorities = cur.fetchall()
    cur.close(); conn.close()
    nearest = min(authorities, key=lambda a: haversine(cam_lat, cam_lng, a[3], a[4]))
    return {"id": nearest[0], "name": nearest[1], "phone": nearest[2]}

def send_sms_alert(phone, person_name, camera_name, similarity):
    if twilio_client is None or not TWILIO_PHONE_NUMBER:
        raise RuntimeError("Twilio credentials are not configured")
    message = f"ALERT: Possible match for {person_name} detected at {camera_name}. Confidence: {similarity:.0%}. Please verify."
    msg = twilio_client.messages.create(body=message, from_=TWILIO_PHONE_NUMBER, to=phone)
    return {"sid": msg.sid, "status": msg.status}

def crop_and_encode(frame, bbox, padding=40):
    x1, y1, x2, y2 = bbox
    h, w = frame.shape[:2]
    x1, y1 = max(0, x1-padding), max(0, y1-padding)
    x2, y2 = min(w, x2+padding), min(h, y2+padding)
    crop = frame[y1:y2, x1:x2]
    _, buf = cv2.imencode('.jpg', crop)
    return base64.b64encode(buf).decode('utf-8')

def handle_match_and_alert(camera_id, camera_name, match_result, snapshot_b64=None):
    authority = get_nearest_authority(camera_id)

    try:
        sms_result = send_sms_alert(authority["phone"], match_result["name"], camera_name, match_result["similarity"])
    except Exception as e:
        sms_result = {"error": str(e)}
        print(f"⚠️ SMS failed: {e}")

    conn = get_conn(); cur = conn.cursor()
    cur.execute(
        "INSERT INTO alerts (person_id, camera_id_fk, similarity, notified_authority_id, snapshot_base64) VALUES (%s,%s,%s,%s,%s)",
        (match_result["id"], camera_id, match_result["similarity"], authority["id"], snapshot_b64)
    )
    cur.execute("UPDATE enrolled_persons SET status='matched' WHERE id=%s", (match_result["id"],))
    conn.commit(); cur.close(); conn.close()
    return {"authority_notified": authority["name"], "sms_status": sms_result}
# ============================================
# FASTAPI APP
# ============================================
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "ngrok-skip-browser-warning"],
)


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_access_token(subject: str, role: str, authority_id: int | None = None) -> str:
    if not AUTH_SECRET:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    payload = {
        "sub": subject,
        "role": role,
        "authority_id": authority_id,
        "exp": int((datetime.now(timezone.utc) + timedelta(seconds=AUTH_TOKEN_TTL_SECONDS)).timestamp()),
    }
    body = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _b64encode(hmac.new(AUTH_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{signature}"


def decode_access_token(token: str) -> dict:
    if not AUTH_SECRET:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    try:
        body, supplied_signature = token.split(".", 1)
        expected_signature = _b64encode(hmac.new(AUTH_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
        if not secrets.compare_digest(supplied_signature, expected_signature):
            raise ValueError("Invalid signature")
        payload = json.loads(_b64decode(body))
        if not isinstance(payload, dict) or payload.get("exp", 0) <= datetime.now(timezone.utc).timestamp():
            raise ValueError("Expired token")
        return payload
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=401, detail="Invalid or expired access token") from None


def get_token_from_header(authorization: Annotated[str | None, Header()] = None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    return decode_access_token(authorization.removeprefix("Bearer "))


def require_role(role: str):
    def dependency(token: dict = Depends(get_token_from_header)) -> dict:
        if token.get("role") != role:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return token
    return dependency


require_admin = require_role("admin")
require_authority = require_role("authority")

active_feeds = {}
alert_cooldowns = {}
cooldown_lock = threading.Lock()
COOLDOWN_SECONDS = 60
last_errors = {}
latest_frames = {}
latest_raw_frames = {}  # camera_id -> raw numpy frame, used by detection_loop

class ConnectionManager:
    def __init__(self):
        self.active_connections = []
    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.append(ws)
    def disconnect(self, ws: WebSocket):
        self.active_connections.remove(ws)
    async def broadcast(self, message: dict):
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception:
                dead.append(conn)
        for d in dead:
            self.active_connections.remove(d)

manager = ConnectionManager()
main_loop = None

def push_alert_to_dashboard(alert_data: dict):
    if main_loop:
        asyncio.run_coroutine_threadsafe(manager.broadcast(alert_data), main_loop)

@app.on_event("startup")
async def startup():
    global main_loop
    main_loop = asyncio.get_event_loop()

@app.websocket("/ws/alerts")
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)):
    try:
        payload = decode_access_token(token)
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    except HTTPException:
        await ws.close(code=1008)
        return
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)

@app.post("/enroll")
async def enroll_endpoint(
    name: str = Form(...), age: int = Form(...), zone: str = Form(...),
    phone: str = Form(""), message: str = Form(""),
    complainant_lat: float = Form(...), complainant_lng: float = Form(...),
    complainant_address: str = Form(""),
    photos: list[UploadFile] = File(...)
):
    embeddings = []
    temp_paths = []
    try:
        for photo in photos:
            temp_path = f"{os.getenv('TEMP')}\\{uuid.uuid4()}_{photo.filename}" if os.name == "nt" else f"/tmp/{uuid.uuid4()}_{photo.filename}"
            with open(temp_path, "wb") as f:
                shutil.copyfileobj(photo.file, f)
            temp_paths.append(temp_path)
            img = cv2.imread(temp_path)
            faces = detect_and_embed(img)
            if faces:
                largest = max(faces, key=lambda f: (f["bbox"][2]-f["bbox"][0])*(f["bbox"][3]-f["bbox"][1]))
                embeddings.append(largest["embedding"])

        if not embeddings:
            return {"success": False, "error": "No face detected in any uploaded photo"}

        avg_emb = np.mean(embeddings, axis=0)
        avg_emb = avg_emb / np.linalg.norm(avg_emb)

        conn = get_conn(); cur = conn.cursor()
        cur.execute(
            """INSERT INTO enrolled_persons
               (name, age, last_seen_zone, complainant_phone, extra_message, complainant_lat, complainant_lng, complainant_address, embedding)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (name, age, zone, phone or None, message or None, complainant_lat, complainant_lng, complainant_address or None, avg_emb.tolist())
        )
        person_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return {"success": True, "person_id": person_id}
    finally:    
        for p in temp_paths:
            if os.path.exists(p):
                os.remove(p)
def capture_loop(video_path, camera_id, stop_event):
    is_stream = video_path.startswith("rtsp://") or video_path.startswith("http://") or video_path.isdigit()
    cap = cv2.VideoCapture(int(video_path) if video_path.isdigit() else video_path)
    if not cap.isOpened():
        last_errors[camera_id] = f"cv2.VideoCapture failed to open: {video_path}"
        return
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    frame_delay = 1.0 / fps if not is_stream else 0.03  # streams don't need fps pacing

    while not stop_event.is_set():
        ret, frame = cap.read()
        if not ret:
            if is_stream:
                time.sleep(1)  # brief pause, then just keep trying (network camera)
                continue
            else:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # loop demo file
                continue
        _, jpeg = cv2.imencode('.jpg', frame)
        latest_frames[camera_id] = jpeg.tobytes()
        latest_raw_frames[camera_id] = frame
        time.sleep(frame_delay)

    cap.release()

def detection_loop(camera_id, camera_name, match_threshold, stop_event, detect_interval=0.5):
    """Slow loop: runs independently, always works on whatever the newest frame is."""
    push_alert_to_dashboard({"type": "status", "camera_name": camera_name, "message": "started"})
    while not stop_event.is_set():
        frame = latest_raw_frames.get(camera_id)
        if frame is not None:
            faces = detect_and_embed(frame)
            for face in faces:
                match_result = match_face(face["embedding"], threshold=match_threshold)
                if match_result:
                    hit = match_result[0]
                    key = (hit["id"], camera_id)
                    now = time.time()
                    with cooldown_lock:
                        if key in alert_cooldowns and (now - alert_cooldowns[key]) < COOLDOWN_SECONDS:
                            continue
                        alert_cooldowns[key] = now
                    snapshot_b64 = crop_and_encode(frame, face["bbox"])
                    alert = handle_match_and_alert(camera_id, camera_name, hit, snapshot_b64)
                    push_alert_to_dashboard({
                        "type": "match", "camera_name": camera_name, "person_name": hit["name"],
                        "similarity": hit["similarity"], "authority_notified": alert["authority_notified"],
                        "snapshot": snapshot_b64, "timestamp": time.time()
                    })
        time.sleep(detect_interval)  # how often detection runs, independent of video fps
    push_alert_to_dashboard({"type": "status", "camera_name": camera_name, "message": "stopped"})
def get_camera_source(camera_id: int) -> tuple[str, str | None] | None:
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT camera_name, stream_url FROM cameras WHERE id=%s", (camera_id,))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row:
        return None
    return row[0], CAMERA_SOURCE_OVERRIDES.get(row[0]) or row[1]


@app.get("/admin/cameras")
async def list_cameras(limit: int = Query(50, ge=1, le=200), _: dict = Depends(require_admin)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute(
        "SELECT id, camera_name, latitude, longitude, zone_label, stream_url FROM cameras ORDER BY id LIMIT %s",
        (limit,),
    )
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [{
        "id": row[0], "name": row[1], "lat": row[2], "lng": row[3], "zone": row[4],
        "source_configured": bool(CAMERA_SOURCE_OVERRIDES.get(row[1]) or row[5]),
    } for row in rows]


@app.post("/cameras/start")
async def start_camera(camera_id: int = Form(...), _: dict = Depends(require_admin)):
    camera = get_camera_source(camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    camera_name, video_path = camera
    if not video_path:
        raise HTTPException(status_code=400, detail="No video source configured for this camera")
    if camera_id in active_feeds:
        if active_feeds[camera_id]["capture_thread"].is_alive():
            return {"success": False, "error": "Camera already running"}
        else:
            del active_feeds[camera_id]
    last_errors.pop(camera_id, None)
    stop_event = threading.Event()

    capture_thread = threading.Thread(target=capture_loop, args=(video_path, camera_id, stop_event), daemon=True)
    detect_thread = threading.Thread(target=detection_loop, args=(camera_id, camera_name, 0.5, stop_event), daemon=True)

    active_feeds[camera_id] = {"capture_thread": capture_thread, "detect_thread": detect_thread, "stop_event": stop_event, "camera_name": camera_name}
    capture_thread.start()
    detect_thread.start()
    return {"success": True, "camera_id": camera_id, "status": "started"}
@app.post("/cameras/stop")
async def stop_camera(camera_id: int = Form(...), _: dict = Depends(require_admin)):
    if camera_id not in active_feeds:
        return {"success": False, "error": "Camera not running"}
    active_feeds[camera_id]["stop_event"].set()
    active_feeds[camera_id]["capture_thread"].join(timeout=5)
    active_feeds[camera_id]["detect_thread"].join(timeout=5)
    del active_feeds[camera_id]
    return {"success": True, "camera_id": camera_id, "status": "stopped"}

@app.get("/cameras/status")
async def camera_status(_: dict = Depends(require_admin)):
    return {
        cid: {
            "camera_name": feed["camera_name"],
            "capture_running": feed["capture_thread"].is_alive(),
            "detection_running": feed["detect_thread"].is_alive(),
            "running": feed["capture_thread"].is_alive() and feed["detect_thread"].is_alive(),
        }
        for cid, feed in active_feeds.items()
    }

@app.get("/debug/errors")
async def debug_errors(_: dict = Depends(require_admin)):
    return last_errors

def generate_mjpeg(camera_id):
    while True:
        frame_bytes = latest_frames.get(camera_id)
        if frame_bytes:
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.1)

@app.get("/cameras/{camera_id}/stream")
async def video_stream(camera_id: int, access_token: str = Query(...)):
    payload = decode_access_token(access_token)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return StreamingResponse(generate_mjpeg(camera_id), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/complaints/{complaint_id}/status")
async def check_status(complaint_id: int):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT name, status FROM enrolled_persons WHERE id=%s", (complaint_id,))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row: return {"error": "not found"}
    return {"name": row[0], "status": row[1]}

@app.post("/admin/complaints/{complaint_id}/resolve")
async def resolve_complaint(complaint_id: int, _: dict = Depends(require_admin)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("UPDATE enrolled_persons SET status='resolved' WHERE id=%s", (complaint_id,))
    conn.commit(); cur.close(); conn.close()
    return {"success": True}
# ============================================
# AUTHORITY AUTH
# ============================================
@app.post("/admin/login")
async def admin_login(username: str = Form(...), password: str = Form(...)):
    if not ADMIN_USERNAME or not ADMIN_PASSWORD_HASH:
        raise HTTPException(status_code=503, detail="Admin authentication is not configured")
    try:
        valid = secrets.compare_digest(username, ADMIN_USERNAME) and bcrypt.checkpw(
            password.encode("utf-8"), ADMIN_PASSWORD_HASH.encode("utf-8")
        )
    except ValueError:
        valid = False
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": create_access_token(ADMIN_USERNAME, "admin"), "role": "admin"}


@app.post("/authority/login")
async def authority_login(username: str = Form(...), password: str = Form(...)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id, name, zone_label, password_hash FROM authorities WHERE username=%s", (username,))
    row = cur.fetchone()
    cur.close(); conn.close()
    try:
        valid = row is not None and bcrypt.checkpw(password.encode("utf-8"), row[3].encode("utf-8"))
    except ValueError:
        valid = False
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {
        "access_token": create_access_token(row[1], "authority", row[0]),
        "role": "authority", "authority_id": row[0], "name": row[1], "zone": row[2],
    }

@app.get("/authority/alerts")
async def authority_alerts(token: dict = Depends(require_authority)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT a.id, a.similarity, a.status, a.notes, a.snapshot_base64, a.detected_at,
               p.name, p.age, p.last_seen_zone, c.camera_name
        FROM alerts a
        JOIN enrolled_persons p ON a.person_id = p.id
        JOIN cameras c ON a.camera_id_fk = c.id
        WHERE a.notified_authority_id = %s
        ORDER BY a.detected_at DESC
    """, (token["authority_id"],))
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [{
        "id": r[0], "similarity": r[1], "status": r[2], "notes": r[3], "snapshot": r[4],
        "detected_at": str(r[5]), "person_name": r[6], "age": r[7], "zone": r[8], "camera_name": r[9]
    } for r in rows]

@app.post("/authority/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: int, token: dict = Depends(require_authority)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute(
        "UPDATE alerts SET status='acknowledged', acknowledged_at=now() WHERE id=%s AND notified_authority_id=%s",
        (alert_id, token["authority_id"]),
    )
    if cur.rowcount == 0:
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="Alert not found")
    conn.commit(); cur.close(); conn.close()
    return {"success": True}

@app.post("/authority/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: int, notes: str = Form(""), token: dict = Depends(require_authority)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute(
        "UPDATE alerts SET status='resolved', resolved_at=now(), notes=%s WHERE id=%s AND notified_authority_id=%s",
        (notes, alert_id, token["authority_id"]),
    )
    if cur.rowcount == 0:
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="Alert not found")
    cur.execute("""
        UPDATE enrolled_persons SET status='resolved'
        WHERE id = (SELECT person_id FROM alerts WHERE id=%s)
    """, (alert_id,))
    conn.commit(); cur.close(); conn.close()
    return {"success": True}

# ============================================
# MAP DATA
# ============================================
@app.get("/map/data")
async def map_data(_: dict = Depends(require_admin)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id, camera_name, latitude, longitude, zone_label FROM cameras")
    cameras = [{"id": r[0], "name": r[1], "lat": r[2], "lng": r[3], "zone": r[4]} for r in cur.fetchall()]
    cur.execute("SELECT id, name, latitude, longitude, zone_label FROM authorities")
    authorities = [{"id": r[0], "name": r[1], "lat": r[2], "lng": r[3], "zone": r[4]} for r in cur.fetchall()]
    cur.execute("""
        SELECT a.id, c.latitude, c.longitude, p.name, a.status, a.detected_at
        FROM alerts a JOIN cameras c ON a.camera_id_fk = c.id JOIN enrolled_persons p ON a.person_id = p.id
        ORDER BY a.detected_at DESC LIMIT 20
    """)
    alerts = [{"id": r[0], "lat": r[1], "lng": r[2], "person_name": r[3], "status": r[4], "detected_at": str(r[5])} for r in cur.fetchall()]
    cur.close(); conn.close()
    return {"cameras": cameras, "authorities": authorities, "alerts": alerts} 

@app.get("/admin/complaints")
async def list_complaints(_: dict = Depends(require_admin)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""SELECT id, name, age, last_seen_zone, status, enrolled_at,
                          complainant_phone, complainant_lat, complainant_lng, complainant_address
                   FROM enrolled_persons ORDER BY enrolled_at DESC""")
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [{
        "id": r[0], "name": r[1], "age": r[2], "zone": r[3], "status": r[4], "enrolled_at": str(r[5]),
        "phone": r[6], "complainant_lat": r[7], "complainant_lng": r[8], "complainant_address": r[9]
    } for r in rows]   


@app.get("/zones")
async def get_zones():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT zone_name, display_name FROM zones")
    rows = cur.fetchall()
    cur.close(); conn.close()
    zones = [{"value": r[0], "label": r[1] or r[0]} for r in rows]
    zones.sort(key=lambda z: int(re.search(r'\d+', z["value"]).group()) if re.search(r'\d+', z["value"]) else 0)
    return zones


if __name__ == "__main__":
    # Prefer: uvicorn main:app --host 0.0.0.0 --port 8000
    # This fallback is retained for local convenience after every route is registered.
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
