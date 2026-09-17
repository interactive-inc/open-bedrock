import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { readCompanyEmploymentResourceChain } from "@/contexts/company/interface/operations/read-company-employment-resource-chain"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

const organizationId = "organization:default"

test("雇用・従業員・人物の資源版を同じ会社版で取得する", async () => {
  const database = createCompanyD1TestDatabase(
    readFileSync(
      new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
      "utf8",
    ) +
      "\n" +
      readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8"),
  )
  const repository = new D1CompanyResourceRepository({ database })
  const common = {
    organizationId,
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2030-01-01"),
    effectiveTo: null,
  } as const
  const initial = CompanyResourceChangeEntity.create({
    commandId: "resource-chain:initial",
    expectedRevision: 0,
    actorAccountId: "account:operator",
    reason: "Confirm employment",
    recordedAt: 1,
    resources: [
      { ...common, type: "person", id: "person-1", attributes: { officialName: "First Name" } },
      {
        ...common,
        type: "employee",
        id: "employee-1",
        attributes: { personId: "person-1", employeeCode: "E001" },
      },
      {
        ...common,
        type: "employment",
        id: "employment-1",
        attributes: {
          employeeId: "employee-1",
          status: "ACTIVE",
          employmentType: "FULL_TIME",
        },
      },
    ],
  })
  if (initial instanceof Error) throw initial
  expect(await repository.write(initial)).toMatchObject({ kind: "applied" })

  const before = await readCompanyEmploymentResourceChain({
    database,
    organizationId,
    employmentId: "employment-1",
  })
  expect(before).toEqual({
    organizationRevision: 1,
    employmentId: "employment-1",
    employmentRevision: 1,
    employeeId: "employee-1",
    employeeRevision: 1,
    personId: "person-1",
    personRevision: 1,
  })
  expect(
    await readCompanyEmploymentResourceChain({
      database,
      organizationId,
      employmentId: "employment-missing",
    }),
  ).toBeNull()

  const renamed = CompanyResourceChangeEntity.create({
    commandId: "resource-chain:rename",
    expectedRevision: 1,
    actorAccountId: "account:operator",
    reason: "Confirm new name",
    recordedAt: 2,
    resources: [
      {
        ...common,
        type: "person",
        id: "person-1",
        revision: 2,
        attributes: { officialName: "Second Name" },
      },
    ],
  })
  if (renamed instanceof Error) throw renamed
  expect(await repository.write(renamed)).toMatchObject({ kind: "applied" })
  expect(
    await readCompanyEmploymentResourceChain({
      database,
      organizationId,
      employmentId: "employment-1",
    }),
  ).toMatchObject({ organizationRevision: 2, personRevision: 2, employmentRevision: 1 })
})
