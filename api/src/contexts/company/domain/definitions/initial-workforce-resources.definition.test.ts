import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { initialWorkforceResources } from "@/contexts/company/domain/definitions/initial-workforce-resources.definition"
import { expect, test } from "bun:test"

const declaration = {
  employeeId: "employee:one",
  employmentId: "employment:one",
  officialName: "Example Person",
  employeeCode: "E001",
  email: "you@example.com",
  phone: null,
  employmentType: "PART_TIME",
  status: "leave",
  effectiveOn: restoreCalendarDate("2026-09-01"),
} as const

test("人、従業員、雇用を同じ開始日の最初の版として組み立てる", () => {
  const resources = initialWorkforceResources(declaration)

  expect(resources.map((resource) => [resource.type, resource.id, resource.revision])).toEqual([
    ["person", "person:employee:one", 1],
    ["employee", "employee:one", 1],
    ["employment", "employment:one", 1],
  ])
  expect(resources.every((resource) => resource.effectiveFrom === "2026-09-01")).toBe(true)
  expect(resources[1]?.attributes).toEqual({
    personId: "person:employee:one",
    employeeCode: "E001",
  })
  expect(resources[2]?.attributes).toEqual({
    employeeId: "employee:one",
    employmentType: "PART_TIME",
    status: "ON_LEAVE",
  })
})

test("Accountとの対応は、宣言された開始日で加える", () => {
  const resources = initialWorkforceResources({
    ...declaration,
    accountLink: { accountId: "account:one", effectiveOn: restoreCalendarDate("2026-09-15") },
  })

  expect(resources.at(-1)).toMatchObject({
    type: "account-employee-link",
    id: "account-link:employee:one",
    effectiveFrom: "2026-09-15",
    attributes: { accountId: "account:one", employeeId: "employee:one" },
  })
})
