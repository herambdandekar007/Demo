-- =============================================================================
-- 001_module2_and_sync_fixes.sql   (PostgreSQL / Supabase)
-- Run in the Supabase SQL Editor against the LIVE database. Idempotent; runs in one
-- transaction, so if any step fails nothing is applied.
-- Written against the live schema dump (singular table names). Review before running.
-- =============================================================================
BEGIN;

-- 1. faculty.faculty_code ------------------------------------------------------
-- authController (/auth/me, faculty registration) reads/writes faculty.faculty_code,
-- but the live table has no such column (the code only lived in user_account.identifier).
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS faculty_code varchar(30);
UPDATE faculty f SET faculty_code = u.identifier
  FROM user_account u WHERE u.faculty_id = f.faculty_id AND f.faculty_code IS NULL;
UPDATE faculty SET faculty_code = 'FAC-' || lpad(faculty_id::text, 3, '0') WHERE faculty_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_faculty_code ON faculty (faculty_code);


-- 3. Faculty leave: approval fields, code sequence, status values, balance table ----
ALTER TABLE faculty_leave ADD COLUMN IF NOT EXISTS approved_by integer;
ALTER TABLE faculty_leave ADD COLUMN IF NOT EXISTS approved_on date;

CREATE SEQUENCE IF NOT EXISTS faculty_leave_code_seq;
-- start high so generated codes cannot collide with existing seeded leave_code values
SELECT setval('faculty_leave_code_seq', GREATEST(nextval('faculty_leave_code_seq'), 1000));

-- Replace any CHECK on faculty_leave.status with the set the UI/API actually uses.
-- (Skipped with a NOTICE if status is a native ENUM type - see verification query 4.)
DO $$
DECLARE c record; coltype text;
BEGIN
  SELECT data_type INTO coltype FROM information_schema.columns
   WHERE table_name = 'faculty_leave' AND column_name = 'status';
  IF coltype IN ('character varying', 'text', 'character') THEN
    FOR c IN SELECT conname FROM pg_constraint
              WHERE conrelid = 'faculty_leave'::regclass AND contype = 'c'
                AND pg_get_constraintdef(oid) ILIKE '%status%' LOOP
      EXECUTE format('ALTER TABLE faculty_leave DROP CONSTRAINT %I', c.conname);
    END LOOP;
    ALTER TABLE faculty_leave ADD CONSTRAINT chk_leave_status
      CHECK (status IN ('Pending Dean Review', 'Request Sent', 'Approved', 'Rejected', 'Cancelled'));
  ELSE
    RAISE NOTICE 'faculty_leave.status is % - add the missing values with ALTER TYPE ... ADD VALUE manually', coltype;
  END IF;
END $$;

ALTER TABLE faculty_leave DROP CONSTRAINT IF EXISTS chk_leave_dates;
ALTER TABLE faculty_leave ADD CONSTRAINT chk_leave_dates CHECK (end_date >= start_date) NOT VALID;

CREATE TABLE IF NOT EXISTS faculty_leave_balance (
  faculty_id integer NOT NULL REFERENCES faculty (faculty_id) ON DELETE CASCADE,
  leave_type varchar(50) NOT NULL,
  year       integer NOT NULL,
  allotted   numeric(5,1) NOT NULL,
  used       numeric(5,1) NOT NULL DEFAULT 0,
  PRIMARY KEY (faculty_id, leave_type, year),
  CHECK (used >= 0 AND used <= allotted)
);
-- Default yearly allotment for the leave types shown in the UI (edit numbers to your policy)
INSERT INTO faculty_leave_balance (faculty_id, leave_type, year, allotted)
SELECT f.faculty_id, t.leave_type, EXTRACT(YEAR FROM CURRENT_DATE)::int, t.allotted
  FROM faculty f
  CROSS JOIN (VALUES ('Casual Leave (CL)', 12), ('Sick Leave (SL)', 10), ('Earned Leave (EL)', 15)) AS t(leave_type, allotted)
ON CONFLICT DO NOTHING;

-- 4. Faculty payroll: the payslip UI shows these fields, the table never had them ----
ALTER TABLE faculty_payroll ADD COLUMN IF NOT EXISTS slip_id varchar(50);
ALTER TABLE faculty_payroll ADD COLUMN IF NOT EXISTS travel_allowance numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE faculty_payroll ADD COLUMN IF NOT EXISTS academic_allowance numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE faculty_payroll ADD COLUMN IF NOT EXISTS pf_deduction numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE faculty_payroll ADD COLUMN IF NOT EXISTS income_tax numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE faculty_payroll ADD COLUMN IF NOT EXISTS professional_tax numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE faculty_payroll ADD COLUMN IF NOT EXISTS payment_mode varchar(100) DEFAULT 'Bank Transfer';
UPDATE faculty_payroll SET slip_id = 'PAY-' || payroll_id WHERE slip_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_slip ON faculty_payroll (slip_id);
-- Split the existing single "deductions" figure into components (estimate: 12% PF of basic,
-- Rs 200 professional tax, remainder income tax). Only touches rows not yet split.
UPDATE faculty_payroll
   SET pf_deduction = ROUND(basic_pay * 0.12, 2),
       professional_tax = LEAST(200, deductions),
       income_tax = GREATEST(deductions - ROUND(basic_pay * 0.12, 2) - LEAST(200, deductions), 0)
 WHERE pf_deduction = 0 AND income_tax = 0 AND professional_tax = 0 AND deductions > 0;
