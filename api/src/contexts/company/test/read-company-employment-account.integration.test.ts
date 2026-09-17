import { expect, test } from "bun:test"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { readCompanyEmploymentAccount } from "@/contexts/company/interface/operations/read-company-employment-account"
import { readCompanyEmploymentDirectory } from "@/contexts/company/interface/operations/read-company-employment-directory"
import { readCompanyEmploymentsByAccount } from "@/contexts/company/interface/operations/read-company-employments-by-account"
import { readCompanyEmploymentsByEmployee } from "@/contexts/company/interface/operations/read-company-employments-by-employee"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"

test("雇用と Account 対応を同じ Company 版で読み、存在しない雇用を補完しない", async () => {
  const fixture = await createGovernanceTaskTestContext()
  const person = fixture.people[1]!
  const effectiveOn = resolveCompanyBusinessDate({
    now: fixture.at.toISOString(),
    timeZone: "Asia/Tokyo",
  })
  if (effectiveOn instanceof Error) throw effectiveOn
  const employments = await readCompanyEmploymentsByEmployee({
    database: fixture.database,
    organizationId: "organization:default",
    employeeIds: [person.employeeId],
    effectiveOn,
  })
  if (employments instanceof Error) throw employments
  const employmentId = employments.employmentIdsByEmployee.get(person.employeeId)?.[0]
  if (employmentId === undefined) throw new Error("employment fixture is missing")

  const found = await readCompanyEmploymentAccount({
    database: fixture.database,
    organizationId: "organization:default",
    employmentId,
    effectiveOn,
    organizationRevision: employments.organizationRevision,
  })
  if (found instanceof Error) throw found
  expect(found).toEqual({
    organizationRevision: employments.organizationRevision,
    employment: {
      employeeId: person.employeeId,
      status: "ACTIVE",
      effectiveTo: null,
      accountId: person.accountId,
    },
  })

  expect(
    await readCompanyEmploymentsByAccount({
      database: fixture.database,
      organizationId: "organization:default",
      accountId: person.accountId,
      effectiveOn,
      organizationRevision: found.organizationRevision,
    }),
  ).toEqual({
    organizationRevision: found.organizationRevision,
    employmentIds: [employmentId],
    employmentStatusesById: new Map([[employmentId, "ACTIVE"]]),
  })
  expect(
    await readCompanyEmploymentsByAccount({
      database: fixture.database,
      organizationId: "organization:default",
      accountId: "account:missing",
      effectiveOn,
      organizationRevision: found.organizationRevision,
    }),
  ).toEqual({
    organizationRevision: found.organizationRevision,
    employmentIds: [],
    employmentStatusesById: new Map(),
  })

  const directory = await readCompanyEmploymentDirectory({
    database: fixture.database,
    organizationId: "organization:default",
    effectiveOn,
    organizationRevision: found.organizationRevision,
  })
  if (directory instanceof Error) throw directory
  expect(directory.items.find((item) => item.employmentId === employmentId)).toMatchObject({
    employeeId: person.employeeId,
    personName: expect.any(String),
    accountId: person.accountId,
    status: "ACTIVE",
  })

  const missing = await readCompanyEmploymentAccount({
    database: fixture.database,
    organizationId: "organization:default",
    employmentId: "employment:missing",
    effectiveOn,
    organizationRevision: found.organizationRevision,
  })
  expect(missing).toEqual({
    organizationRevision: found.organizationRevision,
    employment: null,
  })

  const beforeHire = await readCompanyEmploymentAccount({
    database: fixture.database,
    organizationId: "organization:default",
    employmentId,
    effectiveOn: restoreCalendarDate("1900-01-01"),
    organizationRevision: found.organizationRevision,
  })
  expect(beforeHire).toEqual({
    organizationRevision: found.organizationRevision,
    employment: null,
  })
}, 15_000)
