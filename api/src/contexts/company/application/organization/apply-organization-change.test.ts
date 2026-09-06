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

test("ApplyOrganizationChangeは永続化経路の例外をunavailableへ閉じる", async () => {
  let writeAttempts = 0
  const applyOrganizationChange = new ApplyOrganizationChange({
    actor,
    repository: {
      writeOrganizationChange: async () => {
        writeAttempts += 1
        throw new Error("write unavailable")
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

  expect(result).toMatchObject({ kind: "unavailable", cause: { message: "write unavailable" } })
  expect(writeAttempts).toBe(1)
})
