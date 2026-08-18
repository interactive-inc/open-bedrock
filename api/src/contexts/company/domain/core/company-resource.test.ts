import { describe, expect, test } from "bun:test"
import type { CompanyResource } from "./company-resource"
import { validateCompanyResource } from "./validate-company-resource"
import { validateCompanyResourceChange } from "./validate-company-resource-change"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"

const employee = {
  organizationId: "organization:default",
  type: "employee",
  id: "employee:1",
  revision: 1,
  state: "active",
  effectiveFrom: restoreCalendarDate("2026-01-01"),
  effectiveTo: null,
  attributes: { personId: "person:1", employeeCode: "E001" },
} as const satisfies CompanyResource

describe("Company resource", () => {
  test("opaque text IDと半開期間を受理する", () => {
    expect(validateCompanyResource(employee)).toBeNull()
  })

  test("空白を含むIDと逆転期間を拒否する", () => {
    expect(validateCompanyResource({ ...employee, id: "employee 1" })?.code).toBe(
      "invalid_identifier",
    )
    expect(
      validateCompanyResource({
        ...employee,
        effectiveTo: restoreCalendarDate("2025-12-31"),
      })?.code,
    ).toBe("invalid_period")
  })

  test("一command内の同一resource重複を拒否する", () => {
    expect(
      validateCompanyResourceChange({
        commandId: "command:1",
        expectedRevision: 0,
        actorAccountId: "account:1",
        reason: "initial import",
        recordedAt: 1,
        resources: [employee, employee],
      })?.code,
    ).toBe("invalid_change")
  })
})
