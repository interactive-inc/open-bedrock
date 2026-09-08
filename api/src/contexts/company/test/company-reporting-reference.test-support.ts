import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyPlaceTestContext } from "@/contexts/company/test/company-place.test-support"

/** 独立した二人の在籍と、組織を指定した上長関係の履歴を検証する。 */
export function createCompanyReportingReferenceTestContext(schemaSql?: string) {
  const company = createCompanyPlaceTestContext(schemaSql)
  const people = ["worker", "manager"].flatMap(
    (id): ReadonlyArray<CompanyResourceProps> => [
      {
        ...company.common,
        type: "person",
        id: `person:${id}`,
        attributes: { officialName: id },
      },
      {
        ...company.common,
        type: "employee",
        id: `employee:${id}`,
        attributes: { personId: `person:${id}` },
      },
      {
        ...company.common,
        type: "employment",
        id: `employment:${id}`,
        attributes: { employeeId: `employee:${id}`, status: "ACTIVE", employmentType: "FULL_TIME" },
      },
    ],
  )
  const reporting: CompanyResourceProps = {
    ...company.common,
    type: "reporting-relation",
    id: "reporting:worker",
    effectiveTo: restoreCalendarDate("2030-07-01"),
    attributes: {
      employeeId: "employee:worker",
      managerEmployeeId: "employee:manager",
      organizationUnitId: "unit:root",
    },
  }
  const closed: CompanyResourceProps = {
    ...reporting,
    revision: 2,
    state: "void",
    effectiveFrom: restoreCalendarDate("2030-07-01"),
    effectiveTo: null,
  }
  return { ...company, people, reporting, closed, resources: [company.unit, ...people, reporting] }
}
