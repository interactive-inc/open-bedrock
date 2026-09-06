import { describe, expect, test } from "bun:test"
import { RetireEmployee } from "@/contexts/company/application/employee-lifecycle/retire-employee"
import { ResolveLiveEmployeeAccessAdapter } from "@/contexts/company/infrastructure/adapters/employee/resolve-live-employee-access.adapter"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  createLifecycleRouteDb,
  readOrganizationRevision,
} from "@tests/api/support/lifecycle-route-fixture"
import { createTestContextForDatabase } from "@tests/api/support/create-test-context"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"

describe("退職予約から実際の在籍認可まで", () => {
  test("人事発令で未来の退職を確定しても退職日中は利用でき、翌日から既存tokenも拒否する", async () => {
    const database = await createLifecycleRouteDb()
    const context = createTestContextForDatabase(database)
    const employeeId = toWorkforceEmployeeId(5)
    const expectedEmployeeRevision = await database
      .prepare("SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = ?1")
      .bind(employeeId)
      .first<number>("revision")
    if (expectedEmployeeRevision === null) throw new Error("missing lifecycle revision")
    const command = {
      session: {
        accountId: zAccountId.parse("1"),
        employeeId: toWorkforceEmployeeId(1),
        hasPermission: (permission: string) => permission === "employee:lifecycle:apply",
      },
      employeeId,
      idempotencyKey: "retire:future-access",
      expectedEmployeeRevision,
      expectedOrganizationRevision: await readOrganizationRevision(database),
    }
    const retirement = new RetireEmployee(context)
    expect(
      await retirement.execute({
        ...command,
        input: {
          kind: "retired",
          employeeCode: "E005",
          retirementOn: restoreCalendarDate("2026-09-30"),
        },
      }),
    ).toMatchObject({ replayed: false })
    expect(
      await retirement.execute({
        ...command,
        input: {
          kind: "retired",
          employeeCode: "E005",
          retirementOn: restoreCalendarDate("2026-09-30"),
        },
      }),
    ).toMatchObject({ replayed: true })
    expect(
      await database
        .prepare("SELECT status FROM company_employments WHERE employee_id = ?1")
        .bind(employeeId)
        .first<string>("status"),
    ).toBe("TERMINATED")

    const jwtSecret = "lifecycle-access-integration-secret"
    const token = await createTestToken(jwtSecret, { employeeId })
    for (const scenario of [
      { now: "2026-09-30T14:59:59Z", status: 200, employment: "ACTIVE" },
      { now: "2026-09-30T15:00:00Z", status: 401, employment: "TERMINATED" },
    ]) {
      const atDate = { env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo", NOW: scenario.now } }
      const directory = await new CompanyEmployeeDirectoryReadAdapter(atDate).findById(employeeId)
      expect(directory).toMatchObject({ employment: { status: scenario.employment } })
      const eligibility = await new ResolveLiveEmployeeAccessAdapter(
        atDate,
      ).resolveLiveEmployeeAccess(employeeId)
      if (scenario.status === 200) expect(eligibility).toMatchObject({ status: "ACTIVE" })
      else expect(eligibility).toBeNull()
      const response = await requestWithContext({
        db: database,
        jwtSecret,
        token,
        path: "/company/application-requests/me",
        now: scenario.now,
      })
      expect(response.status).toBe(scenario.status)
    }
  })
})
