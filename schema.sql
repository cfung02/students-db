-- ============================================================
-- CENTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS centers (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  address    VARCHAR(255),
  phone      VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PARENTS / GUARDIANS
-- ============================================================
CREATE TABLE IF NOT EXISTS parents (
  id         SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name  VARCHAR(100) NOT NULL,
  email      VARCHAR(150),
  phone      VARCHAR(30),
  street     VARCHAR(255),
  town       VARCHAR(100),
  state      VARCHAR(50),
  zip        VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id            SERIAL PRIMARY KEY,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  birthday      DATE,
  shirt_size    VARCHAR(10),
  enrolled_date DATE,
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STUDENT <-> PARENT LINK
-- ============================================================
CREATE TABLE IF NOT EXISTS student_parents (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id    INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  relationship VARCHAR(50) CHECK (relationship IN ('mother', 'father', 'guardian', 'other')),
  UNIQUE (student_id, parent_id)
);

-- ============================================================
-- HEALTH
-- ============================================================
CREATE TABLE IF NOT EXISTS health (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  health_notes TEXT,
  medications  TEXT,
  allergy      TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ENROLLMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS enrollments (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  center_id   INTEGER NOT NULL REFERENCES centers(id),
  session     VARCHAR(20) NOT NULL CHECK (session IN ('spring', 'summer', 'fall')),
  year        INTEGER NOT NULL,
  group_name  VARCHAR(100),
  new_group   VARCHAR(100),
  culinary    BOOLEAN DEFAULT FALSE,
  start_date  DATE,
  end_date    DATE,
  weeks       INTEGER,  -- summer only
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCHEDULES  (new row each time schedule changes)
-- ============================================================
CREATE TABLE IF NOT EXISTS schedules (
  id             SERIAL PRIMARY KEY,
  enrollment_id  INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  time_in        TIME,
  time_out       TIME,
  mon            BOOLEAN DEFAULT FALSE,
  tue            BOOLEAN DEFAULT FALSE,
  wed            BOOLEAN DEFAULT FALSE,
  thu            BOOLEAN DEFAULT FALSE,
  fri            BOOLEAN DEFAULT FALSE,
  num_days       INTEGER,
  schedule_notes TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSPORTATION  (per enrollment)
-- ============================================================
CREATE TABLE IF NOT EXISTS transportation (
  id                SERIAL PRIMARY KEY,
  enrollment_id     INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  uses_transport    BOOLEAN DEFAULT FALSE,
  transport_notes   TEXT,
  route             VARCHAR(50),
  new_route         VARCHAR(50),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROSPECTS  (inquiry log)
-- ============================================================
CREATE TABLE IF NOT EXISTS prospects (
  id                SERIAL PRIMARY KEY,
  center_id         INTEGER REFERENCES centers(id),
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  email             VARCHAR(150),
  phone             VARCHAR(30),
  inquiry_date      DATE DEFAULT CURRENT_DATE,
  interested_session VARCHAR(20) CHECK (interested_session IN ('spring', 'summer', 'fall')),
  notes             TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'contacted', 'enrolled', 'lost')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
