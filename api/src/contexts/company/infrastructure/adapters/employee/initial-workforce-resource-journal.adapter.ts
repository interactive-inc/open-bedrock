import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type {
  EmployeeId,
  EmploymentId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { EmploymentType } from "@/contexts/company/domain/definitions/employment-type.definition"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import {
  CompanyResourceJournalAdapter,
  type CompanyResourceJournalStatement,
} from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import {
  companyOrganizations,
  companyWorkforceResourceBindings,
} from "@/contexts/company/infrastructure/schema/company"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"

export type InitialWorkforceResource = Readonly<{
  employeeId: EmployeeId
  employmentId: EmploymentId
  officialName: string
  employeeCode: string | null
  email: string | null
  phone: string | null
  employmentType: EmploymentType
  status: "active" | "leave"
  effectiveOn: CalendarDate
  occurredAt: Date
  actorAccountId: string
  operationId: string
  reason: string
  lifecycleRevision: number
}>
type Context = Readonly<{
  env: Readonly<{ DB: D1Database }>
  var: Readonly<{ database: Pick<DrizzleD1Database, "insert" | "select" | "update"> }>
}>

/** 新規登録の宣言と保存済みの初期事実が一致したときだけ、公開正本の所有関係を作る。 */
export class InitialWorkforceResourceJournalAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: InitialWorkforceResource,
  ): Promise<ReadonlyArray<D1PreparedStatement> | Error> {
    const statements = await this.buildMany([input])
    if (statements instanceof Error) return statements
    return statements.map((statement) => {
      const query = statement.toSQL()
      return this.c.env.DB.prepare(query.sql).bind(...query.params)
    })
  }

  async buildMany(
    inputs: ReadonlyArray<InitialWorkforceResource>,
  ): Promise<CompanyResourceJournalStatement[] | Error> {
    if (inputs.length === 0) return []
    const organizationId = "organization:default"
    try {
      const current = await this.c.var.database
        .select({ revision: companyOrganizations.revision })
        .from(companyOrganizations)
        .where(eq(companyOrganizations.id, organizationId))
        .get()
      const revision = z.number().int().nonnegative().safeParse(current?.revision)
      if (!revision.success) return new Error("Company organization is unavailable")
      const statements: CompanyResourceJournalStatement[] = []
      const database = this.c.var.database
      for (const [index, input] of inputs.entries()) {
        if (!Number.isSafeInteger(input.lifecycleRevision) || input.lifecycleRevision < 0)
          return new Error("invalid initial lifecycle revision")
        const personId = `person:${input.employeeId}`
        const recordedAt = input.occurredAt.getTime()
        const base = {
          organizationId,
          revision: 1,
          effectiveFrom: input.effectiveOn,
          effectiveTo: null,
        }
        const status = input.status === "active" ? "ACTIVE" : "ON_LEAVE"
        const change = CompanyResourceChangeEntity.create({
          commandId: `initial-workforce:${input.operationId}`,
          actorAccountId: input.actorAccountId,
          expectedRevision: revision.data + index,
          reason: input.reason,
          recordedAt,
          resources: [
            {
              ...base,
              type: "person",
              id: personId,
              state: "active",
              attributes: {
                officialName: input.officialName,
                email: input.email,
                phone: input.phone,
              },
            },
            {
              ...base,
              type: "employee",
              id: input.employeeId,
              state: "active",
              attributes: {
                personId,
                employeeCode: input.employeeCode,
              },
            },
            {
              ...base,
              type: "employment",
              id: input.employmentId,
              state: "active",
              attributes: {
                employeeId: input.employeeId,
                employmentType: input.employmentType,
                status,
              },
            },
          ],
        })
        if (change instanceof Error) return change
        const journal = await new CompanyResourceJournalAdapter({ database }).build(change)
        if (journal instanceof Error) return journal
        statements.push(
          database
            .select({
              ok: sql<number>`CASE WHEN EXISTS (
            SELECT 1 FROM company_employees AS employee
            JOIN company_employments AS employment ON employment.employee_id = employee.id
            JOIN company_employee_lifecycle_revisions AS lifecycle ON lifecycle.employee_id = employee.id
            JOIN company_employment_period_versions AS period ON period.period_id = employment.id
            JOIN company_employee_status_period_versions AS status ON status.employment_period_id = employment.id
            WHERE employee.id = ${input.employeeId} AND employment.id = ${input.employmentId}
              AND employee.official_name = ${input.officialName}
              AND employee.employee_code IS ${input.employeeCode}
              AND employee.email IS ${input.email} AND employee.phone IS ${input.phone}
              AND employee.created_at = ${recordedAt}
              AND employment.hire_date = ${input.effectiveOn} AND employment.termination_date IS NULL
              AND employment.employment_type = ${input.employmentType} AND employment.status = ${status}
              AND lifecycle.revision = ${input.lifecycleRevision}
              AND period.revision = 1 AND period.employee_id = employee.id
              AND period.starts_on = ${input.effectiveOn} AND period.ends_on IS NULL AND period.is_void = 0
              AND status.revision = 1 AND status.employee_id = employee.id
              AND status.starts_on = ${input.effectiveOn} AND status.ends_on IS NULL AND status.is_void = 0
              AND status.status = ${input.status}
              AND (SELECT count(*) FROM company_employments WHERE employee_id = employee.id) = 1
              AND (SELECT count(*) FROM company_employment_period_versions WHERE employee_id = employee.id) = 1
              AND (SELECT count(*) FROM company_employee_status_period_versions WHERE employee_id = employee.id) = 1
              AND NOT EXISTS (SELECT 1 FROM company_workforce_resource_bindings WHERE employee_id = employee.id)
          ) THEN 1 ELSE json_extract('', '$') END`,
            })
            .from(sql`(SELECT 1)`),
          ...journal.statements,
        )
        for (const resource of change.resources.filter((resource) => resource.type !== "person")) {
          statements.push(
            database.insert(companyWorkforceResourceBindings).values({
              resourceType: resource.type === "employee" ? "employee" : "employment",
              resourceId: resource.id,
              organizationId,
              employeeId: input.employeeId,
              resourceRevision: 1,
              lifecycleRevision: input.lifecycleRevision,
              lastActionId: sql`(SELECT recorded_by_action_id FROM company_employment_period_versions
              WHERE period_id = ${input.employmentId} AND revision = 1)`,
            }),
          )
        }
        statements.push(journal.commit)
      }
      return statements
    } catch (cause) {
      return new Error("failed to prepare initial Company resources", { cause })
    }
  }
}
