import { expect, test } from "bun:test"
import { WriteOrganizationChange } from "@/contexts/company/application/organization/write-organization-change"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { restoreCalendarDate } from "@/contexts/company/domain/values/restore-calendar-date.definition"

const actor = CompanyActorValue.restore({
  accountId: "account:1",
  employeeId: "employee:1",
  organizationIds: ["organization:default"],
  capabilities: ["company:write"],
})

test("writeOrganizationChangeはsnapshot readの例外をunavailableへ閉じて書き込まない", async () => {
  let writeCount = 0
  const writeOrganizationChange = new WriteOrganizationChange(actor, {
    read: async () => {
      throw new Error("read unavailable")
    },
    write: async () => {
      writeCount += 1
      return { kind: "applied", organizationRevision: 1, replayed: false }
    },
  })
  const result = await writeOrganizationChange.execute({
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
  expect(writeCount).toBe(0)
})