ALTER TABLE faculty_payroll DROP CONSTRAINT IF EXISTS chk_payroll_net;
ALTER TABLE faculty_payroll ADD CONSTRAINT chk_payroll_net CHECK (net_salary = gross_salary - deductions) NOT VALID;

-- 5. Fee status values: fn_student_fee_defaults wrote 'Partial', fn_payment_after writes 'Partially Paid'
CREATE OR REPLACE FUNCTION fn_student_fee_defaults() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.amount_due := COALESCE(NEW.amount_due,
    (SELECT amount FROM fee_structure WHERE fee_structure_id = NEW.fee_structure_id));
  NEW.scholarship_amount := COALESCE(NEW.scholarship_amount,
    (SELECT amount FROM scholarship WHERE scholarship_id = NEW.scholarship_id), 0);
  NEW.amount_paid     := COALESCE(NEW.amount_paid, 0);
  NEW.balance_amount  := GREATEST(NEW.amount_due - NEW.scholarship_amount - NEW.amount_paid, 0);
  NEW.status := CASE WHEN NEW.balance_amount = 0 THEN 'Paid'
                     WHEN NEW.amount_paid = 0    THEN 'Unpaid' ELSE 'Partially Paid' END;
  RETURN NEW;
END $$;
UPDATE student_fee SET status = 'Partially Paid' WHERE status = 'Partial';

-- 6. TNP: staff UI sets drives to 'Open for Registration', but the eligibility trigger only
--    allowed 'Scheduled'/'Open', so students could not apply to such drives.
CREATE OR REPLACE FUNCTION fn_application_eligibility() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e eligibility%ROWTYPE; d job_drive%ROWTYPE; v_branch text; v_cgpa numeric; v_backlog boolean;
BEGIN
  SELECT * INTO d FROM job_drive WHERE drive_id = NEW.drive_id;
  IF d.status NOT IN ('Scheduled','Open','Open for Registration') THEN
    RAISE EXCEPTION 'Drive % is not open for applications (status: %)', NEW.drive_id, d.status;
  END IF;
  SELECT * INTO e FROM eligibility WHERE drive_id = NEW.drive_id;
  IF FOUND THEN
    SELECT branch INTO v_branch FROM student WHERE student_id = NEW.student_id;
    IF e.allowed_branch <> 'All' AND NOT (v_branch = ANY (string_to_array(replace(e.allowed_branch,' ',''), ','))) THEN
      RAISE EXCEPTION 'Branch % is not eligible for this drive (allowed: %)', v_branch, e.allowed_branch;
    END IF;
    SELECT cgpa INTO v_cgpa FROM result WHERE student_id = NEW.student_id
     ORDER BY result_date DESC, result_id DESC LIMIT 1;
    IF v_cgpa IS NOT NULL AND v_cgpa < e.minimum_cgpa THEN
      RAISE EXCEPTION 'CGPA % is below the minimum % required', v_cgpa, e.minimum_cgpa;
    END IF;
    SELECT EXISTS (SELECT 1 FROM result WHERE student_id = NEW.student_id AND overall_status = 'ATKT') INTO v_backlog;
    IF e.backlog_allowed = 'No' AND v_backlog THEN
      RAISE EXCEPTION 'Students with active backlogs cannot apply to this drive';
    END IF;
  END IF;
  NEW.application_date := COALESCE(NEW.application_date, current_date);
  NEW.status := COALESCE(NEW.status, 'Applied');
  RETURN NEW;
END $$;

-- 7. Faculty grading -> student result sync --------------------------------------
-- Nothing called calculate_result(), so saving marks never changed SGPA/CGPA.
-- Failure inside calculate_result is downgraded to a WARNING so a grade save is never blocked.
CREATE OR REPLACE FUNCTION fn_marks_results_sync() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_exam integer;
BEGIN
  SELECT exam_id INTO v_exam FROM exam_schedule WHERE schedule_id = NEW.schedule_id;
  IF v_exam IS NOT NULL THEN
    BEGIN
      CALL calculate_result(NEW.student_id, v_exam);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'calculate_result(%, %) failed: %', NEW.student_id, v_exam, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_marks_results_sync ON marks;
CREATE TRIGGER trg_marks_results_sync
  AFTER INSERT OR UPDATE OF marks_obtained, mid_sem, internal_marks, end_sem ON marks
  FOR EACH ROW EXECUTE FUNCTION fn_marks_results_sync();

COMMIT;

-- =============================================================================
-- VERIFICATION (run after COMMIT; none of these change data)
-- =============================================================================
-- 1. Is the grade trigger actually attached to marks? (needed for trg_marks_results_sync to work)
--    select trigger_name, action_timing, event_manipulation from information_schema.triggers where event_object_table='marks';
-- 2. Which triggers sit on payment? Overlapping ones should be dropped (see below).
--    select trigger_name, action_timing, event_manipulation, action_statement from information_schema.triggers where event_object_table='payment';
-- 3. How many migrated leaves / payrolls look sane?
--    select status, count(*) from faculty_leave group by 1;
--    select count(*) from faculty_payroll where net_salary <> gross_salary - deductions;
-- 4. Is faculty_leave.status an enum?
--    select data_type, udt_name from information_schema.columns where table_name='faculty_leave' and column_name='status';
--
-- OPTIONAL cleanup - only if query 2 shows these attached (they duplicate fn_payment_before/after):
--    drop trigger <name> on payment;   -- the one that calls fn_payment_no_overpay
--    drop procedure if exists sp_record_payment(...);   -- writes a non-existent column transaction_ref
