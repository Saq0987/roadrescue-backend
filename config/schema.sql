-- ═══════════════════════════════════════════════════════════
--  RoadRescue — MySQL Database Schema
--  On Road Fuel Assistance & Breakdown Management System
-- ═══════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS roadrescue;
USE roadrescue;

-- ─────────────────────────────────────────
-- 1. USERS (Customers, Mechanics, Fuel Stations, Admins)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  first_name      VARCHAR(80)  NOT NULL,
  last_name       VARCHAR(80)  NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  phone           VARCHAR(20)  NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('customer','mechanic','fuel_station','admin') NOT NULL DEFAULT 'customer',
  is_verified     TINYINT(1)   NOT NULL DEFAULT 0,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  profile_pic     VARCHAR(255) DEFAULT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- 2. VEHICLES (owned by customers)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT          NOT NULL,
  plate_number    VARCHAR(20)  NOT NULL,
  make            VARCHAR(60)  DEFAULT NULL,
  model           VARCHAR(60)  DEFAULT NULL,
  year            YEAR         DEFAULT NULL,
  fuel_type       ENUM('petrol','diesel','premium','electric') NOT NULL DEFAULT 'petrol',
  color           VARCHAR(40)  DEFAULT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 3. SERVICE PROVIDERS (mechanics & fuel stations)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_providers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT          NOT NULL UNIQUE,
  business_name   VARCHAR(150) NOT NULL,
  license_number  VARCHAR(80)  NOT NULL,
  service_type    ENUM('mechanic','fuel_station','both') NOT NULL,
  is_approved     TINYINT(1)   NOT NULL DEFAULT 0,
  is_available    TINYINT(1)   NOT NULL DEFAULT 0,
  latitude        DECIMAL(10,8) DEFAULT NULL,
  longitude       DECIMAL(11,8) DEFAULT NULL,
  address         VARCHAR(255) DEFAULT NULL,
  avg_rating      DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  total_rescues   INT          NOT NULL DEFAULT 0,
  ml_score        INT          NOT NULL DEFAULT 50,   -- RL-based score (0-100)
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 4. SERVICE REQUESTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_requests (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT          NOT NULL,
  provider_id     INT          DEFAULT NULL,
  vehicle_id      INT          DEFAULT NULL,
  service_type    ENUM('fuel_delivery','mechanic','both') NOT NULL,
  status          ENUM('pending','accepted','en_route','arrived','in_service','completed','cancelled') NOT NULL DEFAULT 'pending',

  -- Location
  latitude        DECIMAL(10,8) NOT NULL,
  longitude       DECIMAL(11,8) NOT NULL,
  address         VARCHAR(255) DEFAULT NULL,

  -- Fuel details
  fuel_type       ENUM('petrol','diesel','premium','kerosene') DEFAULT NULL,
  fuel_quantity   DECIMAL(6,2)  DEFAULT NULL,

  -- Mechanic details
  problem_type    VARCHAR(120) DEFAULT NULL,
  problem_notes   TEXT         DEFAULT NULL,

  -- Pricing
  estimated_price DECIMAL(10,2) DEFAULT NULL,
  final_price     DECIMAL(10,2) DEFAULT NULL,
  payment_method  ENUM('cash','card','transfer') DEFAULT 'cash',
  payment_status  ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',

  -- ML fields
  ml_eta_minutes  INT          DEFAULT NULL,   -- predicted ETA
  ml_demand_level ENUM('low','medium','high') DEFAULT NULL,
  ml_confidence   DECIMAL(5,2) DEFAULT NULL,   -- prediction confidence %

  -- Timestamps
  requested_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at     TIMESTAMP    DEFAULT NULL,
  arrived_at      TIMESTAMP    DEFAULT NULL,
  completed_at    TIMESTAMP    DEFAULT NULL,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (provider_id) REFERENCES service_providers(id),
  FOREIGN KEY (vehicle_id)  REFERENCES vehicles(id)
);

