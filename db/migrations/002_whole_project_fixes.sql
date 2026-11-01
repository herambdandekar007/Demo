-- =============================================================================
-- 002_whole_project_fixes.sql   (PostgreSQL / Supabase)
-- Run AFTER 001. Idempotent, single transaction. Review before running.
-- =============================================================================
BEGIN;

-- 0. Safety net: columns the leave screens read (no-op if they already exist)
ALTER TABLE faculty_leave ADD COLUMN IF NOT EXISTS approver_comments text;
ALTER TABLE faculty_leave ADD COLUMN IF NOT EXISTS approved_by integer;
ALTER TABLE faculty_leave ADD COLUMN IF NOT EXISTS approved_on date;

-- 1. exam_application ---------------------------------------------------------
-- The student portal reads/writes this table but it was never part of the live DB
-- (it only existed in the old MySQL schema file). Plain varchar + CHECK so the
-- API's values are accepted.
CREATE TABLE IF NOT EXISTS exam_application (
  application_id   serial PRIMARY KEY,
  app_code         varchar(50)  NOT NULL UNIQUE,
  student_id       integer      NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  type             varchar(40)  NOT NULL,
  semester_label   varchar(100) NOT NULL,
  subject_code     varchar(20),
  submission_date  date         NOT NULL DEFAULT CURRENT_DATE,
  fee_status       varchar(20)  NOT NULL DEFAULT 'Pending',
  approval_status  varchar(30)  NOT NULL DEFAULT 'Submitted',
  created_at       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT chk_exapp_type     CHECK (type IN ('Regular Semester Exam','Paper Revaluation','Backlog / ATKT')),
  CONSTRAINT chk_exapp_fee      CHECK (fee_status IN ('Paid','Exempted','Pending')),
  CONSTRAINT chk_exapp_approval CHECK (approval_status IN ('Approved','Under Verification','Submitted','Rejected'))
);
CREATE INDEX IF NOT EXISTS idx_exapp_student ON exam_application (student_id);

-- 2. Attendance: one record per (session, student) -------------------------------
-- saveAttendance upserts on this pair; a unique index makes double-marking impossible.
-- (If this fails, you already have duplicate rows - run verification query 3 and clean them first.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_session_student ON attendance_record (session_id, student_id);

-- Keep the two duplicate status columns identical whichever one a writer fills in.
CREATE OR REPLACE FUNCTION fn_attendance_sync_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- if only the legacy `status` column was edited, it wins; otherwise attendance_status wins
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.attendance_status IS NOT DISTINCT FROM OLD.attendance_status THEN
    NEW.attendance_status := NEW.status;
  END IF;
  NEW.attendance_status := COALESCE(NEW.attendance_status, NEW.status, 'Present');
  NEW.status := NEW.attendance_status;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_attendance_sync_status ON attendance_record;
CREATE TRIGGER trg_attendance_sync_status BEFORE INSERT OR UPDATE ON attendance_record
  FOR EACH ROW EXECUTE FUNCTION fn_attendance_sync_status();

-- 3. Library: same idea for book_issue.status / issue_status and fine.payment_status / paid_status
CREATE OR REPLACE FUNCTION fn_issue_sync_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.issue_status IS NOT DISTINCT FROM OLD.issue_status THEN
    NEW.issue_status := NEW.status;
  END IF;
  NEW.issue_status := COALESCE(NEW.issue_status, NEW.status);
  NEW.status := NEW.issue_status;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_issue_sync_status ON book_issue;
CREATE TRIGGER trg_issue_sync_status BEFORE INSERT OR UPDATE ON book_issue
  FOR EACH ROW EXECUTE FUNCTION fn_issue_sync_status();

CREATE OR REPLACE FUNCTION fn_fine_sync_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.paid_status IS DISTINCT FROM OLD.paid_status AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN
    NEW.payment_status := NEW.paid_status;
  END IF;
  NEW.payment_status := COALESCE(NEW.payment_status, NEW.paid_status, 'Pending');
  NEW.paid_status := NEW.payment_status;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fine_sync_status ON fine;
CREATE TRIGGER trg_fine_sync_status BEFORE INSERT OR UPDATE ON fine
  FOR EACH ROW EXECUTE FUNCTION fn_fine_sync_status();

-- One-off repair of rows where the pair already disagrees
UPDATE attendance_record SET attendance_status = COALESCE(attendance_status, status), status = COALESCE(attendance_status, status)
 WHERE attendance_status IS DISTINCT FROM status;
UPDATE book_issue SET issue_status = COALESCE(issue_status, status), status = COALESCE(issue_status, status)
 WHERE issue_status IS DISTINCT FROM status;
UPDATE fine SET payment_status = COALESCE(payment_status, paid_status, 'Pending'), paid_status = COALESCE(payment_status, paid_status, 'Pending')
 WHERE payment_status IS DISTINCT FROM paid_status OR payment_status IS NULL;

-- 4. job_drive.status vocabulary -----------------------------------------------------
-- 'Scheduled' is what the seed data and the student portal use for "open for applications".
-- Rewrite the legacy label the old TNP screen produced.
UPDATE job_drive SET status = 'Scheduled' WHERE status IN ('Open for Registration', 'Upcoming', 'Open');

-- 5. Lookups used by the dashboards ------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_att_rec_student   ON attendance_record (student_id);
CREATE INDEX IF NOT EXISTS idx_att_ses_date      ON attendance_session (session_date);
CREATE INDEX IF NOT EXISTS idx_book_issue_student ON book_issue (student_id);
CREATE INDEX IF NOT EXISTS idx_fine_issue        ON fine (issue_id);
CREATE INDEX IF NOT EXISTS idx_application_student ON application (student_id, drive_id);

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (run separately, not part of the transaction)
-- 1) Triggers present on the tables the app relies on:
--    SELECT event_object_table, trigger_name FROM information_schema.triggers
--     WHERE trigger_schema = 'public' ORDER BY 1, 2;
--    Expected among them: payment (fn_payment_before/after), marks (fn_marks_grade),
--    book_issue, book_return, application (fn_application_eligibility), placement,
--    attendance_record (fn_attendance_check), timetable (fn_timetable_clash).
-- 2) Does marks have the grading trigger?
--    SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'marks';
-- 3) Duplicate attendance rows blocking the unique index:
--    SELECT session_id, student_id, COUNT(*) FROM attendance_record GROUP BY 1,2 HAVING COUNT(*) > 1;
-- 4) Column types of the dual status columns:
--    SELECT table_name, column_name, data_type, udt_name FROM information_schema.columns
--     WHERE (table_name, column_name) IN (('book_issue','status'),('book_issue','issue_status'),
--           ('fine','payment_status'),('fine','paid_status'),('attendance_record','status'),
--           ('attendance_record','attendance_status'),('user_account','is_active'),('faculty_leave','status'));
-- =============================================================================
