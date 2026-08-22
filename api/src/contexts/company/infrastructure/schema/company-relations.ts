import { relations } from "drizzle-orm"
import { accountEmployeeLinks, employees } from "@/contexts/company/infrastructure/schema/employee"
import {
  organizationUnitPeriodVersions,
  organizationUnits,
} from "@/contexts/company/infrastructure/schema/organization"

/**
 * Company が所有する table の Drizzle relations。上流 context の table への関係は、その table を参照できる
 * この context 側で宣言する（Drizzle は同じ table への relations を合成する）。API root の schema 合成が全 context 分を束ねる。
 */
export const employeesRelations = relations(employees, (helpers) => {
  return {
    accountLink: helpers.one(accountEmployeeLinks, {
      fields: [employees.id],
      references: [accountEmployeeLinks.employeeId],
    }),
  }
})

export const accountEmployeeLinksRelations = relations(accountEmployeeLinks, (helpers) => {
  return {
    employee: helpers.one(employees, {
      fields: [accountEmployeeLinks.employeeId],
      references: [employees.id],
    }),
  }
})

export const organizationUnitsRelations = relations(organizationUnits, (helpers) => {
  return {
    periods: helpers.many(organizationUnitPeriodVersions, { relationName: "organizationUnit" }),
    childPeriods: helpers.many(organizationUnitPeriodVersions, {
      relationName: "parentOrganizationUnit",
    }),
  }
})

export const organizationUnitPeriodVersionsRelations = relations(
  organizationUnitPeriodVersions,
  (helpers) => {
    return {
      organizationUnit: helpers.one(organizationUnits, {
        fields: [organizationUnitPeriodVersions.organizationUnitId],
        references: [organizationUnits.id],
        relationName: "organizationUnit",
      }),
      parentOrganizationUnit: helpers.one(organizationUnits, {
        fields: [organizationUnitPeriodVersions.parentOrganizationUnitId],
        references: [organizationUnits.id],
        relationName: "parentOrganizationUnit",
      }),
    }
  },
)