-- ─────────────────────────────────────────
-- 5. REVIEWS & RATINGS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  request_id      INT          NOT NULL UNIQUE,
  customer_id     INT          NOT NULL,
  provider_id     INT          NOT NULL,
  rating          TINYINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text     TEXT         DEFAULT NULL,
  sentiment_score DECIMAL(4,3) DEFAULT NULL,  -- NLP sentiment (-1 to 1)
  sentiment_label ENUM('positive','neutral','negative') DEFAULT NULL,
  is_flagged      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id)  REFERENCES service_requests(id),
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (provider_id) REFERENCES service_providers(id)
);

-- ─────────────────────────────────────────
-- 6. NOTIFICATIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT          NOT NULL,
  title           VARCHAR(150) NOT NULL,
  message         TEXT         NOT NULL,
  type            ENUM('request','status','payment','alert','ml_insight') NOT NULL DEFAULT 'alert',
  is_read         TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- 7. PAYMENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  request_id      INT          NOT NULL UNIQUE,
  customer_id     INT          NOT NULL,
  provider_id     INT          NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  method          ENUM('cash','card','transfer') NOT NULL DEFAULT 'cash',
  status          ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  transaction_ref VARCHAR(100) DEFAULT NULL,
  paid_at         TIMESTAMP    DEFAULT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id)  REFERENCES service_requests(id),
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (provider_id) REFERENCES service_providers(id)
);

-- ─────────────────────────────────────────
-- 8. ML DEMAND FORECAST LOG (for RL training data)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ml_demand_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  area_lat        DECIMAL(10,8) NOT NULL,
  area_lng        DECIMAL(11,8) NOT NULL,
  area_label      VARCHAR(100) DEFAULT NULL,
  demand_count    INT          NOT NULL DEFAULT 0,
  demand_level    ENUM('low','medium','high') NOT NULL,
  recorded_hour   TINYINT      NOT NULL,   -- 0–23
  recorded_day    TINYINT      NOT NULL,   -- 0=Mon, 6=Sun
  recorded_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- 9. FRAUD / ANOMALY LOG
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fraud_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  provider_id     INT          NOT NULL,
  anomaly_type    ENUM('overcharging','fake_completion','review_bot','location_spoof','other') NOT NULL,
  description     TEXT         DEFAULT NULL,
  severity        ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  status          ENUM('open','under_review','resolved','dismissed') NOT NULL DEFAULT 'open',
  detected_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at     TIMESTAMP    DEFAULT NULL,
  FOREIGN KEY (provider_id) REFERENCES service_providers(id)
);

-- ─────────────────────────────────────────
-- 10. ADMIN LOGS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_logs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  admin_id        INT          NOT NULL,
  action          VARCHAR(200) NOT NULL,
  target_table    VARCHAR(60)  DEFAULT NULL,
  target_id       INT          DEFAULT NULL,
  details         TEXT         DEFAULT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- ─────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────
CREATE INDEX idx_users_email       ON users(email);
CREATE INDEX idx_users_role        ON users(role);
CREATE INDEX idx_requests_customer ON service_requests(customer_id);
CREATE INDEX idx_requests_provider ON service_requests(provider_id);
CREATE INDEX idx_requests_status   ON service_requests(status);
CREATE INDEX idx_providers_loc     ON service_providers(latitude, longitude);
CREATE INDEX idx_providers_score   ON service_providers(ml_score DESC);
CREATE INDEX idx_reviews_provider  ON reviews(provider_id);
CREATE INDEX idx_notif_user        ON notifications(user_id, is_read);

-- ─────────────────────────────────────────
-- SEED: Default Admin
-- ─────────────────────────────────────────
INSERT INTO users (first_name, last_name, email, phone, password_hash, role, is_verified)
VALUES ('Super', 'Admin', 'admin@roadrescue.com', '+2348000000000',
        '$2b$10$placeholderhashreplacebeforeuse', 'admin', 1);