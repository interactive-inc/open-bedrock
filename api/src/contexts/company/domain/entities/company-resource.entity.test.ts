import { describe, expect, test } from "bun:test"
import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"

const employee = {
  organizationId: "organization:default",
  type: "employee",
  id: "employee:1",
  revision: 1,
  state: "active",
  effectiveFrom: restoreCalendarDate("2026-01-01"),
  effectiveTo: null,
  attributes: { personId: "person:1", employeeCode: "E001" },
} as const satisfies CompanyResourceProps

describe("CompanyResourceEntity", () => {
  test("opaque IDと半開期間を持つイミュータブルEntityを生成する", () => {
    const resource = CompanyResourceEntity.create(employee)
    expect(resource).toBeInstanceOf(CompanyResourceEntity)
    if (!(resource instanceof CompanyResourceEntity)) return

    expect(resource.contains(restoreCalendarDate("2026-06-01"))).toBeTrue()
    expect(resource.readText("personId")).toBe("person:1")
    expect(Object.isFrozen(resource)).toBeTrue()
    expect(Object.isFrozen(resource.attributes)).toBeTrue()
  })

  test("空白を含むIDと逆転期間を拒否する", () => {
    expect(CompanyResourceEntity.create({ ...employee, id: "employee 1" })).toEqual(
      expect.objectContaining({ code: "invalid_identifier" }),
    )
    expect(
      CompanyResourceEntity.create({
        ...employee,
        effectiveTo: restoreCalendarDate("2025-12-31"),
      }),
    ).toEqual(expect.objectContaining({ code: "invalid_period" }))
  })

  test("組織単位resourceを期間モデルへ変換する", () => {
    const resource = CompanyResourceEntity.create({
      ...employee,
      type: "organization-unit",
      id: "organization-period:root",
      attributes: {
        organizationUnitId: "organization-unit:root",
        code: "ROOT",
        officialName: "Company",
        kind: "COMPANY",
        parentOrganizationUnitId: null,
      },
    })
    expect(resource).toBeInstanceOf(CompanyResourceEntity)
    if (!(resource instanceof CompanyResourceEntity)) return

    expect(resource.toOrganizationUnitPeriod()).toEqual(
      expect.objectContaining({
        code: "ROOT",
        kind: "COMPANY",
        parentOrganizationUnitId: null,
      }),
    )
  })
})
