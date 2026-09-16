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

test("限定資格は人物を変更できるが法人資源との混在は再送でも拒否する", async () => {
  const workforceActor = CompanyActorValue.restore({
    accountId: "account:basic-editor",
    employeeId: null,
    organizationIds: ["organization:default"],
    capabilities: ["company:workforce:update"],
  })
  let writeAttempts = 0
  const command = new ApplyOrganizationChange({
    actor: workforceActor,
    repository: {
      writeOrganizationChange: async () => {
        writeAttempts += 1
        return { kind: "applied", organizationRevision: 1, replayed: false }
      },
    },
  })
  const person = {
    organizationId: "organization:default",
    type: "person" as const,
    id: "person:one",
    revision: 2,
    state: "active" as const,
    effectiveFrom: restoreCalendarDate("2026-01-01"),
    effectiveTo: null,
    attributes: { officialName: "職員" },
  }
  const change = {
    commandId: "command:workforce",
    expectedRevision: 0,
    reason: "氏名を確認した",
    recordedAt: 1,
    resources: [person],
  }

  expect(await command.execute(change)).toMatchObject({ kind: "applied" })
  expect(writeAttempts).toBe(1)

  expect(
    await command.execute({ ...change, resources: [{ ...person, revision: 1 }] }),
  ).toMatchObject({ kind: "forbidden" })
  expect(
    await command.execute({ ...change, resources: [{ ...person, revision: 3, state: "void" }] }),
  ).toMatchObject({ kind: "forbidden" })
  expect(
    await command.execute({
      ...change,
      resources: [
        {
          ...person,
          type: "account-employee-link",
          id: "account-link:one",
          attributes: { accountId: "account:one", employeeId: "employee:one" },
        },
      ],
    }),
  ).toMatchObject({ kind: "forbidden" })

  const mixed = {
    ...change,
    resources: [
      person,
      {
        organizationId: "organization:default",
        type: "legal-entity" as const,
        id: "legal-entity:one",
        revision: 1,
        state: "active" as const,
        effectiveFrom: restoreCalendarDate("2026-01-01"),
        effectiveTo: null,
        attributes: {
          officialName: "会社",
          jurisdictionCountryCode: "JP",
          registrationNumber: null,
          defaultCurrencyCode: "JPY",
        },
      },
    ],
  }
  expect(await command.execute(mixed)).toMatchObject({ kind: "forbidden" })
  expect(writeAttempts).toBe(1)
})
