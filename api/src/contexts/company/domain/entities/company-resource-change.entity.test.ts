import { describe, expect, test } from "bun:test"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/values/restore-calendar-date.definition"

const employee = {
  organizationId: "organization:default",
  type: "employee",
  id: "employee:1",
  revision: 1,
  state: "active",
  effectiveFrom: restoreCalendarDate("2026-01-01"),
  effectiveTo: null,
  attributes: { personId: "person:1" },
} as const satisfies CompanyResourceProps

describe("CompanyResourceChangeEntity", () => {
  test("一command内の同一resource重複を拒否する", () => {
    expect(
      CompanyResourceChangeEntity.create({
        commandId: "command:1",
        expectedRevision: 0,
        actorAccountId: "account:1",
        reason: "initial import",
        recordedAt: 1,
        resources: [employee, employee],
      }),
    ).toEqual(expect.objectContaining({ code: "invalid_change" }))
  })

  test("検証済みresourceだけをdeep freezeして保持する", () => {
    const change = CompanyResourceChangeEntity.create({
      commandId: "command:1",
      expectedRevision: 0,
      actorAccountId: "account:1",
      reason: "initial import",
      recordedAt: 1,
      resources: [employee],
    })
    expect(change).toBeInstanceOf(CompanyResourceChangeEntity)
    if (!(change instanceof CompanyResourceChangeEntity)) return
    expect(Object.isFrozen(change)).toBeTrue()
    expect(Object.isFrozen(change.resources)).toBeTrue()
  })
})
