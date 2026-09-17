import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { readCompanyEmploymentPersonNames } from "@/contexts/company/interface/operations/read-company-employment-person-names"
import { readCompanyEmploymentDirectory } from "@/contexts/company/interface/operations/read-company-employment-directory"
import { readCompanyEmploymentStartDates } from "@/contexts/company/interface/operations/read-company-employment-start-dates"
import { readCompanyEmploymentsByEmployee } from "@/contexts/company/interface/operations/read-company-employments-by-employee"
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

  const beforeHireWithEnded = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["employment:one"],
    effectiveOn: restoreCalendarDate("2029-12-31"),
    includeEndedEmployments: true,
    organizationRevision: previous.organizationRevision,
  })
  if (beforeHireWithEnded instanceof Error) throw beforeHireWithEnded
  expect([...beforeHireWithEnded.names]).toEqual([])

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

  const closure = CompanyResourceChangeEntity.create({
    commandId: "names:employment-ended",
    expectedRevision: 2,
    actorAccountId: "account:operator",
    reason: "Confirmed employment end",
    recordedAt: 3,
    resources: [
      {
        ...resources[2]!,
        revision: 2,
        effectiveTo: restoreCalendarDate("2030-05-01"),
      },
    ],
  })
  if (closure instanceof Error) throw closure
  expect(await repository.write(closure)).toMatchObject({
    kind: "applied",
    organizationRevision: 3,
  })

  const activeOnly = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["employment:one"],
    effectiveOn,
  })
  if (activeOnly instanceof Error) throw activeOnly
  expect([...activeOnly.names]).toEqual([])

  const endedForAttribution = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["employment:one"],
    effectiveOn,
    includeEndedEmployments: true,
  })
  if (endedForAttribution instanceof Error) throw endedForAttribution
  expect(endedForAttribution.organizationRevision).toBe(3)
  expect(endedForAttribution.names.get("employment:one")).toBe("New Name")
  const currentDirectory = await readCompanyEmploymentDirectory({
    database,
    organizationId,
    effectiveOn,
    organizationRevision: 3,
  })
  if (currentDirectory instanceof Error) throw currentDirectory
  expect(currentDirectory.items).toEqual([])
  const endedDirectory = await readCompanyEmploymentDirectory({
    database,
    organizationId,
    effectiveOn,
    includeEndedEmployments: true,
    organizationRevision: 3,
  })
  if (endedDirectory instanceof Error) throw endedDirectory
  expect(endedDirectory.items).toMatchObject([
    {
      employmentId: "employment:one",
      personName: "New Name",
      status: "ACTIVE",
      startedOn: "2030-01-01",
      effectiveTo: "2030-05-01",
    },
  ])

  const pinnedEnded = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["employment:one"],
    effectiveOn,
    includeEndedEmployments: true,
    organizationRevision: 3,
  })
  if (pinnedEnded instanceof Error) throw pinnedEnded
  expect([...pinnedEnded.names]).toEqual([["employment:one", "New Name"]])

  const currentEmployment = await readCompanyEmploymentsByEmployee({
    database,
    organizationId,
    employeeIds: ["employee:one", "employee:missing"],
    effectiveOn,
  })
  if (currentEmployment instanceof Error) throw currentEmployment
  expect([...currentEmployment.employmentIdsByEmployee]).toEqual([
    ["employee:one", []],
    ["employee:missing", []],
  ])

  const pastEmployment = await readCompanyEmploymentsByEmployee({
    database,
    organizationId,
    employeeIds: ["employee:one", "employee:missing"],
    effectiveOn,
    includeEndedEmployments: true,
    organizationRevision: 3,
  })
  if (pastEmployment instanceof Error) throw pastEmployment
  expect(pastEmployment.organizationRevision).toBe(3)
  expect([...pastEmployment.employmentIdsByEmployee]).toEqual([
    ["employee:one", ["employment:one"]],
    ["employee:missing", []],
  ])

  const priorEmployment = await readCompanyEmploymentsByEmployee({
    database,
    organizationId,
    employeeIds: ["employee:one"],
    effectiveOn,
    organizationRevision: 2,
  })
  if (priorEmployment instanceof Error) throw priorEmployment
  expect(priorEmployment.employmentIdsByEmployee.get("employee:one")).toEqual(["employment:one"])

  const rehire = CompanyResourceChangeEntity.create({
    commandId: "names:rehire",
    expectedRevision: 3,
    actorAccountId: "account:operator",
    reason: "Confirmed new employment after leaving",
    recordedAt: 4,
    resources: [
      {
        ...resources[2]!,
        id: "employment:rehire",
        effectiveFrom: restoreCalendarDate("2030-05-01"),
      },
    ],
  })
  if (rehire instanceof Error) throw rehire
  expect(await repository.write(rehire)).toMatchObject({
    kind: "applied",
    organizationRevision: 4,
  })

  const afterRehire = await readCompanyEmploymentsByEmployee({
    database,
    organizationId,
    employeeIds: ["employee:one"],
    effectiveOn,
  })
  if (afterRehire instanceof Error) throw afterRehire
  expect(afterRehire.employmentIdsByEmployee.get("employee:one")).toEqual(["employment:rehire"])
  const allRecordedEmployments = await readCompanyEmploymentsByEmployee({
    database,
    organizationId,
    employeeIds: ["employee:one"],
    effectiveOn,
    includeEndedEmployments: true,
  })
  if (allRecordedEmployments instanceof Error) throw allRecordedEmployments
  expect(allRecordedEmployments.employmentIdsByEmployee.get("employee:one")).toEqual([
    "employment:one",
    "employment:rehire",
  ])
})

