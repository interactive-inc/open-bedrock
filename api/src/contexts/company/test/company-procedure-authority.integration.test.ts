import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { createExternalIdentityImportTestContext } from "@/contexts/company/test/external-identity-import.test-support"
import { RevalidateCompanyProcedureAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-authority.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

describe("Company Taskの判断時点の資格", () => {
  test("両製品の実migrationで、従業員指定の再検査と保存時の変更検知を行う", async () => {
    const fixture = await createExternalIdentityImportTestContext()
    expect((await fixture.application.execute(fixture.input)).kind).toBe("applied")
    const database = fixture.database
    await database.prepare("UPDATE company_employees SET employee_code = 'REVIEWER'").run()
    const accountId = zAccountId.parse(
      await database
        .prepare("SELECT account_id FROM company_account_employee_links")
        .first<string>("account_id"),
    )
    const step: ApplicationWorkflowStep = {
      key: "review",
      name: "Review",
      approvers: [{ type: "employee", employee_code: "REVIEWER" }],
      approval_mode: "any",
      condition_mode: "all",
      conditions: [],
      due_days: null,
      escalation_approvers: [],
      rejection_behavior: "reject",
      allow_delegation: true,
    }
    const resolver = new RevalidateCompanyProcedureAuthorityAdapter({
      env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo" },
      var: {
        database: drizzle(database),
        auditContext: {
          requestId: "authority-test",
          clientName: "api",
          clientIp: null,
          externalRequestId: null,
        },
      },
    })
    const input = {
      step,
      representedAccountId: accountId,
      subjectEmployeeId: null,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set<never>(),
      dueAt: null,
      decidedAt: fixture.clock.at,
    }
    expect(await resolver.revalidate(input)).toBe(true)
    const guard = await new CompanyAuthoritySnapshotGuardAdapter({ database }).prepare({
      employeeCodes: ["REVIEWER"],
      accountIds: [accountId],
    })
    if (guard instanceof Error) throw guard
    expect(await database.batch([guard])).toBeArray()
    await database.prepare("UPDATE company_employees SET employee_code = 'REPLACED'").run()
    expect(await resolver.revalidate(input)).toBeInstanceOf(Error)
    const failure = await database
      .batch([
        database.prepare("UPDATE company_employees SET official_name = 'Uncommitted Name'"),
        guard,
      ])
      .then(
        () => null,
        (cause: unknown) => cause,
      )
    expect(failure).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT official_name FROM company_employees")
        .first<string>("official_name"),
    ).toBe("Example Person")
  })
})
