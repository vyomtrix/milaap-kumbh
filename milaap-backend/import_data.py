import csv
import math
import os
import bcrypt
from dotenv import load_dotenv
import psycopg2

load_dotenv()
NEON_CONN_STRING = os.getenv("NEON_CONN_STRING")
AUTHORITY_DEFAULT_PASSWORD = os.getenv("AUTHORITY_DEFAULT_PASSWORD")

if not NEON_CONN_STRING:
    raise RuntimeError("NEON_CONN_STRING must be configured")
if not AUTHORITY_DEFAULT_PASSWORD:
    raise RuntimeError("AUTHORITY_DEFAULT_PASSWORD must be configured before importing authorities")

AUTHORITY_DEFAULT_PASSWORD_HASH = bcrypt.hashpw(
    AUTHORITY_DEFAULT_PASSWORD.encode("utf-8"), bcrypt.gensalt()
).decode("utf-8")

def get_conn():
    return psycopg2.connect(NEON_CONN_STRING)

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat, dlon = math.radians(lat2-lat1), math.radians(lon2-lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

conn = get_conn()
cur = conn.cursor()

# ---- 1. Import zones ----
zones = []  # (zone_name, lat, lng)
with open("Zone_Boundaries.csv", newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        zones.append((row["zone_name"], float(row["centroid_lat"]), float(row["centroid_lng"])))
        cur.execute(
            "INSERT INTO zones (zone_name, centroid_lat, centroid_lng) VALUES (%s,%s,%s) ON CONFLICT (zone_name) DO NOTHING",
            (row["zone_name"], float(row["centroid_lat"]), float(row["centroid_lng"]))
        )
print(f"✅ Imported {len(zones)} zones")

# ---- Load chokepoints for naming zones ----
chokepoints = []
with open("Chokepoints_Parking.csv", newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        chokepoints.append((row["location_name"], float(row["latitude"]), float(row["longitude"])))

def nearest_chokepoint_name(lat, lng):
    if not chokepoints:
        return None
    nearest = min(chokepoints, key=lambda c: haversine(lat, lng, c[1], c[2]))
    return nearest[0]

# ---- Update zones with friendly display names ----
cur.execute("ALTER TABLE zones ADD COLUMN IF NOT EXISTS display_name TEXT")
for zone_name, lat, lng in zones:
    landmark = nearest_chokepoint_name(lat, lng)
    display = f"{zone_name.replace('Zone Area', 'Zone')} — near {landmark}" if landmark else zone_name.replace('Zone Area', 'Zone')
    cur.execute("UPDATE zones SET display_name = %s WHERE zone_name = %s", (display, zone_name))

def nearest_zone(lat, lng):
    return min(zones, key=lambda z: haversine(lat, lng, z[1], z[2]))[0]

# ---- 2. Import cameras (map Z1-C1 style IDs to zone names via prefix number, fallback to nearest zone) ----
camera_count = 0
with open("CCTV_Locations.csv", newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        cam_id = row["camera_id"]  # e.g. "Z1-C1"
        lat, lng = float(row["latitude"]), float(row["longitude"])
        try:
            zone_num = int(cam_id.split("-")[0].replace("Z", ""))
            zone_name = f"Zone Area {zone_num}"
            if zone_name not in [z[0] for z in zones]:
                zone_name = nearest_zone(lat, lng)
        except Exception:
            zone_name = nearest_zone(lat, lng)

        cur.execute(
            """INSERT INTO cameras (camera_name, latitude, longitude, zone_label)
               VALUES (%s,%s,%s,%s)
               ON CONFLICT (camera_name) DO UPDATE
               SET latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, zone_label=EXCLUDED.zone_label""",
            (cam_id, lat, lng, zone_name),
        )
        camera_count += 1
print(f"✅ Imported {camera_count} cameras")

# ---- 3. Import police stations as authorities ----
auth_count = 0
with open("Police_Stations.csv", newline="", encoding="utf-8") as f:
    for i, row in enumerate(csv.DictReader(f), start=1):
        lat, lng = float(row["latitude"]), float(row["longitude"])
        zone_name = nearest_zone(lat, lng)
        username = row["station_name"].lower().replace(" ", "_").replace("station", "").strip("_")
        cur.execute(
            """INSERT INTO authorities (name, phone, latitude, longitude, zone_label, username, password_hash)
               VALUES (%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (username) DO UPDATE
               SET name=EXCLUDED.name, phone=EXCLUDED.phone, latitude=EXCLUDED.latitude,
                   longitude=EXCLUDED.longitude, zone_label=EXCLUDED.zone_label,
                   password_hash=EXCLUDED.password_hash""",
            (row["station_name"], "+919999999999", lat, lng, zone_name, username, AUTHORITY_DEFAULT_PASSWORD_HASH)
        )
        auth_count += 1
print(f"✅ Imported {auth_count} police stations with bcrypt password hashes")

conn.commit()
cur.close()
conn.close()
print("🎉 Import complete")