test("雇用状態が後日変わっても開始日は最初の確定期間から読む", async () => {
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
  const employment: CompanyResourceProps = {
    ...base,
    type: "employment",
    id: "employment:one",
    attributes: {
      employeeId: "employee:one",
      status: "ACTIVE",
      employmentType: "FULL_TIME",
    },
  }
  const initial = CompanyResourceChangeEntity.create({
    commandId: "start:initial",
    expectedRevision: 0,
    actorAccountId: "account:operator",
    reason: "Confirmed hire",
    recordedAt: 1,
    resources: [
      { ...base, type: "person", id: "person:one", attributes: { officialName: "One" } },
      {
        ...base,
        type: "employee",
        id: "employee:one",
        attributes: { personId: "person:one", employeeCode: "E001" },
      },
      employment,
    ],
  })
  if (initial instanceof Error) throw initial
  expect(await repository.write(initial)).toMatchObject({
    kind: "applied",
    organizationRevision: 1,
  })

  const leave = CompanyResourceChangeEntity.create({
    commandId: "start:leave",
    expectedRevision: 1,
    actorAccountId: "account:operator",
    reason: "Confirmed leave",
    recordedAt: 2,
    resources: [
      {
        ...employment,
        revision: 2,
        effectiveFrom: restoreCalendarDate("2030-03-01"),
        attributes: { ...employment.attributes, status: "ON_LEAVE" },
      },
    ],
  })
  if (leave instanceof Error) throw leave
  expect(await repository.write(leave)).toMatchObject({ kind: "applied", organizationRevision: 2 })

  const current = await readCompanyEmploymentDirectory({
    database,
    organizationId,
    effectiveOn,
    organizationRevision: 2,
  })
  if (current instanceof Error) throw current
  expect(current.items).toMatchObject([
    { employmentId: "employment:one", status: "ON_LEAVE", startedOn: "2030-01-01" },
  ])
  const historical = await readCompanyEmploymentDirectory({
    database,
    organizationId,
    effectiveOn,
    organizationRevision: 1,
  })
  if (historical instanceof Error) throw historical
  expect(historical.items).toMatchObject([
    { employmentId: "employment:one", status: "ACTIVE", startedOn: "2030-01-01" },
  ])
  expect(
    await readCompanyEmploymentStartDates({
      database,
      organizationId,
      employmentIds: ["employment:missing"],
      organizationRevision: 2,
    }),
  ).toBeInstanceOf(Error)
  expect(
    await readCompanyEmploymentStartDates({
      database,
      organizationId,
      employmentIds: ["employment:one"],
      organizationRevision: -1,
    }),
  ).toBeInstanceOf(Error)
})
