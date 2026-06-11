import { canDeleteEmployee } from "@/domain/employee/can-delete-employee"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

export type Command = {
  viewerRole: string
  viewerEmployeeId: number
  code: string
}

export type Forbidden = { reason: "forbidden" }

export type EmployeeNotFound = { reason: "employee_not_found" }

export type SelfDelete = { reason: "self_delete" }

export type Deleted = { reason: "deleted" }

export type DeleteEmployeeFailure = Forbidden | EmployeeNotFound | SelfDelete

/**
 * 権限と存在を確認し、従業員を台帳から削除する。自分自身の削除は拒否する。
 * 関連テーブルのレコードを先に削除してから従業員を削除し、孤児レコードを防ぐ。
 */
export class DeleteEmployee {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | DeleteEmployeeFailure | Error> {
    const employeeRepository = new EmployeeRepository(this.c)

    if (canDeleteEmployee(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const employee = await employeeRepository.findByCode(command.code)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "employee_not_found" }
    }

    if (employee.id === command.viewerEmployeeId) {
      return { reason: "self_delete" }
    }

    const cascadeResult = await this.deleteRelatedRecords(employee.id, employee.code)

    if (cascadeResult instanceof Error) {
      return cascadeResult
    }

    return { reason: "deleted" }
  }

  /**
   * 従業員に紐づく全関連レコードと従業員本体を単一の D1 batch で一括削除する。
   * 子テーブル（goal_evaluations, onboarding_tasks 等）はサブクエリで先に削除する。
   * nullable な外部キー（assets.holder_employee_id 等）は NULL に更新する。
   * 従業員本体の DELETE を batch 末尾に含めてアトミック性を保証する。
   */
  private async deleteRelatedRecords(
    employeeId: number,
    employeeCode: string,
  ): Promise<null | Error> {
    try {
      const db = this.c.env.DB

      await db.batch([
        // --- 子テーブルの孫レコードを先に削除（サブクエリ） ---
        db
          .prepare(
            "DELETE FROM onboarding_tasks WHERE assignment_id IN (SELECT id FROM onboarding_assignments WHERE employee_id = ?1)",
          )
          .bind(employeeId),
        db
          .prepare(
            "DELETE FROM goal_evaluations WHERE goal_id IN (SELECT id FROM goals WHERE employee_id = ?1) OR evaluator_id = ?1",
          )
          .bind(employeeId),
        db
          .prepare(
            "DELETE FROM expense_approvals WHERE expense_id IN (SELECT id FROM expenses WHERE employee_id = ?1) OR approver_id = ?1",
          )
          .bind(employeeId),
        db
          .prepare(
            "DELETE FROM application_approvals WHERE application_id IN (SELECT id FROM applications WHERE applicant_id = ?1) OR approver_id = ?1",
          )
          .bind(employeeId),

        // --- 従業員が主体のレコードを削除 ---
        db.prepare("DELETE FROM leave_requests WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM leave_balances WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM attendance_records WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM expenses WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM goals WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM notifications WHERE recipient_employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM onboarding_assignments WHERE employee_id = ?1").bind(employeeId),
        db
          .prepare("DELETE FROM thanks WHERE sender_employee_id = ?1 OR recipient_employee_id = ?1")
          .bind(employeeId),
        db.prepare("DELETE FROM thanks_point_budgets WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM thanks_redemptions WHERE employee_id = ?1").bind(employeeId),
        db
          .prepare(
            "DELETE FROM review_forms WHERE subject_employee_id = ?1 OR reviewer_employee_id = ?1",
          )
          .bind(employeeId),
        db.prepare("DELETE FROM shift_assignments WHERE employee_id = ?1").bind(employeeId),
        db
          .prepare(
            "DELETE FROM shift_swap_requests WHERE requester_employee_id = ?1 OR target_employee_id = ?1",
          )
          .bind(employeeId),
        db.prepare("DELETE FROM training_enrollments WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM career_applications WHERE applicant_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM career_sheets WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM payslips WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM salary_revisions WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM employee_skills WHERE employee_id = ?1").bind(employeeId),
        db
          .prepare("DELETE FROM one_on_ones WHERE member_id = ?1 OR manager_id = ?1")
          .bind(employeeId),
        db.prepare("DELETE FROM applications WHERE applicant_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM room_reservations WHERE reserver_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM survey_responses WHERE respondent_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM business_trips WHERE traveler_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM rental_reservations WHERE requester_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM resignations WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM life_events WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM family_care_leaves WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM certificate_requests WHERE requester_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM year_end_adjustments WHERE employee_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM antisocial_checks WHERE requester_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM knowledge_articles WHERE author_id = ?1").bind(employeeId),
        db.prepare("DELETE FROM asset_lendings WHERE employee_id = ?1").bind(employeeId),

        // --- 組織図系（employee_code で参照） ---
        db.prepare("DELETE FROM org_memberships WHERE employee_code = ?1").bind(employeeCode),

        // --- nullable FK は NULL に更新 ---
        db
          .prepare("UPDATE assets SET holder_employee_id = NULL WHERE holder_employee_id = ?1")
          .bind(employeeId),
        db
          .prepare(
            "UPDATE org_departments SET manager_employee_code = NULL WHERE manager_employee_code = ?1",
          )
          .bind(employeeCode),
        db
          .prepare("UPDATE leave_requests SET approver_id = NULL WHERE approver_id = ?1")
          .bind(employeeId),
        db
          .prepare(
            "UPDATE org_memberships SET manager_employee_code = NULL WHERE manager_employee_code = ?1",
          )
          .bind(employeeCode),
        db
          .prepare("UPDATE thanks_redemptions SET decider_id = NULL WHERE decider_id = ?1")
          .bind(employeeId),

        // --- 従業員本体を batch 末尾で削除（アトミック性を保証） ---
        db.prepare("DELETE FROM employees WHERE code = ?1").bind(employeeCode),
      ])

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete related employee records")
    }
  }
}
