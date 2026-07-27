-- d1_migrations の適用履歴を 0033-0113 の連番名へ書き換える。
--
-- 背景: legacy migration 81 件を連番化した。d1_migrations は適用済みかを
-- ファイル名で判定するため、この書き換えを行わないと 81 件が未適用と見なされて
-- 再実行され、0036_application_lifecycle_binding.sql の ALTER TABLE ADD COLUMN 等が
-- duplicate column で失敗する。
--
-- 適用順序は変えていない。名前だけを置き換える。
--
-- bun run db:migrate:local と bun run db:migrate がこの SQL を先に流すため、
-- 通常運用で個別に実行する必要はない。手動で流す場合は次を使う。
--
--   bunx wrangler d1 execute bedrock --local  --file=./scripts/repair-migration-history.sql
--   bunx wrangler d1 execute bedrock --remote --file=./scripts/repair-migration-history.sql
--
-- 冪等である。次のいずれの状態から流しても同じ結果に収束する。
--   - 新規 database（d1_migrations が無い。CREATE TABLE IF NOT EXISTS で空表を作る）
--   - 旧名のまま適用済みの database
--   - 書き換え済みの database
--   - repair を流さずに migrate を試み、一部だけ新名で再適用された database
-- 新名の行が既にある場合は旧名の行を捨てる。DELETE を先、UPDATE を後にする。
-- 逆順にすると UNIQUE 制約に衝突して中断する。
--
-- 定義は wrangler が作る d1_migrations に合わせる。既にあれば何もしない。
CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DELETE FROM d1_migrations WHERE name = 'announcement.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0033_announcement.sql');
UPDATE d1_migrations SET name = '0033_announcement.sql' WHERE name = 'announcement.sql';
DELETE FROM d1_migrations WHERE name = 'antisocial-check.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0034_antisocial_check.sql');
UPDATE d1_migrations SET name = '0034_antisocial_check.sql' WHERE name = 'antisocial-check.sql';
DELETE FROM d1_migrations WHERE name = 'application.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0035_application.sql');
UPDATE d1_migrations SET name = '0035_application.sql' WHERE name = 'application.sql';
DELETE FROM d1_migrations WHERE name = 'application_lifecycle_binding.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0036_application_lifecycle_binding.sql');
UPDATE d1_migrations SET name = '0036_application_lifecycle_binding.sql' WHERE name = 'application_lifecycle_binding.sql';
DELETE FROM d1_migrations WHERE name = 'application_personnel_action_request_state.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0037_application_personnel_action_request_state.sql');
UPDATE d1_migrations SET name = '0037_application_personnel_action_request_state.sql' WHERE name = 'application_personnel_action_request_state.sql';
DELETE FROM d1_migrations WHERE name = 'application_personnel_action_template.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0038_application_personnel_action_template.sql');
UPDATE d1_migrations SET name = '0038_application_personnel_action_template.sql' WHERE name = 'application_personnel_action_template.sql';
DELETE FROM d1_migrations WHERE name = 'application_workflow_atomic.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0039_application_workflow_atomic.sql');
UPDATE d1_migrations SET name = '0039_application_workflow_atomic.sql' WHERE name = 'application_workflow_atomic.sql';
DELETE FROM d1_migrations WHERE name = 'asset.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0040_asset.sql');
UPDATE d1_migrations SET name = '0040_asset.sql' WHERE name = 'asset.sql';
DELETE FROM d1_migrations WHERE name = 'asset_dispose.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0041_asset_dispose.sql');
UPDATE d1_migrations SET name = '0041_asset_dispose.sql' WHERE name = 'asset_dispose.sql';
DELETE FROM d1_migrations WHERE name = 'attendance.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0042_attendance.sql');
UPDATE d1_migrations SET name = '0042_attendance.sql' WHERE name = 'attendance.sql';
DELETE FROM d1_migrations WHERE name = 'attendance_clock_in_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0043_attendance_clock_in_unique.sql');
UPDATE d1_migrations SET name = '0043_attendance_clock_in_unique.sql' WHERE name = 'attendance_clock_in_unique.sql';
DELETE FROM d1_migrations WHERE name = 'auth.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0044_auth.sql');
UPDATE d1_migrations SET name = '0044_auth.sql' WHERE name = 'auth.sql';
DELETE FROM d1_migrations WHERE name = 'batch.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0045_batch.sql');
UPDATE d1_migrations SET name = '0045_batch.sql' WHERE name = 'batch.sql';
DELETE FROM d1_migrations WHERE name = 'budget.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0046_budget.sql');
UPDATE d1_migrations SET name = '0046_budget.sql' WHERE name = 'budget.sql';
DELETE FROM d1_migrations WHERE name = 'business-trip.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0047_business_trip.sql');
UPDATE d1_migrations SET name = '0047_business_trip.sql' WHERE name = 'business-trip.sql';
DELETE FROM d1_migrations WHERE name = 'calendar.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0048_calendar.sql');
UPDATE d1_migrations SET name = '0048_calendar.sql' WHERE name = 'calendar.sql';
DELETE FROM d1_migrations WHERE name = 'career.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0049_career.sql');
UPDATE d1_migrations SET name = '0049_career.sql' WHERE name = 'career.sql';
DELETE FROM d1_migrations WHERE name = 'career_application_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0050_career_application_unique.sql');
UPDATE d1_migrations SET name = '0050_career_application_unique.sql' WHERE name = 'career_application_unique.sql';
DELETE FROM d1_migrations WHERE name = 'certificate-request.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0051_certificate_request.sql');
UPDATE d1_migrations SET name = '0051_certificate_request.sql' WHERE name = 'certificate-request.sql';
DELETE FROM d1_migrations WHERE name = 'certification.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0052_certification.sql');
UPDATE d1_migrations SET name = '0052_certification.sql' WHERE name = 'certification.sql';
DELETE FROM d1_migrations WHERE name = 'commendation.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0053_commendation.sql');
UPDATE d1_migrations SET name = '0053_commendation.sql' WHERE name = 'commendation.sql';
DELETE FROM d1_migrations WHERE name = 'dashboard.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0054_dashboard.sql');
UPDATE d1_migrations SET name = '0054_dashboard.sql' WHERE name = 'dashboard.sql';
DELETE FROM d1_migrations WHERE name = 'decision.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0055_decision.sql');
UPDATE d1_migrations SET name = '0055_decision.sql' WHERE name = 'decision.sql';
DELETE FROM d1_migrations WHERE name = 'disciplinary_action.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0056_disciplinary_action.sql');
UPDATE d1_migrations SET name = '0056_disciplinary_action.sql' WHERE name = 'disciplinary_action.sql';
DELETE FROM d1_migrations WHERE name = 'document.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0057_document.sql');
UPDATE d1_migrations SET name = '0057_document.sql' WHERE name = 'document.sql';
DELETE FROM d1_migrations WHERE name = 'employee-event.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0058_employee_event.sql');
UPDATE d1_migrations SET name = '0058_employee_event.sql' WHERE name = 'employee-event.sql';
DELETE FROM d1_migrations WHERE name = 'employee_email_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0059_employee_email_unique.sql');
UPDATE d1_migrations SET name = '0059_employee_email_unique.sql' WHERE name = 'employee_email_unique.sql';
DELETE FROM d1_migrations WHERE name = 'expense.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0060_expense.sql');
UPDATE d1_migrations SET name = '0060_expense.sql' WHERE name = 'expense.sql';
DELETE FROM d1_migrations WHERE name = 'family-care-leave.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0061_family_care_leave.sql');
UPDATE d1_migrations SET name = '0061_family_care_leave.sql' WHERE name = 'family-care-leave.sql';
DELETE FROM d1_migrations WHERE name = 'goal.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0062_goal.sql');
UPDATE d1_migrations SET name = '0062_goal.sql' WHERE name = 'goal.sql';
DELETE FROM d1_migrations WHERE name = 'goal_evaluation_self_manager_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0063_goal_evaluation_self_manager_unique.sql');
UPDATE d1_migrations SET name = '0063_goal_evaluation_self_manager_unique.sql' WHERE name = 'goal_evaluation_self_manager_unique.sql';
DELETE FROM d1_migrations WHERE name = 'goal_evaluation_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0064_goal_evaluation_unique.sql');
UPDATE d1_migrations SET name = '0064_goal_evaluation_unique.sql' WHERE name = 'goal_evaluation_unique.sql';
DELETE FROM d1_migrations WHERE name = 'goal_tree.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0065_goal_tree.sql');
UPDATE d1_migrations SET name = '0065_goal_tree.sql' WHERE name = 'goal_tree.sql';
DELETE FROM d1_migrations WHERE name = 'grade.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0066_grade.sql');
UPDATE d1_migrations SET name = '0066_grade.sql' WHERE name = 'grade.sql';
DELETE FROM d1_migrations WHERE name = 'grade_review_link.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0067_grade_review_link.sql');
UPDATE d1_migrations SET name = '0067_grade_review_link.sql' WHERE name = 'grade_review_link.sql';
DELETE FROM d1_migrations WHERE name = 'headcount_plan.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0068_headcount_plan.sql');
UPDATE d1_migrations SET name = '0068_headcount_plan.sql' WHERE name = 'headcount_plan.sql';
DELETE FROM d1_migrations WHERE name = 'health_checkup.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0069_health_checkup.sql');
UPDATE d1_migrations SET name = '0069_health_checkup.sql' WHERE name = 'health_checkup.sql';
DELETE FROM d1_migrations WHERE name = 'it_incident.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0070_it_incident.sql');
UPDATE d1_migrations SET name = '0070_it_incident.sql' WHERE name = 'it_incident.sql';
DELETE FROM d1_migrations WHERE name = 'knowledge.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0071_knowledge.sql');
UPDATE d1_migrations SET name = '0071_knowledge.sql' WHERE name = 'knowledge.sql';
DELETE FROM d1_migrations WHERE name = 'leave.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0072_leave.sql');
UPDATE d1_migrations SET name = '0072_leave.sql' WHERE name = 'leave.sql';
DELETE FROM d1_migrations WHERE name = 'license.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0073_license.sql');
UPDATE d1_migrations SET name = '0073_license.sql' WHERE name = 'license.sql';
DELETE FROM d1_migrations WHERE name = 'life-event.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0074_life_event.sql');
UPDATE d1_migrations SET name = '0074_life_event.sql' WHERE name = 'life-event.sql';
DELETE FROM d1_migrations WHERE name = 'meeting.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0075_meeting.sql');
UPDATE d1_migrations SET name = '0075_meeting.sql' WHERE name = 'meeting.sql';
DELETE FROM d1_migrations WHERE name = 'notification.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0076_notification.sql');
UPDATE d1_migrations SET name = '0076_notification.sql' WHERE name = 'notification.sql';
DELETE FROM d1_migrations WHERE name = 'onboarding.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0077_onboarding.sql');
UPDATE d1_migrations SET name = '0077_onboarding.sql' WHERE name = 'onboarding.sql';
DELETE FROM d1_migrations WHERE name = 'onboarding_assignment_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0078_onboarding_assignment_unique.sql');
UPDATE d1_migrations SET name = '0078_onboarding_assignment_unique.sql' WHERE name = 'onboarding_assignment_unique.sql';
DELETE FROM d1_migrations WHERE name = 'oneonone.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0079_oneonone.sql');
UPDATE d1_migrations SET name = '0079_oneonone.sql' WHERE name = 'oneonone.sql';
DELETE FROM d1_migrations WHERE name = 'partner.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0080_partner.sql');
UPDATE d1_migrations SET name = '0080_partner.sql' WHERE name = 'partner.sql';
DELETE FROM d1_migrations WHERE name = 'payroll.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0081_payroll.sql');
UPDATE d1_migrations SET name = '0081_payroll.sql' WHERE name = 'payroll.sql';
DELETE FROM d1_migrations WHERE name = 'payslip-period-unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0082_payslip_period_unique.sql');
UPDATE d1_migrations SET name = '0082_payslip_period_unique.sql' WHERE name = 'payslip-period-unique.sql';
DELETE FROM d1_migrations WHERE name = 'position.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0083_position.sql');
UPDATE d1_migrations SET name = '0083_position.sql' WHERE name = 'position.sql';
DELETE FROM d1_migrations WHERE name = 'recruitment.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0084_recruitment.sql');
UPDATE d1_migrations SET name = '0084_recruitment.sql' WHERE name = 'recruitment.sql';
DELETE FROM d1_migrations WHERE name = 'regulation.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0085_regulation.sql');
UPDATE d1_migrations SET name = '0085_regulation.sql' WHERE name = 'regulation.sql';
DELETE FROM d1_migrations WHERE name = 'rental.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0086_rental.sql');
UPDATE d1_migrations SET name = '0086_rental.sql' WHERE name = 'rental.sql';
DELETE FROM d1_migrations WHERE name = 'resignation.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0087_resignation.sql');
UPDATE d1_migrations SET name = '0087_resignation.sql' WHERE name = 'resignation.sql';
DELETE FROM d1_migrations WHERE name = 'resignation_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0088_resignation_unique.sql');
UPDATE d1_migrations SET name = '0088_resignation_unique.sql' WHERE name = 'resignation_unique.sql';
DELETE FROM d1_migrations WHERE name = 'review.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0089_review.sql');
UPDATE d1_migrations SET name = '0089_review.sql' WHERE name = 'review.sql';
DELETE FROM d1_migrations WHERE name = 'review_approval_admin_scope.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0090_review_approval_admin_scope.sql');
UPDATE d1_migrations SET name = '0090_review_approval_admin_scope.sql' WHERE name = 'review_approval_admin_scope.sql';
DELETE FROM d1_migrations WHERE name = 'review_form_assignment_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0091_review_form_assignment_unique.sql');
UPDATE d1_migrations SET name = '0091_review_form_assignment_unique.sql' WHERE name = 'review_form_assignment_unique.sql';
DELETE FROM d1_migrations WHERE name = 'review_form_comment.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0092_review_form_comment.sql');
UPDATE d1_migrations SET name = '0092_review_form_comment.sql' WHERE name = 'review_form_comment.sql';
DELETE FROM d1_migrations WHERE name = 'review_visibility.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0093_review_visibility.sql');
UPDATE d1_migrations SET name = '0093_review_visibility.sql' WHERE name = 'review_visibility.sql';
DELETE FROM d1_migrations WHERE name = 'ringi.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0094_ringi.sql');
UPDATE d1_migrations SET name = '0094_ringi.sql' WHERE name = 'ringi.sql';
DELETE FROM d1_migrations WHERE name = 'room.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0095_room.sql');
UPDATE d1_migrations SET name = '0095_room.sql' WHERE name = 'room.sql';
DELETE FROM d1_migrations WHERE name = 'room_reservations_room_time_index.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0096_room_reservations_room_time_index.sql');
UPDATE d1_migrations SET name = '0096_room_reservations_room_time_index.sql' WHERE name = 'room_reservations_room_time_index.sql';
DELETE FROM d1_migrations WHERE name = 'salary_revisions_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0097_salary_revisions_unique.sql');
UPDATE d1_migrations SET name = '0097_salary_revisions_unique.sql' WHERE name = 'salary_revisions_unique.sql';
DELETE FROM d1_migrations WHERE name = 'shift.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0098_shift.sql');
UPDATE d1_migrations SET name = '0098_shift.sql' WHERE name = 'shift.sql';
DELETE FROM d1_migrations WHERE name = 'shift_assignment_employee_date_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0099_shift_assignment_employee_date_unique.sql');
UPDATE d1_migrations SET name = '0099_shift_assignment_employee_date_unique.sql' WHERE name = 'shift_assignment_employee_date_unique.sql';
DELETE FROM d1_migrations WHERE name = 'shift_swap_request_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0100_shift_swap_request_unique.sql');
UPDATE d1_migrations SET name = '0100_shift_swap_request_unique.sql' WHERE name = 'shift_swap_request_unique.sql';
DELETE FROM d1_migrations WHERE name = 'skill.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0101_skill.sql');
UPDATE d1_migrations SET name = '0101_skill.sql' WHERE name = 'skill.sql';
DELETE FROM d1_migrations WHERE name = 'stocktake.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0102_stocktake.sql');
UPDATE d1_migrations SET name = '0102_stocktake.sql' WHERE name = 'stocktake.sql';
DELETE FROM d1_migrations WHERE name = 'survey.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0103_survey.sql');
UPDATE d1_migrations SET name = '0103_survey.sql' WHERE name = 'survey.sql';
DELETE FROM d1_migrations WHERE name = 'survey_response_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0104_survey_response_unique.sql');
UPDATE d1_migrations SET name = '0104_survey_response_unique.sql' WHERE name = 'survey_response_unique.sql';
DELETE FROM d1_migrations WHERE name = 'thanks-points.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0105_thanks_points.sql');
UPDATE d1_migrations SET name = '0105_thanks_points.sql' WHERE name = 'thanks-points.sql';
DELETE FROM d1_migrations WHERE name = 'thanks-redemption-pending-unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0106_thanks_redemption_pending_unique.sql');
UPDATE d1_migrations SET name = '0106_thanks_redemption_pending_unique.sql' WHERE name = 'thanks-redemption-pending-unique.sql';
DELETE FROM d1_migrations WHERE name = 'thanks.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0107_thanks.sql');
UPDATE d1_migrations SET name = '0107_thanks.sql' WHERE name = 'thanks.sql';
DELETE FROM d1_migrations WHERE name = 'training.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0108_training.sql');
UPDATE d1_migrations SET name = '0108_training.sql' WHERE name = 'training.sql';
DELETE FROM d1_migrations WHERE name = 'training_enrollment_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0109_training_enrollment_unique.sql');
UPDATE d1_migrations SET name = '0109_training_enrollment_unique.sql' WHERE name = 'training_enrollment_unique.sql';
DELETE FROM d1_migrations WHERE name = 'work_accident.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0110_work_accident.sql');
UPDATE d1_migrations SET name = '0110_work_accident.sql' WHERE name = 'work_accident.sql';
DELETE FROM d1_migrations WHERE name = 'work_style.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0111_work_style.sql');
UPDATE d1_migrations SET name = '0111_work_style.sql' WHERE name = 'work_style.sql';
DELETE FROM d1_migrations WHERE name = 'year-end-adjustment.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0112_year_end_adjustment.sql');
UPDATE d1_migrations SET name = '0112_year_end_adjustment.sql' WHERE name = 'year-end-adjustment.sql';
DELETE FROM d1_migrations WHERE name = 'year_end_adjustment_unique.sql' AND EXISTS (SELECT 1 FROM d1_migrations m WHERE m.name = '0113_year_end_adjustment_unique.sql');
UPDATE d1_migrations SET name = '0113_year_end_adjustment_unique.sql' WHERE name = 'year_end_adjustment_unique.sql';
