-- Update students status constraint
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students ALTER COLUMN status SET DEFAULT 'prospect';
ALTER TABLE students ADD CONSTRAINT students_status_check
  CHECK (status IN ('prospect','touring','enrolling','waitlist','active','on_hold','withdrawn','alumni'));

-- Update prospects status constraint
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_status_check;
ALTER TABLE prospects ADD CONSTRAINT prospects_status_check
  CHECK (status IN ('new','contacted','touring','enrolling','enrolled','lost'));

-- Link prospect to student when converted
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id);
