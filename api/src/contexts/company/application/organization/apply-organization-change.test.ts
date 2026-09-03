import { expect, test } from "bun:test"
import { ApplyOrganizationChange } from "@/contexts/company/application/organization/apply-organization-change"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"

const actor = CompanyActorValue.restore({
  accountId: "account:1",
  employeeId: "employee:1",
  organizationIds: ["organization:default"],
  capabilities: ["company:write"],
})

test("ApplyOrganizationChangeはsnapshot readの例外をunavailableへ閉じて適用しない", async () => {
  let changeCount = 0
  const applyOrganizationChange = new ApplyOrganizationChange({
    actor,
    repository: {
      findMany: async () => {
        throw new Error("read unavailable")
      },
      write: async () => {
        changeCount += 1
        return { kind: "applied", organizationRevision: 1, replayed: false }
      },
    },
  })
  const result = await applyOrganizationChange.execute({
    commandId: "command:1",
    expectedRevision: 0,
    reason: "create root organization",
    recordedAt: 1,
    resources: [
      {
        organizationId: "organization:default",
        type: "organization-unit",
        id: "organization-unit-period:root",
        revision: 1,
        state: "active",
        effectiveFrom: restoreCalendarDate("2026-01-01"),
        effectiveTo: null,
        attributes: {
          organizationUnitId: "organization-unit:root",
          code: "ROOT",
          officialName: "Company",
          kind: "COMPANY",
          parentOrganizationUnitId: null,
        },
      },
    ],
  })

  expect(result).toMatchObject({ kind: "unavailable", cause: { message: "read unavailable" } })
  expect(changeCount).toBe(0)
})
