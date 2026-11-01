# College ERP – whole-project fixes (all 8 modules)

**Tested:** every API function was run against a local PostgreSQL copy built from your `data_import/*.csv` (47 read + write calls, all pass).
**Not tested:** your live Supabase database (the sandbox can't reach it), so your triggers/procedures were not exercised. Run `node scripts/verify_schema.cjs` first – it tells you in seconds if anything the code needs is missing.

## Apply (in this order)
1. Supabase SQL Editor → run `db/migrations/001_module2_and_sync_fixes.sql`, then `db/migrations/002_whole_project_fixes.sql` (each is one transaction and safe to re-run; if 002 fails on the unique-index step, run verification query 3 at the bottom of the file to find duplicate attendance rows).
2. Copy the files in this folder over the same paths in the project (or `git apply changes.patch`).
3. `node scripts/verify_schema.cjs` – should print "Schema OK".
4. Restart the server and rebuild the frontend.

## What changed, by module
| Module | Fix |
|---|---|
| **1 Student Mgmt** | Profile no longer joins `course` (that table holds subjects, so students got a random one); programme shown as "B.Tech <branch>". Registration uses `RETURNING` (no `insertId`), `CURRENT_DATE`, `roll_no::text` in the duplicate check, derived batch year, `is_active` written as boolean or int to match the column |
| **2 Faculty/Staff** | (from v1) grading per exam schedule, leave workflow with balances/cancel/approve, timetable, payroll. New: attendance counts use `COUNT(*)`, upsert by (session, student); student preview no longer needs views `v_student_*`; leave "cover" dropdown loads real colleagues (`GET /api/faculty/colleagues`) instead of a mock list |
| **3 Exams/Results** | Student exam timetable shows only the student's own department+semester (was every exam). Applications are stored as *Submitted / fee Pending* – no more auto "Paid + Approved". Results show the marks faculty entered; the invented 20/20/60 split and default grades are gone. Needs table `exam_application` (created by 002) |
| **4 Library** | Uses `issue_status`/`fine.issue_id`/`payment_status`; student sees own fine paid/due correctly; students get their own catalogue endpoint (`/api/students/library/catalog`) instead of the staff-only one; add-book creates copies (trigger keeps totals), works with either `shelf_no`/`shelf_location` and `condition`/`condition_status`; update-book only changes fields sent; no hard-coded librarian #1; fine collect can't double-collect |
| **5 Fees/Finance** | Student payment and cashier payment lock the invoice row (no double-spend), use the trigger-generated receipt number, return DB rule violations as 400. Invoices show scholarship and `balance_amount`. Fee structures use `department_id` (there is no `course_id`). Fine totals treat NULL status as Pending |
| **6 Attendance** | Student % counts Present+Late via one rule on both status columns; dashboard no longer shows invented 85 %; weekly trend is real |
| **7 Training & Placement** | `addCompany` returns the new row (was `insertId`); drive statuses unified with the student portal (`Scheduled` = open); eligibility shown to students checks branch (incl. "CS,IT" lists), CGPA, drive status and "already applied"; announcements use the real columns (`description`, `target_branch`); placement uses `package_lpa` number or text; trigger error text is shown to the student |
| **8 Academics** | Semester label built from `semester_number` + `academic_year` (no `semester_name` column exists); weekday ordering via `CASE`; dashboard timetable uses IST day, no hard-coded fallback classes |
| **Cross-portal sync** | Student dashboard auto-refreshes every 30 s so faculty attendance / staff fees show up without reload. Dual status columns are kept equal by triggers (002) |
| **Frontend** | Student dashboard, results, library, attendance, placement pages no longer use mock data or invented numbers; they show empty states |

## Known gaps (honest list)
- Live triggers/procedures were taken from the dump you pasted; anything not in that dump is assumed. `verify_schema.cjs` checks that the triggers exist on the tables the code relies on.
- Exam applications have no staff approval screen yet (they stay "Submitted").
- The "Examination comparison" chart on the student dashboard was removed (it was 100 % invented; the DB does not store the maximum marks of each component).
- Security items skipped as agreed (prototype).

## Test checklist
1. `node scripts/verify_schema.cjs` → "Schema OK".
2. Faculty marks attendance for one student Absent → student dashboard shows the new % within 30 s.
3. Student pays part of a fee → finance dashboard "collected" rises; paying more than the balance is refused.
4. Librarian issues a book, returns it late → exactly one fine, `available_copies` ±1; student library page shows the fine.
5. Student applies to a drive they are ineligible for → readable message; eligible one → appears in TNP applications.
6. Faculty saves marks for one subject → other subjects unchanged; student Results show them.
7. Student submits an exam application → appears as Submitted on the Exams page.
