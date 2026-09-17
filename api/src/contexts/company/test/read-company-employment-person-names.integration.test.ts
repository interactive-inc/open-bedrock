import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { readCompanyEmploymentPersonNames } from "@/contexts/company/interface/operations/read-company-employment-person-names"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

const organizationId = "organization:default"
const effectiveOn = restoreCalendarDate("2030-06-01")

test("雇用から人物氏名を同じ会社版で引き、改名後も旧版を再現する", async () => {
  const database = createCompanyD1TestDatabase(
    readFileSync(
      new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
      "utf8",
    ) +
      "\n" +
      readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8"),
  )
  const repository = new D1CompanyResourceRepository({ database })
  const base = {
    organizationId,
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2030-01-01"),
    effectiveTo: null,
  } as const
  const resources: CompanyResourceProps[] = [
    {
      ...base,
      type: "person",
      id: "person:one",
      attributes: { officialName: "Old Name" },
    },
    {
      ...base,
      type: "employee",
      id: "employee:one",
      attributes: { personId: "person:one", employeeCode: "E001" },
    },
    {
      ...base,
      type: "employment",
      id: "employment:one",
      attributes: {
        employeeId: "employee:one",
        status: "ACTIVE",
        employmentType: "FULL_TIME",
      },
    },
  ]
  const first = CompanyResourceChangeEntity.create({
    commandId: "names:initial",
    expectedRevision: 0,
    actorAccountId: "account:operator",
    reason: "Register confirmed person",
    recordedAt: 1,
    resources,
  })
  if (first instanceof Error) throw first
  expect(await repository.write(first)).toMatchObject({
    kind: "applied",
    organizationRevision: 1,
  })

  const previous = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["employment:one", "employment:missing"],
    effectiveOn,
  })
  if (previous instanceof Error) throw previous
  expect(previous.organizationRevision).toBe(1)
  expect([...previous.names]).toEqual([["employment:one", "Old Name"]])

  const beforeHire = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["employment:one"],
    effectiveOn: restoreCalendarDate("2029-12-31"),
    organizationRevision: previous.organizationRevision,
  })
  if (beforeHire instanceof Error) throw beforeHire
  expect([...beforeHire.names]).toEqual([])

  const correction = CompanyResourceChangeEntity.create({
    commandId: "names:change",
    expectedRevision: 1,
    actorAccountId: "account:operator",
    reason: "Confirmed name change",
    recordedAt: 2,
    resources: [
      {
        ...resources[0]!,
        revision: 2,
        attributes: { officialName: "New Name" },
      },
    ],
  })
  if (correction instanceof Error) throw correction
  expect(await repository.write(correction)).toMatchObject({
    kind: "applied",
    organizationRevision: 2,
  })

  const current = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["employment:one"],
    effectiveOn,
  })
  if (current instanceof Error) throw current
  expect(current.organizationRevision).toBe(2)
  expect(current.names.get("employment:one")).toBe("New Name")

  const historical = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["employment:one"],
    effectiveOn,
    organizationRevision: previous.organizationRevision,
  })
  if (historical instanceof Error) throw historical
  expect(historical.organizationRevision).toBe(1)
  expect(historical.names.get("employment:one")).toBe("Old Name")

  const unknownRevision = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["employment:one"],
    effectiveOn,
    organizationRevision: 3,
  })
  expect(unknownRevision).toBeInstanceOf(Error)
})
