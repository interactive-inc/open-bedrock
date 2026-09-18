import { AlignAccountDisplayNameToEmployeeAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/align-account-display-name-to-employee.adapter"
import { accountEmployeeLinks, employees } from "@/contexts/company/infrastructure/schema/employee"
import { employments } from "@/contexts/company/infrastructure/schema/employment"
import type { EmploymentType } from "@/contexts/company/domain/definitions/employment-type.definition"
import type { PersistedEmploymentStatus } from "@/contexts/company/domain/definitions/employment-status.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { sql } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import type { DrizzleD1Database } from "drizzle-orm/d1"

type Props = Readonly<{
  accountId: string
  employeeId: string
  employmentId: string
  createAccountEmployeeLink: boolean
  officialName: string
  employmentType: EmploymentType
  hireDate: string
  status: PersistedEmploymentStatus
  now: Date
}>

type Context = Pick<DrizzleD1Database, "insert" | "select" | "update">
type Statement = BatchItem<"sqlite"> & { toSQL(): { sql: string; params: unknown[] } }

/** Account登録と同じbatchへ載せる、Company初期従業員・雇用の旧投影。 */
export class InitialAccountEmploymentStatementAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  build(props: Props): Statement[] {
    const accountId = zAccountId.parse(props.accountId)
    const employeeId = restoreWorkforceId("employee", props.employeeId)
    const statements: Statement[] = [
      this.c
        .insert(employees)
        .values({
          id: employeeId,
          officialName: props.officialName,
          employeeCode: null,
          email: null,
          phone: null,
          createdAt: props.now,
          updatedAt: props.now,
        })
        .onConflictDoNothing({ target: employees.id }),
      this.c
        .select({
          ok: sql<number>`CASE WHEN EXISTS (
        SELECT 1 FROM company_employees WHERE id = ${employeeId} AND official_name = ${props.officialName}
      ) THEN 1 ELSE json_extract('', '$') END`,
        })
        .from(sql`(SELECT 1)`),
    ]

    if (props.createAccountEmployeeLink) {
      statements.push(this.c.insert(accountEmployeeLinks).values({ accountId, employeeId }))
    }

    statements.push(
      new AlignAccountDisplayNameToEmployeeAdapter(this.c).buildAlignment({
        employeeId,
        officialName: props.officialName,
        now: props.now,
      }),
      this.c.insert(employments).values({
        id: props.employmentId,
        employeeId,
        contractName: props.officialName,
        employmentType: props.employmentType,
        hireDate: props.hireDate,
        status: props.status,
        createdAt: props.now,
        updatedAt: props.now,
      }),
    )
    return statements
  }
}
