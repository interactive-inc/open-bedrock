import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type {
  EmployeeId,
  EmploymentId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { sql } from "drizzle-orm"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import {
  personnelActions,
  employmentPeriodVersions,
  employeeStatusPeriodVersions,
  employeeLifecycleRevisions,
} from "@/contexts/company/infrastructure/schema/employee-lifecycle"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

type InitialEmployment = Readonly<{
  employeeId: EmployeeId
  employmentId: EmploymentId
  effectiveOn: CalendarDate
  status: "active" | "leave"
  occurredAt: Date
  actorAccountId: string | null
  operationId: string
  reason: string
}>
type Context = Readonly<{
  env: Readonly<{ DB: D1Database }>
  var: Readonly<{ database: Pick<DrizzleD1Database, "insert" | "select"> }>
}>

/** 新規雇用の作成と同じbatchで、初期事実・期間履歴・改訂番号を記録する。 */
export class InitialEmploymentPersistenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: InitialEmployment): Promise<ReadonlyArray<D1PreparedStatement> | Error> {
    const statements = await this.build(input)
    if (statements instanceof Error) return statements
    return statements.map((statement) => {
      const query = statement.toSQL()
      return this.c.env.DB.prepare(query.sql).bind(...query.params)
    })
  }

  async build(input: InitialEmployment) {
    if (
      !isCalendarDate(input.effectiveOn) ||
      !Number.isFinite(input.occurredAt.getTime()) ||
      input.operationId.length === 0 ||
      input.operationId.length > 128 ||
      input.reason.trim().length === 0 ||
      input.reason.length > 2000
    ) {
      return new Error("invalid initial employment fact")
    }

    const summary = CanonicalSystemJsonValue.create({
      kind: "initial_state",
      eventOn: input.effectiveOn,
      status: input.status,
      employeeId: input.employeeId,
      employmentId: input.employmentId,
      actorAccountId: input.actorAccountId,
      reason: input.reason,
    })
    if (summary instanceof Error) return summary
    const fingerprint = await ProposalDigestValue.create(summary)
    if (fingerprint instanceof Error) return fingerprint
    const actionId = `initial-employment:${fingerprint.toString()}`
    const recordedAt = Math.floor(input.occurredAt.getTime() / 1000)

    const database = this.c.var.database
    const employeeId = input.employeeId
    const status = input.status === "active" ? "ACTIVE" : "ON_LEAVE"
    const personnelActionId = restoreWorkforceId("personnel_action", actionId)

    return [
      database.insert(personnelActions).select(sql`
        SELECT ${actionId}, ${employeeId}, 'initial_state', ${input.effectiveOn}, ${recordedAt},
          ${input.actorAccountId}, NULL, 'system', NULL, NULL, ${input.operationId},
          ${fingerprint.toString()}, ${summary.toString()}
        FROM company_employments AS employment
        WHERE employment.id = ${input.employmentId} AND employment.employee_id = ${employeeId}
          AND employment.hire_date = ${input.effectiveOn} AND employment.termination_date IS NULL
          AND employment.status = ${status}
          AND NOT EXISTS (SELECT 1 FROM company_personnel_actions WHERE employee_id = ${employeeId})
          AND NOT EXISTS (SELECT 1 FROM company_employment_period_versions WHERE employee_id = ${employeeId})
          AND NOT EXISTS (SELECT 1 FROM company_employee_lifecycle_revisions WHERE employee_id = ${employeeId})
      `),
      database
        .select({ ok: sql<number>`CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END` })
        .from(sql`(SELECT 1)`),
      database.insert(employmentPeriodVersions).values({
        periodId: input.employmentId,
        revision: 1,
        employeeId,
        startsOn: input.effectiveOn,
        endsOn: null,
        isVoid: false,
        recordedByActionId: personnelActionId,
        recordedAt,
      }),
      database.insert(employeeStatusPeriodVersions).values({
        periodId: `initial-status:${fingerprint.toString()}`,
        revision: 1,
        employmentPeriodId: input.employmentId,
        employeeId,
        status: input.status,
        startsOn: input.effectiveOn,
        endsOn: null,
        isVoid: false,
        recordedByActionId: personnelActionId,
        recordedAt,
      }),
      database
        .insert(employeeLifecycleRevisions)
        .values({ employeeId, revision: 0, updatedAt: recordedAt }),
    ]
  }
}
