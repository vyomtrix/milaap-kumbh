-- Milaap database bootstrap. Run once against an empty PostgreSQL/Neon database.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS zones (
    zone_name TEXT PRIMARY KEY,
    display_name TEXT,
    centroid_lat DOUBLE PRECISION NOT NULL,
    centroid_lng DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS cameras (
    id BIGSERIAL PRIMARY KEY,
    camera_name TEXT NOT NULL UNIQUE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    zone_label TEXT REFERENCES zones(zone_name),
    -- Keep operational source URLs server-side; never return this column to browsers.
    stream_url TEXT
);

CREATE TABLE IF NOT EXISTS authorities (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    zone_label TEXT REFERENCES zones(zone_name),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrolled_persons (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 0 AND age <= 150),
    last_seen_zone TEXT NOT NULL REFERENCES zones(zone_name),
    complainant_phone TEXT,
    extra_message TEXT,
    complainant_lat DOUBLE PRECISION,
    complainant_lng DOUBLE PRECISION,
    complainant_address TEXT,
    embedding VECTOR(512) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'resolved')),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL REFERENCES enrolled_persons(id),
    camera_id_fk BIGINT NOT NULL REFERENCES cameras(id),
    similarity DOUBLE PRECISION NOT NULL CHECK (similarity >= 0 AND similarity <= 1),
    notified_authority_id BIGINT NOT NULL REFERENCES authorities(id),
    snapshot_base64 TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'resolved')),
    notes TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS enrolled_persons_status_idx ON enrolled_persons(status);
CREATE INDEX IF NOT EXISTS alerts_authority_detected_idx ON alerts(notified_authority_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS alerts_camera_detected_idx ON alerts(camera_id_fk, detected_at DESC);
CREATE INDEX IF NOT EXISTS enrolled_persons_embedding_idx
    ON enrolled_persons USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
