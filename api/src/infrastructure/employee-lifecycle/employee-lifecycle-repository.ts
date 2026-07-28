import type {
  EmployeeStatusPeriod,
  EmploymentPeriod,
  LifecycleSchedule,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/domain/employee-lifecycle/lifecycle-schedule"
import type { Context } from "@/env"
import type {
  LifecycleDepartmentReference,
  LifecycleEmployeeReference,
} from "@/domain/employee-lifecycle/project-personnel-action"
import { ApplicationError, UnexpectedError } from "@/lib/errors"

type EmploymentRow = {
  period_id: string
  revision: number
  employee_id: number
  starts_on: string
  ends_on: string | null
  is_void: number
  recorded_by_action_id: string
  recorded_at: number
}

type StatusRow = EmploymentRow & {
  employment_period_id: string
  status: "active" | "leave"
}

type AssignmentRow = EmploymentRow & {
  employment_period_id: string
  department_code: string
  assignment_type: "primary" | "concurrent"
  position_title: string | null
  manager_employee_id: number | null
}

type ResponsibilityRow = Omit<EmploymentRow, "employee_id"> & {
  department_code: string
  responsibility_type: "department_manager"
  employee_id: number
}

function toEmployment(row: EmploymentRow): EmploymentPeriod {
  return {
    periodId: row.period_id,
    revision: row.revision,
    employeeId: row.employee_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isVoid: row.is_void === 1,
    recordedByActionId: row.recorded_by_action_id,
    recordedAt: row.recorded_at,
  }
}

function toStatus(row: StatusRow): EmployeeStatusPeriod {
  return {
    ...toEmployment(row),
    employmentPeriodId: row.employment_period_id,
    status: row.status,
  }
}

function toAssignment(row: AssignmentRow): OrgAssignmentPeriod {
  return {
    ...toEmployment(row),
    employmentPeriodId: row.employment_period_id,
    departmentCode: row.department_code,
    assignmentType: row.assignment_type,
    positionTitle: row.position_title,
    managerEmployeeId: row.manager_employee_id,
  }
}

function toResponsibility(row: ResponsibilityRow): OrgResponsibilityPeriod {
  return {
    periodId: row.period_id,
    revision: row.revision,
    departmentCode: row.department_code,
    responsibilityType: row.responsibility_type,
    employeeId: row.employee_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isVoid: row.is_void === 1,
    recordedByActionId: row.recorded_by_action_id,
    recordedAt: row.recorded_at,
  }
}

function repositoryError(cause: unknown): ApplicationError {
  return new UnexpectedError("人事ライフサイクルの読み取りに失敗しました", { cause })
}

const employmentSelect = `
  SELECT period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at
  FROM employment_period_versions AS current
  WHERE current.revision = (
    SELECT MAX(candidate.revision)
    FROM employment_period_versions AS candidate
    WHERE candidate.period_id = current.period_id
  ) AND current.is_void = 0`

const statusSelect = `
  SELECT period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at
  FROM employee_status_period_versions AS current
  WHERE current.revision = (
    SELECT MAX(candidate.revision)
    FROM employee_status_period_versions AS candidate
    WHERE candidate.period_id = current.period_id
  ) AND current.is_void = 0`

const assignmentSelect = `
  SELECT period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at
  FROM employee_org_assignment_period_versions AS current
  WHERE current.revision = (
    SELECT MAX(candidate.revision)
    FROM employee_org_assignment_period_versions AS candidate
    WHERE candidate.period_id = current.period_id
  ) AND current.is_void = 0`

const responsibilitySelect = `
  SELECT period_id, revision, department_code, responsibility_type, employee_id,
         starts_on, ends_on, is_void, recorded_by_action_id, recorded_at
  FROM employee_org_responsibility_period_versions AS current
  WHERE current.revision = (
    SELECT MAX(candidate.revision)
    FROM employee_org_responsibility_period_versions AS candidate
    WHERE candidate.period_id = current.period_id
  ) AND current.is_void = 0`

export class EmployeeLifecycleRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async loadSchedule(employeeId: number): Promise<LifecycleSchedule | ApplicationError> {
    try {
      const db = this.c.env.DB
      const [employments, statuses, assignments, responsibilities] = await Promise.all([
        db
          .prepare(`${employmentSelect} AND current.employee_id = ?1 ORDER BY starts_on, period_id`)
          .bind(employeeId)
          .all<EmploymentRow>(),
        db
          .prepare(`${statusSelect} AND current.employee_id = ?1 ORDER BY starts_on, period_id`)
          .bind(employeeId)
          .all<StatusRow>(),
        db
          .prepare(`${assignmentSelect} AND current.employee_id = ?1 ORDER BY starts_on, period_id`)
          .bind(employeeId)
          .all<AssignmentRow>(),
        db
          .prepare(
            `${responsibilitySelect} AND current.employee_id = ?1 ORDER BY starts_on, period_id`,
          )
          .bind(employeeId)
          .all<ResponsibilityRow>(),
      ])

      return {
        employments: employments.results.map(toEmployment),
        statuses: statuses.results.map(toStatus),
        assignments: assignments.results.map(toAssignment),
        responsibilities: responsibilities.results.map(toResponsibility),
      }
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  async loadOrganizationSchedules(): Promise<ReadonlyArray<LifecycleSchedule> | ApplicationError> {
    try {
      const db = this.c.env.DB
      const [employments, statuses, assignments, responsibilities] = await Promise.all([
        db
          .prepare(`${employmentSelect} ORDER BY employee_id, starts_on, period_id`)
          .all<EmploymentRow>(),
        db.prepare(`${statusSelect} ORDER BY employee_id, starts_on, period_id`).all<StatusRow>(),
        db
          .prepare(`${assignmentSelect} ORDER BY employee_id, starts_on, period_id`)
          .all<AssignmentRow>(),
        db
          .prepare(`${responsibilitySelect} ORDER BY employee_id, starts_on, period_id`)
          .all<ResponsibilityRow>(),
      ])
      const employeeIds = new Set<number>([
        ...employments.results.map((row) => row.employee_id),
        ...statuses.results.map((row) => row.employee_id),
        ...assignments.results.map((row) => row.employee_id),
        ...responsibilities.results.map((row) => row.employee_id),
      ])

      return [...employeeIds]
        .sort((left, right) => left - right)
        .map((employeeId) => ({
          employments: employments.results
            .filter((row) => row.employee_id === employeeId)
            .map(toEmployment),
          statuses: statuses.results.filter((row) => row.employee_id === employeeId).map(toStatus),
          assignments: assignments.results
            .filter((row) => row.employee_id === employeeId)
            .map(toAssignment),
          responsibilities: responsibilities.results
            .filter((row) => row.employee_id === employeeId)
            .map(toResponsibility),
        }))
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  async loadRevisions(
    employeeId: number,
  ): Promise<{ employeeRevision: number; organizationRevision: number } | ApplicationError> {
    try {
      const [employeeRevision, organizationRevision] = await Promise.all([
        this.c.env.DB.prepare(
          "SELECT revision FROM employee_lifecycle_revisions WHERE employee_id = ?1",
        )
          .bind(employeeId)
          .first<number>("revision"),
        this.c.env.DB.prepare(
          "SELECT revision FROM organization_lifecycle_states WHERE id = 1",
        ).first<number>("revision"),
      ])

      return {
        employeeRevision: employeeRevision ?? 0,
        organizationRevision: organizationRevision ?? 0,
      }
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  async loadReferences(): Promise<
    | {
        departments: ReadonlyArray<LifecycleDepartmentReference>
        employees: ReadonlyArray<LifecycleEmployeeReference>
      }
    | ApplicationError
  > {
    try {
      const [departments, employees] = await Promise.all([
        this.c.env.DB.prepare(
          `SELECT organization.code, department.name, organization.archived_at
             FROM org_departments AS organization
             INNER JOIN departments AS department ON department.id = organization.department_id
             ORDER BY organization.code`,
        ).all<{ code: string; name: string; archived_at: number | null }>(),
        this.c.env.DB.prepare("SELECT id, code FROM employees ORDER BY id").all<{
          id: number
          code: string
        }>(),
      ])

      return {
        departments: departments.results.map((row) => ({
          code: row.code,
          name: row.name,
          archived: row.archived_at !== null,
        })),
        employees: employees.results,
      }
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  /**
   * 人事ライフサイクル移行の進捗を返す。`pending` → `backfilled` → `verified` と進む。
   *
   * この値を見て分岐する呼び出し側（`employees`、`me`、`directory/employees` の各 route と
   * `lib/org`・`lib/application` の解決関数）が、verified 経路（期間テーブルを正本とする
   * 時点指定読み）と legacy 経路（`employees` 表の非正規化列 dept_id/dept_name/position/status
   * を読む現在時点のみ）に分かれる。
   *
   * ## legacy 経路を削除してよい条件
   *
   * legacy 経路は移行前の遺物ではなく、未移行 deployment の唯一の読み経路である。
   * migration 0019 が全 deployment に `status = 'pending'` を INSERT するため、
   * 新規セルフホスト環境は必ず pending から始まり、batch の preflight → backfill → verify
   * を実行するまで verified にならない。したがって legacy 経路を今削除すると、
   * seed 済みの開発環境以外（＝実運用の新規導入すべて）が従業員一覧を読めなくなる。
   *
   * 削除できるのは次を全て満たしたときに限る。
   *
   * 1. 新規 deployment が pending を経由しなくなる。空 DB を `verified` として
   *    開始してよいと migration で表明する案が考えられるが、**それだけでは足りない**。
   *    verified 経路は「期間テーブルに状態がある従業員」しか一覧に出さない
   *    （`interface/routes/employees/route.ts` の findStatesAt 後の filter）。
   *    一方 bootstrap は `employees` に 1 行 INSERT するだけで期間行を作らない
   *    （`infrastructure/iam/bootstrap-account-repository.ts`）。空 DB を verified で
   *    始めると、最初の管理者が従業員一覧から消える。
   *    したがって条件は「bootstrap と、移行後に従業員を増やす全ての経路が、
   *    期間テーブル（雇用・在籍状態・配属）を必ず作ること」まで含む。
   * 2. 既存 deployment に verified への到達を強制する手段がある。運用者が backfill/verify を
   *    実行しないまま API を更新すると、legacy 削除は無停止の機能喪失になる。
   *    最低限、pending/backfilled のまま起動したら 503 で明示的に停止する必要がある。
   * 3. `employees` の非正規化列（dept_id/dept_name/position/status）の扱いを決める。
   *    これらは legacy 経路の読み元であると同時に、verified 後も
   *    `rebuild-lifecycle-projections` が現在時点の投影として書き続けている。
   *    legacy 削除＝列削除ではない。列を残すなら投影専用と明記し、読み取りの正本が
   *    期間テーブル側であることを型か命名で示す。
   *
   * 1〜3 が揃うまでは分岐を残す。分岐の重複を減らす目的で片方を消さない。
   */
  async migrationStatus(): Promise<"pending" | "backfilled" | "verified" | ApplicationError> {
    try {
      return (
        (await this.c.env.DB.prepare(
          "SELECT status FROM lifecycle_migration_states WHERE id = 1",
        ).first<"pending" | "backfilled" | "verified">("status")) ?? "pending"
      )
    } catch (cause) {
      return repositoryError(cause)
    }
  }
}
